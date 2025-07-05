# Not-So-Lossy Demo

This is an interactive demonstration of the distributed lossy image compression algorithm.

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

1. **Set Number of Devices**: Choose how many virtual devices will compress the image (1-10)

2. **Choose an Image**: 
   - Upload your own image file, OR
   - Click one of the provided test images:
     - **Gradient**: Smooth color transitions (tests low-frequency preservation)
     - **Checkerboard**: High-frequency pattern (tests edge preservation)
     - **Color Bars**: Standard broadcast test pattern
     - **Circles**: Radial frequency pattern
     - **Mixed**: Combination of smooth and detailed areas

3. **Process**: Click the "Process Image" button to distribute compression across devices

4. **Explore Results**:
   - View the original image and the reconstructed version
   - See the PSNR (Peak Signal-to-Noise Ratio) quality metric
   - Each device shows its compressed version

5. **Adjust Quality**: 
   - Use the quality slider on each device card
   - Click "Recompress" to apply new quality settings
   - Note: Devices can only recompress their own compressed version, not the original

## Key Concepts Demonstrated

- **Deterministic Compression**: Each device ID determines exactly which image information is preserved
- **Distributed Preservation**: Different devices keep different frequency coefficients
- **Quality Improvement**: More devices = better reconstruction quality
- **Progressive Compression**: Reducing quality on a device permanently loses information

## Building for Production

To build the demo for deployment:

```bash
npm run build-demo
```

The built files will be in the `dist-demo` directory, ready for static hosting.