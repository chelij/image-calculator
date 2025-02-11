const { app, BrowserWindow, clipboard } = require('electron')
const path = require('path')
const fs = require('fs')

// Add this line to hide the console in production
if (require('electron').app.isPackaged) {
  process.env.NODE_ENV = 'production';
}

// Get the correct path for tessdata in both development and production
const getTessdataPath = () => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'tessdata');
  }
  return path.join(__dirname, '..', 'assets', 'tessdata');
};

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,  // Increased width
    height: 800, // Increased height
    minWidth: 800, // Add minimum width
    minHeight: 700, // Add minimum height
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: true,
      sandbox: false,
      allowRunningInsecureContent: false,
      additionalArguments: [`--tessdata-path=${getTessdataPath()}`]
    },
    // Add these window configurations
    show: false, // Don't show until ready
    backgroundColor: '#1a1a1a' // Match your dark theme background
  })

  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  
  // Only open DevTools in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools()
  }

  // Show window when ready to prevent flashing
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Enhanced error logging
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', {
      errorCode,
      errorDescription,
      event
    });
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Renderer process gone:', {
      event,
      details,
      reason: details.reason,
      exitCode: details.exitCode
    });
  });

  // Console logging from renderer
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log('Renderer Console:', {
      level,
      message,
      line,
      sourceId
    });
  });
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
}) 