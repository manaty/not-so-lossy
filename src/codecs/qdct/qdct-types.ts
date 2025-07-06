/**
 * QDCT (Quantization-based DCT) codec types
 */

export interface QDCTCompressedImage {
  deviceId: string;
  width: number;
  height: number;
  blocks: QDCTCompressedBlock[];
  compressionLevel: number; // Current compression level (0-63)
}

export interface QDCTCompressedBlock {
  position: { x: number; y: number };
  yData?: number[];
  cbData?: number[];
  crData?: number[];
}

export interface QDCTStrategy {
  deviceId: string;
  quantizationOrder: number[]; // Order of coefficients to increase (0-63)
  quantizationIncrease: number; // Percentage to increase each coefficient
}