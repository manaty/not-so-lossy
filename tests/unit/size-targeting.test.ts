import { compressImage, decompressImage } from '../../src/compression/image-compressor';
import { ImageData } from '../../src/compression/image-compressor';

describe('Size Targeting Tests', () => {
  it('should find quality for target size using binary search', () => {
    // Create a test image
    const width = 128;
    const height = 128;
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

    const deviceId = 'TEST-DEVICE';
    
    // Get baseline sizes
    const highQuality = compressImage(testImage, deviceId, 1.0);
    const lowQuality = compressImage(testImage, deviceId, 0.1);
    
    console.log('Size at quality 1.0:', highQuality.size);
    console.log('Size at quality 0.1:', lowQuality.size);
    
    // Target size in the middle
    const targetSize = Math.floor((highQuality.size + lowQuality.size) / 2);
    console.log('Target size:', targetSize);
    
    // Binary search simulation
    let low = 0.1;
    let high = 1.0;
    let bestQuality = 0.5;
    let bestSize = 0;
    const tolerance = 1024; // 1KB
    
    for (let i = 0; i < 20; i++) {
      const mid = (low + high) / 2;
      const result = compressImage(testImage, deviceId, mid);
      
      if (Math.abs(result.size - targetSize) < tolerance) {
        bestQuality = mid;
        bestSize = result.size;
        console.log(`Found at iteration ${i}: quality=${mid.toFixed(3)}, size=${result.size}`);
        break;
      }
      
      if (result.size > targetSize) {
        high = mid;
      } else {
        low = mid;
        bestQuality = mid;
        bestSize = result.size;
      }
    }
    
    // Should find a size close to target
    expect(Math.abs(bestSize - targetSize)).toBeLessThan(targetSize * 0.2); // Within 20%
  });

  it('should handle 10MB memory limit', () => {
    // Create a larger image
    const width = 512;
    const height = 512;
    const largeImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    // Fill with complex pattern
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        largeImage.data[idx] = (x * y) % 256;
        largeImage.data[idx + 1] = (x + y) % 256;
        largeImage.data[idx + 2] = (x - y + 256) % 256;
        largeImage.data[idx + 3] = 255;
      }
    }

    const deviceId = 'LARGE-TEST';
    const memoryLimit = 10 * 1024 * 1024; // 10MB
    
    // Try different qualities to see which fit in 10MB
    const qualities = [1.0, 0.8, 0.6, 0.4, 0.2, 0.1];
    
    console.log('\nTesting 10MB limit:');
    qualities.forEach(q => {
      const result = compressImage(largeImage, deviceId, q);
      const fits = result.size <= memoryLimit;
      console.log(`Quality ${q}: ${formatSize(result.size)} ${fits ? '✓' : '✗'}`);
    });
  });
});

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}