import React from 'react';
import cwise from 'cwise';
import Draggable from 'react-draggable';

export default React.createClass({
  getInitialState() {
    return {
      curLeft: 0,
      draggableIndex: this.props.draggableIndex,
      text: this.props.text
    };
  },
  drawLetters() {
    for (let i = 0, l = this.state.text.length; i < l; i++) {
      let currentLetterIndex = this.props.fontInfo.get('activeLetters').indexOf(this.state.text.substr(i, 1));
      if (currentLetterIndex === -1) continue;
      let currentCanvas = this.refs['glyphCanvas_' + i];
      if (this.state.text.substr(i, 1) === " ") {
        currentCanvas.width = this.props.bearings[currentLetterIndex][0]; // width of a space
      } else {
        let currentLetter = this.props.fullGlyphs[currentLetterIndex];
        let currentContext = currentCanvas.getContext('2d');
        currentCanvas.width = currentLetter.shape[0];
        currentCanvas.height = currentLetter.shape[1];
        let glyphImage = new ImageData(currentLetter.data, currentLetter.shape[0], currentLetter.shape[1]);
        currentCanvas.getContext('2d').putImageData(glyphImage, 0, 0);
        if (i === this.state.draggableIndex) {
          currentContext.beginPath();
          currentContext.moveTo(0, 150);
          currentContext.lineTo(150, 150);
          currentContext.stroke();
        }
      }
      if (i === l - 1) break;
      let nextLetterIndex = this.props.fontInfo.get('activeLetters').indexOf(this.state.text.substr(i + 1, 1));
      currentCanvas.style.marginRight = this.props.pairEstimates.get(currentLetterIndex, nextLetterIndex) + "px";
      this.refs.draggable.style.transform = "";
    }
  },
  componentDidMount: function() {
    this.drawLetters();
  },
  componentDidUpdate: function(prevProps, prevState) {
    this.drawLetters();
  },
  addKnownDistance(deltaX) {
    let i = this.state.draggableIndex - 1;
    let currentLetterIndex = this.props.fontInfo.get('activeLetters').indexOf(this.state.text.substr(i, 1));
    let nextLetterIndex = this.props.fontInfo.get('activeLetters').indexOf(this.state.text.substr(i + 1, 1));
    let oldDistance = this.props.pairEstimates.get(currentLetterIndex, nextLetterIndex);
    this.props.onAddKnownDistance(currentLetterIndex, nextLetterIndex, oldDistance + deltaX, 0);
  },
  render() {
    return (
      <div>
        <div style={{margin: '1em'}}>
          <input onChange={event => this.setState({text: event.target.value})} value={this.state.text}></input>
        </div>

        {this.state.text.split('').slice(0, this.state.draggableIndex).map((l, li) => (
            <canvas key={li}
              width='300' height='200' ref={'glyphCanvas_' + li} onMouseEnter={() => this.setState({draggableIndex: li})}></canvas>
        ))}
        <Draggable resetOnStop={true} axis="x" onStop={(event, ui) => {this.addKnownDistance(ui.position.left);}}>
          <div style={{display: 'inline-block', cursor: 'e-resize'}} ref="draggable">
        {this.state.text.split('').slice(this.state.draggableIndex).map((l, li) => (
            <canvas key={li + this.props.draggableIndex} onMouseEnter={() => this.setState({draggableIndex: (+li + (+this.state.draggableIndex))})}
              width='300' height='200' ref={'glyphCanvas_' + ((+li) + (+this.state.draggableIndex))}></canvas>
          ))}
          </div>
        </Draggable>
      </div>
    );
  }
              //style={this.state.hasOwnProperty(li) ? {marginLeft: this.state[li] || 0} : null}
});
