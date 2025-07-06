import { codecManager } from '../src/codecs/codec-manager';
import { ImageData } from '../src/codecs/types';
import { QDCTCodec } from '../src/codecs/qdct/qdct-codec';
import { exportToNSL, generateNSLFilename } from '../src/codecs/qdct/nsl-format';

class QuantizationExplorer {
  private originalImage: ImageData | null = null;
  private currentDevice: string = 'DEVICE-000';
  private currentLevel: number = 0;
  private displayMode: 'original' | 'compressed' | 'difference' = 'compressed';
  private currentCompressed: any = null;

  constructor() {
    // Ensure QDCT codec is selected
    codecManager.setCodec('qdct');
    this.initializeEventListeners();
  }

  private initializeEventListeners(): void {
    // Device selector
    const deviceSelector = document.getElementById('device-selector') as HTMLSelectElement;
    deviceSelector.addEventListener('change', (e) => {
      this.currentDevice = (e.target as HTMLSelectElement).value;
      this.updateMatrix();
      if (this.originalImage) {
        this.compressAndDisplay();
      }
    });

    // Image upload
    const imageUpload = document.getElementById('image-upload') as HTMLInputElement;
    imageUpload.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        this.loadImage(file);
      }
    });

    // Sample images
    const sampleImages = document.querySelectorAll('.sample-image');
    sampleImages.forEach(sampleEl => {
      sampleEl.addEventListener('click', async () => {
        sampleImages.forEach(img => img.classList.remove('selected'));
        sampleEl.classList.add('selected');
        const imagePath = sampleEl.getAttribute('data-src')!;
        await this.loadSampleImage(imagePath);
      });
    });

    // Level slider
    const levelSlider = document.getElementById('level-slider') as HTMLInputElement;
    const levelValue = document.getElementById('level-value') as HTMLElement;
    
    levelSlider.addEventListener('input', (e) => {
      this.currentLevel = parseInt((e.target as HTMLInputElement).value);
      levelValue.textContent = String(this.currentLevel);
      this.updateMatrix();
    });

    // Regenerate button
    const regenerateBtn = document.getElementById('regenerate-btn') as HTMLButtonElement;
    regenerateBtn.addEventListener('click', () => {
      if (this.originalImage) {
        this.compressAndDisplay();
      }
    });

    // Display mode buttons
    const showOriginalBtn = document.getElementById('show-original-btn') as HTMLButtonElement;
    const showCompressedBtn = document.getElementById('show-compressed-btn') as HTMLButtonElement;
    const showDifferenceBtn = document.getElementById('show-difference-btn') as HTMLButtonElement;

    showOriginalBtn.addEventListener('click', () => {
      this.setDisplayMode('original');
      this.updateDisplayModeButtons();
    });

    showCompressedBtn.addEventListener('click', () => {
      this.setDisplayMode('compressed');
      this.updateDisplayModeButtons();
    });

    showDifferenceBtn.addEventListener('click', () => {
      this.setDisplayMode('difference');
      this.updateDisplayModeButtons();
    });

    // Export button
    const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
    exportBtn.addEventListener('click', () => {
      this.exportCurrentImage();
    });
  }

  private async loadImage(file: File): Promise<void> {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
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
      
      this.onImageLoaded();
      URL.revokeObjectURL(url);
    };

    img.src = url;
  }

  private async loadSampleImage(imagePath: string): Promise<void> {
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
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
      
      this.onImageLoaded();
    };

    img.src = imagePath;
  }

  private onImageLoaded(): void {
    // Show explorer section
    document.getElementById('explorer-section')!.classList.remove('hidden');
    
    // Display original image (hidden)
    const originalCanvas = document.getElementById('original-canvas') as HTMLCanvasElement;
    this.displayImage(originalCanvas, this.originalImage!);
    
    // Update matrix and compress image
    this.updateMatrix();
    this.compressAndDisplay();
  }

  private updateMatrix(): void {
    const qdctCodec = codecManager.getCodec() as QDCTCodec;
    const matrix = qdctCodec.getQuantizationMatrix(this.currentDevice, this.currentLevel);
    
    this.displayMatrix(matrix);
    this.updateMatrixStats(matrix);
  }

  private displayMatrix(matrix: number[][]): void {
    const matrixDisplay = document.getElementById('matrix-display')!;
    matrixDisplay.innerHTML = '';
    
    // Add header row
    const headerRow = document.createElement('div');
    headerRow.className = 'matrix-row';
    headerRow.innerHTML = '<div style="width: 45px;"></div>';
    for (let col = 0; col < 8; col++) {
      const cell = document.createElement('div');
      cell.className = 'matrix-cell';
      cell.style.fontWeight = 'bold';
      cell.textContent = String(col);
      headerRow.appendChild(cell);
    }
    matrixDisplay.appendChild(headerRow);
    
    // Add matrix rows
    for (let row = 0; row < 8; row++) {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'matrix-row';
      
      // Row header
      const rowHeader = document.createElement('div');
      rowHeader.style.width = '45px';
      rowHeader.style.fontWeight = 'bold';
      rowHeader.textContent = String(row);
      rowDiv.appendChild(rowHeader);
      
      for (let col = 0; col < 8; col++) {
        const cell = document.createElement('div');
        cell.className = 'matrix-cell';
        const value = matrix[row][col];
        cell.textContent = String(value);
        
        // Color coding
        if (value === 1) {
          cell.classList.add('low');
        } else if (value < 20) {
          cell.classList.add('medium');
        } else {
          cell.classList.add('high');
        }
        
        rowDiv.appendChild(cell);
      }
      
      matrixDisplay.appendChild(rowDiv);
    }
  }

  private updateMatrixStats(matrix: number[][]): void {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let count = 0;
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const value = matrix[row][col];
        min = Math.min(min, value);
        max = Math.max(max, value);
        sum += value;
        count++;
      }
    }
    
    const avg = sum / count;
    
    document.getElementById('matrix-min')!.textContent = String(min);
    document.getElementById('matrix-max')!.textContent = String(max);
    document.getElementById('matrix-avg')!.textContent = avg.toFixed(1);
  }

  private async compressAndDisplay(): Promise<void> {
    if (!this.originalImage) return;
    
    const regenerateBtn = document.getElementById('regenerate-btn') as HTMLButtonElement;
    regenerateBtn.disabled = true;
    regenerateBtn.textContent = 'Compressing...';
    
    // Small delay for UI update
    await new Promise(resolve => setTimeout(resolve, 10));
    
    try {
      const qdctCodec = codecManager.getCodec() as QDCTCodec;
      const result = qdctCodec.compressWithLevel(
        this.originalImage,
        this.currentDevice,
        this.currentLevel
      );
      
      // Store current compressed data
      this.currentCompressed = result.compressed;
      
      const decompressed = qdctCodec.decompress(result.compressed, this.currentDevice);
      
      // Display based on current mode
      this.updateDisplay(decompressed);
      
      // Update info
      const originalSize = this.originalImage.width * this.originalImage.height * 3;
      document.getElementById('compressed-size')!.textContent = this.formatSize(result.size);
      
      const psnr = qdctCodec.calculatePSNR(this.originalImage, decompressed);
      document.getElementById('psnr-value')!.textContent = psnr.toFixed(2);
      
      const ratio = originalSize / result.size;
      document.getElementById('compression-ratio')!.textContent = `${ratio.toFixed(1)}:1`;
      
    } catch (error) {
      console.error('Compression failed:', error);
    } finally {
      regenerateBtn.disabled = false;
      regenerateBtn.textContent = 'Regenerate Image';
    }
  }

  private setDisplayMode(mode: 'original' | 'compressed' | 'difference'): void {
    this.displayMode = mode;
    if (this.originalImage) {
      this.compressAndDisplay();
    }
  }

  private updateDisplay(compressedImage: ImageData): void {
    const canvas = document.getElementById('compressed-canvas') as HTMLCanvasElement;
    
    switch (this.displayMode) {
      case 'original':
        this.displayImage(canvas, this.originalImage!);
        break;
      case 'compressed':
        this.displayImage(canvas, compressedImage);
        break;
      case 'difference':
        this.displayDifference(canvas, this.originalImage!, compressedImage);
        break;
    }
  }

  private updateDisplayModeButtons(): void {
    const buttons = {
      'original': document.getElementById('show-original-btn'),
      'compressed': document.getElementById('show-compressed-btn'),
      'difference': document.getElementById('show-difference-btn')
    };
    
    Object.entries(buttons).forEach(([mode, btn]) => {
      if (mode === this.displayMode) {
        btn?.classList.add('active');
      } else {
        btn?.classList.remove('active');
      }
    });
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

  private displayDifference(canvas: HTMLCanvasElement, original: ImageData, compressed: ImageData): void {
    canvas.width = original.width;
    canvas.height = original.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const diffData = ctx.createImageData(original.width, original.height);
    
    for (let i = 0; i < original.data.length; i += 4) {
      // Calculate difference and amplify for visibility
      const diffR = Math.abs(original.data[i] - compressed.data[i]) * 5;
      const diffG = Math.abs(original.data[i + 1] - compressed.data[i + 1]) * 5;
      const diffB = Math.abs(original.data[i + 2] - compressed.data[i + 2]) * 5;
      
      diffData.data[i] = Math.min(255, diffR);
      diffData.data[i + 1] = Math.min(255, diffG);
      diffData.data[i + 2] = Math.min(255, diffB);
      diffData.data[i + 3] = 255;
    }
    
    ctx.putImageData(diffData, 0, 0);
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  private exportCurrentImage(): void {
    if (!this.currentCompressed) {
      alert('Please generate a compressed image first');
      return;
    }
    
    try {
      // Export to NSL format
      const blob = exportToNSL(this.currentCompressed);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = generateNSLFilename(this.currentDevice, this.currentLevel);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log(`Exported ${this.currentDevice} at level ${this.currentLevel}`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export image');
    }
  }
}

// Initialize explorer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new QuantizationExplorer();
});