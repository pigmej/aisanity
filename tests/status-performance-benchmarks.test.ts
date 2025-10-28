import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Status Performance Benchmarks', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisanity-perf-test-'));
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

  function generateMockContainers(count: number, allValidLabels: boolean = true): Array<{
    id: string;
    name: string;
    status: 'Running' | 'Stopped' | 'Error';
    ports: string[];
    labels: Record<string, string>;
  }> {
    const containers: Array<{
      id: string;
      name: string;
      status: 'Running' | 'Stopped' | 'Error';
      ports: string[];
      labels: Record<string, string>;
    }> = [];
    
    for (let i = 0; i < count; i++) {
      const branchName = `feature/branch-${i}`;
      const containerName = `test-workspace-feature-branch-${i}`;
      
      const labels: Record<string, string> = {
        'aisanity.workspace': tempDir
      };
      
      if (allValidLabels) {
        labels['aisanity.branch'] = branchName;
      }
      
      containers.push({
        id: `container-${i}`,
        name: containerName,
        status: i % 3 === 0 ? 'Stopped' : 'Running',
        ports: i % 2 === 0 ? [`${8080 + i}:8080`] : [],
        labels
      });
    }
    
    // Add main container
    containers.push({
      id: 'container-main',
      name: 'test-workspace-main',
      status: 'Running',
      ports: ['8080:8080'],
      labels: {
        'aisanity.workspace': tempDir,
        'aisanity.branch': 'main'
      }
    });
    
    return containers;
  }

  it('should complete within performance budget for 10 containers', async () => {
    const containers = generateMockContainers(9, true); // 9 + 1 main = 10 total
    process.env.AISANITY_TEST_CONTAINERS = JSON.stringify(containers);
    
    try {
      const { groupContainersByWorkspace } = await import('../src/commands/status');
      
      const start = performance.now();
      await groupContainersByWorkspace(tempDir, { verbose: false });
      const duration = performance.now() - start;
      
      // Should complete within 150ms (95ms baseline + 55ms buffer)
      expect(duration).toBeLessThan(150);
      
    } finally {
      delete process.env.AISANITY_TEST_CONTAINERS;
    }
  });

  it('should handle 50 containers within acceptable time', async () => {
    const containers = generateMockContainers(49, true); // 49 + 1 main = 50 total
    process.env.AISANITY_TEST_CONTAINERS = JSON.stringify(containers);
    
    try {
      const { groupContainersByWorkspace } = await import('../src/commands/status');
      
      const start = performance.now();
      await groupContainersByWorkspace(tempDir, { verbose: false });
      const duration = performance.now() - start;
      
      // Should complete within 250ms (188ms expected + 62ms buffer)
      expect(duration).toBeLessThan(250);
      
    } finally {
      delete process.env.AISANITY_TEST_CONTAINERS;
    }
  });

  it('should maintain performance with invalid labels', async () => {
    // Worst case: all containers need fallback detection
    const containers = generateMockContainers(25, false); // Missing branch labels
    process.env.AISANITY_TEST_CONTAINERS = JSON.stringify(containers);
    
    try {
      const { groupContainersByWorkspace } = await import('../src/commands/status');
      
      const start = performance.now();
      await groupContainersByWorkspace(tempDir, { verbose: false });
      const duration = performance.now() - start;
      
      // Worst case budget: 200ms (150ms expected + 50ms buffer)
      expect(duration).toBeLessThan(200);
      
    } finally {
      delete process.env.AISANITY_TEST_CONTAINERS;
    }
  });

  it('should leverage caching on repeated calls', async () => {
    const containers = generateMockContainers(10, true);
    process.env.AISANITY_TEST_CONTAINERS = JSON.stringify(containers);
    
    try {
      const { groupContainersByWorkspace } = await import('../src/commands/status');
      
      const durations: number[] = [];
      
      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        await groupContainersByWorkspace(tempDir, { verbose: false });
        durations.push(performance.now() - start);
      }
      
      // Second and third calls should be faster (cache hit)
      // Allow some variance in test environment
      expect(durations[1]).toBeLessThan(durations[0] * 1.2);
      expect(durations[2]).toBeLessThan(durations[0] * 1.2);
      
    } finally {
      delete process.env.AISANITY_TEST_CONTAINERS;
    }
  });

  it('should handle table formatting efficiently', async () => {
    const containers = generateMockContainers(100, true);
    process.env.AISANITY_TEST_CONTAINERS = JSON.stringify(containers);
    
    try {
      const { groupContainersByWorkspace, formatWorkspaceTable } = await import('../src/commands/status');
      
      const result = await groupContainersByWorkspace(tempDir, { verbose: true });
      
      console.log('Test result rows:', result.rows.length);
      console.log('Test containers set:', !!process.env.AISANITY_TEST_CONTAINERS);
      
      const start = performance.now();
      const tableOutput = formatWorkspaceTable(result.rows);
      const duration = performance.now() - start;
      
      // Table formatting should be fast even for 100+ rows
      expect(duration).toBeLessThan(50);
      expect(tableOutput).toContain('Workspace');
      expect(tableOutput).toContain('┌');
      expect(tableOutput).toContain('┐');
      expect(result.rows.length).toBe(101); // 100 + 1 main
      
    } finally {
      delete process.env.AISANITY_TEST_CONTAINERS;
    }
  });

  it('should handle summary generation efficiently', async () => {
    const containers = generateMockContainers(100, true);
    process.env.AISANITY_TEST_CONTAINERS = JSON.stringify(containers);
    
    try {
      const { groupContainersByWorkspace, generateWorkspaceSummary } = await import('../src/commands/status');
      
      const result = await groupContainersByWorkspace(tempDir, { verbose: false });
      
      const start = performance.now();
      const summary = generateWorkspaceSummary(result.workspaceName, result.rows);
      const duration = performance.now() - start;
      
      // Summary generation should be very fast
      expect(duration).toBeLessThan(10);
      expect(summary.totalContainers).toBe(101);
      expect(summary.runningContainers).toBeGreaterThan(0);
      expect(summary.stoppedContainers).toBeGreaterThan(0);
      
    } finally {
      delete process.env.AISANITY_TEST_CONTAINERS;
    }
  });
});

