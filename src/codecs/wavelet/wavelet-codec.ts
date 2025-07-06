import { Codec, ImageData, CodecResult, CodecOptions } from '../types';
import * as CryptoJS from 'crypto-js';

interface WaveletCompressed {
  deviceId: string;
  width: number;
  height: number;
  qualityFactor: number;
  coefficients: {
    LL: number[][];
    LH: number[][];
    HL: number[][];
    HH: number[][];
  };
}

export class WaveletCodec implements Codec {
  name = 'wavelet';

  compress(image: ImageData, options: CodecOptions): CodecResult {
    const { width, height } = image;
    
    // Convert to grayscale for simplicity
    const gray = new Array(height).fill(0).map(() => new Array(width).fill(0));
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        gray[y][x] = 0.299 * image.data[idx] + 0.587 * image.data[idx + 1] + 0.114 * image.data[idx + 2];
      }
    }

    // Simple Haar wavelet transform
    const coefficients = this.haarWaveletTransform(gray);
    
    // Quantize based on quality
    const quantizationFactor = 1 + (1 - options.quality) * 50;
    this.quantizeCoefficients(coefficients, quantizationFactor, options.deviceId);

    const compressed: WaveletCompressed = {
      deviceId: options.deviceId,
      width,
      height,
      qualityFactor: options.quality,
      coefficients
    };

    // Calculate size (simplified)
    let size = 100; // overhead
    Object.values(coefficients).forEach(band => {
      band.forEach(row => {
        row.forEach(val => {
          if (val !== 0) size += 2;
        });
      });
    });

    // Generate preview
    const preview = this.decompress(compressed, options.deviceId);

    return { compressed, size, preview };
  }

  decompress(compressed: WaveletCompressed, deviceId: string): ImageData {
    const { width, height, coefficients } = compressed;
    
    // Inverse wavelet transform
    const gray = this.inverseHaarWaveletTransform(coefficients, width, height);
    
    // Convert back to RGB
    const imageData = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const value = Math.max(0, Math.min(255, Math.round(gray[y][x])));
        imageData[idx] = value;
        imageData[idx + 1] = value;
        imageData[idx + 2] = value;
        imageData[idx + 3] = 255;
      }
    }

    return { data: imageData, width, height };
  }

  reconstructFromMultiple(compressedVersions: WaveletCompressed[]): ImageData {
    if (compressedVersions.length === 0) {
      throw new Error('No compressed versions provided');
    }

    const { width, height } = compressedVersions[0];
    
    // Simple averaging in wavelet domain
    const avgCoefficients = {
      LL: this.averageCoefficients(compressedVersions.map(v => v.coefficients.LL)),
      LH: this.averageCoefficients(compressedVersions.map(v => v.coefficients.LH)),
      HL: this.averageCoefficients(compressedVersions.map(v => v.coefficients.HL)),
      HH: this.averageCoefficients(compressedVersions.map(v => v.coefficients.HH))
    };

    // Inverse transform
    const gray = this.inverseHaarWaveletTransform(avgCoefficients, width, height);
    
    // Convert to RGB
    const imageData = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const value = Math.max(0, Math.min(255, Math.round(gray[y][x])));
        imageData[idx] = value;
        imageData[idx + 1] = value;
        imageData[idx + 2] = value;
        imageData[idx + 3] = 255;
      }
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
      // Only consider RGB channels
      for (let c = 0; c < 3; c++) {
        const diff = original.data[i + c] - compressed.data[i + c];
        mse += diff * diff;
      }
    }
    
    mse = mse / (pixelCount * 3);
    
    if (mse === 0) return Infinity;
    
    return 10 * Math.log10((255 * 255) / mse);
  }

  private haarWaveletTransform(image: number[][]): WaveletCompressed['coefficients'] {
    const height = image.length;
    const width = image[0].length;
    const halfH = Math.floor(height / 2);
    const halfW = Math.floor(width / 2);

    const LL = new Array(halfH).fill(0).map(() => new Array(halfW).fill(0));
    const LH = new Array(halfH).fill(0).map(() => new Array(halfW).fill(0));
    const HL = new Array(halfH).fill(0).map(() => new Array(halfW).fill(0));
    const HH = new Array(halfH).fill(0).map(() => new Array(halfW).fill(0));

    // Simple Haar wavelet transform
    for (let y = 0; y < halfH; y++) {
      for (let x = 0; x < halfW; x++) {
        const a = image[y * 2][x * 2];
        const b = image[y * 2][x * 2 + 1];
        const c = image[y * 2 + 1][x * 2];
        const d = image[y * 2 + 1][x * 2 + 1];

        LL[y][x] = (a + b + c + d) / 4;
        LH[y][x] = (a - b + c - d) / 4;
        HL[y][x] = (a + b - c - d) / 4;
        HH[y][x] = (a - b - c + d) / 4;
      }
    }

    return { LL, LH, HL, HH };
  }

  private inverseHaarWaveletTransform(
    coefficients: WaveletCompressed['coefficients'], 
    width: number, 
    height: number
  ): number[][] {
    const { LL, LH, HL, HH } = coefficients;
    const result = new Array(height).fill(0).map(() => new Array(width).fill(0));

    const halfH = LL.length;
    const halfW = LL[0].length;

    for (let y = 0; y < halfH; y++) {
      for (let x = 0; x < halfW; x++) {
        const ll = LL[y][x];
        const lh = LH[y][x];
        const hl = HL[y][x];
        const hh = HH[y][x];

        result[y * 2][x * 2] = ll + lh + hl + hh;
        result[y * 2][x * 2 + 1] = ll - lh + hl - hh;
        result[y * 2 + 1][x * 2] = ll + lh - hl - hh;
        result[y * 2 + 1][x * 2 + 1] = ll - lh - hl + hh;
      }
    }

    return result;
  }

  private quantizeCoefficients(
    coefficients: WaveletCompressed['coefficients'], 
    quantFactor: number,
    deviceId: string
  ): void {
    // Device-specific threshold based on ID
    const hash = CryptoJS.SHA256(deviceId).toString();
    const threshold = (parseInt(hash.substring(0, 8), 16) % 50) / 100;

    // Quantize each band differently
    ['LH', 'HL', 'HH'].forEach(band => {
      const bandCoeffs = coefficients[band as keyof typeof coefficients];
      for (let y = 0; y < bandCoeffs.length; y++) {
        for (let x = 0; x < bandCoeffs[0].length; x++) {
          const val = bandCoeffs[y][x];
          // Device-specific thresholding
          if (Math.abs(val) < quantFactor * (1 + threshold)) {
            bandCoeffs[y][x] = 0;
          } else {
            bandCoeffs[y][x] = Math.round(val / quantFactor) * quantFactor;
          }
        }
      }
    });
  }

  private averageCoefficients(coeffArrays: number[][][]): number[][] {
    if (coeffArrays.length === 0) return [];
    
    const height = coeffArrays[0].length;
    const width = coeffArrays[0][0].length;
    const result = new Array(height).fill(0).map(() => new Array(width).fill(0));

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        coeffArrays.forEach(coeffs => {
          sum += coeffs[y][x];
        });
        result[y][x] = sum / coeffArrays.length;
      }
    }

    return result;
  }
}