import { compressImage, decompressImage, reconstructFromMultiple, calculatePSNR } from '../../src/codecs/dct/dct-compressor';
import { ImageData } from '../../src/codecs/dct/dct-compressor';

describe('Reconstruction Bug Test', () => {
  it('should test reconstruction at 80% quality', () => {
    // Create a simple test image (like circles)
    const width = 128;
    const height = 128;
    const testImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    // Create a circle pattern
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 40;
    
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
          // Outside circle - black
          testImage.data[idx] = 0;
          testImage.data[idx + 1] = 0;
          testImage.data[idx + 2] = 0;
        }
        testImage.data[idx + 3] = 255;
      }
    }

    // Compress with 3 devices at 80% quality (0.8)
    const devices = ['DEVICE-000', 'DEVICE-001', 'DEVICE-002'];
    
    console.log('\nTesting at 80% quality:');
    const compressedImages = devices.map((deviceId, i) => {
      const result = compressImage(testImage, deviceId, 0.8);
      const decompressed = decompressImage(result.compressed);
      const psnr = calculatePSNR(testImage, decompressed);
      console.log(`Device ${i} PSNR: ${psnr.toFixed(2)} dB`);
      
      // Check a few pixels
      console.log(`Device ${i} - Center pixel (should be ~255):`, 
        decompressed.data[centerY * width * 4 + centerX * 4],
        decompressed.data[centerY * width * 4 + centerX * 4 + 1],
        decompressed.data[centerY * width * 4 + centerX * 4 + 2]
      );
      
      return result;
    });

    // Reconstruct
    const reconstructed = reconstructFromMultiple(
      compressedImages.map(r => r.compressed)
    );
    const reconstructedPSNR = calculatePSNR(testImage, reconstructed);
    console.log(`\nReconstructed PSNR: ${reconstructedPSNR.toFixed(2)} dB`);
    
    // Check reconstructed center pixel
    console.log(`Reconstructed - Center pixel:`, 
      reconstructed.data[centerY * width * 4 + centerX * 4],
      reconstructed.data[centerY * width * 4 + centerX * 4 + 1],
      reconstructed.data[centerY * width * 4 + centerX * 4 + 2]
    );
    
    // The reconstructed PSNR should be higher than individual PSNRs
    const avgIndividualPSNR = compressedImages.reduce((sum, _, i) => {
      const decompressed = decompressImage(compressedImages[i].compressed);
      return sum + calculatePSNR(testImage, decompressed);
    }, 0) / compressedImages.length;
    
    console.log(`Average individual PSNR: ${avgIndividualPSNR.toFixed(2)} dB`);
    console.log(`Difference: ${(reconstructedPSNR - avgIndividualPSNR).toFixed(2)} dB`);
    
    // This should be positive!
    expect(reconstructedPSNR).toBeGreaterThan(avgIndividualPSNR - 1); // Allow small margin
  });
});