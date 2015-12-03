import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import {connect} from 'react-redux';

import pool from 'ndarray-scratch';
import cwise from 'cwise';
import * as actions from '../actions';
import _ from 'lodash';
import ndUnpack from 'ndarray-unpack';
import ndPack from 'ndarray-pack';
import nd from 'ndarray';
import {toJS} from 'immutable';
import gemm from 'ndgemm';

import WordRenderer from '../components/WordRenderer';
import TextOverview from '../components/TextOverview';

/* connect to the central state store */
function mapStoreStateToProps(state) {
  return {
    fontInfo: state.getIn(['font', 'info']),
    font: state.getIn(['font']),
    nmf: state.getIn(['nmf', state.get('nFeatures')]),
    isLoaded: state.getIn(['font', 'isLoaded']),
    estimates: state.get('estimates'),
    estimateVariances: state.get('estimateVariances'),
    pairEstimates: state.get('pairEstimates'),
    sampleText: state.get('sampleText'),
    nFeatures: state.get('nFeatures')
  };
}

function mapDispatchToProps(dispatch) {
  return {
    onSetFont: (font) => {
      dispatch(actions.setFont(font));
    },
    onSetComponents: (components) => {
      dispatch(actions.setComponents(components));
    },
    onSetEstimate: (rightIndex, leftIndex, value) => {
      dispatch(actions.setEstimate(rightIndex, leftIndex, value));
    },
    onSetSampleText: (value) => {
      dispatch(actions.setSampleText(value));
    },
    onLoadFont: () => dispatch(actions.loadFont()),
    onComputeNMF: () => dispatch(actions.computeNMF()),
    onAddKnownDistance: (rIndex, lIndex, value, variance) => dispatch(actions.addKnownDistance(rIndex, lIndex, value, variance)),
    onNextNMF: () => {
      dispatch(actions.nextNMF());
    }
  };
}

