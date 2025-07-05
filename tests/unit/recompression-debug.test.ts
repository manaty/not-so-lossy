import { compressImage, decompressImage } from '../../src/compression/image-compressor';
import { ImageData } from '../../src/compression/image-compressor';

describe('Recompression Debug Tests', () => {
  it('should maintain white color through recompression', () => {
    // Create a white image
    const width = 32;
    const height = 32;
    const whiteImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    // Fill with white
    for (let i = 0; i < whiteImage.data.length; i += 4) {
      whiteImage.data[i] = 255;     // R
      whiteImage.data[i + 1] = 255; // G
      whiteImage.data[i + 2] = 255; // B
      whiteImage.data[i + 3] = 255; // A
    }

    const deviceId = 'TEST-DEVICE';
    
    // Initial compression
    console.log('Initial white image - first pixel:', whiteImage.data[0], whiteImage.data[1], whiteImage.data[2]);
    
    const firstCompression = compressImage(whiteImage, deviceId, 1.0);
    const firstDecompressed = decompressImage(firstCompression.compressed);
    
    console.log('After first compression - first pixel:', 
      firstDecompressed.data[0], firstDecompressed.data[1], firstDecompressed.data[2]);
    console.log('First compression size:', firstCompression.size);
    
    // Recompress the decompressed image
    const recompression = compressImage(firstDecompressed, deviceId, 0.8);
    const recompressedPreview = recompression.preview;
    
    console.log('After recompression - first pixel:', 
      recompressedPreview.data[0], recompressedPreview.data[1], recompressedPreview.data[2]);
    console.log('Recompression size:', recompression.size);
    
    // Check center pixel too
    const centerIdx = (height / 2 * width + width / 2) * 4;
    console.log('Recompressed center pixel:', 
      recompressedPreview.data[centerIdx], 
      recompressedPreview.data[centerIdx + 1], 
      recompressedPreview.data[centerIdx + 2]);
    
    // White should stay reasonably white
    expect(recompressedPreview.data[0]).toBeGreaterThan(200);
    expect(recompressedPreview.data[1]).toBeGreaterThan(200);
    expect(recompressedPreview.data[2]).toBeGreaterThan(200);
  });

  it('should debug grey issue step by step', () => {
    // Create a simple test pattern
    const width = 16;
    const height = 16;
    const testImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    // Fill with a light color
    for (let i = 0; i < testImage.data.length; i += 4) {
      testImage.data[i] = 200;     // R
      testImage.data[i + 1] = 200; // G
      testImage.data[i + 2] = 200; // B
      testImage.data[i + 3] = 255; // A
    }

    const deviceId = 'DEBUG-DEVICE';
    
    // Step 1: Initial compression
    const compression1 = compressImage(testImage, deviceId, 0.9);
    console.log('\nStep 1 - Initial compression:');
    console.log('Input color: 200, 200, 200');
    console.log('Compressed blocks:', compression1.compressed.blocks.length);
    console.log('First block has data:', {
      yData: !!compression1.compressed.blocks[0].yData,
      cbData: !!compression1.compressed.blocks[0].cbData,
      crData: !!compression1.compressed.blocks[0].crData
    });
    
    // Step 2: Decompress
    const decompressed1 = decompressImage(compression1.compressed);
    console.log('\nStep 2 - First decompression:');
    console.log('Output color:', decompressed1.data[0], decompressed1.data[1], decompressed1.data[2]);
    
    // Step 3: Recompress
    const compression2 = compressImage(decompressed1, deviceId, 0.7);
    console.log('\nStep 3 - Recompression:');
    console.log('Input color:', decompressed1.data[0], decompressed1.data[1], decompressed1.data[2]);
    console.log('Second compressed blocks:', compression2.compressed.blocks.length);
    console.log('First block has data:', {
      yData: !!compression2.compressed.blocks[0].yData,
      cbData: !!compression2.compressed.blocks[0].cbData,
      crData: !!compression2.compressed.blocks[0].crData
    });
    
    // Step 4: Final preview
    const finalPreview = compression2.preview;
    console.log('\nStep 4 - Final preview:');
    console.log('Output color:', finalPreview.data[0], finalPreview.data[1], finalPreview.data[2]);
    
    // Colors should not turn to grey (128, 128, 128)
    const isGrey = finalPreview.data[0] === 128 && 
                   finalPreview.data[1] === 128 && 
                   finalPreview.data[2] === 128;
    expect(isGrey).toBe(false);
  });
});