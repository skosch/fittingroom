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

export function optimize(text) {
  return {
    type: 'OPTIMIZE'
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

export function addKnownDistance(rightIndex, leftIndex, value) {
  return {
    type: 'ADD_KNOWNDISTANCE',
    rightIndex,
    leftIndex,
    value,
  };
}
export function loadFont() {
  return {
    type: 'LOAD_FONT',
  };
}
