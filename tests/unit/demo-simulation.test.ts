import { compressImage, decompressImage, reconstructFromMultiple, calculatePSNR } from '../../src/codecs/dct/dct-compressor';
import { ImageData } from '../../src/codecs/dct/dct-compressor';

describe('Demo Simulation Test', () => {
  it('should simulate exact demo behavior', () => {
    // Create a circles-like image (512x512 like demo limit)
    const width = 512;
    const height = 512;
    const testImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    // Create a large circle in center (like the circles test image)
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 200;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        
        if (dist < radius) {
          // Inside circle - white
          testImage.data[idx] = 255;
          testImage.data[idx + 1] = 255;
          testImage.data[idx + 2] = 255;
        } else {
          // Outside - black
          testImage.data[idx] = 0;
          testImage.data[idx + 1] = 0;
          testImage.data[idx + 2] = 0;
        }
        testImage.data[idx + 3] = 255;
      }
    }

    const uncompressedSize = width * height * 3;
    console.log(`\nOriginal size: ${(uncompressedSize / 1024).toFixed(1)} KB`);

    // Simulate initial processing (quality 1.0)
    console.log('\nInitial compression at quality 1.0:');
    const devices = ['DEVICE-000', 'DEVICE-001', 'DEVICE-002'];
    let compressedImages = devices.map((deviceId, i) => {
      const result = compressImage(testImage, deviceId, 1.0);
      console.log(`Device ${i}: ${(result.size / 1024).toFixed(1)} KB`);
      return result;
    });

    // Calculate initial PSNRs
    console.log('\nInitial PSNRs:');
    compressedImages.forEach((result, i) => {
      const decompressed = decompressImage(result.compressed);
      const psnr = calculatePSNR(testImage, decompressed);
      console.log(`Device ${i} PSNR: ${psnr.toFixed(2)} dB`);
    });

    // Initial reconstruction
    let reconstructed = reconstructFromMultiple(compressedImages.map(r => r.compressed));
    let reconstructedPSNR = calculatePSNR(testImage, reconstructed);
    console.log(`Reconstructed PSNR: ${reconstructedPSNR.toFixed(2)} dB`);

    // Now simulate recompressing to ~80% quality
    console.log('\n\nSimulating recompression to ~80% quality:');
    
    // Recompress each device from its current compressed state
    compressedImages = devices.map((deviceId, i) => {
      // Important: decompress then recompress (like demo does)
      const decompressed = decompressImage(compressedImages[i].compressed);
      const result = compressImage(decompressed, deviceId, 0.8);
      console.log(`Device ${i} recompressed: ${(result.size / 1024).toFixed(1)} KB`);
      return result;
    });

    // Calculate new PSNRs
    console.log('\nAfter recompression PSNRs:');
    compressedImages.forEach((result, i) => {
      const decompressed = decompressImage(result.compressed);
      const psnr = calculatePSNR(testImage, decompressed);
      console.log(`Device ${i} PSNR: ${psnr.toFixed(2)} dB`);
    });

    // New reconstruction
    reconstructed = reconstructFromMultiple(compressedImages.map(r => r.compressed));
    reconstructedPSNR = calculatePSNR(testImage, reconstructed);
    console.log(`Reconstructed PSNR: ${reconstructedPSNR.toFixed(2)} dB`);

    // Summary
    const avgPSNR = compressedImages.reduce((sum, result) => {
      const decompressed = decompressImage(result.compressed);
      return sum + calculatePSNR(testImage, decompressed);
    }, 0) / 3;

    console.log(`\nAverage device PSNR: ${avgPSNR.toFixed(2)} dB`);
    console.log(`Reconstruction gain: ${(reconstructedPSNR - avgPSNR).toFixed(2)} dB`);
  });
});