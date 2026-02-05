# StoryboardGen

An Electron application that generates cinematic storyboard films from a single reference image. Create 20-panel narratives with consistent visual style and evolving story using AI.

## Features

- **Canvas Interface**: Similar to NodeTool's design but focused on storyboard generation
- **Multiple AI Providers**: Support for OpenAI (DALL-E 3), Google Gemini (Imagen 3), and Replicate
- **Prompt Management**: Save and organize your storyboard prompts in a database
- **Visual Consistency**: Maintains style, colors, and elements from reference image across all panels
- **Export Options**: Download individual panels or export as a complete video

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Build the application:
```bash
npm run dist
```

## Usage

1. **Initial Setup**: On first launch, you'll be prompted to enter API keys for at least one provider:
   - OpenAI API Key
   - Google Gemini API Key
   - Replicate API Token

2. **Upload Reference Image**: Click "Upload Reference" to select an image that will serve as the visual basis for your storyboard

3. **Select or Create Prompt**: Use the prompts panel to select the default 20-panel cinematic prompt or create your own

4. **Generate Storyboard**: Click "Generate Storyboard", choose your settings, and watch as the AI creates your 20-panel narrative

5. **Export Results**: View panels in grid or sequential mode, download individual panels, or export as video

## Default Prompt

The application comes with a comprehensive 20-panel cinematic storyboard prompt that creates a sci-fi narrative about a spaceship stranded in a desert, showing its journey across time from landing to complete decay over 500 years.

## Development

### Project Structure
```
StoryboardGen/
├── electron/           # Electron main process files
│   ├── main.js        # Main process entry
│   ├── preload.js     # Preload script
│   ├── database.js    # SQLite database
│   └── api-handlers.js # AI provider integrations
├── src/               # React frontend
│   ├── components/    # UI components
│   ├── App.tsx       # Main app component
│   └── index.tsx     # Entry point
└── public/           # Static assets
```

### Technologies
- Electron for desktop app
- React + TypeScript for UI
- Material-UI for components
- Konva.js for canvas rendering
- Better-SQLite3 for local database
- Electron Store for settings

## Building

### Development
```bash
npm start
```

### Production Build
```bash
npm run electron-build
```

This will create distributable packages in the `dist/` directory.

## License

MIT