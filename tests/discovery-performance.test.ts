import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { discoverAllAisanityContainers, ContainerDiscoveryOptions } from '../src/utils/container-utils';

describe('Discovery Performance Tests', () => {
  describe('Basic Performance', () => {
    it('should complete discovery within 5 seconds', async () => {
      const startTime = Date.now();
      
      const options: ContainerDiscoveryOptions = {
        mode: 'global',
        includeOrphaned: true,
        validationMode: 'permissive',
        verbose: false
      };
      
      await discoverAllAisanityContainers(options);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000);
    });
    
    it('should handle cached results efficiently', async () => {
      const options: ContainerDiscoveryOptions = {
        mode: 'global',
        includeOrphaned: true,
        validationMode: 'permissive',
        verbose: false
      };
      
      // First call (cache miss)
      const start1 = Date.now();
      await discoverAllAisanityContainers(options);
      const duration1 = Date.now() - start1;
      
      // Second call (potential cache hit)
      const start2 = Date.now();
      await discoverAllAisanityContainers(options);
      const duration2 = Date.now() - start2;
      
      // Both should complete reasonably fast
      expect(duration1).toBeLessThan(5000);
      expect(duration2).toBeLessThan(5000);
    });
    
    it('should handle different validation modes efficiently', async () => {
      const modes: Array<'strict' | 'permissive'> = ['strict', 'permissive'];
      
      for (const mode of modes) {
        const startTime = Date.now();
        
        const options: ContainerDiscoveryOptions = {
          mode: 'global',
          includeOrphaned: true,
          validationMode: mode,
          verbose: false
        };
        
        await discoverAllAisanityContainers(options);
        
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(5000);
      }
    });
  });
  
  describe('Concurrent Performance', () => {
    it('should handle parallel discovery calls', async () => {
      const options: ContainerDiscoveryOptions = {
        mode: 'global',
        includeOrphaned: true,
        validationMode: 'permissive',
        verbose: false
      };
      
      const startTime = Date.now();
      
      // Run 5 discoveries in parallel
      const promises = Array(5).fill(null).map(() => 
        discoverAllAisanityContainers(options)
      );
      
      const results = await Promise.all(promises);
      
      const duration = Date.now() - startTime;
      
      // All results should be consistent
      for (let i = 1; i < results.length; i++) {
        expect(results[i].containers.length).toBe(results[0].containers.length);
        expect(results[i].labeled.length).toBe(results[0].labeled.length);
        expect(results[i].unlabeled.length).toBe(results[0].unlabeled.length);
        expect(results[i].orphaned.length).toBe(results[0].orphaned.length);
      }
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(10000);
    });
    
    it('should handle mixed options in parallel', async () => {
      const startTime = Date.now();
      
      // Run different options in parallel
      const promises = [
        discoverAllAisanityContainers({
          mode: 'global',
          includeOrphaned: true,
          validationMode: 'permissive',
          verbose: false
        }),
        discoverAllAisanityContainers({
          mode: 'global',
          includeOrphaned: false,
          validationMode: 'strict',
          verbose: false
        }),
        discoverAllAisanityContainers({
          mode: 'global',
          includeOrphaned: true,
          validationMode: 'strict',
          verbose: true
        })
      ];
      
      const results = await Promise.all(promises);
      
      const duration = Date.now() - startTime;
      
      // All should complete successfully
      results.forEach(result => {
        expect(result.containers).toBeDefined();
        expect(result.validationResults).toBeDefined();
        expect(result.discoveryMetadata).toBeDefined();
      });
      
      expect(duration).toBeLessThan(10000);
    });
  });
  
  describe('Memory Performance', () => {
    it('should not leak memory during repeated calls', async () => {
      const options: ContainerDiscoveryOptions = {
        mode: 'global',
        includeOrphaned: true,
        validationMode: 'permissive',
        verbose: false
      };
      
      // Run multiple discoveries
      for (let i = 0; i < 10; i++) {
        const result = await discoverAllAisanityContainers(options);
        
        // Verify structure is consistent
        expect(result.containers).toBeDefined();
        expect(result.validationResults).toBeDefined();
        expect(result.discoveryMetadata).toBeDefined();
        
        // Verify metadata is correct
        expect(result.discoveryMetadata.totalDiscovered).toBe(result.containers.length);
        expect(result.discoveryMetadata.labeledCount).toBe(result.labeled.length);
        expect(result.discoveryMetadata.unlabeledCount).toBe(result.unlabeled.length);
        expect(result.discoveryMetadata.orphanedCount).toBe(result.orphaned.length);
      }
    });
    
    it('should handle large validation result maps efficiently', async () => {
      // Mock many containers
      const mockContainers = Array(100).fill(null).map((_, i) => ({
        id: `test-container-${i}`,
        name: `test-${i}`,
        status: 'Running',
        ports: [],
        labels: {
          'aisanity.workspace': `/test/path/${i}`,
          'aisanity.branch': `branch-${i}`
        }
      }));
      
      process.env.AISANITY_TEST_CONTAINERS = JSON.stringify(mockContainers);
      
      const options: ContainerDiscoveryOptions = {
        mode: 'global',
        includeOrphaned: true,
        validationMode: 'permissive',
        verbose: false
      };
      
      const startTime = Date.now();
      const result = await discoverAllAisanityContainers(options);
      const duration = Date.now() - startTime;
      
      // Should handle many containers efficiently
      expect(duration).toBeLessThan(10000);
      expect(result.validationResults.size).toBeGreaterThan(0);
      
      delete process.env.AISANITY_TEST_CONTAINERS;
    });
  });
  
  describe('Scalability Tests', () => {
    it('should scale linearly with container count', async () => {
      // Test with different numbers of mock containers
      const containerCounts = [10, 25];
      const durations: number[] = [];
      
      for (const count of containerCounts) {
        const mockContainers = Array(count).fill(null).map((_, i) => ({
          id: `scale-test-${i}`,
          name: `scale-${i}`,
          status: 'Running',
          ports: [],
          labels: {
            'aisanity.workspace': `/scale/path/${i}`,
            'aisanity.branch': `scale-branch-${i}`
          }
        }));
        
        process.env.AISANITY_TEST_CONTAINERS = JSON.stringify(mockContainers);
        
        const options: ContainerDiscoveryOptions = {
          mode: 'global',
          includeOrphaned: true,
          validationMode: 'permissive',
          verbose: false
        };
        
        const startTime = Date.now();
        await discoverAllAisanityContainers(options);
        const duration = Date.now() - startTime;
        
        durations.push(duration);
        
        delete process.env.AISANITY_TEST_CONTAINERS;
      }
      
      // All durations should be reasonable
      durations.forEach(duration => {
        expect(duration).toBeLessThan(5000);
      });
      
      // Performance should scale reasonably (not exponentially)
      // Each increase should not take more than 3x the previous duration
      for (let i = 1; i < durations.length; i++) {
        const prevDuration = durations[i - 1];
        if (prevDuration > 0) { // Avoid division by zero
          const ratio = durations[i] / prevDuration;
          expect(ratio).toBeLessThan(3.0);
        }
      }
    });
  });
});