const { ipcMain } = require('electron');
const Store = require('electron-store');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Replicate = require('replicate');
const { HfInference } = require('@huggingface/inference');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const {
  withRetry,
  withTimeout,
  getUserFriendlyMessage,
  logError,
  handleFileOperation,
  handleDatabaseOperation,
  ErrorCategories,
  RetryConfig
} = require('./error-handler');

const store = new Store();

// Import database functions (will be initialized in main.js)
let db;
function setDatabase(database) {
  db = database;
}

/**
 * Save a data URL image to disk permanently
 * @param {string} dataUrl - The data URL (data:image/png;base64,...)
 * @param {string} panelId - The panel ID for filename
 * @param {string} generationId - The generation ID for folder organization
 * @returns {Promise<string>} - The file path to the saved image
 */
async function saveImageToDisk(dataUrl, panelId, generationId) {
  const { app } = require('electron');
  const fs = require('fs');
  const path = require('path');

  // Create generations directory in userData
  const generationsDir = path.join(app.getPath('userData'), 'generations', generationId);
  if (!fs.existsSync(generationsDir)) {
    fs.mkdirSync(generationsDir, { recursive: true });
  }

  // Extract base64 data
  const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid data URL format');
  }

  const ext = matches[1];
  const base64Data = matches[2];
  const filename = `panel-${panelId}.${ext}`;
  const filepath = path.join(generationsDir, filename);

  // Save to disk
  fs.writeFileSync(filepath, base64Data, 'base64');

  console.log(`[SaveImage] Saved panel ${panelId} to: ${filepath}`);
  return filepath;
}

/**
 * Save all generated panels to disk and update with file paths
 * @param {Array} panels - The generated panels with data URLs
 * @param {string} generationId - The generation ID
 * @returns {Promise<Array>} - Panels with file paths instead of data URLs
 */
async function savePanelsToDisk(panels, generationId) {
  const savedPanels = [];

  for (const panel of panels) {
    if (panel.url && panel.url.startsWith('data:')) {
      try {
        const filepath = await saveImageToDisk(panel.url, panel.id, generationId);
        savedPanels.push({
          ...panel,
          url: `file://${filepath}`,
          filePath: filepath,
          isLocal: true
        });
      } catch (error) {
        console.error(`[SaveImage] Failed to save panel ${panel.id}:`, error);
        // Keep original data URL if save fails
        savedPanels.push(panel);
      }
    } else {
      savedPanels.push(panel);
    }
  }

  return savedPanels;
}

// Enhanced Progress Tracker Class
class ProgressTracker {
  constructor(event, totalPanels = 20) {
    this.event = event;
    this.totalPanels = totalPanels;
    this.startTime = Date.now();
    this.panels = [];
    this.currentPanel = 0;
    this.retryAttempts = {};
    this.maxRetries = 3;
    this.stage = 'initializing';
  }

  calculateETA() {
    const elapsed = Date.now() - this.startTime;
    const completedPanels = this.panels.filter(p => p.status === 'completed').length;

    if (completedPanels === 0) return 'Calculating...';

    const avgTimePerPanel = elapsed / completedPanels;
    const remainingPanels = this.totalPanels - completedPanels;
    const remainingTime = avgTimePerPanel * remainingPanels;

    if (remainingTime < 60000) {
      return `${Math.ceil(remainingTime / 1000)} seconds left`;
    } else if (remainingTime < 3600000) {
      return `${Math.ceil(remainingTime / 60000)} minutes left`;
    } else {
      return `${Math.ceil(remainingTime / 3600000)} hours left`;
    }
  }

  calculateProgress() {
    const completedPanels = this.panels.filter(p => p.status === 'completed').length;
    return Math.floor((completedPanels / this.totalPanels) * 100);
  }

  updatePanelStatus(panelNumber, status, errorMessage = null) {
    const existingPanel = this.panels.find(p => p.number === panelNumber);

    if (existingPanel) {
      existingPanel.status = status;
      existingPanel.errorMessage = errorMessage;
      if (status === 'generating') {
        existingPanel.attempts = (existingPanel.attempts || 0) + 1;
      }
    } else {
      this.panels.push({
        number: panelNumber,
        status,
        errorMessage,
        attempts: status === 'generating' ? 1 : 0
      });
    }

    this.currentPanel = panelNumber;
  }

  sendProgress(stage, message, additionalData = {}) {
    this.stage = stage;
    const progressData = {
      status: stage,
      progress: this.calculateProgress(),
      message,
      currentPanel: this.currentPanel,
      totalPanels: this.totalPanels,
      panels: [...this.panels],
      eta: this.calculateETA(),
      stage,
      ...additionalData
    };

    this.event.sender.send('generation-progress', progressData);
  }

  markPanelError(panelNumber, error) {
    if (!this.retryAttempts[panelNumber]) {
      this.retryAttempts[panelNumber] = 0;
    }

    this.retryAttempts[panelNumber]++;
    this.updatePanelStatus(panelNumber, 'error', error.message);

    return this.retryAttempts[panelNumber] < this.maxRetries;
  }

  getPanelStats() {
    return {
      total: this.totalPanels,
      completed: this.panels.filter(p => p.status === 'completed').length,
      generating: this.panels.filter(p => p.status === 'generating').length,
      pending: this.panels.filter(p => p.status === 'pending').length,
      error: this.panels.filter(p => p.status === 'error').length
    };
  }
}

function setupAPIHandlers() {
  ipcMain.handle('generate-storyboard', async (event, imageUrl, prompt, settings) => {
    // Fetch API keys from database instead of electron-store
    const apiKeys = {};
    if (db) {
      const keys = db.prepare('SELECT provider, api_key FROM api_keys').all();
      for (const key of keys) {
        apiKeys[key.provider] = key.api_key;
      }
    }

    const generationId = uuidv4();
    const totalPanels = settings.panelCount || 20;

    try {
      // Initialize progress tracker
      const tracker = new ProgressTracker(event, totalPanels);

      // Send initialization progress
      tracker.sendProgress('initializing', 'Initializing storyboard generation...', {
        stage: 'initializing',
        provider: settings.provider || 'openai'
      });

      // Validate inputs
      if (!prompt || prompt.trim().length === 0) {
        const error = new Error('Prompt is required for storyboard generation');
        error.category = ErrorCategories.VALIDATION;
        throw error;
      }

      if (!imageUrl || imageUrl.trim().length === 0) {
        const error = new Error('Reference image URL is required');
        error.category = ErrorCategories.VALIDATION;
        throw error;
      }

      // Save initial generation record with error handling
      await handleDatabaseOperation(async () => {
        if (db) {
          db.prepare('INSERT INTO generations (id, prompt_id, input_image, output_images, settings, status) VALUES (?, ?, ?, ?, ?, ?)').run(
            generationId,
            settings.promptId || null,
            imageUrl,
            '[]',
            JSON.stringify(settings),
            'starting'
          );
        }
      }, 'save-initial-generation');

      // Determine which provider to use
      const provider = settings.provider || 'openai';
      let result;

      switch (provider) {
        case 'openai':
          result = await generateWithOpenAI(imageUrl, prompt, settings, apiKeys.openai, tracker);
          break;
        case 'gemini':
          result = await generateWithGemini(imageUrl, prompt, settings, apiKeys.gemini, tracker);
          break;
        case 'replicate':
          result = await generateWithReplicate(imageUrl, prompt, settings, apiKeys.replicate, tracker);
          break;
        case 'huggingface':
          result = await generateWithHuggingFace(imageUrl, prompt, settings, apiKeys.huggingface, tracker);
          break;
        case 'modal':
          result = await generateWithModal(imageUrl, prompt, settings, apiKeys.modal, tracker);
          break;
        case 'automatic1111':
          result = await generateWithAutomatic1111(imageUrl, prompt, settings, settings.automatic1111Url || 'http://127.0.0.1:7860', tracker);
          break;
        case 'comfyui':
          result = await generateWithComfyUI(imageUrl, prompt, settings, settings.comfyUiUrl || 'http://127.0.0.1:8188', tracker);
          break;
        default:
          const error = new Error(`Unsupported provider: ${provider}`);
          error.category = ErrorCategories.VALIDATION;
          throw error;
      }

      // Save completed generation to database with error handling
      await handleDatabaseOperation(async () => {
        if (db) {
          db.prepare('UPDATE generations SET output_images = ?, status = ? WHERE id = ?').run(
            JSON.stringify(result.panels),
            'completed',
            generationId
          );
        }
      }, 'save-completed-generation');

      // Send completion progress
      tracker.sendProgress('completed', 'Storyboard generation completed!', {
        stage: 'completed',
        result,
        stats: tracker.getPanelStats()
      });

      return { ...result, generationId };

    } catch (error) {
      const category = error.category || ErrorCategories.UNKNOWN;
      const userMessage = error.userMessage || getUserFriendlyMessage(category, error);

      // Update generation status in database with error handling
      try {
        if (db) {
          await handleDatabaseOperation(async () => {
            db.prepare('UPDATE generations SET status = ? WHERE id = ?').run('error', generationId);
          }, 'update-generation-error');
        }
      } catch (dbError) {
        console.error('Failed to update generation error status:', dbError);
      }

      event.sender.send('generation-progress', {
        status: 'error',
        progress: 0,
        message: userMessage.message,
        title: userMessage.title,
        recovery: userMessage.recovery,
        errorMessage: error.message,
        stage: 'error',
        category
      });

      // Log the error for debugging
      logError(error, category, error.severity || 'medium', {
        generationId,
        provider: settings?.provider,
        promptLength: prompt?.length,
        totalPanels
      });

      throw error;
    }
  });
}

