import { DeterministicStrategyGenerator } from '../../src/codecs/dct/dct-strategy';

describe('Strategy Weights Analysis', () => {
  it('should check weights for TEST-DEVICE', () => {
    const strategy = DeterministicStrategyGenerator.generateStrategy('TEST-DEVICE');
    console.log('TEST-DEVICE weights:', strategy.channelWeights);
    
    // Check if any channel is too low
    expect(strategy.channelWeights.y).toBeGreaterThan(0);
    expect(strategy.channelWeights.cb).toBeGreaterThan(0);
    expect(strategy.channelWeights.cr).toBeGreaterThan(0);
  });

  it('should check weights for multiple devices', () => {
    const deviceIds = ['DEVICE-001', 'DEVICE-002', 'DEVICE-003', 'TEST-DEVICE', 'DEBUG-DEVICE'];
    
    deviceIds.forEach(id => {
      const strategy = DeterministicStrategyGenerator.generateStrategy(id);
      console.log(`${id} weights:`, strategy.channelWeights);
      
      // Count how many channels are effectively skipped
      const skippedChannels = [
        strategy.channelWeights.y < 0.001 ? 'Y' : null,
        strategy.channelWeights.cb < 0.001 ? 'Cb' : null,
        strategy.channelWeights.cr < 0.001 ? 'Cr' : null
      ].filter(Boolean);
      
      if (skippedChannels.length > 0) {
        console.log(`  -> Skipped channels: ${skippedChannels.join(', ')}`);
      }
    });
  });
});