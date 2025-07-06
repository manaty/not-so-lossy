import { Codec, ImageData, CodecResult, CodecOptions } from '../types';
import { QDCTCompressedImage } from './qdct-types';
import { 
  compressImage, 
  decompressImage, 
  reconstructFromMultiple as qdctReconstruct,
  calculatePSNR as qdctPSNR,
  recompressToLevel,
  recompressToLevelAsync
} from './qdct-compressor';
import { QDCTStrategyGenerator } from './qdct-strategy';
import { qdctWebGPU } from './webgpu/qdct-webgpu';

export class QDCTCodec implements Codec {
  name = 'qdct';
  
  private compressedCache = new Map<string, QDCTCompressedImage>();
  private webGPUEnabled = false;
  private webGPUInitialized = false;

  compress(image: ImageData, options: CodecOptions): CodecResult {
    // Convert quality (0.1-1.0) to compression level (0-63)
    // Higher quality = lower compression level
    const maxLevel = 63;
    const compressionLevel = Math.round((1 - options.quality) * maxLevel);
    
    // Check if we have a cached version for this device
    const cached = this.compressedCache.get(options.deviceId);
    
    let result;
    if (cached && cached.compressionLevel < compressionLevel) {
      // We can incrementally compress from the cached version
      result = recompressToLevel(cached, compressionLevel);
    } else {
      // Fresh compression (CPU only for sync method)
      result = compressImage(image, options.deviceId, compressionLevel);
    }
    
    // Update cache
    this.compressedCache.set(options.deviceId, result.compressed);
    
    return {
      compressed: result.compressed,
      size: result.size,
      preview: result.preview
    };
  }
  
  /**
   * Async compress method that can use WebGPU
   */
  async compressAsync(image: ImageData, options: CodecOptions): Promise<CodecResult> {
    // Convert quality (0.1-1.0) to compression level (0-63)
    // Higher quality = lower compression level
    const maxLevel = 63;
    const compressionLevel = Math.round((1 - options.quality) * maxLevel);
    console.log(`compressAsync: quality ${options.quality} -> compression level ${compressionLevel}`);
    
    // Use compressWithLevel which supports WebGPU
    return this.compressWithLevel(image, options.deviceId, compressionLevel);
  }

  decompress(compressed: QDCTCompressedImage, deviceId: string): ImageData {
    // For now, use synchronous CPU decompression to maintain compatibility
    // Use decompressAsync for WebGPU acceleration
    console.log('WARNING: Using synchronous CPU decompression. Use decompressAsync for GPU acceleration.');
    return decompressImage(compressed);
  }
  
  // Async version with WebGPU support
  async decompressAsync(compressed: QDCTCompressedImage, deviceId: string): Promise<ImageData> {
    console.log(`decompressAsync called. WebGPU enabled: ${this.webGPUEnabled}, initialized: ${this.webGPUInitialized}`);
    
    // Try WebGPU decompression first if enabled
    if (this.webGPUEnabled && this.webGPUInitialized) {
      console.log('Using WebGPU for decompression');
      const startTime = performance.now();
      
      const webGPUResult = await qdctWebGPU.decompressImage(compressed);
      
      if (webGPUResult) {
        const endTime = performance.now();
        console.log(`WebGPU decompression completed in ${(endTime - startTime).toFixed(2)}ms`);
        return webGPUResult;
      } else {
        console.warn('WebGPU decompression failed, falling back to CPU');
      }
    }
    
    // CPU decompression fallback
    return decompressImage(compressed);
  }

  reconstructFromMultiple(compressedVersions: QDCTCompressedImage[]): ImageData {
    return qdctReconstruct(compressedVersions);
  }

  calculatePSNR(original: ImageData, compressed: ImageData): number {
    return qdctPSNR(original, compressed);
  }

  /**
   * Generate device strategy (for inspection/debugging)
   */
  generateStrategy(deviceId: string): any {
    return QDCTStrategyGenerator.generateStrategy(deviceId);
  }

  /**
   * Get current compression level for a device
   */
  getCompressionLevel(deviceId: string): number | undefined {
    return this.compressedCache.get(deviceId)?.compressionLevel;
  }

