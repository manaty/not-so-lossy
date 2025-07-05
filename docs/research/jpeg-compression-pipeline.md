# JPEG Compression Pipeline - Detailed Analysis

## Overview
JPEG (Joint Photographic Experts Group) compression is a lossy compression method that reduces file size by selectively discarding image information that is less perceptible to the human eye. The pipeline consists of several distinct stages, each offering potential points for distributed compression strategies.

## Complete JPEG Compression Pipeline

### 1. Color Space Conversion (RGB → YCbCr)

The first step converts from RGB color space to YCbCr (luminance and chrominance):

```
Y  = 0.299R + 0.587G + 0.114B     (Luminance)
Cb = 0.564(B - Y)                 (Chrominance Blue)
Cr = 0.713(R - Y)                 (Chrominance Red)
```

**Key Insights for Distribution:**
- Y channel contains brightness information (most important for human perception)
- Cb/Cr channels contain color information (less critical for recognition)
- Different devices could prioritize different channels

### 2. Chroma Subsampling

Human eyes are less sensitive to color resolution than brightness. Common subsampling ratios:
- **4:4:4** - No subsampling (full resolution for all channels)
- **4:2:2** - Horizontal subsampling of chroma (Cb/Cr halved horizontally)
- **4:2:0** - Both horizontal and vertical subsampling (Cb/Cr quartered)

**Distribution Strategy Opportunity:**
Different devices could use different subsampling ratios, preserving color detail differently.

### 3. Block Splitting

The image is divided into 8×8 pixel blocks. Each block is processed independently:
- Y channel: One 8×8 block per 8×8 pixels
- Cb/Cr channels: Depends on subsampling (may be 8×8 for 16×16 pixels with 4:2:0)

### 4. Discrete Cosine Transform (DCT)

Each 8×8 block undergoes 2D DCT transformation:

```
F(u,v) = (1/4)C(u)C(v) ΣΣ f(x,y) cos[(2x+1)uπ/16] cos[(2y+1)vπ/16]
```

Where:
- f(x,y) is the pixel value at position (x,y)
- F(u,v) is the DCT coefficient at frequency (u,v)
- C(u) = 1/√2 for u=0, otherwise C(u) = 1

**Frequency Components:**
- **F(0,0)**: DC coefficient (average brightness)
- **Low frequencies** (near top-left): General shapes and gradients
- **High frequencies** (bottom-right): Fine details and edges

**Critical for Distribution:**
Different devices can preserve different frequency ranges:
- Device A: Low frequencies (0-2 range)
- Device B: Mid frequencies (3-5 range)
- Device C: High frequencies (6-7 range)

### 5. Quantization

This is where most compression occurs. DCT coefficients are divided by a quantization matrix and rounded:

```
Quantized(u,v) = round(F(u,v) / Q(u,v))
```

Standard luminance quantization matrix (quality ~50):
```
16  11  10  16  24  40  51  61
12  12  14  19  26  58  60  55
14  13  16  24  40  57  69  56
14  17  22  29  51  87  80  62
18  22  37  56  68 109 103  77
24  35  55  64  81 104 113  92
49  64  78  87 103 121 120 101
72  92  95  98 112 100 103  99
```

**Distribution Opportunities:**
- Different devices use different quantization matrices
- Some preserve low frequencies better (smaller values in top-left)
- Others preserve high frequencies (smaller values in bottom-right)
- Quality factor can vary per device

### 6. Entropy Coding

The quantized coefficients are encoded using:

1. **Zig-zag scanning**: Reorders 8×8 block into 1D array (grouping similar frequencies)
2. **Run-Length Encoding (RLE)**: Encodes runs of zeros
3. **Huffman coding**: Variable-length codes for different values

**Distribution Note:** This stage is lossless, so less relevant for our distributed approach.

## Decompression Pipeline

The process reverses:
1. Entropy decoding
2. Dequantization: `F'(u,v) = Quantized(u,v) × Q(u,v)`
3. Inverse DCT
4. Block assembly
5. Chroma upsampling
6. Color space conversion (YCbCr → RGB)

## Key Distribution Points

### 1. **Frequency-Based Distribution**
```
Device 1: Preserves DC + first 3 AC coefficients
Device 2: Preserves AC coefficients 4-15
Device 3: Preserves AC coefficients 16-63
```

### 2. **Channel-Based Distribution**
```
Device 1: High quality Y, low quality Cb/Cr
Device 2: Medium quality Y, high quality Cb
Device 3: Medium quality Y, high quality Cr
```

### 3. **Quantization-Based Distribution**
```
Device 1: Fine quantization for low frequencies
Device 2: Fine quantization for mid frequencies
Device 3: Fine quantization for high frequencies
```

### 4. **Spatial Distribution**
```
Device 1: Higher quality for image center
Device 2: Higher quality for edges
Device 3: Uniform medium quality
```

## Mathematical Foundation for Recovery

Given N devices with different compression strategies, reconstruction can use:

1. **Frequency Domain Averaging**:
   ```
   F_recovered(u,v) = Σ(w_i × F_i(u,v)) / Σw_i
   ```
   Where w_i is the confidence weight for device i at frequency (u,v)

2. **Quality-Weighted Reconstruction**:
   ```
   Pixel_recovered = Σ(q_i × Pixel_i) / Σq_i
   ```
   Where q_i is the quality score for device i

3. **Missing Data Interpolation**:
   For frequencies preserved by only some devices, use interpolation or learned priors

## Implementation Considerations

1. **Metadata Requirements**:
   - Each compressed version needs metadata about its strategy
   - Quantization matrices used
   - Subsampling ratios
   - Quality factors

2. **Alignment**:
   - All versions must maintain same block boundaries
   - Consistent color space conversions

3. **Optimization Targets**:
   - Minimize overlap between devices (maximize information diversity)
   - Ensure critical information (DC coefficients) has redundancy
   - Balance file sizes across devices

## Next Steps

1. Implement basic JPEG encoder/decoder in TypeScript
2. Create configurable compression strategies
3. Develop recovery algorithm
4. Build demonstration with visual comparisons