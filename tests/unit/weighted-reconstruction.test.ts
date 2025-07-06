import { compressImage, decompressImage, reconstructFromMultiple, calculatePSNR } from '../../src/codecs/dct/dct-compressor';
import { ImageData } from '../../src/codecs/dct/dct-compressor';

describe('Weighted Reconstruction Test', () => {
  it('should handle mixed quality devices correctly', () => {
    // Create a test image similar to img1.jpg
    const width = 256;
    const height = 256;
    const testImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    // Create a gradient pattern with some structure
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        // Create some pattern
        testImage.data[idx] = (x + y) % 256;
        testImage.data[idx + 1] = (x * 2) % 256;
        testImage.data[idx + 2] = (y * 2) % 256;
        testImage.data[idx + 3] = 255;
      }
    }

    // Simulate the scenario: 3 devices at quality 1.0
    console.log('\nInitial state: all devices at quality 1.0');
    const devices = ['DEVICE-000', 'DEVICE-001', 'DEVICE-002'];
    let compressedImages = devices.map((deviceId, i) => {
      const result = compressImage(testImage, deviceId, 1.0);
      const decompressed = decompressImage(result.compressed);
      const psnr = calculatePSNR(testImage, decompressed);
      console.log(`Device ${i} (${deviceId}) PSNR: ${psnr.toFixed(2)} dB`);
      return result;
    });

    let reconstructed = reconstructFromMultiple(compressedImages.map(r => r.compressed));
    let reconstructedPSNR = calculatePSNR(testImage, reconstructed);
    console.log(`Reconstructed PSNR: ${reconstructedPSNR.toFixed(2)} dB`);

    // Now change device 1 to 73% quality
    console.log('\n\nAfter changing DEVICE-001 to 73% quality:');
    
    // Decompress device 1 and recompress at 0.73
    const device1Decompressed = decompressImage(compressedImages[1].compressed);
    compressedImages[1] = compressImage(device1Decompressed, devices[1], 0.73);
    
    // Show new PSNRs
    compressedImages.forEach((result, i) => {
      const decompressed = decompressImage(result.compressed);
      const psnr = calculatePSNR(testImage, decompressed);
      console.log(`Device ${i} (${devices[i]}) PSNR: ${psnr.toFixed(2)} dB, quality: ${result.compressed.qualityFactor}`);
    });

    // New reconstruction
    reconstructed = reconstructFromMultiple(compressedImages.map(r => r.compressed));
    reconstructedPSNR = calculatePSNR(testImage, reconstructed);
    console.log(`\nReconstructed PSNR: ${reconstructedPSNR.toFixed(2)} dB`);

    // The reconstruction should be close to the best devices
    const bestDevicePSNR = Math.max(...compressedImages.map(result => {
      const decompressed = decompressImage(result.compressed);
      return calculatePSNR(testImage, decompressed);
    }));

    console.log(`Best device PSNR: ${bestDevicePSNR.toFixed(2)} dB`);
    console.log(`Difference from best: ${(reconstructedPSNR - bestDevicePSNR).toFixed(2)} dB`);

    // With weighted averaging, reconstruction should be much closer to the best device
    expect(reconstructedPSNR).toBeGreaterThan(bestDevicePSNR - 2); // Within 2 dB of best
  });
});