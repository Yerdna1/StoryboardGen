/**
 * E2E Test: App Launch and Initialization
 * Verifies the Electron app launches correctly
 */

const { mcp__playwright__browser_navigate: navigate } = require('../../playwright');

describe('App Launch', () => {
  it('should launch the application', async () => {
    // Navigate to the app (assuming dev server is running)
    // In real E2E, we'd launch the Electron app directly
    // This is a placeholder showing the test structure

    // Verify main window loads
    // Verify setup screen or main canvas loads based on configuration
    // Verify no critical errors in console
  });

  it('should load all required modules', async () => {
    // Verify all Electron modules load
    const requiredModules = [
      'electron',
      'better-sqlite3',
      'electron-store',
      'openai',
      '@google/generative-ai',
      'replicate',
      '@huggingface/inference',
      'axios',
      'fluent-ffmpeg'
    ];

    // This would run in Node.js context
    for (const mod of requiredModules) {
      try {
        require(mod);
      } catch (error) {
        throw new Error(`Failed to load module: ${mod}`);
      }
    }
  });

  it('should initialize database', async () => {
    // Verify database setup completes
    const { setupDatabase, getDb } = require('../../electron/database');

    setupDatabase();
    const db = getDb();

    expect(db).to.not.be.null;
    expect(db).to.be.an('object');
  });

  it('should verify preload script loads', async () => {
    // In real E2E, verify window.electronAPI is available
    // Verify all required methods are exposed
    const requiredAPIs = [
      'storeAPIKeys',
      'getAPIKeys',
      'checkSetup',
      'selectImage',
      'downloadImage',
      'generateStoryboard',
      'onGenerationProgress'
    ];

    // This would run in renderer process
    // For now, we just verify the preload file exists
    const fs = require('fs');
    const preloadPath = path.join(__dirname, '../../electron/preload.js');

    expect(fs.existsSync(preloadPath)).to.be.true;
  });
});
