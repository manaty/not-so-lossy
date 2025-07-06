import { compressImage, decompressImage, reconstructFromMultiple, calculatePSNR } from '../../src/codecs/dct/dct-compressor';
import { ImageData } from '../../src/codecs/dct/dct-compressor';

describe('PSNR High Quality Tests', () => {
  it('should check PSNR at quality 1.0', () => {
    // Create a test image
    const width = 64;
    const height = 64;
    const testImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    // Fill with gradient
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        testImage.data[idx] = (x * 255) / width;
        testImage.data[idx + 1] = (y * 255) / height;
        testImage.data[idx + 2] = 128;
        testImage.data[idx + 3] = 255;
      }
    }

    // Compress with 3 devices at quality 1.0
    const devices = ['DEVICE-001', 'DEVICE-002', 'DEVICE-003'];
    
    console.log('\nQuality 1.0 test:');
    const compressedImages = devices.map((deviceId, i) => {
      const result = compressImage(testImage, deviceId, 1.0);
      const decompressed = decompressImage(result.compressed);
      const psnr = calculatePSNR(testImage, decompressed);
      console.log(`Device ${i + 1} PSNR: ${psnr.toFixed(2)} dB`);
      return result;
    });

    // Reconstruct
    const reconstructed = reconstructFromMultiple(
      compressedImages.map(r => r.compressed)
    );
    const reconstructedPSNR = calculatePSNR(testImage, reconstructed);
    console.log(`Reconstructed PSNR: ${reconstructedPSNR.toFixed(2)} dB`);
    
    // Test at quality 0.8
    console.log('\nQuality 0.8 test:');
    const compressed08 = devices.map((deviceId, i) => {
      const result = compressImage(testImage, deviceId, 0.8);
      const decompressed = decompressImage(result.compressed);
      const psnr = calculatePSNR(testImage, decompressed);
      console.log(`Device ${i + 1} PSNR: ${psnr.toFixed(2)} dB`);
      return result;
    });

    const reconstructed08 = reconstructFromMultiple(
      compressed08.map(r => r.compressed)
    );
    const reconstructedPSNR08 = calculatePSNR(testImage, reconstructed08);
    console.log(`Reconstructed PSNR: ${reconstructedPSNR08.toFixed(2)} dB`);
  });
});