
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('xpanelDesktop', {
  version: '1.0.0',
  
  navigateToDeviceSelection: () => {
    window.location.href = 'https://xpanel.finalmouse.com';
  },
  
  disconnectDevice: () => {
    window.location.reload();
  },

  onMenuAction: (callback) => {
    ipcRenderer.on('navigate-to-device-selection', callback);
    ipcRenderer.on('disconnect-device', callback);
  },
  
  removeMenuListeners: () => {
    ipcRenderer.removeAllListeners('navigate-to-device-selection');
    ipcRenderer.removeAllListeners('disconnect-device');
  }
});
