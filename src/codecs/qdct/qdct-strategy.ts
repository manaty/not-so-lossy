import * as CryptoJS from 'crypto-js';
import { QDCTStrategy } from './qdct-types';

/**
 * Increment matrix - values to add at each compression level
 * Based on JPEG quantization matrix but used as increments
 */
const INCREMENT_MATRIX = [
  [4, 3, 3, 4, 5, 8, 10, 12],
  [3, 3, 4, 5, 6, 11, 12, 11],
  [4, 4, 5, 6, 8, 11, 14, 11],
  [4, 5, 6, 7, 10, 17, 16, 12],
  [5, 6, 9, 11, 14, 22, 21, 15],
  [6, 9, 11, 13, 16, 21, 23, 18],
  [10, 13, 16, 17, 21, 24, 24, 20],
  [14, 18, 19, 20, 22, 20, 21, 20]
];

/**
 * Base quantization matrix - all ones (no quantization)
 */
const BASE_QUANT_MATRIX = Array(8).fill(null).map(() => Array(8).fill(1));

/**
 * Generates QDCT strategy from device ID
 */
export class QDCTStrategyGenerator {
  /**
   * Generate quantization order based on device ID
   */
  static generateStrategy(deviceId: string): QDCTStrategy {
    // Create deterministic hash from device ID
    const hash = CryptoJS.SHA256(deviceId).toString();
    
    // Create pseudo-random number generator from hash
    const prng = this.createPRNG(hash);
    
    // Generate random order for 64 coefficients (0-63)
    const quantizationOrder = this.generateRandomOrder(64, prng);
    
    // Fixed percentage increase (e.g., 10%)
    const quantizationIncrease = 0.1;
    
    return {
      deviceId,
      quantizationOrder,
      quantizationIncrease
    };
  }

  /**
   * Get base quantization matrix (all ones)
   */
  static getStandardMatrix(): number[][] {
    return BASE_QUANT_MATRIX.map(row => [...row]);
  }

  /**
   * Get increment matrix
   */
  static getIncrementMatrix(): number[][] {
    return INCREMENT_MATRIX.map(row => [...row]);
  }

  /**
   * Apply progressive quantization to matrix
   */
  static applyProgressiveQuantization(
    baseMatrix: number[][],
    strategy: QDCTStrategy,
    compressionLevel: number
  ): number[][] {
    // Clone the base matrix (starts with all 1s)
    const matrix = baseMatrix.map(row => [...row]);
    const incrementMatrix = this.getIncrementMatrix();
    
    // Maximum quantization value to prevent overflow
    const MAX_QUANT_VALUE = 255;
    
    // Handle multiple rounds if compression level > 64
    const rounds = Math.floor(compressionLevel / 64);
    const remainder = compressionLevel % 64;
    
    // Apply full rounds
    for (let round = 0; round < rounds; round++) {
      for (let i = 0; i < 64; i++) {
        const coeffIndex = strategy.quantizationOrder[i];
        const row = Math.floor(coeffIndex / 8);
        const col = coeffIndex % 8;
        
        if (row >= 0 && row < 8 && col >= 0 && col < 8) {
          // Add increment but cap at maximum
          matrix[row][col] = Math.min(
            matrix[row][col] + incrementMatrix[row][col],
            MAX_QUANT_VALUE
          );
        }
      }
    }
    
    // Apply remaining levels
    for (let level = 0; level < remainder; level++) {
      const coeffIndex = strategy.quantizationOrder[level];
      const row = Math.floor(coeffIndex / 8);
      const col = coeffIndex % 8;
      
      if (row >= 0 && row < 8 && col >= 0 && col < 8) {
        // Add increment but cap at maximum
        matrix[row][col] = Math.min(
          matrix[row][col] + incrementMatrix[row][col],
          MAX_QUANT_VALUE
        );
      }
    }
    
    return matrix;
  }

  /**
   * Create pseudo-random number generator from seed
   */
  private static createPRNG(seed: string): () => number {
    // Use the seed to create initial state
    let state = 0;
    for (let i = 0; i < seed.length; i++) {
      state = ((state << 5) - state) + seed.charCodeAt(i);
      state = state & 0xFFFFFFFF; // Convert to 32-bit integer
    }
    
    // Ensure non-zero state
    if (state === 0) state = 1;
    
    // Simple linear congruential generator
    return () => {
      state = (state * 1664525 + 1013904223) & 0xFFFFFFFF;
      return (state >>> 0) / 0x100000000; // Convert to 0-1 range
    };
  }

  /**
   * Generate random permutation of numbers 0 to n-1
   */
  private static generateRandomOrder(n: number, prng: () => number): number[] {
    const order = Array.from({ length: n }, (_, i) => i);
    
    // Fisher-Yates shuffle
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    
    return order;
  }

  /**
   * Convert linear index to zigzag position
   */
  static indexToZigzag(index: number): { row: number; col: number } {
    // Zigzag pattern for 8x8 matrix
    const zigzag = [
      [0, 0], [0, 1], [1, 0], [2, 0], [1, 1], [0, 2], [0, 3], [1, 2],
      [2, 1], [3, 0], [4, 0], [3, 1], [2, 2], [1, 3], [0, 4], [0, 5],
      [1, 4], [2, 3], [3, 2], [4, 1], [5, 0], [6, 0], [5, 1], [4, 2],
      [3, 3], [2, 4], [1, 5], [0, 6], [0, 7], [1, 6], [2, 5], [3, 4],
      [4, 3], [5, 2], [6, 1], [7, 0], [7, 1], [6, 2], [5, 3], [4, 4],
      [3, 5], [2, 6], [1, 7], [2, 7], [3, 6], [4, 5], [5, 4], [6, 3],
      [7, 2], [7, 3], [6, 4], [5, 5], [4, 6], [3, 7], [4, 7], [5, 6],
      [6, 5], [7, 4], [7, 5], [6, 6], [5, 7], [6, 7], [7, 6], [7, 7]
    ];
    
    const pos = zigzag[index];
    return { row: pos[0], col: pos[1] };
  }
}