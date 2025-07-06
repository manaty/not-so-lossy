import { compressImage, decompressImage, reconstructFromMultiple, calculatePSNR } from '../../src/codecs/dct/dct-compressor';
import { ImageData } from '../../src/codecs/dct/dct-compressor';

describe('PSNR Comparison Tests', () => {
  it('should have higher PSNR for reconstructed image than individual devices', () => {
    // Create a test image with some complexity
    const width = 64;
    const height = 64;
    const testImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    // Fill with a pattern
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        testImage.data[idx] = (x * 255) / width;
        testImage.data[idx + 1] = (y * 255) / height;
        testImage.data[idx + 2] = ((x + y) * 255) / (width + height);
        testImage.data[idx + 3] = 255;
      }
    }

    // Compress with 3 devices at different qualities
    const devices = [
      { id: 'DEVICE-001', quality: 0.7 },
      { id: 'DEVICE-002', quality: 0.7 },
      { id: 'DEVICE-003', quality: 0.7 }
    ];

    const compressedImages = devices.map(device => 
      compressImage(testImage, device.id, device.quality)
    );

    // Calculate individual PSNRs
    const individualPSNRs = compressedImages.map((result, i) => {
      const decompressed = decompressImage(result.compressed);
      const psnr = calculatePSNR(testImage, decompressed);
      console.log(`Device ${i + 1} PSNR: ${psnr.toFixed(2)} dB`);
      return psnr;
    });

    // Reconstruct from all devices
    const reconstructed = reconstructFromMultiple(
      compressedImages.map(r => r.compressed)
    );
    const reconstructedPSNR = calculatePSNR(testImage, reconstructed);
    console.log(`Reconstructed PSNR: ${reconstructedPSNR.toFixed(2)} dB`);

    // Average individual PSNR
    const avgIndividualPSNR = individualPSNRs.reduce((a, b) => a + b, 0) / individualPSNRs.length;
    console.log(`Average individual PSNR: ${avgIndividualPSNR.toFixed(2)} dB`);

    // Reconstructed should be better than the average individual
    expect(reconstructedPSNR).toBeGreaterThan(avgIndividualPSNR);
  });
});