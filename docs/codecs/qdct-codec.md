# QDCT (Quantization-based DCT) Codec

## Overview

The QDCT codec is an advanced variant of the DCT codec that uses progressive quantization matrix adaptation. Instead of using frequency masks and device-specific strategies, QDCT progressively increases quantization values in a deterministic order based on the device ID and compression level.

## Key Concepts

### Progressive Quantization
- Starts with a matrix of all 1s (no quantization)
- Each compression level adds increment values to selected coefficients
- Increment values come from a predefined increment matrix (based on JPEG quantization)
- Device ID determines the random order of coefficient increments
- Compression level tracks how many coefficients have been incremented

### Incremental Compression
- Stores compression level with the compressed data
- Can recompress from level N to level M (where M > N)
- Only applies increases for levels N+1 to M
- Efficient for progressive quality degradation

## How it Works

### 1. Device Strategy Generation
Each device generates a unique random permutation of coefficient indices (0-63):
```typescript
// Example for DEVICE-001
quantizationOrder: [42, 17, 3, 55, 28, ...]
```

The base quantization matrix is all 1s (no quantization at level 0). An increment matrix (with values 3-24) determines how much to add to each coefficient when it's selected for compression.

### 2. Progressive Quantization Application
For compression level L:
- Start with base matrix (all 1s)
- Take the first L coefficients from the device's order
- Add the corresponding increment value to each selected coefficient

Example (with increment matrix values):
- Level 0: All coefficients = 1 (no quantization)
- Level 1: Coefficient at position 42 = 1 + increment[42]
- Level 2: Positions 42 and 17 have their increments added
- And so on...

### 3. Compression Process
1. Convert quality (0.1-1.0) to compression level (0-63)
2. Apply progressive quantization based on level
3. Standard DCT compression with modified matrix
4. Store compression level in output

### 4. Incremental Compression
When compressing to a higher level:
1. Check if cached version exists at lower level
2. If yes, decompress and recompress with new level
3. Cache updated version for future use

### 5. Multi-Device Reconstruction
QDCT uses an intelligent reconstruction strategy:
1. For each 8x8 block position in the image
2. For each DCT coefficient in the block:
   - Find which device has the lowest quantization value for that coefficient
   - Use that device's dequantized coefficient value
3. Perform inverse DCT on the selected coefficients
4. Convert back to RGB

This ensures each coefficient comes from the device that preserved it best.

## Usage Example

```typescript
const codec = new QDCTCodec();

// Initial compression at quality 0.9 (low compression level)
const result1 = codec.compress(image, {
  quality: 0.9,
  deviceId: 'DEVICE-001'
});

// Later, compress more (quality 0.5)
const result2 = codec.compress(image, {
  quality: 0.5,
  deviceId: 'DEVICE-001'
});
// This reuses cached data from level ~6 to level ~31

// Check current compression level
const level = codec.getCompressionLevel('DEVICE-001');
console.log(`Current compression level: ${level}`);

// Inspect quantization matrix at any level
const matrix = codec.getQuantizationMatrix('DEVICE-001', 20);
```

## Advantages

1. **Progressive Degradation**: Natural quality levels from 0-63
2. **Incremental Compression**: Efficient recompression to higher levels
3. **Deterministic**: Same device always follows same progression
4. **Device-Specific**: Each device has unique compression pattern
5. **Cache-Friendly**: Stores intermediate results

## Compression Levels

- **Level 0**: All coefficients = 1 (no compression)
- **Level 10**: 10 coefficients incremented (good quality)
- **Level 30**: 30 coefficients incremented (moderate quality)
- **Level 50**: 50 coefficients incremented (low quality)
- **Level 64**: All coefficients incremented once
- **Level 128**: All coefficients incremented twice (if not capped)
- **Maximum**: Coefficients capped at 255 to prevent overflow

## Quality Mapping

| Quality | Compression Level | Description |
|---------|------------------|-------------|
| 1.0 | 0 | Original matrix |
| 0.9 | ~6 | Minimal changes |
| 0.8 | ~12 | Light compression |
| 0.5 | ~31 | Moderate compression |
| 0.2 | ~50 | Heavy compression |
| 0.1 | ~57 | Maximum compression |

## Implementation Details

### Files
- `qdct-codec.ts`: Main codec implementation with caching
- `qdct-compressor.ts`: Compression/decompression logic
- `qdct-strategy.ts`: Progressive quantization strategy
- `qdct-types.ts`: Type definitions

### Memory Management
The codec maintains an internal cache of compressed versions:
- Automatic caching per device
- Manual cache clearing available
- Memory-efficient incremental updates

## Research Applications

QDCT is ideal for:
- **Progressive Image Transmission**: Start with low quality, enhance over time
- **Storage Optimization**: Adjust quality based on available space
- **Network Adaptation**: Increase compression for bandwidth constraints
- **Quality Experiments**: Fine-grained control over compression levels
- **Optimal Reconstruction**: Intelligent coefficient selection from multiple sources

## Reconstruction Benefits

The QDCT reconstruction method provides several advantages:

1. **Optimal Coefficient Selection**: Each DCT coefficient is taken from the device that quantized it least
2. **Natural Quality Distribution**: Devices at different compression levels contribute different coefficients
3. **No Averaging Artifacts**: Unlike simple averaging, coefficients are selected, not blended
4. **Deterministic Results**: Given the same devices, reconstruction is always identical
5. **Progressive Enhancement**: Adding more devices can only improve quality

## Comparison with Standard DCT

| Feature | DCT | QDCT |
|---------|-----|------|
| Strategy | Frequency masks | Progressive quantization |
| Levels | Continuous (0.1-1.0) | Discrete (0-63) |
| Incremental | No | Yes |
| Caching | No | Yes |
| Determinism | Yes | Yes |

## Future Enhancements

1. **Adaptive Percentage**: Variable increase per coefficient
2. **Multi-Stage Progression**: Different rates at different levels
3. **Perceptual Ordering**: Order coefficients by visual importance
4. **Hybrid Strategies**: Combine with frequency masking
5. **Level Prediction**: Estimate optimal level for target size