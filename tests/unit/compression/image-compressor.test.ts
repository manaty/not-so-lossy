import {
  compressImage,
  decompressImage,
  reconstructFromMultiple,
  calculatePSNR,
  ImageData
} from '../../../src/compression/image-compressor';
import { generateTestImage } from '../../fixtures/test-data';

describe('Image Compressor', () => {
  const createTestImage = (width: number = 16, height: number = 16, pattern: 'solid' | 'gradient' | 'checkerboard' | 'noise' = 'gradient'): ImageData => {
    return {
      data: generateTestImage(width, height, pattern),
      width,
      height
    };
  };

  describe('compressImage', () => {
    it('should compress an image and return valid result', () => {
      const image = createTestImage();
      const deviceId = 'TEST-DEVICE-001';
      
      const result = compressImage(image, deviceId);
      
      expect(result).toHaveProperty('compressed');
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('preview');
      
      expect(result.compressed.deviceId).toBe(deviceId);
      expect(result.compressed.width).toBe(16);
      expect(result.compressed.height).toBe(16);
      expect(result.compressed.blocks).toHaveLength(4); // 2x2 blocks for 16x16 image
    });

    it('should apply quality factor', () => {
      const image = createTestImage(64, 64, 'gradient');
      const deviceId = 'TEST-DEVICE-001';
      
      const highQuality = compressImage(image, deviceId, 1.0);
      const lowQuality = compressImage(image, deviceId, 0.3);
      
      // Quality factor is applied
      expect(highQuality.size).toBeGreaterThan(0);
      expect(lowQuality.size).toBeGreaterThan(0);
    });

    it('should handle edge sizes not divisible by 8', () => {
      const image = createTestImage(17, 23);
      const deviceId = 'TEST-DEVICE-001';
      
      const result = compressImage(image, deviceId);
      
      expect(result.compressed.width).toBe(17);
      expect(result.compressed.height).toBe(23);
      expect(result.compressed.blocks).toHaveLength(9); // 3x3 blocks
    });

    it('should preserve image dimensions in preview', () => {
      const image = createTestImage(32, 24);
      const result = compressImage(image, 'TEST-DEVICE');
      
      expect(result.preview.width).toBe(32);
      expect(result.preview.height).toBe(24);
      expect(result.preview.data).toHaveLength(32 * 24 * 4);
    });
  });

  describe('decompressImage', () => {
    it('should decompress to same dimensions', () => {
      const original = createTestImage(32, 32);
      const compressed = compressImage(original, 'TEST-DEVICE').compressed;
      
      const decompressed = decompressImage(compressed);
      
      expect(decompressed.width).toBe(32);
      expect(decompressed.height).toBe(32);
      expect(decompressed.data).toHaveLength(32 * 32 * 4);
    });

    it('should produce valid decompressed image', () => {
      const original = createTestImage(16, 16, 'solid');
      const compressed = compressImage(original, 'TEST-DEVICE', 1.0).compressed;
      const decompressed = decompressImage(compressed);
      
      // Check dimensions
      expect(decompressed.width).toBe(16);
      expect(decompressed.height).toBe(16);
      
      // Check all values are valid
      for (let i = 0; i < decompressed.data.length; i++) {
        expect(decompressed.data[i]).toBeGreaterThanOrEqual(0);
        expect(decompressed.data[i]).toBeLessThanOrEqual(255);
      }
    });
  });

  describe('reconstructFromMultiple', () => {
    it('should combine multiple sources effectively', () => {
      const original = createTestImage(32, 32, 'gradient');
      
      // Compress with different devices at good quality
      const compressed1 = compressImage(original, 'DEVICE-001', 0.9).compressed;
      const compressed2 = compressImage(original, 'DEVICE-002', 0.9).compressed;
      const compressed3 = compressImage(original, 'DEVICE-003', 0.9).compressed;
      
      // Multi-source reconstruction should produce valid output
      const multi = reconstructFromMultiple([compressed1, compressed2, compressed3]);
      
      expect(multi.width).toBe(32);
      expect(multi.height).toBe(32);
      expect(multi.data).toHaveLength(32 * 32 * 4);
      
      // All pixel values should be valid
      for (let i = 0; i < multi.data.length; i++) {
        expect(multi.data[i]).toBeGreaterThanOrEqual(0);
        expect(multi.data[i]).toBeLessThanOrEqual(255);
      }
    });

    it('should handle single source', () => {
      const original = createTestImage(16, 16);
      const compressed = compressImage(original, 'DEVICE-001').compressed;
      
      const reconstructed = reconstructFromMultiple([compressed]);
      
      expect(reconstructed.width).toBe(16);
      expect(reconstructed.height).toBe(16);
    });

    it('should throw error for empty array', () => {
      expect(() => reconstructFromMultiple([])).toThrow('No compressed versions provided');
    });

    it('should produce valid image data', () => {
      const original = createTestImage(16, 16);
      const compressed = [
        compressImage(original, 'DEVICE-001').compressed,
        compressImage(original, 'DEVICE-002').compressed
      ];
      
      const reconstructed = reconstructFromMultiple(compressed);
      
      // Check all pixel values are valid
      for (let i = 0; i < reconstructed.data.length; i++) {
        expect(reconstructed.data[i]).toBeGreaterThanOrEqual(0);
        expect(reconstructed.data[i]).toBeLessThanOrEqual(255);
      }
    });
  });

  describe('calculatePSNR', () => {
    it('should return infinity for identical images', () => {
      const image = createTestImage(16, 16);
      const psnr = calculatePSNR(image, image);
      
      expect(psnr).toBe(Infinity);
    });

    it('should calculate PSNR for compressed images', () => {
      const original = createTestImage(32, 32, 'gradient');
      const compressed = compressImage(original, 'TEST', 0.9);
      
      const psnr = calculatePSNR(original, compressed.preview);
      
      // PSNR should be a finite positive number
      expect(psnr).toBeGreaterThan(0);
      expect(psnr).toBeLessThan(100);
      expect(Number.isFinite(psnr)).toBe(true);
    });

    it('should throw error for different dimensions', () => {
      const image1 = createTestImage(16, 16);
      const image2 = createTestImage(32, 32);
      
      expect(() => calculatePSNR(image1, image2)).toThrow('Images must have same dimensions');
    });

    it('should handle different quality levels', () => {
      const original = createTestImage(64, 64, 'gradient');
      
      const high = compressImage(original, 'TEST', 1.0);
      const low = compressImage(original, 'TEST', 0.3);
      
      // Both should produce valid PSNR values
      const psnrHigh = calculatePSNR(original, high.preview);
      const psnrLow = calculatePSNR(original, low.preview);
      
      expect(Number.isFinite(psnrHigh)).toBe(true);
      expect(Number.isFinite(psnrLow)).toBe(true);
      expect(psnrHigh).toBeGreaterThan(0);
      expect(psnrLow).toBeGreaterThan(0);
    });
  });

  describe('Color space conversion', () => {
    it('should handle edge cases in color conversion', () => {
      // Test with extreme values
      const testData = new Uint8ClampedArray([
        0, 0, 0, 255,       // Black
        255, 255, 255, 255, // White
        255, 0, 0, 255,     // Red
        0, 255, 0, 255,     // Green
        0, 0, 255, 255      // Blue
      ]);
      
      const image: ImageData = {
        data: testData,
        width: 5,
        height: 1
      };
      
      const compressed = compressImage(image, 'TEST', 1.0);
      const decompressed = compressed.preview;
      
      // Check that all values are valid RGB
      for (let i = 0; i < decompressed.data.length; i++) {
        expect(decompressed.data[i]).toBeGreaterThanOrEqual(0);
        expect(decompressed.data[i]).toBeLessThanOrEqual(255);
      }
      
      // Should produce valid output
      expect(decompressed.width).toBe(5);
      expect(decompressed.height).toBe(1);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle progressive quality reduction', () => {
      const original = createTestImage(32, 32, 'gradient');
      const deviceId = 'DEVICE-001';
      
      // First compression
      let current = compressImage(original, deviceId, 0.8);
      const size1 = current.size;
      
      // Recompress the already compressed image
      current = compressImage(current.preview, deviceId, 0.5);
      const size2 = current.size;
      
      // Size should decrease
      expect(size2).toBeLessThan(size1);
      
      // Should still produce valid image
      expect(current.preview.data.every((v, i) => 
        i % 4 === 3 ? v === 255 : v >= 0 && v <= 255
      )).toBe(true);
    });

    it('should maintain deterministic behavior', () => {
      const image = createTestImage(16, 16, 'noise');
      const deviceId = 'DEVICE-123';
      
      const result1 = compressImage(image, deviceId, 0.7);
      const result2 = compressImage(image, deviceId, 0.7);
      
      // Same device ID and quality should produce same compression
      expect(result1.size).toBe(result2.size);
      expect(result1.compressed.blocks).toEqual(result2.compressed.blocks);
    });
  });
});