const puppeteer = require('puppeteer');
const path = require('path');

async function testWebGPUDecompression() {
  console.log('Starting Puppeteer test for WebGPU decompression...\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-gl=swiftshader']
  });
  
  const page = await browser.newPage();
  
  // Capture console logs
  page.on('console', msg => {
    console.log(`[Browser] ${msg.text()}`);
  });
  
  // Navigate to demo
  await page.goto(`file://${path.join(__dirname, 'demo', 'index.html')}`);
  
  // Wait for page to load
  await page.waitForSelector('#process-btn');
  
  // Check WebGPU availability
  const hasWebGPU = await page.evaluate(() => {
    return 'gpu' in navigator;
  });
  console.log(`\nWebGPU available: ${hasWebGPU}\n`);
  
  // Inject debugging code
  await page.evaluate(() => {
    // Override decompressImage to trace calls
    window.decompressCallCount = 0;
    window.decompressTraces = [];
    
    // We'll patch it after the modules load
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        console.log('Injecting decompression tracer...');
        
        // Try to find and patch the decompressImage function
        if (window.qdctCompressor && window.qdctCompressor.decompressImage) {
          const original = window.qdctCompressor.decompressImage;
          window.qdctCompressor.decompressImage = function(...args) {
            window.decompressCallCount++;
            const error = new Error();
            const stack = error.stack.split('\n').slice(2, 8).join('\n');
            window.decompressTraces.push({
              call: window.decompressCallCount,
              size: args[0] ? `${args[0].width}x${args[0].height}` : 'unknown',
              stack: stack
            });
            console.log(`*** CPU decompressImage call #${window.decompressCallCount} ***`);
            console.log(`Size: ${args[0] ? `${args[0].width}x${args[0].height}` : 'unknown'}`);
            console.log('Stack trace:', stack);
            return original.apply(this, args);
          };
        }
      }, 1000);
    });
  });
  
  // Select a sample image
  await page.click('.sample-image[data-src="/images/im2.jpg"]');
  
  // Make sure WebGPU checkbox is checked
  const webGPUChecked = await page.evaluate(() => {
    const checkbox = document.getElementById('use-webgpu');
    return checkbox ? checkbox.checked : false;
  });
  console.log(`WebGPU checkbox checked: ${webGPUChecked}\n`);
  
  // Process the image
  console.log('Processing image...\n');
  await page.click('#process-btn');
  
  // Wait for processing to complete
  await page.waitForSelector('#results-section:not(.hidden)', { timeout: 60000 });
  
  // Get decompression info
  const decompressionInfo = await page.evaluate(() => {
    return {
      callCount: window.decompressCallCount || 0,
      traces: window.decompressTraces || []
    };
  });
  
  console.log(`\n=== Decompression Analysis ===`);
  console.log(`Total CPU decompress calls: ${decompressionInfo.callCount}`);
  
  if (decompressionInfo.traces.length > 0) {
    console.log('\nFirst decompression call:');
    console.log(decompressionInfo.traces[0]);
  }
  
  await browser.close();
  console.log('\nTest complete.');
}

testWebGPUDecompression().catch(console.error);