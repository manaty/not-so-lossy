import { DCTCompressedImage, DCTCompressedBlock } from './dct-types';
import { ImageData } from './dct-compressor';
import { inverseZigzag, idct2d, dequantize } from './dct-utils';
import { DeterministicStrategyGenerator } from './dct-strategy';

interface BlockCoefficients {
  y: Map<number, { value: number; quality: number }[]>;
  cb: Map<number, { value: number; quality: number }[]>;
  cr: Map<number, { value: number; quality: number }[]>;
}

/**
 * Reconstruct image from multiple compressed versions using frequency domain combination
 */
export function reconstructFromMultipleFrequency(
  compressedVersions: DCTCompressedImage[]
): ImageData {
  if (compressedVersions.length === 0) {
    throw new Error('No compressed versions provided');
  }

  const { width, height } = compressedVersions[0];
  const blockWidth = Math.ceil(width / 8);
  const blockHeight = Math.ceil(height / 8);
  
  // Initialize output channels
  const yChannel: number[][] = Array(height).fill(0).map(() => Array(width).fill(128));
  const cbChannel: number[][] = Array(height).fill(0).map(() => Array(width).fill(128));
  const crChannel: number[][] = Array(height).fill(0).map(() => Array(width).fill(128));

  // Process each block position
  for (let by = 0; by < blockHeight; by++) {
    for (let bx = 0; bx < blockWidth; bx++) {
      // Collect all coefficients from all devices for this block position
      const blockCoeffs: BlockCoefficients = {
        y: new Map(),
        cb: new Map(),
        cr: new Map()
      };

      // Gather coefficients from each device
      compressedVersions.forEach(compressed => {
        const strategy = DeterministicStrategyGenerator.generateStrategy(compressed.deviceId);
        const block = compressed.blocks.find(b => b.position.x === bx && b.position.y === by);
        
        if (block) {
          // Process Y channel
          if (block.yData) {
            block.yData.forEach((value, idx) => {
              if (value !== 0) {
                if (!blockCoeffs.y.has(idx)) {
                  blockCoeffs.y.set(idx, []);
                }
                blockCoeffs.y.get(idx)!.push({ value, quality: compressed.qualityFactor });
              }
            });
          }

          // Process Cb channel
          if (block.cbData) {
            block.cbData.forEach((value, idx) => {
              if (value !== 0) {
                if (!blockCoeffs.cb.has(idx)) {
                  blockCoeffs.cb.set(idx, []);
                }
                blockCoeffs.cb.get(idx)!.push({ value, quality: compressed.qualityFactor });
              }
            });
          }

          // Process Cr channel
          if (block.crData) {
            block.crData.forEach((value, idx) => {
              if (value !== 0) {
                if (!blockCoeffs.cr.has(idx)) {
                  blockCoeffs.cr.set(idx, []);
                }
                blockCoeffs.cr.get(idx)!.push({ value, quality: compressed.qualityFactor });
              }
            });
          }
        }
      });

      // Reconstruct the block using best available coefficients
      const reconstructedY = reconstructBlock(blockCoeffs.y);
      const reconstructedCb = reconstructBlock(blockCoeffs.cb);
      const reconstructedCr = reconstructBlock(blockCoeffs.cr);

      // Get a sample device for quantization matrix (use highest quality device)
      const bestQualityDevice = compressedVersions.reduce((best, current) => 
        current.qualityFactor > best.qualityFactor ? current : best
      );
      const strategy = DeterministicStrategyGenerator.generateStrategy(bestQualityDevice.deviceId);

      // Dequantize and inverse DCT
      const yBlock = performIDCT(reconstructedY, bestQualityDevice.qualityFactor, strategy.quantizationMatrix);
      const cbBlock = performIDCT(reconstructedCb, bestQualityDevice.qualityFactor, strategy.quantizationMatrix);
      const crBlock = performIDCT(reconstructedCr, bestQualityDevice.qualityFactor, strategy.quantizationMatrix);

      // Place blocks in output channels
      const x = bx * 8;
      const y = by * 8;
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          const px = x + j;
          const py = y + i;
          if (py < height && px < width) {
            yChannel[py][px] = yBlock[i][j] + 128;
            cbChannel[py][px] = cbBlock[i][j] + 128;
            crChannel[py][px] = crBlock[i][j] + 128;
          }
        }
      }
    }
  }

  // Convert to RGB
  const imageData = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const Y = yChannel[y][x];
      const Cb = cbChannel[y][x];
      const Cr = crChannel[y][x];

      // YCbCr to RGB conversion
      const r = Y + 1.402 * (Cr - 128);
      const g = Y - 0.344136 * (Cb - 128) - 0.714136 * (Cr - 128);
      const b = Y + 1.772 * (Cb - 128);

      imageData[idx] = Math.max(0, Math.min(255, Math.round(r)));
      imageData[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      imageData[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      imageData[idx + 3] = 255;
    }
  }

  return { data: imageData, width, height };
}

/**
 * Reconstruct a single channel block from multiple coefficient values
 */
function reconstructBlock(coeffMap: Map<number, { value: number; quality: number }[]>): number[] {
  const reconstructed = new Array(64).fill(0);

  coeffMap.forEach((values, position) => {
    if (values.length === 1) {
      // Only one device has this coefficient - use it directly
      reconstructed[position] = values[0].value;
    } else {
      // Multiple devices have this coefficient
      // Use the value from the highest quality device
      const bestValue = values.reduce((best, current) => 
        current.quality > best.quality ? current : best
      );
      reconstructed[position] = bestValue.value;

      // Alternative: use median for robustness
      // values.sort((a, b) => a.value - b.value);
      // reconstructed[position] = values[Math.floor(values.length / 2)].value;
    }
  });

  return reconstructed;
}

/**
 * Perform dequantization and inverse DCT
 */
function performIDCT(
  quantizedCoeffs: number[], 
  qualityFactor: number,
  baseQuantMatrix: number[][]
): number[][] {
  // Get appropriate quantization matrix based on quality
  let quantMatrix: number[][];
  
  if (qualityFactor >= 0.95) {
    quantMatrix = Array(8).fill(null).map((_, i) => 
      Array(8).fill(null).map((_, j) => {
        const baseQuant = 8 + (i + j) * 2;
        return Math.max(4, Math.min(16, baseQuant));
      })
    );
  } else if (qualityFactor >= 0.85) {
    quantMatrix = Array(8).fill(null).map((_, i) => 
      Array(8).fill(null).map((_, j) => {
        const baseQuant = 12 + (i + j) * 3;
        return Math.max(8, Math.min(24, baseQuant));
      })
    );
  } else if (qualityFactor >= 0.75) {
    quantMatrix = Array(8).fill(null).map((_, i) => 
      Array(8).fill(null).map((_, j) => {
        const baseQuant = 16 + (i + j) * 4;
        return Math.max(12, Math.min(32, baseQuant));
      })
    );
  } else {
    const qualityMultiplier = 1 + (1 - qualityFactor) * 9;
    quantMatrix = baseQuantMatrix.map((row, i) => 
      row.map((val, j) => {
        if (i === 0 && j === 0) {
          const dcMultiplier = 1 + (1 - qualityFactor) * 2;
          return Math.max(1, Math.round(val * dcMultiplier * 0.5));
        }
        return Math.max(1, Math.round(val * qualityMultiplier * 0.5));
      })
    );
  }

  // Inverse zigzag
  const dctQuantized = inverseZigzag(quantizedCoeffs);
  
  // Dequantize
  const dctBlock = dequantize(dctQuantized, quantMatrix);
  
  // Inverse DCT
  return idct2d(dctBlock);
}