# Codec Documentation

This directory contains detailed documentation for each compression codec implemented in the system.

## Available Codecs

### [DCT Codec](./dct-codec.md)
The primary codec implementing JPEG-like compression with Discrete Cosine Transform. Best for photographic images with good quality/compression trade-off.

### [QDCT Codec](./qdct-codec.md)
Advanced DCT variant with progressive quantization matrix adaptation. Features incremental compression and 64 discrete quality levels.

### [Wavelet Codec](./wavelet-codec.md)
Experimental codec using Haar wavelet transform. Better edge preservation but lower compression ratio than DCT.

### [RLE Codec](./rle-codec.md)
Simple Run-Length Encoding codec. Mainly for demonstration and educational purposes.

## Codec Interface

All codecs implement the following interface:

```typescript
interface Codec {
  name: string;
  
  compress(image: ImageData, options: CodecOptions): CodecResult;
  decompress(compressed: any, deviceId: string): ImageData;
  reconstructFromMultiple(compressedVersions: any[]): ImageData;
  calculatePSNR(original: ImageData, compressed: ImageData): number;
  
  // Optional: for device-specific strategies
  generateStrategy?(deviceId: string): any;
}
```

## Adding New Codecs

To add a new codec:

1. Create a new directory: `src/codecs/your-codec/`
2. Implement the `Codec` interface
3. Register in `codec-manager.ts`
4. Add documentation here
5. Write tests

See the [main README](../../README.md#-extending-the-system) for detailed instructions.

## Choosing a Codec

| Codec | Best For | Compression Ratio | Quality | Speed | Special Features |
|-------|----------|-------------------|---------|-------|------------------|
| DCT | Photos, general use | High (10:1-20:1) | Excellent | Fast | Frequency masking |
| QDCT | Progressive compression | High (10:1-20:1) | Excellent | Fast | Incremental, 64 levels |
| Wavelet | Images with edges | Medium (5:1-10:1) | Good | Medium | Multi-resolution |
| RLE | Simple graphics | Variable | Lossless* | Very Fast | Educational |

*RLE is lossless for the channels it processes

## Research Applications

The modular codec system enables:
- Comparative studies of compression algorithms
- Hybrid approaches combining multiple codecs
- Device-specific optimization strategies
- Educational demonstrations