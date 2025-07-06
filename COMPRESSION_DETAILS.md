# Distributed Lossy Image Compression System - Technical Details

## Overview

This system implements a distributed image compression scheme where multiple devices compress the same image using different strategies, and a reconstruction algorithm combines them to achieve better quality than any individual device.

The system now supports multiple compression algorithms (codecs) through a modular architecture, allowing experimentation with different compression techniques while maintaining the core distributed compression concept.

## 1. Compression Process

### 1.1 Device Strategy Generation

Each device has a deterministic strategy based on its ID. The strategy generation is codec-specific:

#### DCT Codec Strategy
```typescript
// From dct-strategy.ts
generateStrategy(deviceId: string): DCTDeviceStrategy {
  const hash = this.hashString(deviceId);
  
  return {
    deviceId,
    strategyHash: hash,
    frequencyMask: this.generateFrequencyMask(hash),
    quantizationMatrix: this.generateQuantizationMatrix(hash),
    channelWeights: this.generateChannelWeights(hash),
    spatialPattern: parseInt(hash.substring(0, 8), 16) % 4
  };
}
```

Key components:
- **Frequency Mask**: Determines which DCT coefficients to keep (typically 20-23 out of 64)

#### Other Codec Strategies
- **Wavelet**: Determines which detail sub-bands to preserve
- **RLE**: Selects which color channels to encode
- **Quantization Matrix**: Base quantization values for each frequency
- **Channel Weights**: How much to prioritize Y, Cb, Cr channels
- **Spatial Pattern**: Not currently used

### 1.2 Compression Steps

1. **Color Space Conversion**: RGB → YCbCr
   ```typescript
   Y = 0.299 * R + 0.587 * G + 0.114 * B
   Cb = 128 - 0.168736 * R - 0.331264 * G + 0.5 * B
   Cr = 128 + 0.5 * R - 0.418688 * G - 0.081312 * B
   ```

2. **Block Processing**: Image divided into 8x8 blocks

3. **DCT Transform**: Each block transformed to frequency domain

4. **Quantization**: Based on quality factor:
   - Quality ≥ 0.95: Minimal quantization (matrix values 4-16)
   - Quality ≥ 0.85: Light quantization (matrix values 8-24)
   - Quality ≥ 0.75: Moderate quantization (matrix values 12-32)
   - Quality < 0.75: Strategy-based quantization with multiplier

5. **Frequency Masking**: 
   - At high quality (≥ 0.95): Keep ALL 64 coefficients
   - At lower quality: Apply device-specific frequency mask

6. **Channel Selection**:
   - At quality ≥ 0.8: Process all channels
   - At lower quality: Skip channels with weight < 0.001

7. **Storage**: Only non-zero coefficients stored

### 1.3 Size Calculation

- Quality ≥ 0.95: Size ≈ 90% of original
- Quality ≥ 0.85: Size ≈ 65% of original  
- Quality ≥ 0.75: Size ≈ 40% of original
- Quality < 0.75: Actual coefficient-based calculation

## 2. Decompression Process

### 2.1 Steps

1. **Retrieve Quantization Matrix**: Same matrix used for compression based on quality
2. **For each block**:
   - Inverse zigzag ordering
   - Dequantization
   - Inverse DCT
   - Add 128 to center values back
3. **Color Space Conversion**: YCbCr → RGB
   ```typescript
   R = Y + 1.402 * (Cr - 128)
   G = Y - 0.344136 * (Cb - 128) - 0.714136 * (Cr - 128)
   B = Y + 1.772 * (Cb - 128)
   ```

## 3. Reconstruction from Multiple Devices

### 3.1 Current Implementation (Quality-Weighted RGB Averaging)

```typescript
// Decompress all images
const decompressedImages = compressedVersions.map(compressed => 
  decompressImage(compressed)
);

// Use quality-based weighting
const weights = compressedVersions.map(v => v.qualityFactor);
const totalWeight = weights.reduce((sum, w) => sum + w, 0);

// Weighted average in RGB space
for (let i = 0; i < imageData.length; i += 4) {
  let r = 0, g = 0, b = 0;
  
  decompressedImages.forEach((img, idx) => {
    const weight = weights[idx];
    r += img.data[i] * weight;
    g += img.data[i + 1] * weight;
    b += img.data[i + 2] * weight;
  });
  
  imageData[i] = Math.round(r / totalWeight);
  imageData[i + 1] = Math.round(g / totalWeight);
  imageData[i + 2] = Math.round(b / totalWeight);
  imageData[i + 3] = 255;
}
```

### 3.2 Why Reconstruction Can Be Worse Than Best Device

The current implementation has a fundamental flaw: **weighted averaging can reduce quality even when one device has perfect information**.

Example scenario:
- Device 0: Quality 1.0, pixel value = 255 (correct)
- Device 1: Quality 0.73, pixel value = 240 (lossy)
- Device 2: Quality 1.0, pixel value = 255 (correct)

Current reconstruction:
```
weight_sum = 1.0 + 0.73 + 1.0 = 2.73
reconstructed = (255*1.0 + 240*0.73 + 255*1.0) / 2.73
             = (255 + 175.2 + 255) / 2.73
             = 251
```

The reconstructed value (251) is worse than the best devices (255)!

## 4. Problem Analysis

### 4.1 Issues with Current Approach

1. **Quality-based weighting assumes lower quality = less reliable**: But a device at 73% quality might still have perfect information for some pixels/frequencies

2. **Averaging introduces new errors**: When devices agree on a value, averaging with a slightly different value creates error

3. **Information loss**: We're not leveraging the complementary nature of device strategies

### 4.2 What Should Happen

In distributed compression, each device stores different frequency components. The reconstruction should:

1. Use each device's coefficients where it has them
2. Combine complementary information
3. Only average when multiple devices have the same coefficient

## 5. Proposed Solution

### 5.1 Frequency Domain Reconstruction

Instead of averaging decompressed images, reconstruct in frequency domain:

```typescript
function reconstructFromMultiple(compressedVersions: CompressedImage[]): ImageData {
  // For each 8x8 block position
  for (each block position) {
    // Collect all coefficients from all devices for this block
    const allCoefficients = new Map<number, number[]>(); // position -> values
    
    for (each device) {
      for (each coefficient in device's block) {
        if (coefficient is non-zero) {
          allCoefficients[position].push(coefficient);
        }
      }
    }
    
    // Reconstruct block using best available information
    for (each coefficient position) {
      if (only one device has this coefficient) {
        use that value
      } else if (multiple devices have it) {
        // Could use median, mean, or weighted average based on quality
        use median(values) // More robust than mean
      }
    }
  }
}
```

### 5.2 Advantages

1. **Leverages complementary information**: Each device's unique coefficients are preserved
2. **No quality degradation**: When devices agree, we keep the exact value
3. **True distributed compression**: Combines different frequency components from different devices

## 6. Expected Behavior

With proper reconstruction:

1. **All devices at same quality**: Reconstruction ≈ individual quality (small gain from noise reduction)
2. **Mixed quality devices**: Reconstruction ≥ best device quality
3. **Complementary strategies**: Reconstruction > best device (combining different frequencies)

## 7. Current Workaround

The quality-weighted averaging reduces but doesn't eliminate the problem. A better approach would be to:

1. Detect when devices have similar values (within threshold)
2. Use the highest quality device's value directly
3. Only average when values significantly differ

This would ensure reconstruction never degrades below the best device's quality.