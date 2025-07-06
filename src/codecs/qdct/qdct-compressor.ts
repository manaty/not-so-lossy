import { QDCTStrategyGenerator } from './qdct-strategy';
import { QDCTCompressedImage, QDCTCompressedBlock } from './qdct-types';
import { dct2d, idct2d, quantize, dequantize, zigzagOrder, inverseZigzag } from '../dct/dct-utils';

export interface ImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface CompressionResult {
  compressed: QDCTCompressedImage;
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
 * Compress image using QDCT with specified compression level
 */
export function compressImage(
  imageData: ImageData, 
  deviceId: string, 
  compressionLevel: number,
  previousCompressed?: QDCTCompressedImage
): CompressionResult {
  const { width, height, data } = imageData;
  const blocks: QDCTCompressedBlock[] = [];
  
  // Generate device strategy
  const strategy = QDCTStrategyGenerator.generateStrategy(deviceId);
  
  // Get base quantization matrix
  const baseMatrix = QDCTStrategyGenerator.getStandardMatrix();
  
  // Apply progressive quantization based on compression level
  const quantMatrix = QDCTStrategyGenerator.applyProgressiveQuantization(
    baseMatrix,
    strategy,
    compressionLevel
  );
  
  // If we have a previous compressed version, we can reuse some data
  const startingLevel = previousCompressed?.compressionLevel || 0;
  const isIncremental = previousCompressed && 
                       previousCompressed.deviceId === deviceId &&
                       compressionLevel > startingLevel;
  
  // Process 8x8 blocks
  for (let y = 0; y < height; y += 8) {
    for (let x = 0; x < width; x += 8) {
      const blockData = extractBlock(data, width, height, x, y);
      
      // Apply DCT to each channel
      const yDct = dct2d(blockData.y);
      const cbDct = dct2d(blockData.cb);
      const crDct = dct2d(blockData.cr);
      
      // Quantize with progressive matrix
      const yQuant = quantize(yDct, quantMatrix);
      const cbQuant = quantize(cbDct, quantMatrix);
      const crQuant = quantize(crDct, quantMatrix);
      
      // Zigzag and store
      const compressedBlock: QDCTCompressedBlock = {
        position: { x, y },
        yData: zigzagOrder(yQuant),
        cbData: zigzagOrder(cbQuant),
        crData: zigzagOrder(crQuant)
      };
      
      blocks.push(compressedBlock);
    }
  }
  
  const compressed: QDCTCompressedImage = {
    deviceId,
    width,
    height,
    blocks,
    compressionLevel
  };
  
  // Calculate size
  const size = calculateCompressedSize(compressed);
  
  // Generate preview
  const preview = decompressImage(compressed);
  
  return { compressed, size, preview };
}

/**
 * Decompress QDCT compressed image
 */
export function decompressImage(compressed: QDCTCompressedImage): ImageData {
  const { width, height, blocks, deviceId, compressionLevel } = compressed;
  console.log(`Decompressing image: ${width}x${height}, ${blocks.length} blocks`);
  const result = new Uint8ClampedArray(width * height * 4);
  
  // Generate device strategy
  const strategy = QDCTStrategyGenerator.generateStrategy(deviceId);
  
  // Get base quantization matrix
  const baseMatrix = QDCTStrategyGenerator.getStandardMatrix();
  
  // Apply progressive quantization based on compression level
  const quantMatrix = QDCTStrategyGenerator.applyProgressiveQuantization(
    baseMatrix,
    strategy,
    compressionLevel
  );
  
  let processedBlocks = 0;
  const totalBlocks = blocks.length;
  const logInterval = Math.floor(totalBlocks / 10); // Log every 10%
  
  blocks.forEach((block, index) => {
    if (index % logInterval === 0) {
      console.log(`Decompressing: ${((index / totalBlocks) * 100).toFixed(0)}% complete (${index}/${totalBlocks} blocks)`);
    }
    
    const { position, yData, cbData, crData } = block;
    
    // Inverse zigzag
    const yQuant = inverseZigzag(yData || []);
    const cbQuant = inverseZigzag(cbData || []);
    const crQuant = inverseZigzag(crData || []);
    
    // Dequantize
    const yDct = dequantize(yQuant, quantMatrix);
    const cbDct = dequantize(cbQuant, quantMatrix);
    const crDct = dequantize(crQuant, quantMatrix);
    
    // Inverse DCT
    const y = idct2d(yDct);
    const cb = idct2d(cbDct);
    const cr = idct2d(crDct);
    
    // Convert back to RGB and write to result
    for (let by = 0; by < 8; by++) {
      for (let bx = 0; bx < 8; bx++) {
        const px = position.x + bx;
        const py = position.y + by;
        
        if (px < width && py < height) {
          const idx = (py * width + px) * 4;
          const blockIdx = by * 8 + bx;
          
          const { r, g, b } = yCbCrToRgb(
            y[Math.floor(blockIdx / 8)][blockIdx % 8] + 128,
            cb[Math.floor(blockIdx / 8)][blockIdx % 8] + 128,
            cr[Math.floor(blockIdx / 8)][blockIdx % 8] + 128
          );
          
          result[idx] = r;
          result[idx + 1] = g;
          result[idx + 2] = b;
          result[idx + 3] = 255;
        }
      }
    }
  });
  
  console.log('Decompression complete');
  return { data: result, width, height };
}

/**
 * Recompress to a higher compression level
 */
export function recompressToLevel(
  compressed: QDCTCompressedImage,
  newLevel: number
): CompressionResult {
  if (newLevel <= compressed.compressionLevel) {
    throw new Error('New compression level must be higher than current level');
  }
  
  // Decompress current image
  const decompressed = decompressImage(compressed);
  
  // Recompress with new level, passing the previous compressed data
  return compressImage(decompressed, compressed.deviceId, newLevel, compressed);
}

/**
 * Async version of recompress that can use GPU decompression
 */
export async function recompressToLevelAsync(
  compressed: QDCTCompressedImage,
  newLevel: number,
  decompressAsync?: (compressed: QDCTCompressedImage) => Promise<ImageData>
): Promise<CompressionResult> {
  if (newLevel <= compressed.compressionLevel) {
    throw new Error('New compression level must be higher than current level');
  }
  
  // Decompress current image - use async if provided
  const decompressed = decompressAsync 
    ? await decompressAsync(compressed)
    : decompressImage(compressed);
  
  // Recompress with new level, passing the previous compressed data
  return compressImage(decompressed, compressed.deviceId, newLevel, compressed);
}

/**
 * Extract 8x8 block and convert to YCbCr channels
 */
function extractBlock(
  data: Uint8ClampedArray, 
  width: number, 
  height: number, 
  x: number, 
  y: number
): { y: number[][], cb: number[][], cr: number[][] } {
  const yBlock: number[][] = [];
  const cbBlock: number[][] = [];
  const crBlock: number[][] = [];
  
  for (let j = 0; j < 8; j++) {
    yBlock[j] = [];
    cbBlock[j] = [];
    crBlock[j] = [];
    
    for (let i = 0; i < 8; i++) {
      const px = x + i;
      const py = y + j;
      
      if (px < width && py < height) {
        const idx = (py * width + px) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        const ycbcr = rgbToYCbCr(r, g, b);
        yBlock[j][i] = ycbcr.y - 128;
        cbBlock[j][i] = ycbcr.cb - 128;
        crBlock[j][i] = ycbcr.cr - 128;
      } else {
        yBlock[j][i] = 0;
        cbBlock[j][i] = 0;
        crBlock[j][i] = 0;
      }
    }
  }
  
  return { y: yBlock, cb: cbBlock, cr: crBlock };
}

/**
 * Calculate compressed size in bytes (matches NSL format)
 */
function calculateCompressedSize(compressed: QDCTCompressedImage): number {
  let size = 0;
  
  // Header
  size += 3;  // 'NSL' magic
  size += 1;  // version
  
  // Metadata
  size += 4;  // width
  size += 4;  // height
  size += 4;  // compressionLevel  
  size += 1;  // deviceId length
  size += compressed.deviceId.length;  // deviceId string
  size += 4;  // blocks count
  
  // Blocks
  compressed.blocks.forEach(block => {
    size += 4; // position (2 * uint16)
    
    // Y channel
    if (block.yData) {
      const nonZeroCount = block.yData.filter(c => c !== 0).length;
      size += 2; // count (uint16)
      size += nonZeroCount * 3; // each coefficient: 1 byte index + 2 bytes value
    } else {
      size += 2; // count = 0
    }
    
    // Cb channel
    if (block.cbData) {
      const nonZeroCount = block.cbData.filter(c => c !== 0).length;
      size += 2; // count
      size += nonZeroCount * 3;
    } else {
      size += 2; // count = 0
    }
    
    // Cr channel
    if (block.crData) {
      const nonZeroCount = block.crData.filter(c => c !== 0).length;
      size += 2; // count
      size += nonZeroCount * 3;
    } else {
      size += 2; // count = 0
    }
  });
  
  return size;
}

/**
 * Reconstruct from multiple QDCT compressed versions
 */
export function reconstructFromMultiple(
  compressedVersions: QDCTCompressedImage[]
): ImageData {
  if (compressedVersions.length === 0) {
    throw new Error('No compressed versions provided');
  }
  
  const { width, height } = compressedVersions[0];
  const result = new Uint8ClampedArray(width * height * 4);
  
  // Generate strategies and quantization matrices for each device
  const deviceInfo = compressedVersions.map(compressed => {
    const strategy = QDCTStrategyGenerator.generateStrategy(compressed.deviceId);
    const baseMatrix = QDCTStrategyGenerator.getStandardMatrix();
    const quantMatrix = QDCTStrategyGenerator.applyProgressiveQuantization(
      baseMatrix,
      strategy,
      compressed.compressionLevel
    );
    return {
      compressed,
      strategy,
      quantMatrix
    };
  });
  
  // Process each 8x8 block
  for (let by = 0; by < height; by += 8) {
    for (let bx = 0; bx < width; bx += 8) {
      // Find the block for this position from each device
      const blocks = deviceInfo.map(info => {
        const block = info.compressed.blocks.find(
          b => b.position.x === bx && b.position.y === by
        );
        return { block, quantMatrix: info.quantMatrix };
      }).filter((item): item is { block: QDCTCompressedBlock; quantMatrix: number[][] } => 
        item.block !== undefined
      );
      
      if (blocks.length === 0) continue;
      
      // Reconstruct this block using lowest quantization per coefficient
      const reconstructedBlock = reconstructBlockFromMultiple(blocks);
      
      // Write reconstructed block to result
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const px = bx + x;
          const py = by + y;
          
          if (px < width && py < height) {
            const idx = (py * width + px) * 4;
            result[idx] = reconstructedBlock.r[y][x];
            result[idx + 1] = reconstructedBlock.g[y][x];
            result[idx + 2] = reconstructedBlock.b[y][x];
            result[idx + 3] = 255;
          }
        }
      }
    }
  }
  
  return { data: result, width, height };
}

