# Scribely App Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Electron's visible branding with the approved blue waveform-S Scribely icon across the running app, packaged desktop metadata, and in-app brand mark.

**Architecture:** Keep one SVG master under `desktop/assets/`, generate all PNG/ICO/ICNS derivatives with a deterministic Electron script, and wire platform-specific assets into Electron startup and package metadata. Preserve the existing Electron user-data path so saved API keys and renderer storage survive the branding change.

**Tech Stack:** Electron 39, Node.js, SVG, Electron `nativeImage`, zero-dependency Node tests

---

## File Structure

- Create `desktop/assets/scribely-icon.svg`: approved waveform-S vector master.
- Create `desktop/assets/icons/*.png`, `desktop/assets/icon.ico`, and `desktop/assets/icon.icns`: generated platform assets.
- Create `desktop/src/icon-assets.js`: pure ICO and ICNS container builders.
- Create `desktop/src/icon-assets.test.js`: validates generated container headers and entries.
- Create `desktop/scripts/generate-icons.js`: renders the SVG through Electron and writes every derivative.
- Modify `desktop/src/main.js`: set Scribely identity and window/dock icons while preserving user data.
- Modify `desktop/src/renderer/index.html`: use the same SVG in the sidebar.
- Modify `desktop/src/renderer/styles.css`: size the SVG brand mark without changing layout.
- Modify `desktop/package.json`: add product/build metadata and icon generation command.

### Task 1: Test platform icon containers

**Files:**
- Create: `desktop/src/icon-assets.test.js`
- Create: `desktop/src/icon-assets.js`

- [ ] **Step 1: Write the failing container test**

```js
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
```

- [ ] **Step 2: Run the test and verify red**

Run: `node desktop/src/icon-assets.test.js`

Expected: FAIL with `Cannot find module './icon-assets'`.

- [ ] **Step 3: Implement the minimal container builders**

```js
'use strict';

function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const directory = Buffer.alloc(images.length * 16);
  let offset = header.length + directory.length;
  images.forEach(({ size, png }, index) => {
    const entry = index * 16;
    directory.writeUInt8(size >= 256 ? 0 : size, entry);
    directory.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    directory.writeUInt8(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(png.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, directory, ...images.map(image => image.png)]);
}

function buildIcns(images) {
  const chunks = images.map(({ type, png }) => {
    const chunk = Buffer.alloc(8 + png.length);
    chunk.write(type, 0, 4, 'ascii');
    chunk.writeUInt32BE(chunk.length, 4);
    png.copy(chunk, 8);
    return chunk;
  });
  const file = Buffer.alloc(8 + chunks.reduce((total, chunk) => total + chunk.length, 0));
  file.write('icns', 0, 4, 'ascii');
  file.writeUInt32BE(file.length, 4);
  let offset = 8;
  for (const chunk of chunks) {
    chunk.copy(file, offset);
    offset += chunk.length;
  }
  return file;
}

module.exports = { buildIco, buildIcns };
```

- [ ] **Step 4: Run the test and verify green**

Run: `node desktop/src/icon-assets.test.js`

Expected: `platform icon containers: ok`.

### Task 2: Add and generate the approved logo assets

**Files:**
- Create: `desktop/assets/scribely-icon.svg`
- Create: `desktop/scripts/generate-icons.js`
- Create: `desktop/assets/icons/icon-{16,24,32,48,64,128,256,512,1024}.png`
- Create: `desktop/assets/icon.ico`
- Create: `desktop/assets/icon.icns`

- [ ] **Step 1: Add the approved vector master**

Create a 1024-by-1024 SVG with a `#1565c0` rounded-square background and white rounded vertical waveform capsules arranged into the approved `S` silhouette. Keep at least 18% safe area around the mark and use no text, shadow, or Electron artwork.

- [ ] **Step 2: Add the deterministic generator**

The Electron script must load `scribely-icon.svg` with `nativeImage`, render PNGs for every declared size, call `buildIco()` with Windows sizes, call `buildIcns()` with modern macOS PNG chunk types, validate every output is non-empty, then quit with a nonzero exit code on failure.

- [ ] **Step 3: Generate assets**

Run: `npm --prefix desktop run generate:icons`

Expected: PNG files plus `desktop/assets/icon.ico` and `desktop/assets/icon.icns` are written successfully.

- [ ] **Step 4: Validate assets**

Run: `Get-ChildItem desktop/assets -Recurse | Select-Object FullName,Length`

Expected: every output exists and has a nonzero length; `icon.ico` begins with ICO type `1`, and `icon.icns` begins with `icns`.

### Task 3: Wire Scribely branding into Electron and the sidebar

**Files:**
- Modify: `desktop/src/main.js`
- Modify: `desktop/src/renderer/index.html`
- Modify: `desktop/src/renderer/styles.css`
- Modify: `desktop/package.json`

- [ ] **Step 1: Preserve user data and set desktop identity**

Before `app.whenReady()`, capture the current `app.getPath('userData')`, call `app.setName('Scribely')`, restore the captured path with `app.setPath('userData', existingUserDataPath)`, and set `app.setAppUserModelId('com.scribely.desktop')` on Windows. This prevents saved provider keys and localStorage from moving to a new directory.

- [ ] **Step 2: Set runtime icons**

Set `BrowserWindow`'s `icon` to `desktop/assets/icons/icon-256.png`. On macOS, call `app.dock.setIcon()` with the 512-pixel PNG after readiness. Keep the current window title and behavior unchanged.

- [ ] **Step 3: Replace the sidebar placeholder**

Replace the CSS bar placeholder inside `.brand-mark` with:

```html
<img src="../../assets/scribely-icon.svg" alt="" />
```

Keep the existing 28-pixel footprint, spacing, and accessible Scribely text label.

- [ ] **Step 4: Add package metadata**

Add `productName: "Scribely"`, `generate:icons`, and Electron Builder-compatible `appId`, Windows icon, and macOS icon paths without changing runtime dependencies or the existing development command.

### Task 4: Verify, commit, and publish

**Files:**
- Verify all changed and generated files

- [ ] **Step 1: Run automated checks**

Run: `npm test`

Expected: all test files pass, including `desktop/src/icon-assets.test.js`.

Run: `node scripts/check-syntax.js`

Expected: `Syntax OK`.

- [ ] **Step 2: Scan for stale visible branding**

Run: `rg -n -i "electron" desktop package.json README.md`

Expected: Electron remains only in technical dependency/documentation contexts; no user-visible title, icon path, or product name uses Electron.

- [ ] **Step 3: Launch and inspect Scribely**

Restart `npm --prefix desktop run dev`. Verify the sidebar, taskbar, Alt+Tab view, and window icon show the approved waveform-S mark. Open the screen picker and verify Scribely windows use the same mark where Windows exposes application icons.

- [ ] **Step 4: Commit only completed application work**

Stage the approved icon assets, generator, tests, runtime wiring, and existing completed Scribely changes that belong to this release. Review the staged diff for API keys, generated captures, or unrelated files before committing.

- [ ] **Step 5: Push the current branch**

Run: `git push origin main`

Expected: GitHub accepts the push and `origin/main` points at the new commit.
