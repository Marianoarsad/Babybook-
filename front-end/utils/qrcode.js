"use strict";
/*
 * Dependency-free QR Code generator (byte mode).
 * Algorithm adapted from Project Nayuki's QR Code generator (MIT License).
 * Returns a 2D array of booleans (true = dark module).
 *
 * Vendored locally so BabyBook+ can render real, scannable QR codes for the
 * parent-controlled consultation-access feature without any native module.
 */

var ECC_CODEWORDS_PER_BLOCK = [
  [-1,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
  [-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  [-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30]
];
var NUM_ERROR_CORRECTION_BLOCKS = [
  [-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
  [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
  [-1,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
  [-1,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81]
];
// ECC index: 0=L, 1=M, 2=Q, 3=H ; format-info bits per level:
var ECL_FORMAT_BITS = { 0: 1, 1: 0, 2: 3, 3: 2 };

function gfMul(a, b) {
  var p = 0;
  for (var i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    var hi = a & 0x80;
    a = (a << 1) & 0xFF;
    if (hi) a ^= 0x1D;
    b >>= 1;
  }
  return p & 0xFF;
}

function rsDivisor(degree) {
  var result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  var root = 1;
  for (var i = 0; i < degree; i++) {
    for (var j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 2);
  }
  return result;
}

function rsRemainder(data, divisor) {
  var result = new Array(divisor.length).fill(0);
  for (var k = 0; k < data.length; k++) {
    var factor = data[k] ^ result[0];
    for (var j = 0; j < result.length - 1; j++) result[j] = result[j + 1];
    result[result.length - 1] = 0;
    for (var j2 = 0; j2 < result.length; j2++) result[j2] ^= gfMul(divisor[j2], factor);
  }
  return result;
}

function getNumRawDataModules(ver) {
  var result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    var numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function getNumDataCodewords(ver, ecl) {
  return Math.floor(getNumRawDataModules(ver) / 8)
    - ECC_CODEWORDS_PER_BLOCK[ecl][ver] * NUM_ERROR_CORRECTION_BLOCKS[ecl][ver];
}

function utf8Bytes(str) {
  var out = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F));
    else if (c >= 0xD800 && c < 0xDC00 && i + 1 < str.length) {
      var c2 = str.charCodeAt(++i);
      var cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
      out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
    } else out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
  }
  return out;
}

function getBit(x, i) { return ((x >>> i) & 1) !== 0; }

function alignmentPatternPositions(ver, size) {
  if (ver === 1) return [];
  var numAlign = Math.floor(ver / 7) + 2;
  var step = (ver === 32) ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  var result = [6];
  for (var pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

function generateMatrix(text, eclName) {
  var ecl = { L: 0, M: 1, Q: 2, H: 3 }[eclName || "M"];
  if (ecl === undefined) ecl = 1;
  var bytes = utf8Bytes(text);

  // pick smallest version that fits
  var ver;
  for (ver = 1; ver <= 40; ver++) {
    var cap = getNumDataCodewords(ver, ecl) * 8;
    var ccBits = (ver <= 9) ? 8 : 16;
    var used = 4 + ccBits + bytes.length * 8;
    if (used <= cap) break;
  }
  if (ver > 40) throw new Error("QR: data too long");

  // build bit buffer
  var bb = [];
  function appendBits(val, len) { for (var i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1); }
  appendBits(0x4, 4); // byte mode
  appendBits(bytes.length, (ver <= 9) ? 8 : 16);
  for (var i = 0; i < bytes.length; i++) appendBits(bytes[i], 8);

  var capacityBits = getNumDataCodewords(ver, ecl) * 8;
  appendBits(0, Math.min(4, capacityBits - bb.length));
  appendBits(0, (8 - bb.length % 8) % 8);
  for (var pad = 0xEC; bb.length < capacityBits; pad ^= 0xEC ^ 0x11) appendBits(pad, 8);

  var dataCodewords = new Array(bb.length / 8).fill(0);
  for (var b = 0; b < bb.length; b++) dataCodewords[b >>> 3] |= bb[b] << (7 - (b & 7));

  // ECC + interleave
  var allCodewords = addEccAndInterleave(dataCodewords, ver, ecl);

  // draw
  var size = ver * 4 + 17;
  var modules = [], isFn = [];
  for (var y = 0; y < size; y++) { modules.push(new Array(size).fill(false)); isFn.push(new Array(size).fill(false)); }
  function setFn(x, yy, dark) { if (x < 0 || x >= size || yy < 0 || yy >= size) return; modules[yy][x] = dark; isFn[yy][x] = true; }

  // timing patterns
  for (var i2 = 0; i2 < size; i2++) { setFn(6, i2, i2 % 2 === 0); setFn(i2, 6, i2 % 2 === 0); }
  // finder patterns + separators
  function drawFinder(cx, cy) {
    for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
      var dist = Math.max(Math.abs(dx), Math.abs(dy));
      setFn(cx + dx, cy + dy, dist !== 2 && dist !== 4);
    }
  }
  drawFinder(3, 3); drawFinder(size - 4, 3); drawFinder(3, size - 4);
  // alignment patterns
  var ap = alignmentPatternPositions(ver, size); var na = ap.length;
  function drawAlign(cx, cy) {
    for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++)
      setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  for (var ai = 0; ai < na; ai++) for (var aj = 0; aj < na; aj++) {
    if ((ai === 0 && aj === 0) || (ai === 0 && aj === na - 1) || (ai === na - 1 && aj === 0)) continue;
    drawAlign(ap[ai], ap[aj]);
  }

  function drawFormatBits(mask) {
    var data = (ECL_FORMAT_BITS[ecl] << 3) | mask;
    var rem = data;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var bits = ((data << 10) | rem) ^ 0x5412;
    for (var k = 0; k <= 5; k++) setFn(8, k, getBit(bits, k));
    setFn(8, 7, getBit(bits, 6)); setFn(8, 8, getBit(bits, 7)); setFn(7, 8, getBit(bits, 8));
    for (var k2 = 9; k2 < 15; k2++) setFn(14 - k2, 8, getBit(bits, k2));
    for (var k3 = 0; k3 < 8; k3++) setFn(size - 1 - k3, 8, getBit(bits, k3));
    for (var k4 = 8; k4 < 15; k4++) setFn(8, size - 15 + k4, getBit(bits, k4));
    setFn(8, size - 8, true);
  }
  function drawVersion() {
    if (ver < 7) return;
    var rem = ver;
    for (var i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    var bits = (ver << 12) | rem;
    for (var k = 0; k < 18; k++) {
      var bit = getBit(bits, k);
      var a = size - 11 + k % 3, bb2 = Math.floor(k / 3);
      setFn(a, bb2, bit); setFn(bb2, a, bit);
    }
  }
  drawFormatBits(0); // reserve format area
  drawVersion();

  // place codewords (zigzag)
  var idx = 0;
  for (var right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (var vert = 0; vert < size; vert++) {
      for (var jj = 0; jj < 2; jj++) {
        var x = right - jj;
        var upward = ((right + 1) & 2) === 0;
        var yy = upward ? size - 1 - vert : vert;
        if (!isFn[yy][x] && idx < allCodewords.length * 8) {
          modules[yy][x] = getBit(allCodewords[idx >>> 3], 7 - (idx & 7));
          idx++;
        }
      }
    }
  }

  function maskCond(mask, x, y) {
    switch (mask) {
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      case 5: return (x * y) % 2 + (x * y) % 3 === 0;
      case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
      case 7: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
    }
    return false;
  }
  function applyMask(mask) {
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++)
      if (!isFn[y][x] && maskCond(mask, x, y)) modules[y][x] = !modules[y][x];
  }
  function penalty() {
    var score = 0;
    // rule 1: runs of >=5 in rows and columns
    for (var y = 0; y < size; y++) {
      var rc = modules[y][0], run = 1;
      for (var x = 1; x < size; x++) {
        if (modules[y][x] === rc) { run++; if (run === 5) score += 3; else if (run > 5) score += 1; }
        else { rc = modules[y][x]; run = 1; }
      }
    }
    for (var x2 = 0; x2 < size; x2++) {
      var rc2 = modules[0][x2], run2 = 1;
      for (var y2 = 1; y2 < size; y2++) {
        if (modules[y2][x2] === rc2) { run2++; if (run2 === 5) score += 3; else if (run2 > 5) score += 1; }
        else { rc2 = modules[y2][x2]; run2 = 1; }
      }
    }
    // rule 2: 2x2 blocks
    for (var y3 = 0; y3 < size - 1; y3++) for (var x3 = 0; x3 < size - 1; x3++) {
      var c = modules[y3][x3];
      if (c === modules[y3][x3 + 1] && c === modules[y3 + 1][x3] && c === modules[y3 + 1][x3 + 1]) score += 3;
    }
    // rule 4: dark/light balance
    var dark = 0;
    for (var y4 = 0; y4 < size; y4++) for (var x4 = 0; x4 < size; x4++) if (modules[y4][x4]) dark++;
    var total = size * size;
    var k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    score += k * 10;
    return score;
  }

  var bestMask = 0, minPenalty = Infinity, best = null;
  for (var m = 0; m < 8; m++) {
    applyMask(m); drawFormatBits(m);
    var p = penalty();
    if (p < minPenalty) { minPenalty = p; bestMask = m; best = modules.map(function (r) { return r.slice(); }); }
    applyMask(m); // undo
  }
  // redraw final with best mask
  applyMask(bestMask); drawFormatBits(bestMask);
  return modules;
}

function addEccAndInterleave(data, ver, ecl) {
  var numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl][ver];
  var blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl][ver];
  var rawCodewords = Math.floor(getNumRawDataModules(ver) / 8);
  var numShortBlocks = numBlocks - rawCodewords % numBlocks;
  var shortBlockLen = Math.floor(rawCodewords / numBlocks);
  var shortBlockDataLen = shortBlockLen - blockEccLen;

  var blocks = [];
  var divisor = rsDivisor(blockEccLen);
  var k = 0;
  for (var i = 0; i < numBlocks; i++) {
    var datLen = shortBlockDataLen + (i < numShortBlocks ? 0 : 1);
    var dat = data.slice(k, k + datLen); k += datLen;
    var ecc = rsRemainder(dat, divisor);
    var blk = dat.slice();
    if (i < numShortBlocks) blk.push(0); // padding placeholder
    blk = blk.concat(ecc);
    blocks.push(blk);
  }

  var result = [];
  var blockLen = blocks[0].length;
  for (var col = 0; col < blockLen; col++) {
    for (var bi = 0; bi < numBlocks; bi++) {
      // skip padding column in short blocks
      if (col === shortBlockDataLen && bi < numShortBlocks) continue;
      result.push(blocks[bi][col]);
    }
  }
  return result;
}

module.exports = { generateMatrix: generateMatrix };
