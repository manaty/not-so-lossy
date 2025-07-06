import { compressImage } from '../../src/codecs/dct/dct-compressor';
import { ImageData } from '../../src/codecs/dct/dct-compressor';

describe('Compression Debug Tests', () => {
  it('should debug white image compression', () => {
    // Create a small white image
    const width = 8;
    const height = 8;
    const testImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    // Fill with white
    for (let i = 0; i < testImage.data.length; i += 4) {
      testImage.data[i] = 255;     // R
      testImage.data[i + 1] = 255; // G
      testImage.data[i + 2] = 255; // B
      testImage.data[i + 3] = 255; // A
    }

    // Get strategy to debug
    const { DeterministicStrategyGenerator } = require('../../src/codecs/dct/dct-strategy');
    const strategy = DeterministicStrategyGenerator.generateStrategy('TEST-DEVICE');
    console.log('Channel weights:', strategy.channelWeights);
    
    // Compress with high quality
    const result = compressImage(testImage, 'TEST-DEVICE', 1.0);
    
    // Check compressed data
    console.log('Compressed blocks:', result.compressed.blocks.length);
    console.log('First block:', JSON.stringify(result.compressed.blocks[0], null, 2));
    
    // Check decompressed result
    const decompressed = result.preview;
    console.log('First pixel (should be white):', 
      decompressed.data[0], decompressed.data[1], decompressed.data[2]);
    console.log('Center pixel:', 
      decompressed.data[16], decompressed.data[17], decompressed.data[18]);
      
    // The compressed size should be reasonable
    expect(result.compressed.blocks.length).toBeGreaterThan(0);
    expect(result.size).toBeGreaterThan(0);
    
    // At least the first pixel should be close to white
    expect(decompressed.data[0]).toBeGreaterThan(200);
  });

  it('should debug red image compression', () => {
    // Create a small red image
    const width = 8;
    const height = 8;
    const testImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    // Fill with red
    for (let i = 0; i < testImage.data.length; i += 4) {
      testImage.data[i] = 255;     // R
      testImage.data[i + 1] = 0;   // G
      testImage.data[i + 2] = 0;   // B
      testImage.data[i + 3] = 255; // A
    }

    // Compress
    const result = compressImage(testImage, 'TEST-DEVICE', 1.0);
    const decompressed = result.preview;
    
    console.log('Red image - First pixel:', 
      decompressed.data[0], decompressed.data[1], decompressed.data[2]);
      
    // Should be reddish
    expect(decompressed.data[0]).toBeGreaterThan(decompressed.data[1]); // R > G
    expect(decompressed.data[0]).toBeGreaterThan(decompressed.data[2]); // R > B
  });
});