import nd from 'ndarray';
import ndPack from 'ndarray-pack';
import ndUnpack from 'ndarray-unpack';
import ndOps from 'ndarray-ops';
import pool from 'ndarray-scratch';
import cwise from 'cwise';
import gemm from 'ndgemm';


function NMF(matrix, nFeatures = 2) {
  let M = matrix;

  // Initialize the weight and feature matrices with random values
  let W = nd(new Float32Array(M.shape[0] * nFeatures), [M.shape[0], nFeatures]);
  let H = nd(new Float32Array(nFeatures * M.shape[1]), [nFeatures, M.shape[1]]);
  ndOps.random(H);
  ndOps.random(W);

  let i = 0;
  let WH = pool.malloc([M.shape[0], M.shape[1]]);
  gemm(WH, W, H); // WH = W.dot(H)
  const costFunc = cwise({
    args: ['array', 'array'],
    pre: function() {
      this.cost = 0;
    },
    body: function(a, b) {
      this.cost += (a - b) * (a - b);
    },
    post: function() {
      return this.cost;
    }
  });
  var costVal = costFunc(M, WH) * 2;
  var previousCost = 2 * costVal;
  let precision = 1.001;
  let maxIterations = 30;

  let HN = pool.malloc([nFeatures, M.shape[1]]);
  let WW = pool.malloc([nFeatures, nFeatures]);
  let HD = pool.malloc([nFeatures, M.shape[1]]);

  let WN = pool.malloc([M.shape[0], nFeatures]);
  let HH = pool.malloc([nFeatures, nFeatures]);
  let WD = pool.malloc([M.shape[0], nFeatures]);

  const scaleNDArray = cwise({
    args: ['array', 'array', 'array'],
    body: function(a, b, c) {
      a = (a * b / c) || 0;
    }
  });

  while (previousCost / costVal > precision) {
    i++;
    gemm(WH, W, H);
    previousCost = costVal;

    costVal = costFunc(M, WH);
    if (costVal === 0 || i > maxIterations) {
      break;
    }

    // update feature columns
    gemm(HN, W.transpose(1, 0), M);
    gemm(WW, W.transpose(1, 0), W);
    gemm(HD, WW, H);

    scaleNDArray(H, HN, HD);

    // update weight rows
    gemm(WN, M, H.transpose(1, 0));
    gemm(HH, H, H.transpose(1, 0));
    gemm(WD, W, HH);

    scaleNDArray(W, WN, WD);
  }

  let newM = nd(new Float64Array(M.shape[0] * M.shape[1]), [M.shape[0], M.shape[1]]);
  gemm(newM, W, H);

  // make sure the weights add up to 1.0
  for (let i = 0, l = W.shape[0]; i < l; i++) {
    let rowSum = 0;
    for (let j = 0, k = W.shape[1]; j < k; j++) {
      rowSum += W.get(i, j);
    }
    for (let j = 0, k = W.shape[1]; j < k; j++) {
      W.set(i, j, W.get(i, j) / rowSum);
    }
  }

  let result = {
    original: M,
    weights: W,
    features: H,
    approximated: newM
  };

  // release the temporary memory
  pool.free(WH);
  pool.free(HN);
  pool.free(WW);
  pool.free(HD);
  pool.free(WN);
  pool.free(HH);
  pool.free(WD);
  return result;
}

export default function NMFfromImageArrays(arrays, features) {
  // inputMatrix is an array of side images, about 50 * 200 in size.
  let inputMatrix = nd(new Uint8ClampedArray(arrays.length * arrays[0].shape[0] * arrays[0].shape[1]), [arrays.length, arrays[0].shape[0] * arrays[0].shape[1]]);
  for (let i = 0, l = arrays.length; i < l; i++) {
    let currentArray = arrays[i];
    for (let j = 0, k = inputMatrix.shape[1], alphaPointer = 3; j < k; j++, alphaPointer += 4) {
      inputMatrix.set(i, j, currentArray.data[alphaPointer]);
    }
  }
  return NMF(inputMatrix, features);
}
