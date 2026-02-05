const fs = require('fs');
const path = require('path');

// Create sample images directory
const samplesDir = path.join(__dirname, '../public/samples/images');
if (!fs.existsSync(samplesDir)) {
  fs.mkdirSync(samplesDir, { recursive: true });
}

// Generate 20 placeholder panel images with different colors
const colors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DFE6E9', '#A29BFE', '#FD79A8', '#FDCB6E', '#6C5CE7',
  '#00B894', '#E17055', '#0984E3', '#6C5CE7', '#00CEC9',
  '#D63031', '#F39C12', '#8E44AD', '#27AE60', '#2980B9'
];

// Create SVG placeholder images
for (let i = 1; i <= 20; i++) {
  const color = colors[(i - 1) % colors.length];
  const svg = `
    <svg width="1024" height="576" xmlns="http://www.w3.org/2000/svg">
      <rect width="1024" height="576" fill="${color}"/>
      <text x="512" y="288" font-family="Arial, sans-serif" font-size="48" fill="white" text-anchor="middle" dominant-baseline="middle">
        Panel ${i}
      </text>
      <text x="512" y="340" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">
        Sample Storyboard Image
      </text>
    </svg>
  `;

  const filename = `panel-${i}.png`;
  const filepath = path.join(samplesDir, filename);

  // Save as SVG for now (can be converted to PNG later)
  fs.writeFileSync(filepath.replace('.png', '.svg'), svg.trim());
  console.log(`Created: ${filename}`);
}

console.log(`\nGenerated 20 sample panel images in: ${samplesDir}`);
console.log('Note: Images are in SVG format. For production, convert to PNG.');
