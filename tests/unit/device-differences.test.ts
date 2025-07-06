import { compressImage, decompressImage } from '../../src/codecs/dct/dct-compressor';
import { DeterministicStrategyGenerator } from '../../src/codecs/dct/dct-strategy';
import { ImageData } from '../../src/codecs/dct/dct-compressor';

describe('Device Compression Differences', () => {
  it('should show how different devices compress the same image', () => {
    // Create a simple test pattern
    const width = 64;
    const height = 64;
    const testImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    // Create a pattern with different frequency content
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        // Vertical stripes (tests horizontal frequency)
        const verticalStripe = Math.sin(x * Math.PI / 8) > 0 ? 255 : 0;
        
        // Horizontal stripes (tests vertical frequency)
        const horizontalStripe = Math.sin(y * Math.PI / 8) > 0 ? 255 : 0;
        
        // Diagonal pattern (tests both)
        const diagonal = ((x + y) % 16) < 8 ? 255 : 0;
        
        testImage.data[idx] = verticalStripe;     // R
        testImage.data[idx + 1] = horizontalStripe; // G
        testImage.data[idx + 2] = diagonal;        // B
        testImage.data[idx + 3] = 255;
      }
    }

    const devices = ['DEVICE-000', 'DEVICE-001', 'DEVICE-002'];
    
    console.log('\nDevice Strategies:');
    devices.forEach(deviceId => {
      const strategy = DeterministicStrategyGenerator.generateStrategy(deviceId);
      const freqCount = strategy.frequencyMask.filter(m => m).length;
      console.log(`\n${deviceId}:`);
      console.log(`  Frequency coefficients kept: ${freqCount}/64`);
      console.log(`  Channel weights: Y=${strategy.channelWeights.y.toFixed(3)}, Cb=${strategy.channelWeights.cb.toFixed(3)}, Cr=${strategy.channelWeights.cr.toFixed(3)}`);
      console.log(`  DC quantization: ${strategy.quantizationMatrix[0][0]}`);
      
      // Show frequency mask pattern
      console.log('  Frequency mask (8x8):');
      for (let i = 0; i < 8; i++) {
        let row = '    ';
        for (let j = 0; j < 8; j++) {
          row += strategy.frequencyMask[i * 8 + j] ? 'X ' : '. ';
        }
        console.log(row);
      }
    });

    // Compress with each device at quality 0.7 to see differences
    console.log('\n\nCompression Results at Quality 0.7:');
    
    devices.forEach(deviceId => {
      const result = compressImage(testImage, deviceId, 0.7);
      const decompressed = decompressImage(result.compressed);
      
      console.log(`\n${deviceId}:`);
      console.log(`  Compressed size: ${result.size} bytes`);
      
      // Check which channels were preserved
      let hasY = false, hasCb = false, hasCr = false;
      result.compressed.blocks.forEach(block => {
        if (block.yData && block.yData.some(v => v !== 0)) hasY = true;
        if (block.cbData && block.cbData.some(v => v !== 0)) hasCb = true;
        if (block.crData && block.crData.some(v => v !== 0)) hasCr = true;
      });
      
      console.log(`  Channels preserved: Y=${hasY}, Cb=${hasCb}, Cr=${hasCr}`);
      
      // Sample a few pixels to see compression effects
      console.log('  Sample pixels (original → compressed):');
      const samplePoints = [[0, 0], [32, 0], [0, 32], [32, 32]];
      samplePoints.forEach(([x, y]) => {
        const idx = (y * width + x) * 4;
        const origR = testImage.data[idx];
        const origG = testImage.data[idx + 1];
        const origB = testImage.data[idx + 2];
        const compR = decompressed.data[idx];
        const compG = decompressed.data[idx + 1];
        const compB = decompressed.data[idx + 2];
        
        console.log(`    (${x},${y}): RGB(${origR},${origG},${origB}) → RGB(${compR},${compG},${compB})`);
      });
    });

    // Show how different devices preserve different aspects
    console.log('\n\nAnalysis:');
    console.log('- DEVICE-000 focuses on color channels (Cb/Cr) - better for color preservation');
    console.log('- DEVICE-001 focuses on luminance (Y) - better for brightness/contrast');
    console.log('- DEVICE-002 has mixed focus - captures different frequency patterns');
    console.log('- Each device keeps different DCT coefficients, preserving complementary information');
  });
});