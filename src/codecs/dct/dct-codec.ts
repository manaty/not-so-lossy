import { Codec, ImageData, CodecResult, CodecOptions } from '../types';
import { DCTCompressedImage } from './dct-types';
import { 
  compressImage, 
  decompressImage, 
  reconstructFromMultiple as dctReconstruct,
  calculatePSNR as dctPSNR 
} from './dct-compressor';
import { DeterministicStrategyGenerator } from './dct-strategy';

export class DCTCodec implements Codec {
  name = 'dct';

  compress(image: ImageData, options: CodecOptions): CodecResult {
    const result = compressImage(image, options.deviceId, options.quality);
    return {
      compressed: result.compressed,
      size: result.size,
      preview: result.preview
    };
  }

  decompress(compressed: DCTCompressedImage, deviceId: string): ImageData {
    return decompressImage(compressed);
  }

  reconstructFromMultiple(compressedVersions: DCTCompressedImage[]): ImageData {
    return dctReconstruct(compressedVersions);
  }

  calculatePSNR(original: ImageData, compressed: ImageData): number {
    return dctPSNR(original, compressed);
  }

  generateStrategy(deviceId: string) {
    return DeterministicStrategyGenerator.generateStrategy(deviceId);
  }
}