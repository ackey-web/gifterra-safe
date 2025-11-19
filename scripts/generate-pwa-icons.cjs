const fs = require('fs');
const path = require('path');

// Simple PNG generation using canvas-like approach
// For production, use sharp or similar library

const sizes = [192, 512];
const sourceIcon = path.join(__dirname, '../public/gifterra-logo.png');
const publicDir = path.join(__dirname, '../public');

// Check if source exists
if (!fs.existsSync(sourceIcon)) {
  console.error('Source icon not found:', sourceIcon);
  process.exit(1);
}

// For now, copy the existing logo as PWA icons
// In production, you should resize properly with sharp
sizes.forEach(size => {
  const destPath = path.join(publicDir, `pwa-${size}x${size}.png`);
  fs.copyFileSync(sourceIcon, destPath);
  console.log(`Created: pwa-${size}x${size}.png (copy of original - resize recommended)`);
});

console.log('\nPWA icons created successfully!');
console.log('Note: For best results, resize icons properly using an image editor or sharp library.');
