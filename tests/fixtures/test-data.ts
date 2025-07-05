/**
 * Test fixtures and sample data for unit and integration tests
 */

export const TEST_DEVICE_IDS = {
  deviceA: 'AA:BB:CC:DD:EE:FF',
  deviceB: '11:22:33:44:55:66',
  deviceC: 'FF:EE:DD:CC:BB:AA',
  deviceD: '00:11:22:33:44:55'
};

export const SAMPLE_8X8_BLOCKS = {
  // Constant block (all same value)
  constant: Array(8).fill(0).map(() => Array(8).fill(128)),
  
  // Gradient block
  gradient: Array(8).fill(0).map((_, i) => 
    Array(8).fill(0).map((_, j) => i * 32 + j * 4)
  ),
  
  // High frequency pattern (checkerboard)
  checkerboard: Array(8).fill(0).map((_, i) => 
    Array(8).fill(0).map((_, j) => (i + j) % 2 === 0 ? 255 : 0)
  ),
  
  // Real image block sample
  realImage: [
    [52, 55, 61, 66, 70, 61, 64, 73],
    [63, 59, 55, 90, 109, 85, 69, 72],
    [62, 59, 68, 113, 144, 104, 66, 73],
    [63, 58, 71, 122, 154, 106, 70, 69],
    [67, 61, 68, 104, 126, 88, 68, 70],
    [79, 65, 60, 70, 77, 68, 58, 75],
    [85, 71, 64, 59, 55, 61, 65, 83],
    [87, 79, 69, 68, 65, 76, 78, 94]
  ],
  
  // Edge block (vertical edge)
  verticalEdge: Array(8).fill(0).map((_, i) => 
    Array(8).fill(0).map((_, j) => j < 4 ? 50 : 200)
  ),
  
  // Zero block
  zero: Array(8).fill(0).map(() => Array(8).fill(0))
};

export const STANDARD_QUANTIZATION_MATRICES = {
  // JPEG standard luminance quantization matrix
  luminance: [
    [16, 11, 10, 16, 24, 40, 51, 61],
    [12, 12, 14, 19, 26, 58, 60, 55],
    [14, 13, 16, 24, 40, 57, 69, 56],
    [14, 17, 22, 29, 51, 87, 80, 62],
    [18, 22, 37, 56, 68, 109, 103, 77],
    [24, 35, 55, 64, 81, 104, 113, 92],
    [49, 64, 78, 87, 103, 121, 120, 101],
    [72, 92, 95, 98, 112, 100, 103, 99]
  ],
  
  // JPEG standard chrominance quantization matrix
  chrominance: [
    [17, 18, 24, 47, 99, 99, 99, 99],
    [18, 21, 26, 66, 99, 99, 99, 99],
    [24, 26, 56, 99, 99, 99, 99, 99],
    [47, 66, 99, 99, 99, 99, 99, 99],
    [99, 99, 99, 99, 99, 99, 99, 99],
    [99, 99, 99, 99, 99, 99, 99, 99],
    [99, 99, 99, 99, 99, 99, 99, 99],
    [99, 99, 99, 99, 99, 99, 99, 99]
  ],
  
  // Uniform quantization for testing
  uniform: Array(8).fill(0).map(() => Array(8).fill(16))
};

export const TEST_IMAGE_METADATA = {
  small: {
    width: 64,
    height: 64,
    originalFormat: 'jpeg',
    compressionDate: new Date('2024-01-01')
  },
  medium: {
    width: 256,
    height: 256,
    originalFormat: 'jpeg',
    compressionDate: new Date('2024-01-01')
  },
  large: {
    width: 1024,
    height: 768,
    originalFormat: 'jpeg',
    compressionDate: new Date('2024-01-01')
  }
};

/**
 * Generate a test image with specific patterns
 */
export function generateTestImage(width: number, height: number, pattern: 'solid' | 'gradient' | 'checkerboard' | 'noise'): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4); // RGBA
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      let value = 0;
      
      switch (pattern) {
        case 'solid':
          value = 128;
          break;
        case 'gradient':
          value = Math.floor((x / width) * 255);
          break;
        case 'checkerboard':
          value = ((Math.floor(x / 8) + Math.floor(y / 8)) % 2) * 255;
          break;
        case 'noise':
          value = Math.floor(Math.random() * 256);
          break;
      }
      
      data[idx] = value;     // R
      data[idx + 1] = value; // G
      data[idx + 2] = value; // B
      data[idx + 3] = 255;   // A
    }
  }
  
  return data;
}

/**
 * Compare two blocks and return mean squared error
 */
export function calculateMSE(block1: number[][], block2: number[][]): number {
  let mse = 0;
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const diff = block1[i][j] - block2[i][j];
      mse += diff * diff;
    }
  }
  return mse / 64;
}

/**
 * Calculate PSNR from MSE
 */
export function calculatePSNR(mse: number, maxValue: number = 255): number {
  if (mse === 0) return Infinity;
  return 10 * Math.log10((maxValue * maxValue) / mse);
}