  /**
   * Clear cache for a device
   */
  clearCache(deviceId?: string): void {
    if (deviceId) {
      this.compressedCache.delete(deviceId);
    } else {
      this.compressedCache.clear();
    }
  }

  /**
   * Get quantization matrix for a given compression level
   */
  getQuantizationMatrix(deviceId: string, compressionLevel: number): number[][] {
    const strategy = QDCTStrategyGenerator.generateStrategy(deviceId);
    const baseMatrix = QDCTStrategyGenerator.getStandardMatrix();
    return QDCTStrategyGenerator.applyProgressiveQuantization(
      baseMatrix,
      strategy,
      compressionLevel
    );
  }

  /**
   * Enable or disable WebGPU acceleration
   */
  async setWebGPUEnabled(enabled: boolean): Promise<boolean> {
    if (enabled && !this.webGPUInitialized) {
      const initialized = await qdctWebGPU.initialize();
      if (initialized) {
        this.webGPUInitialized = true;
        this.webGPUEnabled = true;
        console.log('WebGPU acceleration enabled for QDCT codec');
      } else {
        console.warn('Failed to initialize WebGPU, falling back to CPU');
        return false;
      }
    } else {
      this.webGPUEnabled = enabled;
    }
    return this.webGPUEnabled;
  }
  
  /**
   * Check if WebGPU is available and enabled
   */
  isWebGPUEnabled(): boolean {
    return this.webGPUEnabled && this.webGPUInitialized;
  }

  /**
   * Compress with explicit compression level (can be > 63)
   */
  async compressWithLevel(image: ImageData, deviceId: string, compressionLevel: number): Promise<CodecResult> {
    console.log(`compressWithLevel called: device=${deviceId}, level=${compressionLevel}`);
    
    // Check cache for lower level
    const cached = this.compressedCache.get(deviceId);
    console.log(`Cached compression found: ${cached ? `level ${cached.compressionLevel}` : 'none'}`);
    
    let result;
    if (cached && cached.compressionLevel < compressionLevel) {
      // We can incrementally compress from the cached version
      console.log(`Using incremental compression: ${cached.compressionLevel} -> ${compressionLevel}`);
      
      // Use async recompression with GPU decompression if available
      if (this.webGPUEnabled && this.webGPUInitialized) {
        console.log('Using GPU decompression for incremental compression');
        result = await recompressToLevelAsync(cached, compressionLevel, 
          (compressed) => this.decompressAsync(compressed, deviceId));
      } else {
        result = recompressToLevel(cached, compressionLevel);
      }
    } else {
      // Try WebGPU acceleration first
      if (this.webGPUEnabled && this.webGPUInitialized) {
        console.log(`Using WebGPU acceleration for compression (enabled: ${this.webGPUEnabled}, initialized: ${this.webGPUInitialized})`);
        const startTime = performance.now();
        
        const webGPUResult = await qdctWebGPU.compressImage(image, deviceId, compressionLevel);
        
        if (webGPUResult) {
          const endTime = performance.now();
          console.log(`WebGPU compression completed in ${(endTime - startTime).toFixed(2)}ms`);
          
          // Calculate size and generate preview
          console.log('Calculating compressed size...');
          const size = this.calculateCompressedSize(webGPUResult);
          console.log(`Compressed size: ${size} bytes (${(size / 1024 / 1024).toFixed(2)} MB)`);
          
          // For large images, skip preview generation to avoid blocking
          let preview: ImageData;
          if (webGPUResult.blocks.length > 50000) {
            console.log('Skipping preview generation for large image (>50k blocks)');
            // Create a placeholder preview
            preview = {
              data: new Uint8ClampedArray(4), // 1x1 pixel
              width: 1,
              height: 1
            };
          } else {
            console.log('Generating preview by decompressing...');
            // Use WebGPU decompression for preview if available
            preview = await this.decompressAsync(webGPUResult, deviceId);
            console.log('Preview generated');
          }
          
          result = { compressed: webGPUResult, size, preview };
        } else {
          console.warn('WebGPU compression failed, falling back to CPU');
          result = compressImage(image, deviceId, compressionLevel);
        }
      } else {
        // CPU compression
        result = compressImage(image, deviceId, compressionLevel);
      }
    }
    
    // Update cache
    this.compressedCache.set(deviceId, result.compressed);
    
    return {
      compressed: result.compressed,
      size: result.size,
      preview: result.preview
    };
  }
  