async function generateWithOpenAI(imageUrl, prompt, settings, apiKey, tracker) {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  const openai = new OpenAI({ apiKey });

  tracker.sendProgress('api_setup', 'Setting up OpenAI DALL-E 3...', {
    provider: 'openai',
    model: 'dall-e-3'
  });

  try {
    // Parse the panel descriptions from the prompt
    const panelDescriptions = parsePanelDescriptions(prompt);
    const totalPanels = panelDescriptions.length || tracker.totalPanels;

    // Initialize all panels as pending
    for (let i = 1; i <= totalPanels; i++) {
      tracker.updatePanelStatus(i, 'pending');
    }

    tracker.sendProgress('preparing', `Preparing to generate ${totalPanels} panels...`, {
      totalPanels,
      stats: tracker.getPanelStats()
    });

    const panels = [];

    for (let i = 0; i < totalPanels; i++) {
      const panelNum = i + 1;

      // Update panel status to generating
      tracker.updatePanelStatus(panelNum, 'generating');
      tracker.sendProgress('generating', `Generating panel ${panelNum} of ${totalPanels}...`, {
        currentPanel: panelNum,
        stats: tracker.getPanelStats()
      });

      const panelPrompt = panelDescriptions[i] || `Panel ${panelNum} of the storyboard`;

      try {
        // Generate image with OpenAI
        tracker.sendProgress('api_call', `Calling OpenAI API for panel ${panelNum}...`, {
          currentPanel: panelNum,
          subStage: 'api_call'
        });

        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: `${panelPrompt}\n\nStyle: Cinematic, photorealistic, consistent visual style with the reference image.`,
          n: 1,
          size: "1024x1024",
          quality: "hd",
          response_format: "url"
        });

        tracker.sendProgress('downloading', `Downloading panel ${panelNum}...`, {
          currentPanel: panelNum,
          subStage: 'downloading'
        });

        const imageUrl = response.data[0].url;

        // Download the image and convert to base64
        const base64Image = await downloadAndConvertImage(imageUrl, panelNum);

        panels.push({
          id: `panel-${panelNum}`,
          url: base64Image,
          description: panelPrompt,
          status: 'completed'
        });

        // Mark panel as completed
        tracker.updatePanelStatus(panelNum, 'completed');
        tracker.sendProgress('generating', `Completed panel ${panelNum} of ${totalPanels}`, {
          currentPanel: panelNum,
          stats: tracker.getPanelStats()
        });

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (panelError) {
        console.error(`Error generating panel ${panelNum}:`, panelError);

        const shouldRetry = tracker.markPanelError(panelNum, panelError);

        if (shouldRetry) {
          tracker.sendProgress('retrying', `Retrying panel ${panelNum} (attempt ${tracker.retryAttempts[panelNum]}/${tracker.maxRetries})...`, {
            currentPanel: panelNum,
            retryAttempt: tracker.retryAttempts[panelNum],
            maxRetries: tracker.maxRetries,
            error: panelError.message
          });

          // Wait before retry
          if (panelError.status === 429) {
            await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute for rate limits
          } else {
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
          i--; // Retry this panel
          continue;
        }

        // If max retries reached, add a placeholder panel
        panels.push({
          id: `panel-${panelNum}`,
          url: null,
          description: panelPrompt,
          status: 'error',
          error: panelError.message
        });

        tracker.sendProgress('error_panel', `Failed to generate panel ${panelNum} after ${tracker.maxRetries} attempts`, {
          currentPanel: panelNum,
          error: panelError.message,
          stats: tracker.getPanelStats()
        });
      }
    }

    tracker.sendProgress('post_processing', 'Finalizing storyboard...', {
      stage: 'post_processing'
    });

    return {
      provider: 'openai',
      panels,
      metadata: {
        model: 'dall-e-3',
        timestamp: new Date().toISOString(),
        stats: tracker.getPanelStats()
      }
    };

  } catch (error) {
    console.error('OpenAI generation error:', error);
    throw new Error(`OpenAI generation failed: ${error.message}`);
  }
}

