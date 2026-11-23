const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('native', {
  autoAudio: true,
  quit: () => ipcRenderer.send('lume:quit'),
  toggleFullscreen: () => ipcRenderer.send('lume:fullscreen'),
});
