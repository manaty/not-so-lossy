import { DeterministicStrategyGenerator } from '../../src/core/deterministic-strategy';

describe('Device Strategy Check', () => {
  it('should examine device strategies', () => {
    const deviceIds = ['DEVICE-000', 'DEVICE-001', 'DEVICE-002'];
    
    deviceIds.forEach(deviceId => {
      const strategy = DeterministicStrategyGenerator.generateStrategy(deviceId);
      console.log(`\n${deviceId}:`);
      console.log('Channel weights:', strategy.channelWeights);
      
      // Count how many frequencies are kept
      const freqCount = strategy.frequencyMask.filter(m => m).length;
      console.log(`Frequency mask: ${freqCount}/64 coefficients kept`);
      
      // Check quantization matrix
      console.log('DC quantization value:', strategy.quantizationMatrix[0][0]);
      console.log('Average quantization:', 
        strategy.quantizationMatrix.flat().reduce((a, b) => a + b, 0) / 64
      );
    });
  });
});