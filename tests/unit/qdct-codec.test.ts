import { QDCTCodec } from '../../src/codecs/qdct/qdct-codec';
import { QDCTStrategyGenerator } from '../../src/codecs/qdct/qdct-strategy';
import { ImageData } from '../../src/codecs/types';

describe('QDCT Codec Tests', () => {
  const createTestImage = (): ImageData => {
    const width = 64;
    const height = 64;
    const data = new Uint8ClampedArray(width * height * 4);
    
    // Create a gradient pattern
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = (x * 255) / width;     // R
        data[idx + 1] = (y * 255) / height; // G
        data[idx + 2] = 128;                // B
        data[idx + 3] = 255;                // A
      }
    }
    
    return { data, width, height };
  };

  describe('Progressive Quantization', () => {
    it('should generate deterministic quantization order', () => {
      const strategy1 = QDCTStrategyGenerator.generateStrategy('DEVICE-001');
      const strategy2 = QDCTStrategyGenerator.generateStrategy('DEVICE-001');
      const strategy3 = QDCTStrategyGenerator.generateStrategy('DEVICE-002');
      
      // Same device ID should give same order
      expect(strategy1.quantizationOrder).toEqual(strategy2.quantizationOrder);
      
      // Different device ID should give different order
      expect(strategy1.quantizationOrder).not.toEqual(strategy3.quantizationOrder);
      
      // Should be a permutation of 0-63
      expect(strategy1.quantizationOrder.length).toBe(64);
      expect(new Set(strategy1.quantizationOrder).size).toBe(64);
      expect(Math.min(...strategy1.quantizationOrder)).toBe(0);
      expect(Math.max(...strategy1.quantizationOrder)).toBe(63);
    });

    it('should progressively increase quantization values', () => {
      const strategy = QDCTStrategyGenerator.generateStrategy('TEST-DEVICE');
      const baseMatrix = QDCTStrategyGenerator.getStandardMatrix();
      
      // Apply different compression levels
      const matrix0 = QDCTStrategyGenerator.applyProgressiveQuantization(baseMatrix, strategy, 0);
      const matrix5 = QDCTStrategyGenerator.applyProgressiveQuantization(baseMatrix, strategy, 5);
      const matrix10 = QDCTStrategyGenerator.applyProgressiveQuantization(baseMatrix, strategy, 10);
      
      // Level 0 should be unchanged
      expect(matrix0).toEqual(baseMatrix);
      
      // Count changed coefficients
      let changes5 = 0;
      let changes10 = 0;
      
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          if (matrix5[i][j] !== baseMatrix[i][j]) changes5++;
          if (matrix10[i][j] !== baseMatrix[i][j]) changes10++;
        }
      }
      
      expect(changes5).toBe(5);
      expect(changes10).toBe(10);
      
      // Changed values should be increased by 10%
      for (let level = 0; level < 5; level++) {
        const coeffIndex = strategy.quantizationOrder[level];
        const row = Math.floor(coeffIndex / 8);
        const col = coeffIndex % 8;
        
        expect(matrix5[row][col]).toBe(Math.round(baseMatrix[row][col] * 1.1));
      }
    });
  });

  describe('Compression and Decompression', () => {
    it('should compress and decompress with tracking compression level', () => {
      const codec = new QDCTCodec();
      const testImage = createTestImage();
      
      // Compress at quality 0.8 (level ~12)
      const result = codec.compress(testImage, {
        quality: 0.8,
        deviceId: 'TEST-DEVICE'
      });
      
      expect(result.compressed).toBeDefined();
      expect(result.size).toBeGreaterThan(0);
      expect(result.preview).toBeDefined();
      
      // Check compression level is stored
      const compressed = result.compressed as any;
      expect(compressed.compressionLevel).toBeDefined();
      expect(compressed.compressionLevel).toBeGreaterThanOrEqual(0);
      expect(compressed.compressionLevel).toBeLessThanOrEqual(63);
      
      // Decompress
      const decompressed = codec.decompress(result.compressed, 'TEST-DEVICE');
      expect(decompressed.width).toBe(testImage.width);
      expect(decompressed.height).toBe(testImage.height);
      
      // Calculate PSNR
      const psnr = codec.calculatePSNR(testImage, decompressed);
      expect(psnr).toBeGreaterThan(25); // Should have reasonable quality
    });
  });

  describe('Incremental Compression', () => {
    it('should support incremental compression to higher levels', () => {
      const codec = new QDCTCodec();
      const testImage = createTestImage();
      const deviceId = 'INCREMENTAL-TEST';
      
      // First compress at high quality (low level)
      const result1 = codec.compress(testImage, {
        quality: 0.9,
        deviceId
      });
      
      const level1 = codec.getCompressionLevel(deviceId);
      expect(level1).toBeDefined();
      
      // Then compress at lower quality (higher level)
      const result2 = codec.compress(testImage, {
        quality: 0.5,
        deviceId
      });
      
      const level2 = codec.getCompressionLevel(deviceId);
      expect(level2).toBeDefined();
      expect(level2!).toBeGreaterThan(level1!);
      
      // Size should increase due to more quantization
      expect(result2.size).toBeLessThan(result1.size);
      
      // Quality should decrease
      const psnr1 = codec.calculatePSNR(testImage, codec.decompress(result1.compressed, deviceId));
      const psnr2 = codec.calculatePSNR(testImage, codec.decompress(result2.compressed, deviceId));
      expect(psnr2).toBeLessThan(psnr1);
    });

    it('should use cached version for incremental compression', () => {
      const codec = new QDCTCodec();
      const testImage = createTestImage();
      const deviceId = 'CACHE-TEST';
      
      // Clear cache
      codec.clearCache();
      
      // First compression
      codec.compress(testImage, { quality: 0.8, deviceId });
      expect(codec.getCompressionLevel(deviceId)).toBeDefined();
      
      // Compress to lower quality - should use cache
      codec.compress(testImage, { quality: 0.6, deviceId });
      
      // Clear specific device cache
      codec.clearCache(deviceId);
      expect(codec.getCompressionLevel(deviceId)).toBeUndefined();
    });
  });

  describe('Quantization Matrix Inspection', () => {
    it('should provide quantization matrix for debugging', () => {
      const codec = new QDCTCodec();
      const deviceId = 'MATRIX-TEST';
      
      const matrix0 = codec.getQuantizationMatrix(deviceId, 0);
      const matrix10 = codec.getQuantizationMatrix(deviceId, 10);
      
      // Should be 8x8 matrices
      expect(matrix0.length).toBe(8);
      expect(matrix0[0].length).toBe(8);
      
      // Higher level should have some increased values
      let differences = 0;
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          if (matrix10[i][j] > matrix0[i][j]) {
            differences++;
          }
        }
      }
      expect(differences).toBe(10);
    });
  });

  describe('Multi-device Reconstruction', () => {
    it('should reconstruct from multiple QDCT compressed versions', () => {
      const codec = new QDCTCodec();
      const testImage = createTestImage();
      const devices = ['DEVICE-001', 'DEVICE-002', 'DEVICE-003'];
      
      const compressed = devices.map(deviceId => 
        codec.compress(testImage, { quality: 0.7, deviceId }).compressed
      );
      
      const reconstructed = codec.reconstructFromMultiple(compressed);
      expect(reconstructed.width).toBe(testImage.width);
      expect(reconstructed.height).toBe(testImage.height);
      
      const psnr = codec.calculatePSNR(testImage, reconstructed);
      expect(psnr).toBeGreaterThan(20);
    });
  });
});