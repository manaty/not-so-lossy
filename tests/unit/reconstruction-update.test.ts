import { compressImage, decompressImage, reconstructFromMultiple, calculatePSNR } from '../../src/codecs/dct/dct-compressor';
import { ImageData } from '../../src/codecs/dct/dct-compressor';

describe('Reconstruction Update Tests', () => {
  it('should update reconstruction when device quality changes', () => {
    // Create a test image with a pattern
    const width = 32;
    const height = 32;
    const testImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    // Create a gradient pattern
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        testImage.data[idx] = (x * 255) / width;     // R gradient
        testImage.data[idx + 1] = (y * 255) / height; // G gradient
        testImage.data[idx + 2] = 128;                // B constant
        testImage.data[idx + 3] = 255;                // A
      }
    }

    // Simulate 3 devices
    const deviceIds = ['DEVICE-001', 'DEVICE-002', 'DEVICE-003'];
    
    // Initial compression at quality 1.0
    const devices = deviceIds.map(id => ({
      id,
      compressed: compressImage(testImage, id, 1.0).compressed
    }));

    // Initial reconstruction
    const reconstruction1 = reconstructFromMultiple(devices.map(d => d.compressed));
    const psnr1 = calculatePSNR(testImage, reconstruction1);
    console.log('Initial PSNR with all devices at quality 1.0:', psnr1.toFixed(2));

    // Simulate recompressing device 1 at lower quality
    const device1Decompressed = decompressImage(devices[0].compressed);
    const device1Recompressed = compressImage(device1Decompressed, devices[0].id, 0.5);
    devices[0].compressed = device1Recompressed.compressed;

    // Updated reconstruction
    const reconstruction2 = reconstructFromMultiple(devices.map(d => d.compressed));
    const psnr2 = calculatePSNR(testImage, reconstruction2);
    console.log('PSNR after device 1 recompressed to quality 0.5:', psnr2.toFixed(2));

    // PSNR might change (could improve or worsen depending on device strategies)
    expect(Math.abs(psnr2 - psnr1)).toBeGreaterThan(0.01); // Should be different

    // But reconstruction should still produce a valid image
    expect(reconstruction2.width).toBe(width);
    expect(reconstruction2.height).toBe(height);
    expect(reconstruction2.data.length).toBe(width * height * 4);
  });

  it('should handle multiple device recompressions', () => {
    // Simple white image
    const width = 16;
    const height = 16;
    const whiteImage: ImageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4).fill(255)
    };

    // Start with 2 devices
    let device1 = compressImage(whiteImage, 'DEVICE-A', 1.0);
    let device2 = compressImage(whiteImage, 'DEVICE-B', 1.0);

    // Initial reconstruction should be white
    const reconstruction1 = reconstructFromMultiple([device1.compressed, device2.compressed]);
    console.log('\nInitial reconstruction (both at quality 1.0):');
    console.log('First pixel:', reconstruction1.data[0], reconstruction1.data[1], reconstruction1.data[2]);

    // Recompress device 1
    const decompressed1 = decompressImage(device1.compressed);
    device1 = compressImage(decompressed1, 'DEVICE-A', 0.7);

    // Reconstruction with mixed qualities
    const reconstruction2 = reconstructFromMultiple([device1.compressed, device2.compressed]);
    console.log('After device 1 at quality 0.7:');
    console.log('First pixel:', reconstruction2.data[0], reconstruction2.data[1], reconstruction2.data[2]);

    // Recompress device 2
    const decompressed2 = decompressImage(device2.compressed);
    device2 = compressImage(decompressed2, 'DEVICE-B', 0.6);

    // Final reconstruction
    const reconstruction3 = reconstructFromMultiple([device1.compressed, device2.compressed]);
    console.log('After device 2 at quality 0.6:');
    console.log('First pixel:', reconstruction3.data[0], reconstruction3.data[1], reconstruction3.data[2]);

    // Should still be close to white
    expect(reconstruction3.data[0]).toBeGreaterThan(250);
  });
});