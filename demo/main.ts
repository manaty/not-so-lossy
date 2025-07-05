import { 
  compressImage, 
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

  private processImage(): void {
    if (!this.originalImage) return;

    // Clear previous devices
    this.devices = [];

    // Create devices with sequential IDs
    for (let i = 0; i < this.deviceCount; i++) {
      const deviceId = `DEVICE-${String(i).padStart(3, '0')}`;
      
      // Initial compression at quality 1.0
      const result = compressImage(this.originalImage, deviceId, 1.0);
      
      this.devices.push({
        id: deviceId,
        originalCompressed: result.compressed,
        currentCompressed: result.compressed,
        currentQuality: 1.0,
        currentSize: result.size
      });
    }

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
          <label>Quality:</label>
          <input type="range" 
                 id="quality-${index}" 
                 min="0.1" 
                 max="1.0" 
                 step="0.05" 
                 value="${device.currentQuality}">
          <span id="quality-value-${index}">${(device.currentQuality * 100).toFixed(0)}%</span>
        </div>
        <button class="recompress-btn" id="recompress-${index}">Recompress</button>
      </div>
      <div class="device-info">
        <span>Size: <span id="device-size-${index}">${this.formatSize(device.currentSize)}</span></span>
        <span>Compression: <span id="device-ratio-${index}">-</span></span>
      </div>
    `;

    // Display device image
    const preview = compressImage(this.originalImage!, device.id, device.currentQuality).preview;
    this.displayImage(`device-canvas-${index}`, preview);

    // Add event listeners
    const qualitySlider = card.querySelector(`#quality-${index}`) as HTMLInputElement;
    const qualityValue = card.querySelector(`#quality-value-${index}`) as HTMLElement;
    const recompressBtn = card.querySelector(`#recompress-${index}`) as HTMLButtonElement;

    qualitySlider.addEventListener('input', (e) => {
      const quality = parseFloat((e.target as HTMLInputElement).value);
      qualityValue.textContent = `${(quality * 100).toFixed(0)}%`;
    });

    recompressBtn.addEventListener('click', () => {
      const quality = parseFloat(qualitySlider.value);
      this.recompressDevice(index, quality);
    });

    // Update compression ratio
    const originalSize = this.originalImage!.width * this.originalImage!.height * 3;
    const ratio = originalSize / device.currentSize;
    card.querySelector(`#device-ratio-${index}`)!.textContent = `${ratio.toFixed(1)}:1`;

    return card;
  }

  private recompressDevice(deviceIndex: number, quality: number): void {
    const device = this.devices[deviceIndex];
    
    // Important: Recompress from the device's current compressed version, not the original
    const decompressed = compressImage(this.originalImage!, device.id, device.currentQuality).preview;
    const result = compressImage(decompressed, device.id, quality);
    
    // Update device state
    device.currentCompressed = result.compressed;
    device.currentQuality = quality;
    device.currentSize = result.size;
    
    // Update display
    this.displayImage(`device-canvas-${deviceIndex}`, result.preview);
    document.getElementById(`device-size-${deviceIndex}`)!.textContent = 
      this.formatSize(result.size);
    
    // Update compression ratio
    const originalSize = this.originalImage!.width * this.originalImage!.height * 3;
    const ratio = originalSize / device.currentSize;
    document.getElementById(`device-ratio-${deviceIndex}`)!.textContent = 
      `${ratio.toFixed(1)}:1`;
    
    // Update reconstruction
    this.updateReconstruction();
  }

  private displayImage(canvasId: string, imageData: ImageData): void {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) return;
    
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(imageData.width, imageData.height);
    imgData.data.set(imageData.data);
    ctx.putImageData(imgData, 0, 0);
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