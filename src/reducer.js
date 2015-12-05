import {Map, fromJS, toJS, List} from 'immutable';
import loadFont from './fontLoader';
import NMFfromImageArrays from './nmf';
import optimize from './optimize';
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
      name: 'fittingRoomUserFontName',
      activeLetters: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), // 
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
  results: {}
});

const setEstimate = function(state, action) {
  let nFeatures = state.get('nFeatures');
  let newState = state.mergeIn(['estimates', action.rightIndex, action.leftIndex], action.value);
  let newPairEstimates = getPairEstimates(ndPack(newState.get('estimates').toJS()),
    state.getIn(['nmf', nFeatures, 'right']),
    state.getIn(['nmf', nFeatures, 'left']),
    state.getIn(['font', 'info', 'activeLetters']).length,
    nFeatures);
  return newState.set('pairEstimates', newPairEstimates.pairEstimates);
};

const addKnownDistance = function(state, action) {
  let nFeatures = state.get('nFeatures');
  // this will include a rightLetterIndex and a leftLetterIndex and a fixed value.
  // we now need to create a factor matrix. The factor matrix
  // loop through all estimates and adjust them, based on the new information
  let newEstimatesFromValue = getUpdatedEstimates(action.rightIndex, action.leftIndex, state, action.value);

  let newPairEstimatesFromValue = getPairEstimates(newEstimatesFromValue.estimates,
    state.getIn(['nmf', nFeatures, 'right']),
    state.getIn(['nmf', nFeatures, 'left']),
    state.getIn(['font', 'info', 'activeLetters']).length,
    nFeatures);
  // now update the calculated distance for the sample text
  // we need to loop through all of the estimated distances and multiply by the percentages, and then sum all of them up.
  return state
    .set('estimates', fromJS(ndUnpack(newEstimatesFromValue.estimates)))
    .set('pairEstimates', newPairEstimatesFromValue.pairEstimates);
};

const nextNMF = function(state, action) {
  let nFeatures = state.get('nFeatures');
  // compute the new features
  let leftNmfResult = NMFfromImageArrays(state.getIn(['font', 'leftSides']), nFeatures + 1);
  let rightNmfResult = NMFfromImageArrays(state.getIn(['font', 'rightSides']), nFeatures + 1);
  // get the new estimates  from the least-squares approximated feature Coefficients
  let newRWeights = rightNmfResult.weights;
  let newLWeights = leftNmfResult.weights;

  let oldPairEstimates = state.get('pairEstimates');
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

  // now simply reshape the solution
  pool.free(A);
  pool.free(qrDiagonal);
  let newEstimates = nd(new Float32Array(nNewFeatures * nNewFeatures), [nNewFeatures, nNewFeatures]);
  for (let rEst = 0; rEst < nNewFeatures; rEst++) {
    let offset = rEst * nNewFeatures;
    for (let lEst = 0; lEst < nNewFeatures; lEst++) {
      newEstimates.set(rEst, lEst, flattenedPairEstimates.data[offset + lEst]);
    }
  }
  // also get new pairEstimates
  let newPairEstimates = getPairEstimates(newEstimates,
    rightNmfResult,
    leftNmfResult,
    state.getIn(['font', 'info', 'activeLetters']).length,
    nFeatures + 1);

  return state
    .mergeIn(['nmf', nFeatures + 1], Map({
      left: leftNmfResult,
      right: rightNmfResult
    }))
    .set('nFeatures', nFeatures + 1)
    .set('estimates', fromJS(ndUnpack(newEstimates)))
    .set('pairEstimates', newPairEstimates.pairEstimates);
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
      let firstEstimates = fromJS(ndUnpack(firstRawEstimates));
      let firstPairEstimates = getPairEstimates(firstRawEstimates,
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
        .set('results', {})
        .mergeIn(['nmf', 1], Map({
          left: firstLeftNMFResult,
          right: firstRightNMFResult
        }))
        .set('nFeatures', 1)
        .set('estimates', firstEstimates)
        .set('pairEstimates', firstPairEstimates.pairEstimates);
    case "NEXT_NMF":
      return nextNMF(state, action);
    case "SET_ESTIMATE":
      return setEstimate(state, action);
    case "SET_SAMPLETEXT":
      return state.set('sampleText', action.text);
    case "ADD_KNOWNDISTANCE":
      return addKnownDistance(state, action);
    case "OPTIMIZE":
      return optimize(state, action);
    default:
      return state;
  }
}
