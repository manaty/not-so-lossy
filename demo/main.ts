import { codecManager } from '../src/codecs/codec-manager';
import { ImageData, CodecOptions } from '../src/codecs/types';
import { exportToNSL, generateNSLFilename } from '../src/codecs/qdct/nsl-format';

interface DeviceState {
  id: string;
  originalCompressed: any;
  currentCompressed: any;
  currentQuality: number;
  currentSize: number;
  memoryLimit: number;
  targetSize: number;
}

class ModularImageCompressionDemo {
  private originalImage: ImageData | null = null;
  private devices: DeviceState[] = [];
  private deviceCount: number = 3;
  private currentCodec: string = 'qdct';

  constructor() {
    this.initializeEventListeners();
    this.updateCodecSelector();
    this.checkWebGPUSupport();
  }
  
  private async checkWebGPUSupport(): Promise<void> {
    const webGPUCheckbox = document.getElementById('use-webgpu') as HTMLInputElement;
    const webGPUOption = document.getElementById('webgpu-option') as HTMLDivElement;
    
    if (!navigator.gpu) {
      // WebGPU not supported - hide the option completely
      return;
    }
    
    // Check if we can get an adapter
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        // No adapter available - hide the option
        return;
      } else {
        // WebGPU is available - show and check the checkbox
        console.log('WebGPU is available');
        webGPUOption.style.display = 'block';
        webGPUCheckbox.checked = true;
        
        // Initialize WebGPU if QDCT is selected
        if (this.currentCodec === 'qdct') {
          const codec = codecManager.getCodec() as any;
          if (codec.setWebGPUEnabled) {
            await codec.setWebGPUEnabled(true);
          }
        }
        
        webGPUCheckbox.addEventListener('change', async (e) => {
          const enabled = (e.target as HTMLInputElement).checked;
          if (this.currentCodec === 'qdct') {
            const codec = codecManager.getCodec() as any;
            if (codec.setWebGPUEnabled) {
              const success = await codec.setWebGPUEnabled(enabled);
              if (!success && enabled) {
                webGPUCheckbox.checked = false;
                alert('Failed to initialize WebGPU acceleration');
              }
            }
          }
        });
      }
    } catch (error) {
      console.error('Error checking WebGPU support:', error);
      // Hide the option on error
    }
  }

  private updateCodecSelector(): void {
    const codecSelector = document.getElementById('codec-selector') as HTMLSelectElement;
    if (codecSelector) {
      codecManager.getAvailableCodecs().forEach(codec => {
        const option = document.createElement('option');
        option.value = codec;
        option.textContent = codec.toUpperCase();
        codecSelector.appendChild(option);
      });
      
      codecSelector.addEventListener('change', async (e) => {
        this.currentCodec = (e.target as HTMLSelectElement).value;
        codecManager.setCodec(this.currentCodec);
        
        // Enable WebGPU if switching to QDCT and WebGPU is checked
        if (this.currentCodec === 'qdct') {
          const webGPUCheckbox = document.getElementById('use-webgpu') as HTMLInputElement;
          if (webGPUCheckbox?.checked) {
            const codec = codecManager.getCodec() as any;
            if (codec.setWebGPUEnabled) {
              await codec.setWebGPUEnabled(true);
            }
          }
        }
        
        // Reprocess if image is loaded
        if (this.originalImage) {
          this.processImage();
        }
      });
    }
  }

  private initializeEventListeners(): void {
    const deviceCountInput = document.getElementById('device-count') as HTMLInputElement;
    const imageUpload = document.getElementById('image-upload') as HTMLInputElement;
    const processBtn = document.getElementById('process-btn') as HTMLButtonElement;
    const sampleImages = document.querySelectorAll('.sample-image');

    deviceCountInput.addEventListener('change', (e) => {
      this.deviceCount = parseInt((e.target as HTMLInputElement).value);
    });

    imageUpload.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        sampleImages.forEach(img => img.classList.remove('selected'));
        this.loadImage(file);
      }
    });

    processBtn.addEventListener('click', () => {
      if (this.originalImage) {
        this.processImage();
      }
    });

    sampleImages.forEach(sampleEl => {
      sampleEl.addEventListener('click', async () => {
        sampleImages.forEach(img => img.classList.remove('selected'));
        sampleEl.classList.add('selected');
        
        const imagePath = sampleEl.getAttribute('data-src')!;
        await this.loadSampleImage(imagePath);
      });
    });
  }

  private async loadImage(file: File): Promise<void> {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      const useFullResolution = (document.getElementById('full-resolution') as HTMLInputElement).checked;
      const maxSize = useFullResolution ? Infinity : 512;
      let { width, height } = img;
      
      console.log(`Loading image: original size ${img.width}x${img.height}, full resolution: ${useFullResolution}, max size: ${maxSize}`);
      
      if (width > maxSize || height > maxSize) {
        const scale = Math.min(maxSize / width, maxSize / height);
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);
        console.log(`Resizing image from ${img.width}x${img.height} to ${width}x${height}`);
      }
      
      // Warn if image is very large
      if (useFullResolution && width * height > 4000000) {
        console.warn(`Processing large image: ${width}x${height} (${(width * height / 1000000).toFixed(1)} megapixels)`);
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      const imageData = ctx.getImageData(0, 0, width, height);
      this.originalImage = {
        data: imageData.data,
        width,
        height
      };
      
      this.displayImage('original-canvas', this.originalImage);
      document.getElementById('original-size')!.textContent = 
        `${width}×${height} (${this.formatSize(width * height * 3)})`;
      
      // Set original image for viewer
      imageViewer.setOriginalImage(this.originalImage);
      
      (document.getElementById('process-btn') as HTMLButtonElement).disabled = false;
      
      URL.revokeObjectURL(url);
    };

    img.src = url;
  }

  private async loadSampleImage(imagePath: string): Promise<void> {
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      const useFullResolution = (document.getElementById('full-resolution') as HTMLInputElement).checked;
      const maxSize = useFullResolution ? Infinity : 512;
      let { width, height } = img;
      
      console.log(`Loading image: original size ${img.width}x${img.height}, full resolution: ${useFullResolution}, max size: ${maxSize}`);
      
      if (width > maxSize || height > maxSize) {
        const scale = Math.min(maxSize / width, maxSize / height);
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);
        console.log(`Resizing image from ${img.width}x${img.height} to ${width}x${height}`);
      }
      
      // Warn if image is very large
      if (useFullResolution && width * height > 4000000) {
        console.warn(`Processing large image: ${width}x${height} (${(width * height / 1000000).toFixed(1)} megapixels)`);
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      const imageData = ctx.getImageData(0, 0, width, height);
      this.originalImage = {
        data: imageData.data,
        width,
        height
      };
      
      this.displayImage('original-canvas', this.originalImage);
      document.getElementById('original-size')!.textContent = 
        `${width}×${height} (${this.formatSize(width * height * 3)})`;
      
      // Set original image for viewer
      imageViewer.setOriginalImage(this.originalImage);
      
      (document.getElementById('process-btn') as HTMLButtonElement).disabled = false;
    };

    img.src = imagePath;
  }

  private async processImage(): Promise<void> {
    if (!this.originalImage) return;

    // Set original image for viewer
    imageViewer.setOriginalImage(this.originalImage);
    
    // Check if WebGPU should be enabled
    const webGPUCheckbox = document.getElementById('use-webgpu') as HTMLInputElement;
    if (webGPUCheckbox.checked && this.currentCodec === 'qdct') {
      const codec = codecManager.getCodec() as any;
      if (codec.setWebGPUEnabled) {
        await codec.setWebGPUEnabled(true);
      }
    }

    // Show codec info
    const codecInfo = document.getElementById('codec-info');
    if (codecInfo) {
      const codec = codecManager.getCodec() as any;
      const webGPUStatus = codec.isWebGPUEnabled && codec.isWebGPUEnabled() ? ' (WebGPU)' : '';
      codecInfo.textContent = `Using ${this.currentCodec.toUpperCase()} codec${webGPUStatus}`;
    }

    const progressContainer = document.getElementById('progress-container')!;
    const progressFill = document.querySelector('.progress-fill') as HTMLElement;
    const progressCurrent = document.getElementById('progress-current')!;
    const progressTotal = document.getElementById('progress-total')!;
    const processBtn = document.getElementById('process-btn') as HTMLButtonElement;
    
    progressContainer.classList.remove('hidden');
    processBtn.disabled = true;
    progressTotal.textContent = String(this.deviceCount);
    progressCurrent.textContent = '0';
    progressFill.style.width = '0%';

    this.devices = [];

    for (let i = 0; i < this.deviceCount; i++) {
      progressCurrent.textContent = String(i);
      progressFill.style.width = `${(i / this.deviceCount) * 100}%`;
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const deviceId = `DEVICE-${String(i).padStart(3, '0')}`;
      const memoryLimit = 100 * 1024 * 1024; // 100MB
      
      const options: CodecOptions = {
        quality: 1.0,
        deviceId: deviceId
      };
      
      console.log(`Processing device ${i + 1}/${this.deviceCount}: ${deviceId}`);
      
      let result;
      let initialQuality = 1.0;
      
      // Check if we should use WebGPU async compression
      const codec = codecManager.getCodec() as any;
      if (this.currentCodec === 'qdct' && codec.isWebGPUEnabled && codec.isWebGPUEnabled() && codec.compressAsync) {
        console.log('Using WebGPU async compression');
        result = await codec.compressAsync(this.originalImage, options);
        console.log(`Device ${i + 1} compressed successfully, size: ${result.size} bytes`);
      } else {
        result = codecManager.compress(this.originalImage, options);
      }
      
      // Adjust quality if size exceeds memory limit
      if (result.size > memoryLimit) {
        console.log(`Device ${i + 1} size ${result.size} exceeds memory limit ${memoryLimit}, adjusting quality...`);
        let low = 0.1;
        let high = 1.0;
        let bestQuality = 1.0;
        let bestResult = result;
        
        for (let iter = 0; iter < 10; iter++) {
          const testQuality = (low + high) / 2;
          options.quality = testQuality;
          
          let testResult;
          if (this.currentCodec === 'qdct' && codec.isWebGPUEnabled && codec.isWebGPUEnabled() && codec.compressAsync) {
            console.log(`Quality adjustment iteration ${iter + 1}: Testing quality ${testQuality} with WebGPU...`);
            testResult = await codec.compressAsync(this.originalImage, options);
          } else {
            console.log(`Quality adjustment iteration ${iter + 1}: Testing quality ${testQuality} with CPU...`);
            testResult = codecManager.compress(this.originalImage, options);
          }
          
          if (testResult.size <= memoryLimit) {
            low = testQuality;
            bestQuality = testQuality;
            bestResult = testResult;
            
            if (testResult.size > memoryLimit * 0.95) {
              break;
            }
          } else {
            high = testQuality;
          }
        }
        
        result = bestResult;
        initialQuality = bestQuality;
      }
      
      this.devices.push({
        id: deviceId,
        originalCompressed: result.compressed,
        currentCompressed: result.compressed,
        currentQuality: initialQuality,
        currentSize: result.size,
        memoryLimit: memoryLimit,
        targetSize: result.size
      });
    }

    progressCurrent.textContent = String(this.deviceCount);
    progressFill.style.width = '100%';
    
    await new Promise(resolve => setTimeout(resolve, 300));

    progressContainer.classList.add('hidden');
    processBtn.disabled = false;

    document.getElementById('results-section')!.classList.remove('hidden');

    this.createDeviceCards();
    
    // Defer reconstruction to avoid blocking UI
    setTimeout(() => {
      console.log('Starting reconstruction...');
      this.updateReconstruction();
    }, 100);
  }

  private updateReconstruction(): void {
    if (this.devices.length === 0 || !this.originalImage) return;

    console.log('Reconstructing from multiple devices...');
    const compressedVersions = this.devices.map(d => d.currentCompressed);
    
    try {
      const reconstructed = codecManager.reconstructFromMultiple(compressedVersions);
      console.log('Reconstruction complete, displaying...');
      
      this.displayImage('reconstructed-canvas', reconstructed);
      
      const psnr = codecManager.calculatePSNR(this.originalImage, reconstructed);
      document.getElementById('psnr-value')!.textContent = psnr.toFixed(2);
      
      const totalSize = this.devices.reduce((sum, d) => sum + d.currentSize, 0);
      document.getElementById('total-size')!.textContent = this.formatSize(totalSize);
      
      // Add click handler for reconstructed canvas
      const canvas = document.getElementById('reconstructed-canvas') as HTMLCanvasElement;
      canvas.onclick = () => {
      imageViewer.open(reconstructed, 'Reconstructed Image', {
        originalSize: this.formatSize(this.originalImage!.width * this.originalImage!.height * 3),
        compressedSize: this.formatSize(totalSize),
        psnr: psnr
      });
    };
    } catch (error) {
      console.error('Reconstruction failed:', error);
      document.getElementById('psnr-value')!.textContent = 'Error';
      document.getElementById('total-size')!.textContent = 'Error';
    }
  }

  private createDeviceCards(): void {
    const container = document.getElementById('device-cards')!;
    container.innerHTML = '';

    this.devices.forEach((device, index) => {
      const card = this.createDeviceCard(device, index);
      container.appendChild(card);
    });
  }

  private createDeviceCard(device: DeviceState, index: number): HTMLElement {
    const card = document.createElement('div');
    card.className = 'device-card';
    card.innerHTML = `
      <h4>
        Device ${index + 1}
        <span class="device-id">${device.id}</span>
      </h4>
      <canvas id="device-canvas-${index}" style="background: #f0f0f0; min-height: 150px;"></canvas>
      <div id="device-loading-${index}" style="text-align: center; margin-top: -75px; color: #666;">Loading...</div>
      <div class="device-controls">
        <div class="size-control">
          <label>Target Size:</label>
          <input type="range" 
                 id="size-${index}" 
                 min="1024" 
                 max="${device.currentSize}" 
                 step="1024" 
                 value="${device.currentSize}">
          <span id="size-value-${index}">${this.formatSize(device.currentSize)}</span>
        </div>
        <button class="recompress-btn" id="recompress-${index}">Apply Size</button>
        <div class="device-actions">
          <button class="export-btn" id="export-${index}">Export .nsl</button>
        </div>
      </div>
      <div class="device-info">
        <span>Size: <span id="device-size-${index}">${this.formatSize(device.currentSize)}</span></span>
        <span>Quality: <span id="device-quality-${index}">${(device.currentQuality * 100).toFixed(0)}%</span></span>
        <span>PSNR: <span id="device-psnr-${index}">-</span> dB</span>
      </div>
      <div class="device-memory">
        Memory: ${this.formatSize(device.currentSize)} / ${this.formatSize(device.memoryLimit)}
      </div>
    `;

    // Defer decompression with staggered timing to avoid blocking
    setTimeout(async () => {
      try {
        console.log(`Decompressing device ${index + 1}...`);
        let preview: ImageData;
        
        // Use async decompression if WebGPU is enabled
        const webGPUCheckbox = document.getElementById('use-webgpu') as HTMLInputElement;
        if (webGPUCheckbox?.checked && this.currentCodec === 'qdct') {
          const codec = codecManager.getCodec() as any;
          console.log(`Decompressing device ${index + 1} with WebGPU. Codec has decompressAsync: ${!!codec.decompressAsync}`);
          if (codec.decompressAsync) {
            preview = await codec.decompressAsync(device.currentCompressed, device.id);
          } else {
            console.warn('decompressAsync not found on codec');
            preview = codecManager.decompress(device.currentCompressed, device.id);
          }
        } else {
          console.log(`Decompressing device ${index + 1} with CPU (WebGPU checkbox: ${webGPUCheckbox?.checked}, codec: ${this.currentCodec})`);
          preview = codecManager.decompress(device.currentCompressed, device.id);
        }
        
        this.displayImage(`device-canvas-${index}`, preview);
        
        // Hide loading indicator
        const loadingEl = document.getElementById(`device-loading-${index}`);
        if (loadingEl) loadingEl.style.display = 'none';
        
        const psnr = codecManager.calculatePSNR(this.originalImage!, preview);
        card.querySelector(`#device-psnr-${index}`)!.textContent = psnr.toFixed(2);
        console.log(`Device ${index + 1} display complete`);
        
        // Add click handler for device canvas
        const canvas = document.getElementById(`device-canvas-${index}`) as HTMLCanvasElement;
        canvas.onclick = () => {
          console.log(`Device ${index} clicked, opening viewer with:`, {
            hasOriginal: !!this.originalImage,
            hasPreview: !!preview,
            previewSize: `${preview.width}x${preview.height}`
          });
          imageViewer.open(preview, `Device ${index + 1} - ${device.id}`, {
            originalSize: this.formatSize(this.originalImage!.width * this.originalImage!.height * 3),
            compressedSize: this.formatSize(device.currentSize),
            psnr: psnr
          });
        };
      } catch (error) {
        console.error(`Error displaying device ${index}:`, error);
      }
    }, index * 500); // Stagger decompression by 500ms per device

    const sizeSlider = card.querySelector(`#size-${index}`) as HTMLInputElement;
    const sizeValue = card.querySelector(`#size-value-${index}`) as HTMLElement;
    const recompressBtn = card.querySelector(`#recompress-${index}`) as HTMLButtonElement;

    sizeSlider.addEventListener('input', (e) => {
      const targetSize = parseInt((e.target as HTMLInputElement).value);
      sizeValue.textContent = this.formatSize(targetSize);
    });

    recompressBtn.addEventListener('click', async () => {
      const targetSize = parseInt(sizeSlider.value);
      recompressBtn.disabled = true;
      recompressBtn.textContent = 'Finding quality...';
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      if (targetSize === 0) {
        await this.recompressDevice(index, 0.1);
      } else {
        await this.recompressDeviceToSize(index, targetSize);
      }
      
      sizeSlider.max = String(device.currentSize);
      sizeSlider.value = String(device.currentSize);
      sizeValue.textContent = this.formatSize(device.currentSize);
      
      recompressBtn.disabled = false;
      recompressBtn.textContent = 'Apply Size';
    });

    // Export button
    const exportBtn = card.querySelector(`#export-${index}`) as HTMLButtonElement;
    exportBtn.addEventListener('click', () => {
      this.exportDeviceImage(index);
    });

    return card;
  }

  private async recompressDeviceToSize(deviceIndex: number, targetSize: number): Promise<void> {
    const device = this.devices[deviceIndex];
    
    console.log(`\n=== Recompressing ${device.id} ===`);
    console.log(`Target size: ${this.formatSize(targetSize)}`);
    
    // Use async decompression if WebGPU is enabled
    let originalDecompressed: ImageData;
    const webGPUCheckbox = document.getElementById('use-webgpu') as HTMLInputElement;
    if (webGPUCheckbox?.checked && this.currentCodec === 'qdct') {
      const codec = codecManager.getCodec() as any;
      if (codec.decompressAsync) {
        originalDecompressed = await codec.decompressAsync(device.originalCompressed, device.id);
      } else {
        originalDecompressed = codecManager.decompress(device.originalCompressed, device.id);
      }
    } else {
      originalDecompressed = codecManager.decompress(device.originalCompressed, device.id);
    }
    const originalSize = originalDecompressed.width * originalDecompressed.height * 3;
    
    // For large images, use sampling to speed up compression level estimation
    const totalBlocks = Math.ceil(originalDecompressed.width / 8) * Math.ceil(originalDecompressed.height / 8);
    const useSampling = totalBlocks > 200; // Use sampling if more than 200 blocks
    const sampleSize = 100; // Sample 100 blocks for estimation
    
    if (useSampling) {
      console.log(`Large image detected: ${totalBlocks} blocks. Using sampling with ${sampleSize} blocks for faster estimation.`);
      const samplingRatio = ((sampleSize / totalBlocks) * 100).toFixed(2);
      console.log(`Sampling ratio: ${samplingRatio}% of total blocks`);
    }
    
    // Use empirical model to estimate initial compression level
    const targetRatio = originalSize / targetSize;
    let estimatedLevel: number;
    
    if (targetRatio < 5) {
      estimatedLevel = 1.25 * (targetRatio - 1);
    } else if (targetRatio < 15) {
      estimatedLevel = 2.0 * (targetRatio - 1);
    } else {
      estimatedLevel = 1.5 * (targetRatio - 1) + 10;
    }
    
    console.log(`Target compression ratio: ${targetRatio.toFixed(1)}:1`);
    console.log(`Estimated compression level: ${estimatedLevel.toFixed(0)}`);
    
    const isQDCT = this.currentCodec === 'qdct';
    console.log('\nTrying compression levels:');
    
    let bestResult = null;
    let bestLevel = estimatedLevel;
    const tolerance = targetSize * 0.1;
    let attempts = 0;
    
    // Newton-like approach for faster convergence
    let currentLevel = Math.round(estimatedLevel);
    let previousLevel = -1;
    let previousSize = -1;
    
    for (let i = 0; i < 15; i++) {
      attempts++;
      
      // Compress at current level
      let result: any;
      if (isQDCT) {
        // For QDCT, directly use the level, with sampling for large images
        result = await this.compressAtLevel(originalDecompressed, device.id, currentLevel, useSampling);
      } else {
        // For other codecs, convert level to quality
        const quality = Math.max(0.01, 1 - (Math.min(currentLevel, 63) / 63));
        const options: CodecOptions = {
          quality: quality,
          deviceId: device.id
        };
        result = codecManager.compress(originalDecompressed, options);
      }
      
      console.log(`  Attempt ${attempts}: Level=${currentLevel}, Size=${this.formatSize(result.size)} (${result.size > targetSize ? 'too large' : 'too small'})`);
      
      // Check if we've reached the target (below target size is acceptable)
      if (result.size <= targetSize) {
        bestResult = result;
        bestLevel = currentLevel;
        console.log('  Target achieved! Size is below target.');
        break;
      }
      
      // Update best result if it's the smallest that's still above target
      // or if we don't have a result yet
      if (!bestResult || result.size < bestResult.size) {
        bestResult = result;
        bestLevel = currentLevel;
      }
      
      // Newton-like step
      if (previousSize > 0 && previousLevel !== currentLevel && previousLevel >= 0) {
        // Estimate derivative: dSize/dLevel
        const derivative = (result.size - previousSize) / (currentLevel - previousLevel);
        
        console.log(`    Previous: Level=${previousLevel}, Size=${this.formatSize(previousSize)}`);
        console.log(`    Current: Level=${currentLevel}, Size=${this.formatSize(result.size)}`);
        console.log(`    Derivative: ${derivative.toFixed(1)} bytes/level`);
        
        // Only use Newton if derivative is reasonable and negative (size decreases as level increases)
        if (derivative < -10 && derivative > -10000) {
          // Newton step: we want to find where f(level) = target
          // f(level) ≈ f(current) + f'(current) * (level - current)
          // target = result.size + derivative * (level - current)
          // (target - result.size) = derivative * (level - current)
          // level = current + (target - result.size) / derivative
          const step = Math.round((targetSize - result.size) / derivative);
          let nextLevel = currentLevel + step;
          
          // Sanity check: ensure the step is reasonable and positive
          if (step <= 0) {
            // Newton suggests reducing level, but we need more compression
            // Use heuristic instead
            console.log(`    Newton suggests reducing level (step=${step}), using heuristic instead`);
            nextLevel = currentLevel + Math.max(5, Math.round(currentLevel * 0.2));
          } else if (step > 200) {
            // Allow larger steps when far from target
            const sizeRatio = result.size / targetSize;
            const maxStep = sizeRatio > 2 ? 300 : sizeRatio > 1.5 ? 200 : 100;
            console.log(`    Newton step too large (${step}), limiting to ${maxStep}`);
            nextLevel = currentLevel + maxStep;
          }
          
          // Ensure we always increase level
          nextLevel = Math.max(currentLevel + 1, nextLevel);
          
          // Save current state before updating
          previousLevel = currentLevel;
          previousSize = result.size;
          currentLevel = nextLevel;
          
          console.log(`    Newton step: ${step}, next level=${currentLevel}`);
        } else {
          // Derivative unreliable, use heuristic based on how far we are from target
          const sizeRatio = result.size / targetSize;
          let stepSize: number;
          
          if (sizeRatio > 3) {
            stepSize = currentLevel * 2; // Triple the level
          } else if (sizeRatio > 2) {
            stepSize = currentLevel; // Double the level
          } else if (sizeRatio > 1.5) {
            stepSize = Math.round(currentLevel * 0.7); // Increase by 70%
          } else if (sizeRatio > 1.3) {
            stepSize = Math.round(currentLevel * 0.5); // Increase by 50%
          } else if (sizeRatio > 1.1) {
            stepSize = Math.max(50, Math.round(currentLevel * 0.3)); // At least 50 or 30%
          } else if (sizeRatio > 1.05) {
            stepSize = Math.max(30, Math.round(currentLevel * 0.2)); // At least 30 or 20%
          } else {
            stepSize = Math.max(20, Math.round(currentLevel * 0.1)); // At least 20 or 10%
          }
          
          previousLevel = currentLevel;
          previousSize = result.size;
          currentLevel = Math.max(0, currentLevel + stepSize);
          
          console.log(`    Heuristic step: sizeRatio=${sizeRatio.toFixed(2)}, step=${stepSize}, next level=${currentLevel}`);
        }
      } else {
        // First iteration or invalid previous state
        const sizeRatio = result.size / targetSize;
        let initialStep: number;
        
        if (sizeRatio > 3) {
          // Way too large, triple the level
          initialStep = Math.round(currentLevel * 2);
        } else if (sizeRatio > 2) {
          // Double the level
          initialStep = currentLevel;
        } else if (sizeRatio > 1.5) {
          initialStep = Math.round(currentLevel * 0.7);
        } else if (sizeRatio > 1.2) {
          initialStep = Math.max(50, Math.round(currentLevel * 0.5));
        } else if (sizeRatio > 1.1) {
          initialStep = Math.max(40, Math.round(currentLevel * 0.3));
        } else {
          initialStep = Math.max(30, Math.round(currentLevel * 0.2));
        }
        
        previousLevel = currentLevel;
        previousSize = result.size;
        currentLevel = Math.max(0, currentLevel + initialStep);
        
        console.log(`    Initial step: sizeRatio=${sizeRatio.toFixed(2)}, step=${initialStep}, next level=${currentLevel}`);
      }
    }
    
    if (!bestResult) {
      console.error('Failed to find suitable compression level');
      return;
    }
    
    // If we used sampling, do a final full compression at the best level
    if (useSampling && isQDCT) {
      console.log('\nPerforming final full compression at level', bestLevel);
      const finalResult = await this.compressAtLevel(originalDecompressed, device.id, bestLevel, false);
      device.currentCompressed = finalResult.compressed;
      device.currentSize = finalResult.size;
      console.log(`Final actual size: ${this.formatSize(finalResult.size)}`);
    } else {
      device.currentCompressed = bestResult.compressed;
      device.currentSize = bestResult.size;
    }
    
    device.currentQuality = isQDCT ? 0.1 : Math.max(0.01, 1 - (Math.min(bestLevel, 63) / 63));
    device.targetSize = targetSize;
    
    // Log final result and quantization matrix
    console.log(`\nFinal selection:`);
    console.log(`  Level: ${Math.round(bestLevel)}`);
    console.log(`  Size: ${this.formatSize(bestResult.size)}`);
    console.log(`  Compression ratio: ${(originalSize / bestResult.size).toFixed(1)}:1`);
    
    // Get and display the quantization matrix
    if (isQDCT) {
      const qdctCodec = codecManager.getCodec() as any;
      if (qdctCodec.getQuantizationMatrix) {
        const matrix = qdctCodec.getQuantizationMatrix(device.id, Math.round(bestLevel));
        console.log('\nQuantization Matrix:');
        this.printMatrix(matrix);
      }
    }
    
    this.updateDeviceDisplay(deviceIndex);
  }
  
  private async compressAtLevel(imageData: ImageData, deviceId: string, level: number, useSampling: boolean = false): Promise<any> {
    // For QDCT, we need to implement direct level-based compression
    const codec = codecManager.getCodec() as any;
    
    if (useSampling && codec.compressWithLevelSampled) {
      // Use sampled compression for size estimation
      const result = codec.compressWithLevelSampled(imageData, deviceId, level, 100);
      return result instanceof Promise ? await result : result;
    } else if (codec.compressWithLevel) {
      // If codec supports direct level compression
      // Handle both sync and async versions
      const result = codec.compressWithLevel(imageData, deviceId, level);
      return result instanceof Promise ? await result : result;
    } else {
      // Fallback: use quality mapping
      const quality = Math.max(0.01, 1 - (Math.min(level, 63) / 63));
      const options: CodecOptions = {
        quality: quality,
        deviceId: deviceId
      };
      return codecManager.compress(imageData, options);
    }
  }

  private printMatrix(matrix: number[][]): void {
    // Add column headers
    console.log('     0    1    2    3    4    5    6    7');
    console.log('  +----------------------------------------');
    
    for (let row = 0; row < 8; row++) {
      let line = row + ' | ';
      for (let col = 0; col < 8; col++) {
        const value = matrix[row][col];
        // Color code based on value ranges
        if (value === 1) {
          line += '\x1b[32m' + value.toString().padStart(4) + '\x1b[0m '; // Green for 1
        } else if (value < 10) {
          line += '\x1b[36m' + value.toString().padStart(4) + '\x1b[0m '; // Cyan for low
        } else if (value < 20) {
          line += '\x1b[33m' + value.toString().padStart(4) + '\x1b[0m '; // Yellow for medium
        } else {
          line += '\x1b[31m' + value.toString().padStart(4) + '\x1b[0m '; // Red for high
        }
      }
      console.log(line);
    }
    console.log('\n  Legend: \x1b[32m1\x1b[0m=none, \x1b[36m<10\x1b[0m=low, \x1b[33m10-19\x1b[0m=medium, \x1b[31m≥20\x1b[0m=high');
  }

  private async recompressDevice(deviceIndex: number, quality: number): Promise<void> {
    const device = this.devices[deviceIndex];
    
    // Use async decompression if WebGPU is enabled
    let decompressed: ImageData;
    const webGPUCheckbox = document.getElementById('use-webgpu') as HTMLInputElement;
    if (webGPUCheckbox?.checked && this.currentCodec === 'qdct') {
      const codec = codecManager.getCodec() as any;
      if (codec.decompressAsync) {
        decompressed = await codec.decompressAsync(device.currentCompressed, device.id);
      } else {
        decompressed = codecManager.decompress(device.currentCompressed, device.id);
      }
    } else {
      decompressed = codecManager.decompress(device.currentCompressed, device.id);
    }
    
    const options: CodecOptions = {
      quality: quality,
      deviceId: device.id
    };
    const result = codecManager.compress(decompressed, options);
    
    device.currentCompressed = result.compressed;
    device.currentQuality = quality;
    device.currentSize = result.size;
    device.targetSize = result.size;
    
    this.updateDeviceDisplay(deviceIndex);
  }

  private async updateDeviceDisplay(deviceIndex: number): Promise<void> {
    const device = this.devices[deviceIndex];
    
    // Use async decompression if WebGPU is enabled
    let decompressed: ImageData;
    const webGPUCheckbox = document.getElementById('use-webgpu') as HTMLInputElement;
    if (webGPUCheckbox?.checked && this.currentCodec === 'qdct') {
      const codec = codecManager.getCodec() as any;
      if (codec.decompressAsync) {
        decompressed = await codec.decompressAsync(device.currentCompressed, device.id);
      } else {
        decompressed = codecManager.decompress(device.currentCompressed, device.id);
      }
    } else {
      decompressed = codecManager.decompress(device.currentCompressed, device.id);
    }
    
    this.displayImage(`device-canvas-${deviceIndex}`, decompressed);
    document.getElementById(`device-size-${deviceIndex}`)!.textContent = 
      this.formatSize(device.currentSize);
    document.getElementById(`device-quality-${deviceIndex}`)!.textContent = 
      `${(device.currentQuality * 100).toFixed(0)}%`;
    
    const psnr = codecManager.calculatePSNR(this.originalImage!, decompressed);
    document.getElementById(`device-psnr-${deviceIndex}`)!.textContent = psnr.toFixed(2);
    
    const memoryEl = document.querySelector(`#device-cards .device-card:nth-child(${deviceIndex + 1}) .device-memory`);
    if (memoryEl) {
      memoryEl.textContent = `Memory: ${this.formatSize(device.currentSize)} / ${this.formatSize(device.memoryLimit)}`;
    }
    
    this.updateReconstruction();
  }

  private displayImage(canvasId: string, imageData: ImageData): void {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      console.error(`Canvas not found: ${canvasId}`);
      return;
    }
    
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    
    const maxWidth = 270;
    const maxHeight = 200;
    
    const scaleX = maxWidth / imageData.width;
    const scaleY = maxHeight / imageData.height;
    const scale = Math.min(1, Math.min(scaleX, scaleY));
    
    canvas.style.width = `${Math.floor(imageData.width * scale)}px`;
    canvas.style.height = `${Math.floor(imageData.height * scale)}px`;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error(`Could not get 2d context for canvas: ${canvasId}`);
      return;
    }
    
    const imgData = ctx.createImageData(imageData.width, imageData.height);
    imgData.data.set(imageData.data);
    ctx.putImageData(imgData, 0, 0);
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  private async exportDeviceImage(deviceIndex: number): Promise<void> {
    const device = this.devices[deviceIndex];
    
    // Only works with QDCT codec
    if (this.currentCodec !== 'qdct') {
      alert('Export only works with QDCT codec');
      return;
    }
    
    try {
      // Get the compressed data
      const compressed = device.currentCompressed;
      
      console.log('Exporting compressed data:', {
        deviceId: compressed.deviceId,
        compressionLevel: compressed.compressionLevel,
        width: compressed.width,
        height: compressed.height,
        blocksCount: compressed.blocks?.length
      });
      
      // Export to NSL format
      const blob = exportToNSL(compressed);
      
      console.log('Export blob created:', {
        size: blob.size,
        type: blob.type
      });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = generateNSLFilename(device.id, compressed.compressionLevel);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log(`Exported ${device.id} at level ${compressed.compressionLevel}`);
    } catch (error) {
      console.error('Export failed:', error);
      console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
      alert('Failed to export device image');
    }
  }

}

