import { dct2d, idct2d, quantize, dequantize } from '../../src/codecs/dct/dct-utils';

describe('White Image Mathematical Trace', () => {
  it('should trace DCT math for white block', () => {
    console.log('=== Mathematical Trace for White Block ===\n');
    
    // Create 8x8 white block in Y channel
    const whiteY = 255;
    const centered = whiteY - 128; // = 127
    
    console.log('1. Input Y value:', whiteY);
    console.log('2. Centered for DCT:', centered);
    
    // Create 8x8 block of centered values
    const block = Array(8).fill(0).map(() => Array(8).fill(centered));
    console.log('3. 8x8 block of:', centered);
    
    // Apply DCT
    const dctBlock = dct2d(block);
    console.log('\n4. After DCT:');
    console.log('   DC coefficient [0][0]:', dctBlock[0][0]);
    console.log('   Expected DC: 127 * 8 =', 127 * 8);
    console.log('   All AC coefficients should be ~0');
    console.log('   AC sample [0][1]:', dctBlock[0][1]);
    console.log('   AC sample [1][0]:', dctBlock[1][0]);
    
    // Quantization with q=12 (typical DC quantization)
    const quantMatrix = Array(8).fill(0).map(() => Array(8).fill(16));
    quantMatrix[0][0] = 12; // DC quantization
    
    console.log('\n5. Quantization:');
    console.log('   DC quant value:', quantMatrix[0][0]);
    
    const quantized = quantize(dctBlock, quantMatrix);
    console.log('   Quantized DC:', quantized[0][0]);
    console.log('   Calculation:', dctBlock[0][0], '/', quantMatrix[0][0], '=', dctBlock[0][0] / quantMatrix[0][0]);
    console.log('   Rounded:', Math.round(dctBlock[0][0] / quantMatrix[0][0]));
    
    // Dequantization
    const dequantized = dequantize(quantized, quantMatrix);
    console.log('\n6. Dequantization:');
    console.log('   Dequantized DC:', dequantized[0][0]);
    console.log('   Calculation:', quantized[0][0], '*', quantMatrix[0][0], '=', quantized[0][0] * quantMatrix[0][0]);
    
    // Inverse DCT
    const reconstructed = idct2d(dequantized);
    console.log('\n7. After IDCT:');
    console.log('   Value [0][0]:', reconstructed[0][0]);
    console.log('   Expected:', dequantized[0][0] / 8);
    
    // Add back center
    const finalY = reconstructed[0][0] + 128;
    console.log('\n8. Final Y value:', finalY);
    console.log('   Calculation:', reconstructed[0][0], '+ 128 =', finalY);
    
    // Why is it not 255?
    console.log('\n9. Error analysis:');
    const error = 255 - finalY;
    console.log('   Error:', error);
    console.log('   This comes from quantization rounding');
  });

  it('should test with quality factor 0.8', () => {
    console.log('\n=== With Quality Factor 0.8 ===\n');
    
    const whiteY = 255;
    const centered = whiteY - 128; // = 127
    const block = Array(8).fill(0).map(() => Array(8).fill(centered));
    
    // DCT
    const dctBlock = dct2d(block);
    console.log('DC after DCT:', dctBlock[0][0]);
    
    // Quantization with quality factor
    const baseQuant = 12;
    const qualityFactor = 0.8;
    const dcMultiplier = 1 + (1 - qualityFactor) * 2; // = 1.4
    const effectiveQuant = baseQuant * dcMultiplier;
    
    console.log('\nQuantization with quality 0.8:');
    console.log('Base quant:', baseQuant);
    console.log('DC multiplier:', dcMultiplier);
    console.log('Effective quant:', effectiveQuant);
    
    const quantizedDC = Math.round(dctBlock[0][0] / effectiveQuant);
    console.log('Quantized DC:', quantizedDC);
    console.log('Calculation:', dctBlock[0][0], '/', effectiveQuant, '=', dctBlock[0][0] / effectiveQuant);
    
    // Dequantize
    const dequantizedDC = quantizedDC * effectiveQuant;
    console.log('\nDequantized DC:', dequantizedDC);
    
    // After IDCT
    const reconstructedValue = dequantizedDC / 8;
    console.log('After IDCT:', reconstructedValue);
    
    // Final Y
    const finalY = reconstructedValue + 128;
    console.log('Final Y:', finalY);
    console.log('\nThis explains why we get', Math.round(finalY), 'instead of 255');
  });

  it('should find the perfect quantization', () => {
    console.log('\n=== Finding Perfect Quantization ===\n');
    
    // For white (Y=255), centered = 127
    // After DCT: DC = 127 * 8 = 1016
    // We need: quantized * quant = 1016 (or close)
    
    const targetDC = 127 * 8; // 1016
    console.log('Target DC coefficient:', targetDC);
    
    // Test different quantization values
    const quantValues = [8, 10, 12, 16, 20, 24];
    
    quantValues.forEach(q => {
      const quantized = Math.round(targetDC / q);
      const dequantized = quantized * q;
      const reconstructed = dequantized / 8;
      const finalY = reconstructed + 128;
      
      console.log(`\nQuant=${q}:`);
      console.log(`  Quantized: ${quantized}`);
      console.log(`  Dequantized: ${dequantized}`);
      console.log(`  Final Y: ${finalY}`);
      console.log(`  Error: ${255 - finalY}`);
    });
    
    // The issue: 1016 is not divisible by most common quantization values!
    console.log('\nThe issue: 1016 is not perfectly divisible by common quant values');
    console.log('1016 / 8 = 127 (perfect!)');
    console.log('1016 / 12 = 84.666... → 85 → 1020 (error of 4)');
    console.log('1016 / 16 = 63.5 → 64 → 1024 (error of 8)');
  });
});