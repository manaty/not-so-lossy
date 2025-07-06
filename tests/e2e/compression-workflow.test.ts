import * as fs from 'fs';
import * as path from 'path';
import { compressImage, reconstructFromMultiple, calculatePSNR } from '../../src/codecs/dct/dct-compressor';
import { generateTestImage } from '../fixtures/test-data';

describe('Compression Workflow E2E Tests', () => {
  describe('Complete compression and reconstruction workflow', () => {
    it('should handle full workflow from upload to reconstruction', () => {
      // Simulate loading an image
      const testImageData = {
        data: generateTestImage(256, 256, 'gradient'),
        width: 256,
        height: 256
      };

      // Simulate multiple devices compressing the image
      const deviceCount = 3;
      const deviceIds = Array.from({ length: deviceCount }, (_, i) => `DEVICE-${String(i).padStart(3, '0')}`);
      
      const compressedVersions = deviceIds.map(deviceId => {
        const result = compressImage(testImageData, deviceId, 1.0);
        expect(result.compressed).toBeTruthy();
        expect(result.size).toBeGreaterThan(0);
        expect(result.preview).toBeTruthy();
        return result.compressed;
      });

      // Reconstruct from all versions
      const reconstructed = reconstructFromMultiple(compressedVersions);
      expect(reconstructed.width).toBe(256);
      expect(reconstructed.height).toBe(256);
      expect(reconstructed.data.length).toBe(256 * 256 * 4);

      // Calculate quality
      const psnr = calculatePSNR(testImageData, reconstructed);
      expect(psnr).toBeGreaterThan(0);
      expect(psnr).toBeLessThan(100);
    });

    it('should improve quality with more devices', () => {
      const testImageData = {
        data: generateTestImage(128, 128, 'gradient'),
        width: 128,
        height: 128
      };

      // Test with 1, 3, and 5 devices
      const deviceCounts = [1, 3, 5];
      const psnrResults: number[] = [];

      deviceCounts.forEach(count => {
        const deviceIds = Array.from({ length: count }, (_, i) => `DEVICE-${String(i).padStart(3, '0')}`);
        const compressedVersions = deviceIds.map(id => 
          compressImage(testImageData, id, 0.8).compressed
        );
        const reconstructed = reconstructFromMultiple(compressedVersions);
        const psnr = calculatePSNR(testImageData, reconstructed);
        psnrResults.push(psnr);
      });

      // Quality should generally improve with more devices
      // Allow small decreases due to deterministic strategy variations
      expect(psnrResults[1]).toBeGreaterThan(psnrResults[0] - 0.5);
      expect(psnrResults[2]).toBeGreaterThan(psnrResults[1] - 0.5);
      
      // Overall, 5 devices should be better than 1 device
      expect(psnrResults[2]).toBeGreaterThan(psnrResults[0]);
    });

    it('should handle quality adjustment workflow', () => {
      const testImageData = {
        data: generateTestImage(64, 64, 'checkerboard'),
        width: 64,
        height: 64
      };

      const deviceId = 'DEVICE-001';
      
      // Initial compression at high quality
      const highQuality = compressImage(testImageData, deviceId, 0.9);
      const highQualitySize = highQuality.size;
      
      // Simulate recompression at lower quality
      // Important: Recompress from the preview, not original
      const lowQuality = compressImage(highQuality.preview, deviceId, 0.3);
      const lowQualitySize = lowQuality.size;
      
      // Lower quality should generally have smaller size
      expect(lowQualitySize).toBeLessThanOrEqual(highQualitySize);
      
      // Both should produce valid images
      expect(highQuality.preview.data.every((v, i) => 
        i % 4 === 3 ? v === 255 : v >= 0 && v <= 255
      )).toBe(true);
      
      expect(lowQuality.preview.data.every((v, i) => 
        i % 4 === 3 ? v === 255 : v >= 0 && v <= 255
      )).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle empty device list gracefully', () => {
      expect(() => reconstructFromMultiple([])).toThrow('No compressed versions provided');
    });

    it('should handle mismatched image dimensions', () => {
      const image1 = {
        data: generateTestImage(64, 64, 'solid'),
        width: 64,
        height: 64
      };
      
      const image2 = {
        data: generateTestImage(128, 128, 'solid'),
        width: 128,
        height: 128
      };
      
      expect(() => calculatePSNR(image1, image2)).toThrow('Images must have same dimensions');
    });
  });

  describe('File operations', () => {
    it('should have test images available', () => {
      const testImagesPath = path.join(__dirname, '../../demo/public/images');
      const expectedImages = ['gradient.png', 'checkerboard.png', 'colorbars.png', 'circles.png', 'mixed.png', 'im1.jpg', 'im2.jpg', 'im3.jpg', 'im4.jpg', 'im5.jpg'];
      
      expectedImages.forEach(imageName => {
        const imagePath = path.join(testImagesPath, imageName);
        expect(fs.existsSync(imagePath)).toBe(true);
      });
    });

    it('should have demo files in place', () => {
      const demoFiles = [
        'demo/index.html',
        'demo/style.css',
        'demo/main.ts'
      ];
      
      demoFiles.forEach(file => {
        const filePath = path.join(__dirname, '../..', file);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });
  });

  describe('Performance considerations', () => {
    it('should handle large images', () => {
      const largeImage = {
        data: generateTestImage(512, 512, 'gradient'),
        width: 512,
        height: 512
      };

      const result = compressImage(largeImage, 'DEVICE-001', 0.8);
      
      // Should complete successfully
      expect(result.compressed).toBeTruthy();
      expect(result.preview.width).toBe(512);
      expect(result.preview.height).toBe(512);
    });

    it('should produce reasonable file sizes', () => {
      const testImage = {
        data: generateTestImage(256, 256, 'gradient'),
        width: 256,
        height: 256
      };
      
      const uncompressedSize = 256 * 256 * 3; // RGB bytes
      const result = compressImage(testImage, 'DEVICE-001', 0.7);
      
      // Compressed should be smaller than uncompressed
      expect(result.size).toBeLessThan(uncompressedSize);
      
      // But not unrealistically small
      expect(result.size).toBeGreaterThan(100); // At least some data
    });
  });
});