# Deterministic Compression Based on Device ID

## Core Concept

Each user agent (device) has a unique identifier (e.g., MAC address) that deterministically controls which information is preserved or discarded during compression. This ensures:

1. **Perfect Reconstruction Knowledge**: Given a device ID, we know exactly what information was preserved
2. **No Metadata Overhead**: The compression strategy is implicit in the device ID
3. **Consistent Behavior**: Same device always compresses the same way
4. **Optimal Distribution**: Strategies can be designed to minimize overlap

## Deterministic Mapping System

### Device ID to Strategy Mapping

```typescript
interface DeterministicStrategy {
  // Derive compression parameters from device ID
  deviceId: string; // e.g., MAC address "A1:B2:C3:D4:E5:F6"
  
  // Hash device ID to determine strategy parameters
  strategyHash: string; // SHA-256(deviceId)
  
  // Deterministic parameters derived from hash
  frequencyMask: BitMask;      // Which DCT coefficients to preserve
  quantizationSeed: number;    // Seed for quantization matrix generation
  channelPriority: number[];   // [Y, Cb, Cr] priority weights
  spatialPattern: number;      // Spatial preservation pattern
}
```

### Strategy Generation Algorithm

```typescript
function generateCompressionStrategy(deviceId: string): CompressionStrategy {
  // Create deterministic hash from device ID
  const hash = sha256(deviceId);
  const hashBytes = hexToBytes(hash);
  
  // 1. Frequency preservation pattern (which DCT coefficients to keep)
  const frequencyMask = generateFrequencyMask(hashBytes.slice(0, 8));
  
  // 2. Quantization matrix generation
  const quantSeed = bytesToInt(hashBytes.slice(8, 12));
  const quantMatrix = generateQuantizationMatrix(quantSeed);
  
  // 3. Channel priorities (Y, Cb, Cr)
  const channelWeights = [
    hashBytes[12] / 255,  // Y weight
    hashBytes[13] / 255,  // Cb weight
    hashBytes[14] / 255   // Cr weight
  ];
  
  // 4. Spatial pattern
  const spatialPattern = hashBytes[15] % 4; // 0-3 for different patterns
  
  return {
    frequencyMask,
    quantMatrix,
    channelWeights,
    spatialPattern
  };
}
```

## Frequency Mask Generation

### Deterministic Coefficient Selection

```typescript
function generateFrequencyMask(seedBytes: Uint8Array): boolean[] {
  const mask = new Array(64).fill(false);
  
  // Always preserve DC coefficient
  mask[0] = true;
  
  // Use seed to deterministically select coefficients
  const rng = new SeededRandom(seedBytes);
  
  // Preserve approximately 30-40% of coefficients
  const preserveCount = 20 + (seedBytes[0] % 10);
  
  // Bias towards low frequencies
  for (let i = 0; i < preserveCount; i++) {
    const pos = Math.floor(rng.next() * 64);
    // Weight selection towards lower frequencies
    const weightedPos = Math.floor(pos * pos / 64);
    mask[weightedPos] = true;
  }
  
  return mask;
}
```

## Quantization Matrix Generation

### Deterministic Matrix Creation

```typescript
function generateQuantizationMatrix(seed: number): number[][] {
  const matrix = Array(8).fill(0).map(() => Array(8).fill(0));
  const rng = new SeededRandom(seed);
  
  // Base quantization values
  const baseQuant = [
    [16, 11, 10, 16, 24, 40, 51, 61],
    [12, 12, 14, 19, 26, 58, 60, 55],
    [14, 13, 16, 24, 40, 57, 69, 56],
    [14, 17, 22, 29, 51, 87, 80, 62],
    [18, 22, 37, 56, 68, 109, 103, 77],
    [24, 35, 55, 64, 81, 104, 113, 92],
    [49, 64, 78, 87, 103, 121, 120, 101],
    [72, 92, 95, 98, 112, 100, 103, 99]
  ];
  
  // Apply deterministic variations
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      // Vary by ±30% based on seed
      const variation = 0.7 + (rng.next() * 0.6);
      matrix[i][j] = Math.round(baseQuant[i][j] * variation);
    }
  }
  
  return matrix;
}
```

## Reconstruction Process

### Known Information Recovery

```typescript
interface CompressedImageWithSource {
  deviceId: string;
  compressedData: Uint8Array;
}

function reconstructImage(sources: CompressedImageWithSource[]): ImageData {
  const strategies = sources.map(s => ({
    strategy: generateCompressionStrategy(s.deviceId),
    data: s.compressedData
  }));
  
  // For each 8x8 block
  for (const blockPos of imageBlocks) {
    const blockData = new Array(64).fill(0);
    const weights = new Array(64).fill(0);
    
    // Collect known coefficients from each source
    for (const {strategy, data} of strategies) {
      const sourceDCT = extractDCTBlock(data, blockPos);
      
      // Only use coefficients this device preserved
      for (let i = 0; i < 64; i++) {
        if (strategy.frequencyMask[i]) {
          blockData[i] += sourceDCT[i];
          weights[i] += 1;
        }
      }
    }
    
    // Average where we have multiple sources
    for (let i = 0; i < 64; i++) {
      if (weights[i] > 0) {
        blockData[i] /= weights[i];
      } else {
        // Interpolate missing coefficients
        blockData[i] = interpolateCoefficient(blockData, i);
      }
    }
    
    // Inverse DCT to get spatial domain
    const spatialBlock = inverseDCT(blockData);
    reconstructed.setBlock(blockPos, spatialBlock);
  }
  
  return reconstructed;
}
```

## Strategy Distribution Design

### Ensuring Optimal Coverage

```typescript
class StrategyDistributor {
  // Analyze strategy overlap for a set of device IDs
  analyzeOverlap(deviceIds: string[]): OverlapReport {
    const strategies = deviceIds.map(id => generateCompressionStrategy(id));
    
    // Count frequency coverage
    const frequencyCoverage = new Array(64).fill(0);
    for (const strategy of strategies) {
      for (let i = 0; i < 64; i++) {
        if (strategy.frequencyMask[i]) {
          frequencyCoverage[i]++;
        }
      }
    }
    
    return {
      avgCoverage: frequencyCoverage.reduce((a, b) => a + b) / 64,
      minCoverage: Math.min(...frequencyCoverage),
      maxCoverage: Math.max(...frequencyCoverage),
      uncovered: frequencyCoverage.filter(c => c === 0).length
    };
  }
}
```

## Implementation Benefits

1. **Zero Coordination**: Devices don't need to communicate about strategies
2. **Scalable**: Works with any number of devices
3. **Verifiable**: Can prove what information each device preserved
4. **Efficient**: No strategy negotiation or metadata storage
5. **Predictable**: Recovery quality improves predictably with more sources

## Example Device ID Mappings

```typescript
// Example: MAC addresses to strategies
const examples = {
  "A1:B2:C3:D4:E5:F6": "Low frequency specialist",
  "B2:C3:D4:E5:F6:A1": "High frequency specialist",
  "C3:D4:E5:F6:A1:B2": "Color channel specialist",
  "D4:E5:F6:A1:B2:C3": "Balanced generalist"
};
```

## Security Considerations

1. **Privacy**: Device IDs should be hashed before transmission
2. **Spoofing**: Consider signed device attestation
3. **Collision**: Handle rare strategy collisions gracefully