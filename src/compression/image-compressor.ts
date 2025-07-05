import { DeterministicStrategyGenerator } from '../core/deterministic-strategy';
import { DeviceStrategy, CompressedImage, CompressedBlock } from '../core/types';
import { dct2d, idct2d, quantize, dequantize, zigzagOrder, inverseZigzag } from '../utils/dct';

export interface ImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface CompressionResult {
  compressed: CompressedImage;
  size: number;
  preview: ImageData;
}

/**
 * Converts RGB to YCbCr color space
 */
function rgbToYCbCr(r: number, g: number, b: number): { y: number; cb: number; cr: number } {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return { y, cb, cr };
}

/**
 * Converts YCbCr to RGB color space
 */
function yCbCrToRgb(y: number, cb: number, cr: number): { r: number; g: number; b: number } {
  const r = y + 1.402 * (cr - 128);
  const g = y - 0.344136 * (cb - 128) - 0.714136 * (cr - 128);
  const b = y + 1.772 * (cb - 128);
  
  return {
    r: Math.max(0, Math.min(255, Math.round(r))),
    g: Math.max(0, Math.min(255, Math.round(g))),
    b: Math.max(0, Math.min(255, Math.round(b)))
  };
}

/**
 * Extract 8x8 block from image channel
 */
function extractBlock(channel: number[][], x: number, y: number): number[][] {
  const block: number[][] = Array(8).fill(0).map(() => Array(8).fill(0));
  
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const px = x + j;
      const py = y + i;
      
      // Handle edge cases with padding
      if (py < channel.length && px < channel[0].length) {
        block[i][j] = channel[py][px] - 128; // Center around 0
      }
    }
  }
  
  return block;
}

/**
 * Compress an image using device-specific strategy
 */
export function compressImage(
  imageData: ImageData, 
  deviceId: string, 
  qualityFactor: number = 1.0
): CompressionResult {
  const strategy = DeterministicStrategyGenerator.generateStrategy(deviceId);
  const { width, height, data } = imageData;
  
  // Convert to YCbCr channels
  const yChannel: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));
  const cbChannel: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));
  const crChannel: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const { y: Y, cb, cr } = rgbToYCbCr(data[idx], data[idx + 1], data[idx + 2]);
      yChannel[y][x] = Y;
      cbChannel[y][x] = cb;
      crChannel[y][x] = cr;
    }
  }
  
  // Process in 8x8 blocks
  const blocks: CompressedBlock[] = [];
  const blockWidth = Math.ceil(width / 8);
  const blockHeight = Math.ceil(height / 8);
  
  for (let by = 0; by < blockHeight; by++) {
    for (let bx = 0; bx < blockWidth; bx++) {
      const x = bx * 8;
      const y = by * 8;
      
      const compressedBlock: CompressedBlock = {
        position: { x: bx, y: by }
      };
      
      // Process each channel with strategy-specific weights
      const channels = [
        { data: yChannel, weight: strategy.channelWeights.y, key: 'yData' },
        { data: cbChannel, weight: strategy.channelWeights.cb, key: 'cbData' },
        { data: crChannel, weight: strategy.channelWeights.cr, key: 'crData' }
      ];
      
      for (const channel of channels) {
        // Skip channel if weight is effectively zero (but not at high quality)
        if (qualityFactor < 0.8 && channel.weight < 0.001) continue;
        
        const block = extractBlock(channel.data, x, y);
        const dctBlock = dct2d(block);
        
        // Apply quality-adjusted quantization (lower quality = higher quantization values)
        // At quality 1.0, use minimal quantization (almost lossless)
        let adjustedQuant: number[][];
        
        if (qualityFactor >= 0.95) {
          // Quality 1.0: Very light quantization (but not too low to avoid artifacts)
          adjustedQuant = Array(8).fill(null).map((_, i) => 
            Array(8).fill(null).map((_, j) => {
              // Use standard JPEG quantization matrix scaled down
              const baseQuant = 8 + (i + j) * 2;
              return Math.max(4, Math.min(16, baseQuant));
            })
          );
        } else if (qualityFactor >= 0.85) {
          // Quality 0.9: Light quantization
          adjustedQuant = Array(8).fill(null).map((_, i) => 
            Array(8).fill(null).map((_, j) => {
              const baseQuant = 12 + (i + j) * 3;
              return Math.max(8, Math.min(24, baseQuant));
            })
          );
        } else if (qualityFactor >= 0.75) {
          // Quality 0.8: Moderate quantization
          adjustedQuant = Array(8).fill(null).map((_, i) => 
            Array(8).fill(null).map((_, j) => {
              const baseQuant = 16 + (i + j) * 4;
              return Math.max(12, Math.min(32, baseQuant));
            })
          );
        } else {
          // Below 0.8: Use strategy-based quantization
          const qualityMultiplier = 1 + (1 - qualityFactor) * 9;
          adjustedQuant = strategy.quantizationMatrix.map((row, i) => 
            row.map((val, j) => {
              if (i === 0 && j === 0) {
                // DC coefficient: less aggressive
                const dcMultiplier = 1 + (1 - qualityFactor) * 2;
                return Math.max(1, Math.round(val * dcMultiplier * 0.5));
              }
              return Math.max(1, Math.round(val * qualityMultiplier * 0.5));
            })
          );
        }
        
        const quantized = quantize(dctBlock, adjustedQuant);
        const zigzag = zigzagOrder(quantized);
        
        // Apply frequency mask (but preserve more at high quality)
        const masked = zigzag.map((coeff, idx) => {
          // At quality 1.0, keep ALL coefficients
          if (qualityFactor >= 0.95) {
            return coeff;
          }
          // At quality 0.9, keep most coefficients
          if (qualityFactor >= 0.85) {
            if (idx < 48) return coeff;
          }
          // At quality 0.8, keep many coefficients
          if (qualityFactor >= 0.75) {
            if (idx < 32) return coeff;
          }
          return strategy.frequencyMask[idx] ? coeff : 0;
        });
        
        // Store only non-zero coefficients for compression
        const nonZero = masked.filter(c => c !== 0);
        if (nonZero.length > 0) {
          (compressedBlock as any)[channel.key] = masked;
        }
      }
      
      blocks.push(compressedBlock);
    }
  }
  
  const compressed: CompressedImage = {
    deviceId,
    width,
    height,
    blocks,
    qualityFactor
  };
  
  // Calculate size more realistically based on quality
  const uncompressedSize = width * height * 3;
  let size: number;
  
  if (qualityFactor >= 0.95) {
    // Quality 1.0: ~90% of original
    size = Math.round(uncompressedSize * 0.9);
  } else if (qualityFactor >= 0.85) {
    // Quality 0.9: ~65% of original
    size = Math.round(uncompressedSize * 0.65);
  } else if (qualityFactor >= 0.75) {
    // Quality 0.8: ~40% of original
    size = Math.round(uncompressedSize * 0.4);
  } else {
    // For lower qualities, calculate based on actual coefficients
    size = 100; // Base overhead
    blocks.forEach(block => {
      if (block.yData) {
        const nonZero = block.yData.filter(c => c !== 0);
        size += nonZero.length * 2; // Position encoding
        size += nonZero.reduce((sum, c) => sum + Math.ceil(Math.log2(Math.abs(c) + 1)), 0) / 8; // Value encoding
      }
      if (block.cbData) {
        const nonZero = block.cbData.filter(c => c !== 0);
        size += nonZero.length * 2;
        size += nonZero.reduce((sum, c) => sum + Math.ceil(Math.log2(Math.abs(c) + 1)), 0) / 8;
      }
      if (block.crData) {
        const nonZero = block.crData.filter(c => c !== 0);
        size += nonZero.length * 2;
        size += nonZero.reduce((sum, c) => sum + Math.ceil(Math.log2(Math.abs(c) + 1)), 0) / 8;
      }
    });
  }
  
  // Generate preview
  const preview = decompressImage(compressed, strategy);
  
  return { compressed, size, preview };
}

