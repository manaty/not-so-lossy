/**
 * Discrete Cosine Transform utilities
 */

/**
 * Perform 2D DCT on an 8x8 block
 */
export function dct2d(block: number[][]): number[][] {
  const N = 8;
  const result: number[][] = Array(N).fill(0).map(() => Array(N).fill(0));
  
  for (let u = 0; u < N; u++) {
    for (let v = 0; v < N; v++) {
      let sum = 0;
      
      for (let x = 0; x < N; x++) {
        for (let y = 0; y < N; y++) {
          sum += block[x][y] * 
                 Math.cos((2 * x + 1) * u * Math.PI / (2 * N)) *
                 Math.cos((2 * y + 1) * v * Math.PI / (2 * N));
        }
      }
      
      const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
      const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
      
      result[u][v] = (2 / N) * cu * cv * sum;
    }
  }
  
  return result;
}

/**
 * Perform inverse 2D DCT on an 8x8 block
 */
export function idct2d(dctBlock: number[][]): number[][] {
  const N = 8;
  const result: number[][] = Array(N).fill(0).map(() => Array(N).fill(0));
  
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      let sum = 0;
      
      for (let u = 0; u < N; u++) {
        for (let v = 0; v < N; v++) {
          const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
          const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
          
          sum += cu * cv * dctBlock[u][v] *
                 Math.cos((2 * x + 1) * u * Math.PI / (2 * N)) *
                 Math.cos((2 * y + 1) * v * Math.PI / (2 * N));
        }
      }
      
      result[x][y] = (2 / N) * sum;
    }
  }
  
  return result;
}

/**
 * Convert 8x8 block to zig-zag order
 */
export function zigzagOrder(block: number[][]): number[] {
  const zigzag: number[] = new Array(64);
  const order = [
    [0, 0], [0, 1], [1, 0], [2, 0], [1, 1], [0, 2], [0, 3], [1, 2],
    [2, 1], [3, 0], [4, 0], [3, 1], [2, 2], [1, 3], [0, 4], [0, 5],
    [1, 4], [2, 3], [3, 2], [4, 1], [5, 0], [6, 0], [5, 1], [4, 2],
    [3, 3], [2, 4], [1, 5], [0, 6], [0, 7], [1, 6], [2, 5], [3, 4],
    [4, 3], [5, 2], [6, 1], [7, 0], [7, 1], [6, 2], [5, 3], [4, 4],
    [3, 5], [2, 6], [1, 7], [2, 7], [3, 6], [4, 5], [5, 4], [6, 3],
    [7, 2], [7, 3], [6, 4], [5, 5], [4, 6], [3, 7], [4, 7], [5, 6],
    [6, 5], [7, 4], [7, 5], [6, 6], [5, 7], [6, 7], [7, 6], [7, 7]
  ];
  
  for (let i = 0; i < 64; i++) {
    const [row, col] = order[i];
    zigzag[i] = block[row][col];
  }
  
  return zigzag;
}

/**
 * Convert from zig-zag order back to 8x8 block
 */
export function inverseZigzag(zigzag: number[]): number[][] {
  const block: number[][] = Array(8).fill(0).map(() => Array(8).fill(0));
  const order = [
    [0, 0], [0, 1], [1, 0], [2, 0], [1, 1], [0, 2], [0, 3], [1, 2],
    [2, 1], [3, 0], [4, 0], [3, 1], [2, 2], [1, 3], [0, 4], [0, 5],
    [1, 4], [2, 3], [3, 2], [4, 1], [5, 0], [6, 0], [5, 1], [4, 2],
    [3, 3], [2, 4], [1, 5], [0, 6], [0, 7], [1, 6], [2, 5], [3, 4],
    [4, 3], [5, 2], [6, 1], [7, 0], [7, 1], [6, 2], [5, 3], [4, 4],
    [3, 5], [2, 6], [1, 7], [2, 7], [3, 6], [4, 5], [5, 4], [6, 3],
    [7, 2], [7, 3], [6, 4], [5, 5], [4, 6], [3, 7], [4, 7], [5, 6],
    [6, 5], [7, 4], [7, 5], [6, 6], [5, 7], [6, 7], [7, 6], [7, 7]
  ];
  
  for (let i = 0; i < 64; i++) {
    const [row, col] = order[i];
    block[row][col] = zigzag[i];
  }
  
  return block;
}

/**
 * Quantize DCT coefficients
 */
export function quantize(dctBlock: number[][], quantMatrix: number[][]): number[][] {
  const result: number[][] = Array(8).fill(0).map(() => Array(8).fill(0));
  
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      result[i][j] = Math.round(dctBlock[i][j] / quantMatrix[i][j]);
    }
  }
  
  return result;
}

/**
 * Dequantize DCT coefficients
 */
export function dequantize(quantBlock: number[][], quantMatrix: number[][]): number[][] {
  const result: number[][] = Array(8).fill(0).map(() => Array(8).fill(0));
  
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      result[i][j] = quantBlock[i][j] * quantMatrix[i][j];
    }
  }
  
  return result;
}