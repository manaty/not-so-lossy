import { compressImage, decompressImage } from '../../src/compression/image-compressor';
import { ImageData } from '../../src/compression/image-compressor';
import { DeterministicStrategyGenerator } from '../../src/core/deterministic-strategy';

describe('TEST-DEVICE Issue Investigation', () => {
  it('should compare TEST-DEVICE vs DEVICE-001 quantization', () => {
    const testStrategy = DeterministicStrategyGenerator.generateStrategy('TEST-DEVICE');
    const device001Strategy = DeterministicStrategyGenerator.generateStrategy('DEVICE-001');
    
    console.log('TEST-DEVICE:');
    console.log('- Y weight:', testStrategy.channelWeights.y);
    console.log('- Quantization[0][0]:', testStrategy.quantizationMatrix[0][0]);
    
    console.log('\nDEVICE-001:');
    console.log('- Y weight:', device001Strategy.channelWeights.y);
    console.log('- Quantization[0][0]:', device001Strategy.quantizationMatrix[0][0]);
  });

  it('should trace TEST-DEVICE white compression in detail', () => {
    // Create a small white image
    const width = 8;
    const height = 8;
    const whiteImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    // Fill with white
    for (let i = 0; i < whiteImage.data.length; i += 4) {
      whiteImage.data[i] = 255;
      whiteImage.data[i + 1] = 255;
      whiteImage.data[i + 2] = 255;
      whiteImage.data[i + 3] = 255;
    }

    console.log('\n=== First Compression ===');
    const result1 = compressImage(whiteImage, 'TEST-DEVICE', 1.0);
    console.log('Y DC coefficient:', result1.compressed.blocks[0].yData?.[0]);
    
    const decompressed1 = decompressImage(result1.compressed);
    console.log('Result:', decompressed1.data[0], decompressed1.data[1], decompressed1.data[2]);
    
    console.log('\n=== Second Compression (from decompressed) ===');
    const result2 = compressImage(decompressed1, 'TEST-DEVICE', 0.8);
    console.log('Y DC coefficient:', result2.compressed.blocks[0].yData?.[0]);
    
    const decompressed2 = decompressImage(result2.compressed);
    console.log('Result:', decompressed2.data[0], decompressed2.data[1], decompressed2.data[2]);
    
    // Check the actual quantization values used
    const strategy = DeterministicStrategyGenerator.generateStrategy('TEST-DEVICE');
    const qualityMultiplier = 1 + (1 - 0.8) * 9; // For quality=0.8
    const quantValue = strategy.quantizationMatrix[0][0];
    console.log('\nQuantization details:');
    console.log('- Base quant[0][0]:', quantValue);
    console.log('- Quality multiplier for 0.8:', qualityMultiplier);
    console.log('- Effective quantization:', quantValue * qualityMultiplier);
  });

  it('should test if issue is quality-factor related', () => {
    const width = 8;
    const height = 8;
    const whiteImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4).fill(255)
    };

    console.log('\n=== Quality Factor Test ===');
    
    // First compression at quality 1.0
    const result1 = compressImage(whiteImage, 'TEST-DEVICE', 1.0);
    const decompressed1 = decompressImage(result1.compressed);
    console.log('After compression at quality 1.0:', decompressed1.data[0]);
    
    // Recompress at different qualities
    const qualities = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5];
    qualities.forEach(q => {
      const result = compressImage(decompressed1, 'TEST-DEVICE', q);
      const decompressed = decompressImage(result.compressed);
      console.log(`Recompressed at quality ${q}:`, decompressed.data[0]);
    });
  });
});