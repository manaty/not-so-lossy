import { codecManager } from '../src/codecs/codec-manager';
import { importFromNSL } from '../src/codecs/qdct/nsl-format';
import { QDCTCompressedImage } from '../src/codecs/qdct/qdct-types';
import { ImageData } from '../src/codecs/types';

interface LoadedFile {
  filename: string;
  compressed: QDCTCompressedImage;
  size: number;
}

class NSLViewer {
  private loadedFiles: LoadedFile[] = [];
  private originalDimensions: { width: number; height: number } | null = null;
  private fullscreenViewer: HTMLElement;
  private fullscreenCanvas: HTMLCanvasElement;

  constructor() {
    // Ensure QDCT codec is selected
    codecManager.setCodec('qdct');
    
    // Get fullscreen elements
    this.fullscreenViewer = document.getElementById('fullscreen-viewer')!;
    this.fullscreenCanvas = document.getElementById('fullscreen-canvas') as HTMLCanvasElement;
    
    this.initializeEventListeners();
  }

  private initializeEventListeners(): void {
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const loadBtn = document.getElementById('load-files-btn') as HTMLButtonElement;
    const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;

    loadBtn.addEventListener('click', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        this.loadFiles(Array.from(fileInput.files));
      }
    });

    clearBtn.addEventListener('click', () => {
      this.clearAll();
      fileInput.value = '';
    });

    fileInput.addEventListener('change', () => {
      const hasFiles = fileInput.files && fileInput.files.length > 0;
      loadBtn.disabled = !hasFiles;
    });

    // Fullscreen viewer controls
    const closeBtn = document.getElementById('close-fullscreen');
    closeBtn?.addEventListener('click', () => this.closeFullscreen());
    
    // ESC key to close fullscreen
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.fullscreenViewer.classList.contains('hidden')) {
        this.closeFullscreen();
      }
    });
  }

  private async loadFiles(files: File[]): Promise<void> {
    const loadBtn = document.getElementById('load-files-btn') as HTMLButtonElement;
    loadBtn.disabled = true;
    loadBtn.textContent = 'Loading...';

    try {
      // Clear previous results
      this.clearAll();

      // Load each file
      const loadPromises = files.map(async (file) => {
        try {
          console.log(`Loading file: ${file.name}`);
          const compressed = await importFromNSL(file);
          
          return {
            filename: file.name,
            compressed,
            size: file.size
          } as LoadedFile;
        } catch (error) {
          console.error(`Failed to load ${file.name}:`, error);
          this.showStatus(`Failed to load ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
          return null;
        }
      });

      const results = await Promise.all(loadPromises);
      const validFiles = results.filter(r => r !== null) as LoadedFile[];

      if (validFiles.length === 0) {
        this.showStatus('No valid NSL files could be loaded', 'error');
        return;
      }

      // Check if all files have the same dimensions
      const firstFile = validFiles[0];
      this.originalDimensions = {
        width: firstFile.compressed.width,
        height: firstFile.compressed.height
      };

      const dimensionMismatch = validFiles.some(file => 
        file.compressed.width !== this.originalDimensions!.width ||
        file.compressed.height !== this.originalDimensions!.height
      );

      if (dimensionMismatch) {
        this.showStatus('All files must have the same image dimensions', 'error');
        return;
      }

      // Store loaded files
      this.loadedFiles = validFiles;

      // Display file list
      this.displayFileList();

      // Process and display images
      this.processImages();

      this.showStatus(`Successfully loaded ${validFiles.length} files`, 'success');

    } catch (error) {
      console.error('Error loading files:', error);
      this.showStatus('An error occurred while loading files', 'error');
    } finally {
      loadBtn.disabled = false;
      loadBtn.textContent = 'Load Selected Files';
    }
  }

  private displayFileList(): void {
    const fileList = document.getElementById('file-list');
    const fileItems = document.getElementById('file-items')!;
    
    fileList?.classList.remove('hidden');
    fileItems.innerHTML = '';

    this.loadedFiles.forEach(file => {
      const li = document.createElement('li');
      li.className = 'file-item';
      li.innerHTML = `
        <span class="file-name">${file.filename}</span>
        <div class="file-info">
          <span class="device-id">Device: ${file.compressed.deviceId}</span>
          <span class="compression-level">Level: ${file.compressed.compressionLevel}</span>
          <span class="file-size">${this.formatSize(file.size)}</span>
        </div>
      `;
      fileItems.appendChild(li);
    });
  }

  private processImages(): void {
    if (this.loadedFiles.length === 0) return;

    // Show results section
    document.getElementById('results-section')?.classList.remove('hidden');

    // Create device cards
    this.createDeviceCards();

    // Reconstruct and display combined image
    this.reconstructImage();
  }

  private createDeviceCards(): void {
    const container = document.getElementById('device-cards')!;
    container.innerHTML = '';

    this.loadedFiles.forEach((file, index) => {
      const card = document.createElement('div');
      card.className = 'device-card';

      const canvas = document.createElement('canvas');
      canvas.id = `device-canvas-${index}`;

      card.innerHTML = `
        <h4>${file.compressed.deviceId}</h4>
      `;
      card.appendChild(canvas);
      
      const details = document.createElement('div');
      details.className = 'device-details';
      details.innerHTML = `
        <div>File: <span>${file.filename}</span></div>
        <div>Dimensions: <span>${file.compressed.width} × ${file.compressed.height}</span></div>
        <div>Level: <span>${file.compressed.compressionLevel}</span></div>
        <div>Size: <span>${this.formatSize(file.size)}</span></div>
        <div>Blocks: <span>${file.compressed.blocks.length}</span></div>
      `;
      card.appendChild(details);

      container.appendChild(card);

      // Decompress and display
      try {
        const decompressed = codecManager.decompress(file.compressed, file.compressed.deviceId);
        this.displayImage(canvas, decompressed);
        
        // Add click handler for fullscreen view
        canvas.onclick = () => {
          this.showFullscreen(decompressed, `${file.compressed.deviceId} - Level ${file.compressed.compressionLevel}`);
        };
      } catch (error) {
        console.error(`Failed to decompress ${file.compressed.deviceId}:`, error);
      }
    });
  }

  private reconstructImage(): void {
    if (this.loadedFiles.length === 0) return;

    try {
      // Get all compressed versions
      const compressedVersions = this.loadedFiles.map(f => f.compressed);
      
      // Reconstruct from multiple devices
      const reconstructed = codecManager.reconstructFromMultiple(compressedVersions);
      
      // Display reconstructed image
      const canvas = document.getElementById('reconstructed-canvas') as HTMLCanvasElement;
      this.displayImage(canvas, reconstructed);

      // Update info
      document.getElementById('device-count')!.textContent = String(this.loadedFiles.length);
      
      const totalSize = this.loadedFiles.reduce((sum, f) => sum + f.size, 0);
      document.getElementById('total-size')!.textContent = this.formatSize(totalSize);

      // Calculate PSNR if possible
      // Note: We don't have the original image here, so we can't calculate PSNR
      // In a real scenario, you might want to load the original image too
      document.getElementById('psnr-value')!.textContent = 'N/A';
      
      // Show dimensions
      document.getElementById('image-dimensions')!.textContent = `${reconstructed.width} × ${reconstructed.height}`;
      
      // Add click handler for fullscreen view
      canvas.style.cursor = 'pointer';
      canvas.onclick = () => {
        this.showFullscreen(reconstructed, 'Reconstructed Image');
      };

    } catch (error) {
      console.error('Failed to reconstruct image:', error);
      this.showStatus('Failed to reconstruct image from devices', 'error');
    }
  }

  private displayImage(canvas: HTMLCanvasElement, imageData: ImageData): void {
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const imgData = ctx.createImageData(imageData.width, imageData.height);
    imgData.data.set(imageData.data);
    ctx.putImageData(imgData, 0, 0);
  }

  private clearAll(): void {
    this.loadedFiles = [];
    this.originalDimensions = null;
    
    // Hide sections
    document.getElementById('file-list')?.classList.add('hidden');
    document.getElementById('results-section')?.classList.add('hidden');
    
    // Clear file list
    const fileItems = document.getElementById('file-items');
    if (fileItems) fileItems.innerHTML = '';
    
    // Clear device cards
    const deviceCards = document.getElementById('device-cards');
    if (deviceCards) deviceCards.innerHTML = '';
    
    // Hide status
    const statusMsg = document.getElementById('status-message');
    if (statusMsg) {
      statusMsg.className = 'status-message';
      statusMsg.textContent = '';
    }
  }

  private showStatus(message: string, type: 'error' | 'success' | 'warning'): void {
    const statusMsg = document.getElementById('status-message');
    if (statusMsg) {
      statusMsg.textContent = message;
      statusMsg.className = `status-message ${type}`;
      
      // Auto-hide success messages after 5 seconds
      if (type === 'success') {
        setTimeout(() => {
          statusMsg.className = 'status-message';
        }, 5000);
      }
    }
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  private showFullscreen(imageData: ImageData, title: string): void {
    // Set title
    const titleElement = document.getElementById('fullscreen-title');
    if (titleElement) titleElement.textContent = title;
    
    // Set info
    const infoElement = document.getElementById('fullscreen-info');
    if (infoElement) {
      infoElement.textContent = `${imageData.width} × ${imageData.height} pixels (1:1 scale)`;
    }
    
    // Display image at actual size
    this.fullscreenCanvas.width = imageData.width;
    this.fullscreenCanvas.height = imageData.height;
    
    const ctx = this.fullscreenCanvas.getContext('2d');
    if (ctx) {
      const imgData = ctx.createImageData(imageData.width, imageData.height);
      imgData.data.set(imageData.data);
      ctx.putImageData(imgData, 0, 0);
    }
    
    // Show the viewer
    this.fullscreenViewer.classList.remove('hidden');
    
    // Scroll to center if image is larger than viewport
    const content = document.querySelector('.fullscreen-content') as HTMLElement;
    if (content) {
      // Wait for next frame to ensure layout is complete
      requestAnimationFrame(() => {
        const scrollLeft = Math.max(0, (this.fullscreenCanvas.width - content.clientWidth) / 2);
        const scrollTop = Math.max(0, (this.fullscreenCanvas.height - content.clientHeight) / 2);
        content.scrollLeft = scrollLeft;
        content.scrollTop = scrollTop;
      });
    }
  }

  private closeFullscreen(): void {
    this.fullscreenViewer.classList.add('hidden');
  }
}

// Initialize viewer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new NSLViewer();
});