import { Codec, ImageData, CodecResult, CodecOptions } from '../types';
import * as CryptoJS from 'crypto-js';

interface RLECompressed {
  deviceId: string;
  width: number;
  height: number;
  qualityFactor: number;
  runs: Array<{ value: number; length: number }>;
}

export class RLECodec implements Codec {
  name = 'rle';

  compress(image: ImageData, options: CodecOptions): CodecResult {
    const { width, height } = image;
    
    // Convert to grayscale and quantize based on quality
    const quantLevels = Math.round(2 + options.quality * 254);
    const quantStep = 256 / quantLevels;
    
    const gray: number[] = [];
    for (let i = 0; i < image.data.length; i += 4) {
      const g = 0.299 * image.data[i] + 0.587 * image.data[i + 1] + 0.114 * image.data[i + 2];
      gray.push(Math.floor(g / quantStep) * quantStep);
    }

    // Device-specific pattern: skip some pixels based on device ID
    const hash = CryptoJS.SHA256(options.deviceId).toString();
    const skipPattern = parseInt(hash.substring(0, 4), 16) % 16;
    
    // Run-length encode
    const runs: Array<{ value: number; length: number }> = [];
    let currentValue = gray[0];
    let runLength = 1;

    for (let i = 1; i < gray.length; i++) {
      // Device-specific: some devices skip certain positions
      if ((i % 16) === skipPattern && options.quality < 0.9) {
        // Force a run break at device-specific positions
        runs.push({ value: currentValue, length: runLength });
        currentValue = gray[i];
        runLength = 1;
      } else if (gray[i] === currentValue) {
        runLength++;
      } else {
        runs.push({ value: currentValue, length: runLength });
        currentValue = gray[i];
        runLength = 1;
      }
    }
    runs.push({ value: currentValue, length: runLength });

    const compressed: RLECompressed = {
      deviceId: options.deviceId,
      width,
      height,
      qualityFactor: options.quality,
      runs
    };

    // Calculate size
    const size = 100 + runs.length * 2; // overhead + 2 bytes per run

    // Generate preview
    const preview = this.decompress(compressed, options.deviceId);

    return { compressed, size, preview };
  }

  decompress(compressed: RLECompressed, deviceId: string): ImageData {
    const { width, height, runs } = compressed;
    const imageData = new Uint8ClampedArray(width * height * 4);
    
    let idx = 0;
    for (const run of runs) {
      for (let i = 0; i < run.length && idx < width * height; i++) {
        const pixelIdx = idx * 4;
        imageData[pixelIdx] = run.value;
        imageData[pixelIdx + 1] = run.value;
        imageData[pixelIdx + 2] = run.value;
        imageData[pixelIdx + 3] = 255;
        idx++;
      }
    }

    return { data: imageData, width, height };
  }

  reconstructFromMultiple(compressedVersions: RLECompressed[]): ImageData {
    if (compressedVersions.length === 0) {
      throw new Error('No compressed versions provided');
    }

    const { width, height } = compressedVersions[0];
    
    // Decompress all versions
    const decompressed = compressedVersions.map(c => this.decompress(c, c.deviceId));
    
    // Average pixel values
    const imageData = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < imageData.length; i += 4) {
      let sum = 0;
      decompressed.forEach(img => {
        sum += img.data[i];
      });
      const avg = Math.round(sum / decompressed.length);
      imageData[i] = avg;
      imageData[i + 1] = avg;
      imageData[i + 2] = avg;
      imageData[i + 3] = 255;
    }

    return { data: imageData, width, height };
  }

  calculatePSNR(original: ImageData, compressed: ImageData): number {
    if (original.width !== compressed.width || original.height !== compressed.height) {
      throw new Error('Images must have same dimensions');
    }
    
    let mse = 0;
    const pixelCount = original.width * original.height;
    
    for (let i = 0; i < original.data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const diff = original.data[i + c] - compressed.data[i + c];
        mse += diff * diff;
      }
    }
    
    mse = mse / (pixelCount * 3);
    
    if (mse === 0) return Infinity;
    
    return 10 * Math.log10((255 * 255) / mse);
  }
}