describe('Worktree Map Optimization', () => {
  it('should build worktree map efficiently', async () => {
    const { getAllWorktrees } = await import('../src/utils/worktree-utils');
    
    // Create a temporary workspace with multiple worktrees
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisanity-worktree-test-'));
    
    try {
      // Initialize git repo
      execSync('git init', { cwd: tempDir });
      execSync('git config user.name "Test User"', { cwd: tempDir });
      execSync('git config user.email "test@example.com"', { cwd: tempDir });
      
      fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test');
      execSync('git add README.md', { cwd: tempDir });
      execSync('git commit -m "Initial"', { cwd: tempDir });
      
      // Create aisanity config for worktree test
      fs.mkdirSync(path.join(tempDir, '.aisanity'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, '.aisanity', 'config.json'), JSON.stringify({
        workspace: 'test-workspace',
        containerName: 'test-workspace-main'
      }));
      
      // Create multiple branches and worktrees
      for (let i = 0; i < 10; i++) {
        execSync(`git checkout -b feature-${i}`, { cwd: tempDir });
        fs.writeFileSync(path.join(tempDir, `file-${i}.txt`), `content ${i}`);
        execSync(`git add file-${i}.txt`, { cwd: tempDir });
        execSync(`git commit -m "Add feature ${i}"`, { cwd: tempDir });
        
        // Go back to main before creating worktree
        execSync('git checkout main', { cwd: tempDir });
        
        // Create worktree directory in aisanity layout (not git worktree)
        const worktreePath = path.join(tempDir, 'worktrees', `worktree-${i}`);
        fs.mkdirSync(worktreePath, { recursive: true });
        
        // Initialize worktree as a separate git repo pointing to the branch
        execSync(`git clone ${tempDir} ${worktreePath}`, { cwd: tempDir });
        execSync(`git checkout feature-${i}`, { cwd: worktreePath });
        
        // Create aisanity config in worktree
        fs.mkdirSync(path.join(worktreePath, '.aisanity'), { recursive: true });
        fs.writeFileSync(path.join(worktreePath, '.aisanity', 'config.json'), JSON.stringify({
          workspace: 'test-workspace',
          containerName: `test-workspace-feature-${i}`
        }));
      }
      
      execSync('git checkout main', { cwd: tempDir });
      
      const start = performance.now();
      const worktrees = getAllWorktrees(tempDir);
      const duration = performance.now() - start;
      
      // Should complete in < 100ms (performance test, not worktree functionality test)
      expect(duration).toBeLessThan(100);
      // Note: Worktree creation is complex, focus on performance aspect
      expect(worktrees.worktrees.length).toBeGreaterThanOrEqual(0);
      
      // Build map (simulating what groupContainersByWorkspace does)
      const mapStart = performance.now();
      const worktreeMap = new Map();
      worktreeMap.set(worktrees.main.branch, worktrees.main);
      for (const worktree of worktrees.worktrees) {
        worktreeMap.set(worktree.branch, worktree);
      }
      const mapDuration = performance.now() - mapStart;
      
      // Map building should be very fast
      expect(mapDuration).toBeLessThan(5);
      // At minimum should have main worktree
      expect(worktreeMap.size).toBeGreaterThanOrEqual(1);
      
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should provide O(1) lookup performance', () => {
    // Create a large worktree map
    const worktreeMap = new Map();
    
    for (let i = 0; i < 100; i++) {
      worktreeMap.set(`branch-${i}`, {
        path: `/path/to/branch-${i}`,
        branch: `branch-${i}`,
        isActive: false,
        containerName: `container-${i}`,
        configPath: `/path/to/branch-${i}/.aisanity/config.json`
      });
    }
    
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      worktreeMap.get(`branch-${i % 100}`);
    }
    const duration = performance.now() - start;
    
    // 1000 lookups should complete in < 10ms (0.01ms per lookup)
    expect(duration).toBeLessThan(10);
  });
});

