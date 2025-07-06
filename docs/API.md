# API Documentation

## Core Types

### ImageData
```typescript
interface ImageData {
  data: Uint8ClampedArray;  // RGBA pixel data
  width: number;
  height: number;
}
```

### CodecOptions
```typescript
interface CodecOptions {
  quality: number;      // 0.1 to 1.0
  deviceId: string;     // Unique device identifier
}
```

### CodecResult
```typescript
interface CodecResult {
  compressed: any;      // Codec-specific compressed data
  size: number;         // Size in bytes
  preview: ImageData;   // Preview for display
}
```

## Codec Manager API

### codecManager

The main entry point for compression operations.

#### setCodec(codecName: string): void
Switch to a different codec.
```typescript
codecManager.setCodec('wavelet');
```

#### getCurrentCodec(): string
Get the name of the current codec.
```typescript
const current = codecManager.getCurrentCodec(); // 'dct'
```

#### getAvailableCodecs(): string[]
List all registered codecs.
```typescript
const codecs = codecManager.getAvailableCodecs(); // ['dct', 'wavelet', 'rle']
```

#### compress(image: ImageData, options: CodecOptions): CodecResult
Compress an image using the current codec.
```typescript
const result = codecManager.compress(imageData, {
  quality: 0.8,
  deviceId: 'DEVICE-001'
});
```

#### decompress(compressed: any, deviceId: string): ImageData
Decompress using the current codec.
```typescript
const image = codecManager.decompress(result.compressed, 'DEVICE-001');
```

#### reconstructFromMultiple(compressedVersions: any[]): ImageData
Reconstruct from multiple compressed versions.
```typescript
const reconstructed = codecManager.reconstructFromMultiple([
  device1.compressed,
  device2.compressed,
  device3.compressed
]);
```

#### calculatePSNR(original: ImageData, compressed: ImageData): number
Calculate Peak Signal-to-Noise Ratio.
```typescript
const psnr = codecManager.calculatePSNR(originalImage, compressedImage);
console.log(`Quality: ${psnr.toFixed(2)} dB`);
```

## Codec Interface

All codecs must implement this interface:

```typescript
interface Codec {
  name: string;
  
  compress(image: ImageData, options: CodecOptions): CodecResult;
  decompress(compressed: any, deviceId: string): ImageData;
  reconstructFromMultiple(compressedVersions: any[]): ImageData;
  calculatePSNR(original: ImageData, compressed: ImageData): number;
  
  // Optional methods
  generateStrategy?(deviceId: string): any;
}
```

## Usage Examples

### Basic Compression
```typescript
import { codecManager } from './src/codecs/codec-manager';

// Load image data (from canvas, file, etc.)
const canvas = document.getElementById('myCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

// Compress with DCT codec
codecManager.setCodec('dct');
const compressed = codecManager.compress(imageData, {
  quality: 0.8,
  deviceId: 'USER-DEVICE-001'
});

console.log(`Compressed to ${compressed.size} bytes`);
```

### Multi-Device Reconstruction
```typescript
// Simulate multiple devices
const devices = ['DEVICE-001', 'DEVICE-002', 'DEVICE-003'];
const compressed = devices.map(deviceId => 
  codecManager.compress(imageData, { quality: 0.7, deviceId })
);

// Reconstruct from all versions
const reconstructed = codecManager.reconstructFromMultiple(
  compressed.map(c => c.compressed)
);

// Calculate quality
const psnr = codecManager.calculatePSNR(imageData, reconstructed);
console.log(`Reconstruction quality: ${psnr.toFixed(2)} dB`);
```

### Codec Comparison
```typescript
const codecs = codecManager.getAvailableCodecs();

codecs.forEach(codecName => {
  codecManager.setCodec(codecName);
  
  const result = codecManager.compress(imageData, {
    quality: 0.8,
    deviceId: 'TEST-DEVICE'
  });
  
  const decompressed = codecManager.decompress(
    result.compressed, 
    'TEST-DEVICE'
  );
  
  const psnr = codecManager.calculatePSNR(imageData, decompressed);
  
  console.log(`${codecName}: Size=${result.size}, PSNR=${psnr.toFixed(2)}dB`);
});
```

## Error Handling

```typescript
try {
  codecManager.setCodec('unknown-codec');
} catch (error) {
  console.error('Codec not found:', error.message);
}

try {
  const result = codecManager.compress(imageData, {
    quality: 2.0, // Invalid quality
    deviceId: 'DEVICE-001'
  });
} catch (error) {
  console.error('Invalid options:', error.message);
}
```

## Performance Considerations

1. **Memory Usage**: Large images consume significant memory
2. **Compression Time**: Varies by codec and image size
3. **Quality vs Size**: Higher quality means larger files
4. **Device Strategies**: Deterministic generation adds minimal overhead

## Best Practices

1. Always validate image data before compression
2. Use appropriate quality settings for your use case
3. Consider memory constraints when processing large images
4. Test reconstruction quality with multiple devices
5. Handle errors gracefully in production code