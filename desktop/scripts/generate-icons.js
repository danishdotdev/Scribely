'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');
const { buildIco, buildIcns } = require('../src/icon-assets');

const desktopRoot = path.resolve(__dirname, '..');
const assetRoot = path.join(desktopRoot, 'assets');
const pngRoot = path.join(assetRoot, 'icons');
const svgPath = path.join(assetRoot, 'scribely-icon.svg');
const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

async function renderMasterIcon() {
  const svg = fs.readFileSync(svgPath, 'utf8');
  const window = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    frame: false,
    useContentSize: true,
    backgroundColor: '#669efd',
    webPreferences: { offscreen: true }
  });

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden}svg{display:block;width:1024px;height:1024px}</style></head><body>${svg}</body></html>`;
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  const image = await window.webContents.capturePage();
  window.destroy();
  if (image.isEmpty()) throw new Error('Rendered Scribely icon is empty.');
  return image;
}

async function generate() {
  fs.mkdirSync(pngRoot, { recursive: true });
  const master = await renderMasterIcon();
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
