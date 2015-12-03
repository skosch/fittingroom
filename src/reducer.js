import {Map, fromJS, toJS, List} from 'immutable';
import loadFont from './fontLoader';
import NMFfromImageArrays from './nmf';
import {getUpdatedEstimates, getPairEstimates} from './updateEstimates';
import nd from 'ndarray';
import ndPack from 'ndarray-pack';
import pool from 'ndarray-scratch';
import ndUnpack from 'ndarray-unpack';

import qr from 'ndarray-householder-qr';

function setState(state, newState) {
  return state.merge(newState);
}

const initialState = Map({
  font: Map({
    info: Map({
      name: 'Arial',
      activeLetters: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.,-+()'.split(''),
      width: 300,
      height: 200,
      sideWidth: 50
    })
  }),
  nmf: List([
    Map({ // the empty map for nFeatures = 0
      left: {
        features: null,
        weights: null
      },
      right: {
        features: null,
        weights: null
      },
    }),
  ]),
  nFeatures: 0,
  estimates: null,
  sampleText: "ha",
  //knownDistances:
});

const setEstimate = function(state, action) {
  let nFeatures = state.get('nFeatures');
  let newState = state.mergeIn(['estimates', action.rightIndex, action.leftIndex], action.value);
  let newPairEstimates = getPairEstimates(ndPack(newState.get('estimates').toJS()), ndPack(newState.get('estimateVariances').toJS()),
    state.getIn(['nmf', nFeatures, 'right']),
    state.getIn(['nmf', nFeatures, 'left']),
    state.getIn(['font', 'info', 'activeLetters']).length,
    nFeatures);
  return newState.set('pairEstimates', newPairEstimates.pairEstimates).set('pairEstimateVariances', newPairEstimates.pairEstimateVariances);
};

const addKnownDistance = function(state, action) {
  let nFeatures = state.get('nFeatures');
  // this will include a rightLetterIndex and a leftLetterIndex and a fixed value.
  // we now need to create a factor matrix. The factor matrix
  // loop through all estimates and adjust them, based on the new information
  let newEstimatesFromValue = getUpdatedEstimates(action.rightIndex, action.leftIndex, state, action.value, action.variance);

  let newPairEstimatesFromValue = getPairEstimates(newEstimatesFromValue.estimates, newEstimatesFromValue.estimateVariances,
    state.getIn(['nmf', nFeatures, 'right']),
    state.getIn(['nmf', nFeatures, 'left']),
    state.getIn(['font', 'info', 'activeLetters']).length,
    nFeatures);
  // now update the calculated distance for the sample text
  // we need to loop through all of the estimated distances and multiply by the percentages, and then sum all of them up.
  return state
    .set('estimates', fromJS(ndUnpack(newEstimatesFromValue.estimates)))
    .set('estimateVariances', fromJS(ndUnpack(newEstimatesFromValue.estimateVariances)))
    .set('pairEstimates', newPairEstimatesFromValue.pairEstimates)
    .set('pairEstimateVariances', newPairEstimatesFromValue.pairEstimateVariances);
    //  .setIn(['knownDistances', action.rightIndex, action.leftIndex], [action.value, action.variance]);
};

