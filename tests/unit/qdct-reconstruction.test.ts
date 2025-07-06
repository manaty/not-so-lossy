import { QDCTCodec } from '../../src/codecs/qdct/qdct-codec';
import { QDCTStrategyGenerator } from '../../src/codecs/qdct/qdct-strategy';
import { ImageData } from '../../src/codecs/types';

describe('QDCT Reconstruction Tests', () => {
  const createTestImage = (): ImageData => {
    const width = 64;
    const height = 64;
    const data = new Uint8ClampedArray(width * height * 4);
    
    // Create a more complex pattern to test reconstruction
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        // Checkerboard with gradient
        const checker = ((x >> 3) + (y >> 3)) & 1;
        data[idx] = checker ? 255 : (x * 255) / width;     // R
        data[idx + 1] = checker ? 255 : (y * 255) / height; // G
        data[idx + 2] = 128;                                // B
        data[idx + 3] = 255;                                // A
      }
    }
    
    return { data, width, height };
  };

  describe('Lowest Quantization Selection', () => {
    it('should use coefficients from device with lowest quantization', () => {
      const codec = new QDCTCodec();
      const testImage = createTestImage();
      
      // Create devices with different compression levels
      const devices = [
        { id: 'DEVICE-001', quality: 0.9 }, // Low compression (level ~6)
        { id: 'DEVICE-002', quality: 0.5 }, // Medium compression (level ~31)
        { id: 'DEVICE-003', quality: 0.2 }  // High compression (level ~50)
      ];
      
      const compressed = devices.map(device => 
        codec.compress(testImage, {
          quality: device.quality,
          deviceId: device.id
        }).compressed
      );
      
      // Check compression levels
      const levels = devices.map(d => codec.getCompressionLevel(d.id));
      console.log('Compression levels:', levels);
      
      // Levels should be different
      expect(levels[0]!).toBeLessThan(levels[1]!);
      expect(levels[1]!).toBeLessThan(levels[2]!);
      
      // Reconstruct using all devices
      const reconstructed = codec.reconstructFromMultiple(compressed);
      
      // Calculate PSNR - should be better than worst device alone
      const psnrReconstructed = codec.calculatePSNR(testImage, reconstructed);
      const psnrWorst = codec.calculatePSNR(
        testImage, 
        codec.decompress(compressed[2], devices[2].id)
      );
      
      console.log('Reconstructed PSNR:', psnrReconstructed);
      console.log('Worst device PSNR:', psnrWorst);
      
      expect(psnrReconstructed).toBeGreaterThan(psnrWorst);
    });

    it('should show benefit of multi-device reconstruction', () => {
      const codec = new QDCTCodec();
      const testImage = createTestImage();
      
      // Create devices where each has different coefficients at low quantization
      const deviceIds = ['DEVICE-A', 'DEVICE-B', 'DEVICE-C'];
      
      // Compress at same moderate quality
      const quality = 0.6;
      const compressed = deviceIds.map(deviceId =>
        codec.compress(testImage, { quality, deviceId }).compressed
      );
      
      // Get individual PSNRs
      const individualPSNRs = compressed.map((comp, i) => {
        const decompressed = codec.decompress(comp, deviceIds[i]);
        return codec.calculatePSNR(testImage, decompressed);
      });
      
      // Get reconstructed PSNR
      const reconstructed = codec.reconstructFromMultiple(compressed);
      const reconstructedPSNR = codec.calculatePSNR(testImage, reconstructed);
      
      console.log('Individual PSNRs:', individualPSNRs);
      console.log('Reconstructed PSNR:', reconstructedPSNR);
      
      // Reconstructed should be at least as good as the best individual
      const bestIndividual = Math.max(...individualPSNRs);
      expect(reconstructedPSNR).toBeGreaterThanOrEqual(bestIndividual - 0.1); // Small tolerance
    });

    it('should verify coefficient selection strategy', () => {
      const codec = new QDCTCodec();
      
      // Test with specific devices where we know the quantization order
      const device1 = 'TEST-DEVICE-1';
      const device2 = 'TEST-DEVICE-2';
      
      // Get strategies
      const strategy1 = QDCTStrategyGenerator.generateStrategy(device1);
      const strategy2 = QDCTStrategyGenerator.generateStrategy(device2);
      
      // Check first few coefficients that will be increased
      console.log('Device 1 first 5 coefficients to increase:', 
        strategy1.quantizationOrder.slice(0, 5));
      console.log('Device 2 first 5 coefficients to increase:', 
        strategy2.quantizationOrder.slice(0, 5));
      
      // Get quantization matrices at level 10
      const matrix1 = codec.getQuantizationMatrix(device1, 10);
      const matrix2 = codec.getQuantizationMatrix(device2, 10);
      
      // Count which device has lower quantization for each position
      let device1Better = 0;
      let device2Better = 0;
      let equal = 0;
      
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          if (matrix1[i][j] < matrix2[i][j]) {
            device1Better++;
          } else if (matrix2[i][j] < matrix1[i][j]) {
            device2Better++;
          } else {
            equal++;
          }
        }
      }
      
      console.log(`Device 1 better: ${device1Better}, Device 2 better: ${device2Better}, Equal: ${equal}`);
      
      // Should have a mix (not all from one device)
      expect(device1Better).toBeGreaterThan(0);
      expect(device2Better).toBeGreaterThan(0);
      expect(device1Better + device2Better + equal).toBe(64);
    });
  });

  describe('Progressive Reconstruction Quality', () => {
    it('should improve with more devices', () => {
      const codec = new QDCTCodec();
      const testImage = createTestImage();
      const quality = 0.7;
      
      const psnrs: number[] = [];
      
      // Test with 1 to 5 devices
      for (let numDevices = 1; numDevices <= 5; numDevices++) {
        const compressed = [];
        
        for (let i = 0; i < numDevices; i++) {
          const result = codec.compress(testImage, {
            quality,
            deviceId: `DEVICE-${i.toString().padStart(3, '0')}`
          });
          compressed.push(result.compressed);
        }
        
        const reconstructed = codec.reconstructFromMultiple(compressed);
        const psnr = codec.calculatePSNR(testImage, reconstructed);
        psnrs.push(psnr);
      }
      
      console.log('PSNRs with increasing devices:', psnrs);
      
      // Generally should improve or stay same with more devices
      for (let i = 1; i < psnrs.length; i++) {
        expect(psnrs[i]).toBeGreaterThanOrEqual(psnrs[i-1] - 0.5); // Small tolerance for variations
      }
      
      // Should see meaningful improvement from 1 to 5 devices
      expect(psnrs[4]).toBeGreaterThan(psnrs[0]);
    });
  });
});