import { 
  compressImage, 
  decompressImage,
  reconstructFromMultiple, 
  calculatePSNR,
  ImageData,
  CompressionResult 
} from '../src/compression/image-compressor';
import { CompressedImage } from '../src/core/types';

interface DeviceState {
  id: string;
  originalCompressed: CompressedImage;
  currentCompressed: CompressedImage;
  currentQuality: number;
  currentSize: number;
  memoryLimit: number; // in bytes
  targetSize: number;  // current target size in bytes
}

class ImageCompressionDemo {
  private originalImage: ImageData | null = null;
  private devices: DeviceState[] = [];
  private deviceCount: number = 3;

  constructor() {
    this.initializeEventListeners();
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
        // Clear sample selection
        sampleImages.forEach(img => img.classList.remove('selected'));
        this.loadImage(file);
      }
    });

    processBtn.addEventListener('click', () => {
      if (this.originalImage) {
        this.processImage();
      }
    });

    // Sample image selection
    sampleImages.forEach(sampleEl => {
      sampleEl.addEventListener('click', async () => {
        // Clear previous selections
        sampleImages.forEach(img => img.classList.remove('selected'));
        sampleEl.classList.add('selected');
        
        // Clear file input
        imageUpload.value = '';
        
        // Load sample image
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
      
      // Limit size for performance
      const maxSize = 512;
      let { width, height } = img;
      
      if (width > maxSize || height > maxSize) {
        const scale = Math.min(maxSize / width, maxSize / height);
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);
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
      
      // Display original
      this.displayImage('original-canvas', this.originalImage);
      document.getElementById('original-size')!.textContent = 
        this.formatSize(width * height * 3); // Uncompressed size
      
      // Enable process button
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
      
      // Limit size for performance
      const maxSize = 512;
      let { width, height } = img;
      
      if (width > maxSize || height > maxSize) {
        const scale = Math.min(maxSize / width, maxSize / height);
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);
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
      
      // Display original
      this.displayImage('original-canvas', this.originalImage);
      document.getElementById('original-size')!.textContent = 
        this.formatSize(width * height * 3);
      
      // Enable process button
      (document.getElementById('process-btn') as HTMLButtonElement).disabled = false;
    };

    img.onerror = () => {
      console.error('Failed to load sample image:', imagePath);
    };

    img.src = imagePath;
  }

  private async processImage(): Promise<void> {
    if (!this.originalImage) return;

    // Show progress indicator
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

    // Clear previous devices
    this.devices = [];

    // Create devices with sequential IDs
    for (let i = 0; i < this.deviceCount; i++) {
      // Update progress
      progressCurrent.textContent = String(i);
      progressFill.style.width = `${(i / this.deviceCount) * 100}%`;
      
      // Allow UI to update
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const deviceId = `DEVICE-${String(i).padStart(3, '0')}`;
      const memoryLimit = 10 * 1024 * 1024; // 10MB
      
      // Always start with quality 1.0 (least compression)
      let result = compressImage(this.originalImage, deviceId, 1.0);
      let initialQuality = 1.0;
      
      // Only compress more if the result exceeds memory limit
      if (result.size > memoryLimit) {
        // Need to find appropriate quality
        let low = 0.1;
        let high = 1.0;
        let bestQuality = 1.0;
        let bestResult = result;
        
        // Binary search for quality that fits in memory
        for (let iter = 0; iter < 10; iter++) {
          const testQuality = (low + high) / 2;
          const testResult = compressImage(this.originalImage, deviceId, testQuality);
          
          if (testResult.size <= memoryLimit) {
            // This fits, try higher quality
            low = testQuality;
            bestQuality = testQuality;
            bestResult = testResult;
            
            // If very close to limit, stop
            if (testResult.size > memoryLimit * 0.95) {
              break;
            }
          } else {
            // Too big, need lower quality
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

    // Final progress update
    progressCurrent.textContent = String(this.deviceCount);
    progressFill.style.width = '100%';
    
    // Small delay to show completion
    await new Promise(resolve => setTimeout(resolve, 300));

    // Hide progress indicator
    progressContainer.classList.add('hidden');
    processBtn.disabled = false;

    // Show results section
    document.getElementById('results-section')!.classList.remove('hidden');

    // Update reconstruction
    this.updateReconstruction();

    // Create device cards
    this.createDeviceCards();
  }

  private updateReconstruction(): void {
    if (this.devices.length === 0 || !this.originalImage) return;

    // Reconstruct from all current compressed versions
    const compressedVersions = this.devices.map(d => d.currentCompressed);
    const reconstructed = reconstructFromMultiple(compressedVersions);
    
    // Display reconstructed image
    this.displayImage('reconstructed-canvas', reconstructed);
    
    // Calculate PSNR
    const psnr = calculatePSNR(this.originalImage, reconstructed);
    document.getElementById('psnr-value')!.textContent = psnr.toFixed(2);
    
    // Calculate total size
    const totalSize = this.devices.reduce((sum, d) => sum + d.currentSize, 0);
    document.getElementById('total-size')!.textContent = this.formatSize(totalSize);
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
      <canvas id="device-canvas-${index}"></canvas>
      <div class="device-controls">
        <div class="size-control">
          <label>Target Size:</label>
          <input type="range" 
                 id="size-${index}" 
                 min="0" 
                 max="${device.currentSize}" 
                 step="1024" 
                 value="${device.currentSize}">
          <span id="size-value-${index}">${this.formatSize(device.currentSize)}</span>
        </div>
        <button class="recompress-btn" id="recompress-${index}">Apply Size</button>
      </div>
      <div class="device-info">
        <span>Size: <span id="device-size-${index}">${this.formatSize(device.currentSize)}</span></span>
        <span>Quality: <span id="device-quality-${index}">${(device.currentQuality * 100).toFixed(0)}%</span></span>
        <span>Ratio: <span id="device-ratio-${index}">-</span></span>
      </div>
      <div class="device-memory">
        Memory: ${this.formatSize(device.currentSize)} / ${this.formatSize(device.memoryLimit)}
      </div>
    `;

    // Display device's decompressed image after DOM update
    setTimeout(() => {
      try {
        console.log(`Decompressing device ${index}:`, device.currentCompressed);
        const preview = decompressImage(device.currentCompressed);
        console.log(`Preview for device ${index}:`, preview.width, 'x', preview.height, 'first pixels:', 
          preview.data[0], preview.data[1], preview.data[2], preview.data[3]);
        this.displayImage(`device-canvas-${index}`, preview);
      } catch (error) {
        console.error(`Error displaying device ${index}:`, error);
      }
    }, 0);

    // Add event listeners
    const sizeSlider = card.querySelector(`#size-${index}`) as HTMLInputElement;
    const sizeValue = card.querySelector(`#size-value-${index}`) as HTMLElement;
    const recompressBtn = card.querySelector(`#recompress-${index}`) as HTMLButtonElement;

    sizeSlider.addEventListener('input', (e) => {
      const targetSize = parseInt((e.target as HTMLInputElement).value);
      sizeValue.textContent = this.formatSize(targetSize);
    });

    recompressBtn.addEventListener('click', async () => {
      const targetSize = parseInt(sizeSlider.value);
      // Show loading state
      recompressBtn.disabled = true;
      recompressBtn.textContent = 'Finding quality...';
      
      // Allow UI to update
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // If target is 0, use minimum quality
      if (targetSize === 0) {
        await this.recompressDevice(index, 0.1);
      } else {
        await this.recompressDeviceToSize(index, targetSize);
      }
      
      // Update slider max to new current size
      sizeSlider.max = String(device.currentSize);
      sizeSlider.value = String(device.currentSize);
      sizeValue.textContent = this.formatSize(device.currentSize);
      
      // Restore button state
      recompressBtn.disabled = false;
      recompressBtn.textContent = 'Apply Size';
    });

    // Update compression ratio
    const originalSize = this.originalImage!.width * this.originalImage!.height * 3;
    const ratio = originalSize / device.currentSize;
    card.querySelector(`#device-ratio-${index}`)!.textContent = `${ratio.toFixed(1)}:1`;

    return card;
  }

  private async recompressDeviceToSize(deviceIndex: number, targetSize: number): Promise<void> {
    const device = this.devices[deviceIndex];
    
    // Get current size from original compression
    const originalDecompressed = decompressImage(device.originalCompressed);
    const currentSizeAtQ1 = device.originalCompressed.qualityFactor === 1.0 
      ? device.currentSize 
      : compressImage(originalDecompressed, device.id, 1.0).size;
    
    // Smart first guess: reduce quality proportionally to size reduction needed
    const sizeReductionRatio = targetSize / currentSizeAtQ1;
    let testQuality = Math.max(0.1, Math.min(1.0, sizeReductionRatio));
    
    console.log(`Target size: ${targetSize}, Current size at Q1: ${currentSizeAtQ1}`);
    console.log(`Size reduction ratio: ${sizeReductionRatio.toFixed(3)}, First guess quality: ${testQuality.toFixed(3)}`);
    
    // Binary search with relaxed parameters
    let lowQuality = 0.1;
    let highQuality = 1.0;
    let bestQuality = testQuality;
    let bestResult = null;
    const tolerance = targetSize * 0.1; // 10% tolerance
    const maxIterations = 5;
    
    for (let i = 0; i < maxIterations; i++) {
      // Test compression at this quality
      const result = compressImage(originalDecompressed, device.id, testQuality);
      
      console.log(`Iteration ${i}: quality=${testQuality.toFixed(3)}, size=${result.size}, target=${targetSize} (±${Math.round(tolerance)})`);
      
      // Check if close enough (within 10%)
      if (Math.abs(result.size - targetSize) <= tolerance) {
        bestQuality = testQuality;
        bestResult = result;
        console.log(`Found acceptable size in ${i + 1} iterations`);
        break;
      }
      
      // Update search bounds
      if (result.size > targetSize) {
        // Need lower quality (more compression)
        highQuality = testQuality;
      } else {
        // Can use higher quality
        lowQuality = testQuality;
        // Keep this as best if it's under target
        bestQuality = testQuality;
        bestResult = result;
      }
      
      // Next test point
      if (i === 0 && result.size > targetSize * 1.5) {
        // First guess was way off, try more aggressive reduction
        testQuality = testQuality * 0.7;
      } else {
        // Standard binary search
        testQuality = (lowQuality + highQuality) / 2;
      }
    }
    
    // If we didn't find a result yet, do one final compression at bestQuality
    if (!bestResult) {
      bestResult = compressImage(originalDecompressed, device.id, bestQuality);
      console.log(`Using final quality: ${bestQuality.toFixed(3)}, size: ${bestResult.size}`);
    }
    
    // Apply the best result found
    device.currentCompressed = bestResult.compressed;
    device.currentQuality = bestQuality;
    device.currentSize = bestResult.size;
    device.targetSize = targetSize;
    
    // Update display
    this.displayImage(`device-canvas-${deviceIndex}`, bestResult.preview);
    document.getElementById(`device-size-${deviceIndex}`)!.textContent = 
      this.formatSize(bestResult.size);
    document.getElementById(`device-quality-${deviceIndex}`)!.textContent = 
      `${(bestQuality * 100).toFixed(0)}%`;
    
    // Update compression ratio
    const originalSize = this.originalImage!.width * this.originalImage!.height * 3;
    const ratio = originalSize / device.currentSize;
    document.getElementById(`device-ratio-${deviceIndex}`)!.textContent = 
      `${ratio.toFixed(1)}:1`;
    
    // Update memory display
    const memoryEl = document.querySelector(`#device-cards .device-card:nth-child(${deviceIndex + 1}) .device-memory`);
    if (memoryEl) {
      memoryEl.textContent = `Memory: ${this.formatSize(device.currentSize)} / ${this.formatSize(device.memoryLimit)}`;
    }
    
    // Update reconstruction
    this.updateReconstruction();
  }
  
  private recompressDevice(deviceIndex: number, quality: number): void {
    const device = this.devices[deviceIndex];
    
    // Important: Recompress from the device's current compressed version, not the original
    const decompressed = decompressImage(device.currentCompressed);
    const result = compressImage(decompressed, device.id, quality);
    
    // Update device state
    device.currentCompressed = result.compressed;
    device.currentQuality = quality;
    device.currentSize = result.size;
    device.targetSize = result.size;
    
    // Update display
    this.displayImage(`device-canvas-${deviceIndex}`, result.preview);
    document.getElementById(`device-size-${deviceIndex}`)!.textContent = 
      this.formatSize(result.size);
    document.getElementById(`device-quality-${deviceIndex}`)!.textContent = 
      `${(quality * 100).toFixed(0)}%`;
    
    // Update compression ratio
    const originalSize = this.originalImage!.width * this.originalImage!.height * 3;
    const ratio = originalSize / device.currentSize;
    document.getElementById(`device-ratio-${deviceIndex}`)!.textContent = 
      `${ratio.toFixed(1)}:1`;
    
    // Update memory display
    const memoryEl = document.querySelector(`#device-cards .device-card:nth-child(${deviceIndex + 1}) .device-memory`);
    if (memoryEl) {
      memoryEl.textContent = `Memory: ${this.formatSize(device.currentSize)} / ${this.formatSize(device.memoryLimit)}`;
    }
    
    // Update reconstruction
    this.updateReconstruction();
  }

  private displayImage(canvasId: string, imageData: ImageData): void {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      console.error(`Canvas not found: ${canvasId}`);
      return;
    }
    
    // Set canvas dimensions
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    
    // Set CSS dimensions to maintain aspect ratio and fit within card
    // Device cards have 15px padding on each side and ~300px min width
    const maxWidth = 270; // 300px card - 30px total padding
    const maxHeight = 200; // Reasonable max height for device cards
    
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
    
    console.log(`Displayed image on ${canvasId}: ${imageData.width}x${imageData.height}, scale: ${scale}`);
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

// Initialize demo when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ImageCompressionDemo();
});