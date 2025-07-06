# DCT (Discrete Cosine Transform) Codec

## Overview

The DCT codec implements JPEG-like compression using the Discrete Cosine Transform. It provides the best quality/compression ratio among the available codecs and is the primary codec for the distributed compression research.

## How it Works

### 1. Color Space Conversion
- Converts RGB to YCbCr color space
- Y channel: luminance (brightness)
- Cb/Cr channels: chrominance (color)

### 2. Block Processing
- Divides image into 8x8 pixel blocks
- Applies 2D DCT transform to each block
- Converts spatial domain to frequency domain

### 3. Deterministic Strategy
Each device generates a unique compression strategy based on its ID:
- **Frequency Mask**: Which DCT coefficients to preserve
- **Quantization Matrix**: How much to quantize each coefficient
- **Channel Weights**: Relative importance of Y, Cb, Cr channels

### 4. Quantization
- Applies device-specific quantization matrix
- Preserves coefficients selected by frequency mask
- Quality factor adjusts quantization strength

### 5. Compression
- Stores only non-zero coefficients
- Zigzag ordering for better compression
- Metadata includes position and channel info

## Reconstruction Algorithm

### Multi-device Reconstruction
1. Collects compressed blocks from all devices
2. For each coefficient position:
   - Identifies which devices preserved it
   - Uses quality-weighted averaging
   - Applies threshold (PSNR > 30) for inclusion
3. Performs inverse DCT to reconstruct image

### Quality Preservation
- DC coefficient (average color) always preserved
- Higher quality devices contribute more to reconstruction
- Missing coefficients filled with zeros

## Performance Characteristics

### Strengths
- Excellent compression ratio (10:1 to 20:1)
- Good visual quality at moderate compression
- Well-understood algorithm (JPEG standard)
- Efficient frequency domain operations

### Limitations
- Block artifacts at high compression
- Less effective for images with sharp edges
- Fixed 8x8 block size

## Configuration Options

```typescript
interface DCTOptions {
  quality: number;      // 0.1 to 1.0
  deviceId: string;     // Unique device identifier
}
```

### Quality Settings
- **1.0**: ~90% of original size, minimal loss
- **0.8**: ~60% of original size, good quality
- **0.5**: ~30% of original size, visible artifacts
- **0.1**: ~10% of original size, significant loss

## Implementation Details

### File Structure
```
src/codecs/dct/
├── dct-codec.ts         # Codec interface implementation
├── dct-compressor.ts    # Compression/decompression logic
├── dct-reconstruction.ts # Multi-device reconstruction
├── dct-strategy.ts      # Deterministic strategy generation
├── dct-types.ts         # DCT-specific type definitions
└── dct-utils.ts         # DCT math functions
```

### Key Functions
- `dct2d()`: 2D Discrete Cosine Transform
- `idct2d()`: Inverse DCT
- `quantize()`: Apply quantization matrix
- `zigzagOrder()`: Reorder coefficients
- `generateDeterministicStrategy()`: Create device strategy

## Research Applications

The DCT codec is ideal for:
- Distributed image storage systems
- Social media compression optimization
- Multi-device photo backup
- Bandwidth-constrained environments

## References

1. Wallace, G. K. (1991). The JPEG still picture compression standard
2. Ahmed, N., Natarajan, T., & Rao, K. R. (1974). Discrete cosine transform
3. Pennebaker, W. B., & Mitchell, J. L. (1992). JPEG: Still image data compression standard