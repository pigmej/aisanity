import { describe, it, expect } from 'bun:test';
import { discoverAllAisanityContainers, ContainerDiscoveryOptions } from '../src/utils/container-utils';

describe('Command Discovery Consistency Integration', () => {
  describe('Discovery Consistency', () => {
    it('should maintain consistency between multiple discovery calls with same options', async () => {
      const options: ContainerDiscoveryOptions = {
        mode: 'global',
        includeOrphaned: true,
        validationMode: 'permissive',
        verbose: false
      };
      
      // Run discovery multiple times with identical options
      const results = await Promise.all([
        discoverAllAisanityContainers(options),
        discoverAllAisanityContainers(options),
        discoverAllAisanityContainers(options)
      ]);
      
      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i].containers.length).toBe(results[0].containers.length);
        expect(results[i].labeled.length).toBe(results[0].labeled.length);
        expect(results[i].unlabeled.length).toBe(results[0].unlabeled.length);
        expect(results[i].orphaned.length).toBe(results[0].orphaned.length);
        expect(results[i].validationResults.size).toBe(results[0].validationResults.size);
        expect(results[i].discoveryMetadata.validationMode).toBe(results[0].discoveryMetadata.validationMode);
      }
    });
    
    it('should handle different validation modes consistently', async () => {
      const baseOptions: Omit<ContainerDiscoveryOptions, 'validationMode'> = {
        mode: 'global',
        includeOrphaned: true,
        verbose: false
      };
      
      // Test both validation modes
      const permissiveResult = await discoverAllAisanityContainers({
        ...baseOptions,
        validationMode: 'permissive'
      });
      
      const strictResult = await discoverAllAisanityContainers({
        ...baseOptions,
        validationMode: 'strict'
      });
      
      // Both should discover the same containers
      expect(permissiveResult.containers.length).toBe(strictResult.containers.length);
      expect(permissiveResult.labeled.length).toBe(strictResult.labeled.length);
      expect(permissiveResult.unlabeled.length).toBe(strictResult.unlabeled.length);
      
      // Validation modes should be correctly recorded
      expect(permissiveResult.discoveryMetadata.validationMode).toBe('permissive');
      expect(strictResult.discoveryMetadata.validationMode).toBe('strict');
      
      // Both should have validation results for all containers
      expect(permissiveResult.validationResults.size).toBe(permissiveResult.containers.length);
      expect(strictResult.validationResults.size).toBe(strictResult.containers.length);
    });
    
    it('should handle includeOrphaned option consistently', async () => {
      const baseOptions: Omit<ContainerDiscoveryOptions, 'includeOrphaned'> = {
        mode: 'global',
        validationMode: 'permissive',
        verbose: false
      };
      
      // Test with and without orphaned containers
      const withOrphaned = await discoverAllAisanityContainers({
        ...baseOptions,
        includeOrphaned: true
      });
      
      const withoutOrphaned = await discoverAllAisanityContainers({
        ...baseOptions,
        includeOrphaned: false
      });
      
      // Both should have the same total containers
      expect(withOrphaned.containers.length).toBe(withoutOrphaned.containers.length);
      
      // The version with orphaned should have equal or more orphaned containers
      expect(withOrphaned.orphaned.length).toBeGreaterThanOrEqual(withoutOrphaned.orphaned.length);
      
      // Both should have consistent metadata
      expect(withOrphaned.discoveryMetadata.totalDiscovered).toBe(withOrphaned.containers.length);
      expect(withoutOrphaned.discoveryMetadata.totalDiscovered).toBe(withoutOrphaned.containers.length);
    });
  });
  
  describe('Mock Container Scenarios', () => {
    it('should handle mock orphaned containers consistently', async () => {
      // Mock containers with non-existent workspace paths
      process.env.AISANITY_TEST_CONTAINERS = JSON.stringify([
        {
          id: 'orphan1',
          name: 'aisanity-deleted-feature',
          status: 'Stopped',
          ports: [],
          labels: {
            'aisanity.workspace': '/nonexistent/path1',
            'aisanity.branch': 'deleted-feature'
          }
        },
        {
          id: 'orphan2',
          name: 'aisanity-deleted-bugfix',
          status: 'Running',
          ports: ['8080:8080'],
          labels: {
            'aisanity.workspace': '/nonexistent/path2',
            'aisanity.branch': 'deleted-bugfix'
          }
        },
        {
          id: 'valid1',
          name: 'aisanity-main-branch',
          status: 'Running',
          ports: ['3000:3000'],
          labels: {
            'aisanity.workspace': process.cwd(), // Use current directory as valid path
            'aisanity.branch': 'main'
          }
        }
      ]);
      
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
      expect(result1.orphaned.length).toBe(result2.orphaned.length);
      expect(result1.validationResults.size).toBe(result2.validationResults.size);
      
      // Should discover all 3 mock containers
      expect(result1.containers.length).toBe(3);
      expect(result1.labeled.length).toBe(3); // All have labels
      
      // Should have at least 2 orphaned (the ones with non-existent paths)
      expect(result1.orphaned.length).toBeGreaterThanOrEqual(2);
      
      // Validation results should be consistent
      for (const [containerId, validation] of result1.validationResults) {
        const validation2 = result2.validationResults.get(containerId);
        expect(validation2).toBeDefined();
        expect(validation.exists).toBe(validation2!.exists);
        expect(validation.isValid).toBe(validation2!.isValid);
        expect(validation.workspacePath).toBe(validation2!.workspacePath);
      }
      
      delete process.env.AISANITY_TEST_CONTAINERS;
    });
    
    it('should handle mixed label scenarios consistently', async () => {
      // Mock containers with different label configurations
      process.env.AISANITY_TEST_CONTAINERS = JSON.stringify([
        {
          id: 'full-labels',
          name: 'container-full',
          status: 'Running',
          ports: [],
          labels: {
            'aisanity.workspace': '/some/path',
            'aisanity.branch': 'feature-branch',
            'aisanity.container': 'dev',
            'aisanity.created': '2024-01-01',
            'aisanity.version': '1.0.0'
          }
        },
        {
          id: 'partial-labels',
          name: 'container-partial',
          status: 'Stopped',
          ports: [],
          labels: {
            'aisanity.workspace': '/another/path',
            'aisanity.branch': 'bugfix-branch'
            // Missing other labels
          }
        },
        {
          id: 'no-aisanity-labels',
          name: 'container-none',
          status: 'Running',
          ports: ['8080:8080'],
          labels: {
            'com.docker.compose.service': 'web'
            // No aisanity labels
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
      
      // Should discover only aisanity containers (those with aisanity.workspace label)
      expect(result.containers.length).toBe(2);
      
      // Should categorize correctly - all discovered containers have workspace labels
      expect(result.labeled.length).toBe(2); // All have aisanity.workspace labels
      expect(result.unlabeled.length).toBe(0); // None are unlabeled
      
      // Validation results should exist for all aisanity containers
      expect(result.validationResults.size).toBe(2);
      
      delete process.env.AISANITY_TEST_CONTAINERS;
    });
  });
  
  describe('Performance and Reliability', () => {
    it('should complete discovery operations within reasonable time', async () => {
      const options: ContainerDiscoveryOptions = {
        mode: 'global',
        includeOrphaned: true,
        validationMode: 'permissive',
        verbose: false
      };
      
      const startTime = Date.now();
      
      // Run multiple discovery operations
      await Promise.all([
        discoverAllAisanityContainers(options),
        discoverAllAisanityContainers(options),
        discoverAllAisanityContainers(options),
        discoverAllAisanityContainers(options),
        discoverAllAisanityContainers(options)
      ]);
      
      const duration = Date.now() - startTime;
      
      // Should complete within 10 seconds even with parallel operations
      expect(duration).toBeLessThan(10000);
    });
    
    it('should maintain consistency under rapid successive calls', async () => {
      const options: ContainerDiscoveryOptions = {
        mode: 'global',
        includeOrphaned: true,
        validationMode: 'permissive',
        verbose: false
      };
      
      const results: Array<Awaited<ReturnType<typeof discoverAllAisanityContainers>>> = [];
      
      // Make 10 rapid calls
      for (let i = 0; i < 10; i++) {
        const result = await discoverAllAisanityContainers(options);
        results.push(result);
      }
      
      // All results should be identical
      const firstResult = results[0];
      for (let i = 1; i < results.length; i++) {
        expect(results[i].containers.length).toBe(firstResult.containers.length);
        expect(results[i].labeled.length).toBe(firstResult.labeled.length);
        expect(results[i].unlabeled.length).toBe(firstResult.unlabeled.length);
        expect(results[i].orphaned.length).toBe(firstResult.orphaned.length);
        expect(results[i].validationResults.size).toBe(firstResult.validationResults.size);
      }
    });
  });
});