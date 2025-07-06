import { codecManager } from '../../src/codecs/codec-manager';
import { ImageData } from '../../src/codecs/types';

describe('Codec Modularity Tests', () => {
  const createTestImage = (): ImageData => {
    const width = 64;
    const height = 64;
    const data = new Uint8ClampedArray(width * height * 4);
    
    // Create a gradient
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = (x * 255) / width;
        data[idx + 1] = (y * 255) / height;
        data[idx + 2] = 128;
        data[idx + 3] = 255;
      }
    }
    
    return { data, width, height };
  };

  it('should list available codecs', () => {
    const codecs = codecManager.getAvailableCodecs();
    console.log('Available codecs:', codecs);
    
    expect(codecs).toContain('dct');
    expect(codecs).toContain('wavelet');
    expect(codecs).toContain('rle');
    expect(codecs.length).toBeGreaterThanOrEqual(3);
  });

  it('should compress with different codecs', () => {
    const testImage = createTestImage();
    const codecs = ['dct', 'wavelet', 'rle'];
    
    console.log('\nCompression results:');
    codecs.forEach(codecName => {
      codecManager.setCodec(codecName);
      
      const result = codecManager.compress(testImage, {
        quality: 0.8,
        deviceId: 'TEST-DEVICE'
      });
      
      console.log(`${codecName.toUpperCase()}:`);
      console.log(`  Size: ${result.size} bytes`);
      console.log(`  Compressed data type:`, typeof result.compressed);
      
      // Verify decompression works
      const decompressed = codecManager.decompress(result.compressed, 'TEST-DEVICE');
      expect(decompressed.width).toBe(testImage.width);
      expect(decompressed.height).toBe(testImage.height);
      
      // Calculate PSNR
      const psnr = codecManager.calculatePSNR(testImage, decompressed);
      console.log(`  PSNR: ${psnr.toFixed(2)} dB`);
    });
  });

  it('should handle codec switching', () => {
    const testImage = createTestImage();
    
    // Start with DCT
    codecManager.setCodec('dct');
    expect(codecManager.getCurrentCodec()).toBe('dct');
    
    const dctResult = codecManager.compress(testImage, {
      quality: 0.8,
      deviceId: 'TEST-DEVICE'
    });
    
    // Switch to Wavelet
    codecManager.setCodec('wavelet');
    expect(codecManager.getCurrentCodec()).toBe('wavelet');
    
    const waveletResult = codecManager.compress(testImage, {
      quality: 0.8,
      deviceId: 'TEST-DEVICE'
    });
    
    // Results should be different
    expect(dctResult.size).not.toBe(waveletResult.size);
  });

  it('should support distributed compression with each codec', () => {
    const testImage = createTestImage();
    const devices = ['DEVICE-001', 'DEVICE-002', 'DEVICE-003'];
    
    ['dct', 'wavelet', 'rle'].forEach(codecName => {
      codecManager.setCodec(codecName);
      
      console.log(`\n${codecName.toUpperCase()} distributed compression:`);
      
      // Compress with each device
      const compressed = devices.map(deviceId => {
        const result = codecManager.compress(testImage, {
          quality: 0.7,
          deviceId
        });
        return result.compressed;
      });
      
      // Reconstruct
      const reconstructed = codecManager.reconstructFromMultiple(compressed);
      const psnr = codecManager.calculatePSNR(testImage, reconstructed);
      
      console.log(`  Reconstructed PSNR: ${psnr.toFixed(2)} dB`);
      
      // Individual PSNRs
      compressed.forEach((comp, i) => {
        const individual = codecManager.decompress(comp, devices[i]);
        const individualPsnr = codecManager.calculatePSNR(testImage, individual);
        console.log(`  Device ${i + 1} PSNR: ${individualPsnr.toFixed(2)} dB`);
      });
    });
  });
});