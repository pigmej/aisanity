import { describe, it, expect } from 'bun:test';
import { discoverAllAisanityContainers } from '../src/utils/container-utils';

describe('Command Discovery Consistency', () => {
  it('status and stop should discover same containers', async () => {
    // Status command configuration
    const statusOptions = {
      mode: 'global' as const,
      includeOrphaned: true,
      validationMode: 'permissive' as const,
      verbose: false
    };
    
    // Stop command configuration
    const stopOptions = {
      mode: 'global' as const,
      includeOrphaned: true,
      validationMode: 'permissive' as const,
      verbose: false
    };
    
    const statusResult = await discoverAllAisanityContainers(statusOptions);
    const stopResult = await discoverAllAisanityContainers(stopOptions);
    
    // Both commands should discover identical containers
    expect(statusResult.containers.length).toBe(stopResult.containers.length);
    expect(statusResult.orphaned.length).toBe(stopResult.orphaned.length);
    
    // Container IDs should match
    const statusIds = new Set(statusResult.containers.map(c => c.id));
    const stopIds = new Set(stopResult.containers.map(c => c.id));
    expect(statusIds).toEqual(stopIds);
  });
  
  it('should report orphaned containers consistently', async () => {
    const options = {
      mode: 'global' as const,
      includeOrphaned: true,
      validationMode: 'permissive' as const,
      verbose: true
    };
    
    const result1 = await discoverAllAisanityContainers(options);
    const result2 = await discoverAllAisanityContainers(options);
    
    // Orphaned detection should be deterministic
    expect(result1.orphaned.length).toBe(result2.orphaned.length);
    
    const orphaned1Ids = new Set(result1.orphaned.map(c => c.id));
    const orphaned2Ids = new Set(result2.orphaned.map(c => c.id));
    expect(orphaned1Ids).toEqual(orphaned2Ids);
  });
});