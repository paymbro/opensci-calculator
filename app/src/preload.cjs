// Narrow bridge between the calculator page and the window (scaling / closing only).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shell', {
  scale: (height, anchor) => ipcRenderer.send('win:scale', { height, anchor }),
  height: () => ipcRenderer.invoke('win:height'),
  close: () => ipcRenderer.send('win:close'),
  minimize: () => ipcRenderer.send('win:minimize'),
  testMode: () => ipcRenderer.invoke('app:testMode'),
  capture: (file) => ipcRenderer.invoke('app:capture', file),
  quit: () => ipcRenderer.send('app:quit'),
  openShortcuts: () => ipcRenderer.send('app:shortcuts'),
  captureShortcuts: (file, js) => ipcRenderer.invoke('app:captureShortcuts', file, js),
});
