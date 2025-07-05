import { DeterministicStrategyGenerator } from '../../src/core/deterministic-strategy';
import { dct2d, idct2d, quantize, dequantize, zigzagOrder, inverseZigzag } from '../../src/utils/dct';
import { TEST_DEVICE_IDS, SAMPLE_8X8_BLOCKS, calculateMSE, calculatePSNR } from '../fixtures/test-data';

describe('Compression and Recovery Integration Tests', () => {
  /**
   * Simulate compression of a block using a device's strategy
   */
  function compressBlock(block: number[][], deviceId: string): number[] {
    const strategy = DeterministicStrategyGenerator.generateStrategy(deviceId);
    
    // Apply DCT
    const dctBlock = dct2d(block);
    
    // Quantize using device's matrix
    const quantized = quantize(dctBlock, strategy.quantizationMatrix);
    
    // Convert to zigzag order
    const zigzag = zigzagOrder(quantized);
    
    // Apply frequency mask - zero out coefficients not preserved by this device
    const maskedZigzag = zigzag.map((coeff, idx) => 
      strategy.frequencyMask[idx] ? coeff : 0
    );
    
    return maskedZigzag;
  }
  
  /**
   * Recover a block from multiple compressed versions
   */
  function recoverBlock(compressedVersions: Array<{deviceId: string, data: number[]}>): number[][] {
    const reconstructed = new Array(64).fill(0);
    const weights = new Array(64).fill(0);
    
    // Combine data from all devices
    compressedVersions.forEach(({deviceId, data}) => {
      const strategy = DeterministicStrategyGenerator.generateStrategy(deviceId);
      
      data.forEach((coeff, idx) => {
        if (strategy.frequencyMask[idx] && coeff !== 0) {
          // Dequantize the coefficient
          const blockPos = getBlockPosition(idx);
          const quantValue = strategy.quantizationMatrix[blockPos.row][blockPos.col];
          const dequantized = coeff * quantValue;
          
          reconstructed[idx] += dequantized;
          weights[idx] += 1;
        }
      });
    });
    
    // Average where we have multiple values
    const averaged = reconstructed.map((value, idx) => 
      weights[idx] > 0 ? value / weights[idx] : 0
    );
    
    // Convert back to 8x8 block
    const dctBlock = inverseZigzag(averaged);
    
    // Apply inverse DCT
    const spatialBlock = idct2d(dctBlock);
    
    // Clamp values to valid range
    return spatialBlock.map(row => 
      row.map(value => Math.max(0, Math.min(255, Math.round(value))))
    );
  }
  
  /**
   * Helper to get row/col from zigzag index
   */
  function getBlockPosition(zigzagIndex: number): {row: number, col: number} {
    const order = [
      [0, 0], [0, 1], [1, 0], [2, 0], [1, 1], [0, 2], [0, 3], [1, 2],
      [2, 1], [3, 0], [4, 0], [3, 1], [2, 2], [1, 3], [0, 4], [0, 5],
      [1, 4], [2, 3], [3, 2], [4, 1], [5, 0], [6, 0], [5, 1], [4, 2],
      [3, 3], [2, 4], [1, 5], [0, 6], [0, 7], [1, 6], [2, 5], [3, 4],
      [4, 3], [5, 2], [6, 1], [7, 0], [7, 1], [6, 2], [5, 3], [4, 4],
      [3, 5], [2, 6], [1, 7], [2, 7], [3, 6], [4, 5], [5, 4], [6, 3],
      [7, 2], [7, 3], [6, 4], [5, 5], [4, 6], [3, 7], [4, 7], [5, 6],
      [6, 5], [7, 4], [7, 5], [6, 6], [5, 7], [6, 7], [7, 6], [7, 7]
    ];
    return { row: order[zigzagIndex][0], col: order[zigzagIndex][1] };
  }

  describe('Single device compression', () => {
    it('should compress and decompress with acceptable loss', () => {
      const original = SAMPLE_8X8_BLOCKS.realImage;
      const deviceId = TEST_DEVICE_IDS.deviceA;
      
      // Compress
      const compressed = compressBlock(original, deviceId);
      
      // Decompress (single source)
      const recovered = recoverBlock([{deviceId, data: compressed}]);
      
      // Calculate quality metrics
      const mse = calculateMSE(original, recovered);
      const psnr = calculatePSNR(mse);
      
      // Should have reasonable quality even with single source
      expect(psnr).toBeGreaterThan(20); // 20 dB is acceptable for heavy compression
    });
  });

  describe('Multi-device recovery', () => {
    it('should improve quality with multiple devices', () => {
      const original = SAMPLE_8X8_BLOCKS.realImage;
      const devices = [TEST_DEVICE_IDS.deviceA, TEST_DEVICE_IDS.deviceB, TEST_DEVICE_IDS.deviceC];
      
      // Compress with each device
      const compressedVersions = devices.map(deviceId => ({
        deviceId,
        data: compressBlock(original, deviceId)
      }));
      
      // Test recovery with increasing number of sources
      const results = [];
      for (let i = 1; i <= devices.length; i++) {
        const sources = compressedVersions.slice(0, i);
        const recovered = recoverBlock(sources);
        const mse = calculateMSE(original, recovered);
        const psnr = calculatePSNR(mse);
        results.push({ sources: i, mse, psnr });
      }
      
      // Quality should improve with more sources
      expect(results[1].psnr).toBeGreaterThan(results[0].psnr);
      expect(results[2].psnr).toBeGreaterThan(results[1].psnr);
      
      // With 3 devices, should achieve reasonable quality
      expect(results[2].psnr).toBeGreaterThan(25);
    });

    it('should handle different block patterns effectively', () => {
      const testCases = [
        { name: 'constant', block: SAMPLE_8X8_BLOCKS.constant },
        { name: 'gradient', block: SAMPLE_8X8_BLOCKS.gradient },
        { name: 'edge', block: SAMPLE_8X8_BLOCKS.verticalEdge },
        { name: 'checkerboard', block: SAMPLE_8X8_BLOCKS.checkerboard }
      ];
      
      const devices = [TEST_DEVICE_IDS.deviceA, TEST_DEVICE_IDS.deviceB, TEST_DEVICE_IDS.deviceC];
      
      testCases.forEach(testCase => {
        const compressedVersions = devices.map(deviceId => ({
          deviceId,
          data: compressBlock(testCase.block, deviceId)
        }));
        
        const recovered = recoverBlock(compressedVersions);
        const mse = calculateMSE(testCase.block, recovered);
        const psnr = calculatePSNR(mse);
        
        // Different patterns will have different quality expectations
        if (testCase.name === 'constant') {
          expect(psnr).toBeGreaterThan(40); // Should be nearly perfect
        } else if (testCase.name === 'gradient') {
          expect(psnr).toBeGreaterThan(25); // Good quality expected
        } else {
          expect(psnr).toBeGreaterThan(15); // High frequency patterns harder to compress
        }
      });
    });
  });

  describe('Strategy diversity', () => {
    it('should have diverse frequency coverage across devices', () => {
      const devices = [
        TEST_DEVICE_IDS.deviceA,
        TEST_DEVICE_IDS.deviceB,
        TEST_DEVICE_IDS.deviceC,
        TEST_DEVICE_IDS.deviceD
      ];
      
      // Get all strategies
      const strategies = devices.map(id => 
        DeterministicStrategyGenerator.generateStrategy(id)
      );
      
      // Count frequency coverage
      const coverage = new Array(64).fill(0);
      strategies.forEach(strategy => {
        strategy.frequencyMask.forEach((preserved, idx) => {
          if (preserved) coverage[idx]++;
        });
      });
      
      // Check coverage statistics
      const totalCovered = coverage.filter(c => c > 0).length;
      const avgCoverage = coverage.reduce((a, b) => a + b) / 64;
      
      // Should cover most frequencies
      expect(totalCovered).toBeGreaterThan(45); // At least 45/64 frequencies covered
      
      // Should have reasonable redundancy
      expect(avgCoverage).toBeGreaterThan(1.2); // Each frequency covered by 1.2+ devices on average
      
      // DC coefficient should have maximum redundancy
      expect(coverage[0]).toBe(devices.length);
    });

    it('should have different quantization characteristics', () => {
      const devices = [TEST_DEVICE_IDS.deviceA, TEST_DEVICE_IDS.deviceB];
      const strategies = devices.map(id => 
        DeterministicStrategyGenerator.generateStrategy(id)
      );
      
      // Compare quantization matrices
      let differences = 0;
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          if (strategies[0].quantizationMatrix[i][j] !== strategies[1].quantizationMatrix[i][j]) {
            differences++;
          }
        }
      }
      
      // Matrices should be substantially different
      expect(differences).toBeGreaterThan(32); // At least half the values differ
    });
  });

  describe('Edge cases', () => {
    it('should handle single preserved frequency gracefully', () => {
      // Create a block where only DC is preserved
      const original = SAMPLE_8X8_BLOCKS.realImage;
      
      // Mock a strategy that only preserves DC
      const mockCompressed = new Array(64).fill(0);
      mockCompressed[0] = 50; // Only DC coefficient
      
      const recovered = recoverBlock([{
        deviceId: 'mock-device',
        data: mockCompressed
      }]);
      
      // Should produce a constant block
      const firstValue = recovered[0][0];
      recovered.forEach(row => {
        row.forEach(value => {
          expect(Math.abs(value - firstValue)).toBeLessThan(1);
        });
      });
    });

    it('should handle missing frequency bands', () => {
      const original = SAMPLE_8X8_BLOCKS.gradient;
      
      // Use 4 devices to ensure coverage
      const devices = Object.values(TEST_DEVICE_IDS);
      const compressedVersions = devices.map(deviceId => ({
        deviceId,
        data: compressBlock(original, deviceId)
      }));
      
      const recovered = recoverBlock(compressedVersions);
      
      // Even with potential gaps, should maintain gradient structure
      // Check if gradient is preserved (values should increase)
      for (let i = 0; i < 7; i++) {
        expect(recovered[i + 1][0]).toBeGreaterThanOrEqual(recovered[i][0] - 5); // Allow small variations
      }
    });
  });
});