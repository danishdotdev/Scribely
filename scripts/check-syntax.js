const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function listJsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(fullPath);
  }
  return out;
}

const files = listJsFiles(path.resolve(__dirname, '..'));
let failed = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write(result.stderr || result.stdout || `${file} failed syntax check\n`);
  }
}

if (failed) process.exit(1);
console.log(`Syntax OK (${files.length} files)`);

