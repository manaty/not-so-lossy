import { Codec, CodecRegistry, ImageData, CodecResult, CodecOptions } from './types';
import { DCTCodec } from './dct/dct-codec';
import { WaveletCodec } from './wavelet/wavelet-codec';
import { RLECodec } from './rle/rle-codec';
import { QDCTCodec } from './qdct/qdct-codec';

/**
 * Manages codec operations and provides a unified interface
 */
export class CodecManager {
  private currentCodec: Codec;

  constructor(codecName: string = 'qdct') {
    // Register built-in codecs
    this.registerBuiltinCodecs();
    
    // Set current codec
    this.currentCodec = CodecRegistry.get(codecName);
  }

  private registerBuiltinCodecs(): void {
    // Register QDCT codec (first/default)
    CodecRegistry.register(new QDCTCodec());
    
    // Register DCT codec
    CodecRegistry.register(new DCTCodec());
    
    // Register Wavelet codec
    CodecRegistry.register(new WaveletCodec());
    
    // Register RLE codec
    CodecRegistry.register(new RLECodec());
    
    // Add more codecs here as they are implemented
  }

  /**
   * Get current codec name
   */
  getCurrentCodec(): string {
    return this.currentCodec.name;
  }

  /**
   * Switch to a different codec
   */
  setCodec(codecName: string): void {
    this.currentCodec = CodecRegistry.get(codecName);
  }

  /**
   * List available codecs
   */
  getAvailableCodecs(): string[] {
    return CodecRegistry.list();
  }

  /**
   * Compress an image using current codec
   */
  compress(image: ImageData, options: CodecOptions): CodecResult {
    return this.currentCodec.compress(image, options);
  }

  /**
   * Decompress using current codec
   */
  decompress(compressed: any, deviceId: string): ImageData {
    return this.currentCodec.decompress(compressed, deviceId);
  }

  /**
   * Reconstruct from multiple compressed versions
   */
  reconstructFromMultiple(compressedVersions: any[]): ImageData {
    return this.currentCodec.reconstructFromMultiple(compressedVersions);
  }

  /**
   * Calculate PSNR
   */
  calculatePSNR(original: ImageData, compressed: ImageData): number {
    return this.currentCodec.calculatePSNR(original, compressed);
  }

  /**
   * Generate device strategy (if codec supports it)
   */
  generateStrategy(deviceId: string): any {
    if (this.currentCodec.generateStrategy) {
      return this.currentCodec.generateStrategy(deviceId);
    }
    return null;
  }

  /**
   * Get the current codec instance
   */
  getCodec(): Codec {
    return this.currentCodec;
  }
}

// Export singleton instance
export const codecManager = new CodecManager();