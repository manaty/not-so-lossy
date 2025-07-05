import { compressImage, decompressImage } from '../../src/compression/image-compressor';
import { ImageData } from '../../src/compression/image-compressor';

describe('Device Preview Tests', () => {
  it('should show individual device preview correctly', () => {
    // Create a test image with a simple pattern
    const width = 32;
    const height = 32;
    const testImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    // Create a gradient pattern
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const value = Math.floor((x / width) * 255);
        testImage.data[idx] = value;     // R gradient
        testImage.data[idx + 1] = 0;     // G = 0
        testImage.data[idx + 2] = 255 - value; // B inverse gradient
        testImage.data[idx + 3] = 255;   // A
      }
    }

    // Compress with a device
    const deviceId = 'DEVICE-001';
    const compressionResult = compressImage(testImage, deviceId, 0.8);
    
    // Decompress to get preview
    const preview = decompressImage(compressionResult.compressed);
    
    // Verify preview has correct dimensions
    expect(preview.width).toBe(width);
    expect(preview.height).toBe(height);
    expect(preview.data.length).toBe(width * height * 4);
    
    // Verify preview shows some of the original pattern
    // Check a few pixels
    const centerIdx = (height / 2 * width + width / 2) * 4;
    
    // Should have some red component in the center
    expect(preview.data[centerIdx]).toBeGreaterThan(50);
    
    // Alpha should be preserved
    expect(preview.data[centerIdx + 3]).toBe(255);
  });

  it('should handle recompression from device preview', () => {
    // Create a simple test image
    const width = 16;
    const height = 16;
    const testImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    // Fill with solid color
    for (let i = 0; i < testImage.data.length; i += 4) {
      testImage.data[i] = 200;     // R
      testImage.data[i + 1] = 100; // G
      testImage.data[i + 2] = 50;  // B
      testImage.data[i + 3] = 255; // A
    }

    const deviceId = 'DEVICE-002';
    
    // Initial compression at high quality
    const firstCompression = compressImage(testImage, deviceId, 0.9);
    
    // Decompress to get preview
    const firstPreview = decompressImage(firstCompression.compressed);
    
    // Recompress the preview at lower quality
    const recompression = compressImage(firstPreview, deviceId, 0.3);
    
    // Get final preview
    const finalPreview = decompressImage(recompression.compressed);
    
    // Verify dimensions are preserved
    expect(finalPreview.width).toBe(width);
    expect(finalPreview.height).toBe(height);
    
    // The recompressed version should have a smaller size
    expect(recompression.size).toBeLessThanOrEqual(firstCompression.size);
  });

  it('should show different results for different devices', () => {
    // Create test image
    const width = 16;
    const height = 16;
    const testImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    // Fill with pattern
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        testImage.data[idx] = (x * 16) % 256;
        testImage.data[idx + 1] = (y * 16) % 256;
        testImage.data[idx + 2] = ((x + y) * 8) % 256;
        testImage.data[idx + 3] = 255;
      }
    }

    // Compress with different devices
    const device1Result = compressImage(testImage, 'DEVICE-A', 0.7);
    const device2Result = compressImage(testImage, 'DEVICE-B', 0.7);
    
    // Get previews
    const preview1 = decompressImage(device1Result.compressed);
    const preview2 = decompressImage(device2Result.compressed);
    
    // Calculate difference between previews
    let totalDiff = 0;
    for (let i = 0; i < preview1.data.length; i += 4) {
      totalDiff += Math.abs(preview1.data[i] - preview2.data[i]);
      totalDiff += Math.abs(preview1.data[i + 1] - preview2.data[i + 1]);
      totalDiff += Math.abs(preview1.data[i + 2] - preview2.data[i + 2]);
    }
    
    // Different devices should produce different results
    expect(totalDiff).toBeGreaterThan(0);
    
    // But both should have valid image data
    expect(preview1.data.every((v, i) => i % 4 === 3 ? v === 255 : v >= 0 && v <= 255)).toBe(true);
    expect(preview2.data.every((v, i) => i % 4 === 3 ? v === 255 : v >= 0 && v <= 255)).toBe(true);
  });
});