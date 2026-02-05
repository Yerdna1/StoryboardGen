# StoryboardGen Samples

This directory contains sample storyboard projects that users can load to explore the app's capabilities.

## Available Samples

### Sample Storyboard (With Images)
- **File**: `sample-storyboard.json`
- **Panels**: 20
- **Images**: `images/panel-1.svg` through `panel-20.svg`
- **Provider**: Modal (Qwen-Image-Edit-2511)
- **Description**: A complete 20-panel storyboard with placeholder images
- **How to Use**: Click the Load Sample button (folder icon) in the Prompts panel

### Character Journey
- **File**: `character-journey.json`
- **Panels**: 20
- **Provider**: Modal (Qwen-Image-Edit-2511)
- **Description**: A character's emotional journey from solitude to triumph
- **Requires**: Reference image for character consistency

## Sample Images

The `images/` folder contains 20 placeholder SVG images:
- Each panel is 1024x576 (16:9 aspect ratio)
- Different colored backgrounds for visual distinction
- Panel number and title displayed on each image
- Scalable vector format for crisp display at any size

## How Samples Work

When you click the **Load Sample** button:
1. The sample JSON is loaded with panel descriptions
2. Sample images are loaded from the `images/` folder
3. All 20 panels are displayed in the storyboard grid
4. The prompt is saved to your prompts list

## Adding New Samples

To add a new sample storyboard with images:

1. Create your panel images and place them in `images/` folder
2. Create a JSON file in this directory:

```json
{
  "name": "Your Sample Name",
  "description": "Brief description",
  "provider": "modal",
  "panels": [
    {
      "id": "1",
      "description": "Panel 1 description",
      "image": "panel-1.svg"
    }
  ],
  "settings": {
    "provider": "modal",
    "aspectRatio": "16:9",
    "numPanels": 20
  }
}
```

3. Update `PromptsPanel.tsx` to reference your new JSON file in `handleLoadSamples()`

## Image Formats

Supported formats for sample images:
- **SVG** (recommended) - Vector format, scalable
- **PNG** - Raster format with transparency
- **JPG** - Compressed raster format
