export function setState(newState) {
  return {
    type: 'SET_STATE',
    newState
  };
}

export function setFont(font) {
  return {
    type: 'SET_FONT',
    font
  };
}

export function setComponents(components) {
  return {
    type: 'SET_COMPONENTS',
    components
  };
}

export function setSampleText(text) {
  return {
    type: 'SET_SAMPLETEXT',
    text
  };
}

export function setEstimate(rightIndex, leftIndex, value) {
  return {
    type: 'SET_ESTIMATE',
    rightIndex,
    leftIndex,
    value
  };
}

export function nextNMF() {
  return {
    type: 'NEXT_NMF',
  };
}
export function addKnownDistance(rightIndex, leftIndex, value, variance) {
  return {
    type: 'ADD_KNOWNDISTANCE',
    rightIndex,
    leftIndex,
    value,
    variance
  };
}
export function loadFont() {
  return {
    type: 'LOAD_FONT',
  };
}

export function computeNMF(matrix) {
  return {
    type: 'COMPUTE_NMF',
    matrix
  };
}
