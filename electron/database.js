const Database = require('better-sqlite3');
const path = require('path');
const { app, ipcMain } = require('electron');
const {
  logError,
  getUserFriendlyMessage,
  ErrorCategories
} = require('./error-handler');
const { initializeDefaultPrompts } = require('./default-prompts');

let db;

function setupDatabase() {
  if (db) {
    return; // Already initialized
  }

  try {
    const dbPath = path.join(app.getPath('userData'), 'storyboard.db');

    // Ensure userData directory exists
    const userDataPath = app.getPath('userData');
    if (!require('fs').existsSync(userDataPath)) {
      require('fs').mkdirSync(userDataPath, { recursive: true });
    }

    db = new Database(dbPath);

    // Enable better performance
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Create tables with error handling
    db.exec(`
      CREATE TABLE IF NOT EXISTS prompts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS generations (
        id TEXT PRIMARY KEY,
        prompt_id TEXT,
        input_image TEXT,
        output_images TEXT,
        settings TEXT,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (prompt_id) REFERENCES prompts (id)
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        provider TEXT PRIMARY KEY,
        api_key TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status);
      CREATE INDEX IF NOT EXISTS idx_prompts_updated ON prompts(updated_at);
      CREATE INDEX IF NOT EXISTS idx_generations_prompt ON generations(prompt_id);
    `);

    // Initialize default prompts for new users
    try {
      initializeDefaultPrompts(db);
    } catch (error) {
      logError(error, ErrorCategories.DATABASE, 'medium', { operation: 'initialize-default-prompts' });
      // Don't throw - the app can still function without default prompts
    }

    setupDatabaseHandlers();
  } catch (error) {
    const dbError = new Error(`Failed to initialize database: ${error.message}`);
    dbError.category = ErrorCategories.DATABASE;
    dbError.originalError = error;

    logError(dbError, ErrorCategories.DATABASE, 'high', { dbPath: app.getPath('userData') });

    // Try to provide a helpful error message
    const userMessage = getUserFriendlyMessage(ErrorCategories.DATABASE, dbError);
    console.error(userMessage.title + ':', userMessage.message);

    throw dbError;
  }
}

