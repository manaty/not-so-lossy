# Modular Architecture Guide

## Overview

The codebase has been reorganized to support multiple compression algorithms through a clean, modular architecture. This guide explains the structure and how to work with it.

## Architecture Principles

### 1. Separation of Concerns
- **Core**: Generic types and interfaces shared across all codecs
- **Codecs**: Self-contained compression algorithm implementations
- **Demo**: UI code independent of specific codec implementations

### 2. Codec Interface
All codecs implement a common interface:
```typescript
interface Codec {
  name: string;
  compress(image: ImageData, options: CodecOptions): CodecResult;
  decompress(compressed: any, deviceId: string): ImageData;
  reconstructFromMultiple(compressedVersions: any[]): ImageData;
  calculatePSNR(original: ImageData, compressed: ImageData): number;
}
```

### 3. Codec Manager
Central registry and facade for codec operations:
- Manages codec selection
- Provides unified API
- Handles codec registration

## Directory Structure

```
src/
├── core/
│   └── types.ts              # Generic types only
├── codecs/
│   ├── types.ts              # Codec interface
│   ├── codec-manager.ts      # Codec registry
│   ├── dct/                  # DCT codec
│   │   ├── dct-codec.ts      # Interface implementation
│   │   ├── dct-compressor.ts # Core compression logic
│   │   ├── dct-types.ts      # DCT-specific types
│   │   └── ...
│   ├── wavelet/              # Wavelet codec
│   └── rle/                  # RLE codec
```

## Migration from Old Structure

### Before (Mixed Concerns)
```
src/
├── compression/              # Mixed DCT logic
│   └── image-compressor.ts
├── core/
│   ├── types.ts             # Mixed generic + DCT types
│   └── deterministic-strategy.ts  # DCT-specific
└── utils/
    └── dct.ts               # DCT utilities
```

### After (Clean Separation)
- All DCT code moved to `src/codecs/dct/`
- Core contains only generic types
- Each codec is self-contained

## Adding a New Codec

### Step 1: Create Codec Directory
```bash
mkdir src/codecs/my-codec
```

### Step 2: Implement Codec Interface
```typescript
// src/codecs/my-codec/my-codec.ts
import { Codec, ImageData, CodecOptions, CodecResult } from '../types';

export class MyCodec implements Codec {
  name = 'my-codec';
  
  compress(image: ImageData, options: CodecOptions): CodecResult {
    // Implementation
  }
  
  // ... other methods
}
```

### Step 3: Register Codec
```typescript
// src/codecs/codec-manager.ts
import { MyCodec } from './my-codec/my-codec';

private registerBuiltinCodecs(): void {
  // ... existing codecs
  CodecRegistry.register(new MyCodec());
}
```

### Step 4: Add Tests
```typescript
// tests/unit/my-codec.test.ts
describe('MyCodec', () => {
  // Test compression, decompression, reconstruction
});
```

### Step 5: Document
Create `docs/codecs/my-codec.md` with:
- Algorithm overview
- Performance characteristics
- Use cases
- Configuration options

## Best Practices

### 1. Type Safety
- Define codec-specific types in `codec-types.ts`
- Don't pollute core types with codec-specific interfaces

### 2. Self-Contained Codecs
- All codec logic in its directory
- No cross-codec dependencies
- Clear public API through codec interface

### 3. Testing
- Unit tests for each codec method
- Integration tests for multi-device scenarios
- Performance benchmarks

### 4. Documentation
- README in codec directory
- Public documentation in `docs/codecs/`
- Code comments for complex algorithms

## Benefits of Modular Architecture

1. **Experimentation**: Easy to try new algorithms
2. **Comparison**: Side-by-side codec evaluation
3. **Maintenance**: Isolated codec changes
4. **Testing**: Codec-specific test suites
5. **Documentation**: Clear separation of concerns

## Common Patterns

### Device Strategy Generation
Each codec implements device-specific strategies:
```typescript
// Deterministic based on device ID
const strategy = generateStrategy(deviceId);

// Apply strategy during compression
const compressed = applyStrategy(data, strategy);
```

### Multi-Device Reconstruction
Standard pattern for combining multiple versions:
```typescript
reconstructFromMultiple(versions: any[]): ImageData {
  // 1. Collect all available data
  // 2. Merge based on quality/availability
  // 3. Reconstruct final image
}
```

### Quality Metrics
All codecs implement PSNR calculation:
```typescript
calculatePSNR(original: ImageData, compressed: ImageData): number {
  // Standard PSNR formula
  // 10 * log10(MAX^2 / MSE)
}
```

## Future Enhancements

1. **Dynamic Codec Loading**: Load codecs at runtime
2. **WebAssembly Codecs**: High-performance implementations
3. **Codec Pipelines**: Chain multiple codecs
4. **Adaptive Selection**: Choose codec based on image content
5. **Parallel Processing**: Web Workers for compression

## Conclusion

The modular architecture provides a solid foundation for compression research while maintaining clean, maintainable code. Each codec can evolve independently while sharing common infrastructure.