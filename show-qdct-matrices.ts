import { QDCTCodec } from './src/codecs/qdct/qdct-codec';
import { QDCTStrategyGenerator } from './src/codecs/qdct/qdct-strategy';

// ANSI color codes for highlighting
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';

// Helper function to format a matrix for display
function formatMatrix(matrix: number[][], highlightIndices: number[] = []): string {
  let result = '';
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const index = row * 8 + col;
      const value = matrix[row][col].toString().padStart(4);
      
      if (highlightIndices.includes(index)) {
        result += `${RED}${BOLD}${value}${RESET} `;
      } else {
        result += `${value} `;
      }
    }
    result += '\n';
  }
  
  return result;
}

// Helper function to get indices that have been modified up to a certain level
function getModifiedIndices(order: number[], level: number): number[] {
  return order.slice(0, level);
}

// Main function
function showQDCTMatrices() {
  const deviceId = 'DEVICE-001';
  
  console.log(`${CYAN}${BOLD}=== QDCT Quantization Matrix Demonstration ===${RESET}\n`);
  console.log(`Device ID: ${GREEN}${deviceId}${RESET}\n`);
  
  // Create codec instance
  const codec = new QDCTCodec();
  
  // Generate strategy for DEVICE-001
  const strategy = QDCTStrategyGenerator.generateStrategy(deviceId);
  
  // Get base quantization matrix
  const baseMatrix = QDCTStrategyGenerator.getStandardMatrix();
  
  console.log(`${YELLOW}${BOLD}1. Base Quantization Matrix (Level 0)${RESET}`);
  console.log('This is the starting matrix before any progressive increases:\n');
  console.log(formatMatrix(baseMatrix));
  
  console.log(`${YELLOW}${BOLD}2. Quantization Order for ${deviceId}${RESET}`);
  console.log('The order in which coefficients will be increased (10% each):\n');
  
  // Display the order in a grid format
  console.log('Coefficient indices (0-63):');
  for (let row = 0; row < 8; row++) {
    let line = '';
    for (let col = 0; col < 8; col++) {
      const index = row * 8 + col;
      line += index.toString().padStart(4) + ' ';
    }
    console.log(line);
  }
  
  console.log('\nOrder of increase:');
  const orderStr = strategy.quantizationOrder.slice(0, 20).join(', ');
  console.log(`First 20: [${orderStr}, ...]`);
  console.log(`Increase per coefficient: ${strategy.quantizationIncrease * 100}%\n`);
  
  // Get matrix at level 1
  const matrix1 = codec.getQuantizationMatrix(deviceId, 1);
  const modified1 = getModifiedIndices(strategy.quantizationOrder, 1);
  
  console.log(`${YELLOW}${BOLD}3. Quantization Matrix at Level 1${RESET}`);
  console.log(`One coefficient increased (index ${strategy.quantizationOrder[0]}):\n`);
  console.log(formatMatrix(matrix1, modified1));
  
  // Show the specific change
  const idx1 = strategy.quantizationOrder[0];
  const row1 = Math.floor(idx1 / 8);
  const col1 = idx1 % 8;
  console.log(`Changed: Position [${row1},${col1}] (index ${idx1})`);
  console.log(`  Base value: ${baseMatrix[row1][col1]}`);
  console.log(`  New value: ${matrix1[row1][col1]} (${baseMatrix[row1][col1]} × 1.1 = ${(baseMatrix[row1][col1] * 1.1).toFixed(1)} → ${matrix1[row1][col1]})\n`);
  
  // Get matrix at level 20
  const matrix20 = codec.getQuantizationMatrix(deviceId, 20);
  const modified20 = getModifiedIndices(strategy.quantizationOrder, 20);
  
  console.log(`${YELLOW}${BOLD}4. Quantization Matrix at Level 20${RESET}`);
  console.log('Twenty coefficients increased (highlighted in red):\n');
  console.log(formatMatrix(matrix20, modified20));
  
  // Show summary of changes
  console.log(`${YELLOW}${BOLD}5. Summary of Changes at Level 20${RESET}\n`);
  
  console.log('Modified positions and values:');
  for (let i = 0; i < 20; i++) {
    const idx = strategy.quantizationOrder[i];
    const row = Math.floor(idx / 8);
    const col = idx % 8;
    const baseVal = baseMatrix[row][col];
    const newVal = matrix20[row][col];
    const expectedVal = baseVal * 1.1;
    const roundedVal = Math.round(expectedVal);
    const changed = newVal !== baseVal;
    
    if (changed) {
      console.log(`  Level ${i + 1}: [${row},${col}] (index ${idx.toString().padStart(2)}): ${baseVal.toString().padStart(2)} → ${newVal.toString().padStart(2)} (${baseVal} × 1.1 = ${expectedVal.toFixed(1)})`);
    } else {
      console.log(`  Level ${i + 1}: [${row},${col}] (index ${idx.toString().padStart(2)}): ${baseVal.toString().padStart(2)} → ${newVal.toString().padStart(2)} (no change: ${baseVal} × 1.1 = ${expectedVal.toFixed(1)} rounds to ${roundedVal})`);
    }
  }
  
  // Calculate average increase
  let totalIncrease = 0;
  let count = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const increase = ((matrix20[row][col] - baseMatrix[row][col]) / baseMatrix[row][col]) * 100;
      if (increase > 0) {
        totalIncrease += increase;
        count++;
      }
    }
  }
  
  console.log(`\nAverage increase for modified coefficients: ${(totalIncrease / count).toFixed(1)}%`);
  console.log(`Total coefficients modified: ${count} out of 64`);
  
  // Show how the compression level affects quality
  console.log(`\n${CYAN}${BOLD}=== Compression Level Impact ===${RESET}\n`);
  console.log('As compression level increases:');
  console.log('- More coefficients get their quantization values increased');
  console.log('- Higher quantization values = more aggressive compression');
  console.log('- Each device has a unique order, creating device-specific artifacts');
  console.log('- The 10% increase is compounded for coefficients modified multiple times');
}

// Run the demonstration
showQDCTMatrices();