#!/bin/bash
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
