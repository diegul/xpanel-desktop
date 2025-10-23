const { app, BrowserWindow, session, shell, dialog } = require('electron');
const Store = require('electron-store');

const XPANEL_URL = 'https://xpanel.finalmouse.com';

const store = new Store();

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

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
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: `${__dirname}/preload.js`,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    }
  });

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

  win.loadURL(XPANEL_URL);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const wins = BrowserWindow.getAllWindows();
    if (wins[0]) { wins[0].show(); wins[0].focus(); }
  });
  app.whenReady().then(createWindow);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
