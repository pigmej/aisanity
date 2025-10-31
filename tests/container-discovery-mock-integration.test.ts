import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { discoverAllAisanityContainers, ContainerDiscoveryOptions } from '../src/utils/container-utils';

describe('Container Discovery Mock Integration', () => {
  let testWorkspace: string;
  let originalEnv: any;
  
  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
    
    // Setup test workspace
    testWorkspace = '/tmp/aisanity-test-' + Date.now();
    fs.mkdirSync(testWorkspace, { recursive: true });
    
    // Initialize git repo
    execSync('git init', { cwd: testWorkspace });
    execSync('git config user.email "test@test.com"', { cwd: testWorkspace });
    execSync('git config user.name "Test"', { cwd: testWorkspace });
    
    // Create aisanity config
    fs.writeFileSync(
      path.join(testWorkspace, '.aisanity'),
      JSON.stringify({ workspace: 'test-workspace' })
    );
    
    // Initial commit
    execSync('git add .', { cwd: testWorkspace });
    execSync('git commit -m "init"', { cwd: testWorkspace });
    
    // Create worktrees directory
    fs.mkdirSync(path.join(testWorkspace, 'worktrees'), { recursive: true });
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    
    // Cleanup test workspace
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
  });
  
  it('should discover containers from deleted worktrees using mock data', async () => {
    // 1. Create worktree
    const worktreePath = path.join(testWorkspace, 'worktrees', 'feature');
    execSync(`git worktree add "${worktreePath}" -b feature`, { cwd: testWorkspace });
    
    // 2. Set up mock containers including orphaned ones
    process.env.AISANITY_TEST_CONTAINERS = JSON.stringify([
      {
        id: 'valid123',
        name: 'aisanity-test-workspace-feature',
        image: 'alpine',
        status: 'Running',
        ports: '8080/tcp',
        labels: {
          'aisanity.workspace': worktreePath,
          'aisanity.branch': 'feature',
          'aisanity.container': 'aisanity-test-workspace-feature'
        }
      },
      {
        id: 'orphaned456',
        name: 'aisanity-test-workspace-deleted-feature',
        image: 'alpine',
        status: 'Stopped',
        ports: '',
        labels: {
          'aisanity.workspace': '/nonexistent/path/deleted-feature',
          'aisanity.branch': 'deleted-feature',
          'aisanity.container': 'aisanity-test-workspace-deleted-feature'
        }
      }
    ]);
    
    // 3. Delete worktree directory to simulate orphaned container scenario
    fs.rmSync(worktreePath, { recursive: true, force: true });
    
    // 4. Run discovery as status command would
    const statusOptions: ContainerDiscoveryOptions = {
      mode: 'global',
      includeOrphaned: true,
      validationMode: 'permissive',
      verbose: false
    };
    
    const statusResult = await discoverAllAisanityContainers(statusOptions);
    
    // 5. Run discovery as stop command would (same options)
    const stopOptions: ContainerDiscoveryOptions = {
      mode: 'global',
      includeOrphaned: true,
      validationMode: 'permissive',
      verbose: false
    };
    
    const stopResult = await discoverAllAisanityContainers(stopOptions);
    
    // 6. Verify both commands discover the same containers
    expect(statusResult.containers.length).toBe(stopResult.containers.length);
    expect(statusResult.orphaned.length).toBe(stopResult.orphaned.length);
    
    // 7. Verify container IDs match between both discoveries
    const statusIds = new Set(statusResult.containers.map(c => c.id));
    const stopIds = new Set(stopResult.containers.map(c => c.id));
    expect(statusIds).toEqual(stopIds);
    
    // 8. Verify orphaned detection works correctly
    // Both containers should be orphaned since both paths don't exist
    expect(statusResult.orphaned.length).toBe(2);
    
    const orphanedIds = statusResult.orphaned.map(c => c.id);
    expect(orphanedIds).toContain('orphaned456');
    expect(orphanedIds).toContain('valid123');
    
    // 9. Verify validation results for explicitly orphaned container
    const orphanedValidation = statusResult.validationResults.get('orphaned456');
    expect(orphanedValidation?.exists).toBe(false);
    expect(orphanedValidation?.isValid).toBe(false);
    expect(orphanedValidation?.workspacePath).toBe('/nonexistent/path/deleted-feature');
    
    // 10. Verify validation results for deleted worktree container
    const validValidation = statusResult.validationResults.get('valid123');
    expect(validValidation?.exists).toBe(false); // Worktree was deleted
    expect(validValidation?.isValid).toBe(false);
    expect(validValidation?.workspacePath).toContain('/worktrees/feature');
  });
  
  it('should handle multiple orphaned containers consistently', async () => {
    // Set up mock containers with multiple orphaned ones
    process.env.AISANITY_TEST_CONTAINERS = JSON.stringify([
      {
        id: 'valid1',
        name: 'aisanity-test-workspace-main',
        image: 'alpine',
        status: 'Running',
        ports: '8080/tcp',
        labels: {
          'aisanity.workspace': testWorkspace,
          'aisanity.branch': 'main',
          'aisanity.container': 'aisanity-test-workspace-main'
        }
      },
      {
        id: 'orphaned1',
        name: 'aisanity-test-workspace-feature1',
        image: 'alpine',
        status: 'Stopped',
        ports: '',
        labels: {
          'aisanity.workspace': '/nonexistent/path/feature1',
          'aisanity.branch': 'feature1',
          'aisanity.container': 'aisanity-test-workspace-feature1'
        }
      },
      {
        id: 'orphaned2',
        name: 'aisanity-test-workspace-feature2',
        image: 'alpine',
        status: 'Stopped',
        ports: '',
        labels: {
          'aisanity.workspace': '/nonexistent/path/feature2',
          'aisanity.branch': 'feature2',
          'aisanity.container': 'aisanity-test-workspace-feature2'
        }
      }
    ]);
    
    // Run discovery with both command configurations
    const statusResult = await discoverAllAisanityContainers({
      mode: 'global',
      includeOrphaned: true,
      validationMode: 'permissive',
      verbose: false
    });
    
    const stopResult = await discoverAllAisanityContainers({
      mode: 'global',
      includeOrphaned: true,
      validationMode: 'permissive',
      verbose: false
    });
    
    // Verify consistency
    expect(statusResult.containers.length).toBe(stopResult.containers.length);
    expect(statusResult.orphaned.length).toBe(stopResult.orphaned.length);
    expect(statusResult.orphaned.length).toBe(2); // Only orphaned1 and orphaned2 are orphaned (non-existent paths)
    
    // Verify all orphaned containers are found consistently
    const statusOrphanedIds = new Set(statusResult.orphaned.map(c => c.id));
    const stopOrphanedIds = new Set(stopResult.orphaned.map(c => c.id));
    expect(statusOrphanedIds).toEqual(stopOrphanedIds);
    
    // Verify specific orphaned containers
    expect(statusOrphanedIds.has('orphaned1')).toBe(true);
    expect(statusOrphanedIds.has('orphaned2')).toBe(true);
    expect(statusOrphanedIds.has('main')).toBe(false); // Not orphaned since testWorkspace exists
  });
  
  it('should distinguish validation modes correctly', async () => {
    // Create a directory that exists but has no .git (outside test workspace to avoid conflicts)
    const noGitDir = '/tmp/test-no-git-' + Date.now();
    fs.mkdirSync(noGitDir, { recursive: true });
    
    process.env.AISANITY_TEST_CONTAINERS = JSON.stringify([
      {
        id: 'valid',
        name: 'aisanity-test-workspace-valid',
        image: 'alpine',
        status: 'Running',
        ports: '8080/tcp',
        labels: {
          'aisanity.workspace': testWorkspace,
          'aisanity.branch': 'main',
          'aisanity.container': 'aisanity-test-workspace-valid'
        }
      },
      {
        id: 'nogit',
        name: 'aisanity-test-workspace-nogit',
        image: 'alpine',
        status: 'Stopped',
        ports: '',
        labels: {
          'aisanity.workspace': noGitDir,
          'aisanity.branch': 'nogit',
          'aisanity.container': 'aisanity-test-workspace-nogit'
        }
      },
      {
        id: 'nonexistent',
        name: 'aisanity-test-workspace-nonexistent',
        image: 'alpine',
        status: 'Stopped',
        ports: '',
        labels: {
          'aisanity.workspace': '/nonexistent/path',
          'aisanity.branch': 'nonexistent',
          'aisanity.container': 'aisanity-test-workspace-nonexistent'
        }
      }
    ]);
    
    // Test permissive mode
    const permissiveResult = await discoverAllAisanityContainers({
      mode: 'global',
      includeOrphaned: true,
      validationMode: 'permissive',
      verbose: false
    });
    
    // Test strict mode
    const strictResult = await discoverAllAisanityContainers({
      mode: 'global',
      includeOrphaned: true,
      validationMode: 'strict',
      verbose: false
    });
    
    // Both modes should find same containers
    expect(permissiveResult.containers.length).toBe(strictResult.containers.length);
    
    // Permissive mode: only non-existent paths are orphaned
    expect(permissiveResult.orphaned.length).toBe(1);
    expect(permissiveResult.orphaned[0].id).toBe('nonexistent');
    
    // Strict mode: non-existent and no-git paths are orphaned
    expect(strictResult.orphaned.length).toBe(2);
    const strictOrphanedIds = new Set(strictResult.orphaned.map(c => c.id));
    expect(strictOrphanedIds.has('nonexistent')).toBe(true);
    expect(strictOrphanedIds.has('nogit')).toBe(true);
    
    // Verify validation results
    const permissiveNoGitValidation = permissiveResult.validationResults.get('nogit');
    expect(permissiveNoGitValidation?.exists).toBe(true);
    expect(permissiveNoGitValidation?.isValid).toBe(true); // Permissive mode
    expect(permissiveNoGitValidation?.validationMethod).toBe('filesystem');
    
    const strictNoGitValidation = strictResult.validationResults.get('nogit');
    expect(strictNoGitValidation?.exists).toBe(true);
    expect(strictNoGitValidation?.isValid).toBe(false); // Strict mode
    expect(strictNoGitValidation?.error).toContain('.git');
    expect(strictNoGitValidation?.validationMethod).toBe('git');
    
    // Cleanup no-git directory
    if (fs.existsSync(noGitDir)) {
      fs.rmSync(noGitDir, { recursive: true, force: true });
    }
  });
  
  it('should provide deterministic results across multiple calls', async () => {
    process.env.AISANITY_TEST_CONTAINERS = JSON.stringify([
      {
        id: 'test123',
        name: 'aisanity-test-workspace-test',
        image: 'alpine',
        status: 'Running',
        ports: '8080/tcp',
        labels: {
          'aisanity.workspace': '/nonexistent/path',
          'aisanity.branch': 'test',
          'aisanity.container': 'aisanity-test-workspace-test'
        }
      }
    ]);
    
    const options: ContainerDiscoveryOptions = {
      mode: 'global',
      includeOrphaned: true,
      validationMode: 'permissive',
      verbose: false
    };
    
    // Run discovery multiple times
    const result1 = await discoverAllAisanityContainers(options);
    const result2 = await discoverAllAisanityContainers(options);
    const result3 = await discoverAllAisanityContainers(options);
    
    // Results should be identical
    expect(result1.containers.length).toBe(result2.containers.length);
    expect(result2.containers.length).toBe(result3.containers.length);
    
    expect(result1.orphaned.length).toBe(result2.orphaned.length);
    expect(result2.orphaned.length).toBe(result3.orphaned.length);
    
    // Container IDs should match
    const ids1 = new Set(result1.containers.map(c => c.id));
    const ids2 = new Set(result2.containers.map(c => c.id));
    const ids3 = new Set(result3.containers.map(c => c.id));
    
    expect(ids1).toEqual(ids2);
    expect(ids2).toEqual(ids3);
    
    // Validation results should be consistent
    const validation1 = result1.validationResults.get('test123');
    const validation2 = result2.validationResults.get('test123');
    const validation3 = result3.validationResults.get('test123');
    
    expect(validation1?.exists).toBe(validation2?.exists);
    expect(validation2?.exists).toBe(validation3?.exists);
    
    expect(validation1?.isValid).toBe(validation2?.isValid);
    expect(validation2?.isValid).toBe(validation3?.isValid);
  });
});