// Image Comparison Viewer
class ImageComparisonViewer {
  private viewer: HTMLElement;
  private originalCanvas: HTMLCanvasElement;
  private compressedCanvas: HTMLCanvasElement;
  private slider: HTMLInputElement;
  private overlay: HTMLElement;
  private closeButton: HTMLElement;
  private originalImage: ImageData | null = null;
  private currentTitle: string = '';

  constructor() {
    this.viewer = document.getElementById('fullscreen-viewer')!;
    this.originalCanvas = document.getElementById('viewer-original') as HTMLCanvasElement;
    this.compressedCanvas = document.getElementById('viewer-compressed') as HTMLCanvasElement;
    this.slider = document.getElementById('comparison-slider') as HTMLInputElement;
    this.overlay = document.querySelector('.comparison-overlay') as HTMLElement;
    this.closeButton = document.getElementById('close-viewer')!;

    // Ensure viewer is hidden on initialization
    this.viewer.classList.add('hidden');
    
    this.initializeEventListeners();
  }

  private initializeEventListeners(): void {
    // Slider movement
    this.slider.addEventListener('input', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      this.overlay.style.width = `${value}%`;
    });

    // Close button
    this.closeButton.addEventListener('click', () => this.close());

    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.viewer.classList.contains('hidden')) {
        this.close();
      }
    });

    // Click outside to close
    this.viewer.addEventListener('click', (e) => {
      if (e.target === this.viewer) {
        this.close();
      }
    });
  }

  public setOriginalImage(imageData: ImageData): void {
    this.originalImage = imageData;
  }

  public open(
    compressedImage: ImageData, 
    title: string,
    info: { originalSize?: string; compressedSize?: string; psnr?: number }
  ): void {
    console.log('ImageViewer.open called with:', {
      title,
      hasOriginalSet: !!this.originalImage,
      originalSize: this.originalImage ? `${this.originalImage.width}x${this.originalImage.height}` : 'null',
      compressedSize: `${compressedImage.width}x${compressedImage.height}`,
      info
    });

    if (!this.originalImage) {
      console.error('Cannot open viewer: original image not set');
      return;
    }

    try {
      this.currentTitle = title;
      const titleElement = document.getElementById('viewer-title');
      if (titleElement) titleElement.textContent = title;

      // Display both images
      console.log('Displaying original on:', this.originalCanvas.id);
      this.displayImage(this.originalCanvas, this.originalImage);
      console.log('Displaying compressed on:', this.compressedCanvas.id);
      this.displayImage(this.compressedCanvas, compressedImage);
      
      // Important: Don't set style width/height - let canvas use its natural size
      // The overlay clipping will handle showing only the left portion

    // Update info
    if (info.originalSize) {
      const originalInfo = document.getElementById('viewer-original-info');
      if (originalInfo) originalInfo.textContent = info.originalSize;
    }
    if (info.compressedSize) {
      const compressedInfo = document.getElementById('viewer-compressed-info');
      if (compressedInfo) compressedInfo.textContent = info.compressedSize;
    }
    if (info.psnr !== undefined) {
      const psnrInfo = document.getElementById('viewer-psnr');
      if (psnrInfo) psnrInfo.textContent = `${info.psnr.toFixed(2)} dB`;
    }

    // Reset slider to middle
    this.slider.value = '50';
    this.overlay.style.width = '50%';

    // Show viewer
    this.viewer.classList.remove('hidden');
    } catch (error) {
      console.error('Error opening viewer:', error);
      this.close();
    }
  }

  private displayImage(canvas: HTMLCanvasElement, imageData: ImageData): void {
    console.log(`DisplayImage: canvas=${canvas.id}, size=${imageData.width}x${imageData.height}`);
    
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error(`Failed to get context for ${canvas.id}`);
      return;
    }
    
    const imgData = ctx.createImageData(imageData.width, imageData.height);
    imgData.data.set(imageData.data);
    ctx.putImageData(imgData, 0, 0);
    
    // Debug: check what's on the canvas
    const testPixel = ctx.getImageData(Math.floor(imageData.width/2), Math.floor(imageData.height/2), 1, 1).data;
    console.log(`Canvas ${canvas.id} center pixel: [${testPixel[0]}, ${testPixel[1]}, ${testPixel[2]}, ${testPixel[3]}]`);
    console.log(`Canvas ${canvas.id} actual size: ${canvas.width}x${canvas.height}`);
    console.log(`Canvas ${canvas.id} display size: ${canvas.offsetWidth}x${canvas.offsetHeight}`);
    
    // Ensure the canvas is visible
    if (canvas.id === 'viewer-compressed') {
      console.log('Compressed canvas parent (overlay) width:', canvas.parentElement?.style.width);
    }
  }

  public close(): void {
    this.viewer.classList.add('hidden');
  }
}

// Global viewer instance
let imageViewer: ImageComparisonViewer;

// Initialize demo when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  imageViewer = new ImageComparisonViewer();
  new ModularImageCompressionDemo();
});