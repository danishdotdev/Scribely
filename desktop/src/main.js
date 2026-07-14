const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { app, BrowserWindow, desktopCapturer, ipcMain, safeStorage, session, shell } = require('electron');
const { createCredentialStore } = require('./secure-settings');

const API_PORT = Number(process.env.PORT || 3000);
const API_HEALTH_URL = `http://127.0.0.1:${API_PORT}/health`;
const REPO_ROOT = path.resolve(__dirname, '..', '..');
let apiProcess = null;
let credentialStore = null;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function checkLocalApi(timeoutMs = 800) {
  return new Promise(resolve => {
    const req = http.get(API_HEALTH_URL, { timeout: timeoutMs }, res => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

async function ensureLocalApi() {
  if (await checkLocalApi()) return;

  apiProcess = spawn('node', ['src/index.js'], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PORT: String(API_PORT)
    },
    windowsHide: true,
    stdio: 'ignore'
  });
  apiProcess.unref();

  for (let attempt = 0; attempt < 16; attempt += 1) {
    if (await checkLocalApi(500)) return;
    await wait(250);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 780,
    minHeight: 620,
    title: 'Scribely',
    center: true,
    autoHideMenuBar: true,
    backgroundColor: '#f6f7f9',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function configureCaptureSession() {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(['media', 'display-capture'].includes(permission));
  });

  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } })
      .then((sources) => {
        const source = sources.find(item => item.name === 'Entire Screen') || sources[0];
        callback({ video: source, audio: 'loopback' });
      })
      .catch(() => callback({}));
  }, { useSystemPicker: true });
}

app.whenReady().then(async () => {
  credentialStore = createCredentialStore({
    fs,
    safeStorage,
    filePath: path.join(app.getPath('userData'), 'credentials.json')
  });
  configureCaptureSession();
  await ensureLocalApi();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (apiProcess && !apiProcess.killed) {
    apiProcess.kill();
  }
});

ipcMain.handle('app:platform', () => ({
  platform: process.platform,
  versions: process.versions
}));

ipcMain.handle('credentials:load', () => credentialStore?.load() || { apiKey: '', providerApiKeys: {} });

ipcMain.handle('credentials:save', (_event, credentials) => {
  if (!credentialStore) throw new Error('Secure credential storage is not ready.');
  credentialStore.save(credentials);
  return true;
});

ipcMain.handle('app:openExternal', (_event, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) {
    shell.openExternal(url);
  }
});
