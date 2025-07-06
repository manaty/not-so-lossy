import { exportToNSL, importFromNSL } from './nsl-format';
import { QDCTCompressedImage } from './qdct-types';

describe('NSL Format', () => {
  // Create a sample compressed image
  const createSampleCompressedImage = (): QDCTCompressedImage => {
    return {
      deviceId: 'DEVICE-001',
      width: 256,
      height: 256,
      compressionLevel: 42,
      blocks: [
        {
          position: { x: 0, y: 0 },
          yData: [100, 50, 25, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          cbData: [30, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                   0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                   0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                   0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          crData: [20, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                   0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                   0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                   0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
          position: { x: 8, y: 0 },
          yData: [80, 40, 20, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          cbData: [25, 12, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                   0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                   0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                   0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          crData: [15, 7, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                   0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                   0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                   0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        }
      ]
    };
  };

  describe('exportToNSL', () => {
    it('should export a compressed image to NSL format', () => {
      const compressed = createSampleCompressedImage();
      const blob = exportToNSL(compressed);
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/octet-stream');
      expect(blob.size).toBeGreaterThan(0);
    });

    it('should handle empty blocks array', () => {
      const compressed: QDCTCompressedImage = {
        deviceId: 'DEVICE-000',
        width: 64,
        height: 64,
        compressionLevel: 0,
        blocks: []
      };
      
      const blob = exportToNSL(compressed);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(32); // At least header size
    });

    it('should handle blocks with all zeros', () => {
      const compressed: QDCTCompressedImage = {
        deviceId: 'DEVICE-002',
        width: 128,
        height: 128,
        compressionLevel: 100,
        blocks: [{
          position: { x: 0, y: 0 },
          yData: new Array(64).fill(0),
          cbData: new Array(64).fill(0),
          crData: new Array(64).fill(0)
        }]
      };
      
      const blob = exportToNSL(compressed);
      expect(blob).toBeInstanceOf(Blob);
    });
  });

  describe('importFromNSL', () => {
    it('should round-trip export and import correctly', async () => {
      const original = createSampleCompressedImage();
      const blob = exportToNSL(original);
      
      // Create a File from the Blob for testing
      const file = new File([blob], 'test.nsl', { type: 'application/octet-stream' });
      
      const imported = await importFromNSL(file);
      
      expect(imported.deviceId).toBe(original.deviceId);
      expect(imported.width).toBe(original.width);
      expect(imported.height).toBe(original.height);
      expect(imported.compressionLevel).toBe(original.compressionLevel);
      expect(imported.blocks.length).toBe(original.blocks.length);
      
      // Check first block
      expect(imported.blocks[0].position).toEqual(original.blocks[0].position);
      expect(imported.blocks[0].yData).toEqual(original.blocks[0].yData);
      expect(imported.blocks[0].cbData).toEqual(original.blocks[0].cbData);
      expect(imported.blocks[0].crData).toEqual(original.blocks[0].crData);
    });

    it('should reject invalid magic number', async () => {
      // Create invalid file with wrong magic
      const buffer = new ArrayBuffer(100);
      const view = new DataView(buffer);
      view.setUint32(0, 0x12345678, false); // Wrong magic
      
      const file = new File([buffer], 'invalid.nsl');
      
      await expect(importFromNSL(file)).rejects.toThrow('Invalid NSL file: wrong magic number');
    });

    it('should reject file that is too small', async () => {
      const buffer = new ArrayBuffer(10); // Too small
      const file = new File([buffer], 'small.nsl');
      
      await expect(importFromNSL(file)).rejects.toThrow('File too small to be a valid NSL file');
    });

    it('should handle different compression levels', async () => {
      const testLevels = [0, 1, 50, 100, 500, 1000];
      
      for (const level of testLevels) {
        const compressed = createSampleCompressedImage();
        compressed.compressionLevel = level;
        
        const blob = exportToNSL(compressed);
        const file = new File([blob], `test-${level}.nsl`);
        const imported = await importFromNSL(file);
        
        expect(imported.compressionLevel).toBe(level);
      }
    });

    it('should handle various device IDs', async () => {
      const deviceIds = ['DEVICE-000', 'DEVICE-999', 'CUSTOM-ID-123', 'A'];
      
      for (const deviceId of deviceIds) {
        const compressed = createSampleCompressedImage();
        compressed.deviceId = deviceId;
        
        const blob = exportToNSL(compressed);
        const file = new File([blob], 'test.nsl');
        const imported = await importFromNSL(file);
        
        expect(imported.deviceId).toBe(deviceId);
      }
    });

    it('should preserve non-zero coefficient positions', async () => {
      const compressed: QDCTCompressedImage = {
        deviceId: 'TEST',
        width: 64,
        height: 64,
        compressionLevel: 10,
        blocks: [{
          position: { x: 0, y: 0 },
          yData: new Array(64).fill(0),
          cbData: new Array(64).fill(0),
          crData: new Array(64).fill(0)
        }]
      };
      
      // Set specific non-zero values at known positions
      compressed.blocks[0].yData![0] = 255;
      compressed.blocks[0].yData![7] = -128;
      compressed.blocks[0].yData![63] = 42;
      compressed.blocks[0].cbData![15] = 100;
      compressed.blocks[0].crData![31] = -50;
      
      const blob = exportToNSL(compressed);
      const file = new File([blob], 'test.nsl');
      const imported = await importFromNSL(file);
      
      expect(imported.blocks[0].yData![0]).toBe(255);
      expect(imported.blocks[0].yData![7]).toBe(-128);
      expect(imported.blocks[0].yData![63]).toBe(42);
      expect(imported.blocks[0].cbData![15]).toBe(100);
      expect(imported.blocks[0].crData![31]).toBe(-50);
      
      // Check that other positions are still zero
      expect(imported.blocks[0].yData![1]).toBe(0);
      expect(imported.blocks[0].yData![30]).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle maximum size images', async () => {
      const compressed: QDCTCompressedImage = {
        deviceId: 'LARGE',
        width: 4096,
        height: 4096,
        compressionLevel: 999,
        blocks: []
      };
      
      // Add a few blocks (not all, that would be too much for a test)
      for (let i = 0; i < 10; i++) {
        compressed.blocks.push({
          position: { x: i * 8, y: 0 },
          yData: [100 - i, 50 - i, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0],
          cbData: new Array(64).fill(0),
          crData: new Array(64).fill(0)
        });
      }
      
      const blob = exportToNSL(compressed);
      const file = new File([blob], 'large.nsl');
      const imported = await importFromNSL(file);
      
      expect(imported.width).toBe(4096);
      expect(imported.height).toBe(4096);
      expect(imported.blocks.length).toBe(10);
    });
  });
});