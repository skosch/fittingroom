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

import DropZone from 'react-dropzone';
import WordRenderer from '../components/WordRenderer';
import TextOverview from '../components/TextOverview';
import EstimateTable from '../components/EstimateTable';

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
    nFeatures: state.get('nFeatures'),
    results: state.get('results')
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
    onOptimize: () => dispatch(actions.optimize()),
    onAddKnownDistance: (rIndex, lIndex, value, variance) => dispatch(actions.addKnownDistance(rIndex, lIndex, value)),
    onNextNMF: () => {
      dispatch(actions.nextNMF());
    }
  };
}

const App = React.createClass({
  letters: 'abcdefghijklmnopqrstuvwxyz'.split(''),
  componentDidUpdate: function() {
      let oldPairEstimates = this.props.pairEstimates;
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
  loadFontFile(files) {
    var fileReader = new FileReader();
    fileReader.onloadend = () => {
      this.currentFontFaceStyleObject = document.createElement('style');
      this.currentFontFaceStyleObject.appendChild(document.createTextNode(`
        @font-face {
          font-family: 'fittingRoomUserFontName';
          src: url(` + fileReader.result + `);
        }
        `));
      document.head.appendChild(this.currentFontFaceStyleObject);

      setTimeout(this.props.onLoadFont, 200); // really, dude?
    };

    if (files[0]) {
      fileReader.readAsDataURL(files[0]);
    }
  },
  currentFontFaceStyleObject: null,
  render() {
    let featureCount = parseInt((this.props.nmf.get('left').features && this.props.nmf.get('left').features.shape[0]) || 0);
    return (
      <div>
        <h1 style={{color: 'darkred', fontWeight: '700'}}>FittingRoom<sup style={{color: 'gray'}}>JS</sup></h1>
        <hr/>
        <p><strong>This in an experiment only.</strong></p>
        <p>Instructions: Choose a font file, wait for it to load. Adjust the letter distances using the big word in the first box. View the effects in the sample box below.
          To increase the accuracy (i.e. make letter distances <em>less</em> dependent on one another), increase the number of features/estimates – this can take a few seconds.
        When you are done, click on the blue button to find the metrics that minimize total kerning. (NB: all values in pixels; you'll have to scale them relative to your em square.)</p>
        <div style={{height: '5em'}}>
          <div style={{opacity: 0, height: 0, width: 0, display: 'inline-block', fontFamily: 'fittingRoomUserFontName'}}>.</div>
          <DropZone onDrop={this.loadFontFile} className="dropzone">
            <div>Try dropping a font file here, or click to pick a file to upload (will take ~1 second)</div>
          </DropZone>
          {this.props.pairEstimates ?
          <div style={{float: 'right'}}>
            Currently interpolating distances from <strong>{this.props.nFeatures * this.props.nFeatures}</strong> estimates.<br/>
          <button onClick={this.props.onNextNMF} className='btnNMF'>» Increase to <strong>{(this.props.nFeatures + 1) * (this.props.nFeatures + 1)}</strong> estimates – <em>be patient</em> :)</button>
          </div>
          : null}
        </div>
        <hr/>
        {this.props.pairEstimates ?
        <div>
          <WordRenderer text="hamburg"
            fontInfo={this.props.fontInfo}
            pairEstimates={this.props.pairEstimates}
            fullGlyphs={this.props.font.get('fullGlyphs')}
            onAddKnownDistance={this.props.onAddKnownDistance}
            bearings={this.props.font.get('bearings')}
            draggableIndex={3} />
          <hr/>
          <TextOverview fontInfo={this.props.fontInfo} pairEstimates={this.props.pairEstimates} bearings={this.props.font.get('bearings')} />
          <hr />
          <div>
            {this.props.nFeatures === 1 ?
            <button disabled className='btnOptimize-disabled'>» Find optimal bearings and kernings (increase estimates first!)</button>
            : <button onClick={this.props.onOptimize} className='btnOptimize'>» Find optimal bearings and kernings (this can easily take a minute, and eat 100MB of RAM!)</button>
            }
            {this.props.results.leftBearings ?
              <div>
                <div className='bearingsResults'>
                  <table style={{float: 'left', margin: '1em'}}>
                    <tbody>
                      <tr><th></th><th>Left bearing</th><th>Right bearing</th></tr>
                      {this.props.fontInfo.get('activeLetters').map((l, li) => (
                        <tr key={li}><td>{l}</td><td>{this.props.results.leftBearings[li]}</td><td>{this.props.results.rightBearings[li]}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className='kerningResults'>
                  <table style={{margin: '1em'}}>
                    <tbody>
                      <tr><th>Pair</th><th>Kern</th></tr>
                      {this.props.results.kernings.map((k, ki) => (
                        <tr key={ki}><td>{k[0]} {k[1]}</td><td>{k[2]}</td></tr>
                      ))}
                    </tbody>
                  </table>

                </div>
              </div>
            : null}
          </div>
          <hr />
          <h4>Table of all features and their associated distance estimates (for debugging and curiosity)</h4>
          <EstimateTable fontInfo={this.props.fontInfo} nFeatures={this.props.nFeatures}
            nmf={this.props.nmf} estimates={this.props.estimates}
            onSetEstimate={this.props.onSetEstimate} />
        </div>
        : null}

          <hr />
          <div style={{float: 'left', lineHeight: '3em'}}>♥ 2015. Sebastian Kosch in Torontone fecit. Contact: <em>firstname</em>@planwithplank.com</div>
          <div style={{float: 'right', background: '#5483A5', height: '3em', borderRadius: '4px'}}><a href="https://www.planwithplank.com"><img style={{height: '2em', padding: '0.5em 0.7em'}} src="data:image/png;base64,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" alt="PLANK" /></a></div>
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
        <canvas ref="oldImageCanvas" height='200' width={this.letters.length * 50}></canvas>
        <canvas ref="transformedMatrixCanvas" height={this.letters.length} width='10000'></canvas>
        Letters after transformation:
        <canvas ref="newImageCanvas" height='200' width={this.letters.length * 50}></canvas>*/}

      </div>
    );
  }
});

export default connect(mapStoreStateToProps, mapDispatchToProps)(App);
