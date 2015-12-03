import {Map, fromJS, toJS} from 'immutable';
import nd from 'ndarray';
import ndPack from 'ndarray-pack';
import ndUnpack from 'ndarray-unpack';
import ndOps from 'ndarray-ops';
import pool from 'ndarray-scratch';
import cwise from 'cwise';
import gemm from 'ndgemm';

export const getUpdatedEstimates = function(rightLetterIndex, leftLetterIndex, state, value, variance) {
  let nFeatures = state.get('nFeatures');
  let oldEstimates = ndPack(state.get('estimates').toJS());
  let oldVariances = ndPack(state.get('estimateVariances').toJS());

  let getWeightsRow = function(array, index) {
    let row = pool.malloc([1, array.shape[1]]);
    let offset = array.shape[1] * index;
    for (let i = 0, l = array.shape[1]; i < l; i++) {
      row.data[i] = array.data[offset + i];
    }
    return row;
  };

  let rightLetterWeights = getWeightsRow(state.getIn(['nmf', nFeatures, 'right']).weights, rightLetterIndex).transpose(1, 0);
  let leftLetterWeights = getWeightsRow(state.getIn(['nmf', nFeatures, 'left']).weights, leftLetterIndex);
  let coefficientMatrix = pool.malloc([rightLetterWeights.shape[0], leftLetterWeights.shape[1]]); // the a_i
  gemm(coefficientMatrix, rightLetterWeights, leftLetterWeights);

  let factorMatrix = pool.malloc(coefficientMatrix.shape);
  // now create the factor matrix
  cwise({
    args: ['array', 'array', 'scalar', 'array'],
    body: function(factor, oldVariance, inputVarianceSquared, coeffMatrix) {
      let oldVarianceSquared = oldVariance * oldVariance;
      factor = (oldVarianceSquared / (oldVarianceSquared + inputVarianceSquared)) * coeffMatrix;
    }
  })(factorMatrix, oldVariances, variance * variance, coefficientMatrix);
  // now calculate the new estimates and the new variances
  var newEstimates = nd(new Float32Array(factorMatrix.shape[0] * factorMatrix.shape[0]), factorMatrix.shape);
  var newVariances = nd(new Float32Array(factorMatrix.shape[0] * factorMatrix.shape[0]), factorMatrix.shape);
  cwise({
    args: ['array', 'array', 'array', 'array', 'array', 'scalar', 'scalar'],
    body: function(newEstimate, oldEstimate, newVariance, oldVariance, factor, value, variance) {
      newEstimate = oldEstimate + factor * (value - oldEstimate);
      newVariance = Math.max(oldVariance - factor * variance, 0);
    }
  })(newEstimates, oldEstimates, newVariances, oldVariances, factorMatrix, value, variance);

//  console.log(coefficientMatrix.data, factorMatrix.data, "est", oldEstimates.data, newEstimates.data, "var", oldVariances.data, newVariances.data);

  return {
    estimates: newEstimates,
    estimateVariances: newVariances
  };
};

export const getPairEstimates = function(estimates, estimateVariances, rightNMF, leftNMF, glyphCount, nFeatures) {
  let rightEstimates = pool.malloc([glyphCount, nFeatures], 'float32');
  let pairEstimates = nd(new Float32Array(glyphCount * glyphCount), [glyphCount, glyphCount]);
  let pairEstimateVariances = nd(new Float32Array(glyphCount * glyphCount), [glyphCount, glyphCount]);
  leftNMF.weights.shape = [glyphCount, nFeatures];
  rightNMF.weights.shape = [glyphCount, nFeatures];
  // first get the estimates
  gemm(rightEstimates, rightNMF.weights, estimates);
  gemm(pairEstimates, rightEstimates, leftNMF.weights.transpose(1, 0));

  // then reuse rightEstimates for the estimateVariances
  //gemm(rightEstimates, rightNMF.weights, estimateVariances);
  gemm(pairEstimateVariances, rightEstimates, leftNMF.weights.transpose(1, 0));
  pool.free(rightEstimates);
  return {
    pairEstimates,
    pairEstimateVariances
  };
};
