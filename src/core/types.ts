/**
 * Core types for the distributed compression system
 */

export interface DeviceStrategy {
  deviceId: string;
  strategyHash: string;
  frequencyMask: boolean[];
  quantizationMatrix: number[][];
  channelWeights: { y: number; cb: number; cr: number };
  spatialPattern: number;
}

export interface DCTBlock {
  coefficients: number[];
  position: { x: number; y: number };
}

export interface CompressedImage {
  deviceId: string;
  width: number;
  height: number;
  blocks: CompressedBlock[];
}

export interface CompressedBlock {
  position: { x: number; y: number };
  yData?: number[];
  cbData?: number[];
  crData?: number[];
}

export interface ImageMetadata {
  width: number;
  height: number;
  originalFormat: string;
  compressionDate: Date;
}

export interface ReconstructionResult {
  imageData: Uint8ClampedArray;
  width: number;
  height: number;
  qualityMetrics: {
    coverage: number;
    missingCoefficients: number;
    sourceCount: number;
  };
}