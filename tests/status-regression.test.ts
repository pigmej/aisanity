import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('aisanity status - regression prevention', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisanity-test-'));
    process.chdir(tempDir);
    
    // Initialize a git repository with main as default branch
    try {
      execSync('git init --initial-branch=main', { cwd: tempDir });
    } catch {
      // Fallback for older git versions
      execSync('git init', { cwd: tempDir });
      execSync('git branch -m main', { cwd: tempDir });
    }
    execSync('git config user.name "Test User"', { cwd: tempDir });
    execSync('git config user.email "test@example.com"', { cwd: tempDir });
    
    // Create initial commit
    fs.writeFileSync('README.md', '# Test Repository');
    execSync('git add README.md', { cwd: tempDir });
    execSync('git commit -m "Initial commit"', { cwd: tempDir });
    
    // Initialize aisanity
    fs.mkdirSync('.aisanity', { recursive: true });
    fs.writeFileSync('.aisanity/config.json', JSON.stringify({
      workspace: 'test-workspace',
      containerName: 'test-workspace-main'
    }));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should not break existing container discovery', async () => {
    // Mock containers
    process.env.AISANITY_TEST_CONTAINERS = JSON.stringify([
      {
        id: 'container1',
        name: 'test-workspace-main',
        status: 'Running',
        ports: ['8080:8080'],
        labels: {
          'aisanity.workspace': tempDir,
          'aisanity.branch': 'main'
        }
      }
    ]);
    
    try {
      const { discoverWorkspaceContainers } = await import('../src/utils/container-utils');
      
      // Ensure discoverWorkspaceContainers() still works
      const containers = await discoverWorkspaceContainers(tempDir, { verbose: false });
      
      expect(containers).toBeInstanceOf(Array);
      expect(containers[0]).toHaveProperty('id');
      expect(containers[0]).toHaveProperty('labels');
      expect(containers[0]).toHaveProperty('name');
      expect(containers[0]).toHaveProperty('status');
      expect(containers[0]).toHaveProperty('ports');
    } finally {
      delete process.env.AISANITY_TEST_CONTAINERS;
    }
  });

  it('should maintain cache behavior', async () => {
    // Mock containers
    process.env.AISANITY_TEST_CONTAINERS = JSON.stringify([
      {
        id: 'container1',
        name: 'test-workspace-main',
        status: 'Running',
        ports: ['8080:8080'],
        labels: {
          'aisanity.workspace': tempDir,
          'aisanity.branch': 'main'
        }
      }
    ]);
    
    try {
      const { groupContainersByWorkspace } = await import('../src/commands/status');
      
      const start = Date.now();
      await groupContainersByWorkspace(tempDir, { verbose: false });
      const firstCall = Date.now() - start;
      
      const start2 = Date.now();
      await groupContainersByWorkspace(tempDir, { verbose: false });
      const secondCall = Date.now() - start2;
      
      // Second call should be faster or at least not significantly slower
      // (allowing for some variance in test environment)
      expect(secondCall).toBeLessThan(firstCall * 2);
    } finally {
      delete process.env.AISANITY_TEST_CONTAINERS;
    }
  });

  it('should preserve orphaned container detection', async () => {
    // Create a branch that will be deleted
    execSync('git checkout -b feature/deleted-branch', { cwd: tempDir });
    fs.writeFileSync('feature.txt', 'feature content');
    execSync('git add feature.txt', { cwd: tempDir });
    execSync('git commit -m "Add feature"', { cwd: tempDir });
    execSync('git checkout main', { cwd: tempDir });
    
    // Delete the branch
    execSync('git branch -D feature/deleted-branch', { cwd: tempDir });
    
    // Test that the function exists and is callable
    const { detectOrphanedContainers } = await import('../src/utils/worktree-utils');
    const { getAllWorktrees } = await import('../src/utils/worktree-utils');
    
    expect(typeof detectOrphanedContainers).toBe('function');
    expect(typeof getAllWorktrees).toBe('function');
    
    // Test that it can be called without errors and returns expected structure
    const worktrees = getAllWorktrees(tempDir);
    const result = await detectOrphanedContainers(false, worktrees);
    
    // Should return the expected structure regardless of environment
    expect(result).toHaveProperty('orphaned');
    expect(result).toHaveProperty('worktreePaths');
    expect(Array.isArray(result.orphaned)).toBe(true);
    expect(Array.isArray(result.worktreePaths)).toBe(true);
    
    // Should include main workspace path in worktreePaths (handle path normalization)
    expect(result.worktreePaths.length).toBeGreaterThan(0);
    // Check that at least one path contains the temp directory name
    const tempDirName = path.basename(tempDir);
    expect(result.worktreePaths.some(p => p.includes(tempDirName))).toBe(true);
    
    // Function should not throw and should handle gracefully
    expect(() => detectOrphanedContainers(false, worktrees)).not.toThrow();
  });

  it('should not modify container labels', async () => {
    const originalContainers = [
      {
        id: 'container1',
        name: 'test-workspace-main',
        status: 'Running',
        ports: ['8080:8080'],
        labels: {
          'aisanity.workspace': tempDir,
          'aisanity.branch': 'main'
        }
      }
    ];
    
    process.env.AISANITY_TEST_CONTAINERS = JSON.stringify(originalContainers);
    
    try {
      const { groupContainersByWorkspace } = await import('../src/commands/status');
      
      await groupContainersByWorkspace(tempDir, { verbose: false });
      
      // Containers should remain unchanged
      const currentContainers = JSON.parse(process.env.AISANITY_TEST_CONTAINERS!);
      expect(currentContainers).toEqual(originalContainers);
    } finally {
      delete process.env.AISANITY_TEST_CONTAINERS;
    }
  });

  it('should maintain backward compatibility with existing interfaces', async () => {
    // Test that old functions still exist (even if deprecated)
    const statusModule = await import('../src/commands/status');
    
    // These functions should still be available (deprecated)
    expect(statusModule.mapContainersToWorktrees).toBeDefined();
    expect(statusModule.formatWorktreeTable).toBeDefined();
    expect(statusModule.generateWorktreeSummary).toBeDefined();
    
    // Test that the functions are actually callable
    expect(typeof statusModule.mapContainersToWorktrees).toBe('function');
    expect(typeof statusModule.formatWorktreeTable).toBe('function');
    expect(typeof statusModule.generateWorktreeSummary).toBe('function');
  });

  it('should handle empty workspace gracefully', async () => {
    // No containers
    process.env.AISANITY_TEST_CONTAINERS = JSON.stringify([]);
    
    try {
      const { groupContainersByWorkspace, formatWorkspaceTable } = await import('../src/commands/status');
      
      const result = await groupContainersByWorkspace(tempDir, { verbose: false });
      const tableOutput = formatWorkspaceTable(result.rows);
      
      // Should handle empty workspace gracefully
      expect(result.rows).toHaveLength(0);
      expect(tableOutput).toContain('Workspace');
      expect(tableOutput).toContain('┌');
      expect(tableOutput).toContain('┐');
    } finally {
      delete process.env.AISANITY_TEST_CONTAINERS;
    }
  });

  it('should maintain error handling behavior', async () => {
    // Mock Docker failure
    process.env.AISANITY_MOCK_DOCKER_FAILURE = 'true';
    
    try {
      const { groupContainersByWorkspace } = await import('../src/commands/status');
      
      const result = await groupContainersByWorkspace(tempDir, { verbose: false });
      
      // Should handle errors gracefully
      expect(result.errors).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
      
      if (result.errors.length > 0) {
        expect(result.errors[0]).toHaveProperty('type');
        expect(result.errors[0]).toHaveProperty('message');
        expect(result.errors[0]).toHaveProperty('recovery');
      }
    } finally {
      delete process.env.AISANITY_MOCK_DOCKER_FAILURE;
    }
  });

  it('should preserve workspace filtering logic', async () => {
    // Mock containers from different workspaces
    process.env.AISANITY_TEST_CONTAINERS = JSON.stringify([
      {
        id: 'container1',
        name: 'test-workspace-main',
        status: 'Running',
        ports: [],
        labels: {
          'aisanity.workspace': tempDir,
          'aisanity.branch': 'main'
        }
      },
      {
        id: 'container2',
        name: 'other-workspace-main',
        status: 'Running',
        ports: [],
        labels: {
          'aisanity.workspace': '/other/workspace',
          'aisanity.branch': 'main'
        }
      },
      {
        id: 'container3',
        name: 'random-container',
        status: 'Running',
        ports: [],
        labels: {
          'aisanity.workspace': tempDir,
          'aisanity.branch': 'feature/test'
        }
      }
    ]);
    
    try {
      const { groupContainersByWorkspace } = await import('../src/commands/status');
      
      const result = await groupContainersByWorkspace(tempDir, { verbose: false });
      
      // Should include containers from current workspace
      expect(result.rows.some(row => row.container === 'test-workspace-main')).toBe(true);
      expect(result.rows.some(row => row.container === 'random-container')).toBe(true);
      
      // Should exclude containers from different workspace
      expect(result.rows.some(row => row.container === 'other-workspace-main')).toBe(false);
      
    } finally {
      delete process.env.AISANITY_TEST_CONTAINERS;
    }
  });
});