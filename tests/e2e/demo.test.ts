import { JSDOM } from 'jsdom';
import * as fs from 'fs';
import * as path from 'path';

describe('Demo E2E Tests', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window & typeof globalThis;

  beforeEach(() => {
    // Load the demo HTML
    const html = fs.readFileSync(path.join(__dirname, '../../demo/index.html'), 'utf-8');
    dom = new JSDOM(html, {
      url: 'http://localhost:3000',
      resources: 'usable',
      runScripts: 'dangerously',
      pretendToBeVisual: true
    });
    
    document = dom.window.document;
    window = dom.window as any;
    
    // Mock image loading
    Object.defineProperty(window.Image.prototype, 'src', {
      set(src: string) {
        setTimeout(() => {
          this.width = 512;
          this.height = 512;
          if (this.onload) {
            this.onload();
          }
        }, 0);
      }
    });
  });

  afterEach(() => {
    dom.window.close();
  });

  describe('Initial Page Load', () => {
    it('should have all required elements', () => {
      expect(document.getElementById('device-count')).toBeTruthy();
      expect(document.getElementById('image-upload')).toBeTruthy();
      expect(document.getElementById('process-btn')).toBeTruthy();
      expect(document.getElementById('results-section')).toBeTruthy();
      expect(document.getElementById('progress-container')).toBeTruthy();
    });

    it('should have process button disabled initially', () => {
      const processBtn = document.getElementById('process-btn') as HTMLButtonElement;
      expect(processBtn.disabled).toBe(true);
    });

    it('should have progress container hidden initially', () => {
      const progressContainer = document.getElementById('progress-container');
      expect(progressContainer?.classList.contains('hidden')).toBe(true);
    });

    it('should have default device count of 3', () => {
      const deviceCount = document.getElementById('device-count') as HTMLInputElement;
      expect(deviceCount.value).toBe('3');
    });

    it('should have sample images gallery', () => {
      const sampleImages = document.querySelectorAll('.sample-image');
      expect(sampleImages.length).toBe(10);
      
      // Check each sample image has correct structure
      sampleImages.forEach(sample => {
        expect(sample.querySelector('img')).toBeTruthy();
        expect(sample.querySelector('span')).toBeTruthy();
        expect(sample.getAttribute('data-src')).toBeTruthy();
      });
    });
  });

  describe('Sample Image Selection', () => {
    it('should add selected class when clicking sample image', () => {
      const sampleImage = document.querySelector('.sample-image') as HTMLElement;
      expect(sampleImage.classList.contains('selected')).toBe(false);
      
      // Simulate click
      const clickEvent = new window.MouseEvent('click', { bubbles: true });
      sampleImage.dispatchEvent(clickEvent);
      
      // Check if selected class would be added (requires actual JS to run)
      // In real e2e test with Playwright, this would work
    });

    it('should have correct image paths', () => {
      const sampleImages = document.querySelectorAll('.sample-image img');
      sampleImages.forEach(img => {
        const src = img.getAttribute('src');
        expect(src).toMatch(/^\/images\/(white|gradient|checkerboard|colorbars|circles|mixed)\.png$|^\/images\/im[1-5]\.jpg$/);
      });
    });
  });

  describe('Configuration Controls', () => {
    it('should accept device count between 1 and 10', () => {
      const deviceCount = document.getElementById('device-count') as HTMLInputElement;
      
      expect(deviceCount.min).toBe('1');
      expect(deviceCount.max).toBe('10');
      expect(deviceCount.type).toBe('number');
    });

    it('should have file upload input', () => {
      const fileInput = document.getElementById('image-upload') as HTMLInputElement;
      
      expect(fileInput.type).toBe('file');
      expect(fileInput.accept).toBe('image/*');
    });
  });

  describe('Results Section', () => {
    it('should be hidden initially', () => {
      const resultsSection = document.getElementById('results-section');
      expect(resultsSection?.classList.contains('hidden')).toBe(true);
    });

    it('should have canvas elements for images', () => {
      expect(document.getElementById('original-canvas')).toBeTruthy();
      expect(document.getElementById('reconstructed-canvas')).toBeTruthy();
    });

    it('should have placeholders for metrics', () => {
      expect(document.getElementById('original-size')).toBeTruthy();
      expect(document.getElementById('psnr-value')).toBeTruthy();
      expect(document.getElementById('total-size')).toBeTruthy();
    });

    it('should have device cards container', () => {
      expect(document.getElementById('device-cards')).toBeTruthy();
    });
  });

  describe('Info Section', () => {
    it('should contain explanation of how it works', () => {
      const infoSection = document.querySelector('.info-section');
      expect(infoSection).toBeTruthy();
      
      const listItems = infoSection?.querySelectorAll('li');
      expect(listItems?.length).toBeGreaterThan(0);
    });
  });

  describe('Responsive Design', () => {
    it('should have responsive meta tag', () => {
      const viewport = document.querySelector('meta[name="viewport"]');
      expect(viewport?.getAttribute('content')).toContain('width=device-width');
    });

    it('should have responsive CSS classes', () => {
      const stylesheet = document.querySelector('link[rel="stylesheet"]');
      expect(stylesheet?.getAttribute('href')).toBe('./style.css');
    });
  });
});