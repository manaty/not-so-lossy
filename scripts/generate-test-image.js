const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');

// Create examples directory if it doesn't exist
const examplesDir = path.join(__dirname, '../examples');
if (!fs.existsSync(examplesDir)) {
  fs.mkdirSync(examplesDir, { recursive: true });
}

async function generateTestImages() {
  const width = 512;
  const height = 512;
  
  // 1. Gradient test image (smooth transitions)
  console.log('Generating gradient test image...');
  const gradient = new Jimp(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const r = Math.floor((x / width) * 255);
      const g = Math.floor((y / height) * 255);
      const b = Math.floor(((x + y) / (width + height)) * 255);
      const color = Jimp.rgbaToInt(r, g, b, 255);
      gradient.setPixelColor(color, x, y);
    }
  }
  await gradient.quality(100).writeAsync(path.join(examplesDir, 'gradient.png'));
  
  // 2. Checkerboard pattern (high frequency)
  console.log('Generating checkerboard test image...');
  const checkerboard = new Jimp(width, height);
  const squareSize = 32;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isWhite = (Math.floor(x / squareSize) + Math.floor(y / squareSize)) % 2 === 0;
      const value = isWhite ? 255 : 0;
      const color = Jimp.rgbaToInt(value, value, value, 255);
      checkerboard.setPixelColor(color, x, y);
    }
  }
  await checkerboard.quality(100).writeAsync(path.join(examplesDir, 'checkerboard.png'));
  
  // 3. Color bars (broadcast test pattern)
  console.log('Generating color bars test image...');
  const colorBars = new Jimp(width, height);
  const colors = [
    [255, 255, 255], // White
    [255, 255, 0],   // Yellow
    [0, 255, 255],   // Cyan
    [0, 255, 0],     // Green
    [255, 0, 255],   // Magenta
    [255, 0, 0],     // Red
    [0, 0, 255],     // Blue
    [0, 0, 0]        // Black
  ];
  const barWidth = width / colors.length;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const barIndex = Math.min(Math.floor(x / barWidth), colors.length - 1);
      const [r, g, b] = colors[barIndex];
      const color = Jimp.rgbaToInt(r, g, b, 255);
      colorBars.setPixelColor(color, x, y);
    }
  }
  await colorBars.quality(100).writeAsync(path.join(examplesDir, 'colorbars.png'));
  
  // 4. Concentric circles (radial pattern)
  console.log('Generating circles test image...');
  const circles = new Jimp(width, height);
  const centerX = width / 2;
  const centerY = height / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      const value = Math.sin(distance / 20) > 0 ? 255 : 0;
      const color = Jimp.rgbaToInt(value, value, value, 255);
      circles.setPixelColor(color, x, y);
    }
  }
  await circles.quality(100).writeAsync(path.join(examplesDir, 'circles.png'));
  
  // 5. Mixed frequency test (combination of smooth and detailed areas)
  console.log('Generating mixed frequency test image...');
  const mixed = new Jimp(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r, g, b;
      
      if (x < width / 2 && y < height / 2) {
        // Top-left: smooth gradient
        r = Math.floor((x / (width/2)) * 255);
        g = Math.floor((y / (height/2)) * 255);
        b = 128;
      } else if (x >= width / 2 && y < height / 2) {
        // Top-right: vertical stripes
        r = (x % 16 < 8) ? 255 : 0;
        g = r;
        b = r;
      } else if (x < width / 2 && y >= height / 2) {
        // Bottom-left: solid color
        r = 64;
        g = 128;
        b = 192;
      } else {
        // Bottom-right: noise
        r = Math.floor(Math.random() * 256);
        g = Math.floor(Math.random() * 256);
        b = Math.floor(Math.random() * 256);
      }
      
      const color = Jimp.rgbaToInt(r, g, b, 255);
      mixed.setPixelColor(color, x, y);
    }
  }
  await mixed.quality(100).writeAsync(path.join(examplesDir, 'mixed.png'));
  
  console.log('\nAll test images generated in examples/ directory:');
  console.log('- gradient.png: Smooth color gradients');
  console.log('- checkerboard.png: High-frequency pattern');
  console.log('- colorbars.png: Broadcast test pattern');
  console.log('- circles.png: Radial frequency pattern');
  console.log('- mixed.png: Mixed frequency content');
}

generateTestImages().catch(console.error);