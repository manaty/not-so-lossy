# QDCT Empirical Compression Model

## Summary

Based on analysis of the QDCT codec with increment-based progressive quantization, we've established the following empirical model for predicting compression levels needed to achieve target file sizes.

## Key Findings

### 1. Quantization Progression
- **Level 0**: All quantization values = 1 (no compression)
- **Level 1-63**: First round - each coefficient incremented once based on device-specific order
- **Level 64+**: Multiple rounds of increments, capped at 255 per coefficient

### 2. Compression Ratio Formula

For a target compression ratio **R** (original_size / target_size):

```
If R < 5:     Level ≈ 1.25 × (R - 1)
If 5 ≤ R < 15: Level ≈ 2.0 × (R - 1)  
If R ≥ 15:    Level ≈ 1.5 × (R - 1) + 10
```

### 3. Average Quantization vs Compression Ratio

The relationship between average quantization value and compression ratio follows approximately:

```
Compression Ratio ≈ 0.8 × Average_Quantization_Value
```

### 4. Practical Examples

For a 1MB (1024 KB) image:

| Target Size | Compression Ratio | Estimated Level |
|------------|------------------|-----------------|
| 512 KB     | 2:1              | 1               |
| 256 KB     | 4:1              | 4               |
| 128 KB     | 8:1              | 14              |
| 64 KB      | 16:1             | 33              |
| 32 KB      | 32:1             | 57              |
| 16 KB      | 64:1             | 105             |
| 8 KB       | 128:1            | 201             |
| 1 KB       | 1024:1           | 1545            |

### 5. Implementation Strategy

1. **Initial Estimate**: Use the formulas above to get a starting compression level
2. **Binary Search**: Refine the level using binary search with tolerance of ±10%
3. **Quality Mapping**: Convert level to quality parameter:
   - Levels 0-63: `quality = 1 - (level / 63)`
   - Levels > 63: Use quality = 0.1 and rely on codec's multi-round handling

### 6. Device-Specific Patterns

Each device follows a unique pseudo-random order for incrementing coefficients:
- Low-frequency coefficients (top-left) have smaller increments (3-8)
- High-frequency coefficients (bottom-right) have larger increments (10-24)
- This creates device-specific compression artifacts while maintaining overall quality

## Usage in Code

```typescript
function estimateCompressionLevel(originalSizeBytes: number, targetSizeBytes: number): number {
  const ratio = originalSizeBytes / targetSizeBytes;
  
  if (ratio < 5) {
    return 1.25 * (ratio - 1);
  } else if (ratio < 15) {
    return 2.0 * (ratio - 1);
  } else {
    return 1.5 * (ratio - 1) + 10;
  }
}
```

## Limitations

1. Actual compression depends on image content complexity
2. Minimum practical size is ~1KB due to metadata overhead
3. Very high compression levels (>200) may produce visible artifacts
4. The model is most accurate for photographic images

## Data Files

The following CSV files contain detailed data for creating graphs:
- `quantization_matrix_evolution.csv`: Matrix values at different compression levels
- `compression_level_analysis.csv`: Statistical analysis by level
- `device_comparison.csv`: Cross-device compression patterns
- `theoretical_model.csv`: Model predictions
- `coefficient_selection_order.csv`: Device-specific selection patterns