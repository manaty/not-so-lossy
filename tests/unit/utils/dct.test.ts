import {
  dct2d,
  idct2d,
  zigzagOrder,
  inverseZigzag,
  quantize,
  dequantize
} from '../../../src/codecs/dct/dct-utils';

describe('DCT Utilities', () => {
  describe('dct2d', () => {
    it('should transform a constant block correctly', () => {
      const block = Array(8).fill(0).map(() => Array(8).fill(128));
      const result = dct2d(block);
      
      // DC coefficient should be significant
      expect(Math.abs(result[0][0])).toBeGreaterThan(1000);
      
      // All AC coefficients should be near zero
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          if (i !== 0 || j !== 0) {
            expect(Math.abs(result[i][j])).toBeLessThan(0.001);
          }
        }
      }
    });

    it('should handle zero block', () => {
      const block = Array(8).fill(0).map(() => Array(8).fill(0));
      const result = dct2d(block);
      
      result.forEach(row => {
        row.forEach(value => {
          expect(Math.abs(value)).toBeLessThan(0.001);
        });
      });
    });

    it('should have reasonable coefficient magnitudes', () => {
      const block = [
        [52, 55, 61, 66, 70, 61, 64, 73],
        [63, 59, 55, 90, 109, 85, 69, 72],
        [62, 59, 68, 113, 144, 104, 66, 73],
        [63, 58, 71, 122, 154, 106, 70, 69],
        [67, 61, 68, 104, 126, 88, 68, 70],
        [79, 65, 60, 70, 77, 68, 58, 75],
        [85, 71, 64, 59, 55, 61, 65, 83],
        [87, 79, 69, 68, 65, 76, 78, 94]
      ];
      
      const dctBlock = dct2d(block);
      
      // DC coefficient should be large (represents average)
      expect(Math.abs(dctBlock[0][0])).toBeGreaterThan(100);
      
      // Most high frequency coefficients should be smaller
      let highFreqCount = 0;
      for (let i = 4; i < 8; i++) {
        for (let j = 4; j < 8; j++) {
          if (Math.abs(dctBlock[i][j]) < 50) {
            highFreqCount++;
          }
        }
      }
      expect(highFreqCount).toBeGreaterThan(10); // Most high frequencies should be small
    });
  });

  describe('idct2d', () => {
    it('should be inverse of dct2d', () => {
      const originalBlock = [
        [52, 55, 61, 66, 70, 61, 64, 73],
        [63, 59, 55, 90, 109, 85, 69, 72],
        [62, 59, 68, 113, 144, 104, 66, 73],
        [63, 58, 71, 122, 154, 106, 70, 69],
        [67, 61, 68, 104, 126, 88, 68, 70],
        [79, 65, 60, 70, 77, 68, 58, 75],
        [85, 71, 64, 59, 55, 61, 65, 83],
        [87, 79, 69, 68, 65, 76, 78, 94]
      ];
      
      const dctBlock = dct2d(originalBlock);
      const reconstructed = idct2d(dctBlock);
      
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          expect(reconstructed[i][j]).toBeCloseTo(originalBlock[i][j], 1);
        }
      }
    });
  });

  describe('zigzagOrder', () => {
    it('should convert 8x8 block to 64-element array', () => {
      const block = Array(8).fill(0).map((_, i) => 
        Array(8).fill(0).map((_, j) => i * 8 + j)
      );
      
      const result = zigzagOrder(block);
      
      expect(result).toHaveLength(64);
      expect(result[0]).toBe(0);  // Top-left
      expect(result[63]).toBe(63); // Bottom-right
    });

    it('should follow correct zigzag pattern', () => {
      const block = Array(8).fill(0).map((_, i) => 
        Array(8).fill(0).map((_, j) => i * 8 + j)
      );
      
      const result = zigzagOrder(block);
      
      // Check first few elements of zigzag pattern
      expect(result[0]).toBe(0);   // (0,0)
      expect(result[1]).toBe(1);   // (0,1)
      expect(result[2]).toBe(8);   // (1,0)
      expect(result[3]).toBe(16);  // (2,0)
      expect(result[4]).toBe(9);   // (1,1)
      expect(result[5]).toBe(2);   // (0,2)
    });
  });

  describe('inverseZigzag', () => {
    it('should be inverse of zigzagOrder', () => {
      const originalBlock = Array(8).fill(0).map((_, i) => 
        Array(8).fill(0).map((_, j) => Math.floor(Math.random() * 256))
      );
      
      const zigzag = zigzagOrder(originalBlock);
      const reconstructed = inverseZigzag(zigzag);
      
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          expect(reconstructed[i][j]).toBe(originalBlock[i][j]);
        }
      }
    });

    it('should handle all zeros', () => {
      const zigzag = Array(64).fill(0);
      const block = inverseZigzag(zigzag);
      
      block.forEach(row => {
        row.forEach(value => {
          expect(value).toBe(0);
        });
      });
    });
  });

  describe('quantize', () => {
    it('should quantize DCT coefficients correctly', () => {
      const dctBlock = [
        [1024, 100, 50, 20, 10, 5, 2, 1],
        [80, 60, 40, 20, 10, 5, 2, 1],
        [40, 30, 20, 10, 5, 2, 1, 0],
        [20, 15, 10, 5, 2, 1, 0, 0],
        [10, 8, 5, 2, 1, 0, 0, 0],
        [5, 4, 2, 1, 0, 0, 0, 0],
        [2, 1, 1, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 0]
      ];
      
      const quantMatrix = Array(8).fill(0).map(() => Array(8).fill(16));
      const result = quantize(dctBlock, quantMatrix);
      
      expect(result[0][0]).toBe(64); // 1024/16 = 64
      expect(result[0][1]).toBe(6);  // 100/16 = 6.25 → 6
      expect(result[0][2]).toBe(3);  // 50/16 = 3.125 → 3
    });

    it('should round to nearest integer', () => {
      const dctBlock = [[25, 35], [45, 55]];
      const quantMatrix = [[10, 10], [10, 10]];
      const result = quantize(dctBlock.map(row => [...row, ...Array(6).fill(0)])
                                   .concat(Array(6).fill(Array(8).fill(0))), 
                             quantMatrix.map(row => [...row, ...Array(6).fill(1)])
                                        .concat(Array(6).fill(Array(8).fill(1))));
      
      expect(result[0][0]).toBe(3); // 25/10 = 2.5 → 3
      expect(result[0][1]).toBe(4); // 35/10 = 3.5 → 4
      expect(result[1][0]).toBe(5); // 45/10 = 4.5 → 5
      expect(result[1][1]).toBe(6); // 55/10 = 5.5 → 6
    });
  });

  describe('dequantize', () => {
    it('should dequantize correctly', () => {
      const quantBlock = [
        [64, 6, 3, 1, 0, 0, 0, 0],
        [5, 4, 3, 1, 0, 0, 0, 0],
        [3, 2, 1, 0, 0, 0, 0, 0],
        [1, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0]
      ];
      
      const quantMatrix = Array(8).fill(0).map(() => Array(8).fill(16));
      const result = dequantize(quantBlock, quantMatrix);
      
      expect(result[0][0]).toBe(1024); // 64 * 16
      expect(result[0][1]).toBe(96);   // 6 * 16
      expect(result[0][2]).toBe(48);   // 3 * 16
    });

    it('should handle zero quantized values', () => {
      const quantBlock = Array(8).fill(0).map(() => Array(8).fill(0));
      const quantMatrix = Array(8).fill(0).map(() => Array(8).fill(16));
      const result = dequantize(quantBlock, quantMatrix);
      
      result.forEach(row => {
        row.forEach(value => {
          expect(value).toBe(0);
        });
      });
    });
  });

  describe('Round-trip tests', () => {
    it('should handle quantization round-trip with loss', () => {
      const originalDCT = [
        [1000, 100, 50, 25, 12, 6, 3, 1],
        [80, 60, 40, 20, 10, 5, 2, 1],
        [40, 30, 20, 10, 5, 2, 1, 0],
        [20, 15, 10, 5, 2, 1, 0, 0],
        [10, 8, 5, 2, 1, 0, 0, 0],
        [5, 4, 2, 1, 0, 0, 0, 0],
        [2, 1, 1, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 0]
      ];
      
      const quantMatrix = [
        [16, 11, 10, 16, 24, 40, 51, 61],
        [12, 12, 14, 19, 26, 58, 60, 55],
        [14, 13, 16, 24, 40, 57, 69, 56],
        [14, 17, 22, 29, 51, 87, 80, 62],
        [18, 22, 37, 56, 68, 109, 103, 77],
        [24, 35, 55, 64, 81, 104, 113, 92],
        [49, 64, 78, 87, 103, 121, 120, 101],
        [72, 92, 95, 98, 112, 100, 103, 99]
      ];
      
      const quantized = quantize(originalDCT, quantMatrix);
      const dequantized = dequantize(quantized, quantMatrix);
      
      // DC coefficient should be relatively well preserved
      expect(Math.abs(dequantized[0][0] - originalDCT[0][0])).toBeLessThan(quantMatrix[0][0]);
      
      // High frequency coefficients will have more loss
      expect(dequantized[7][7]).toBe(0); // Should be quantized to 0
    });
  });
});