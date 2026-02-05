# Modal.com Qwen Integration for StoryboardGen

## Your Modal Function is Already Deployed! ✅

You already have a Modal function running with **Qwen-Image-Edit-2511**:
- **Function URL**: `https://yerdna1983--film-generator-image-edit.modal.run`
- **Model**: Qwen/Qwen-Image-Edit-2511
- **Status**: Already deployed and ready to use!

## How to Use with StoryboardGen

### 1. Get Your Modal Token

```bash
modal token new
```

This will authenticate you and provide an API token.

### 2. Configure StoryboardGen

1. Open StoryboardGen
2. Click the **Settings** icon (⚙️)
3. Find the **Modal** section
4. Enter your Modal API Token (from step 1)
5. For Modal Function URL, enter: `https://yerdna1983--film-generator-image-edit.modal.run`
6. Click **Save**

### 3. Generate Storyboards

1. Click **Generate**
2. Select **Modal** as the provider
3. Upload a reference image (recommended for Qwen)
4. Configure your settings:
   - **Aspect Ratio**: 16:9, 9:16, 1:1, etc.
   - **Inference Steps**: 30-40 (higher = better quality, slower)
   - **Guidance Scale**: 1.0-5.0 (default: 1.0)
   - **True CFG Scale**: 4.0 (default)
   - **Seed**: Optional, for reproducible results
5. Click **Generate** to create your storyboard

## Qwen Image Edit Features

Qwen-Image-Edit-2511 is excellent for:
- ✅ **Character consistency** - Maintains character identity across panels
- ✅ **Image-to-image** - Uses your reference image as a base
- ✅ **Cinematic quality** - Professional, film-like results
- ✅ **High resolution** - Supports multiple aspect ratios
- ✅ **Fast inference** - Runs on H100 GPU via Modal

## Aspect Ratios

The Qwen function supports these aspect ratios with optimized dimensions:

| Ratio | Width | Height | Best For |
|-------|-------|--------|----------|
| 16:9  | 1664  | 928    | Cinematic, landscape |
| 9:16  | 928   | 1664   | Portrait, mobile |
| 1:1   | 1328  | 1328   | Square, Instagram |
| 4:3   | 1472  | 1140   | Standard video |
| 3:4   | 1140  | 1472   | Portrait video |
| 3:2   | 1584  | 1056   | Classic film |
| 2:3   | 1056  | 1584   | Portrait photo |

## API Request Format

The Qwen function expects:

```json
{
  "prompt": "A cinematic scene description",
  "reference_images": ["data:image/png;base64,..."],
  "aspect_ratio": "16:9",
  "num_inference_steps": 40,
  "guidance_scale": 1.0,
  "true_cfg_scale": 4.0,
  "seed": 42
}
```

**Response:**
```json
{
  "image": "data:image/png;base64,iVBORw0KGg...",
  "width": 1664,
  "height": 928
}
```

## Cost Estimation

Modal charges for GPU time on H100:
- **Approx. $1-2 per hour** of H100 usage
- For 20-panel storyboard: ~10-15 minutes
- **Estimated cost: $0.20 - $0.50 per storyboard**

**Tips to reduce cost:**
- Reduce `num_inference_steps` to 20-25
- Use smaller aspect ratios (1:1 is fastest)
- Generate fewer panels for testing

## Testing Your Modal Function

Test the function directly:

```bash
modal app logs ap-6hAyjCHdZqJez0WeGqjM43
```

## Troubleshooting

### "Invalid function call" Error

Make sure you're using the correct URL format:
- ✅ `https://yerdna1983--film-generator-image-edit.modal.run`
- ❌ `https://yerdna1983--film-generator-image-edit.modal.run/`

### Authentication Error

- Verify your Modal token is current: `modal token whoami`
- Generate a new token: `modal token new`
- Check that the token has proper permissions

### Timeout Errors

- Qwen can take 1-2 minutes per image
- 20 panels may take 20-40 minutes total
- Increase timeout in settings if needed
- Reduce `num_inference_steps` for faster generation

### Function Not Responding

Check if the function is deployed:
```bash
modal app list
```

Look for `film-generator-image-edit` in the list with state `deployed`.

### Redeploying the Function

If you need to redeploy:

```bash
cd /Volumes/DATA/Python/artflowly_film-generator
modal deploy modal/image_edit_generator.py
```

## Advanced: Customizing the Model

Edit the Qwen function at:
```
/Volumes/DATA/Python/artflowly_film-generator/modal/image_edit_generator.py
```

Then redeploy:
```bash
modal deploy modal/image_edit_generator.py
```

## Comparison: Qwen vs Other Models

| Feature | Qwen Image Edit | SDXL | FLUX |
|---------|------------------|-----|------|
| Character Consistency | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Image Quality | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Speed | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Reference Image Support | ✅ Excellent | ⚠️ Limited | ⚠️ Limited |
| Cost | 💸💸 H100 GPU | 💸 Standard | 💸💸💸 High |

**Qwen is perfect for:** Storyboards with consistent characters, cinematic style, and reference image guidance.

## Support

Your Modal function source code:
```
/Volumes/DATA/Python/artflowly_film-generator/modal/image_edit_generator.py
```

Modal documentation:
- https://modal.com/docs
- https://modal.com/docs/guide/concepts/functions
- https://modal.com/docs/guide/concepts/webhooks

StoryboardGen integration:
- See `electron/api-handlers.js` - `generateWithModal()` function
- See `src/components/SetupScreen.tsx` - Modal UI setup
