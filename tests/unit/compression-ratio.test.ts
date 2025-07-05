import { compressImage } from '../../src/compression/image-compressor';
import { ImageData } from '../../src/compression/image-compressor';

describe('Compression Ratio Tests', () => {
  it('should check compression at quality 1.0', () => {
    // Create test images of different sizes
    const testSizes = [
      { width: 256, height: 256, name: '256x256' },
      { width: 512, height: 512, name: '512x512' },
      { width: 1024, height: 1024, name: '1024x1024' }
    ];
    
    testSizes.forEach(({ width, height, name }) => {
      // Create a simple gradient image
      const testImage: ImageData = {
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4)
      };
      
      // Fill with gradient
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          testImage.data[idx] = (x * 255) / width;
          testImage.data[idx + 1] = (y * 255) / height;
          testImage.data[idx + 2] = 128;
          testImage.data[idx + 3] = 255;
        }
      }
      
      const uncompressedSize = width * height * 3; // RGB
      const result = compressImage(testImage, 'TEST-DEVICE', 1.0);
      const compressionRatio = uncompressedSize / result.size;
      
      console.log(`\n${name}:`);
      console.log(`  Uncompressed: ${(uncompressedSize / 1024).toFixed(1)} KB`);
      console.log(`  Compressed (Q=1.0): ${(result.size / 1024).toFixed(1)} KB`);
      console.log(`  Compression ratio: ${compressionRatio.toFixed(1)}:1`);
      console.log(`  Size reduction: ${((1 - result.size/uncompressedSize) * 100).toFixed(1)}%`);
    });
  });
  
  it('should test solid color compression', () => {
    // Solid color images should compress very well
    const width = 512;
    const height = 512;
    
    const colors = [
      { name: 'White', r: 255, g: 255, b: 255 },
      { name: 'Black', r: 0, g: 0, b: 0 },
      { name: 'Red', r: 255, g: 0, b: 0 },
      { name: 'Grey', r: 128, g: 128, b: 128 }
    ];
    
    colors.forEach(({ name, r, g, b }) => {
      const testImage: ImageData = {
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4)
      };
      
      // Fill with solid color
      for (let i = 0; i < testImage.data.length; i += 4) {
        testImage.data[i] = r;
        testImage.data[i + 1] = g;
        testImage.data[i + 2] = b;
        testImage.data[i + 3] = 255;
      }
      
      const uncompressedSize = width * height * 3;
      const result = compressImage(testImage, 'TEST-DEVICE', 1.0);
      const compressionRatio = uncompressedSize / result.size;
      
      console.log(`\n${name} (${width}x${height}):`);
      console.log(`  Uncompressed: ${(uncompressedSize / 1024).toFixed(1)} KB`);
      console.log(`  Compressed (Q=1.0): ${(result.size / 1024).toFixed(1)} KB`);
      console.log(`  Compression ratio: ${compressionRatio.toFixed(1)}:1`);
    });
  });
});