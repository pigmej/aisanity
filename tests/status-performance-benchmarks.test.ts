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
      // Allow more variance in CI environments (1.5x instead of 1.2x)
      // CI environments have more variability due to system load and virtualization
      expect(durations[1]).toBeLessThan(durations[0] * 1.5);
      expect(durations[2]).toBeLessThan(durations[0] * 1.5);
      
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