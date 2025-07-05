import { compressImage } from '../../src/compression/image-compressor';
import { ImageData } from '../../src/compression/image-compressor';

// Test a 512x512 image
const width = 512;
const height = 512;
const testImage: ImageData = {
  width,
  height,
  data: new Uint8ClampedArray(width * height * 4)
};

// Fill with gradient
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const idx = (y * width + x) * 4;
    testImage.data[idx] = (x * 255) / width;
    testImage.data[idx + 1] = (y * 255) / height;
    testImage.data[idx + 2] = 128;
    testImage.data[idx + 3] = 255;
  }
}

const uncompressedSize = width * height * 3; // RGB
console.log(`Original size: ${(uncompressedSize / 1024).toFixed(1)} KB`);

// Test different quality levels
[1.0, 0.9, 0.8, 0.5].forEach(quality => {
  const result = compressImage(testImage, 'TEST-DEVICE', quality);
  const ratio = uncompressedSize / result.size;
  console.log(`Quality ${quality}: ${(result.size / 1024).toFixed(1)} KB (${ratio.toFixed(1)}:1)`);
});