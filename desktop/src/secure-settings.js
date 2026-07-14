'use strict';

const path = require('node:path');

const EMPTY_CREDENTIALS = Object.freeze({ apiKey: '', providerApiKeys: {} });

function normalizeCredentials(value = {}) {
  const providerApiKeys = {};
  for (const [provider, apiKey] of Object.entries(value.providerApiKeys || {})) {
    if (/^[a-z0-9_-]{1,40}$/i.test(provider) && typeof apiKey === 'string' && apiKey.length <= 2000 && apiKey.trim()) {
      providerApiKeys[provider] = apiKey;
    }
  }

  return {
    apiKey: typeof value.apiKey === 'string' && value.apiKey.length <= 2000 ? value.apiKey : '',
    providerApiKeys
  };
}

function createCredentialStore({ fs, safeStorage, filePath }) {
  function ensureEncryption() {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure credential storage is unavailable on this device.');
    }
  }

  return {
    load() {
      if (!fs.existsSync(filePath)) return { ...EMPTY_CREDENTIALS, providerApiKeys: {} };
      ensureEncryption();

      try {
        const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const encrypted = Buffer.from(String(payload.credentials || ''), 'base64');
        return normalizeCredentials(JSON.parse(safeStorage.decryptString(encrypted)));
      } catch {
        return { ...EMPTY_CREDENTIALS, providerApiKeys: {} };
      }
    },

    save(credentials) {
      ensureEncryption();
      const normalized = normalizeCredentials(credentials);
      const encrypted = safeStorage.encryptString(JSON.stringify(normalized)).toString('base64');
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify({ version: 1, credentials: encrypted }), { encoding: 'utf8', mode: 0o600 });
    }
  };
}

module.exports = { createCredentialStore, normalizeCredentials };