/**
 * Reconstruct a single block from multiple compressed versions
 */
function reconstructBlockFromMultiple(
  blocks: Array<{ block: QDCTCompressedBlock; quantMatrix: number[][] }>
): { r: number[][], g: number[][], b: number[][] } {
  // Initialize result arrays
  const r: number[][] = Array(8).fill(0).map(() => Array(8).fill(0));
  const g: number[][] = Array(8).fill(0).map(() => Array(8).fill(0));
  const b: number[][] = Array(8).fill(0).map(() => Array(8).fill(0));
  
  // For each coefficient position, use the value from the device with lowest quantization
  for (let i = 0; i < 64; i++) {
    const row = Math.floor(i / 8);
    const col = i % 8;
    
    // Find device with lowest quantization value for this coefficient
    let bestDevice = 0;
    let lowestQuant = blocks[0].quantMatrix[row][col];
    
    for (let d = 1; d < blocks.length; d++) {
      if (blocks[d].quantMatrix[row][col] < lowestQuant) {
        lowestQuant = blocks[d].quantMatrix[row][col];
        bestDevice = d;
      }
    }
    
    // Use the coefficient from the best device
    const block = blocks[bestDevice].block;
    
    // Dequantize and inverse DCT for this device's data
    const yQuant = inverseZigzag(block.yData || []);
    const cbQuant = inverseZigzag(block.cbData || []);
    const crQuant = inverseZigzag(block.crData || []);
    
    const yDct = dequantize(yQuant, blocks[bestDevice].quantMatrix);
    const cbDct = dequantize(cbQuant, blocks[bestDevice].quantMatrix);
    const crDct = dequantize(crQuant, blocks[bestDevice].quantMatrix);
    
    // Store the coefficient values
    // Note: We need to do full reconstruction per device and then select
    // This is a simplified approach - ideally we'd select in frequency domain
  }
  
  // Actually, we need to reconstruct differently
  // Let's select coefficients in frequency domain and then do one inverse DCT
  const ySelected = selectBestCoefficients(blocks, 'y');
  const cbSelected = selectBestCoefficients(blocks, 'cb');
  const crSelected = selectBestCoefficients(blocks, 'cr');
  
  // Inverse DCT on selected coefficients
  const yBlock = idct2d(ySelected);
  const cbBlock = idct2d(cbSelected);
  const crBlock = idct2d(crSelected);
  
  // Convert YCbCr to RGB
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const rgb = yCbCrToRgb(
        yBlock[y][x] + 128,
        cbBlock[y][x] + 128,
        crBlock[y][x] + 128
      );
      r[y][x] = rgb.r;
      g[y][x] = rgb.g;
      b[y][x] = rgb.b;
    }
  }
  
  return { r, g, b };
}

