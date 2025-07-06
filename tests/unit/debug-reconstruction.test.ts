import { compressImage, decompressImage, reconstructFromMultiple, calculatePSNR } from '../../src/codecs/dct/dct-compressor';
import { DeterministicStrategyGenerator } from '../../src/codecs/dct/dct-strategy';
import { ImageData } from '../../src/codecs/dct/dct-compressor';

describe('Debug Reconstruction', () => {
  it('should debug reconstruction issue', () => {
    // Simple white image
    const width = 32;
    const height = 32;
    const testImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4).fill(255)
    };

    const devices = ['DEVICE-000', 'DEVICE-001', 'DEVICE-002'];
    
    // Check strategies
    console.log('\nDevice strategies:');
    devices.forEach(deviceId => {
      const strategy = DeterministicStrategyGenerator.generateStrategy(deviceId);
      console.log(`${deviceId}:`, {
        y: strategy.channelWeights.y.toFixed(3),
        cb: strategy.channelWeights.cb.toFixed(3),
        cr: strategy.channelWeights.cr.toFixed(3),
        sum: (strategy.channelWeights.y + strategy.channelWeights.cb + strategy.channelWeights.cr).toFixed(3)
      });
    });
    
    // Compress at 0.8 quality
    const compressedImages = devices.map((deviceId, i) => {
      const result = compressImage(testImage, deviceId, 0.8);
      const decompressed = decompressImage(result.compressed);
      
      // Check pixel values
      const firstPixel = [
        decompressed.data[0],
        decompressed.data[1],
        decompressed.data[2]
      ];
      console.log(`Device ${i} first pixel:`, firstPixel);
      
      return result;
    });
    
    // Manual reconstruction to debug
    console.log('\nManual reconstruction check:');
    
    // Get all decompressed images
    const decompressedImages = compressedImages.map(c => decompressImage(c.compressed));
    
    // Average RGB values directly
    const simpleAvg = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < simpleAvg.length; i += 4) {
      let r = 0, g = 0, b = 0;
      decompressedImages.forEach(img => {
        r += img.data[i];
        g += img.data[i + 1];
        b += img.data[i + 2];
      });
      simpleAvg[i] = Math.round(r / 3);
      simpleAvg[i + 1] = Math.round(g / 3);
      simpleAvg[i + 2] = Math.round(b / 3);
      simpleAvg[i + 3] = 255;
    }
    
    const simplePSNR = calculatePSNR(testImage, { data: simpleAvg, width, height });
    console.log(`Simple average PSNR: ${simplePSNR.toFixed(2)} dB`);
    console.log(`Simple average first pixel:`, simpleAvg[0], simpleAvg[1], simpleAvg[2]);
    
    // Actual reconstruction
    const reconstructed = reconstructFromMultiple(compressedImages.map(r => r.compressed));
    const reconstructedPSNR = calculatePSNR(testImage, reconstructed);
    console.log(`\nActual reconstruction PSNR: ${reconstructedPSNR.toFixed(2)} dB`);
    console.log(`Actual reconstruction first pixel:`, 
      reconstructed.data[0], reconstructed.data[1], reconstructed.data[2]);
  });
});