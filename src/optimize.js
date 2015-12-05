function mps(state, action) {
  let glyphCount = state.getIn(['font', 'info', 'activeLetters']).length;

  let columns = [];
  let rows = [];
  let rhs = [];
  let bounds = [];

  rows.push(" N objective");
  for (let l = 0; l < glyphCount; l++) {
    for (let r = 0; r < glyphCount; r++) {
      rows.push(" E " + r + "_" + l);
      rows.push(" G " + r + "_" + l + "a");
      rows.push(" G " + r + "_" + l + "b");
      columns.push(" r" + r + " " + r + "_" + l + " 1");
      columns.push(" l" + l + " " + r + "_" + l + " 1");
      columns.push(" k" + r + "_" + l + " " + r + "_" + l + " 1 " + r + "_" + l + "a -1");
      columns.push(" k" + r + "_" + l + " " + r + "_" + l + "b 1");
      columns.push(" k" + r + "_" + l + "a " + r + "_" + l + "a 1 " + r + "_" + l + "b 1");
      rhs.push(" RHS1 " + r + "_" + l + " " + state.get('pairEstimates').get(r, l));
      rhs.push(" RHS1 " + r + "_" + l + "a 0");
      rhs.push(" RHS1 " + r + "_" + l + "b 0");
      bounds.push(" UP BND1 k" + r + "_" + l + " 100");
      bounds.push(" LO BND1 k" + r + "_" + l + " -50");
      // add all absolutes to the objective
      columns.push(" k" + r + "_" + l + "a objective 1");
    }
    bounds.push(" UP BND1 r" + l + " 40");
    bounds.push(" LO BND1 l" + l + " -10");
  }
  // now sort the columns
  columns.sort();
  bounds.sort();
  return 'NAME FITTINGROOM\nROWS\n' + rows.join('\n') + '\nCOLUMNS\n' + columns.join('\n') + '\nRHS\n' + rhs.join('\n') + '\nBOUNDS\n' + bounds.join('\n') + "\nENDATA";
}

export default function(state, action) {
  let mpsoutput = mps(state, action);
  output = "";
  FS.createDataFile("/tmp", "test.file", mpsoutput, true, true);
  //Module.callMain();
  Module.ccall('main', 'number', ['number', 'number'], [1, 0]);
  FS.unlink("/tmp/test.file");

  // now just parse the output file

  // first get rid of all the stats/logs garbage
  output = output.split('\n');
  let glyphs = state.getIn(['font', 'info', 'activeLetters']);
  let kernings = [];
  let rightBearings = [], leftBearings = [];
  for (var i = 0, l = output.length; i < l; i++) {
    let m = output[i].match(/\d+\s+(.*)\s+(-?\d+.?\d*)\s+\d$/);
    if (m) {
      let varName = m[1].trim();
      let value = m[2].trim();
      if (varName.substr(0, 1) === "k") { // kerning value
        if (varName.slice(-1) !== "a") {
          let indices = varName.slice(1).split('_');
          kernings.push([glyphs[indices[0]], glyphs[indices[1]], value]);
        }
      } else if (varName.substr(0, 1) === "r") {
        rightBearings[varName.slice(1)] = value;
      }  else if (varName.substr(0, 1) === "l") {
        leftBearings[varName.slice(1)] = value;
      }
    }
  }

  return state.set('results', {
    leftBearings,
    rightBearings,
    kernings
  });
}
