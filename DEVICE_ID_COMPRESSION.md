# How Device ID Determines Information Discarding in Compression

## Overview

Each device uses its unique ID to deterministically generate a compression strategy that selectively discards different parts of the image information. This ensures that when multiple devices compress the same image, they preserve complementary information that can be combined during reconstruction.

## Step-by-Step Process

### 1. Device ID to Hash

```typescript
const hash = CryptoJS.SHA256(deviceId).toString();
```

Example:
- `DEVICE-000` → SHA256 → `2e7d2c03a9507ae265ecf5b5356885a5...`
- `DEVICE-001` → SHA256 → `4355a46b19d348dc2f57c046f8ef63d4...`
- `DEVICE-002` → SHA256 → `53c234e5e8472b6ac51c1ae1cab3fe06...`

### 2. Hash Determines Three Key Components

The 256-bit hash is divided into sections that control different aspects:

```
Hash bytes: [0-7] [8-11] [12-14] [15] [16-31]
Used for:   Freq  Quant  Channel Spatial (unused)
            Mask  Matrix Weights Pattern
```

## Information Discarding Mechanisms

### A. Frequency Mask (Bytes 0-7)

**What it does**: Determines which DCT coefficients to keep or discard

```typescript
// generateFrequencyMask logic:
1. Always keeps DC coefficient (position 0)
2. Keeps 16-26 coefficients total (25-40% of 64)
3. Biased towards low frequencies (using squared random values)
```

**Example for different devices**:
```
DEVICE-000 might keep: [0,1,2,5,8,9,10,13,16,17,18,21,24,25,26,29,32,33,34,37,40,41,42]
DEVICE-001 might keep: [0,1,3,4,6,7,11,12,14,15,19,20,22,23,27,28,30,31,35,36]
DEVICE-002 might keep: [0,2,3,5,6,8,9,11,12,16,17,19,20,24,25,27,28,32,33,35,36,40]
```

**Visual representation** (X = kept, . = discarded):
```
DEVICE-000:          DEVICE-001:          DEVICE-002:
X X X . . X . .      X X . X X . X X      X . X X . X X .
X X X . . X . .      . . . X X . . X      . X X . X X . X
X X X . . X . .      X X . X X . X X      X X . X X . . X
. . . . . X . .      X X . X X . . X      X X . X X . . X
X X X . . X . .      . . . X X . . X      X X . X X . . X
X X X . . . . .      X X . X X . . X      X X . X X . . .
X X X . . . . .      X X . X X . . .      X X . . . . . .
. . . . . . . .      . . . . . . . .      . . . . . . . .
```

### B. Channel Weights (Bytes 12-14)

**What it does**: Determines priority for Y (luminance), Cb (blue chroma), Cr (red chroma)

```typescript
// Example weights after normalization:
DEVICE-000: { y: 0.063, cb: 0.339, cr: 0.598 }  // Focuses on color
DEVICE-001: { y: 0.455, cb: 0.316, cr: 0.229 }  // Focuses on luminance
DEVICE-002: { y: 0.086, cb: 0.167, cr: 0.747 }  // Focuses on red channel
```

**Impact on compression**:
- Low weight (< 0.001) → Channel completely skipped at low quality
- High weight → Channel gets more bits/precision

### C. Quantization Matrix (Bytes 8-11)

**What it does**: Controls how aggressively each frequency is quantized

```typescript
// Each device varies the standard JPEG matrix by ±40%
DEVICE-000: Might multiply base values by 0.6-1.4
DEVICE-001: Different random variations
DEVICE-002: Yet another set of variations
```

**Example quantization values for DC coefficient**:
- Base JPEG: 16
- DEVICE-000: 22 (more aggressive)
- DEVICE-001: 12 (less aggressive)
- DEVICE-002: 15 (moderate)

## Information Loss at Different Quality Levels

### Quality 1.0 (Minimal Loss)
- All 64 coefficients kept (ignores frequency mask)
- All channels processed (ignores channel weights)
- Minimal quantization (4-16 values)

### Quality 0.8 (Moderate Loss)
- Device-specific frequency mask applied (~20-23 coefficients kept)
- All channels still processed
- Moderate quantization (12-32 values)

### Quality 0.5 (High Loss)
- Strict frequency mask (~20-23 coefficients)
- Channels with weight < 0.001 skipped
- Aggressive quantization (strategy-based with multipliers)

## Example: Compressing a White Circle on Black Background

### DEVICE-000 (Color-focused)
- Keeps fewer luminance coefficients
- Preserves color information well
- Edge might be less sharp
- Color accuracy maintained

### DEVICE-001 (Luminance-focused)
- Keeps more luminance coefficients
- Edge definition preserved
- Might lose some color nuance
- Better contrast preservation

### DEVICE-002 (Red-channel focused)
- For grayscale image, less effective
- Would excel with red-heavy images
- Unique frequency pattern captures different details

## Why This Design Enables Distributed Compression

1. **Complementary Information**: Each device keeps different frequency coefficients
2. **No Redundancy**: Devices don't duplicate exact same information
3. **Reconstruction Benefit**: Missing coefficients from one device may be present in another
4. **Deterministic**: Same device always produces same strategy for reproducibility

## Mathematical Example

For a single 8x8 block after DCT:

```
Original coefficients (simplified):
[1000, 200, 100, 50, 25, 10, 5, 2, ...]

DEVICE-000 keeps positions [0,1,2,5]:
[1000, 200, 100, 0, 0, 10, 0, 0, ...]

DEVICE-001 keeps positions [0,1,3,4]:
[1000, 200, 0, 50, 25, 0, 0, 0, ...]

DEVICE-002 keeps positions [0,2,3,6]:
[1000, 0, 100, 50, 0, 0, 5, 0, ...]

Ideal reconstruction would combine:
[1000, 200, 100, 50, 25, 10, 5, 0, ...]
```

This shows how distributed compression can preserve more information than any single device!