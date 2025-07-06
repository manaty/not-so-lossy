import { QDCTStrategyGenerator } from './src/codecs/qdct/qdct-strategy';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

// Helper function to print matrix with highlighting
function printMatrix(matrix: number[][], modifiedIndices?: number[]): void {
  const modifiedSet = new Set(modifiedIndices || []);
  
  for (let row = 0; row < 8; row++) {
    let line = '';
    for (let col = 0; col < 8; col++) {
      const idx = row * 8 + col;
      const value = matrix[row][col].toString().padStart(4);
      
      if (modifiedSet.has(idx)) {
        line += colors.red + colors.bold + value + colors.reset;
      } else {
        line += value;
      }
      line += ' ';
    }
    console.log(line);
  }
  console.log();
}

// Main demonstration
function demonstrate() {
  const deviceId = 'DEVICE-001';
  console.log(colors.cyan + colors.bold + '=== QDCT Quantization Matrix Demonstration (Increment-based) ===' + colors.reset);
  console.log(`\nDevice ID: ${colors.green}${deviceId}${colors.reset}\n`);

  // Get strategy
  const strategy = QDCTStrategyGenerator.generateStrategy(deviceId);
  
  // Get matrices
  const baseMatrix = QDCTStrategyGenerator.getStandardMatrix();
  const incrementMatrix = QDCTStrategyGenerator.getIncrementMatrix();

  // 1. Show base matrix (all 1s)
  console.log(colors.yellow + colors.bold + '1. Base Quantization Matrix (Level 0)' + colors.reset);
  console.log('All coefficients start at 1 (no quantization):\n');
  printMatrix(baseMatrix);

  // 2. Show increment matrix
  console.log(colors.yellow + colors.bold + '2. Increment Matrix' + colors.reset);
  console.log('Values to add when a coefficient is selected for compression:\n');
  printMatrix(incrementMatrix);

  // 3. Show quantization order
  console.log(colors.yellow + colors.bold + '3. Quantization Order for DEVICE-001' + colors.reset);
  console.log('Order in which coefficients will be incremented:\n');
  console.log('First 20 positions:', strategy.quantizationOrder.slice(0, 20));
  console.log();

  // 4. Level 1 matrix
  const matrix1 = QDCTStrategyGenerator.applyProgressiveQuantization(baseMatrix, strategy, 1);
  const firstIdx = strategy.quantizationOrder[0];
  const firstRow = Math.floor(firstIdx / 8);
  const firstCol = firstIdx % 8;
  
  console.log(colors.yellow + colors.bold + '4. Quantization Matrix at Level 1' + colors.reset);
  console.log(`One coefficient incremented (index ${firstIdx}, position [${firstRow},${firstCol}]):\n`);
  printMatrix(matrix1, [firstIdx]);
  
  console.log('Change detail:');
  console.log(`  Position [${firstRow},${firstCol}] (index ${firstIdx}):`);
  console.log(`    Base value: 1`);
  console.log(`    Increment: ${incrementMatrix[firstRow][firstCol]}`);
  console.log(`    New value: ${matrix1[firstRow][firstCol]}`);
  console.log();

  // 5. Level 20 matrix
  const matrix20 = QDCTStrategyGenerator.applyProgressiveQuantization(baseMatrix, strategy, 20);
  const modifiedIndices = strategy.quantizationOrder.slice(0, 20);
  
  console.log(colors.yellow + colors.bold + '5. Quantization Matrix at Level 20' + colors.reset);
  console.log('Twenty coefficients incremented (highlighted in red):\n');
  printMatrix(matrix20, modifiedIndices);

  // Show summary of changes
  console.log(colors.yellow + colors.bold + '6. Summary of Changes at Level 20' + colors.reset);
  console.log('\nModified positions and their increments:');
  
  let totalIncrement = 0;
  for (let i = 0; i < 20; i++) {
    const idx = strategy.quantizationOrder[i];
    const row = Math.floor(idx / 8);
    const col = idx % 8;
    const increment = incrementMatrix[row][col];
    totalIncrement += increment;
    
    if (i < 10) {  // Show first 10 for brevity
      console.log(`  Level ${(i + 1).toString().padStart(2)}: [${row},${col}] (index ${idx.toString().padStart(2)}): 1 + ${increment.toString().padStart(2)} = ${matrix20[row][col].toString().padStart(2)}`);
    }
  }
  console.log('  ... (10 more modifications)');
  console.log(`\nAverage increment per modified coefficient: ${(totalIncrement / 20).toFixed(1)}`);

  // Compare with Level 40
  const matrix40 = QDCTStrategyGenerator.applyProgressiveQuantization(baseMatrix, strategy, 40);
  console.log(colors.yellow + colors.bold + '\n7. Comparison: Level 20 vs Level 40' + colors.reset);
  
  let avgQuant20 = 0, avgQuant40 = 0;
  for (let i = 0; i < 64; i++) {
    const row = Math.floor(i / 8);
    const col = i % 8;
    avgQuant20 += matrix20[row][col];
    avgQuant40 += matrix40[row][col];
  }
  avgQuant20 /= 64;
  avgQuant40 /= 64;
  
  console.log(`Average quantization value at Level 20: ${avgQuant20.toFixed(1)}`);
  console.log(`Average quantization value at Level 40: ${avgQuant40.toFixed(1)}`);
  
  console.log(colors.cyan + colors.bold + '\n=== Key Advantages of Increment-based Approach ===' + colors.reset);
  console.log('1. Level 0 truly means no compression (all quantization values = 1)');
  console.log('2. More predictable compression progression');
  console.log('3. Increment values are based on perceptual importance (higher for high-frequency coefficients)');
  console.log('4. Each device still has unique compression artifacts due to different ordering');
}

// Run the demonstration
demonstrate();