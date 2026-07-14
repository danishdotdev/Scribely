'use strict';

const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
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

const approvedSource = fs.readFileSync(path.resolve(__dirname, '..', 'assets', 'scribely-icon-source.png'));
assert.strictEqual(
  crypto.createHash('sha256').update(approvedSource).digest('hex'),
  'fb13ecfa06f58d34f09d6eda1c1de71be7a514a967a9c1e3e8624f642c46a098'
);

console.log('platform icon containers: ok');
