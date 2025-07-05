describe('Quantization Calculation Issue', () => {
  it('should trace quantization calculation', () => {
    console.log('=== Quantization Math ===\n');
    
    // For white Y=255, centered = 127, DC after DCT = 1016
    const dcAfterDCT = 127 * 8; // 1016
    
    // At quality 1.0
    const baseQuant = 12;
    const quality1 = 1.0;
    const dcMultiplier1 = 1 + (1 - quality1) * 2; // = 1
    const effectiveQuant1 = baseQuant * dcMultiplier1; // = 12
    const quantizedDC1 = Math.round(dcAfterDCT / effectiveQuant1);
    
    console.log('At quality 1.0:');
    console.log('DC multiplier:', dcMultiplier1);
    console.log('Effective quant:', effectiveQuant1);
    console.log('Quantized DC:', quantizedDC1);
    console.log('Expected: 85 ✓');
    
    // At quality 0.8  
    const quality2 = 0.8;
    const dcMultiplier2 = 1 + (1 - quality2) * 2; // = 1.4
    const effectiveQuant2 = baseQuant * dcMultiplier2; // = 16.8
    const quantizedDC2 = Math.round(dcAfterDCT / effectiveQuant2);
    
    console.log('\nAt quality 0.8:');
    console.log('DC multiplier:', dcMultiplier2);
    console.log('Effective quant:', effectiveQuant2);
    console.log('Quantized DC:', quantizedDC2);
    console.log('Expected: 60 ✓');
    
    // Reconstruction
    const dequantizedDC2 = quantizedDC2 * effectiveQuant2;
    const afterIDCT2 = dequantizedDC2 / 8;
    const finalY2 = afterIDCT2 + 128;
    
    console.log('\nReconstruction:');
    console.log('Dequantized DC:', dequantizedDC2);
    console.log('After IDCT:', afterIDCT2);
    console.log('Final Y:', finalY2);
    console.log('Rounded:', Math.round(finalY2));
    
    // The math checks out! 60 * 16.8 = 1008, 1008/8 = 126, 126+128 = 254
    // But we're seeing 218, not 254...
    
    console.log('\nWait, if DC=60 gives Y=254, why are we seeing 218?');
    console.log('Let\'s work backwards from 218:');
    
    const observedY = 218;
    const centered = observedY - 128; // = 90
    const dcBeforeQuant = centered * 8; // = 720
    const quantizedDCObserved = Math.round(dcBeforeQuant / effectiveQuant2);
    
    console.log('Observed Y:', observedY);
    console.log('Implies centered value:', centered);
    console.log('Implies DC before quant:', dcBeforeQuant);
    console.log('Would give quantized DC:', quantizedDCObserved);
    
    // So if we're seeing DC=60 but getting Y=218, something else is wrong
  });
});