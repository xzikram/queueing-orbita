const { app, BrowserWindow, Tray, Menu, screen, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let tray = null;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  const exeName = path.basename(process.execPath, '.exe').toLowerCase();
  let appRole = 'ALL';
  if (exeName.includes('admisi') || exeName.includes('kasir')) {
    appRole = 'ADMISI_KASIR';
  } else if (exeName.includes('pengkajian') || exeName.includes('cdc') || exeName.includes('dokter')) {
    appRole = 'PENGKAJIAN_CDC_DOKTER';
  } else if (exeName.includes('bdr')) {
    appRole = 'BDR';
  }

  mainWindow = new BrowserWindow({
    width: 320,
    height: 480,
    x: Math.max(10, width - 340), // Bottom right position
    y: Math.max(10, height - 500),
    show: false,
    frame: false, // Frameless window
    resizable: true,
    alwaysOnTop: true, // Always on top for caller widget
    skipTaskbar: false, // Show in taskbar and tray
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  mainWindow.loadFile('index.html', { query: { role: appRole } });

  // Open DevTools keyboard shortcut (F12 or Ctrl+Shift+I)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  });

  ipcMain.handle('get-app-version', () => {
    return '1.0.0';
  });

  ipcMain.on('relaunch-app', () => {
    app.relaunch();
    app.exit(0);
  });

  // Handle minimize to tray
  mainWindow.on('minimize', (event) => {
    // Keep window alive in background
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  try {
    tray = new Tray(iconPath);
  } catch (err) {
    // Fallback if icon fails
    tray = new Tray(path.join(__dirname, 'icon.png'));
  }
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Tampilkan Orbita Caller', 
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      } 
    },
    {
      label: '🔍 Inspect / DevTools (F12)',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
      }
    },
    { 
      label: 'Always On Top', 
      type: 'checkbox', 
      checked: true,
      click: (item) => {
        if (mainWindow) {
          mainWindow.setAlwaysOnTop(item.checked, 'screen-saver');
        }
      }
    },
    { type: 'separator' },
    { 
      label: 'Keluar', 
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Orbita Queue Caller (Admisi & Kasir)');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

// IPC Handlers for Auto Pop-Up & Window Control
ipcMain.on('show-window', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.focus();
  }
});

ipcMain.on('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on('close-window', () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

ipcMain.on('toggle-always-on-top', (event, flag) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(flag, 'screen-saver');
  }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    // Keep app running in tray
  }
});
