# not-so-lossy
A research project exploring distributed lossy image compression that preserves different details across multiple compressed versions, enabling high-quality reconstruction from the collective set.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run the interactive demo
npm run demo

# Run tests
npm test

# Build for production
npm run build-demo
```

## Research Focus
This project aims to demonstrate a novel approach to image compression where information loss is strategically distributed across multiple versions rather than uniformly applied. The goal is to develop proof-of-concept algorithms, create an interactive web demo, and publish the findings in an academic paper.

## Concept
Traditional lossy compression discards the same information across all compressed copies. This project implements a smart compression strategy where different devices/agents preserve different aspects of the original image. By combining multiple "differently-lossy" versions, we can reconstruct an image closer to the original than any single compressed version could provide.

### Deterministic Compression
Each device's compression strategy is deterministically derived from its unique ID (e.g., MAC address):
- No coordination needed between devices
- Given a device ID, we know exactly what information was preserved
- Reconstruction algorithm can perfectly account for what each device contributed
- Zero metadata overhead - the strategy is implicit in the device ID

## Use Case
When sharing photos across devices with storage constraints:
- Each device compresses to meet its storage limits
- Each compression preserves different image characteristics (edges, colors, textures, etc.)
- Original quality can be better approximated by combining all versions
- No single point of failure for image quality

## Social Recovery Mechanism
The system leverages social networks as a natural preservation layer:
- **Popularity = Preservation**: The more an image is viewed and liked, the more compressed versions exist across the network
- **Social Redundancy**: Viral images automatically gain more recovery points through natural sharing
- **Memory Augmentation**: Users can query their social network to find additional sources when trying to recover image details
- **Quality Correlation**: Image quality recovery potential correlates with its social engagement metrics

## 📁 Project Structure

```
├── src/                    # Source code
│   ├── core/              # Core types shared across codecs
│   ├── codecs/            # Compression codec implementations
│   │   ├── types.ts       # Codec interface definitions
│   │   ├── codec-manager.ts # Codec selection and management
│   │   ├── dct/           # DCT codec implementation
│   │   │   ├── dct-codec.ts
│   │   │   ├── dct-compressor.ts
│   │   │   ├── dct-reconstruction.ts
│   │   │   ├── dct-strategy.ts
│   │   │   ├── dct-types.ts
│   │   │   └── dct-utils.ts
│   │   ├── wavelet/       # Wavelet codec implementation
│   │   │   └── wavelet-codec.ts
│   │   └── rle/           # RLE codec implementation
│   │       └── rle-codec.ts
│   └── recovery/          # Recovery mechanisms
├── tests/                  # Test suite
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── fixtures/          # Test data and utilities
├── demo/                   # Interactive web demo
│   ├── index.html         # Demo UI with codec selector
│   ├── main.ts            # Demo application logic
│   └── style.css          # Demo styling
├── examples/               # Sample test images
├── docs/                   # Documentation
│   ├── research/          # Research notes and algorithms
│   └── codecs/            # Codec-specific documentation
└── .todo/                  # Task management system

```

## 🧪 Implementation Details

### Modular Codec Architecture
The system supports multiple compression algorithms through a pluggable codec interface:

#### Available Codecs
1. **DCT (Discrete Cosine Transform)**
   - JPEG-like compression with 8x8 block processing
   - YCbCr color space conversion
   - Deterministic frequency selection based on device ID
   - Best quality/compression ratio

2. **QDCT (Quantization-based DCT)**
   - Progressive quantization matrix adaptation
   - 64 discrete compression levels
   - Incremental compression support
   - Efficient recompression to higher levels

3. **Wavelet (Haar Transform)**
   - Hierarchical decomposition of image data
   - Better edge preservation than DCT
   - Experimental implementation

4. **RLE (Run-Length Encoding)**
   - Simple compression for images with large uniform areas
   - Demonstration of codec interface flexibility

### Key Features
- **Modular Design**: Easy to add new compression algorithms
- **Deterministic Strategy**: Each device ID maps to a unique compression strategy
- **Codec-agnostic Interface**: Unified API for all compression methods
- **Multi-source Reconstruction**: Combines information from multiple compressed versions
- **Quality Metrics**: PSNR calculation for objective quality assessment

### Testing
- Comprehensive test suite with 50+ tests
- Unit tests for all core functions
- Integration tests for compression/recovery workflows
- Test coverage >95%

## 📊 Demo Features

The interactive demo (`npm run demo`) showcases:
- **Codec Selection**: Choose between DCT, QDCT, Wavelet, or RLE compression
- Upload custom images or use provided test images
- Configure number of virtual devices (1-10)
- Real-time compression visualization per device
- Memory-based compression (10MB limit per device)
- Size slider controls for each device
- PSNR metrics and file size comparisons
- Visual reconstruction from multiple sources
- Live codec switching to compare algorithms
- Incremental compression with QDCT codec

## 🔧 Extending the System

### Adding a New Codec

1. Create a new directory under `src/codecs/your-codec/`
2. Implement the `Codec` interface from `src/codecs/types.ts`
3. Register your codec in `src/codecs/codec-manager.ts`

Example codec structure:
```typescript
export class YourCodec implements Codec {
  name = 'your-codec';
  
  compress(image: ImageData, options: CodecOptions): CodecResult {
    // Your compression logic
  }
  
  decompress(compressed: any, deviceId: string): ImageData {
    // Your decompression logic
  }
  
  reconstructFromMultiple(compressedVersions: any[]): ImageData {
    // Your reconstruction logic
  }
  
  calculatePSNR(original: ImageData, compressed: ImageData): number {
    // PSNR calculation
  }
}
```

## 📚 Documentation

### API Reference
- [API Documentation](docs/API.md) - Complete API reference and usage examples

### Codec Documentation
- [Codec Overview](docs/codecs/README.md) - Comparison and selection guide
- [DCT Codec](docs/codecs/dct-codec.md) - JPEG-like compression details
- [Wavelet Codec](docs/codecs/wavelet-codec.md) - Haar wavelet transform
- [RLE Codec](docs/codecs/rle-codec.md) - Run-length encoding

### Research Documentation
- [JPEG Compression Pipeline](docs/research/jpeg-compression-pipeline.md)
- [Distribution Strategies](docs/research/distribution-strategies.md)
- [Deterministic Compression](docs/research/deterministic-compression.md)

### Demo
- [Demo Guide](demo/README.md) - How to use the interactive demo

## 📝 Task Management

This project uses a file-based task management system. See [PROJECT_TODO.md](PROJECT_TODO.md) for current tasks and `.todo/` directory for detailed task breakdowns.
