import { codecManager } from './codecs/codec-manager';
import { QDCTCodec } from './codecs/qdct/qdct-codec';
import { ImageData, CodecOptions } from './codecs/types';

async function simulateMainFlow() {
  console.log('=== Simulating main.ts compression flow ===\n');
  
  // Get the QDCT codec
  codecManager.setCodec('qdct');
  const codec = codecManager.getCodec() as QDCTCodec;
  
  // Note: WebGPU won't work in Node.js, but we can still trace the flow
  console.log('Note: Running in Node.js - WebGPU will not be available\n');
  
  // Create a large test image (similar to your 4128x2322)
  const width = 4128;
  const height = 2322;
  const imageData: ImageData = {
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height
  };
  
  // Fill with test data
  for (let i = 0; i < imageData.data.length; i += 4) {
    imageData.data[i] = (i / 4) % 256;
    imageData.data[i + 1] = ((i / 4) * 2) % 256;
    imageData.data[i + 2] = ((i / 4) * 3) % 256;
    imageData.data[i + 3] = 255;
  }
  
  console.log(`Test image: ${width}x${height} (${(width * height / 1000000).toFixed(1)}MP)\n`);
  
  // Simulate the exact flow from main.ts processImage()
  const deviceId = 'DEVICE-000';
  const memoryLimit = 10 * 1024 * 1024; // 10MB
  
  console.log('=== First compression (quality 1.0) ===');
  const options: CodecOptions = {
    quality: 1.0,
    deviceId: deviceId
  };
  
  // This simulates the first compression
  console.log('Calling compressAsync with quality 1.0...');
  const result = await codec.compressAsync(imageData, options);
  console.log(`First compression complete. Size: ${result.size} bytes (${(result.size / 1024 / 1024).toFixed(2)} MB)\n`);
  
  // Check if size exceeds memory limit (like in main.ts line 312)
  if (result.size > memoryLimit) {
    console.log(`Size ${result.size} exceeds memory limit ${memoryLimit}\n`);
    console.log('=== Starting quality adjustment (binary search) ===');
    
    // First iteration of binary search
    const testQuality = 0.55; // (0.1 + 1.0) / 2
    options.quality = testQuality;
    
    console.log(`Testing quality ${testQuality}...`);
    console.log('This is where CPU decompression might be triggered!\n');
    
    // This simulates the quality adjustment compression
    const testResult = await codec.compressAsync(imageData, options);
    console.log(`Quality ${testQuality} compression complete. Size: ${testResult.size} bytes\n`);
  }
  
  console.log('=== Test complete ===');
  console.log('Check the logs above to see where decompression was called.');
}

// Run the simulation
simulateMainFlow().catch(console.error);