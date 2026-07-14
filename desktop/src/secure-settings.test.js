'use strict';

const assert = require('node:assert');
const { createCredentialStore } = require('./secure-settings');

const files = new Map();
const fs = {
  mkdirSync() {},
  existsSync(filePath) {
    return files.has(filePath);
  },
  readFileSync(filePath) {
    return files.get(filePath);
  },
  writeFileSync(filePath, value) {
    files.set(filePath, value);
  }
};

const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: value => Buffer.from(`encrypted:${value}`, 'utf8'),
  decryptString: value => value.toString('utf8').replace(/^encrypted:/, '')
};

(function persistsAndRestoresEncryptedCredentials() {
  const filePath = 'C:/fake-user-data/credentials.json';
  const store = createCredentialStore({ fs, safeStorage, filePath });
  const credentials = {
    apiKey: 'local-server-key',
    providerApiKeys: { assemblyai: 'assembly-key', deepgram: 'deepgram-key' }
  };

  store.save(credentials);

  const rawFile = files.get(filePath);
  assert.ok(rawFile);
  assert.ok(!rawFile.includes('assembly-key'));
  assert.deepStrictEqual(store.load(), credentials);
  console.log('encrypted credential persistence: ok');
})();
