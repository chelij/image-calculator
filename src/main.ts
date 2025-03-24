import { app, BrowserWindow, ipcMain, protocol } from 'electron';
import * as path from 'path';
import * as tesseract from 'node-tesseract-ocr';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// OCR processing
ipcMain.handle('process-image', async (_event, imageData: string) => {
  try {
    // Convert base64 to buffer
    const buffer = Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    
    // OCR configuration
    const config = {
      lang: 'eng',
      oem: 1,
      psm: 6,
    };

    // Perform OCR directly on the buffer
    const text = await tesseract.recognize(buffer, config);
    
    return { success: true, text };
  } catch (error: unknown) {
    console.error('OCR Error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    };
  }
});

ipcMain.handle('preprocess-image', async (_, imageData: string) => {
  try {
    // Just return the original image data since we're not preprocessing anymore
    return {
      success: true,
      data: imageData
    };
  } catch (err: unknown) {
    console.error('Image preprocessing error:', err);
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    return {
      success: false,
      error: errorMessage
    };
  }
}); 