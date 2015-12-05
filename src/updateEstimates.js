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

  // now calculate the new estimates and the new variances
  var newEstimates = nd(new Float32Array(coefficientMatrix.shape[0] * coefficientMatrix.shape[0]), coefficientMatrix.shape);
  cwise({
    args: ['array', 'array', 'array', 'scalar'],
    body: function(newEstimate, oldEstimate, factor, value) {
      newEstimate = oldEstimate + factor * (value - oldEstimate);
    }
  })(newEstimates, oldEstimates, coefficientMatrix, value);

  return {
    estimates: newEstimates,
  };
};

export const getPairEstimates = function(estimates, rightNMF, leftNMF, glyphCount, nFeatures) {
  let rightEstimates = pool.malloc([glyphCount, nFeatures], 'float32');
  let pairEstimates = nd(new Float32Array(glyphCount * glyphCount), [glyphCount, glyphCount]);
  leftNMF.weights.shape = [glyphCount, nFeatures];
  rightNMF.weights.shape = [glyphCount, nFeatures];
  // first get the estimates
  gemm(rightEstimates, rightNMF.weights, estimates);
  gemm(pairEstimates, rightEstimates, leftNMF.weights.transpose(1, 0));
  pool.free(rightEstimates);
  return {
    pairEstimates,
  };
};
