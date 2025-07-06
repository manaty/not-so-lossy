import { QDCTStrategyGenerator } from './src/codecs/qdct/qdct-strategy';

// Estimate compression based on quantization matrix values
function estimateCompressionRatio(level: number): number {
  const strategy = QDCTStrategyGenerator.generateStrategy('DEVICE-001');
  const baseMatrix = QDCTStrategyGenerator.getStandardMatrix();
  const matrix = QDCTStrategyGenerator.applyProgressiveQuantization(baseMatrix, strategy, level);
  
  // Calculate average quantization value
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      sum += matrix[i][j];
    }
  }
  const avgQuant = sum / 64;
  
  // Empirical formula based on average quantization
  // Compression ratio ≈ avgQuant * 0.8 (approximation)
  return avgQuant * 0.8;
}

console.log('=== QDCT Compression Model ===\n');
console.log('Based on quantization matrix analysis:\n');

console.log('Level | Avg Quant | Est. Ratio');
console.log('------|-----------|------------');

const levels = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 100, 120, 150];
const dataPoints: Array<{level: number, ratio: number}> = [];

for (const level of levels) {
  const ratio = estimateCompressionRatio(level);
  dataPoints.push({level, ratio});
  
  const strategy = QDCTStrategyGenerator.generateStrategy('DEVICE-001');
  const baseMatrix = QDCTStrategyGenerator.getStandardMatrix();
  const matrix = QDCTStrategyGenerator.applyProgressiveQuantization(baseMatrix, strategy, level);
  
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      sum += matrix[i][j];
    }
  }
  const avgQuant = sum / 64;
  
  console.log(`${level.toString().padStart(5)} | ${avgQuant.toFixed(1).padStart(9)} | ${ratio.toFixed(1).padStart(10)}:1`);
}

console.log('\n=== Predictive Model ===\n');

// Analyze the relationship
console.log('For target compression ratio R and target size S (KB):');
console.log('1. Calculate required ratio: R = original_size / S');
console.log('2. Estimate compression level:');
console.log('   - For R < 5:    Level ≈ 1.25 * (R - 1)');
console.log('   - For 5 <= R < 15: Level ≈ 2.0 * (R - 1)');  
console.log('   - For R >= 15:  Level ≈ 1.5 * (R - 1) + 10');

console.log('\n=== Examples ===\n');

const originalSizeKB = 1000; // 1 MB example
const targetSizes = [500, 200, 100, 50, 20, 10, 5, 1];

console.log(`Original size: ${originalSizeKB} KB\n`);
console.log('Target | Ratio | Est. Level');
console.log('-------|-------|------------');

for (const targetKB of targetSizes) {
  const ratio = originalSizeKB / targetKB;
  let level: number;
  
  if (ratio < 5) {
    level = 1.25 * (ratio - 1);
  } else if (ratio < 15) {
    level = 2.0 * (ratio - 1);
  } else {
    level = 1.5 * (ratio - 1) + 10;
  }
  
  console.log(`${targetKB.toString().padStart(6)} KB | ${ratio.toFixed(0).padStart(5)}:1 | ${Math.round(level).toString().padStart(10)}`);
}

console.log('\n=== Implementation Notes ===\n');
console.log('1. These are estimates - actual compression depends on image content');
console.log('2. For precise control, use binary search between compression levels');
console.log('3. Minimum practical size is ~1KB due to header overhead');
console.log('4. Levels above 64 apply multiple rounds of increments');