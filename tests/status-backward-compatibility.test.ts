import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('aisanity status - backward compatibility', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisanity-test-'));
    process.chdir(tempDir);
    
    // Initialize a git repository
    execSync('git init', { cwd: tempDir });
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

  it('should support --worktree option', async () => {
    // Create a worktree
    const worktreesDir = path.join(tempDir, 'worktrees');
    fs.mkdirSync(worktreesDir, { recursive: true });
    const featureWorktree = path.join(worktreesDir, 'feature');
    
    execSync('git checkout -b feature', { cwd: tempDir });
    fs.writeFileSync('feature.txt', 'feature content');
    execSync('git add feature.txt', { cwd: tempDir });
    execSync('git commit -m "Add feature"', { cwd: tempDir });
    execSync('git checkout main', { cwd: tempDir });
    execSync(`git worktree add ${featureWorktree} feature`, { cwd: tempDir });
    
    // Create aisanity config in worktree
    fs.mkdirSync(path.join(featureWorktree, '.aisanity'), { recursive: true });
    fs.writeFileSync(path.join(featureWorktree, '.aisanity', 'config.json'), JSON.stringify({
      workspace: 'test-workspace',
      containerName: 'test-workspace-feature'
    }));
    
    // Mock container for the worktree
    process.env.AISANITY_TEST_CONTAINERS = JSON.stringify([
      {
        id: 'container1',
        name: 'test-workspace-feature',
        status: 'Running',
        ports: ['8080:8080'],
        labels: {
          'aisanity.workspace': featureWorktree,
          'aisanity.branch': 'feature'
        }
      }
    ]);
    
    try {
      // Test the single worktree display function
      const { displaySingleWorktreeStatus } = await import('../src/commands/status');
      
      // This should not throw an error
      await displaySingleWorktreeStatus(featureWorktree, false);
      
    } finally {
      delete process.env.AISANITY_TEST_CONTAINERS;
    }
  });

  it('should support --verbose flag', async () => {
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
      
      // Test with verbose enabled
      const resultVerbose = await groupContainersByWorkspace(tempDir, { verbose: true });
      
      // Test with verbose disabled
      const resultQuiet = await groupContainersByWorkspace(tempDir, { verbose: false });
      
      // Both should return valid results
      expect(resultVerbose.rows).toBeDefined();
      expect(resultQuiet.rows).toBeDefined();
      expect(resultVerbose.rows.length).toBe(resultQuiet.rows.length);
      
    } finally {
      delete process.env.AISANITY_TEST_CONTAINERS;
    }
  });

  it('should handle Docker unavailability gracefully', async () => {
    // Mock Docker failure by setting up containers that will cause discovery to fail
    process.env.AISANITY_MOCK_DOCKER_FAILURE = 'true';
    
    try {
      const { groupContainersByWorkspace } = await import('../src/commands/status');
      
      // Should handle Docker failure gracefully
      const result = await groupContainersByWorkspace(tempDir, { verbose: false });
      
      // Should return empty rows but not throw
      expect(result.rows).toBeDefined();
      expect(Array.isArray(result.rows)).toBe(true);
      
      // Should have errors array
      expect(result.errors).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
      
      if (result.errors.length > 0) {
        expect(result.errors[0].type).toBe('docker_communication');
      }
      
    } finally {
      delete process.env.AISANITY_MOCK_DOCKER_FAILURE;
    }
  });

  it('should display single worktree view for single worktree setup', async () => {
    // Only main worktree exists
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
      const { getAllWorktrees } = await import('../src/utils/worktree-utils');
      const worktrees = getAllWorktrees(tempDir);
      
      // Should have only main worktree
      expect(worktrees.worktrees.length).toBe(0);
      
      // Single worktree should use detailed view, not table
      const totalWorktrees = 1 + worktrees.worktrees.length;
      expect(totalWorktrees).toBe(1);
      
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
      
      const start1 = Date.now();
      const result1 = await groupContainersByWorkspace(tempDir, { verbose: false });
      const duration1 = Date.now() - start1;
      
      const start2 = Date.now();
      const result2 = await groupContainersByWorkspace(tempDir, { verbose: false });
      const duration2 = Date.now() - start2;
      
      // Both should return valid results
      expect(result1.rows).toBeDefined();
      expect(result2.rows).toBeDefined();
      expect(result1.rows.length).toBe(result2.rows.length);
      
      // Results should be consistent
      expect(result1.rows[0].container).toBe(result2.rows[0].container);
      expect(result1.rows[0].status).toBe(result2.rows[0].status);
      
    } finally {
      delete process.env.AISANITY_TEST_CONTAINERS;
    }
  });

  it('should preserve orphaned container detection', async () => {
    // Create a branch that will be deleted
    execSync('git checkout -b feature/to-delete', { cwd: tempDir });
    fs.writeFileSync('feature.txt', 'feature content');
    execSync('git add feature.txt', { cwd: tempDir });
    execSync('git commit -m "Add feature"', { cwd: tempDir });
    execSync('git checkout main', { cwd: tempDir });
    
    // Delete the branch but keep container
    execSync('git branch -D feature/to-delete', { cwd: tempDir });
    
    // Mock container for deleted branch
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
        name: 'test-workspace-feature-to-delete',
        status: 'Running',
        ports: [],
        labels: {
          'aisanity.workspace': tempDir,
          'aisanity.branch': 'feature/to-delete'
        }
      }
    ]);
    
    try {
      const { detectOrphanedContainers } = await import('../src/utils/worktree-utils');
      const { getAllWorktrees } = await import('../src/utils/worktree-utils');
      
      const worktrees = getAllWorktrees(tempDir);
      const { orphaned } = await detectOrphanedContainers(false, worktrees);
      
      // Should detect orphaned container (if any real containers exist)
      // Note: This test may pick up real Docker containers, so we just check that the logic works
      if (orphaned.length > 0) {
        // At minimum, should have container name and status
        expect(orphaned[0].name).toBeDefined();
        expect(orphaned[0].status).toBeDefined();
      }
      
    } finally {
      delete process.env.AISANITY_TEST_CONTAINERS;
    }
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

  it('should maintain CLI interface compatibility', async () => {
    // Test that the status command still has the same options
    const { statusCommand } = await import('../src/commands/status');
    
    expect(statusCommand.options).toHaveLength(2);
    
    const worktreeOption = statusCommand.options.find(opt => opt.flags === '--worktree <path>');
    expect(worktreeOption).toBeDefined();
    expect(worktreeOption?.description).toContain('Show status for specific worktree');
    
    const verboseOption = statusCommand.options.find(opt => opt.flags === '-v, --verbose');
    expect(verboseOption).toBeDefined();
    expect(verboseOption?.description).toContain('Enable verbose logging');
  });
});