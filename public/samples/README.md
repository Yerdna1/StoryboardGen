# StoryboardGen Samples

This directory contains sample storyboard projects that users can load to explore the app's capabilities.

## Available Samples

### Character Journey
- **File**: `character-journey.json`
- **Panels**: 20
- **Provider**: Modal (Qwen-Image-Edit-2511)
- **Description**: A character's emotional journey from solitude to triumph
- **Requires**: Reference image for character consistency

## Adding New Samples

To add a new sample storyboard:

1. Create a JSON file in this directory
2. Use the following structure:

```json
{
  "name": "Sample Name",
  "description": "Brief description",
  "provider": "modal",
  "model": "Qwen-Image-Edit-2511",
  "createdAt": "2025-02-05",
  "panels": [
    {
      "id": "1",
      "description": "Panel description",
      "aspectRatio": "16:9"
    }
  ],
  "settings": {
    "provider": "modal",
    "aspectRatio": "16:9",
    "numPanels": 20
  },
  "referenceImageRequired": true
}
```

3. Update `PromptsPanel.tsx` to include the new sample in the samples dialog
