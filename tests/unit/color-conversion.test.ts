// Since rgbToYCbCr and yCbCrToRgb are not exported, we'll test them indirectly
// through the compressImage function

import { compressImage, calculatePSNR } from '../../src/codecs/dct/dct-compressor';
import { ImageData } from '../../src/codecs/dct/dct-compressor';

describe('Color Conversion Tests', () => {
  it('should preserve colors correctly through compression/decompression cycle', () => {
    // Create a test image with known colors
    const width = 16;
    const height = 16;
    const testImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    // Test different colors
    const testColors = [
      { r: 255, g: 0, b: 0 },    // Red
      { r: 0, g: 255, b: 0 },    // Green
      { r: 0, g: 0, b: 255 },    // Blue
      { r: 255, g: 255, b: 0 },  // Yellow
      { r: 255, g: 0, b: 255 },  // Magenta
      { r: 0, g: 255, b: 255 },  // Cyan
      { r: 128, g: 128, b: 128 }, // Gray
      { r: 255, g: 255, b: 255 }, // White
    ];

    // Fill image with test colors in different regions
    for (let i = 0; i < testColors.length; i++) {
      const startX = (i % 4) * 4;
      const startY = Math.floor(i / 4) * 8;
      const color = testColors[i];

      for (let y = startY; y < startY + 8 && y < height; y++) {
        for (let x = startX; x < startX + 4 && x < width; x++) {
          const idx = (y * width + x) * 4;
          testImage.data[idx] = color.r;
          testImage.data[idx + 1] = color.g;
          testImage.data[idx + 2] = color.b;
          testImage.data[idx + 3] = 255;
        }
      }
    }

    // Compress and decompress
    const result = compressImage(testImage, 'TEST-DEVICE', 1.0);
    const decompressed = result.preview;

    // Check that colors are reasonably preserved
    for (let i = 0; i < testColors.length; i++) {
      const startX = (i % 4) * 4;
      const startY = Math.floor(i / 4) * 8;
      const expectedColor = testColors[i];

      // Sample from the center of each color region
      const x = startX + 2;
      const y = startY + 4;
      
      if (x < width && y < height) {
        const idx = (y * width + x) * 4;
        const r = decompressed.data[idx];
        const g = decompressed.data[idx + 1];
        const b = decompressed.data[idx + 2];

        // Allow some tolerance due to lossy compression
        const tolerance = 120; // High tolerance for lossy compression with varied channel weights
        
        expect(Math.abs(r - expectedColor.r)).toBeLessThan(tolerance);
        expect(Math.abs(g - expectedColor.g)).toBeLessThan(tolerance);
        expect(Math.abs(b - expectedColor.b)).toBeLessThan(tolerance);
      }
    }
  });

  it('should not produce purple tint on grayscale images', () => {
    // Create a grayscale gradient
    const width = 64;
    const height = 64;
    const testImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    // Fill with grayscale gradient
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const gray = Math.floor((x / width) * 255);
        const idx = (y * width + x) * 4;
        testImage.data[idx] = gray;
        testImage.data[idx + 1] = gray;
        testImage.data[idx + 2] = gray;
        testImage.data[idx + 3] = 255;
      }
    }

    // Compress and decompress
    const result = compressImage(testImage, 'TEST-DEVICE', 0.9);
    const decompressed = result.preview;

    // Check that the image remains grayscale (no color cast)
    let totalColorDiff = 0;
    let pixelCount = 0;

    for (let y = 8; y < height - 8; y += 4) {
      for (let x = 8; x < width - 8; x += 4) {
        const idx = (y * width + x) * 4;
        const r = decompressed.data[idx];
        const g = decompressed.data[idx + 1];
        const b = decompressed.data[idx + 2];

        // For grayscale, R, G, and B should be similar
        const maxDiff = Math.max(
          Math.abs(r - g),
          Math.abs(g - b),
          Math.abs(r - b)
        );
        
        totalColorDiff += maxDiff;
        pixelCount++;
      }
    }

    const avgColorDiff = totalColorDiff / pixelCount;
    
    // Average color difference should be small for grayscale
    expect(avgColorDiff).toBeLessThan(15);
  });

  it('should handle white images correctly', () => {
    // Create a white image
    const width = 32;
    const height = 32;
    const testImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    // Fill with white
    for (let i = 0; i < testImage.data.length; i += 4) {
      testImage.data[i] = 255;
      testImage.data[i + 1] = 255;
      testImage.data[i + 2] = 255;
      testImage.data[i + 3] = 255;
    }

    // Compress and decompress
    const result = compressImage(testImage, 'TEST-DEVICE', 0.95);
    const decompressed = result.preview;

    // Check center pixels are still close to white
    const centerX = width / 2;
    const centerY = height / 2;
    const idx = (centerY * width + centerX) * 4;
    
    expect(decompressed.data[idx]).toBeGreaterThan(180);
    expect(decompressed.data[idx + 1]).toBeGreaterThan(180);
    expect(decompressed.data[idx + 2]).toBeGreaterThan(180);
  });

  it('should handle black images correctly', () => {
    // Create a black image
    const width = 32;
    const height = 32;
    const testImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    // Fill with black (alpha already 0 by default)
    for (let i = 3; i < testImage.data.length; i += 4) {
      testImage.data[i] = 255; // Set alpha
    }

    // Compress and decompress
    const result = compressImage(testImage, 'TEST-DEVICE', 0.95);
    const decompressed = result.preview;

    // Check center pixels are still close to black
    const centerX = width / 2;
    const centerY = height / 2;
    const idx = (centerY * width + centerX) * 4;
    
    expect(decompressed.data[idx]).toBeLessThan(50);
    expect(decompressed.data[idx + 1]).toBeLessThan(50);
    expect(decompressed.data[idx + 2]).toBeLessThan(50);
  });
});