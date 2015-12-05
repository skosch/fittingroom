import React from 'react';
import cwise from 'cwise';
import pool from 'ndarray-scratch';

export default React.createClass({
  drawLetters() {
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
        this.refs['featureCanvas_er' + i].getContext('2d').putImageData(new ImageData(reshapedChanneledFeature.data, 50, 200), 0, 0);
        pool.free(reshapedChanneledFeature);
      }
    }
  },
  componentDidMount: function() {
    this.drawLetters();
  },
  componentDidUpdate: function(prevProps, prevState) {
    this.drawLetters();
  },

  render() {
    return (
      <table style={{margin: '0 auto'}}>
        <tbody>
          <tr>
            {
              _.map(_.range(this.props.nFeatures + 1), i => (
                i === 0 ?
                <th key={i}></th>
                :
                <th key={i}><canvas ref={'featureCanvas_el' + (i - 1)} height="200" width='50'></canvas></th>
              ))
            }
          </tr>
          {
            _.range(this.props.nFeatures).map(i => (
              <tr key={i}>
                {_.map(_.range(this.props.nFeatures + 1), j => (
                  j === 0 ?
                  <td key={j}><canvas ref={'featureCanvas_er' + (i)} height="200" width='50'></canvas></td>
                  : <td key={j}>
                  <input
                    value={Math.round(10 * this.props.estimates.getIn([i, j - 1])) / 10 || 0}
                    onChange={(event) => this.props.onSetEstimate(i, j-1, event.target.value)}
                    style={{width: '4em'}}/>
                </td>
              ))}
            </tr>
          ))
        }
      </tbody>
    </table>
  );
}
//style={this.state.hasOwnProperty(li) ? {marginLeft: this.state[li] || 0} : null}
});
