import { compressImage, decompressImage } from '../../src/codecs/dct/dct-compressor';
import { ImageData } from '../../src/codecs/dct/dct-compressor';
import { DeterministicStrategyGenerator } from '../../src/codecs/dct/dct-strategy';

describe('White Image Compression Trace', () => {
  it('should trace white image compression', () => {
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
      whiteImage.data[i] = 255;     // R
      whiteImage.data[i + 1] = 255; // G
      whiteImage.data[i + 2] = 255; // B
      whiteImage.data[i + 3] = 255; // A
    }

    const deviceId = 'TEST-DEVICE';
    const strategy = DeterministicStrategyGenerator.generateStrategy(deviceId);
    
    console.log('Device strategy:', {
      weights: strategy.channelWeights,
      quantMatrix_0_0: strategy.quantizationMatrix[0][0]
    });
    
    // RGB to YCbCr for white should give:
    // Y = 0.299 * 255 + 0.587 * 255 + 0.114 * 255 = 255
    // Cb = 128 - 0.168736 * 255 - 0.331264 * 255 + 0.5 * 255 = 128
    // Cr = 128 + 0.5 * 255 - 0.418688 * 255 - 0.081312 * 255 = 128
    
    console.log('Expected YCbCr for white: Y=255, Cb=128, Cr=128');
    
    // Compress
    const result = compressImage(whiteImage, deviceId, 1.0);
    
    console.log('Compressed data:');
    console.log('- Blocks:', result.compressed.blocks.length);
    console.log('- First block:', {
      hasY: !!result.compressed.blocks[0].yData,
      hasCb: !!result.compressed.blocks[0].cbData,
      hasCr: !!result.compressed.blocks[0].crData
    });
    
    if (result.compressed.blocks[0].yData) {
      console.log('- Y DCT coefficients (first 5):', result.compressed.blocks[0].yData.slice(0, 5));
    }
    if (result.compressed.blocks[0].cbData) {
      console.log('- Cb DCT coefficients (first 5):', result.compressed.blocks[0].cbData.slice(0, 5));
    }
    if (result.compressed.blocks[0].crData) {
      console.log('- Cr DCT coefficients (first 5):', result.compressed.blocks[0].crData.slice(0, 5));
    }
    
    // Decompress
    const decompressed = decompressImage(result.compressed);
    console.log('Decompressed first pixel RGB:', 
      decompressed.data[0], decompressed.data[1], decompressed.data[2]);
      
    // For white input with Cb=Cr=128, if these channels are missing,
    // the decompression will use default 128 which is correct for white!
    // So the issue must be in the quantization or DCT process
  });

  it('should trace grey value propagation', () => {
    // Test with a grey value
    const width = 8;
    const height = 8;
    const greyImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    // Fill with grey (200)
    for (let i = 0; i < greyImage.data.length; i += 4) {
      greyImage.data[i] = 200;     // R
      greyImage.data[i + 1] = 200; // G
      greyImage.data[i + 2] = 200; // B
      greyImage.data[i + 3] = 255; // A
    }

    const deviceId = 'TEST-DEVICE';
    
    // First compression
    const result1 = compressImage(greyImage, deviceId, 1.0);
    const decompressed1 = decompressImage(result1.compressed);
    
    console.log('\nGrey value test:');
    console.log('Input: 200, 200, 200');
    console.log('After 1st compression:', decompressed1.data[0], decompressed1.data[1], decompressed1.data[2]);
    
    // Second compression (recompression)
    const result2 = compressImage(decompressed1, deviceId, 0.8);
    const decompressed2 = decompressImage(result2.compressed);
    
    console.log('After 2nd compression:', decompressed2.data[0], decompressed2.data[1], decompressed2.data[2]);
    
    // The issue: each compression loses information due to quantization
    // With only Y channel having significant weight, color information is lost
  });
});