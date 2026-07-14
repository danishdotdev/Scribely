const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('meetingBotDesktop', {
  platform: () => ipcRenderer.invoke('app:platform'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  loadCredentials: () => ipcRenderer.invoke('credentials:load'),
  saveCredentials: (credentials) => ipcRenderer.invoke('credentials:save', credentials)
});

