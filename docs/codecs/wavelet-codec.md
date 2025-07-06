# Wavelet Codec

## Overview

The Wavelet codec implements image compression using the Haar wavelet transform. It provides hierarchical decomposition of image data and better edge preservation compared to DCT-based compression.

## How it Works

### 1. Wavelet Transform
- Applies 2D Haar wavelet transform
- Decomposes image into approximation and detail coefficients
- Multi-level decomposition (currently 3 levels)

### 2. Coefficient Structure
Each level produces four sub-bands:
- **LL**: Low-Low (approximation)
- **LH**: Low-High (horizontal details)
- **HL**: High-Low (vertical details)
- **HH**: High-High (diagonal details)

### 3. Device-Specific Compression
- Each device preserves different detail coefficients
- Uses device ID to determine which sub-bands to keep
- Approximation coefficients always preserved

### 4. Quantization
- Simple threshold-based quantization
- Small coefficients set to zero
- Quality factor controls threshold

## Implementation

```typescript
class WaveletCodec implements Codec {
  // Haar wavelet transform
  private haar2d(data: number[][], level: number): WaveletCoefficients
  
  // Inverse transform
  private ihaar2d(coeffs: WaveletCoefficients): number[][]
  
  // Compression with device-specific strategy
  compress(image: ImageData, options: CodecOptions): CodecResult
}
```

## Performance Characteristics

### Strengths
- Better edge preservation than DCT
- Natural multi-resolution representation
- No block artifacts
- Progressive transmission possible

### Limitations
- Lower compression ratio than DCT
- Simpler transform (Haar) less optimal
- Experimental implementation

## Use Cases

- Images with sharp edges
- Technical drawings
- Text-heavy images
- Multi-resolution applications

## Configuration

```typescript
interface WaveletOptions {
  quality: number;      // 0.1 to 1.0
  deviceId: string;     // For deterministic strategy
  levels: number;       // Decomposition levels (default: 3)
}
```

## Future Improvements

1. Implement more advanced wavelets (Daubechies, CDF 9/7)
2. Optimize coefficient selection strategy
3. Add perceptual weighting
4. Implement arithmetic coding for better compression

## References

1. Mallat, S. (1989). A theory for multiresolution signal decomposition
2. Daubechies, I. (1992). Ten lectures on wavelets
3. Antonini, M., et al. (1992). Image coding using wavelet transform