const App = React.createClass({
  letters: 'abcdefghijklmnopqrstuvwxyz'.split(''),
  componentDidUpdate: function() {
      let oldPairEstimates = this.props.pairEstimates;
    let getMatrixImage = function(singleChannelArray) {
      let matrixImageArray = pool.malloc([singleChannelArray.shape[0], singleChannelArray.shape[1], 4], 'uint8_clamped');
      cwise({
        args: ['array', {blockIndices: -1}],
        body: function(singleChannel, fourChannel) {
          fourChannel[0] = 0;
          fourChannel[1] = 0;
          fourChannel[2] = 0;
          fourChannel[3] = singleChannel;
        }
      })(singleChannelArray, matrixImageArray);
      return matrixImageArray;
    };

    // show the features in the feature table
    if (this.props.nmf.get('left').features) {
      let leftFeatures = this.props.nmf.get('left').features;
      for (let i = 0, l = leftFeatures.shape[0]; i < l; i++) {
        // first, get the data for the relevant line
        let reshapedFeature = pool.malloc([200, 50], 'float32');
        for (let j0 = 0, k0 = 200; j0 < k0; j0++) {
          for (let j1 = 0, k1 = 50; j1 < k1; j1++) {
            reshapedFeature.set(j0, j1, parseInt(leftFeatures.data[10000 * i + j0 * 50 + j1]));
          }
        }
        let reshapedChanneledFeature = getMatrixImage(reshapedFeature);
        this.refs['featureCanvas_l' + i].getContext('2d').putImageData(new ImageData(reshapedChanneledFeature.data, 50, 200), 0, 0);
        this.refs['featureCanvas_el' + i].getContext('2d').putImageData(new ImageData(reshapedChanneledFeature.data, 50, 200), 0, 0);
        pool.free(reshapedChanneledFeature);
      }
    }
    if (this.props.nmf.get('right').features) {
      let rightFeatures = this.props.nmf.get('right').features;
      for (let i = 0, l = rightFeatures.shape[0]; i < l; i++) {
        // first, get the data for the relevant line
        let reshapedFeature = pool.malloc([200, 50], 'float32');
        for (let j0 = 0, k0 = 200; j0 < k0; j0++) {
          for (let j1 = 0, k1 = 50; j1 < k1; j1++) {
            reshapedFeature.set(j0, j1, parseInt(rightFeatures.data[10000 * i + j0 * 50 + j1]));
          }
        }
        let reshapedChanneledFeature = getMatrixImage(reshapedFeature);
        this.refs['featureCanvas_r' + i].getContext('2d').putImageData(new ImageData(reshapedChanneledFeature.data, 50, 200), 0, 0);
        this.refs['featureCanvas_er' + i].getContext('2d').putImageData(new ImageData(reshapedChanneledFeature.data, 50, 200), 0, 0);
        pool.free(reshapedChanneledFeature);
      }
    }
    // okay, now put the transformed letters
    // result.newM is now a 26 * 10000 matrix
    /*
    if (this.props.nmf.get('left').approximated) {
      let newLetters = pool.malloc([200, 50*26], 'int16');
      let oldLetters = pool.malloc([200, 50*26], 'int16');
      for (let j = 0, k = 200; j < k; j++) { // vertical
        for (let li = 0, lil = 26; li < lil; li++) { // for each of the 26 letters,
          for (let i = 0, l = 50; i < l; i++) { // horizontal
            oldLetters.set(j, 50 * li + i, (this.props.nmf.get('right').original.data[10000*li+j*50+i]));
            newLetters.set(j, 50 * li + i, (this.props.nmf.get('right').approximated.data[10000*li+j*50+i]));
          }
        }
      }

      let oldImage = getMatrixImage(oldLetters);
      let newImage = getMatrixImage(newLetters);
      this.refs.oldImageCanvas.getContext('2d').putImageData(new ImageData(oldImage.data, this.letters.length*50, 200), 0, 0);
      this.refs.newImageCanvas.getContext('2d').putImageData(new ImageData(newImage.data, this.letters.length*50, 200), 0, 0);
      pool.free(oldImage);
      pool.free(newImage);
      pool.free(oldLetters);
      pool.free(newLetters);
    }

*/
  },
  render() {
    let featureCount = parseInt((this.props.nmf.get('left').features && this.props.nmf.get('left').features.shape[0]) || 0);
    return (
      <div>
        <div>
          Font name:
          <input value={this.props.fontInfo.get('name')} ref="txtFontName" onChange={(event) => this.props.onSetFont(event.target.value)} />
          <button onClick={this.props.onLoadFont}>Load font</button> ... loaded? {this.props.isLoaded ? "yes" : "no"}
          <button onClick={this.props.onComputeNMF}>Compute next NMF (current: {this.props.nFeatures})</button>
          <button onClick={this.props.onNextNMF}>NextNMF</button>
        </div>

        {this.props.pairEstimates ?
        <div>
          <WordRenderer text="hamburg"
            fontInfo={this.props.fontInfo}
            pairEstimates={this.props.pairEstimates}
            fullGlyphs={this.props.font.get('fullGlyphs')}
            onAddKnownDistance={this.props.onAddKnownDistance}
            bearings={this.props.font.get('bearings')}
            draggableIndex={3} />

          <TextOverview fontInfo={this.props.fontInfo} pairEstimates={this.props.pairEstimates} bearings={this.props.font.get('bearings')} />
{/*
          <h3>All current distances</h3>
          <table>
            <tbody>
              <tr>
                <th>Letter</th>
                {
                  this.props.fontInfo.get('activeLetters').map((l, li) => (
                  <th key={li}>{l}</th>
                  ))
                }
              </tr>
              {
                this.props.fontInfo.get('activeLetters').map((l, li) => (
                  <tr key={li}>
                    {
                      this.props.fontInfo.get('activeLetters').map((l2, li2) => (
                      li2 === 0 ?
                      <td key={li2}>{l}</td> :
                      <td key={li2} style={{fontFamily: 'monospace', borderRight: '1px solid gray'}}>{parseInt(100 * this.props.pairEstimates.get(li, li2 - 1)) / 100}</td>
                      ))
                    }
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        */}
        : null}

        {this.props.nmf.get('left').features ?
        <div>
          <h3>Distance Estimates</h3>
          <table>
            <tbody>
              <tr>
                {
                  _.map(_.range(featureCount + 1), i => (
                  i === 0 ?
                  <th key={i}>Letter</th>
                  :
                  <th key={i}><canvas ref={'featureCanvas_el' + (i - 1)} height="200" width='50'></canvas></th>
                  ))
                }
              </tr>
              {
                _.range(featureCount).map(i => (
                  <tr key={i}>
                    {_.map(_.range(featureCount + 1), j => (
                      j === 0 ?
                      <td key={j}><canvas ref={'featureCanvas_er' + (i)} height="200" width='50'></canvas></td>
                      : <td key={j}>
                      <input value={this.props.estimates.getIn([i, j - 1]) || 0} onChange={(event) => this.props.onSetEstimate(i, j-1, event.target.value)} />
                      <input defaultValue={this.props.estimateVariances.getIn([i, j - 1]) || 0} readOnly={true}/>

                      </td>
                    ))}
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        : null}
{/*
        {this.props.nmf.get('left').features ?
        <div>
          <h3>Coefficients</h3>
          <table>
            <tbody>
              <tr>
                {
                  _.map(_.range(featureCount * 2 + 1), i => (
                  i === 0 ?
                  <th key={i}>Letter</th>
                  : ((i - 1) < featureCount ?
                  <th key={i}><canvas ref={'featureCanvas_r' + (i - 1)} height="200" width='50'></canvas></th>
                    : <th key={i}><canvas ref={'featureCanvas_l' + (i - 1 - featureCount)} height="200" width='50'></canvas></th>
                    )
                  ))
                }
              </tr>
              {
                this.props.fontInfo.get('activeLetters').map((l, li) => (
                  <tr key={li}>
                    {
                      _.map(_.range(featureCount * 2 + 1), i => (
                      i === 0 ?
                      <td key={i}>{l}</td>
                      : ((i - 1) < featureCount ?
                      <td key={i}>{parseInt(100 * this.props.nmf.get('right').weights.get(li, i - 1)) / 100}</td>
                        : <td key={i}>{parseInt(100 * this.props.nmf.get('left').weights.get(li, i - 1 - featureCount)) / 100}</td>
                        )
                      ))
                    }
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        : null}

        <div>
          <h3>Features</h3>
          <table>
              {this.props.nmf.get('left').features ?
                <tbody>
                <tr>
                  {_.map(_.range(this.props.nmf.get('left').features.shape[0]), i => (
                    <td key={i}>Feature {i}</td>
                  ))}
                </tr>
                <tr>
                  {_.map(_.range(this.props.nmf.get('left').features.shape[0]), i => (
                    <td key={i}><canvas ref={'featureCanvas_l' + i} height="300" width='50'></canvas></td>
                  ))}
                </tr>
                <tr>
                  {_.map(_.range(this.props.nmf.get('right').features.shape[0]), i => (
                    <td key={i}><canvas ref={'featureCanvas_r' + i} height="300" width='50'></canvas></td>
                  ))}
                </tr>
            </tbody>
              : <tr><td>No Features</td><td>--</td></tr>}
          </table>
        </div>
        */}

        {/*Letters before transformation:
        <canvas ref="oldImageCanvas" height='200' width={this.letters.length * 50}></canvas>
        <canvas ref="transformedMatrixCanvas" height={this.letters.length} width='10000'></canvas>
        Letters after transformation:
        <canvas ref="newImageCanvas" height='200' width={this.letters.length * 50}></canvas>*/}

      </div>
    );
  }
});

export default connect(mapStoreStateToProps, mapDispatchToProps)(App);
