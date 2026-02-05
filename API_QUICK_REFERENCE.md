# API Implementation Quick Reference

## File Locations
- **Main API Handlers**: `/Volumes/DATA/Python/nodetool/StoryboardGen/electron/api-handlers.js`
- **Database Module**: `/Volumes/DATA/Python/nodetool/StoryboardGen/electron/database.js`
- **Main Process**: `/Volumes/DATA/Python/nodetool/StoryboardGen/electron/main.js`
- **Package Config**: `/Volumes/DATA/Python/nodetool/StoryboardGen/package.json`

## API Functions

### 1. OpenAI DALL-E 3
```javascript
// Function: generateWithOpenAI(imageUrl, prompt, settings, apiKey, tracker)
// Model: dall-e-3
// Size: 1024x1024
// Quality: hd
// Cost: ~$0.04 per image

const response = await openai.images.generate({
  model: "dall-e-3",
  prompt: panelPrompt + "\\n\\nStyle: Cinematic, photorealistic...",
  n: 1,
  size: "1024x1024",
  quality: "hd",
  response_format: "url"
});
```

### 2. Google Gemini Imagen 3
```javascript
// Function: generateWithGemini(imageUrl, prompt, settings, apiKey, tracker)
// Model: imagen-3.0-generate-001
// Aspect Ratio: 1:1
// Format: Base64 PNG

const result = await model.generateImage(prompt, {
  numberOfImages: 1,
  aspectRatio: "1:1",
  safetyFilterLevel: "block_some",
  personGeneration: "allow_adult"
});
```

### 3. Replicate Stable Diffusion XL
```javascript
// Function: generateWithReplicate(imageUrl, prompt, settings, apiKey, tracker)
// Model: stability-ai/sdxl
// Size: 1024x1024
// Steps: 30

const output = await replicate.run(model, {
  input: {
    prompt: panelPrompt + "\\n\\nStyle: Cinematic...",
    negative_prompt: "blurry, low quality, distorted...",
    width: 1024,
    height: 1024,
    num_inference_steps: 30,
    scheduler: "DPMSolverMultistep",
    refine: "expert_ensemble_refiner",
    high_noise_frac: 0.8
  }
});
```

## Progress Tracking

### ProgressTracker Class
```javascript
const tracker = new ProgressTracker(event, totalPanels);

// Update progress
tracker.sendProgress('stage', 'Message', {
  additional: 'data'
});

// Update panel status
tracker.updatePanelStatus(panelNum, 'generating');

// Get statistics
const stats = tracker.getPanelStats();
// { total: 20, completed: 5, generating: 1, pending: 14, error: 0 }
```

### Progress Stages
- `initializing` - Setting up generation
- `api_setup` - Configuring API client
- `preparing` - Preparing panel generation
- `generating` - Creating images
- `api_call` - Making API request
- `downloading` - Downloading generated images
- `processing` - Processing API responses
- `post_processing` - Finalizing results
- `completed` - Generation finished
- `error` - Generation failed

## Helper Functions

### parsePanelDescriptions(prompt)
```javascript
// Input: Multi-line prompt with numbered panels
// Output: Array of panel descriptions
const panels = parsePanelDescriptions(prompt);
// ["Panel 1 description", "Panel 2 description", ...]
```

### downloadAndConvertImage(imageUrl, panelNum)
```javascript
// Input: Image URL and panel number
// Output: Base64 data URL
const base64Image = await downloadAndConvertImage(url, panelNum);
// "data:image/png;base64,iVBORw0KGgoAAAANS..."
```

## Database Functions

### Save Generation
```javascript
await window.electron.ipcRenderer.invoke('save-generation', {
  id: generationId,
  prompt_id: promptId,
  input_image: imageDataUrl,
  output_images: panelsArray,
  settings: settingsObject,
  status: 'completed'
});
```

### Get Generations
```javascript
const generations = await window.electron.ipcRenderer.invoke('get-generations', promptId);
```

### Get Single Generation
```javascript
const generation = await window.electron.ipcRenderer.invoke('get-generation', generationId);
```

## IPC Communication

### Invoke Generation
```javascript
const result = await window.electron.ipcRenderer.invoke(
  'generate-storyboard',
  imageUrl,      // Data URL of reference image
  prompt,        // Full prompt text with panel descriptions
  settings       // { provider: 'openai', promptId: '...', panelCount: 20 }
);
```

### Listen to Progress
```javascript
window.electron.ipcRenderer.on('generation-progress', (event, data) => {
  console.log(`${data.progress}%: ${data.message}`);
  console.log(`ETA: ${data.eta}`);
  console.log(`Stats:`, data.stats);
});
```

## Error Handling

### Retry Logic
- Maximum 3 retry attempts per panel
- 60-second delay for rate limits (HTTP 429)
- 3-5 second delay for other errors
- Graceful degradation on final failure

### Error Response Format
```javascript
{
  id: 'panel-5',
  url: null,
  description: 'Panel 5 description',
  status: 'error',
  error: 'Rate limit exceeded'
}
```

## API Key Management

### Store API Keys
```javascript
await window.electron.ipcRenderer.invoke('store-api-keys', {
  openai: 'sk-...',
  gemini: 'AI...',
  replicate: 'r8_...'
});
```

### Retrieve API Keys
```javascript
const keys = await window.electron.ipcRenderer.invoke('get-api-keys');
```

### Check Setup Status
```javascript
const status = await window.electron.ipcRenderer.invoke('check-setup');
// { isSetupComplete: true, hasOpenAI: true, hasGemini: true, hasReplicate: false }
```

## Common Response Format

### Successful Generation
```javascript
{
  provider: 'openai',
  generationId: 'uuid-v4',
  panels: [
    {
      id: 'panel-1',
      url: 'data:image/png;base64,...',
      description: 'Panel 1 description',
      status: 'completed'
    },
    // ... more panels
  ],
  metadata: {
    model: 'dall-e-3',
    timestamp: '2026-02-05T20:00:00.000Z',
    stats: {
      total: 20,
      completed: 20,
      generating: 0,
      pending: 0,
      error: 0
    }
  }
}
```

## Installation

```bash
cd /Volumes/DATA/Python/nodetool/StoryboardGen
npm install --legacy-peer-deps
npm start
```

## Dependencies Added

```json
{
  "openai": "^4.71.0",
  "@google/generative-ai": "^0.21.0",
  "replicate": "^0.32.1"
}
```

## Code Pattern Reference

### Following NodeTool Patterns
This implementation follows the established patterns from the NodeTool project:

1. **HTTP Requests**: Similar to `/Volumes/DATA/Python/nodetool/electron/src/download.ts`
2. **API Key Handling**: Inspired by `/Volumes/DATA/Python/nodetool/electron/src/debug.ts`
3. **Progress Updates**: IPC-based progress communication
4. **Error Handling**: Comprehensive try-catch with retry logic
5. **Database Integration**: SQLite with better-sqlite3

---

**Quick Reference Version**: 1.0.0
**Last Updated**: February 5, 2026