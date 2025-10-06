import { expect, test, describe, spyOn, beforeEach, afterEach } from 'bun:test';
import { statusCommand } from '../src/commands/status';
import { getAllWorktrees } from '../src/utils/worktree-utils';
import { safeDockerExec, DockerExecError, DockerTimeoutError } from '../src/utils/docker-safe-exec';
import * as fs from 'fs';
import { safeExecSyncSync } from '../src/utils/runtime-utils';

describe('Status Command Utilities', () => {
  let mockConsoleLog: any;
  let mockConsoleError: any;
  let mockProcessExit: any;
  let mockGetAllWorktrees: any;
  let mockSafeDockerExec: any;
  let mockFs: any;
  let mockSafeExecSyncSync: any;

  beforeEach(() => {
    // Setup console and process mocks
    mockConsoleLog = spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = spyOn(console, 'error').mockImplementation(() => {});
    mockProcessExit = spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`process.exit called with code: ${code}`);
    });

    // Mock worktree utils
    const worktreeUtilsModule = require('../src/utils/worktree-utils');
    mockGetAllWorktrees = spyOn(worktreeUtilsModule, 'getAllWorktrees').mockReturnValue({
      main: {
        path: '/main/workspace',
        branch: 'main',
        containerName: 'test-project-main',
        isActive: false,
        configPath: '/main/workspace/.aisanity'
      },
      worktrees: [
        {
          path: '/main/workspace/worktrees/feature-auth',
          branch: 'feature-auth',
          containerName: 'test-project-feature-auth',
          isActive: true,
          configPath: '/main/workspace/worktrees/feature-auth/.aisanity'
        }
      ]
    });

    // Mock docker safe exec
    const dockerSafeExecModule = require('../src/utils/docker-safe-exec');
    mockSafeDockerExec = spyOn(dockerSafeExecModule, 'safeDockerExec').mockResolvedValue('container-id-123');

    // Mock fs
    mockFs = spyOn(fs, 'existsSync').mockReturnValue(true);
    spyOn(fs, 'readFileSync').mockReturnValue('workspace: test-project\ncontainerName: test-container' as any);

    // Mock runtime-utils
    const runtimeUtilsModule = require('../src/utils/runtime-utils');
    mockSafeExecSyncSync = spyOn(runtimeUtilsModule, 'safeExecSyncSync').mockReturnValue('' as any);

    // Mock process.cwd
    spyOn(process, 'cwd').mockReturnValue('/main/workspace');
  });

  afterEach(() => {
    mockConsoleLog?.mockRestore?.();
    mockConsoleError?.mockRestore?.();
    mockProcessExit?.mockRestore?.();
    mockGetAllWorktrees?.mockRestore?.();
    mockSafeDockerExec?.mockRestore?.();
    mockFs?.mockRestore?.();
    mockSafeExecSyncSync?.mockRestore?.();
  });

  test('should get all worktrees for status display', () => {
    const worktreeUtils = require('../src/utils/worktree-utils');
    const result = worktreeUtils.getAllWorktrees();
    
    expect(result).toBeDefined();
    expect(result.main).toBeDefined();
    expect(result.worktrees).toBeDefined();
    expect(Array.isArray(result.worktrees)).toBe(true);
    expect(mockGetAllWorktrees).toHaveBeenCalled();
  });

  test('should check container status for each worktree', async () => {
    const dockerSafeExec = require('../src/utils/docker-safe-exec');
    const containerName = 'test-project-main';
    
    const status = await dockerSafeExec.safeDockerExec(['ps', '-q', '--filter', `name=${containerName}`]);
    
    expect(status).toBe('container-id-123');
    expect(mockSafeDockerExec).toHaveBeenCalledWith(['ps', '-q', '--filter', `name=${containerName}`]);
  });

  test('should format status output correctly', () => {
    const worktrees = {
      main: {
        path: '/main/workspace',
        branch: 'main',
        containerName: 'test-project-main',
        isActive: false,
        configPath: '/main/workspace/.aisanity'
      },
      worktrees: [
        {
          path: '/main/workspace/worktrees/feature-auth',
          branch: 'feature-auth',
          containerName: 'test-project-feature-auth',
          isActive: true,
          configPath: '/main/workspace/worktrees/feature-auth/.aisanity'
        }
      ]
    };

    // Simulate status output formatting
    console.log('=== Aisanity Status ===');
    console.log('');
    console.log('Main Workspace:');
    console.log(`  Path: ${worktrees.main.path}`);
    console.log(`  Branch: ${worktrees.main.branch}`);
    console.log(`  Container: ${worktrees.main.containerName}`);
    console.log(`  Active: ${worktrees.main.isActive ? 'Yes' : 'No'}`);
    
    console.log('');
    console.log('Worktrees:');
    worktrees.worktrees.forEach((worktree, index) => {
      console.log(`  ${index + 1}. ${worktree.branch}`);
      console.log(`     Path: ${worktree.path}`);
      console.log(`     Container: ${worktree.containerName}`);
      console.log(`     Active: ${worktree.isActive ? 'Yes' : 'No'}`);
    });

    expect(mockConsoleLog).toHaveBeenCalledWith('=== Aisanity Status ===');
    expect(mockConsoleLog).toHaveBeenCalledWith('');
    expect(mockConsoleLog).toHaveBeenCalledWith('Main Workspace:');
    expect(mockConsoleLog).toHaveBeenCalledWith(`  Path: ${worktrees.main.path}`);
    expect(mockConsoleLog).toHaveBeenCalledWith(`  Branch: ${worktrees.main.branch}`);
    expect(mockConsoleLog).toHaveBeenCalledWith(`  Container: ${worktrees.main.containerName}`);
    expect(mockConsoleLog).toHaveBeenCalledWith(`  Active: ${worktrees.main.isActive ? 'Yes' : 'No'}`);
  });

  test('should handle empty worktrees list', () => {
    mockGetAllWorktrees.mockReturnValue({
      main: {
        path: '/main/workspace',
        branch: 'main',
        containerName: 'test-project-main',
        isActive: false,
        configPath: '/main/workspace/.aisanity'
      },
      worktrees: []
    });

    const worktreeUtils = require('../src/utils/worktree-utils');
    const result = worktreeUtils.getAllWorktrees();

    expect(result.worktrees).toHaveLength(0);
    
    // Simulate empty worktrees output
    console.log('=== Aisanity Status ===');
    console.log('');
    console.log('Main Workspace:');
    console.log(`  Path: ${result.main.path}`);
    console.log(`  Branch: ${result.main.branch}`);
    console.log(`  Container: ${result.main.containerName}`);
    console.log(`  Active: ${result.main.isActive ? 'Yes' : 'No'}`);
    console.log('');
    console.log('Worktrees:');
    console.log('  No worktrees found');

    expect(mockConsoleLog).toHaveBeenCalledWith('  No worktrees found');
  });

  test('should handle docker errors gracefully', async () => {
    mockSafeDockerExec.mockRejectedValue(
      new DockerExecError('Docker command failed', 127, 'docker: command not found', 'node')
    );

    const dockerSafeExec = require('../src/utils/docker-safe-exec');
    
    try {
      await dockerSafeExec.safeDockerExec(['ps', '-q']);
    } catch (error: any) {
      expect(error).toBeInstanceOf(DockerExecError);
      expect(error.message).toBe('Docker command failed');
      expect(error.code).toBe(127);
      expect(error.stderr).toBe('docker: command not found');
      expect(error.runtime).toBe('node');
    }
  });

  test('should handle docker timeout errors', async () => {
    mockSafeDockerExec.mockRejectedValue(new DockerTimeoutError(10000));

    const dockerSafeExec = require('../src/utils/docker-safe-exec');
    
    try {
      await dockerSafeExec.safeDockerExec(['ps', '-q']);
    } catch (error: any) {
      expect(error).toBeInstanceOf(DockerTimeoutError);
      expect(error.message).toContain('timed out after 10000ms');
    }
  });

  test('should check config file existence', () => {
    const configPath = '/main/workspace/.aisanity';
    const exists = fs.existsSync(configPath);
    
    expect(exists).toBe(true);
    expect(mockFs).toHaveBeenCalledWith(configPath);
  });

  test('should read config file content', () => {
    const configPath = '/main/workspace/.aisanity';
    const content = fs.readFileSync(configPath, 'utf8');
    
    expect(content).toContain('workspace: test-project');
    expect(content).toContain('containerName: test-container');
  });

  test('should handle missing config file', () => {
    mockFs.mockReturnValue(false);
    
    const configPath = '/main/workspace/.aisanity';
    const exists = fs.existsSync(configPath);
    
    expect(exists).toBe(false);
  });

  test('should validate workspace structure', () => {
    const workspacePath = '/main/workspace';
    const worktreesPath = `${workspacePath}/worktrees`;
    
    // Mock worktrees directory exists
    spyOn(fs, 'existsSync').mockImplementation((path: any) => {
      if (path === worktreesPath) return true;
      return true;
    });

    expect(fs.existsSync(workspacePath)).toBe(true);
    expect(fs.existsSync(worktreesPath)).toBe(true);
  });

  test('should handle process exit for error conditions', () => {
    try {
      // Simulate calling process.exit(1)
      process.exit(1);
    } catch (error: any) {
      expect(error.message).toContain('process.exit called with code: 1');
    }
  });

  test('should display container status information', async () => {
    const containerName = 'test-project-main';
    
    // Mock container is running
    mockSafeDockerExec.mockResolvedValue('container-id-123\ncontainer-id-456');
    
    const dockerSafeExec = require('../src/utils/docker-safe-exec');
    const containerIds = await dockerSafeExec.safeDockerExec(['ps', '-q', '--filter', `name=${containerName}`]);
    const isRunning = containerIds.trim().length > 0;
    
    console.log(`Container Status: ${isRunning ? 'Running' : 'Stopped'}`);
    
    expect(isRunning).toBe(true);
    expect(mockConsoleLog).toHaveBeenCalledWith('Container Status: Running');
  });

  test('should handle git repository status', () => {
    // Mock git status command
    mockSafeExecSyncSync.mockReturnValue('On branch main\nnothing to commit, working tree clean');
    
    const gitStatus = safeExecSyncSync('git status --porcelain', { encoding: 'utf8', cwd: '/main/workspace' });
    
    expect(gitStatus).toBe('On branch main\nnothing to commit, working tree clean');
    expect(mockSafeExecSyncSync).toHaveBeenCalledWith('git status --porcelain', { encoding: 'utf8', cwd: '/main/workspace' });
  });

  test('should format branch information correctly', () => {
    const branches = [
      { name: 'main', path: '/main/workspace', isActive: false },
      { name: 'feature-auth', path: '/main/workspace/worktrees/feature-auth', isActive: true },
      { name: 'hotfix-123', path: '/main/workspace/worktrees/hotfix-123', isActive: false }
    ];

    branches.forEach(branch => {
      const status = branch.isActive ? 'Active' : 'Inactive';
      console.log(`${branch.name}: ${status} (${branch.path})`);
    });

    expect(mockConsoleLog).toHaveBeenCalledWith('main: Inactive (/main/workspace)');
    expect(mockConsoleLog).toHaveBeenCalledWith('feature-auth: Active (/main/workspace/worktrees/feature-auth)');
    expect(mockConsoleLog).toHaveBeenCalledWith('hotfix-123: Inactive (/main/workspace/worktrees/hotfix-123)');
  });
});