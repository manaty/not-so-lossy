import { compressImage, decompressImage, reconstructFromMultiple, calculatePSNR } from '../../src/codecs/dct/dct-compressor';
import { ImageData } from '../../src/codecs/dct/dct-compressor';

describe('Reconstruction Averaging Test', () => {
  it('should compare different averaging methods', () => {
    // Create a test image with circles
    const width = 128;
    const height = 128;
    const testImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    // Create multiple circles
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        // Circle 1 (top-left)
        const dist1 = Math.sqrt((x - 32) ** 2 + (y - 32) ** 2);
        // Circle 2 (bottom-right)
        const dist2 = Math.sqrt((x - 96) ** 2 + (y - 96) ** 2);
        
        if (dist1 < 20 || dist2 < 20) {
          // Inside circles - white
          testImage.data[idx] = 255;
          testImage.data[idx + 1] = 255;
          testImage.data[idx + 2] = 255;
        } else {
          // Outside - dark gray
          testImage.data[idx] = 64;
          testImage.data[idx + 1] = 64;
          testImage.data[idx + 2] = 64;
        }
        testImage.data[idx + 3] = 255;
      }
    }

    // Compress with 3 devices at 0.8 quality
    const devices = ['DEVICE-000', 'DEVICE-001', 'DEVICE-002'];
    console.log('\nCompressing at quality 0.8:');
    
    const compressedImages = devices.map((deviceId, i) => {
      const result = compressImage(testImage, deviceId, 0.8);
      const decompressed = decompressImage(result.compressed);
      const psnr = calculatePSNR(testImage, decompressed);
      console.log(`Device ${i} PSNR: ${psnr.toFixed(2)} dB`);
      return result;
    });

    // Method 1: Current reconstruction
    const reconstructed = reconstructFromMultiple(compressedImages.map(r => r.compressed));
    const reconstructedPSNR = calculatePSNR(testImage, reconstructed);
    console.log(`\nCurrent reconstruction PSNR: ${reconstructedPSNR.toFixed(2)} dB`);

    // Method 2: Average in RGB space
    console.log('\nTrying RGB averaging:');
    const decompressedImages = compressedImages.map(c => decompressImage(c.compressed));
    const rgbAverage = new Uint8ClampedArray(width * height * 4);
    
    for (let i = 0; i < rgbAverage.length; i += 4) {
      let r = 0, g = 0, b = 0;
      decompressedImages.forEach(img => {
        r += img.data[i];
        g += img.data[i + 1];
        b += img.data[i + 2];
      });
      rgbAverage[i] = Math.round(r / 3);
      rgbAverage[i + 1] = Math.round(g / 3);
      rgbAverage[i + 2] = Math.round(b / 3);
      rgbAverage[i + 3] = 255;
    }
    
    const rgbAveragePSNR = calculatePSNR(testImage, { data: rgbAverage, width, height });
    console.log(`RGB average PSNR: ${rgbAveragePSNR.toFixed(2)} dB`);

    // Method 3: Median instead of mean
    console.log('\nTrying RGB median:');
    const rgbMedian = new Uint8ClampedArray(width * height * 4);
    
    for (let i = 0; i < rgbMedian.length; i += 4) {
      const rs = decompressedImages.map(img => img.data[i]).sort((a, b) => a - b);
      const gs = decompressedImages.map(img => img.data[i + 1]).sort((a, b) => a - b);
      const bs = decompressedImages.map(img => img.data[i + 2]).sort((a, b) => a - b);
      
      rgbMedian[i] = rs[1]; // median of 3
      rgbMedian[i + 1] = gs[1];
      rgbMedian[i + 2] = bs[1];
      rgbMedian[i + 3] = 255;
    }
    
    const rgbMedianPSNR = calculatePSNR(testImage, { data: rgbMedian, width, height });
    console.log(`RGB median PSNR: ${rgbMedianPSNR.toFixed(2)} dB`);

    // Compare
    console.log('\nSummary:');
    const avgIndividual = compressedImages.reduce((sum, c) => {
      const d = decompressImage(c.compressed);
      return sum + calculatePSNR(testImage, d);
    }, 0) / 3;
    
    console.log(`Average individual PSNR: ${avgIndividual.toFixed(2)} dB`);
    console.log(`Current reconstruction gain: ${(reconstructedPSNR - avgIndividual).toFixed(2)} dB`);
    console.log(`RGB average gain: ${(rgbAveragePSNR - avgIndividual).toFixed(2)} dB`);
    console.log(`RGB median gain: ${(rgbMedianPSNR - avgIndividual).toFixed(2)} dB`);
  });
});