
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('xpanelDesktop', {
  version: '1.0.0'
});