const nextNMF = function(state, action) {
  // get the new estimates and variances from the least-squares approximated feature Coefficients
  let nFeatures = state.get('nFeatures');
  let newRWeights = state.getIn(['nmf', nFeatures + 1, 'right']).weights;
  let newLWeights = state.getIn(['nmf', nFeatures + 1, 'left']).weights;
  let oldPairEstimates = state.get('pairEstimates');
  let oldPairEstimateVariances = state.get('pairEstimateVariances');
  let nNewFeatures = newRWeights.shape[1];
  let glyphCount = oldPairEstimates.shape[0];
  let qrDiagonal = pool.malloc([nNewFeatures * nNewFeatures]);
  let A = pool.malloc([glyphCount * glyphCount, nNewFeatures * nNewFeatures]);
  for (let ir = 0; ir < glyphCount; ir++) {
    for (let il = 0; il < glyphCount; il++) { // each left glyph
      for (let rEst = 0; rEst < nNewFeatures; rEst++) {
        for (let lEst = 0; lEst < nNewFeatures; lEst++) {
          A.set(ir * glyphCount + il, rEst * nNewFeatures + lEst, newRWeights.get(ir, rEst) * newLWeights.get(il, lEst));
        }
      }
    }
  }
  qr.factor(A, qrDiagonal);
  let flattenedPairEstimates = nd(oldPairEstimates.data); // this is 1 x (glyphCount ** glyphCount)
  qr.solve(A, qrDiagonal, flattenedPairEstimates);

  // now do the same for the pairEstimateVariances -- essentially, set the new estimateVariances
  // such that when the weighted sums are taken for the pairEstimateVariances, the change is minimized.
  // in this way, pairEstimateVariances are simply a way to minimize the pain of going to a higher-order NMF.
  let flattenedPairEstimateVariances = nd(oldPairEstimateVariances.data);
  qr.solve(A, qrDiagonal, flattenedPairEstimateVariances);

  // now simply reshape the solution
  pool.free(A);
  pool.free(qrDiagonal);
  let newEstimates = nd(new Float32Array(nNewFeatures * nNewFeatures), [nNewFeatures, nNewFeatures]);
  let newEstimateVariances = nd(new Float32Array(nNewFeatures * nNewFeatures), [nNewFeatures, nNewFeatures]);
  for (let rEst = 0; rEst < nNewFeatures; rEst++) {
    let offset = rEst * nNewFeatures;
    for (let lEst = 0; lEst < nNewFeatures; lEst++) {
      newEstimates.set(rEst, lEst, flattenedPairEstimates.data[offset + lEst]);
      newEstimateVariances.set(rEst, lEst, flattenedPairEstimateVariances.data[offset * lEst]);
    }
  }
  // also get new pairEstimates
  let newPairEstimates = getPairEstimates(newEstimates, newEstimateVariances,
    state.getIn(['nmf', nFeatures + 1, 'right']),
    state.getIn(['nmf', nFeatures + 1, 'left']),
    state.getIn(['font', 'info', 'activeLetters']).length,
    nFeatures + 1);

  return state
    .set('nFeatures', state.get('nFeatures') + 1)
    .set('estimates', fromJS(ndUnpack(newEstimates)))
    .set('estimateVariances', fromJS(ndUnpack(newEstimates)))
    .set('pairEstimates', newPairEstimates.pairEstimates)
    .set('pairEstimateVariances', newPairEstimates.pairEstimateVariances);
};


export default function(state = initialState, action) {
  switch (action.type) {
    case "SET_STATE":
      return setState(state, action.state);
    case "SET_FONT":
      return state.setIn(['font', 'info', 'name'], action.font);
    case "SET_COMPONENTS":
      return state.setIn(['nmf', 'components'], action.components);
    case "LOAD_FONT":
      let fontData = loadFont(state.getIn(['font', 'info']).toJS());
      let firstLeftNMFResult = NMFfromImageArrays(fontData.leftSides, 1);
      let firstRightNMFResult = NMFfromImageArrays(fontData.rightSides, 1);
      let firstRawEstimates = pool.ones([1, 1], 'float32');
      let firstRawEstimateVariances = pool.ones([1, 1], 'float32');
      let firstEstimates = fromJS(ndUnpack(firstRawEstimates));
      let firstEstimateVariances = fromJS(ndUnpack(firstRawEstimateVariances));
      let firstPairEstimates = getPairEstimates(firstRawEstimates, firstRawEstimateVariances,
        firstRightNMFResult,
        firstLeftNMFResult,
        state.getIn(['font', 'info', 'activeLetters']).length,
        1);
      return state
        .setIn(['font','fullGlyphs'], fontData.fullGlyphs)
        .setIn(['font','leftSides'], fontData.leftSides)
        .setIn(['font','bearings'], fontData.bearings)
        .setIn(['font','rightSides'], fontData.rightSides)
        .setIn(['font','isLoaded'], true)
        .mergeIn(['nmf', 1], Map({
          left: firstLeftNMFResult,
          right: firstRightNMFResult
        }))
        .set('nFeatures', 1)
        .set('estimates', firstEstimates)
        .set('estimateVariances', firstEstimateVariances)
        .set('pairEstimates', firstPairEstimates.pairEstimates)
        .set('pairEstimateVariances', firstPairEstimates.pairEstimateVariances);
    case "COMPUTE_NMF":
      let nFeatures = state.get('nFeatures') + 1;
      let leftNmfResult = NMFfromImageArrays(state.getIn(['font', 'leftSides']), nFeatures);
      let rightNmfResult = NMFfromImageArrays(state.getIn(['font', 'rightSides']), nFeatures);
      //let newEstimates = fromJS(ndUnpack(nd(new Float32Array(nFeatures * nFeatures), [nFeatures, nFeatures])));
      //let newEstimateVariances = fromJS(ndUnpack(pool.ones([nFeatures, nFeatures])));
      return state.mergeIn(['nmf', nFeatures], Map({
        left: leftNmfResult,
        right: rightNmfResult
      })); //.set('estimates', newEstimates).set('estimateVariances', newEstimateVariances);
    case "NEXT_NMF":
      return nextNMF(state, action);
    case "SET_ESTIMATE":
      return setEstimate(state, action);
    case "SET_SAMPLETEXT":
      return state.set('sampleText', action.text);
    case "ADD_KNOWNDISTANCE":
      return addKnownDistance(state, action);
    default:
      return state;
  }
}
