import nd from 'ndarray';
import cwise from 'cwise';
import ndUnpack from 'ndarray-unpack';
import pool from 'ndarray-scratch';

/* returns ndarrays for the fullGlyphs, the leftSides and the rightSides */
export default function(fontInfo) {
  // make a temporary canvas
  let canvas = document.createElement('canvas');
  canvas.width = fontInfo.width;
  canvas.height = fontInfo.height;
  let ctx = canvas.getContext('2d');

  let fullGlyphs = [], leftSides = [], rightSides = [], bearings = [];
  for (let letterIndex = 0; letterIndex < fontInfo.activeLetters.length; letterIndex++) {
    let letter = fontInfo.activeLetters[letterIndex];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
    ctx.font = '150px ' + fontInfo.name;
    ctx.textBaseline = 'hanging';
    ctx.fillText(letter, 0, 0);

    let pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let leftBearing = null;
    let rightBearing = null;
    let x, y;

    for (let i = 0, l = pixels.data.length; i < l; i += 4) {
      if (pixels.data[i+3] !== 0) {
        x = (i / 4) % canvas.width;
        y = ~~((i / 4) / canvas.width);
        if (leftBearing === null) {
          leftBearing = x;
        } else if (x < leftBearing) {
          leftBearing = x;
        }

        if (rightBearing === null) {
          rightBearing = x;
        } else if (rightBearing < x) {
          rightBearing = x;
        }
      }
    }
    let trimWidth = rightBearing - leftBearing;
    let totalWidth = ctx.measureText(letter).width;

    if (letter === " ") {
      fullGlyphs.push(pool.zeros([totalWidth, canvas.height, 4]));
      bearings.push([totalWidth, 0]);
      continue;
    }
    
    bearings.push([leftBearing, totalWidth - rightBearing]);

    // now crop the letters left and right.
    let fullGlyph = nd(ctx.getImageData(leftBearing, 0, trimWidth, canvas.height).data, [trimWidth, canvas.height, 4]);
    fullGlyphs.push(fullGlyph);

    // get the left side of the glyph
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(new ImageData(fullGlyph.data, trimWidth, canvas.height), 0, 0);
    leftSides.push(nd(ctx.getImageData(0, 0, fontInfo.sideWidth, canvas.height).data, [fontInfo.sideWidth, canvas.height, 4]));

    // get the right side of the glyph
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(new ImageData(fullGlyph.data, trimWidth, canvas.height), fontInfo.sideWidth - trimWidth, 0);
    rightSides.push(nd(ctx.getImageData(0, 0, fontInfo.sideWidth, canvas.height).data, [fontInfo.sideWidth, canvas.height, 4]));
  }
  //canvas.parentNode.removeChild(canvas);
  canvas = null;
  return {
    fullGlyphs,
    leftSides,
    rightSides,
    bearings
  };
}
