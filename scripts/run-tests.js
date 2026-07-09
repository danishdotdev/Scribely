'use strict';

/**
 * Tiny zero-dependency test runner: finds every `*.test.js` under the repo and
 * runs each in its own Node process (isolation, like check-syntax.js). A test
 * file passes by exiting 0; it fails by throwing (non-zero exit). No framework,
 * no dev dependencies — contributors can add a test by dropping in a file that
 * uses `assert`.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function listTestFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTestFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.test.js')) out.push(full);
  }
  return out;
}

const root = path.resolve(__dirname, '..');
const files = listTestFiles(root);
let failed = 0;

for (const file of files) {
  const rel = path.relative(root, file);
  const result = spawnSync(process.execPath, [file], { encoding: 'utf8' });
  if (result.status === 0) {
    process.stdout.write(`  ok  ${rel}\n`);
    if (result.stdout) process.stdout.write(result.stdout.replace(/^/gm, '        '));
  } else {
    failed += 1;
    process.stdout.write(`FAIL  ${rel}\n`);
    process.stderr.write((result.stderr || result.stdout || '') + '\n');
  }
}

if (files.length === 0) {
  console.log('No test files found.');
} else if (failed) {
  console.error(`\n${failed}/${files.length} test file(s) failed.`);
  process.exit(1);
} else {
  console.log(`\nAll ${files.length} test file(s) passed.`);
}
