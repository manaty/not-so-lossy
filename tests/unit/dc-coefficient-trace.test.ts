import { compressImage, decompressImage } from '../../src/codecs/dct/dct-compressor';
import { ImageData } from '../../src/codecs/dct/dct-compressor';

describe('DC Coefficient Trace', () => {
  it('should preserve DC coefficient (average color) through recompression', () => {
    // Create a uniform white 8x8 block
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
    
    console.log('=== White Image Test ===');
    console.log('Input: RGB(255, 255, 255)');
    
    // Expected Y value for white: 0.299 * 255 + 0.587 * 255 + 0.114 * 255 = 255
    console.log('Expected Y value: 255');
    console.log('After centering for DCT: 255 - 128 = 127');
    console.log('Expected DC coefficient after DCT: 127 * 8 = 1016');
    
    // First compression
    const result1 = compressImage(whiteImage, deviceId, 1.0);
    console.log('\nFirst compression:');
    if (result1.compressed.blocks[0].yData) {
      const dc = result1.compressed.blocks[0].yData[0];
      console.log('Y channel DC coefficient (quantized):', dc);
      // To reconstruct: dc * quantMatrix[0][0] / 8 + 128
    }
    
    const decompressed1 = decompressImage(result1.compressed);
    console.log('Decompressed RGB:', decompressed1.data[0], decompressed1.data[1], decompressed1.data[2]);
    
    // Second compression
    const result2 = compressImage(decompressed1, deviceId, 1.0);
    console.log('\nSecond compression:');
    if (result2.compressed.blocks[0].yData) {
      const dc = result2.compressed.blocks[0].yData[0];
      console.log('Y channel DC coefficient (quantized):', dc);
    }
    
    const decompressed2 = decompressImage(result2.compressed);
    console.log('Decompressed RGB:', decompressed2.data[0], decompressed2.data[1], decompressed2.data[2]);
    
    // The DC coefficient should be preserved!
    expect(decompressed2.data[0]).toBeGreaterThan(250);
  });

  it('should trace DC coefficient for grey values', () => {
    const width = 8;
    const height = 8;
    const greyImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    const greyValue = 200;
    for (let i = 0; i < greyImage.data.length; i += 4) {
      greyImage.data[i] = greyValue;
      greyImage.data[i + 1] = greyValue;
      greyImage.data[i + 2] = greyValue;
      greyImage.data[i + 3] = 255;
    }

    const deviceId = 'DEVICE-001'; // Different device with better Y weight
    
    console.log('\n=== Grey Image Test ===');
    console.log(`Input: RGB(${greyValue}, ${greyValue}, ${greyValue})`);
    
    // Compression cycle
    const result1 = compressImage(greyImage, deviceId, 1.0);
    const decompressed1 = decompressImage(result1.compressed);
    console.log('After 1st compression:', decompressed1.data[0], decompressed1.data[1], decompressed1.data[2]);
    
    const result2 = compressImage(decompressed1, deviceId, 1.0);
    const decompressed2 = decompressImage(result2.compressed);
    console.log('After 2nd compression:', decompressed2.data[0], decompressed2.data[1], decompressed2.data[2]);
    
    // Average color should be roughly preserved
    const avgColor2 = (decompressed2.data[0] + decompressed2.data[1] + decompressed2.data[2]) / 3;
    expect(Math.abs(avgColor2 - greyValue)).toBeLessThan(20);
  });

  it('should check quantization impact on DC', () => {
    // Let's see what happens to DC coefficient with quantization
    const yValue = 255; // White in Y channel
    const centered = yValue - 128; // = 127
    const dcBeforeDCT = centered; 
    const dcAfterDCT = dcBeforeDCT * 8; // DCT of constant block gives DC * 8
    
    console.log('\n=== Quantization Analysis ===');
    console.log('Y value:', yValue);
    console.log('Centered:', centered);
    console.log('DC after DCT:', dcAfterDCT);
    
    // Typical quantization matrix has 16 for DC
    const quantValue = 16;
    const quantized = Math.round(dcAfterDCT / quantValue);
    console.log(`Quantized DC (${dcAfterDCT}/${quantValue}):`, quantized);
    
    // Dequantization
    const dequantized = quantized * quantValue;
    console.log('Dequantized:', dequantized);
    
    // After IDCT
    const afterIDCT = dequantized / 8;
    console.log('After IDCT:', afterIDCT);
    
    // Add back center
    const finalY = afterIDCT + 128;
    console.log('Final Y value:', finalY);
    
    // This should be close to 255!
  });
});