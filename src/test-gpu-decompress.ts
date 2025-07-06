import { codecManager } from './codecs/codec-manager';
import { QDCTCodec } from './codecs/qdct/qdct-codec';
import { ImageData } from './codecs/types';
import { decompressImage as cpuDecompressImage } from './codecs/qdct/qdct-compressor';

// Override console.trace to capture stack traces
let capturedStacks: string[] = [];
const originalTrace = console.trace;
console.trace = function(message?: any, ...optionalParams: any[]) {
  const error = new Error();
  const stack = error.stack || '';
  capturedStacks.push(`${message}\n${stack}`);
  originalTrace.call(console, message, ...optionalParams);
};

async function testGPUDecompression() {
  console.log('=== Testing GPU Decompression Issue ===\n');
  
  // Initialize codec
  const codec = codecManager.getCodec() as QDCTCodec;
  
  // Enable WebGPU
  console.log('Enabling WebGPU...');
  const webGPUEnabled = await codec.setWebGPUEnabled(true);
  console.log(`WebGPU enabled: ${webGPUEnabled}\n`);
  
  if (!webGPUEnabled) {
    console.error('WebGPU not available, cannot run test');
    return;
  }
  
  // Create a test image (smaller for faster testing)
  const width = 512;
  const height = 512;
  const imageData: ImageData = {
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height
  };
  
  // Fill with some test pattern
  for (let i = 0; i < imageData.data.length; i += 4) {
    imageData.data[i] = (i / 4) % 256;     // R
    imageData.data[i + 1] = ((i / 4) * 2) % 256; // G
    imageData.data[i + 2] = ((i / 4) * 3) % 256; // B
    imageData.data[i + 3] = 255;          // A
  }
  
  console.log(`Test image: ${width}x${height}\n`);
  
  // Test 1: Direct compression with compressAsync
  console.log('Test 1: Direct compression with compressAsync...');
  capturedStacks = [];
  
  const result1 = await codec.compressAsync(imageData, {
    quality: 0.8,
    deviceId: 'test-device'
  });
  console.log(`Compressed size: ${result1.size} bytes`);
  console.log(`CPU decompression calls during compression: ${capturedStacks.length}`);
  if (capturedStacks.length > 0) {
    console.log('Stack traces:', capturedStacks);
  }
  console.log();
  
  // Test 2: Compression with compressWithLevel
  console.log('Test 2: Compression with compressWithLevel...');
  capturedStacks = [];
  
  const result2 = await codec.compressWithLevel(imageData, 'test-device', 10);
  console.log(`Compressed size: ${result2.size} bytes`);
  console.log(`CPU decompression calls during compression: ${capturedStacks.length}`);
  if (capturedStacks.length > 0) {
    console.log('First stack trace:', capturedStacks[0]);
  }
  console.log();
  
  // Test 3: Check the compress (sync) method
  console.log('Test 3: Sync compress method...');
  capturedStacks = [];
  
  const result3 = codec.compress(imageData, {
    quality: 0.8,
    deviceId: 'test-device'
  });
  console.log(`Compressed size: ${result3.size} bytes`);
  console.log(`CPU decompression calls during sync compression: ${capturedStacks.length}`);
  console.log();
  
  // Test 4: Check if it's the sampled compression
  console.log('Test 4: Sampled compression...');
  capturedStacks = [];
  
  const largeImage: ImageData = {
    data: new Uint8ClampedArray(4096 * 3072 * 4), // Large image
    width: 4096,
    height: 3072
  };
  
  // Fill with test data
  for (let i = 0; i < largeImage.data.length; i += 4) {
    largeImage.data[i] = i % 256;
    largeImage.data[i + 1] = (i + 1) % 256;
    largeImage.data[i + 2] = (i + 2) % 256;
    largeImage.data[i + 3] = 255;
  }
  
  const result4 = await codec.compressWithLevelSampled(largeImage, 'test-device', 10, 100);
  console.log(`Sampled compression size: ${result4.size} bytes`);
  console.log(`CPU decompression calls during sampled compression: ${capturedStacks.length}`);
  if (capturedStacks.length > 0) {
    console.log('Stack trace shows decompression called from:', capturedStacks[0].split('\n')[5]);
  }
  
  console.log('\n=== Test Complete ===');
}

// Run the test
testGPUDecompression().catch(console.error);