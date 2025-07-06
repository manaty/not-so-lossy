/**
 * DCT-specific types
 */

export interface DCTDeviceStrategy {
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

export interface DCTCompressedImage {
  deviceId: string;
  width: number;
  height: number;
  blocks: DCTCompressedBlock[];
  qualityFactor: number;
}

export interface DCTCompressedBlock {
  position: { x: number; y: number };
  yData?: number[];
  cbData?: number[];
  crData?: number[];
}