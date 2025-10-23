const { app, BrowserWindow, session, shell, dialog, Menu } = require('electron');
const Store = require('electron-store');

const XPANEL_URL = 'https://xpanel.finalmouse.com';

const store = new Store();

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow = null;

{/* App Menu */}
function createMenu() {
  const template = [
    {
      label: 'Device',
      submenu: [
        {
          label: 'Select New Device',
          accelerator: process.platform === 'darwin' ? 'Cmd+Shift+D' : 'Ctrl+Shift+D',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('navigate-to-device-selection');
            }
          }
        },
        {
          label: 'Disconnect Current Device',
          accelerator: process.platform === 'darwin' ? 'Cmd+Shift+X' : 'Ctrl+Shift+X',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('disconnect-device');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Back to Start',
          accelerator: process.platform === 'darwin' ? 'Cmd+Shift+H' : 'Ctrl+Shift+H',
          click: () => {
            if (mainWindow) {
              mainWindow.loadURL(XPANEL_URL);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Refresh Page',
          accelerator: 'F5',
          click: () => {
            if (mainWindow) {
              mainWindow.reload();
            }
          }
        },
        {
          label: 'Reload Application',
          accelerator: process.platform === 'darwin' ? 'Cmd+R' : 'Ctrl+R',
          click: () => {
            if (mainWindow) {
              mainWindow.loadURL(XPANEL_URL);
            }
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Full Screen',
          accelerator: process.platform === 'darwin' ? 'Cmd+Ctrl+F' : 'F11',
          click: () => {
            if (mainWindow) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          }
        },
        {
          label: 'Zoom In',
          accelerator: process.platform === 'darwin' ? 'Cmd+Plus' : 'Ctrl+Plus',
          click: () => {
            if (mainWindow) {
              const currentZoom = mainWindow.webContents.getZoomFactor();
              mainWindow.webContents.setZoomFactor(currentZoom + 0.1);
            }
          }
        },
        {
          label: 'Zoom Out',
          accelerator: process.platform === 'darwin' ? 'Cmd+-' : 'Ctrl+-',
          click: () => {
            if (mainWindow) {
              const currentZoom = mainWindow.webContents.getZoomFactor();
              mainWindow.webContents.setZoomFactor(Math.max(0.5, currentZoom - 0.1));
            }
          }
        },
        {
          label: 'Reset Zoom',
          accelerator: process.platform === 'darwin' ? 'Cmd+0' : 'Ctrl+0',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.setZoomFactor(1.0);
            }
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About XPANEL Desktop',
          click: () => {
            shell.openExternal('https://github.com/diegul/xpanel-desktop');
          }
        },
        {
          label: 'Reset to Device Selection',
          accelerator: process.platform === 'darwin' ? 'Cmd+Shift+R' : 'Ctrl+Shift+R',
          click: () => {
            if (mainWindow) {
              mainWindow.loadURL(XPANEL_URL);
            }
          }
        }
      ]
    }
  ];

  if (isDev) {
    template.push({
      label: 'Developer',
      submenu: [
        {
          label: 'Toggle DevTools',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) {
              mainWindow.reload();
            }
          }
        }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function updateMenuForContext(win) {
  if (!win) return;
  
  const currentUrl = win.webContents.getURL();
  const isDeviceSelection = currentUrl === 'https://xpanel.finalmouse.com/' || 
                           currentUrl.includes('device') || 
                           currentUrl.includes('select');
  
  const menu = Menu.getApplicationMenu();
  if (menu) {
    const deviceMenu = menu.items.find(item => item.label === 'Device');
    if (deviceMenu && deviceMenu.submenu) {
      const selectDeviceItem = deviceMenu.submenu.items.find(item => item.label === 'Select New Device');
      const disconnectItem = deviceMenu.submenu.items.find(item => item.label === 'Disconnect Current Device');
      const backToStartItem = deviceMenu.submenu.items.find(item => item.label === 'Back to Start');
      
      if (selectDeviceItem) {
        selectDeviceItem.enabled = !isDeviceSelection;
      }
      if (disconnectItem) {
        disconnectItem.enabled = !isDeviceSelection;
      }
      if (backToStartItem) {
        backToStartItem.enabled = true; // Always available
      }
    }
  }
}

function createWindow() {
  const defaultBounds = { width: 1200, height: 800, x: undefined, y: undefined };
  const savedBounds = store.get('windowBounds', defaultBounds);
  
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  
  const bounds = {
    width: Math.min(savedBounds.width || 1200, screenWidth),
    height: Math.min(savedBounds.height || 800, screenHeight),
    x: savedBounds.x !== undefined ? Math.max(0, Math.min(savedBounds.x, screenWidth - (savedBounds.width || 1200))) : undefined,
    y: savedBounds.y !== undefined ? Math.max(0, Math.min(savedBounds.y, screenHeight - (savedBounds.height || 800))) : undefined
  };
  const win = new BrowserWindow({
    ...bounds,
    minWidth: 900,
    minHeight: 600,
    title: 'XPANEL Desktop',
    backgroundColor: '#111111',
    autoHideMenuBar: false,
    show: false,
    webPreferences: {
      preload: `${__dirname}/preload.js`,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    }
  });

  mainWindow = win;

  session.defaultSession.setPermissionRequestHandler((wc, permission, cb, details) => {
    if (permission === 'hid' && details.requestingUrl.startsWith('https://xpanel.finalmouse.com')) {
      cb(true);
    } else {
      cb(false);
    }
  });

  session.defaultSession.setDevicePermissionHandler((_details) => {
    return true;
  });

  win.webContents.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36'
  );

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith('https://xpanel.finalmouse.com')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  win.on('resize', () => {
    const bounds = win.getBounds();
    store.set('windowBounds', bounds);
  });

  win.on('move', () => {
    const bounds = win.getBounds();
    store.set('windowBounds', bounds);
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  if (isDev) {
    win.webContents.openDevTools();
  }

  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      if (isDev) {
        win.webContents.toggleDevTools();
      }
    }
  });

  {/* Error Handling */}
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', errorCode, errorDescription, validatedURL);
    dialog.showErrorBox(
      'Connection Error',
      `Failed to load XPANEL. Please check your internet connection and try again.\n\nError: ${errorDescription}`
    );
  });

  win.webContents.on('unresponsive', () => {
    console.warn('Page became unresponsive');
    dialog.showMessageBox(win, {
      type: 'warning',
      title: 'Application Unresponsive',
      message: 'The application has become unresponsive. You may need to reload the page.',
      buttons: ['Reload', 'Close'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 0) {
        win.reload();
      }
    });
  });

  win.webContents.on('crashed', () => {
    console.error('Renderer process crashed');
    dialog.showErrorBox(
      'Application Crashed',
      'The application has crashed. It will be reloaded automatically.'
    );
    win.reload();
  });

  win.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== 'https://xpanel.finalmouse.com') {
      console.log('Blocked navigation to:', navigationUrl);
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });

  win.webContents.on('did-finish-load', () => {
    updateMenuForContext(win);
  });

  win.webContents.on('page-title-updated', (event, title) => {
    updateMenuForContext(win);
  });

  win.loadURL(XPANEL_URL);
}

app.whenReady().then(() => {
  createMenu();
  createWindow();
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const wins = BrowserWindow.getAllWindows();
    if (wins[0]) { wins[0].show(); wins[0].focus(); }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
