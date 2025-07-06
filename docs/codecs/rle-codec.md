# RLE (Run-Length Encoding) Codec

## Overview

The RLE codec implements simple Run-Length Encoding compression. While not suitable for photographic images, it demonstrates the modular codec interface and can be effective for images with large uniform areas.

## How it Works

### 1. Basic Algorithm
- Scans image data sequentially
- Identifies runs of identical values
- Encodes as (count, value) pairs

### 2. Channel Processing
- Processes R, G, B channels independently
- Preserves alpha channel without compression

### 3. Device-Specific Strategy
- Different devices encode different channels
- Based on device ID hash
- Ensures complementary information preservation

## Implementation

```typescript
interface RLERun {
  count: number;
  value: number;
}

class RLECodec implements Codec {
  compress(image: ImageData, options: CodecOptions): CodecResult {
    // Encode runs for selected channels
  }
  
  decompress(compressed: RLECompressed): ImageData {
    // Decode runs back to pixel data
  }
}
```

## Performance Characteristics

### Strengths
- Very simple algorithm
- Effective for uniform areas
- Fast compression/decompression
- Minimal memory overhead

### Limitations
- Poor compression for photos
- No quality control
- Fixed compression strategy
- Limited practical use

## Use Cases

- Simple graphics
- Logos and icons
- Images with solid backgrounds
- Demonstration purposes

## Example

Input: `[255, 255, 255, 0, 0, 0, 0, 128]`
Output: `[{count: 3, value: 255}, {count: 4, value: 0}, {count: 1, value: 128}]`

## Educational Value

The RLE codec serves as:
1. Simple example of codec interface
2. Baseline for compression comparison
3. Teaching tool for compression concepts
4. Template for new codec development

## Future Improvements

1. Add predictive RLE variants
2. Implement 2D run-length encoding
3. Combine with other techniques
4. Add entropy coding stage