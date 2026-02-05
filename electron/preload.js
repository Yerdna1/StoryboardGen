const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // API Key Management
  storeAPIKeys: (keys) => ipcRenderer.invoke('store-api-keys', keys),
  getAPIKeys: () => ipcRenderer.invoke('get-api-keys'),
  setModalUrl: (url) => ipcRenderer.invoke('set-modal-url', url),
  getModalUrl: () => ipcRenderer.invoke('get-modal-url'),
  checkSetup: () => ipcRenderer.invoke('check-setup'),
  setShowSetupOnStartup: (show) => ipcRenderer.invoke('set-show-setup-on-startup', show),
  getShowSetupOnStartup: () => ipcRenderer.invoke('get-show-setup-on-startup'),

  // Download Destination Settings
  setDownloadDestination: (destination) => ipcRenderer.invoke('set-download-destination', destination),
  getDownloadDestination: () => ipcRenderer.invoke('get-download-destination'),
  selectDownloadDestination: () => ipcRenderer.invoke('select-download-destination'),

  // File Operations
  selectImage: () => ipcRenderer.invoke('select-image'),

  // Download Operations
  downloadImage: (dataUrl, filename, preferredLocation) =>
    ipcRenderer.invoke('download-image', dataUrl, filename, preferredLocation),
  downloadReferenceImage: (dataUrl, preferredLocation) =>
    ipcRenderer.invoke('download-reference-image', dataUrl, preferredLocation),
  downloadAllPanels: (images, zipFilename, preferredLocation) =>
    ipcRenderer.invoke('download-all-panels', images, zipFilename, preferredLocation),

  // Video Export Operations
  checkFFmpeg: () => ipcRenderer.invoke('check-ffmpeg'),
  exportVideo: (panels, options) => ipcRenderer.invoke('export-video', panels, options),
  onVideoExportProgress: (callback) => {
    ipcRenderer.on('video-export-progress', (event, progress) => callback(progress));
  },

  // Database Operations
  savePrompt: (prompt) => ipcRenderer.invoke('save-prompt', prompt),
  getPrompts: () => ipcRenderer.invoke('get-prompts'),
  getPrompt: (id) => ipcRenderer.invoke('get-prompt', id),
  updatePrompt: (id, data) => ipcRenderer.invoke('update-prompt', id, data),
  deletePrompt: (id) => ipcRenderer.invoke('delete-prompt', id),

  // Generation History
  getAllGenerations: () => ipcRenderer.invoke('get-all-generations'),
  getGenerations: (promptId) => ipcRenderer.invoke('get-generations', promptId),
  getGeneration: (id) => ipcRenderer.invoke('get-generation', id),
  deleteGeneration: (id) => ipcRenderer.invoke('delete-generation', id),
  markAsSample: (generationId, sampleName) => ipcRenderer.invoke('mark-as-sample', generationId, sampleName),
  getSamples: () => ipcRenderer.invoke('get-samples'),

  // Generation Operations
  generateStoryboard: (imageUrl, prompt, settings) =>
    ipcRenderer.invoke('generate-storyboard', imageUrl, prompt, settings),

  // Progress Updates
  onGenerationProgress: (callback) => {
    ipcRenderer.on('generation-progress', (event, progress) => callback(progress));
  },

  // Download Progress Updates
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, progress) => callback(progress));
  },

  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});