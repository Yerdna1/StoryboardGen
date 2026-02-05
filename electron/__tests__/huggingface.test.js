const { HfInference } = require('@huggingface/inference');

describe('HuggingFace Text-to-Image', () => {
  const apiKey = process.env.HUGGINGFACE_API_KEY || 'test_key';
  const hf = new HfInference(apiKey);

  test('should generate image with SDXL', async () => {
    const result = await hf.textToImage({
      model: 'stabilityai/stable-diffusion-xl-base-1.0',
      inputs: 'A beautiful landscape',
      parameters: {
        width: 512,
        height: 512,
        num_inference_steps: 10
      }
    });

    // Result should be a Buffer or Uint8Array
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);

    // Check if it can be converted to base64
    const base64 = result.toString('base64');
    expect(base64).toBeTruthy();
    expect(base64.length).toBeGreaterThan(0);

    // Check if data URL format is correct
    const dataUrl = `data:image/png;base64,${base64}`;
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);

    console.log('✓ Image generation successful');
    console.log('✓ Image size:', result.length, 'bytes');
    console.log('✓ Base64 length:', base64.length, 'chars');
    console.log('✓ Data URL prefix:', dataUrl.substring(0, 50) + '...');
  }, 30000);

  test('should verify image-to-image API format', async () => {
    // Test image-to-image format
    const testImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

    const result = await hf.imageToImage({
      model: 'stabilityai/stable-diffusion-xl-base-1.0',
      inputs: {
        image: testImage,
        prompt: 'Transform this image',
        parameters: {
          strength: 0.7
        }
      }
    });

    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
    console.log('✓ Image-to-image successful');
  }, 30000);
});
