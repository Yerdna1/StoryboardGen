const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { setupDatabase, getDb } = require('./database');
const { setupAPIHandlers, setDatabase } = require('./api-handlers');
const { exportVideo, checkFFmpegAvailable } = require('./video-export');
const Store = require('electron-store');
const {
  downloadImage,
  createImageZip,
  downloadReferenceImage
} = require('./download-handler');
const {
  getUserFriendlyMessage,
  logError,
  ErrorCategories,
  handleFileOperation
} = require('./error-handler');

const store = new Store();
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, '../public/icon.png'),
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a1a'
  });

  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../build/index.html')}`;
  mainWindow.loadURL(startUrl);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize database
  setupDatabase();

  // Setup API handlers with database connection
  const db = getDb();
  setDatabase(db);
  setupAPIHandlers();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle initial setup check - now using database
ipcMain.handle('check-setup', async () => {
  const db = getDb();
  const keys = db.prepare('SELECT provider, api_key FROM api_keys').all();
  const apiKeys = {};
  for (const key of keys) {
    apiKeys[key.provider] = key.api_key;
  }

  return {
    isSetupComplete: Object.keys(apiKeys).length > 0,
    hasOpenAI: !!apiKeys.openai,
    hasGemini: !!apiKeys.gemini,
    hasReplicate: !!apiKeys.replicate,
    hasHuggingFace: !!apiKeys.huggingface,
    hasModal: !!apiKeys.modal
  };
});

// Handle show setup on startup preference
ipcMain.handle('set-show-setup-on-startup', async (event, show) => {
  store.set('showSetupOnStartup', show);
  return { success: true };
});

ipcMain.handle('get-show-setup-on-startup', async () => {
  return store.get('showSetupOnStartup', false);
});

// Handle Modal URL configuration
ipcMain.handle('set-modal-url', async (event, url) => {
  store.set('modalUrl', url);
  return { success: true };
});

ipcMain.handle('get-modal-url', async () => {
  return store.get('modalUrl', 'https://andrej-galad--film-generator-image-edit-qwenimageeditgen-94d79a.modal.run/');
});

// Handle download destination preference
ipcMain.handle('set-download-destination', async (event, destination) => {
  store.set('downloadDestination', destination);
  return { success: true };
});

ipcMain.handle('get-download-destination', async () => {
  return store.get('downloadDestination', null);
});

// Handle select download destination folder dialog
ipcMain.handle('select-download-destination', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Download Destination Folder'
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, destination: result.filePaths[0] };
    }
    return { success: false, canceled: true };
  } catch (error) {
    logError(error, ErrorCategories.FILE, 'medium', { operation: 'select-download-destination' });
    return { success: false, error: error.message };
  }
});

// Handle file dialog for image selection with comprehensive error handling
ipcMain.handle('select-image', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
      ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return await handleFileOperation(async () => {
        const filePath = result.filePaths[0];

        // Check if file exists
        if (!fs.existsSync(filePath)) {
          const error = new Error(`File not found: ${filePath}`);
          error.category = ErrorCategories.FILE;
          throw error;
        }

        // Check file size (max 10MB)
        const stats = fs.statSync(filePath);
        if (stats.size > 10 * 1024 * 1024) {
          const error = new Error('File size exceeds 10MB limit');
          error.category = ErrorCategories.VALIDATION;
          throw error;
        }

        // Read file and convert to data URL
        const fileBuffer = fs.readFileSync(filePath);
        const fileExt = path.extname(filePath).toLowerCase();
        const mimeType = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp'
        }[fileExt] || 'image/jpeg';

        const base64Data = fileBuffer.toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64Data}`;

        return dataUrl;
      }, 'select-image');
    }
    return null;
  } catch (error) {
    logError(error, error.category || ErrorCategories.FILE, 'medium', { operation: 'select-image' });
    return null;
  }
});

// Handle image download with comprehensive error handling
ipcMain.handle('download-image', async (event, dataUrl, filename, preferredLocation) => {
  try {
    return await handleFileOperation(async () => {
      const customDestination = store.get('downloadDestination', null);
      const result = await downloadImage(dataUrl, filename, preferredLocation, customDestination);
      return result;
    }, 'download-image');
  } catch (error) {
    logError(error, error.category || ErrorCategories.FILE, 'medium', {
      operation: 'download-image',
      filename
    });

    const userMessage = getUserFriendlyMessage(error.category || ErrorCategories.FILE, error);
    return {
      success: false,
      error: error.message,
      message: userMessage.message,
      recovery: userMessage.recovery
    };
  }
});

// Handle reference image download with comprehensive error handling
ipcMain.handle('download-reference-image', async (event, dataUrl, preferredLocation) => {
  try {
    return await handleFileOperation(async () => {
      const customDestination = store.get('downloadDestination', null);
      const result = await downloadReferenceImage(dataUrl, preferredLocation, customDestination);
      return result;
    }, 'download-reference-image');
  } catch (error) {
    logError(error, error.category || ErrorCategories.FILE, 'medium', {
      operation: 'download-reference-image'
    });

    const userMessage = getUserFriendlyMessage(error.category || ErrorCategories.FILE, error);
    return {
      success: false,
      error: error.message,
      message: userMessage.message,
      recovery: userMessage.recovery
    };
  }
});

// Handle download all panels as ZIP with comprehensive error handling
ipcMain.handle('download-all-panels', async (event, images, zipFilename, preferredLocation) => {
  try {
    return await handleFileOperation(async () => {
      // Send progress updates
      const progressCallback = (progress) => {
        if (mainWindow) {
          mainWindow.webContents.send('download-progress', progress);
        }
      };

      const customDestination = store.get('downloadDestination', null);
      const result = await createImageZip(images, zipFilename, preferredLocation, progressCallback, customDestination);
      return result;
    }, 'download-all-panels');
  } catch (error) {
    logError(error, error.category || ErrorCategories.FILE, 'medium', {
      operation: 'download-all-panels',
      zipFilename,
      imageCount: images?.length
    });

    const userMessage = getUserFriendlyMessage(error.category || ErrorCategories.FILE, error);
    return {
      success: false,
      error: error.message,
      message: userMessage.message,
      recovery: userMessage.recovery
    };
  }
});

// Check if FFmpeg is available with error handling
ipcMain.handle('check-ffmpeg', async () => {
  try {
    const isAvailable = await checkFFmpegAvailable();
    return { isAvailable };
  } catch (error) {
    logError(error, ErrorCategories.UNKNOWN, 'low', { operation: 'check-ffmpeg' });
    return { isAvailable: false, error: error.message };
  }
});

// Handle video export with comprehensive error handling
ipcMain.handle('export-video', async (event, panels, options) => {
  try {
    // Validate inputs
    if (!panels || panels.length === 0) {
      const error = new Error('No panels provided for video export');
      error.category = ErrorCategories.VALIDATION;
      throw error;
    }

    // Send progress updates
    const progressCallback = (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('video-export-progress', progress);
      }
    };

    const result = await exportVideo(panels, options, progressCallback);
    return {
      success: true,
      outputPath: result.outputPath,
      filename: result.filename,
      message: `Video exported successfully to ${result.outputPath}`
    };
  } catch (error) {
    logError(error, error.category || ErrorCategories.UNKNOWN, 'medium', {
      operation: 'export-video',
      panelCount: panels?.length,
      options
    });

    const userMessage = getUserFriendlyMessage(error.category || ErrorCategories.UNKNOWN, error);
    return {
      success: false,
      error: error.message,
      message: userMessage.message,
      recovery: userMessage.recovery
    };
  }
});