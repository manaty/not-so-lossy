import { codecManager } from './codecs/codec-manager';
import { QDCTCodec } from './codecs/qdct/qdct-codec';
import { ImageData } from './codecs/types';
import * as qdctCompressor from './codecs/qdct/qdct-compressor';

// Mock the decompressImage function to trace calls
const originalDecompressImage = qdctCompressor.decompressImage;
let decompressCalls = 0;

(qdctCompressor as any).decompressImage = function(...args: any[]) {
  decompressCalls++;
  console.log(`\n=== CPU decompressImage call #${decompressCalls} ===`);
  console.log('Arguments:', args[0] ? `${args[0].width}x${args[0].height}` : 'none');
  
  // Get stack trace
  const error = new Error();
  const stack = error.stack || '';
  const lines = stack.split('\n').slice(2, 8); // Skip first 2 lines, show next 6
  console.log('Call stack:');
  lines.forEach(line => console.log('  ' + line.trim()));
  
  // Call original function
  return originalDecompressImage(...args as [any]);
};

async function findDecompressionSource() {
  console.log('=== Finding CPU Decompression Source ===\n');
  
  // Initialize codec
  const codec = codecManager.getCodec() as QDCTCodec;
  console.log('Codec initialized\n');
  
  // Enable WebGPU
  const webGPUEnabled = await codec.setWebGPUEnabled(true);
  console.log(`WebGPU enabled: ${webGPUEnabled}\n`);
  
  // Create test image
  const width = 512;
  const height = 512;
  const imageData: ImageData = {
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height
  };
  
  // Fill with test pattern
  for (let i = 0; i < imageData.data.length; i++) {
    imageData.data[i] = (i % 4) === 3 ? 255 : (i / 4) % 256;
  }
  
  console.log(`Test image: ${width}x${height}\n`);
  
  // Test compression
  console.log('Starting compression with quality 0.8...');
  decompressCalls = 0;
  
  const result = await codec.compressAsync(imageData, {
    quality: 0.8,
    deviceId: 'test-device'
  });
  
  console.log(`\nCompression complete. Size: ${result.size} bytes`);
  console.log(`Total CPU decompress calls: ${decompressCalls}`);
  
  // Now test the quality adjustment scenario
  console.log('\n\n=== Testing Quality Adjustment Scenario ===');
  console.log('Compressing with quality 1.0...');
  decompressCalls = 0;
  
  const highQualityResult = await codec.compressAsync(imageData, {
    quality: 1.0,
    deviceId: 'device1'
  });
  
  console.log(`Size: ${highQualityResult.size} bytes`);
  
  // Simulate the binary search for quality
  const memoryLimit = highQualityResult.size / 2; // Force it to need adjustment
  console.log(`\nSimulating memory limit of ${memoryLimit} bytes (half of compressed size)`);
  
  if (highQualityResult.size > memoryLimit) {
    console.log('Size exceeds limit, adjusting quality to 0.55...');
    
    const adjustedResult = await codec.compressAsync(imageData, {
      quality: 0.55,
      deviceId: 'device1'
    });
    
    console.log(`Adjusted size: ${adjustedResult.size} bytes`);
  }
  
  console.log(`\nTotal CPU decompress calls during quality adjustment: ${decompressCalls}`);
  
  console.log('\n=== Analysis Complete ===');
}

// Run the test
findDecompressionSource().catch(console.error);