'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app, nativeImage } = require('electron');
const { buildIco, buildIcns } = require('../src/icon-assets');

const desktopRoot = path.resolve(__dirname, '..');
const assetRoot = path.join(desktopRoot, 'assets');
const pngRoot = path.join(assetRoot, 'icons');
const sourcePath = path.join(assetRoot, 'scribely-icon-source.png');
const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

async function generate() {
  fs.mkdirSync(pngRoot, { recursive: true });
  const master = nativeImage.createFromPath(sourcePath);
  if (master.isEmpty()) throw new Error('Approved Scribely icon source is empty.');
  const pngBySize = new Map();

  for (const size of sizes) {
    const png = master.resize({ width: size, height: size, quality: 'best' }).toPNG();
    if (!png.length) throw new Error(`Generated ${size}px icon is empty.`);
    pngBySize.set(size, png);
    fs.writeFileSync(path.join(pngRoot, `icon-${size}.png`), png);
  }

  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  fs.writeFileSync(path.join(assetRoot, 'icon.ico'), buildIco(
    icoSizes.map(size => ({ size, png: pngBySize.get(size) }))
  ));

  const icnsTypes = new Map([
    [16, 'icp4'],
    [32, 'icp5'],
    [64, 'icp6'],
    [128, 'ic07'],
    [256, 'ic08'],
    [512, 'ic09'],
    [1024, 'ic10']
  ]);
  fs.writeFileSync(path.join(assetRoot, 'icon.icns'), buildIcns(
    [...icnsTypes].map(([size, type]) => ({ type, png: pngBySize.get(size) }))
  ));
}

app.whenReady()
  .then(generate)
  .then(() => app.quit())
  .catch(error => {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  });
