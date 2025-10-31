import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { discoverAllAisanityContainers, ContainerDiscoveryOptions } from '../src/utils/container-utils';

describe('Container Discovery Regression Tests', () => {
  describe('Backward Compatibility', () => {
    it('should maintain consistent container discovery results', async () => {
      const options: ContainerDiscoveryOptions = {
        mode: 'global',
        includeOrphaned: true,
        validationMode: 'permissive',
        verbose: false
      };
      
      // Run discovery twice to ensure consistency
      const result1 = await discoverAllAisanityContainers(options);
      const result2 = await discoverAllAisanityContainers(options);
      
      // Results should be identical
      expect(result1.containers.length).toBe(result2.containers.length);
      expect(result1.labeled.length).toBe(result2.labeled.length);
      expect(result1.unlabeled.length).toBe(result2.unlabeled.length);
      expect(result1.orphaned.length).toBe(result2.orphaned.length);
      expect(result1.validationResults.size).toBe(result2.validationResults.size);
    });
    
    it('should handle empty container lists gracefully', async () => {
      // Mock empty docker response
      process.env.AISANITY_TEST_CONTAINERS = '[]';
      
      const options: ContainerDiscoveryOptions = {
        mode: 'global',
        includeOrphaned: true,
        validationMode: 'permissive',
        verbose: false
      };
      
      const result = await discoverAllAisanityContainers(options);
      
      expect(result.containers).toEqual([]);
      expect(result.labeled).toEqual([]);
      expect(result.unlabeled).toEqual([]);
      expect(result.orphaned).toEqual([]);
      expect(result.errors).toEqual([]);
      
      delete process.env.AISANITY_TEST_CONTAINERS;
    });
    
    it('should maintain validation result consistency', async () => {
      const options: ContainerDiscoveryOptions = {
        mode: 'global',
        includeOrphaned: true,
        validationMode: 'permissive',
        verbose: false
      };
      
      const result = await discoverAllAisanityContainers(options);
      
      // All validation results should have required fields
      for (const [containerId, validation] of result.validationResults) {
        expect(containerId).toBeDefined();
        expect(containerId).toBeTruthy();
        
        expect(validation.workspacePath).toBeDefined();
        expect(typeof validation.exists).toBe('boolean');
        expect(typeof validation.isValid).toBe('boolean');
        expect(['filesystem', 'git', 'cache']).toContain(validation.validationMethod);
      }
    });
  });
  
  describe('Edge Case Handling', () => {
    it('should handle containers with missing labels gracefully', async () => {
      // Mock container with missing labels
      process.env.AISANITY_TEST_CONTAINERS = JSON.stringify([
        {
          id: 'no-labels',
          name: 'test-container',
          status: 'Running',
          ports: [],
          labels: {} // Empty labels
        }
      ]);
      
      const options: ContainerDiscoveryOptions = {
        mode: 'global',
        includeOrphaned: true,
        validationMode: 'permissive',
        verbose: false
      };
      
      const result = await discoverAllAisanityContainers(options);
      
      expect(result.containers.length).toBe(0);
      // Should have no containers since none have aisanity.workspace label
      expect(result.unlabeled.length + result.labeled.length).toBe(0);
      
      delete process.env.AISANITY_TEST_CONTAINERS;
    });
    
    it('should handle containers with partial labels gracefully', async () => {
      // Mock container with partial labels
      process.env.AISANITY_TEST_CONTAINERS = JSON.stringify([
        {
          id: 'partial-labels',
          name: 'test-container',
          status: 'Running',
          ports: [],
          labels: {
            'aisanity.workspace': '/some/path',
            // Missing branch label
          }
        }
      ]);
      
      const options: ContainerDiscoveryOptions = {
        mode: 'global',
        includeOrphaned: true,
        validationMode: 'permissive',
        verbose: false
      };
      
      const result = await discoverAllAisanityContainers(options);
      
      expect(result.containers.length).toBeGreaterThan(0);
      
      delete process.env.AISANITY_TEST_CONTAINERS;
    });
    
    it('should handle invalid workspace paths in validation', async () => {
      const result = await discoverAllAisanityContainers({
        mode: 'global',
        includeOrphaned: true,
        validationMode: 'permissive',
        verbose: false
      });
      
      // Check that validation handles non-existent paths
      for (const [containerId, validation] of result.validationResults) {
        if (!validation.exists) {
          expect(validation.workspacePath).toBeDefined();
          // Should not throw errors for non-existent paths
          expect(typeof validation.workspacePath).toBe('string');
        }
      }
    });
  });
  
  describe('Performance Regression', () => {
    it('should complete discovery within reasonable time', async () => {
      const startTime = Date.now();
      
      const options: ContainerDiscoveryOptions = {
        mode: 'global',
        includeOrphaned: true,
        validationMode: 'permissive',
        verbose: false
      };
      
      await discoverAllAisanityContainers(options);
      
      const duration = Date.now() - startTime;
      
      // Should complete within 10 seconds even with many containers
      expect(duration).toBeLessThan(10000);
    });
    
    it('should handle multiple rapid calls efficiently', async () => {
      const options: ContainerDiscoveryOptions = {
        mode: 'global',
        includeOrphaned: true,
        validationMode: 'permissive',
        verbose: false
      };
      
      const startTime = Date.now();
      
      // Make multiple calls
      await Promise.all([
        discoverAllAisanityContainers(options),
        discoverAllAisanityContainers(options),
        discoverAllAisanityContainers(options)
      ]);
      
      const duration = Date.now() - startTime;
      
      // Should complete within 15 seconds for 3 parallel calls
      expect(duration).toBeLessThan(15000);
    });
  });
});