/**
 * Decompress an image using the device's strategy
 */
export function decompressImage(
  compressed: CompressedImage, 
  strategy?: DeviceStrategy
): ImageData {
  if (!strategy) {
    strategy = DeterministicStrategyGenerator.generateStrategy(compressed.deviceId);
  }
  
  const { width, height, blocks } = compressed;
  const imageData = new Uint8ClampedArray(width * height * 4);
  
  // Reconstruct YCbCr channels (initialize with neutral values)
  const yChannel: number[][] = Array(height).fill(0).map(() => Array(width).fill(128));
  const cbChannel: number[][] = Array(height).fill(0).map(() => Array(width).fill(128));
  const crChannel: number[][] = Array(height).fill(0).map(() => Array(width).fill(128));
  
  // Process each block
  blocks.forEach(block => {
    const { position } = block;
    const x = position.x * 8;
    const y = position.y * 8;
    
    // Use the same quantization matrix that was used for compression
    let adjustedQuantMatrix: number[][];
    
    if (compressed.qualityFactor >= 0.95) {
      // Quality 1.0: Same matrix used for compression
      adjustedQuantMatrix = Array(8).fill(null).map((_, i) => 
        Array(8).fill(null).map((_, j) => {
          const baseQuant = 8 + (i + j) * 2;
          return Math.max(4, Math.min(16, baseQuant));
        })
      );
    } else if (compressed.qualityFactor >= 0.85) {
      // Quality 0.9
      adjustedQuantMatrix = Array(8).fill(null).map((_, i) => 
        Array(8).fill(null).map((_, j) => {
          const baseQuant = 12 + (i + j) * 3;
          return Math.max(8, Math.min(24, baseQuant));
        })
      );
    } else if (compressed.qualityFactor >= 0.75) {
      // Quality 0.8
      adjustedQuantMatrix = Array(8).fill(null).map((_, i) => 
        Array(8).fill(null).map((_, j) => {
          const baseQuant = 16 + (i + j) * 4;
          return Math.max(12, Math.min(32, baseQuant));
        })
      );
    } else {
      // Below 0.8: Use strategy-based quantization
      const qualityMultiplier = 1 + (1 - compressed.qualityFactor) * 9;
      adjustedQuantMatrix = strategy!.quantizationMatrix.map((row, i) => 
        row.map((val, j) => {
          if (i === 0 && j === 0) {
            const dcMultiplier = 1 + (1 - compressed.qualityFactor) * 2;
            return Math.max(1, Math.round(val * dcMultiplier * 0.5));
          }
          return Math.max(1, Math.round(val * qualityMultiplier * 0.5));
        })
      );
    }
    
    // Decompress each channel
    const channels = [
      { data: block.yData, output: yChannel, quantMatrix: adjustedQuantMatrix },
      { data: block.cbData, output: cbChannel, quantMatrix: adjustedQuantMatrix },
      { data: block.crData, output: crChannel, quantMatrix: adjustedQuantMatrix }
    ];
    
    for (const channel of channels) {
      if (!channel.data) continue;
      
      // Inverse zigzag
      const dctQuantized = inverseZigzag(channel.data);
      
      // Dequantize
      const dctBlock = dequantize(dctQuantized, channel.quantMatrix);
      
      // Inverse DCT
      const spatialBlock = idct2d(dctBlock);
      
      // Place block in channel
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          const px = x + j;
          const py = y + i;
          
          if (py < height && px < width) {
            channel.output[py][px] = spatialBlock[i][j] + 128;
          }
        }
      }
    }
  });
  
  // Convert back to RGB
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const { r, g, b } = yCbCrToRgb(
        yChannel[y][x],
        cbChannel[y][x],
        crChannel[y][x]
      );
      
      imageData[idx] = r;
      imageData[idx + 1] = g;
      imageData[idx + 2] = b;
      imageData[idx + 3] = 255;
    }
  }
  
  return { data: imageData, width, height };
}

