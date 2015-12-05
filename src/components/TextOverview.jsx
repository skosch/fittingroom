import React from 'react';
import cwise from 'cwise';
import Draggable from 'react-draggable';

export default React.createClass({
  getInitialState() {
    return {
      text: this.props.text || "Five vixens control yummy quarks"
    };
  },
  drawLetters() {
    for (let i = 0, l = this.state.text.length; i < l; i++) {
      let currentLetterIndex = this.props.fontInfo.get('activeLetters').indexOf(this.state.text.substr(i, 1));
      if (currentLetterIndex === -1) continue;
      let currentLetter = this.refs['glyphSpan_' + i];
      currentLetter.style.marginLeft = (-1) * this.props.bearings[currentLetterIndex][0] * (40/150) + 'px';
      currentLetter.style.marginRight = (-1) * this.props.bearings[currentLetterIndex][1] * (40/150) + 'px';

      if (i === l - 1) break; // don't do the following for the last letter:
      let nextLetterIndex = this.props.fontInfo.get('activeLetters').indexOf(this.state.text.substr(i + 1, 1));
      currentLetter.style.marginRight = parseFloat(currentLetter.style.marginRight) + (+this.props.pairEstimates.get(currentLetterIndex, nextLetterIndex)) * (40/150) + "px";
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
    <div>
      <div style={{borderBottom: '1px solid gray',  margin: '1em auto 3em auto', width: '80%'}}>
        <span style={{width: '20%', fontWeight: 'bold', color: '#818181'}}>Sample:&nbsp;</span>
        <input
          onChange={event => this.setState({text: event.target.value.replace(/[^a-zA-Z\s]/g, '')})}
          value={this.state.text}
          style={{border: 'none', width: '80%'}}></input>
      </div>
      <div style={{textAlign: 'center', fontFamily: this.props.fontInfo.get('name')}}>
        {this.state.text.split('').map((l, li) => (
          <span key={li} ref={'glyphSpan_' + li} style={{fontSize: '40px'}}>{l}</span>
        ))}
      </div>
    </div>
    );
  }
              //style={this.state.hasOwnProperty(li) ? {marginLeft: this.state[li] || 0} : null}
});
