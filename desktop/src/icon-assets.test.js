'use strict';

const assert = require('node:assert');
const { buildIco, buildIcns } = require('./icon-assets');

const png16 = Buffer.from('png-16');
const png256 = Buffer.from('png-256');

const ico = buildIco([
  { size: 16, png: png16 },
  { size: 256, png: png256 }
]);
assert.strictEqual(ico.readUInt16LE(0), 0);
assert.strictEqual(ico.readUInt16LE(2), 1);
assert.strictEqual(ico.readUInt16LE(4), 2);
assert.strictEqual(ico.readUInt8(6), 16);
assert.strictEqual(ico.readUInt8(22), 0);

const icns = buildIcns([
  { type: 'icp4', png: png16 },
  { type: 'ic08', png: png256 }
]);
assert.strictEqual(icns.subarray(0, 4).toString('ascii'), 'icns');
assert.strictEqual(icns.readUInt32BE(4), icns.length);
assert.strictEqual(icns.subarray(8, 12).toString('ascii'), 'icp4');

console.log('platform icon containers: ok');