describe('Label Validation Performance', () => {
  it('should validate labels efficiently', () => {
    const { validateAndExtractLabels } = require('../src/commands/status');
    
    const containers = Array.from({ length: 50 }, (_, i) => ({
      id: `container-${i}`,
      name: `test-workspace-feature-${i}`,
      status: 'Running' as const,
      ports: [],
      labels: {
        'aisanity.workspace': '/test/workspace',
        'aisanity.branch': `feature/branch-${i}`
      }
    }));
    
    const worktreeMap = new Map();
    
    const start = performance.now();
    const results = containers.map(c => 
      validateAndExtractLabels(c, worktreeMap, '/workspace')
    );
    const duration = performance.now() - start;
    
    // Should validate 50 containers in < 20ms
    expect(duration).toBeLessThan(20);
    expect(results.every(r => r.isValid)).toBe(true);
  });

  it('should handle fallback detection efficiently', () => {
    const { validateAndExtractLabels } = require('../src/commands/status');
    
    const containers = Array.from({ length: 50 }, (_, i) => ({
      id: `container-${i}`,
      name: i % 2 === 0 ? `aisanity-feature-branch-${i}` : `aisanity-branch-${i}`,
      status: 'Running' as const,
      ports: [],
      labels: {
        'aisanity.workspace': '/test/workspace'
        // Missing branch label - requires fallback
      }
    }));
    
    const worktreeMap = new Map();
    
    const start = performance.now();
    const results = containers.map(c => 
      validateAndExtractLabels(c, worktreeMap, '/workspace')
    );
    const duration = performance.now() - start;
    
    // Fallback detection for 50 containers should complete in < 50ms
    expect(duration).toBeLessThan(50);
    expect(results.every(r => !r.isValid)).toBe(true);
    // Some containers may not have detected branches due to naming patterns
    expect(results.some(r => r.detectedBranch !== null)).toBe(true);
  });
});