function setupDatabaseHandlers() {
  ipcMain.handle('save-prompt', async (event, prompt) => {
    try {
      const { id, title, content } = prompt;

      // Validate input
      if (!id || !title || !content) {
        const error = new Error('Missing required fields: id, title, or content');
        error.category = ErrorCategories.VALIDATION;
        throw error;
      }

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO prompts (id, title, content, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `);
      stmt.run(id, title, content);
      return { success: true };
    } catch (error) {
      logError(error, ErrorCategories.DATABASE, 'medium', { operation: 'save-prompt', promptId: prompt?.id });
      throw error;
    }
  });

  ipcMain.handle('get-prompts', async () => {
    try {
      const prompts = db.prepare('SELECT * FROM prompts ORDER BY updated_at DESC').all();
      return prompts;
    } catch (error) {
      logError(error, ErrorCategories.DATABASE, 'medium', { operation: 'get-prompts' });
      throw error;
    }
  });

  ipcMain.handle('get-prompt', async (event, id) => {
    try {
      if (!id) {
        const error = new Error('Prompt ID is required');
        error.category = ErrorCategories.VALIDATION;
        throw error;
      }

      const prompt = db.prepare('SELECT * FROM prompts WHERE id = ?').get(id);
      return prompt;
    } catch (error) {
      logError(error, ErrorCategories.DATABASE, 'medium', { operation: 'get-prompt', id });
      throw error;
    }
  });

  ipcMain.handle('update-prompt', async (event, id, data) => {
    try {
      if (!id) {
        const error = new Error('Prompt ID is required');
        error.category = ErrorCategories.VALIDATION;
        throw error;
      }

      const { title, content } = data;

      if (!title || !content) {
        const error = new Error('Title and content are required');
        error.category = ErrorCategories.VALIDATION;
        throw error;
      }

      const stmt = db.prepare(`
        UPDATE prompts SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      const result = stmt.run(title, content, id);

      if (result.changes === 0) {
        const error = new Error(`Prompt with ID ${id} not found`);
        error.category = ErrorCategories.DATABASE;
        throw error;
      }

      return { success: true };
    } catch (error) {
      logError(error, error.category || ErrorCategories.DATABASE, 'medium', { operation: 'update-prompt', id });
      throw error;
    }
  });

  ipcMain.handle('delete-prompt', async (event, id) => {
    try {
      if (!id) {
        const error = new Error('Prompt ID is required');
        error.category = ErrorCategories.VALIDATION;
        throw error;
      }

      const result = db.prepare('DELETE FROM prompts WHERE id = ?').run(id);

      if (result.changes === 0) {
        const error = new Error(`Prompt with ID ${id} not found`);
        error.category = ErrorCategories.DATABASE;
        throw error;
      }

      return { success: true };
    } catch (error) {
      logError(error, error.category || ErrorCategories.DATABASE, 'medium', { operation: 'delete-prompt', id });
      throw error;
    }
  });

  // Generation handlers
  ipcMain.handle('save-generation', async (event, generation) => {
    try {
      const { id, prompt_id, input_image, output_images, settings, status } = generation;

      if (!id) {
        const error = new Error('Generation ID is required');
        error.category = ErrorCategories.VALIDATION;
        throw error;
      }

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO generations (id, prompt_id, input_image, output_images, settings, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id, prompt_id, input_image, JSON.stringify(output_images), JSON.stringify(settings), status);
      return { success: true };
    } catch (error) {
      logError(error, ErrorCategories.DATABASE, 'medium', { operation: 'save-generation', generationId: generation?.id });
      throw error;
    }
  });

  ipcMain.handle('get-generations', async (event, promptId) => {
    try {
      const generations = db.prepare('SELECT * FROM generations WHERE prompt_id = ? ORDER BY created_at DESC').all(promptId);
      // Parse output_images and settings from JSON with error handling
      return generations.map(gen => {
        try {
          return {
            ...gen,
            output_images: JSON.parse(gen.output_images || '[]'),
            settings: JSON.parse(gen.settings || '{}')
          };
        } catch (parseError) {
          logError(parseError, ErrorCategories.DATABASE, 'low', {
            operation: 'parse-generation-json',
            generationId: gen.id
          });
          return {
            ...gen,
            output_images: [],
            settings: {}
          };
        }
      });
    } catch (error) {
      logError(error, ErrorCategories.DATABASE, 'medium', { operation: 'get-generations', promptId });
      throw error;
    }
  });

  ipcMain.handle('get-generation', async (event, id) => {
    try {
      if (!id) {
        const error = new Error('Generation ID is required');
        error.category = ErrorCategories.VALIDATION;
        throw error;
      }

      const generation = db.prepare('SELECT * FROM generations WHERE id = ?').get(id);
      if (generation) {
        try {
          generation.output_images = JSON.parse(generation.output_images || '[]');
          generation.settings = JSON.parse(generation.settings || '{}');
        } catch (parseError) {
          logError(parseError, ErrorCategories.DATABASE, 'low', {
            operation: 'parse-generation-json',
            generationId: id
          });
          generation.output_images = [];
          generation.settings = {};
        }
      }
      return generation;
    } catch (error) {
      logError(error, error.category || ErrorCategories.DATABASE, 'medium', { operation: 'get-generation', id });
      throw error;
    }
  });

  ipcMain.handle('delete-generation', async (event, id) => {
    try {
      if (!id) {
        const error = new Error('Generation ID is required');
        error.category = ErrorCategories.VALIDATION;
        throw error;
      }

      const result = db.prepare('DELETE FROM generations WHERE id = ?').run(id);

      if (result.changes === 0) {
        const error = new Error(`Generation with ID ${id} not found`);
        error.category = ErrorCategories.DATABASE;
        throw error;
      }

      return { success: true };
    } catch (error) {
      logError(error, error.category || ErrorCategories.DATABASE, 'medium', { operation: 'delete-generation', id });
      throw error;
    }
  });

  // Get all completed generations (for history/gallery)
  ipcMain.handle('get-all-generations', async (event) => {
    try {
      const generations = db.prepare('SELECT * FROM generations WHERE status = ? ORDER BY created_at DESC').all('completed');

      // Parse JSON fields
      return generations.map(gen => {
        try {
          return {
            ...gen,
            output_images: JSON.parse(gen.output_images || '[]'),
            settings: JSON.parse(gen.settings || '{}')
          };
        } catch (parseError) {
          logError(parseError, ErrorCategories.DATABASE, 'low', {
            operation: 'parse-generation-json',
            generationId: gen.id
          });
          return {
            ...gen,
            output_images: [],
            settings: {}
          };
        }
      });
    } catch (error) {
      logError(error, ErrorCategories.DATABASE, 'medium', { operation: 'get-all-generations' });
      throw error;
    }
  });

  // Mark a generation as a sample
  ipcMain.handle('mark-as-sample', async (event, generationId, sampleName) => {
    try {
      if (!generationId) {
        const error = new Error('Generation ID is required');
        error.category = ErrorCategories.VALIDATION;
        throw error;
      }

      // Add a note/metadata to mark as sample
      const generation = db.prepare('SELECT * FROM generations WHERE id = ?').get(generationId);
      if (!generation) {
        const error = new Error('Generation not found');
        error.category = ErrorCategories.DATABASE;
        throw error;
      }

      // Update settings to mark as sample
      let settings = {};
      try {
        settings = JSON.parse(generation.settings || '{}');
      } catch (e) {
        settings = {};
      }

      settings.isSample = true;
      settings.sampleName = sampleName || generationId;

      const stmt = db.prepare('UPDATE generations SET settings = ? WHERE id = ?');
      stmt.run(JSON.stringify(settings), generationId);

      return { success: true };
    } catch (error) {
      logError(error, error.category || ErrorCategories.DATABASE, 'medium', { operation: 'mark-as-sample', generationId });
      throw error;
    }
  });

  // Get sample generations
  ipcMain.handle('get-samples', async (event) => {
    try {
      const generations = db.prepare('SELECT * FROM generations WHERE status = ? ORDER BY created_at DESC').all('completed');

      // Filter and parse samples
      return generations
        .map(gen => {
          try {
            return {
              ...gen,
              output_images: JSON.parse(gen.output_images || '[]'),
              settings: JSON.parse(gen.settings || '{}')
            };
          } catch (parseError) {
            return {
              ...gen,
              output_images: [],
              settings: {}
            };
          }
        })
        .filter(gen => gen.settings.isSample);
    } catch (error) {
      logError(error, ErrorCategories.DATABASE, 'medium', { operation: 'get-samples' });
      throw error;
    }
  });

  // API Keys handlers
  ipcMain.handle('save-api-key', async (event, provider, apiKey) => {
    try {
      if (!provider || !apiKey) {
        const error = new Error('Provider and API key are required');
        error.category = ErrorCategories.VALIDATION;
        throw error;
      }

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO api_keys (provider, api_key, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `);
      stmt.run(provider, apiKey);
      return { success: true };
    } catch (error) {
      logError(error, ErrorCategories.DATABASE, 'medium', { operation: 'save-api-key', provider });
      throw error;
    }
  });

  ipcMain.handle('store-api-keys', async (event, keys) => {
    try {
      if (!keys || typeof keys !== 'object') {
        const error = new Error('API keys object is required');
        error.category = ErrorCategories.VALIDATION;
        throw error;
      }

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO api_keys (provider, api_key, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `);

      const providers = ['openai', 'gemini', 'replicate', 'huggingface', 'modal'];
      for (const provider of providers) {
        if (keys[provider]) {
          stmt.run(provider, keys[provider]);
        }
      }

      return { success: true };
    } catch (error) {
      logError(error, ErrorCategories.DATABASE, 'medium', { operation: 'save-api-keys' });
      throw error;
    }
  });

  ipcMain.handle('get-api-keys', async () => {
    try {
      const keys = db.prepare('SELECT provider, api_key FROM api_keys').all();
      const result = {};
      for (const key of keys) {
        result[key.provider] = key.api_key;
      }
      return result;
    } catch (error) {
      logError(error, ErrorCategories.DATABASE, 'medium', { operation: 'get-api-keys' });
      throw error;
    }
  });

  ipcMain.handle('get-api-key', async (event, provider) => {
    try {
      if (!provider) {
        const error = new Error('Provider is required');
        error.category = ErrorCategories.VALIDATION;
        throw error;
      }

      const result = db.prepare('SELECT api_key FROM api_keys WHERE provider = ?').get(provider);
      return result?.api_key || null;
    } catch (error) {
      logError(error, ErrorCategories.DATABASE, 'medium', { operation: 'get-api-key', provider });
      throw error;
    }
  });

  ipcMain.handle('delete-api-key', async (event, provider) => {
    try {
      if (!provider) {
        const error = new Error('Provider is required');
        error.category = ErrorCategories.VALIDATION;
        throw error;
      }

      const result = db.prepare('DELETE FROM api_keys WHERE provider = ?').run(provider);

      if (result.changes === 0) {
        const error = new Error(`API key for provider ${provider} not found`);
        error.category = ErrorCategories.DATABASE;
        throw error;
      }

      return { success: true };
    } catch (error) {
      logError(error, error.category || ErrorCategories.DATABASE, 'medium', { operation: 'delete-api-key', provider });
      throw error;
    }
  });
}

// Export the database instance for use in other modules
function getDb() {
  return db;
}

module.exports = { setupDatabase, getDb };