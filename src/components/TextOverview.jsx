import React from 'react';
import cwise from 'cwise';
import Draggable from 'react-draggable';

export default React.createClass({
  getInitialState() {
    return {
      text: this.props.text || "hamburgismyfavouritecityinthewholeworld"
    };
  },
  drawLetters() {
    for (let i = 0, l = this.state.text.length; i < l; i++) {
      let currentLetterIndex = this.props.fontInfo.get('activeLetters').indexOf(this.state.text.substr(i, 1));
      if (currentLetterIndex === -1) continue;
      let currentLetter = this.refs['glyphSpan_' + i];
      currentLetter.style.marginLeft = '-' + this.props.bearings[currentLetterIndex][0] * (40/150) + 'px';
      currentLetter.style.marginRight = '-' + this.props.bearings[currentLetterIndex][1] * (40/150) + 'px';

      if (i === l - 1) break;
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
      <div style={{textAlign: 'center'}}>
        {this.state.text.split('').map((l, li) => (
            <span key={li} ref={'glyphSpan_' + li} style={{fontFamily: this.props.fontInfo.name, fontSize: '40px'}}>{l}</span>
        ))}
        <div style={{margin: '1em'}}>
          <input onChange={event => this.setState({text: event.target.value})} value={this.state.text}></input>
        </div>
      </div>
    );
  }
              //style={this.state.hasOwnProperty(li) ? {marginLeft: this.state[li] || 0} : null}
});
