import { compressImage, decompressImage } from '../../src/compression/image-compressor';
import { ImageData } from '../../src/compression/image-compressor';

describe('Recompression Issue Investigation', () => {
  it('should trace why 255 becomes 218', () => {
    // Create white image
    const whiteImage: ImageData = {
      width: 8,
      height: 8,
      data: new Uint8ClampedArray(8 * 8 * 4).fill(255)
    };

    console.log('=== Step-by-step trace ===\n');
    
    // Step 1: First compression
    console.log('1. Original image: RGB(255, 255, 255)');
    const compress1 = compressImage(whiteImage, 'TEST-DEVICE', 1.0);
    
    // Step 2: First decompression
    const decompress1 = decompressImage(compress1.compressed);
    console.log('2. After first compress/decompress:', 
      decompress1.data[0], decompress1.data[1], decompress1.data[2]);
    
    // Step 3: Second compression - THIS IS WHERE THE ISSUE HAPPENS
    console.log('\n3. Now recompressing the decompressed image at quality 0.8');
    console.log('   Input to second compression:', 
      decompress1.data[0], decompress1.data[1], decompress1.data[2]);
    
    const compress2 = compressImage(decompress1, 'TEST-DEVICE', 0.8);
    
    // Check what's in the compressed data
    console.log('   Y DC coefficient:', compress2.compressed.blocks[0].yData?.[0]);
    console.log('   Has Cb data?', !!compress2.compressed.blocks[0].cbData);
    console.log('   Has Cr data?', !!compress2.compressed.blocks[0].crData);
    
    // Step 4: Final result
    const decompress2 = decompressImage(compress2.compressed);
    console.log('\n4. Final result:', 
      decompress2.data[0], decompress2.data[1], decompress2.data[2]);
      
    // The issue might be that decompress1 is not exactly white anymore
    // Let's check all pixels in decompress1
    console.log('\n5. Checking if first decompression is uniform:');
    let allSame = true;
    const firstPixel = decompress1.data[0];
    for (let i = 0; i < decompress1.data.length; i += 4) {
      if (decompress1.data[i] !== firstPixel || 
          decompress1.data[i+1] !== firstPixel || 
          decompress1.data[i+2] !== firstPixel) {
        allSame = false;
        console.log(`   Pixel ${i/4} is different:`, 
          decompress1.data[i], decompress1.data[i+1], decompress1.data[i+2]);
        break;
      }
    }
    if (allSame) {
      console.log('   All pixels are uniform:', firstPixel);
    }
  });

  it('should check if the issue is block boundary artifacts', () => {
    // Create a larger white image to see block effects
    const whiteImage: ImageData = {
      width: 16,
      height: 16,
      data: new Uint8ClampedArray(16 * 16 * 4).fill(255)
    };

    const compress1 = compressImage(whiteImage, 'TEST-DEVICE', 1.0);
    const decompress1 = decompressImage(compress1.compressed);
    
    console.log('\n=== Checking 16x16 image ===');
    console.log('Number of blocks:', compress1.compressed.blocks.length);
    
    // Check corners of each 8x8 block
    const positions = [
      { name: 'Top-left (0,0)', x: 0, y: 0 },
      { name: 'Top-right (7,0)', x: 7, y: 0 },
      { name: 'Top-right block (8,0)', x: 8, y: 0 },
      { name: 'Bottom-left (0,7)', x: 0, y: 7 },
      { name: 'Bottom-right (7,7)', x: 7, y: 7 },
      { name: 'Next block (8,8)', x: 8, y: 8 }
    ];
    
    positions.forEach(pos => {
      const idx = (pos.y * 16 + pos.x) * 4;
      console.log(`${pos.name}: RGB(${decompress1.data[idx]}, ${decompress1.data[idx+1]}, ${decompress1.data[idx+2]})`);
    });
  });
});