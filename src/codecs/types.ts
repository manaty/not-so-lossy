/**
 * Common types for all codecs
 */

export interface ImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface CodecResult {
  compressed: any; // Codec-specific compressed data
  size: number;
  preview: ImageData;
}

export interface CodecOptions {
  quality: number; // 0.0 to 1.0
  deviceId: string;
  strategy?: any; // Codec-specific strategy
}

/**
 * Interface that all codecs must implement
 */
export interface Codec {
  /**
   * Name of the codec
   */
  name: string;

  /**
   * Compress an image
   */
  compress(image: ImageData, options: CodecOptions): CodecResult;

  /**
   * Decompress an image
   */
  decompress(compressed: any, deviceId: string): ImageData;

  /**
   * Reconstruct from multiple compressed versions
   */
  reconstructFromMultiple(compressedVersions: any[]): ImageData;

  /**
   * Calculate PSNR between two images
   */
  calculatePSNR(original: ImageData, compressed: ImageData): number;

  /**
   * Generate device-specific strategy (optional)
   */
  generateStrategy?(deviceId: string): any;
}

/**
 * Registry for available codecs
 */
export class CodecRegistry {
  private static codecs = new Map<string, Codec>();

  static register(codec: Codec): void {
    this.codecs.set(codec.name, codec);
  }

  static get(name: string): Codec {
    const codec = this.codecs.get(name);
    if (!codec) {
      throw new Error(`Codec '${name}' not found. Available: ${Array.from(this.codecs.keys()).join(', ')}`);
    }
    return codec;
  }

  static list(): string[] {
    return Array.from(this.codecs.keys());
  }
}