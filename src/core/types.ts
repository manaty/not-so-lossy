/**
 * Core types for the distributed compression system
 */

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