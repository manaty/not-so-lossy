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
│   ├── core/              # Core types and deterministic strategy
│   ├── compression/       # Image compression/decompression algorithms
│   └── utils/             # DCT and utility functions
├── tests/                  # Test suite
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── fixtures/          # Test data and utilities
├── demo/                   # Interactive web demo
│   ├── index.html         # Demo UI
│   ├── main.ts            # Demo application logic
│   └── style.css          # Demo styling
├── examples/               # Sample test images
├── docs/                   # Documentation
│   └── research/          # Research notes and algorithms
└── .todo/                  # Task management system

```

## 🧪 Implementation Details

### Compression Algorithm
- Based on JPEG-like DCT (Discrete Cosine Transform)
- YCbCr color space conversion
- 8x8 block processing
- Deterministic frequency selection based on device ID
- Configurable quality factor

### Key Features
- **Deterministic Strategy**: Each device ID maps to a unique compression strategy
- **Frequency Distribution**: Different devices preserve different DCT coefficients
- **Multi-source Reconstruction**: Combines information from multiple compressed versions
- **Quality Metrics**: PSNR calculation for objective quality assessment

### Testing
- Comprehensive test suite with 50+ tests
- Unit tests for all core functions
- Integration tests for compression/recovery workflows
- Test coverage >95%

## 📊 Demo Features

The interactive demo (`npm run demo`) showcases:
- Upload custom images or use provided test images
- Configure number of virtual devices (1-10)
- Real-time compression visualization per device
- Quality adjustment controls for each device
- PSNR metrics and file size comparisons
- Visual reconstruction from multiple sources

## 🔬 Research Documentation

See `docs/research/` for detailed documentation on:
- [JPEG Compression Pipeline](docs/research/jpeg-compression-pipeline.md)
- [Distribution Strategies](docs/research/distribution-strategies.md)
- [Deterministic Compression](docs/research/deterministic-compression.md)

## 📝 Task Management

This project uses a file-based task management system. See [PROJECT_TODO.md](PROJECT_TODO.md) for current tasks and `.todo/` directory for detailed task breakdowns.
