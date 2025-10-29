import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'bun:test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { discoverAllAisanityContainers, ContainerDiscoveryOptions, executeDockerCommand } from '../src/utils/container-utils';

/**
 * Container Discovery Docker Integration Tests
 * 
 * These tests verify container discovery functionality with real Docker containers.
 * Docker-dependent tests are skipped if Docker is not available (e.g., on macOS GitHub Actions).
 * 
 * CI Behavior:
 * - ubuntu-latest: All tests run (Docker available)
 * - macos-latest: Tests skipped gracefully (Docker not available)
 */

// Helper to check if Docker is available
let dockerAvailable = false;

beforeAll(async () => {
  const result = await executeDockerCommand('docker --version', { silent: true });
  dockerAvailable = result.success;
  
  if (!dockerAvailable) {
    console.warn('⚠️  Docker is not available. Skipping Docker integration tests.');
  }
});

describe('Container Discovery Docker Integration', () => {
  let testWorkspace: string;
  let testContainers: string[] = [];
  
  beforeEach(async () => {
    // Setup test workspace with orphaned containers
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
  
  afterEach(async () => {
    // Cleanup test containers (only if Docker is available)
    if (dockerAvailable && testContainers.length > 0) {
      for (const containerId of testContainers) {
        try {
          execSync(`docker stop ${containerId}`, { stdio: 'ignore' });
          execSync(`docker rm ${containerId}`, { stdio: 'ignore' });
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
    
    // Cleanup test workspace
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
  });
  
  it('should discover containers from deleted worktrees', async () => {
    if (!dockerAvailable) {
      console.log('Skipping test: Docker not available');
      return;
    }

    // 1. Create worktree with container
    const worktreePath = path.join(testWorkspace, 'worktrees', 'feature');
    execSync(`git worktree add "${worktreePath}" -b feature`, { cwd: testWorkspace });
    
    // 2. Create a Docker container that simulates an aisanity container
    const containerName = `test-aisanity-feature-${Date.now()}`;
    const dockerOutput = execSync(
      `docker run -d --name ${containerName} --label aisanity.workspace="${worktreePath}" --label aisanity.branch=feature alpine sleep 3600`,
      { encoding: 'utf8' }
    ).trim();
    
    testContainers.push(containerName);
    const containerId = dockerOutput.substring(0, 12); // First 12 characters are the container ID
    
    // 3. Delete worktree directory (not using git worktree remove - this simulates manual deletion)
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
    
    // 7. Verify the orphaned container is discovered
    const orphanedContainer = statusResult.orphaned.find(c => c.id.startsWith(containerId));
    expect(orphanedContainer).toBeDefined();
    expect(orphanedContainer?.name).toBe(containerName);
    
    // 8. Verify validation results show the worktree doesn't exist
    const validation = statusResult.validationResults.get(containerId);
    expect(validation?.exists).toBe(false);
    expect(validation?.isValid).toBe(false);
    expect(validation?.workspacePath).toBe(worktreePath);
  });
  
  it('should handle multiple orphaned containers consistently', async () => {
    if (!dockerAvailable) {
      console.log('Skipping test: Docker not available');
      return;
    }

    const worktrees = ['feature1', 'feature2', 'feature3'];
    const containerIds: string[] = [];
    
    // Create multiple worktrees with containers
    for (const worktreeName of worktrees) {
      const worktreePath = path.join(testWorkspace, 'worktrees', worktreeName);
      execSync(`git worktree add "${worktreePath}" -b ${worktreeName}`, { cwd: testWorkspace });
      
      const containerName = `test-aisanity-${worktreeName}-${Date.now()}`;
      const dockerOutput = execSync(
        `docker run -d --name ${containerName} --label aisanity.workspace="${worktreePath}" --label aisanity.branch=${worktreeName} alpine sleep 3600`,
        { encoding: 'utf8' }
      ).trim();
      
      testContainers.push(containerName);
      containerIds.push(dockerOutput.substring(0, 12));
      
      // Delete worktree directory to create orphaned container
      fs.rmSync(worktreePath, { recursive: true, force: true });
    }
    
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
    
    // Filter to only our test containers for verification
    const statusTestContainers = statusResult.containers.filter(c => 
      containerIds.some(id => c.id.startsWith(id))
    );
    const stopTestContainers = stopResult.containers.filter(c => 
      containerIds.some(id => c.id.startsWith(id))
    );
    const statusTestOrphaned = statusResult.orphaned.filter(c => 
      containerIds.some(id => c.id.startsWith(id))
    );
    const stopTestOrphaned = stopResult.orphaned.filter(c => 
      containerIds.some(id => c.id.startsWith(id))
    );
    
    // Verify consistency
    expect(statusTestContainers.length).toBe(stopTestContainers.length);
    expect(statusTestOrphaned.length).toBe(stopTestOrphaned.length);
    expect(statusTestOrphaned.length).toBe(worktrees.length);
    
    // Verify all orphaned containers are found
    for (const expectedId of containerIds) {
      const statusOrphaned = statusResult.orphaned.find(c => c.id.startsWith(expectedId));
      const stopOrphaned = stopResult.orphaned.find(c => c.id.startsWith(expectedId));
      
      expect(statusOrphaned).toBeDefined();
      expect(stopOrphaned).toBeDefined();
      expect(statusOrphaned?.id).toBe(stopOrphaned?.id);
    }
  });
  
  it('should distinguish between valid and orphaned containers', async () => {
    if (!dockerAvailable) {
      console.log('Skipping test: Docker not available');
      return;
    }

    // Create a valid worktree with container
    const validWorktreePath = path.join(testWorkspace, 'worktrees', 'valid-feature');
    execSync(`git worktree add "${validWorktreePath}" -b valid-feature`, { cwd: testWorkspace });
    
    const validContainerName = `test-aisanity-valid-${Date.now()}`;
    const validDockerOutput = execSync(
      `docker run -d --name ${validContainerName} --label aisanity.workspace="${validWorktreePath}" --label aisanity.branch=valid-feature alpine sleep 3600`,
      { encoding: 'utf8' }
    ).trim();
    
    testContainers.push(validContainerName);
    const validContainerId = validDockerOutput.substring(0, 12);
    
    // Create an orphaned container
    const orphanWorktreePath = path.join(testWorkspace, 'worktrees', 'orphan-feature');
    execSync(`git worktree add "${orphanWorktreePath}" -b orphan-feature`, { cwd: testWorkspace });
    
    const orphanContainerName = `test-aisanity-orphan-${Date.now()}`;
    const orphanDockerOutput = execSync(
      `docker run -d --name ${orphanContainerName} --label aisanity.workspace="${orphanWorktreePath}" --label aisanity.branch=orphan-feature alpine sleep 3600`,
      { encoding: 'utf8' }
    ).trim();
    
    testContainers.push(orphanContainerName);
    const orphanContainerId = orphanDockerOutput.substring(0, 12);
    
    // Delete the orphan worktree
    fs.rmSync(orphanWorktreePath, { recursive: true, force: true });
    
    // Run discovery
    const result = await discoverAllAisanityContainers({
      mode: 'global',
      includeOrphaned: true,
      validationMode: 'permissive',
      verbose: true
    });
    
    // Filter to only our test containers
    const filteredTestContainers = result.containers.filter(c => 
      (validContainerId && c.id.startsWith(validContainerId)) ||
      (orphanContainerId && c.id.startsWith(orphanContainerId))
    );
    const filteredTestOrphaned = result.orphaned.filter(c => 
      (validContainerId && c.id.startsWith(validContainerId)) ||
      (orphanContainerId && c.id.startsWith(orphanContainerId))
    );
    
    // Should find both test containers
    expect(filteredTestContainers.length).toBe(2);
    
    // Should have one orphaned container
    expect(filteredTestOrphaned.length).toBe(1);
    
    // Verify which is which
    const validContainer = result.containers.find(c => c.id.startsWith(validContainerId));
    const orphanContainer = result.orphaned.find(c => c.id.startsWith(orphanContainerId));
    
    expect(validContainer).toBeDefined();
    expect(orphanContainer).toBeDefined();
    
    // Verify validation results
    const validValidation = result.validationResults.get(validContainerId);
    const orphanValidation = result.validationResults.get(orphanContainerId);
    
    expect(validValidation?.exists).toBe(true);
    expect(validValidation?.isValid).toBe(true);
    
    expect(orphanValidation?.exists).toBe(false);
    expect(orphanValidation?.isValid).toBe(false);
  });
});