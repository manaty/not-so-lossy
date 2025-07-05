import { compressImage, decompressImage } from '../../src/compression/image-compressor';
import { ImageData } from '../../src/compression/image-compressor';

describe('Optimized Size Search Tests', () => {
  it('should find size with smart first guess', () => {
    // Create test image
    const width = 64;
    const height = 64;
    const testImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    // Fill with pattern
    for (let i = 0; i < testImage.data.length; i += 4) {
      testImage.data[i] = (i / 4) % 256;
      testImage.data[i + 1] = ((i / 4) * 2) % 256;
      testImage.data[i + 2] = ((i / 4) * 3) % 256;
      testImage.data[i + 3] = 255;
    }

    const deviceId = 'TEST-DEVICE';
    
    // Get baseline size at quality 1.0
    const baselineResult = compressImage(testImage, deviceId, 1.0);
    const baselineSize = baselineResult.size;
    console.log('Baseline size at Q=1.0:', baselineSize);
    
    // Test different target sizes
    const targetSizes = [
      baselineSize * 0.8,  // 80% of original
      baselineSize * 0.6,  // 60% of original
    ];
    
    targetSizes.forEach(targetSize => {
      console.log(`\nTarget size: ${Math.round(targetSize)} (${(targetSize/baselineSize*100).toFixed(0)}% of baseline)`);
      
      // Smart first guess
      const sizeReductionRatio = targetSize / baselineSize;
      let testQuality = Math.max(0.1, Math.min(1.0, sizeReductionRatio));
      console.log(`Smart first guess quality: ${testQuality.toFixed(3)}`);
      
      // Test the first guess
      const firstGuessResult = compressImage(testImage, deviceId, testQuality);
      let currentSize = firstGuessResult.size;
      const firstGuessError = Math.abs(currentSize - targetSize) / targetSize;
      
      console.log(`First guess size: ${currentSize} (${(firstGuessError * 100).toFixed(1)}% error)`);
      
      // Simulate the search
      let iterations = 0;
      let low = 0.1;
      let high = 1.0;
      let bestQuality = testQuality;
      let bestSize = currentSize;
      const tolerance = targetSize * 0.1; // 10% tolerance
      
      if (firstGuessError <= 0.1) {
        console.log('First guess within 10% tolerance!');
      } else {
        // Update bounds based on first guess
        if (currentSize > targetSize) {
          high = testQuality;
        } else {
          low = testQuality;
        }
        
        // Continue search
        for (let i = 1; i < 5; i++) {
          iterations = i;
          
          // Adjust strategy based on first guess
          if (i === 1 && currentSize > targetSize * 1.5) {
            testQuality = testQuality * 0.7;
          } else {
            testQuality = (low + high) / 2;
          }
          
          const result = compressImage(testImage, deviceId, testQuality);
          currentSize = result.size;
          const error = Math.abs(currentSize - targetSize) / targetSize;
          
          console.log(`Iteration ${i}: Q=${testQuality.toFixed(3)}, size=${currentSize}, error=${(error*100).toFixed(1)}%`);
          
          if (error <= 0.1) {
            bestQuality = testQuality;
            bestSize = currentSize;
            break;
          }
          
          if (currentSize > targetSize) {
            high = testQuality;
            // If closer than current best, save it
            if (Math.abs(currentSize - targetSize) < Math.abs(bestSize - targetSize)) {
              bestQuality = testQuality;
              bestSize = currentSize;
            }
          } else {
            low = testQuality;
            // Always save under-target results as best
            bestQuality = testQuality;
            bestSize = currentSize;
          }
        }
      }
      
      const finalError = Math.abs(bestSize - targetSize) / targetSize;
      console.log(`Final: Q=${bestQuality.toFixed(3)}, size=${bestSize}, error=${(finalError*100).toFixed(1)}%`);
      expect(finalError).toBeLessThanOrEqual(0.2); // Should be within 20%
    });
  });
});