async function generateWithGemini(imageUrl, prompt, settings, apiKey, tracker) {
  if (!apiKey) {
    throw new Error('Gemini API key is required');
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  tracker.sendProgress('api_setup', 'Setting up Google Gemini Imagen 3...', {
    provider: 'gemini',
    model: 'imagen-3'
  });

  try {
    // Get the Imagen 3 model
    const model = genAI.getGenerativeModel({ model: "imagen-3.0-generate-001" });

    // Parse the panel descriptions from the prompt
    const panelDescriptions = parsePanelDescriptions(prompt);
    const totalPanels = panelDescriptions.length || tracker.totalPanels;

    // Initialize all panels as pending
    for (let i = 1; i <= totalPanels; i++) {
      tracker.updatePanelStatus(i, 'pending');
    }

    tracker.sendProgress('preparing', `Preparing to generate ${totalPanels} panels with Gemini...`, {
      totalPanels,
      stats: tracker.getPanelStats()
    });

    const panels = [];

    for (let i = 0; i < totalPanels; i++) {
      const panelNum = i + 1;

      tracker.updatePanelStatus(panelNum, 'generating');
      tracker.sendProgress('generating', `Generating panel ${panelNum} of ${totalPanels} with Gemini...`, {
        currentPanel: panelNum,
        stats: tracker.getPanelStats()
      });

      const panelPrompt = panelDescriptions[i] || `Panel ${panelNum} of the storyboard`;

      try {
        // Generate image with Gemini
        tracker.sendProgress('api_call', `Calling Gemini API for panel ${panelNum}...`, {
          currentPanel: panelNum,
          subStage: 'api_call'
        });

        const result = await model.generateImage(
          `${panelPrompt}\n\nStyle: Cinematic, photorealistic, consistent visual style with the reference image.`,
          {
            numberOfImages: 1,
            aspectRatio: "1:1",
            safetyFilterLevel: "block_some",
            personGeneration: "allow_adult"
          }
        );

        tracker.sendProgress('processing', `Processing panel ${panelNum} response...`, {
          currentPanel: panelNum,
          subStage: 'processing'
        });

        const generatedImage = result.response.images[0];
        const imageData = generatedImage.data;

        // Convert the base64 data to data URL
        const base64Image = `data:image/png;base64,${imageData}`;

        panels.push({
          id: `panel-${panelNum}`,
          url: base64Image,
          description: panelPrompt,
          status: 'completed'
        });

        tracker.updatePanelStatus(panelNum, 'completed');
        tracker.sendProgress('generating', `Completed panel ${panelNum} of ${totalPanels}`, {
          currentPanel: panelNum,
          stats: tracker.getPanelStats()
        });

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (panelError) {
        console.error(`Error generating panel ${panelNum}:`, panelError);

        const shouldRetry = tracker.markPanelError(panelNum, panelError);

        if (shouldRetry) {
          tracker.sendProgress('retrying', `Retrying panel ${panelNum} (attempt ${tracker.retryAttempts[panelNum]}/${tracker.maxRetries})...`, {
            currentPanel: panelNum,
            retryAttempt: tracker.retryAttempts[panelNum],
            maxRetries: tracker.maxRetries,
            error: panelError.message
          });

          // Wait before retry
          if (panelError.status === 429 || panelError.message?.includes('quota')) {
            await new Promise(resolve => setTimeout(resolve, 60000));
          } else {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
          i--;
          continue;
        }

        // If max retries reached, add a placeholder panel
        panels.push({
          id: `panel-${panelNum}`,
          url: null,
          description: panelPrompt,
          status: 'error',
          error: panelError.message
        });

        tracker.sendProgress('error_panel', `Failed to generate panel ${panelNum} after ${tracker.maxRetries} attempts`, {
          currentPanel: panelNum,
          error: panelError.message,
          stats: tracker.getPanelStats()
        });
      }
    }

    tracker.sendProgress('post_processing', 'Finalizing storyboard...', {
      stage: 'post_processing'
    });

    return {
      provider: 'gemini',
      panels,
      metadata: {
        model: 'imagen-3',
        timestamp: new Date().toISOString(),
        stats: tracker.getPanelStats()
      }
    };

  } catch (error) {
    console.error('Gemini generation error:', error);
    throw new Error(`Gemini generation failed: ${error.message}`);
  }
}

async function generateWithReplicate(imageUrl, prompt, settings, apiKey, tracker) {
  if (!apiKey) {
    throw new Error('Replicate API key is required');
  }

  const replicate = new Replicate({
    auth: apiKey
  });

  tracker.sendProgress('api_setup', 'Setting up Replicate Stable Diffusion...', {
    provider: 'replicate',
    model: 'stable-diffusion-xl'
  });

  try {
    // Parse the panel descriptions from the prompt
    const panelDescriptions = parsePanelDescriptions(prompt);
    const totalPanels = panelDescriptions.length || tracker.totalPanels;

    // Initialize all panels as pending
    for (let i = 1; i <= totalPanels; i++) {
      tracker.updatePanelStatus(i, 'pending');
    }

    tracker.sendProgress('preparing', `Preparing to generate ${totalPanels} panels with Replicate...`, {
      totalPanels,
      stats: tracker.getPanelStats()
    });

    const panels = [];

    // Use Stable Diffusion XL model
    const model = "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b";

    for (let i = 0; i < totalPanels; i++) {
      const panelNum = i + 1;

      tracker.updatePanelStatus(panelNum, 'generating');
      tracker.sendProgress('generating', `Generating panel ${panelNum} of ${totalPanels} with Replicate...`, {
        currentPanel: panelNum,
        stats: tracker.getPanelStats()
      });

      const panelPrompt = panelDescriptions[i] || `Panel ${panelNum} of the storyboard`;

      try {
        // Generate image with Replicate
        tracker.sendProgress('api_call', `Calling Replicate API for panel ${panelNum}...`, {
          currentPanel: panelNum,
          subStage: 'api_call'
        });

        const output = await replicate.run(model, {
          input: {
            prompt: `${panelPrompt}\n\nStyle: Cinematic, photorealistic, consistent visual style with the reference image.`,
            negative_prompt: "blurry, low quality, distorted, ugly, bad anatomy, extra limbs",
            width: 1024,
            height: 1024,
            num_inference_steps: 30,
            scheduler: "DPMSolverMultistep",
            refine: "expert_ensemble_refiner",
            high_noise_frac: 0.8
          }
        });

        tracker.sendProgress('downloading', `Downloading panel ${panelNum}...`, {
          currentPanel: panelNum,
          subStage: 'downloading'
        });

        // Replicate returns an array of image URLs
        const imageUrl = Array.isArray(output) ? output[0] : output;

        // Download the image and convert to base64
        const base64Image = await downloadAndConvertImage(imageUrl, panelNum);

        panels.push({
          id: `panel-${panelNum}`,
          url: base64Image,
          description: panelPrompt,
          status: 'completed'
        });

        tracker.updatePanelStatus(panelNum, 'completed');
        tracker.sendProgress('generating', `Completed panel ${panelNum} of ${totalPanels}`, {
          currentPanel: panelNum,
          stats: tracker.getPanelStats()
        });

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (panelError) {
        console.error(`Error generating panel ${panelNum}:`, panelError);

        const shouldRetry = tracker.markPanelError(panelNum, panelError);

        if (shouldRetry) {
          tracker.sendProgress('retrying', `Retrying panel ${panelNum} (attempt ${tracker.retryAttempts[panelNum]}/${tracker.maxRetries})...`, {
            currentPanel: panelNum,
            retryAttempt: tracker.retryAttempts[panelNum],
            maxRetries: tracker.maxRetries,
            error: panelError.message
          });

          // Wait before retry
          if (panelError.status === 429 || panelError.message?.includes('rate limit')) {
            await new Promise(resolve => setTimeout(resolve, 60000));
          } else {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
          i--;
          continue;
        }

        // If max retries reached, add a placeholder panel
        panels.push({
          id: `panel-${panelNum}`,
          url: null,
          description: panelPrompt,
          status: 'error',
          error: panelError.message
        });

        tracker.sendProgress('error_panel', `Failed to generate panel ${panelNum} after ${tracker.maxRetries} attempts`, {
          currentPanel: panelNum,
          error: panelError.message,
          stats: tracker.getPanelStats()
        });
      }
    }

    tracker.sendProgress('post_processing', 'Finalizing storyboard...', {
      stage: 'post_processing'
    });

    return {
      provider: 'replicate',
      panels,
      metadata: {
        model: 'stable-diffusion-xl',
        timestamp: new Date().toISOString(),
        stats: tracker.getPanelStats()
      }
    };

  } catch (error) {
    console.error('Replicate generation error:', error);
    throw new Error(`Replicate generation failed: ${error.message}`);
  }
}

// Helper function to parse panel descriptions from the main prompt
function parsePanelDescriptions(prompt) {
  const panels = [];
  const lines = prompt.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Match lines that start with a number followed by a period
    const match = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (match) {
      const panelNumber = parseInt(match[1]);
      const description = match[2];
      panels[panelNumber - 1] = description; // 0-indexed
    }
  }

  // Filter out any undefined entries and return
  return panels.filter(p => p !== undefined);
}

// Helper function to download an image and convert to base64
async function downloadAndConvertImage(imageUrl, panelNum) {
  return new Promise((resolve, reject) => {
    try {
      // Handle both data URLs and HTTP URLs
      if (imageUrl.startsWith('data:')) {
        resolve(imageUrl);
        return;
      }

      https.get(imageUrl, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirects
          downloadAndConvertImage(response.headers.location, panelNum)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: HTTP ${response.statusCode}`));
          return;
        }

        const chunks = [];
        response.on('data', (chunk) => {
          chunks.push(chunk);
        });

        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const base64Data = buffer.toString('base64');
          const mimeType = response.headers['content-type'] || 'image/png';
          resolve(`data:${mimeType};base64,${base64Data}`);
        });

        response.on('error', (error) => {
          reject(new Error(`Error downloading image: ${error.message}`));
        });
      }).on('error', (error) => {
        reject(new Error(`HTTP request failed: ${error.message}`));
      });
    } catch (error) {
      reject(new Error(`Download failed: ${error.message}`));
    }
  });
}

/**
 * Download image from URL with timeout and retry logic
 */
async function downloadImageWithTimeout(imageUrl, filename) {
  return await withTimeout(
    () => downloadImage(imageUrl, filename),
    30000, // 30 second timeout
    'Image download'
  );
}

/**
 * Download image from URL
 */
async function downloadImage(imageUrl, filename) {
  return new Promise((resolve, reject) => {
    const userDataPath = app.getPath('userData');
    const downloadPath = path.join(userDataPath, 'downloads');

    // Ensure downloads directory exists
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }

    const filePath = path.join(downloadPath, filename);
    const file = fs.createWriteStream(filePath);

    https.get(imageUrl, (response) => {
      if (response.statusCode === 404) {
        reject(new Error(`Image not found at ${imageUrl}`));
        return;
      }

      if (response.statusCode >= 400) {
        reject(new Error(`HTTP ${response.statusCode} while downloading image`));
        return;
      }

      if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirects
        downloadImage(response.headers.location, filename)
          .then(resolve)
          .catch(reject);
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve(filePath);
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {}); // Delete the file on error
      reject(err);
    });
  });
}

/**
 * Download and convert image to base64 with retry logic
 */
async function downloadAndConvertImageWithRetry(imageUrl, panelNum) {
  return await withRetry(
    () => downloadAndConvertImage(imageUrl, panelNum),
    {
      context: { operation: 'download-convert-image', panelNum },
      maxAttempts: 2 // Fewer retries for image downloads
    }
  );
}

/**
 * Generate storyboard panels using HuggingFace models
 * Supports both text-to-image and image-to-image with custom models
 */
async function generateWithHuggingFace(imageUrl, prompt, settings, apiKey, tracker) {
  if (!apiKey) {
    throw new Error('HuggingFace API key is required');
  }

  const hf = new HfInference(apiKey);

  // Get model from settings - default to Stable Diffusion XL if not specified
  const model = settings.model || 'stabilityai/stable-diffusion-xl-base-1.0';
  const modelType = settings.modelType || 'text_to_image'; // text_to_image or image_to_image

  tracker.sendProgress('api_setup', `Setting up HuggingFace ${model}...`, {
    provider: 'huggingface',
    model,
    modelType
  });

  try {
    // Parse the panel descriptions from the prompt
    const panelDescriptions = parsePanelDescriptions(prompt);
    const totalPanels = panelDescriptions.length || tracker.totalPanels;

    // Initialize all panels as pending
    for (let i = 1; i <= totalPanels; i++) {
      tracker.updatePanelStatus(i, 'pending');
    }

    tracker.sendProgress('preparing', `Preparing to generate ${totalPanels} panels with HuggingFace...`, {
      totalPanels,
      stats: tracker.getPanelStats()
    });

    const panels = [];

    for (let i = 0; i < totalPanels; i++) {
      const panelNum = i + 1;

      tracker.updatePanelStatus(panelNum, 'generating');
      tracker.sendProgress('generating', `Generating panel ${panelNum} of ${totalPanels} with HuggingFace...`, {
        currentPanel: panelNum,
        stats: tracker.getPanelStats()
      });

      const panelPrompt = panelDescriptions[i] || `Panel ${panelNum} of the storyboard`;

      console.log(`[Panel ${panelNum}] Starting generation...`);
      console.log(`[Panel ${panelNum}] Model: ${model}`);
      console.log(`[Panel ${panelNum}] Model type: ${modelType}`);

      try {
        tracker.sendProgress('api_call', `Calling HuggingFace API for panel ${panelNum}...`, {
          currentPanel: panelNum,
          subStage: 'api_call'
        });

        let imageUrlResult;

        // Check if user wants image-to-image mode
        if (modelType === 'image_to_image') {
          // Image-to-image generation
          tracker.sendProgress('api_call', `Using image-to-image mode with ${model}...`, {
            currentPanel: panelNum,
            subStage: 'image_to_image'
          });

          // The reference image is already a data URL from the frontend
          // Convert it to Buffer directly for the API
          let referenceImageBuffer;

          if (imageUrl.startsWith('data:')) {
            console.log(`[Panel ${panelNum}] Converting data URL to Buffer...`);
            // Extract the base64 part
            const base64Data = imageUrl.split(',')[1];
            referenceImageBuffer = Buffer.from(base64Data, 'base64');
            console.log(`[Panel ${panelNum}] ✓ Converted to Buffer, length:`, referenceImageBuffer.length);
          } else {
            // Fallback to downloading (shouldn't happen but just in case)
            console.log(`[Panel ${panelNum}] Downloading image from URL...`);
            referenceImageBuffer = await downloadImageAsBuffer(imageUrl);
          }

          // Use image-to-image endpoint
          // Note: Only specific models support this on the free Inference API
          try {
            imageUrlResult = await hf.imageToImage({
              model: model,
              inputs: {
                image: referenceImageBuffer,
                prompt: `${panelPrompt}\n\nStyle: Cinematic, photorealistic.`,
                parameters: {
                  negative_prompt: settings.negative_prompt || "blurry, low quality, distorted, ugly, bad anatomy, extra limbs",
                  strength: settings.strength || 0.7,
                  guidance_scale: settings.guidance_scale || 7.5
                }
              }
            });
          } catch (img2imgError) {
            // If image-to-image fails, fall back to text-to-image with a note
            tracker.sendProgress('api_call', `Image-to-image not supported for ${model}, falling back to text-to-image...`, {
              currentPanel: panelNum,
              subStage: 'fallback'
            });

            imageUrlResult = await hf.textToImage({
              model: model,
              inputs: `${panelPrompt}\n\nStyle: Cinematic, photorealistic, based on the reference image.`,
              parameters: {
                negative_prompt: settings.negative_prompt || "blurry, low quality, distorted, ugly, bad anatomy, extra limbs",
                width: settings.width || 1024,
                height: settings.height || 1024,
                num_inference_steps: settings.num_inference_steps || 30,
                guidance_scale: settings.guidance_scale || 7.5
              }
            });
          }
        } else {
          // Standard text-to-image generation
          tracker.sendProgress('api_call', `Using text-to-image mode with ${model}...`, {
            currentPanel: panelNum,
            subStage: 'text_to_image'
          });

          imageUrlResult = await hf.textToImage({
            model: model,
            inputs: `${panelPrompt}\n\nStyle: Cinematic, photorealistic, consistent visual style with the reference image.`,
            parameters: {
              negative_prompt: settings.negative_prompt || "blurry, low quality, distorted, ugly, bad anatomy, extra limbs",
              width: settings.width || 1024,
              height: settings.height || 1024,
              num_inference_steps: settings.num_inference_steps || 30,
              guidance_scale: settings.guidance_scale || 7.5,
              // For models that support seed
              seed: settings.seed ? parseInt(settings.seed) + i : undefined
            }
          });
        }

        tracker.sendProgress('downloading', `Downloading panel ${panelNum}...`, {
          currentPanel: panelNum,
          subStage: 'downloading'
        });

        // DEBUG: Log the result type and size
        console.log(`[Panel ${panelNum}] Result type:`, imageUrlResult?.constructor?.name);
        console.log(`[Panel ${panelNum}] Result length:`, imageUrlResult?.length);
        console.log(`[Panel ${panelNum}] Is Buffer?:`, Buffer.isBuffer(imageUrlResult));
        console.log(`[Panel ${panelNum}] Is Blob?:`, imageUrlResult instanceof Blob);
        console.log(`[Panel ${panelNum}] Is Uint8Array?:`, imageUrlResult instanceof Uint8Array);

        // Convert to base64 data URL
        // HuggingFace API can return Buffer, Uint8Array, or Blob
        let base64Data, dataUrl;

        try {
          if (Buffer.isBuffer(imageUrlResult)) {
            base64Data = imageUrlResult.toString('base64');
          } else if (imageUrlResult instanceof Uint8Array) {
            base64Data = Buffer.from(imageUrlResult).toString('base64');
          } else if (imageUrlResult instanceof Blob) {
            // Handle Blob - need to convert to ArrayBuffer first
            const arrayBuffer = await imageUrlResult.arrayBuffer();
            base64Data = Buffer.from(arrayBuffer).toString('base64');
          } else if (typeof imageUrlResult === 'string') {
            // Might already be base64 or a data URL
            if (imageUrlResult.startsWith('data:')) {
              dataUrl = imageUrlResult;
              base64Data = imageUrlResult.split(',')[1];
            } else {
              base64Data = imageUrlResult;
            }
          } else {
            throw new Error(`Unexpected result type: ${typeof imageUrlResult}, constructor: ${imageUrlResult?.constructor?.name}`);
          }

          if (!dataUrl) {
            dataUrl = `data:image/png;base64,${base64Data}`;
          }

          console.log(`[Panel ${panelNum}] Base64 length:`, base64Data.length);
          console.log(`[Panel ${panelNum}] Data URL prefix:`, dataUrl.substring(0, 100));
        } catch (conversionError) {
          console.error(`[Panel ${panelNum}] Conversion error:`, conversionError);
          throw new Error(`Failed to convert image result: ${conversionError.message}`);
        }

        tracker.updatePanelStatus(panelNum, 'completed');
        tracker.sendProgress('processing', `Completed panel ${panelNum}`, {
          currentPanel: panelNum,
          stats: tracker.getPanelStats()
        });

        panels.push({
          id: `panel-${panelNum}`,
          url: dataUrl,
          description: panelPrompt
        });

        console.log(`[Panel ${panelNum}] ✓ Panel added to array`);

      } catch (panelError) {
        console.error(`[Panel ${panelNum}] ERROR in main try block:`, panelError.message);
        console.error(`[Panel ${panelNum}] Error stack:`, panelError.stack);

        // Categorize the error properly for user-friendly messages
        const errorMessage = panelError.message?.toLowerCase() || '';
        if (errorMessage.includes('does not have sufficient permissions') ||
            errorMessage.includes('inference providers on behalf of')) {
          panelError.category = ErrorCategories.API;
        } else if (errorMessage.includes('no inference provider available')) {
          panelError.category = ErrorCategories.API;
        } else if (panelError.name === 'ProviderApiError' || panelError.name === 'InputError') {
          panelError.category = ErrorCategories.API;
        }

        tracker.updatePanelStatus(panelNum, 'error', panelError.message);

        // Use exponential backoff with max 3 retries
        const maxRetries = settings.maxRetries || 3;
        let attempt = 1;

        while (attempt <= maxRetries) {
          try {
            tracker.sendProgress('retrying', `Retrying panel ${panelNum} (attempt ${attempt}/${maxRetries})...`, {
              currentPanel: panelNum,
              retryAttempt: attempt,
              maxRetries: maxRetries
            });

            await new Promise(resolve => setTimeout(resolve, RetryConfig.initialDelay * attempt));

            let imageUrlResult;

            if (modelType === 'image_to_image') {
              try {
                let referenceImageBuffer;

                if (imageUrl.startsWith('data:')) {
                  const base64Data = imageUrl.split(',')[1];
                  referenceImageBuffer = Buffer.from(base64Data, 'base64');
                } else {
                  referenceImageBuffer = await downloadImageAsBuffer(imageUrl);
                }

                imageUrlResult = await hf.imageToImage({
                  model: model,
                  inputs: {
                    image: referenceImageBuffer,
                    prompt: `${panelPrompt}\n\nStyle: Cinematic, photorealistic.`,
                    parameters: {
                      negative_prompt: settings.negative_prompt || "blurry, low quality, distorted",
                      strength: settings.strength || 0.7,
                      guidance_scale: settings.guidance_scale || 7.5
                    }
                  }
                });
              } catch (img2imgError) {
                // Fallback to text-to-image on retry too
                imageUrlResult = await hf.textToImage({
                  model: model,
                  inputs: `${panelPrompt}\n\nStyle: Cinematic, photorealistic.`,
                  parameters: {
                    negative_prompt: settings.negative_prompt || "blurry, low quality, distorted",
                    width: settings.width || 1024,
                    height: settings.height || 1024,
                    num_inference_steps: settings.num_inference_steps || 30,
                    guidance_scale: settings.guidance_scale || 7.5
                  }
                });
              }
            } else {
              // Standard text-to-image for retry
              imageUrlResult = await hf.textToImage({
                model: model,
                inputs: `${panelPrompt}\n\nStyle: Cinematic, photorealistic.`,
                parameters: {
                  negative_prompt: settings.negative_prompt || "blurry, low quality, distorted",
                  width: settings.width || 1024,
                  height: settings.height || 1024,
                  num_inference_steps: settings.num_inference_steps || 30,
                  guidance_scale: settings.guidance_scale || 7.5
                }
              });
            }

            // Convert result to base64 data URL (same logic as main try block)
            let base64Data, dataUrl;

            try {
              console.log(`[Panel ${panelNum} RETRY] Result type:`, imageUrlResult?.constructor?.name);
              console.log(`[Panel ${panelNum} RETRY] Result length:`, imageUrlResult?.length);

              if (Buffer.isBuffer(imageUrlResult)) {
                base64Data = imageUrlResult.toString('base64');
              } else if (imageUrlResult instanceof Uint8Array) {
                base64Data = Buffer.from(imageUrlResult).toString('base64');
              } else if (imageUrlResult instanceof Blob) {
                const arrayBuffer = await imageUrlResult.arrayBuffer();
                base64Data = Buffer.from(arrayBuffer).toString('base64');
              } else if (typeof imageUrlResult === 'string') {
                if (imageUrlResult.startsWith('data:')) {
                  dataUrl = imageUrlResult;
                  base64Data = imageUrlResult.split(',')[1];
                } else {
                  base64Data = imageUrlResult;
                }
              } else {
                throw new Error(`Unexpected result type: ${typeof imageUrlResult}, constructor: ${imageUrlResult?.constructor?.name}`);
              }

              if (!dataUrl) {
                dataUrl = `data:image/png;base64,${base64Data}`;
              }

              console.log(`[Panel ${panelNum} RETRY] Base64 length:`, base64Data.length);
              console.log(`[Panel ${panelNum} RETRY] ✓ Conversion successful`);
            } catch (conversionError) {
              console.error(`[Panel ${panelNum} RETRY] Conversion error:`, conversionError);
              throw new Error(`Failed to convert image result: ${conversionError.message}`);
            }

            tracker.updatePanelStatus(panelNum, 'completed');

            panels.push({
              id: `panel-${panelNum}`,
              url: dataUrl,
              description: panelPrompt
            });

            console.log(`[Panel ${panelNum} RETRY] ✓ Panel added to array`);

            break;
          } catch (retryError) {
            attempt++;

            // Categorize the error properly
            const errorMessage = retryError.message?.toLowerCase() || '';
            if (errorMessage.includes('does not have sufficient permissions') ||
                errorMessage.includes('inference providers on behalf of')) {
              retryError.category = ErrorCategories.API;
            } else if (errorMessage.includes('no inference provider available')) {
              retryError.category = ErrorCategories.API;
            } else if (retryError.name === 'ProviderApiError' || retryError.name === 'InputError') {
              retryError.category = ErrorCategories.API;
            }

            if (attempt > maxRetries) {
              tracker.updatePanelStatus(panelNum, 'error', retryError.message);
              logError(retryError, retryError.category || ErrorCategories.API, 'medium', {
                panelNum,
                model,
                totalAttempts: attempt
              });
              panels.push({
                id: `panel-${panelNum}`,
                url: null,
                description: panelPrompt
              });
            }
          }
        }
      }
    }

    tracker.sendProgress('post_processing', 'Finalizing panels...', {
      stats: tracker.getPanelStats()
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    // DEBUG: Log what we're returning
    console.log('[HuggingFace] Returning', panels.length, 'panels');
    console.log('[HuggingFace] Panel structure:', panels.map(p => ({
      id: p?.id,
      hasUrl: !!p?.url,
      urlLength: p?.url?.length,
      urlPrefix: p?.url?.substring(0, 50)
    })));

    return {
      provider: 'huggingface',
      panels,
      metadata: {
        model,
        modelType,
        timestamp: new Date().toISOString(),
        stats: tracker.getPanelStats()
      }
    };

  } catch (error) {
    logError(error, error.category || ErrorCategories.API, 'medium', {
      provider: 'huggingface',
      model,
      promptLength: prompt?.length,
      totalPanels
    });

    throw error;
  }
}

/**
 * Helper function to download image as buffer for image-to-image models
 */
async function downloadImageAsBuffer(imageUrl) {
  return new Promise((resolve, reject) => {
    https.get(imageUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
  });
}

/**
 * Generate storyboard panels using Automatic1111 Stable Diffusion WebUI
 * Local provider - runs on user's machine
 */
async function generateWithAutomatic1111(imageUrl, prompt, settings, serverUrl, tracker) {
  tracker.sendProgress('api_setup', `Connecting to Automatic1111 at ${serverUrl}...`, {
    provider: 'automatic1111',
    serverUrl
  });

  try {
    // Parse the panel descriptions from the prompt
    const panelDescriptions = parsePanelDescriptions(prompt);
    const totalPanels = panelDescriptions.length || tracker.totalPanels;

    // Initialize all panels as pending
    for (let i = 1; i <= totalPanels; i++) {
      tracker.updatePanelStatus(i, 'pending');
    }

    tracker.sendProgress('preparing', `Preparing to generate ${totalPanels} panels with Automatic1111...`, {
      totalPanels,
      stats: tracker.getPanelStats()
    });

    const panels = [];

    // Get available models from Automatic1111
    let modelsResponse;
    try {
      modelsResponse = await axios.get(`${serverUrl}/sdapi/v1/sd-models`, {
        timeout: 5000
      });
    } catch (error) {
      throw new Error(`Failed to connect to Automatic1111 at ${serverUrl}. Make sure SD WebUI is running with --api flag.`);
    }

    const selectedModel = settings.model || (modelsResponse.data[0]?.title);

    for (let i = 0; i < totalPanels; i++) {
      const panelNum = i + 1;

      tracker.updatePanelStatus(panelNum, 'generating');
      tracker.sendProgress('generating', `Generating panel ${panelNum} of ${totalPanels} with Automatic1111...`, {
        currentPanel: panelNum,
        stats: tracker.getPanelStats()
      });

      const panelPrompt = panelDescriptions[i] || `Panel ${panelNum} of the storyboard`;

      try {
        tracker.sendProgress('api_call', `Calling Automatic1111 API for panel ${panelNum}...`, {
          currentPanel: panelNum,
          subStage: 'api_call'
        });

        // Automatic1111 txt2img API payload
        const payload = {
          prompt: `${panelPrompt}\n\nStyle: Cinematic, photorealistic, consistent visual style with the reference image.`,
          negative_prompt: settings.negative_prompt || "blurry, low quality, distorted, ugly, bad anatomy, extra limbs, watermark, text",
          width: settings.width || 1024,
          height: settings.height || 1024,
          steps: settings.steps || 30,
          cfg_scale: settings.cfg_scale || 7,
          sampler_name: settings.sampler || 'DPM++ 2M Karras',
          seed: settings.seed ? parseInt(settings.seed) + i : -1,
          override_settings: {
            sd_model_checkpoint: selectedModel
          }
        };

        const response = await axios.post(`${serverUrl}/sdapi/v1/txt2img`, payload, {
          timeout: 120000, // 2 minute timeout per panel
          responseType: 'arraybuffer'
        });

        // Automatic1111 returns base64 encoded image
        const base64Image = Buffer.from(response.data, 'binary').toString('base64');
        const dataUrl = `data:image/png;base64,${base64Image}`;

        tracker.updatePanelStatus(panelNum, 'completed');
        tracker.sendProgress('processing', `Completed panel ${panelNum}`, {
          currentPanel: panelNum,
          stats: tracker.getPanelStats()
        });

        panels.push({
          id: `panel-${panelNum}`,
          url: dataUrl,
          description: panelPrompt
        });

      } catch (panelError) {
        tracker.updatePanelStatus(panelNum, 'error', panelError.message);

        const maxRetries = settings.maxRetries || 3;
        let attempt = 1;

        while (attempt <= maxRetries) {
          try {
            tracker.sendProgress('retrying', `Retrying panel ${panelNum} (attempt ${attempt}/${maxRetries})...`, {
              currentPanel: panelNum,
              retryAttempt: attempt,
              maxRetries: maxRetries
            });

            await new Promise(resolve => setTimeout(resolve, RetryConfig.initialDelay * attempt));

            const payload = {
              prompt: `${panelPrompt}\n\nStyle: Cinematic, photorealistic.`,
              negative_prompt: settings.negative_prompt || "blurry, low quality, distorted",
              width: settings.width || 1024,
              height: settings.height || 1024,
              steps: settings.steps || 30,
              cfg_scale: settings.cfg_scale || 7,
              sampler_name: settings.sampler || 'DPM++ 2M Karras',
              seed: -1
            };

            const response = await axios.post(`${serverUrl}/sdapi/v1/txt2img`, payload, {
              timeout: 120000,
              responseType: 'arraybuffer'
            });

            const base64Image = Buffer.from(response.data, 'binary').toString('base64');
            const dataUrl = `data:image/png;base64,${base64Image}`;

            tracker.updatePanelStatus(panelNum, 'completed');

            panels.push({
              id: `panel-${panelNum}`,
              url: dataUrl,
              description: panelPrompt
            });

            break;
          } catch (retryError) {
            attempt++;
            if (attempt > maxRetries) {
              tracker.updatePanelStatus(panelNum, 'error', retryError.message);
              logError(retryError, ErrorCategories.API, 'medium', {
                panelNum,
                serverUrl,
                totalAttempts: attempt
              });
              panels.push({
                id: `panel-${panelNum}`,
                url: null,
                description: panelPrompt
              });
            }
          }
        }
      }
    }

    tracker.sendProgress('post_processing', 'Finalizing panels...', {
      stats: tracker.getPanelStats()
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      provider: 'automatic1111',
      panels,
      metadata: {
        serverUrl,
        model: selectedModel,
        timestamp: new Date().toISOString(),
        stats: tracker.getPanelStats()
      }
    };

  } catch (error) {
    logError(error, error.category || ErrorCategories.API, 'medium', {
      provider: 'automatic1111',
      serverUrl,
      promptLength: prompt?.length,
      totalPanels
    });

    throw error;
  }
}

/**
 * Generate storyboard panels using ComfyUI
 * Local provider - runs on user's machine
 */
async function generateWithComfyUI(imageUrl, prompt, settings, serverUrl, tracker) {
  tracker.sendProgress('api_setup', `Connecting to ComfyUI at ${serverUrl}...`, {
    provider: 'comfyui',
    serverUrl
  });

  try {
    // Parse the panel descriptions from the prompt
    const panelDescriptions = parsePanelDescriptions(prompt);
    const totalPanels = panelDescriptions.length || tracker.totalPanels;

    // Initialize all panels as pending
    for (let i = 1; i <= totalPanels; i++) {
      tracker.updatePanelStatus(i, 'pending');
    }

    tracker.sendProgress('preparing', `Preparing to generate ${totalPanels} panels with ComfyUI...`, {
      totalPanels,
      stats: tracker.getPanelStats()
    });

    // Check ComfyUI is available
    try {
      await axios.get(`${serverUrl}/system_stats`, { timeout: 5000 });
    } catch (error) {
      throw new Error(`Failed to connect to ComfyUI at ${serverUrl}. Make sure ComfyUI is running.`);
    }

    // Get the default workflow for text-to-image
    // This is a basic ComfyUI workflow for SDXL
    const comfyWorkflow = {
      "3": {
        "inputs": {
          "seed": settings.seed || 0,
          "steps": settings.steps || 30,
          "cfg": settings.cfg_scale || 7,
          "sampler_name": settings.sampler || "dpmpp_2m",
          "scheduler": settings.scheduler || "karras",
          "denoise": settings.denoise || 1,
          "model": ["4", 0],
          "positive": ["6", 0],
          "negative": ["7", 0],
          "latent_image": ["5", 0]
        },
        "class_type": "KSampler"
      },
      "4": {
        "inputs": {
          "ckpt_name": settings.model || "sd_xl_base_1.0.safetensors"
        },
        "class_type": "CheckpointLoaderSimple"
      },
      "5": {
        "inputs": {
          "width": settings.width || 1024,
          "height": settings.height || 1024,
          "batch_size": 1
        },
        "class_type": "EmptyLatentImage"
      },
      "6": {
        "inputs": {
          "text": "",
          "clip": ["4", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      "7": {
        "inputs": {
          "text": settings.negative_prompt || "blurry, low quality, distorted, ugly, bad anatomy",
          "clip": ["4", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      "8": {
        "inputs": {
          "samples": ["3", 0],
          "vae": ["4", 2]
        },
        "class_type": "VAEDecode"
      },
      "9": {
        "inputs": {
          "filename_prefix": "storyboard",
          "images": ["8", 0]
        },
        "class_type": "SaveImage"
      }
    };

    const panels = [];

    for (let i = 0; i < totalPanels; i++) {
      const panelNum = i + 1;

      tracker.updatePanelStatus(panelNum, 'generating');
      tracker.sendProgress('generating', `Generating panel ${panelNum} of ${totalPanels} with ComfyUI...`, {
        currentPanel: panelNum,
        stats: tracker.getPanelStats()
      });

      const panelPrompt = panelDescriptions[i] || `Panel ${panelNum} of the storyboard`;

      try {
        tracker.sendProgress('api_call', `Calling ComfyUI API for panel ${panelNum}...`, {
          currentPanel: panelNum,
          subStage: 'api_call'
        });

        // Update prompt in workflow
        comfyWorkflow["6"].inputs.text = `${panelPrompt}\n\nStyle: Cinematic, photorealistic, consistent visual style.`;

        // Submit to ComfyUI
        const response = await axios.post(`${serverUrl}/prompt`, {
          prompt: comfyWorkflow,
          client_id: `storyboard-${Date.now()}-${i}`
        }, {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const promptId = response.data.prompt_id;

        // Poll for completion
        let imageUrlResult = null;
        let attempts = 0;
        const maxAttempts = 120; // 2 minutes max wait

        while (attempts < maxAttempts && !imageUrlResult) {
          await new Promise(resolve => setTimeout(resolve, 1000));

          try {
            const historyResponse = await axios.get(`${serverUrl}/history/${promptId}`);
            const history = historyResponse.data[promptId];

            if (history && history.outputs) {
              // Find the output image from SaveImage node
              for (const nodeId in history.outputs) {
                if (history.outputs[nodeId].images && history.outputs[nodeId].images.length > 0) {
                  const imageInfo = history.outputs[nodeId].images[0];
                  // Get the image
                  const imageResponse = await axios.get(`${serverUrl}/view?filename=${imageInfo.filename}&subfolder=${imageInfo.subfolder || ''}&type=${imageInfo.type}`, {
                    responseType: 'arraybuffer'
                  });
                  const base64Image = Buffer.from(imageResponse.data, 'binary').toString('base64');
                  imageUrlResult = `data:image/png;base64,${base64Image}`;
                  break;
                }
              }
            }
          } catch (pollError) {
            // Continue polling
          }

          attempts++;
        }

        if (!imageUrlResult) {
          throw new Error('ComfyUI generation timed out');
        }

        tracker.updatePanelStatus(panelNum, 'completed');
        tracker.sendProgress('processing', `Completed panel ${panelNum}`, {
          currentPanel: panelNum,
          stats: tracker.getPanelStats()
        });

        panels.push({
          id: `panel-${panelNum}`,
          url: imageUrlResult,
          description: panelPrompt
        });

      } catch (panelError) {
        tracker.updatePanelStatus(panelNum, 'error', panelError.message);

        const maxRetries = settings.maxRetries || 3;
        let attempt = 1;

        while (attempt <= maxRetries) {
          try {
            tracker.sendProgress('retrying', `Retrying panel ${panelNum} (attempt ${attempt}/${maxRetries})...`, {
              currentPanel: panelNum,
              retryAttempt: attempt,
              maxRetries: maxRetries
            });

            await new Promise(resolve => setTimeout(resolve, RetryConfig.initialDelay * attempt));

            // Retry with simplified workflow
            const retryWorkflow = JSON.parse(JSON.stringify(comfyWorkflow));
            retryWorkflow["6"].inputs.text = `${panelPrompt}\n\nStyle: Cinematic, photorealistic.`;

            const response = await axios.post(`${serverUrl}/prompt`, {
              prompt: retryWorkflow,
              client_id: `storyboard-retry-${Date.now()}-${i}`
            }, {
              timeout: 30000
            });

            const promptId = response.data.prompt_id;

            // Poll for completion
            let imageUrlResult = null;
            let attempts = 0;

            while (attempts < 120 && !imageUrlResult) {
              await new Promise(resolve => setTimeout(resolve, 1000));

              try {
                const historyResponse = await axios.get(`${serverUrl}/history/${promptId}`);
                const history = historyResponse.data[promptId];

                if (history && history.outputs) {
                  for (const nodeId in history.outputs) {
                    if (history.outputs[nodeId].images && history.outputs[nodeId].images.length > 0) {
                      const imageInfo = history.outputs[nodeId].images[0];
                      const imageResponse = await axios.get(`${serverUrl}/view?filename=${imageInfo.filename}&subfolder=${imageInfo.subfolder || ''}&type=${imageInfo.type}`, {
                        responseType: 'arraybuffer'
                      });
                      const base64Image = Buffer.from(imageResponse.data, 'binary').toString('base64');
                      imageUrlResult = `data:image/png;base64,${base64Image}`;
                      break;
                    }
                  }
                }
              } catch (pollError) {
                // Continue polling
              }

              attempts++;
            }

            if (!imageUrlResult) {
              throw new Error('ComfyUI generation timed out');
            }

            tracker.updatePanelStatus(panelNum, 'completed');

            panels.push({
              id: `panel-${panelNum}`,
              url: imageUrlResult,
              description: panelPrompt
            });

            break;
          } catch (retryError) {
            attempt++;
            if (attempt > maxRetries) {
              tracker.updatePanelStatus(panelNum, 'error', retryError.message);
              logError(retryError, ErrorCategories.API, 'medium', {
                panelNum,
                serverUrl,
                totalAttempts: attempt
              });
              panels.push({
                id: `panel-${panelNum}`,
                url: null,
                description: panelPrompt
              });
            }
          }
        }
      }
    }

    tracker.sendProgress('post_processing', 'Finalizing panels...', {
      stats: tracker.getPanelStats()
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      provider: 'comfyui',
      panels,
      metadata: {
        serverUrl,
        model: settings.model || 'sd_xl_base_1.0.safetensors',
        timestamp: new Date().toISOString(),
        stats: tracker.getPanelStats()
      }
    };

  } catch (error) {
    logError(error, error.category || ErrorCategories.API, 'medium', {
      provider: 'comfyui',
      serverUrl,
      promptLength: prompt?.length,
      totalPanels
    });

    throw error;
  }
}

/**
 * Generate storyboard panels using Modal.com
 * Calls a deployed Modal function that runs Qwen Image Edit or other image generation models
 * Processes panels in parallel with configurable concurrency (default: 10 for 10 GPUs)
 */
async function generateWithModal(imageUrl, prompt, settings, apiToken, tracker) {
  if (!apiToken) {
    throw new Error('Modal API token is required');
  }

  // Configurable concurrency - change this to match your Modal GPU count
  const MODAL_CONCURRENCY = settings.modalConcurrency || 10;

  // Get Modal function URL from settings or store
  let modalFunctionUrl = settings.modalFunctionUrl;
  if (!modalFunctionUrl) {
    try {
      // Try to get from store
      const Store = require('electron-store');
      const store = new Store();
      modalFunctionUrl = store.get('modalUrl', 'https://andrej-galad--film-generator-image-edit-qwenimageeditgen-94d79a.modal.run/');
    } catch (error) {
      // Fallback to default
      modalFunctionUrl = 'https://andrej-galad--film-generator-image-edit-qwenimageeditgen-94d79a.modal.run/';
    }
  }

  tracker.sendProgress('api_setup', `Connecting to Modal Qwen function at ${modalFunctionUrl}...`, {
    provider: 'modal',
    functionUrl: modalFunctionUrl,
    concurrency: MODAL_CONCURRENCY
  });

  try {
    // Parse the panel descriptions from the prompt
    const panelDescriptions = parsePanelDescriptions(prompt);
    const totalPanels = panelDescriptions.length || tracker.totalPanels;

    // Initialize all panels as pending
    for (let i = 1; i <= totalPanels; i++) {
      tracker.updatePanelStatus(i, 'pending');
    }

    tracker.sendProgress('preparing', `Preparing to generate ${totalPanels} panels with Modal Qwen (concurrency: ${MODAL_CONCURRENCY})...`, {
      totalPanels,
      concurrency: MODAL_CONCURRENCY,
      stats: tracker.getPanelStats()
    });

    // Modal Qwen requires a reference image (image-to-image model)
    if (!imageUrl || !imageUrl.startsWith('data:')) {
      throw new Error('Modal Qwen-Image-Edit requires a reference image for character consistency. Please upload a reference image in the storyboard settings before generating with Modal.');
    }

    // Helper function to generate a single panel
    const generateSinglePanel = async (panelNum, panelPrompt, attempt = 1) => {
      tracker.updatePanelStatus(panelNum, 'generating');
      tracker.sendProgress('generating', `Generating panel ${panelNum} of ${totalPanels} with Modal Qwen...`, {
        currentPanel: panelNum,
        stats: tracker.getPanelStats()
      });

      console.log(`[Panel ${panelNum}] Starting generation with Modal Qwen (attempt ${attempt})...`);

      try {
        // Prepare reference image
        const referenceImages = [imageUrl];
        console.log(`[Panel ${panelNum}] Using reference image for character consistency`);

      // Determine aspect ratio dimensions
      const aspectRatio = settings.aspectRatio || '16:9';
      let width = 1024;
      let height = 1024;

      const aspectRatios = {
        '1:1': [1328, 1328],
        '16:9': [1664, 928],
        '9:16': [928, 1664],
        '4:3': [1472, 1140],
        '3:4': [1140, 1472],
        '3:2': [1584, 1056],
        '2:3': [1056, 1584],
      };

      if (aspectRatios[aspectRatio]) {
        [width, height] = aspectRatios[aspectRatio];
      }

      // Call Modal Qwen function via HTTP
      tracker.sendProgress('api_call', `Calling Modal Qwen function for panel ${panelNum}...`, {
        currentPanel: panelNum,
        subStage: 'api_call'
      });

      const response = await axios.post(
        modalFunctionUrl,
        {
          prompt: panelPrompt,
          reference_images: referenceImages,
          aspect_ratio: aspectRatio,
          num_inference_steps: settings.num_inference_steps || 40,
          guidance_scale: settings.guidance_scale || 1.0,
          true_cfg_scale: settings.true_cfg_scale || 4.0,
          seed: settings.seed ? parseInt(settings.seed) + panelNum - 1 : Math.floor(Math.random() * 1000000)
        },
        {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 180000 // 3 minute timeout per panel for Qwen
        }
      );

      if (!response.data || !response.data.image) {
        throw new Error('Modal function returned invalid response: ' + JSON.stringify(response.data));
      }

      const imageUrlResult = response.data.image;

      // Verify the result
      if (!imageUrlResult || typeof imageUrlResult !== 'string') {
        throw new Error(`Invalid image result from Modal: ${typeof imageUrlResult}`);
      }

      console.log(`[Panel ${panelNum}] ✓ Image generated successfully, size: ${response.data.width}x${response.data.height}`);

      tracker.updatePanelStatus(panelNum, 'completed');

      return {
        id: `panel-${panelNum}`,
        url: imageUrlResult,
        description: panelPrompt,
        panelNum
      };

      } catch (panelError) {
        console.error(`[Panel ${panelNum}] ERROR:`, panelError.message);

        // Categorize the error
        const errorMessage = panelError.message?.toLowerCase() || '';
        if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
          panelError.category = ErrorCategories.TIMEOUT;
        } else if (errorMessage.includes('network') || errorMessage.includes('econnrefused')) {
          panelError.category = ErrorCategories.NETWORK;
        } else if (panelError.response?.status === 401 || errorMessage.includes('unauthorized')) {
          panelError.category = ErrorCategories.API;
        } else {
          panelError.category = ErrorCategories.API;
        }

        // For Modal, we'll retry up to 3 times
        const maxRetries = settings.maxRetries || 3;

        if (attempt <= maxRetries) {
          tracker.sendProgress('retrying', `Retrying panel ${panelNum} (attempt ${attempt}/${maxRetries})...`, {
            currentPanel: panelNum,
            retryAttempt: attempt,
            maxRetries: maxRetries
          });

          await new Promise(resolve => setTimeout(resolve, 3000 * attempt)); // 3, 6, 9 second backoff

          // Retry the panel generation
          return generateSinglePanel(panelNum, panelPrompt, attempt + 1);
        }

        // Max retries exceeded, return error panel
        tracker.updatePanelStatus(panelNum, 'error', panelError.message);
        logError(panelError, panelError.category || ErrorCategories.API, 'medium', {
          panelNum,
          totalAttempts: attempt
        });

        return {
          id: `panel-${panelNum}`,
          url: null,
          description: panelPrompt,
          panelNum,
          error: panelError.message
        };
      }
    };

    // Process panels in batches for parallel generation
    const panels = [];
    const panelIndices = Array.from({ length: totalPanels }, (_, i) => i);

    // Split into batches and process in parallel
    for (let batchStart = 0; batchStart < panelIndices.length; batchStart += MODAL_CONCURRENCY) {
      const batch = panelIndices.slice(batchStart, batchStart + MODAL_CONCURRENCY);
      const batchNum = Math.floor(batchStart / MODAL_CONCURRENCY) + 1;
      const totalBatches = Math.ceil(panelIndices.length / MODAL_CONCURRENCY);

      console.log(`[Modal] Processing batch ${batchNum}/${totalBatches} (${batch.length} panels)...`);

      tracker.sendProgress('generating', `Processing batch ${batchNum}/${totalBatches} (${batch.length} panels in parallel)...`, {
        batch: batchNum,
        totalBatches,
        batchSize: batch.length,
        stats: tracker.getPanelStats()
      });

      // Generate all panels in this batch in parallel
      const batchResults = await Promise.all(
        batch.map(i => {
          const panelNum = i + 1;
          const panelPrompt = panelDescriptions[i] || `Panel ${panelNum} of the storyboard`;
          return generateSinglePanel(panelNum, panelPrompt);
        })
      );

      // Sort results by panel number and add to panels array
      batchResults.sort((a, b) => a.panelNum - b.panelNum);
      panels.push(...batchResults);

      console.log(`[Modal] Batch ${batchNum} completed, ${panels.length}/${totalPanels} panels done`);
    }

    tracker.sendProgress('post_processing', 'Finalizing panels...', {
      stats: tracker.getPanelStats()
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    console.log(`[Modal] ✓ All ${panels.length} panels generated in parallel with concurrency ${MODAL_CONCURRENCY}`);

    // Generate a unique ID for this generation
    const generationId = uuidv4();

    // Save all panels to disk permanently
    tracker.sendProgress('saving', 'Saving panels to disk...', {
      stats: tracker.getPanelStats()
    });

    const savedPanels = await savePanelsToDisk(panels, generationId);

    console.log(`[Modal] ✓ Saved ${savedPanels.length} panels to disk (generation ID: ${generationId})`);

    // Save generation record to database
    if (db) {
      try {
        const generationsStmt = db.prepare(`
          INSERT INTO generations (id, prompt_id, input_image, output_images, settings, status)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        generationsStmt.run(
          generationId,
          null, // prompt_id
          imageUrl, // input_image (reference image)
          JSON.stringify(savedPanels.map(p => ({ id: p.id, url: p.url, filePath: p.filePath }))), // output_images
          JSON.stringify({ provider: 'modal', model: 'Qwen-Image-Edit-2511', ...settings }), // settings
          'completed'
        );

        console.log(`[Modal] ✓ Generation record saved to database`);
      } catch (dbError) {
        console.error(`[Modal] Failed to save generation record:`, dbError);
        // Don't fail the generation if database save fails
      }
    }

    return {
      provider: 'modal',
      panels: savedPanels,
      metadata: {
        functionUrl: modalFunctionUrl,
        model: 'Qwen-Image-Edit-2511',
        concurrency: MODAL_CONCURRENCY,
        timestamp: new Date().toISOString(),
        stats: tracker.getPanelStats(),
        generationId,
        savedToDisk: true
      }
    };

  } catch (error) {
    logError(error, error.category || ErrorCategories.API, 'medium', {
      provider: 'modal',
      functionUrl: modalFunctionUrl,
      promptLength: prompt?.length,
      totalPanels
    });

    throw error;
  }
}

/**
 * Export panels as video with error handling
 */
async function exportVideoWithTimeout(panels, settings, event) {
  return await withTimeout(
    () => exportVideo(panels, settings, event),
    300000, // 5 minute timeout
    'Video export'
  );
}

/**
 * Export panels as video (placeholder for actual FFmpeg integration)
 */
async function exportVideo(panels, settings, event) {
  // This is a placeholder for actual video export functionality
  // In a real implementation, this would:
  // 1. Use FFmpeg to combine panels into a video
  // 2. Apply transitions and effects
  // 3. Add audio if specified
  // 4. Handle progress updates

  event.sender.send('export-progress', {
    status: 'processing',
    progress: 20,
    message: 'Processing images for video...'
  });

  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 2000));

  event.sender.send('export-progress', {
    status: 'processing',
    progress: 50,
    message: 'Encoding video...'
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  event.sender.send('export-progress', {
    status: 'processing',
    progress: 80,
    message: 'Finalizing video...'
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Return mock result
  return {
    success: true,
    outputPath: path.join(app.getPath('userData'), 'exports', 'storyboard.mp4'),
    duration: 60, // seconds
    resolution: '1920x1080'
  };
}

module.exports = { setupAPIHandlers, setDatabase };