  /**
   * Helper to calculate compressed size
   */
  private calculateCompressedSize(compressed: QDCTCompressedImage): number {
    // Reuse the fixed calculateCompressedSize from qdct-compressor
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
   * Compress with sampling for size estimation (faster for large images)
   */
  async compressWithLevelSampled(image: ImageData, deviceId: string, compressionLevel: number, sampleSize: number = 100): Promise<CodecResult> {
    // For sampled compression, we'll compress a subset of blocks
    // and estimate the total size based on the sample
    const { width, height } = image;
    const blocksPerRow = Math.ceil(width / 8);
    const blocksPerCol = Math.ceil(height / 8);
    const totalBlocks = blocksPerRow * blocksPerCol;
    
    // If image is small enough, just do full compression
    if (totalBlocks <= sampleSize * 2) {
      return this.compressWithLevel(image, deviceId, compressionLevel);
    }
    
    // Select random block positions for sampling
    const sampledBlocks = new Set<number>();
    while (sampledBlocks.size < sampleSize) {
      sampledBlocks.add(Math.floor(Math.random() * totalBlocks));
    }
    
    // Create a sparse image with only sampled blocks
    const sampledData = new Uint8ClampedArray(image.data.length);
    
    // Copy only the sampled blocks
    for (const blockIndex of sampledBlocks) {
      const blockRow = Math.floor(blockIndex / blocksPerRow);
      const blockCol = blockIndex % blocksPerRow;
      const x = blockCol * 8;
      const y = blockRow * 8;
      
      // Copy the 8x8 block
      for (let dy = 0; dy < 8 && y + dy < height; dy++) {
        for (let dx = 0; dx < 8 && x + dx < width; dx++) {
          const srcIdx = ((y + dy) * width + (x + dx)) * 4;
          const dstIdx = srcIdx;
          sampledData[dstIdx] = image.data[srcIdx];
          sampledData[dstIdx + 1] = image.data[srcIdx + 1];
          sampledData[dstIdx + 2] = image.data[srcIdx + 2];
          sampledData[dstIdx + 3] = image.data[srcIdx + 3];
        }
      }
    }
    
    const sampledImage: ImageData = {
      data: sampledData,
      width,
      height
    };
    
    // Compress the sampled image
    const result = compressImage(sampledImage, deviceId, compressionLevel);
    
    // Estimate total size based on sample
    // Count non-zero blocks and coefficients in the sample
    let totalNonZeroCoeffs = 0;
    let sampleBlocksWithData = 0;
    
    result.compressed.blocks.forEach(block => {
      let hasData = false;
      if (block.yData) {
        const nonZero = block.yData.filter(v => v !== 0).length;
        if (nonZero > 0) {
          totalNonZeroCoeffs += nonZero;
          hasData = true;
        }
      }
      if (block.cbData) {
        const nonZero = block.cbData.filter(v => v !== 0).length;
        if (nonZero > 0) {
          totalNonZeroCoeffs += nonZero;
          hasData = true;
        }
      }
      if (block.crData) {
        const nonZero = block.crData.filter(v => v !== 0).length;
        if (nonZero > 0) {
          totalNonZeroCoeffs += nonZero;
          hasData = true;
        }
      }
      if (hasData) sampleBlocksWithData++;
    });
    
    // Calculate overhead per block (position + channel counts)
    const overheadPerBlock = 4 + 2 * 3; // position (4) + 3 channels * count (2)
    
    // Calculate average coefficients per sampled block
    const avgCoeffsPerBlock = sampleBlocksWithData > 0 ? totalNonZeroCoeffs / sampleBlocksWithData : 0;
    
    // Estimate total size
    const headerSize = 3 + 1 + 4 + 4 + 4 + 1 + deviceId.length + 4;
    const estimatedBlocksSize = totalBlocks * overheadPerBlock + (avgCoeffsPerBlock * totalBlocks * 3);
    const estimatedSize = Math.round(headerSize + estimatedBlocksSize);
    
    // Return with estimated size
    return {
      compressed: result.compressed,
      size: estimatedSize,
      preview: result.preview
    };
  }
}