/**
 * Select best coefficients from multiple devices based on lowest quantization
 */
function selectBestCoefficients(
  blocks: Array<{ block: QDCTCompressedBlock; quantMatrix: number[][] }>,
  channel: 'y' | 'cb' | 'cr'
): number[][] {
  const result: number[][] = Array(8).fill(0).map(() => Array(8).fill(0));
  
  // First, dequantize all blocks
  const dequantizedBlocks = blocks.map(item => {
    const block = item.block;
    let data: number[] = [];
    
    switch (channel) {
      case 'y':
        data = block.yData || [];
        break;
      case 'cb':
        data = block.cbData || [];
        break;
      case 'cr':
        data = block.crData || [];
        break;
    }
    
    const quantized = inverseZigzag(data);
    const dequantized = dequantize(quantized, item.quantMatrix);
    
    return {
      dequantized,
      quantMatrix: item.quantMatrix
    };
  });
  
  // For each coefficient position, select from device with lowest quantization
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      // Find device with lowest quantization for this position
      let bestDevice = 0;
      let lowestQuant = blocks[0].quantMatrix[row][col];
      
      for (let d = 1; d < blocks.length; d++) {
        if (blocks[d].quantMatrix[row][col] < lowestQuant) {
          lowestQuant = blocks[d].quantMatrix[row][col];
          bestDevice = d;
        }
      }
      
      // Use the coefficient from the best device
      result[row][col] = dequantizedBlocks[bestDevice].dequantized[row][col];
    }
  }
  
  return result;
}

/**
 * Calculate PSNR between two images
 */
export function calculatePSNR(original: ImageData, compressed: ImageData): number {
  if (original.width !== compressed.width || original.height !== compressed.height) {
    throw new Error('Images must have the same dimensions');
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
  
  if (mse === 0) {
    return Infinity;
  }
  
  const maxPixelValue = 255;
  return 10 * Math.log10((maxPixelValue * maxPixelValue) / mse);
}