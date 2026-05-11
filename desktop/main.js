const { app, BrowserWindow, Tray, Menu, screen } = require('electron');
const path = require('path');

let mainWindow;
let tray = null;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  mainWindow = new BrowserWindow({
    width: 320,
    height: 480,
    x: width - 340, // Position at bottom right
    y: height - 500,
    show: false, // Don't show until ready
    frame: false, // Frameless window
    resizable: false,
    alwaysOnTop: true, // ALWAYS ON TOP
    skipTaskbar: true, // Don't show in taskbar, only tray
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  // Hide the window when it loses focus (optional, but usually good for tray apps)
  // For a queue caller, they might want it to stay on top even when not focused.
  // mainWindow.on('blur', () => {
  //   if (!mainWindow.webContents.isDevToolsOpened()) {
  //     mainWindow.hide();
  //   }
  // });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

function createTray() {
  // We use a simple placeholder icon for now.
  // In production, you'd replace this with a real .ico file.
  tray = new Tray(path.join(__dirname, 'icon.png')); // We will need to create this dummy icon
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Tampilkan Orbita Caller', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Keluar', click: () => {
      app.isQuiting = true;
      app.quit();
    }}
  ]);

  tray.setToolTip('Orbita Queue Caller');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });
}

// Force single instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
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

// Don't quit when all windows are closed, because it's a tray app
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    // Just hide, don't quit
    // app.quit();
  }
});
