import * as fs from 'fs';
import { QDCTStrategyGenerator } from './src/codecs/qdct/qdct-strategy';

// Generate data for scientific article graphs
function generateGraphData() {
  const csvDir = 'compression-analysis-data';
  if (!fs.existsSync(csvDir)) {
    fs.mkdirSync(csvDir);
  }

  // 1. Quantization Matrix Evolution
  console.log('Generating quantization matrix evolution data...');
  
  let quantMatrixEvolution = 'level,position,row,col,value,increment\n';
  const strategy = QDCTStrategyGenerator.generateStrategy('DEVICE-001');
  const baseMatrix = QDCTStrategyGenerator.getStandardMatrix();
  const incrementMatrix = QDCTStrategyGenerator.getIncrementMatrix();
  
  const evolutionLevels = [0, 1, 5, 10, 20, 30, 40, 50, 64, 80, 100];
  
  evolutionLevels.forEach(level => {
    const matrix = QDCTStrategyGenerator.applyProgressiveQuantization(baseMatrix, strategy, level);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const position = row * 8 + col;
        quantMatrixEvolution += `${level},${position},${row},${col},${matrix[row][col]},${incrementMatrix[row][col]}\n`;
      }
    }
  });
  
  fs.writeFileSync(`${csvDir}/quantization_matrix_evolution.csv`, quantMatrixEvolution);

  // 2. Compression Level vs Average Quantization
  console.log('Generating compression level analysis...');
  
  let compressionAnalysis = 'level,avg_quantization,min_quantization,max_quantization,std_deviation\n';
  
  for (let level = 0; level <= 200; level += 5) {
    const matrix = QDCTStrategyGenerator.applyProgressiveQuantization(baseMatrix, strategy, level);
    
    let sum = 0, min = Infinity, max = 0;
    const values: number[] = [];
    
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const val = matrix[i][j];
        sum += val;
        min = Math.min(min, val);
        max = Math.max(max, val);
        values.push(val);
      }
    }
    
    const avg = sum / 64;
    const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / 64;
    const stdDev = Math.sqrt(variance);
    
    compressionAnalysis += `${level},${avg.toFixed(2)},${min},${max},${stdDev.toFixed(2)}\n`;
  }
  
  fs.writeFileSync(`${csvDir}/compression_level_analysis.csv`, compressionAnalysis);

  // 3. Device Comparison (3 different devices)
  console.log('Generating device comparison data...');
  
  let deviceComparison = 'device,level,coefficient_index,quantization_value\n';
  const devices = ['DEVICE-001', 'DEVICE-002', 'DEVICE-003'];
  
  devices.forEach(deviceId => {
    const devStrategy = QDCTStrategyGenerator.generateStrategy(deviceId);
    const testLevels = [0, 10, 20, 30, 40, 50];
    
    testLevels.forEach(level => {
      const matrix = QDCTStrategyGenerator.applyProgressiveQuantization(baseMatrix, devStrategy, level);
      
      // Record the first 20 coefficient positions for this device
      for (let i = 0; i < Math.min(20, level); i++) {
        const coeffIdx = devStrategy.quantizationOrder[i];
        const row = Math.floor(coeffIdx / 8);
        const col = coeffIdx % 8;
        deviceComparison += `${deviceId},${level},${coeffIdx},${matrix[row][col]}\n`;
      }
    });
  });
  
  fs.writeFileSync(`${csvDir}/device_comparison.csv`, deviceComparison);

  // 4. Theoretical Compression Ratio Model
  console.log('Generating theoretical compression model...');
  
  let modelData = 'level,theoretical_ratio,avg_quantization\n';
  
  for (let level = 0; level <= 150; level += 2) {
    const matrix = QDCTStrategyGenerator.applyProgressiveQuantization(baseMatrix, strategy, level);
    
    let sum = 0;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        sum += matrix[i][j];
      }
    }
    const avgQuant = sum / 64;
    
    // Theoretical compression ratio based on average quantization
    // This is a simplified model: ratio ≈ 0.8 * avgQuant
    const theoreticalRatio = 0.8 * avgQuant;
    
    modelData += `${level},${theoreticalRatio.toFixed(2)},${avgQuant.toFixed(2)}\n`;
  }
  
  fs.writeFileSync(`${csvDir}/theoretical_model.csv`, modelData);

  // 5. Coefficient Selection Order Visualization
  console.log('Generating coefficient selection order...');
  
  let selectionOrder = 'device,order_index,coefficient_position,row,col,frequency_band\n';
  
  devices.forEach(deviceId => {
    const devStrategy = QDCTStrategyGenerator.generateStrategy(deviceId);
    
    for (let i = 0; i < 64; i++) {
      const coeffIdx = devStrategy.quantizationOrder[i];
      const row = Math.floor(coeffIdx / 8);
      const col = coeffIdx % 8;
      
      // Classify frequency band (low, mid, high)
      const distance = row + col;
      let band: string;
      if (distance <= 3) band = 'low';
      else if (distance <= 8) band = 'mid';
      else band = 'high';
      
      selectionOrder += `${deviceId},${i},${coeffIdx},${row},${col},${band}\n`;
    }
  });
  
  fs.writeFileSync(`${csvDir}/coefficient_selection_order.csv`, selectionOrder);

  console.log(`\nAll graph data saved to ${csvDir}/`);
  console.log('\nGenerated files:');
  console.log('- quantization_matrix_evolution.csv: Shows how matrix values change with compression level');
  console.log('- compression_level_analysis.csv: Statistical analysis of quantization values by level');
  console.log('- device_comparison.csv: Compares compression patterns across different devices');
  console.log('- theoretical_model.csv: Theoretical compression ratio predictions');
  console.log('- coefficient_selection_order.csv: Order of coefficient selection for each device');
}

generateGraphData();