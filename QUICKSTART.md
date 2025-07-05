# Quick Start Guide

## 🚀 Running the Demo

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start the demo**
   ```bash
   npm run demo
   ```

3. **Open browser** at http://localhost:3000

## 🎮 Using the Demo

### Basic Steps:
1. **Set number of devices** (1-10) - More devices = better reconstruction
2. **Choose an image**:
   - Click a sample image (Gradient, Checkerboard, etc.)
   - OR upload your own image
3. **Click "Process Image"** to see the magic happen!

### What You'll See:
- **Original Image**: Your input image
- **Reconstructed Image**: Combined from all device compressions
- **PSNR Value**: Quality metric (higher = better, 30+ is good)
- **Device Cards**: Each shows:
  - Compressed preview
  - Quality slider (10-100%)
  - File size
  - Compression ratio

### Advanced Features:
- **Adjust Quality**: Move the slider and click "Recompress"
- **Important**: Devices can only recompress their own data, not the original
- **Watch PSNR**: See how quality changes with different settings

## 🧪 Running Tests

```bash
npm test              # Run all tests
npm run test:coverage # See coverage report
```

## 📊 Sample Images Explained

- **Gradient**: Tests smooth color transitions (low frequencies)
- **Checkerboard**: Tests sharp edges (high frequencies)
- **Color Bars**: Tests color channel separation
- **Circles**: Tests radial patterns
- **Mixed**: Tests combination of features

## 💡 Key Concepts

1. **Deterministic Compression**: Each device ID determines what it preserves
2. **No Coordination**: Devices don't communicate
3. **Better Together**: Multiple lossy versions > single lossy version
4. **Social Recovery**: Popular images = more recovery points

## 🛠️ Development

```bash
npm run dev   # Watch TypeScript files
npm run build # Build for production
```

## 📚 Learn More

- See `docs/research/` for algorithm details
- Check `PROJECT_TODO.md` for project status
- Read the code in `src/` for implementation