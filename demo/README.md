# Not-So-Lossy Demo

This is an interactive demonstration of the distributed lossy image compression system with support for multiple compression algorithms.

## Features

- **Multiple Codecs**: Switch between DCT, Wavelet, and RLE compression algorithms
- **Distributed Compression**: Simulate multiple devices with unique compression strategies
- **Memory-Based Limits**: Each device has a 10MB memory limit
- **Real-time Visualization**: See compression results instantly
- **Quality Metrics**: PSNR calculations for objective quality assessment

## Running the Demo

1. From the project root directory, install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run demo
   ```

3. The demo will open in your browser at http://localhost:3000

## How to Use

### 1. Select Compression Algorithm
Use the dropdown to choose between:
- **DCT**: JPEG-like compression (best for photos)
- **Wavelet**: Haar transform (better edge preservation)
- **RLE**: Run-length encoding (for simple graphics)

### 2. Configure Devices
Set the number of virtual devices (1-10) that will compress the image.

### 3. Choose an Image
Either:
- Upload your own image file, OR
- Click one of the provided test images

### 4. Process the Image
Click "Process Image" to:
- Distribute the image to all devices
- Apply device-specific compression strategies
- Show individual compressed versions
- Reconstruct from all devices

### 5. Adjust Individual Devices
For each device:
- Use the size slider to set target file size
- Click "Apply Size" to recompress
- View updated PSNR and memory usage

### 6. Compare Results
- Original vs Reconstructed comparison
- Individual device PSNR scores
- Total memory usage across devices
- Live codec switching for comparison

## Key Concepts Demonstrated

### Deterministic Compression
Each device ID determines exactly which image information is preserved:
- DCT: Different frequency coefficients
- Wavelet: Different detail sub-bands
- RLE: Different color channels

### Distributed Preservation
Multiple devices create complementary compressed versions that combine for better quality than any single version.

### Memory-Based Compression
Instead of quality factors, devices compress to meet memory constraints - more realistic for real-world applications.

### Codec Flexibility
The modular architecture allows easy comparison of different compression algorithms on the same image.

## Understanding the Results

### PSNR (Peak Signal-to-Noise Ratio)
- **40+ dB**: Excellent quality, minimal visible difference
- **30-40 dB**: Good quality, slight degradation
- **25-30 dB**: Acceptable quality, visible artifacts
- **<25 dB**: Poor quality, significant artifacts

### Memory Usage
Each device shows current/maximum memory usage. The system automatically adjusts quality to stay within limits.

### Reconstruction Quality
The reconstructed image's PSNR should typically be higher than individual device PSNRs due to complementary information preservation.

## Building for Production

To build the demo for deployment:

```bash
npm run build-demo
```

The built files will be in the `dist-demo` directory, ready for static hosting.

## Technical Details

The demo uses:
- **Vite**: Fast development server and build tool
- **TypeScript**: Type-safe implementation
- **Canvas API**: Image manipulation
- **Web Workers**: (planned) Parallel compression

## Troubleshooting

### Images not loading
Ensure test images are copied: `npm run copy-test-images`

### Codec dropdown empty
Rebuild the project: `npm run build`

### Performance issues
- Reduce image size (max 512x512 recommended)
- Use fewer devices
- Try DCT codec (fastest)