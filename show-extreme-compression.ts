import { QDCTStrategyGenerator } from './src/codecs/qdct/qdct-strategy';

// Show what happens at extreme compression levels
function showExtremeCompression() {
  const deviceId = 'DEVICE-001';
  const strategy = QDCTStrategyGenerator.generateStrategy(deviceId);
  const baseMatrix = QDCTStrategyGenerator.getStandardMatrix();
  
  console.log('=== QDCT Extreme Compression Levels ===\n');
  
  // Test various levels
  const levels = [0, 32, 64, 96, 128, 200];
  
  for (const level of levels) {
    const matrix = QDCTStrategyGenerator.applyProgressiveQuantization(baseMatrix, strategy, level);
    
    // Calculate average and max quantization values
    let sum = 0;
    let max = 0;
    let min = Infinity;
    
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const val = matrix[i][j];
        sum += val;
        max = Math.max(max, val);
        min = Math.min(min, val);
      }
    }
    
    const avg = sum / 64;
    
    console.log(`Level ${level}:`);
    console.log(`  Average quantization: ${avg.toFixed(1)}`);
    console.log(`  Min quantization: ${min}`);
    console.log(`  Max quantization: ${max}`);
    console.log(`  Rounds completed: ${Math.floor(level / 64)}`);
    
    // Show a sample of the matrix (first row)
    console.log(`  First row: [${matrix[0].join(', ')}]`);
    console.log();
  }
  
  // Show the increment matrix for reference
  console.log('Increment matrix (for reference):');
  const incrementMatrix = QDCTStrategyGenerator.getIncrementMatrix();
  console.log('Average increment per round:', 
    incrementMatrix.flat().reduce((a, b) => a + b, 0) / 64
  );
  console.log('Min increment:', Math.min(...incrementMatrix.flat()));
  console.log('Max increment:', Math.max(...incrementMatrix.flat()));
}

showExtremeCompression();