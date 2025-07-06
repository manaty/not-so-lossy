import * as CryptoJS from 'crypto-js';
import { DCTDeviceStrategy } from './dct-types';

/**
 * Generates a deterministic compression strategy from a device ID
 */
export class DeterministicStrategyGenerator {
  /**
   * Generate compression strategy from device ID
   */
  static generateStrategy(deviceId: string): DCTDeviceStrategy {
    // Create deterministic hash from device ID
    const hash = CryptoJS.SHA256(deviceId).toString();
    const hashBytes = this.hexToBytes(hash);

    // Generate frequency mask
    const frequencyMask = this.generateFrequencyMask(hashBytes.slice(0, 8));

    // Generate quantization matrix
    const quantSeed = this.bytesToInt(hashBytes.slice(8, 12));
    const quantizationMatrix = this.generateQuantizationMatrix(quantSeed);

    // Generate channel weights
    const channelWeights = {
      y: hashBytes[12] / 255,
      cb: hashBytes[13] / 255,
      cr: hashBytes[14] / 255
    };

    // Normalize weights
    const sum = channelWeights.y + channelWeights.cb + channelWeights.cr;
    channelWeights.y /= sum;
    channelWeights.cb /= sum;
    channelWeights.cr /= sum;

    // Spatial pattern (0-3)
    const spatialPattern = hashBytes[15] % 4;

    return {
      deviceId,
      strategyHash: hash,
      frequencyMask,
      quantizationMatrix,
      channelWeights,
      spatialPattern
    };
  }

  /**
   * Generate frequency preservation mask
   */
  private static generateFrequencyMask(seedBytes: Uint8Array): boolean[] {
    const mask = new Array(64).fill(false);
    
    // Always preserve DC coefficient
    mask[0] = true;

    // Use seed for deterministic selection
    const rng = new SeededRandom(seedBytes);
    
    // Determine how many coefficients to preserve (25-40% of total)
    const preserveCount = 16 + Math.floor((seedBytes[0] / 255) * 10);
    
    // Bias selection towards lower frequencies
    const selected = new Set<number>();
    selected.add(0); // DC coefficient

    while (selected.size < preserveCount) {
      // Generate position with bias towards low frequencies
      const raw = rng.next();
      // Square to bias towards start
      const biased = raw * raw;
      const pos = Math.floor(biased * 64);
      
      if (pos < 64) {
        selected.add(pos);
      }
    }

    // Set mask based on selected positions
    selected.forEach(pos => mask[pos] = true);

    return mask;
  }

  /**
   * Generate deterministic quantization matrix
   */
  private static generateQuantizationMatrix(seed: number): number[][] {
    const rng = new SeededRandom(new Uint8Array([
      (seed >> 24) & 0xFF,
      (seed >> 16) & 0xFF,
      (seed >> 8) & 0xFF,
      seed & 0xFF
    ]));

    // Standard JPEG quantization matrix as base
    const baseMatrix = [
      [16, 11, 10, 16, 24, 40, 51, 61],
      [12, 12, 14, 19, 26, 58, 60, 55],
      [14, 13, 16, 24, 40, 57, 69, 56],
      [14, 17, 22, 29, 51, 87, 80, 62],
      [18, 22, 37, 56, 68, 109, 103, 77],
      [24, 35, 55, 64, 81, 104, 113, 92],
      [49, 64, 78, 87, 103, 121, 120, 101],
      [72, 92, 95, 98, 112, 100, 103, 99]
    ];

    const matrix: number[][] = [];

    // Apply deterministic variations
    for (let i = 0; i < 8; i++) {
      matrix[i] = [];
      for (let j = 0; j < 8; j++) {
        // Vary by ±40% based on seed
        const variation = 0.6 + (rng.next() * 0.8);
        matrix[i][j] = Math.round(baseMatrix[i][j] * variation);
        // Ensure minimum value of 1
        matrix[i][j] = Math.max(1, matrix[i][j]);
      }
    }

    return matrix;
  }

  /**
   * Convert hex string to byte array
   */
  private static hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  /**
   * Convert bytes to integer
   */
  private static bytesToInt(bytes: Uint8Array): number {
    let result = 0;
    for (let i = 0; i < bytes.length; i++) {
      result = (result << 8) | bytes[i];
    }
    return result;
  }
}

/**
 * Seeded random number generator
 */
class SeededRandom {
  private seed: number;

  constructor(seedBytes: Uint8Array) {
    // Convert bytes to 32-bit seed
    this.seed = 0;
    for (let i = 0; i < Math.min(4, seedBytes.length); i++) {
      this.seed = (this.seed << 8) | seedBytes[i];
    }
    // Ensure non-zero seed
    if (this.seed === 0) this.seed = 1;
  }

  /**
   * Generate next random number [0, 1)
   */
  next(): number {
    // Linear congruential generator
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }
}