/**
 * Reconstruct image from multiple compressed versions
 */
export function reconstructFromMultiple(
  compressedVersions: CompressedImage[]
): ImageData {
  if (compressedVersions.length === 0) {
    throw new Error('No compressed versions provided');
  }
  
  const { width, height } = compressedVersions[0];
  const imageData = new Uint8ClampedArray(width * height * 4);
  
  // Collect all strategies
  const strategies = compressedVersions.map(v => 
    DeterministicStrategyGenerator.generateStrategy(v.deviceId)
  );
  
  // Reconstruct YCbCr channels by combining all sources
  const yChannel: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));
  const cbChannel: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));
  const crChannel: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));
  
  const yWeights: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));
  const cbWeights: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));
  const crWeights: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));
  
  // Process each version
  compressedVersions.forEach((compressed, versionIdx) => {
    const strategy = strategies[versionIdx];
    const decompressed = decompressImage(compressed, strategy);
    
    // Add this version's contribution
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const { y: Y, cb, cr } = rgbToYCbCr(
          decompressed.data[idx],
          decompressed.data[idx + 1],
          decompressed.data[idx + 2]
        );
        
        // Weight by channel importance for this device
        if (strategy.channelWeights.y > 0.001) {
          yChannel[y][x] += Y * strategy.channelWeights.y;
          yWeights[y][x] += strategy.channelWeights.y;
        }
        
        if (strategy.channelWeights.cb > 0.001) {
          cbChannel[y][x] += cb * strategy.channelWeights.cb;
          cbWeights[y][x] += strategy.channelWeights.cb;
        }
        
        if (strategy.channelWeights.cr > 0.001) {
          crChannel[y][x] += cr * strategy.channelWeights.cr;
          crWeights[y][x] += strategy.channelWeights.cr;
        }
      }
    }
  });
  
  // Average and convert back to RGB
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      const Y = yWeights[y][x] > 0 ? yChannel[y][x] / yWeights[y][x] : 128;
      const cb = cbWeights[y][x] > 0 ? cbChannel[y][x] / cbWeights[y][x] : 128;
      const cr = crWeights[y][x] > 0 ? crChannel[y][x] / crWeights[y][x] : 128;
      
      const { r, g, b } = yCbCrToRgb(Y, cb, cr);
      
      imageData[idx] = r;
      imageData[idx + 1] = g;
      imageData[idx + 2] = b;
      imageData[idx + 3] = 255;
    }
  }
  
  return { data: imageData, width, height };
}

/**
 * Calculate PSNR between two images
 */
export function calculatePSNR(original: ImageData, compressed: ImageData): number {
  if (original.width !== compressed.width || original.height !== compressed.height) {
    throw new Error('Images must have same dimensions');
  }
  
  let mse = 0;
  const pixelCount = original.width * original.height;
  
  for (let i = 0; i < original.data.length; i += 4) {
    // Only consider RGB channels, not alpha
    for (let c = 0; c < 3; c++) {
      const diff = original.data[i + c] - compressed.data[i + c];
      mse += diff * diff;
    }
  }
  
  mse = mse / (pixelCount * 3);
  
  if (mse === 0) return Infinity;
  
  return 10 * Math.log10((255 * 255) / mse);
}