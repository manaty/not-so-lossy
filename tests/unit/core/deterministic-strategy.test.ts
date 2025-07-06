import { DeterministicStrategyGenerator } from '../../../src/codecs/dct/dct-strategy';
import { DCTDeviceStrategy } from '../../../src/codecs/dct/dct-types';

describe('DeterministicStrategyGenerator', () => {
  describe('generateStrategy', () => {
    it('should generate consistent strategy for same device ID', () => {
      const deviceId = 'AA:BB:CC:DD:EE:FF';
      const strategy1 = DeterministicStrategyGenerator.generateStrategy(deviceId);
      const strategy2 = DeterministicStrategyGenerator.generateStrategy(deviceId);

      expect(strategy1).toEqual(strategy2);
      expect(strategy1.deviceId).toBe(deviceId);
      expect(strategy1.strategyHash).toBe(strategy2.strategyHash);
    });

    it('should generate different strategies for different device IDs', () => {
      const deviceId1 = 'AA:BB:CC:DD:EE:FF';
      const deviceId2 = '11:22:33:44:55:66';
      
      const strategy1 = DeterministicStrategyGenerator.generateStrategy(deviceId1);
      const strategy2 = DeterministicStrategyGenerator.generateStrategy(deviceId2);

      expect(strategy1.deviceId).not.toBe(strategy2.deviceId);
      expect(strategy1.strategyHash).not.toBe(strategy2.strategyHash);
      expect(strategy1.frequencyMask).not.toEqual(strategy2.frequencyMask);
    });

    it('should always preserve DC coefficient (position 0)', () => {
      const deviceIds = [
        'AA:BB:CC:DD:EE:FF',
        '11:22:33:44:55:66',
        'FF:EE:DD:CC:BB:AA',
        '00:00:00:00:00:00'
      ];

      deviceIds.forEach(deviceId => {
        const strategy = DeterministicStrategyGenerator.generateStrategy(deviceId);
        expect(strategy.frequencyMask[0]).toBe(true);
      });
    });

    it('should generate frequency mask with reasonable preservation count', () => {
      const deviceId = 'AA:BB:CC:DD:EE:FF';
      const strategy = DeterministicStrategyGenerator.generateStrategy(deviceId);
      
      const preservedCount = strategy.frequencyMask.filter(x => x).length;
      expect(preservedCount).toBeGreaterThanOrEqual(16);
      expect(preservedCount).toBeLessThanOrEqual(26);
    });

    it('should generate valid quantization matrix', () => {
      const deviceId = 'AA:BB:CC:DD:EE:FF';
      const strategy = DeterministicStrategyGenerator.generateStrategy(deviceId);
      
      expect(strategy.quantizationMatrix).toHaveLength(8);
      strategy.quantizationMatrix.forEach(row => {
        expect(row).toHaveLength(8);
        row.forEach(value => {
          expect(value).toBeGreaterThanOrEqual(1);
          expect(value).toBeLessThanOrEqual(255);
        });
      });
    });

    it('should generate normalized channel weights', () => {
      const deviceId = 'AA:BB:CC:DD:EE:FF';
      const strategy = DeterministicStrategyGenerator.generateStrategy(deviceId);
      
      const sum = strategy.channelWeights.y + 
                  strategy.channelWeights.cb + 
                  strategy.channelWeights.cr;
      
      expect(sum).toBeCloseTo(1.0, 5);
      expect(strategy.channelWeights.y).toBeGreaterThan(0);
      expect(strategy.channelWeights.cb).toBeGreaterThan(0);
      expect(strategy.channelWeights.cr).toBeGreaterThan(0);
    });

    it('should generate spatial pattern in valid range', () => {
      const deviceId = 'AA:BB:CC:DD:EE:FF';
      const strategy = DeterministicStrategyGenerator.generateStrategy(deviceId);
      
      expect(strategy.spatialPattern).toBeGreaterThanOrEqual(0);
      expect(strategy.spatialPattern).toBeLessThanOrEqual(3);
      expect(Number.isInteger(strategy.spatialPattern)).toBe(true);
    });

    it('should bias frequency mask towards lower frequencies', () => {
      const deviceId = 'AA:BB:CC:DD:EE:FF';
      const strategy = DeterministicStrategyGenerator.generateStrategy(deviceId);
      
      // Count preserved coefficients in first half vs second half
      const firstHalf = strategy.frequencyMask.slice(0, 32).filter(x => x).length;
      const secondHalf = strategy.frequencyMask.slice(32).filter(x => x).length;
      
      // Should have more coefficients preserved in lower frequencies
      expect(firstHalf).toBeGreaterThan(secondHalf);
    });
  });

  describe('Strategy properties', () => {
    it('should have all required properties', () => {
      const deviceId = 'AA:BB:CC:DD:EE:FF';
      const strategy = DeterministicStrategyGenerator.generateStrategy(deviceId);
      
      expect(strategy).toHaveProperty('deviceId');
      expect(strategy).toHaveProperty('strategyHash');
      expect(strategy).toHaveProperty('frequencyMask');
      expect(strategy).toHaveProperty('quantizationMatrix');
      expect(strategy).toHaveProperty('channelWeights');
      expect(strategy).toHaveProperty('spatialPattern');
    });

    it('should generate valid SHA-256 hash', () => {
      const deviceId = 'AA:BB:CC:DD:EE:FF';
      const strategy = DeterministicStrategyGenerator.generateStrategy(deviceId);
      
      // SHA-256 produces 64 character hex string
      expect(strategy.strategyHash).toHaveLength(64);
      expect(strategy.strategyHash).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty device ID', () => {
      const strategy = DeterministicStrategyGenerator.generateStrategy('');
      expect(strategy.deviceId).toBe('');
      expect(strategy.frequencyMask[0]).toBe(true); // DC still preserved
    });

    it('should handle very long device ID', () => {
      const longId = 'A'.repeat(1000);
      const strategy = DeterministicStrategyGenerator.generateStrategy(longId);
      expect(strategy.deviceId).toBe(longId);
      expect(strategy.frequencyMask).toHaveLength(64);
    });

    it('should handle special characters in device ID', () => {
      const specialId = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const strategy = DeterministicStrategyGenerator.generateStrategy(specialId);
      expect(strategy.deviceId).toBe(specialId);
      expect(strategy.frequencyMask[0]).toBe(true);
    });
  });
});