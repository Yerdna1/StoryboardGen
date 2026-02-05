#!/usr/bin/env node
/**
 * Generate application icons for all platforms
 * Requires: npm install sharp
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Check if sharp is installed
try {
  require.resolve('sharp');
} catch (e) {
  console.log('Installing sharp for icon generation...');
  execSync('npm install --save-dev sharp', { stdio: 'inherit' });
}

const sharp = require('sharp');

const SOURCE_LOGO = path.join(__dirname, '../public/logo.png');
const BUILD_DIR = path.join(__dirname, '../build');
const BUILD_RESOURCES_DIR = path.join(__dirname, '../build-resources');
const ICONS_DIR = path.join(BUILD_RESOURCES_DIR, 'icons');

// Ensure directories exist
[BUILD_DIR, BUILD_RESOURCES_DIR, ICONS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Icon sizes for different platforms
const ICON_SIZES = {
  // Windows ICO sizes
  windows: [16, 24, 32, 48, 64, 128, 256],
  // macOS iconset sizes
  mac: [16, 32, 64, 128, 256, 512, 1024],
  // Linux PNG sizes
  linux: [16, 24, 32, 48, 64, 128, 256, 512, 1024]
};

async function generateIcons() {
  console.log('🎨 Generating application icons...');

  try {
    // Generate PNG icons for all sizes
    const allSizes = [...new Set([...ICON_SIZES.windows, ...ICON_SIZES.mac, ...ICON_SIZES.linux])];

    for (const size of allSizes) {
      const outputPath = path.join(ICONS_DIR, `${size}x${size}.png`);
      await sharp(SOURCE_LOGO)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      console.log(`✓ Generated ${size}x${size}.png`);
    }

    // Copy main icon to build directory
    await sharp(SOURCE_LOGO)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toFile(path.join(BUILD_DIR, 'icon.png'));
    console.log('✓ Generated build/icon.png');

    // Generate Windows ICO (placeholder - needs ico generation library)
    console.log('⚠️  Windows ICO generation: Please use an ICO converter tool');
    console.log('   Recommended: Convert build-resources/icons/256x256.png to build/icon.ico');

    // Generate macOS ICNS (placeholder - needs platform-specific tools)
    console.log('⚠️  macOS ICNS generation: Please use iconutil on macOS');
    console.log('   Run: npm run generate-icns');

    // Create a script for macOS icon generation
    const icnsScript = `#!/bin/bash
# Generate macOS icon set
# Run this on macOS only

ICONSET_DIR="build-resources/StoryboardGen.iconset"
mkdir -p "$ICONSET_DIR"

# Copy icons with proper naming for iconset
cp build-resources/icons/16x16.png "$ICONSET_DIR/icon_16x16.png"
cp build-resources/icons/32x32.png "$ICONSET_DIR/icon_16x16@2x.png"
cp build-resources/icons/32x32.png "$ICONSET_DIR/icon_32x32.png"
cp build-resources/icons/64x64.png "$ICONSET_DIR/icon_32x32@2x.png"
cp build-resources/icons/128x128.png "$ICONSET_DIR/icon_128x128.png"
cp build-resources/icons/256x256.png "$ICONSET_DIR/icon_128x128@2x.png"
cp build-resources/icons/256x256.png "$ICONSET_DIR/icon_256x256.png"
cp build-resources/icons/512x512.png "$ICONSET_DIR/icon_256x256@2x.png"
cp build-resources/icons/512x512.png "$ICONSET_DIR/icon_512x512.png"
cp build-resources/icons/1024x1024.png "$ICONSET_DIR/icon_512x512@2x.png"

# Generate ICNS file
iconutil -c icns "$ICONSET_DIR" -o build/icon.icns

# Clean up
rm -rf "$ICONSET_DIR"

echo "✓ Generated build/icon.icns"
`;

    fs.writeFileSync(path.join(__dirname, 'generate-icns.sh'), icnsScript);
    fs.chmodSync(path.join(__dirname, 'generate-icns.sh'), '755');

    console.log('\n✅ Icon generation complete!');
    console.log('\nNext steps:');
    console.log('1. Convert build-resources/icons/256x256.png to build/icon.ico for Windows');
    console.log('2. Run "npm run generate-icns" on macOS to create the .icns file');

  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

// Run the script
generateIcons();