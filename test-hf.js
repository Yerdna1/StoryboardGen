#!/usr/bin/env node

/**
 * Standalone test for HuggingFace Text-to-Image API
 * Run with: node test-hf.js <your_api_key>
 */

const { HfInference } = require('@huggingface/inference');

async function testHuggingFace(apiKey) {
  console.log('🧪 Testing HuggingFace Text-to-Image API');
  console.log('=====================================\n');

  const hf = new HfInference(apiKey);

  try {
    console.log('1. Calling textToImage with SDXL...');
    const startTime = Date.now();

    const result = await hf.textToImage({
      model: 'stabilityai/stable-diffusion-xl-base-1.0',
      inputs: 'A cinematic landscape',
      parameters: {
        width: 512,
        height: 512,
        num_inference_steps: 10
      }
    });

    const elapsed = Date.now() - startTime;
    console.log('   ✓ Call completed in', elapsed, 'ms\n');

    console.log('2. Analyzing result...');
    console.log('   - Result type:', result?.constructor?.name);
    console.log('   - Result length:', result?.length, 'bytes');
    console.log('   - Is Buffer?:', Buffer.isBuffer(result));
    console.log('   - Is Uint8Array?:', result instanceof Uint8Array, '\n');

    console.log('3. Converting to base64...');
    let base64Data;

    if (Buffer.isBuffer(result)) {
      base64Data = result.toString('base64');
    } else if (result instanceof Uint8Array) {
      base64Data = Buffer.from(result).toString('base64');
    } else {
      throw new Error(`Unexpected result type: ${typeof result}`);
    }

    console.log('   ✓ Base64 length:', base64Data.length, 'characters\n');

    console.log('4. Creating data URL...');
    const dataUrl = `data:image/png;base64,${base64Data}`;
    console.log('   ✓ Data URL length:', dataUrl.length, 'characters');
    console.log('   ✓ Data URL prefix:', dataUrl.substring(0, 100), '...\n');

    console.log('5. Verifying data URL format...');
    if (dataUrl.startsWith('data:image/png;base64,')) {
      console.log('   ✓ Valid data URL format!\n');
    } else {
      throw new Error('Invalid data URL format');
    }

    console.log('6. Testing if data URL can be displayed...');
    // Write a simple HTML file to test
    const fs = require('fs');
    const html = `
<!DOCTYPE html>
<html>
<head><title>Test Image</title></head>
<body>
  <h1>Generated Image Test</h1>
  <img src="${dataUrl}" style="max-width: 512px; border: 2px solid black;" />
  <p>Image size: ${result.length} bytes</p>
  <p>Base64 size: ${base64Data.length} chars</p>
</body>
</html>
    `;
    fs.writeFileSync('/tmp/test-hf-image.html', html);
    console.log('   ✓ Test HTML written to /tmp/test-hf-image.html');
    console.log('   ✓ Open in browser: file:///tmp/test-hf-image.html\n');

    console.log('✅ ALL TESTS PASSED!');
    console.log('\nYou can use this data URL format in your app.');
    return dataUrl;

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Get API key from command line or environment
const apiKey = process.argv[2] || process.env.HUGGINGFACE_API_KEY;

if (!apiKey) {
  console.error('Usage: node test-hf.js <your_huggingface_api_key>');
  console.error('Or set HUGGINGFACE_API_KEY environment variable');
  process.exit(1);
}

testHuggingFace(apiKey);
