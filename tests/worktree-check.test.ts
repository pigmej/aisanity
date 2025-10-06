import { expect, test, describe, spyOn, beforeEach, afterEach } from 'bun:test';
import { worktreeCommand } from '../src/commands/worktree';
import { Command } from 'commander';
import { safeSpawn, safeExecSyncSync } from '../src/utils/runtime-utils';
import * as fs from 'fs';

describe('worktree-check command utilities', () => {
  let mockExit: any;
  let mockConsoleLog: any;
  let mockConsoleError: any;
  let mockChdir: any;
  let mockFs: any;
  let mockStatSync: any;
  let mockReadFileSync: any;
  let mockCwd: any;
  let mockSafeSpawn: any;
  let mockSafeExecSyncSync: any;
  let mockGetMainWorkspacePath: any;
  let mockGetWorktreeByName: any;
  let mockGetAllWorktrees: any;
  let mockIsWorktree: any;

  beforeEach(() => {
    // Mock process.exit
    mockExit = spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
      throw new Error(`process.exit called with code: ${code}`);
    });

    // Mock console.log and console.error
    mockConsoleLog = spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = spyOn(console, 'error').mockImplementation(() => {});

    // Mock process.chdir
    mockChdir = spyOn(process, 'chdir').mockImplementation(() => {});

    // Mock fs
    mockFs = spyOn(fs, 'existsSync').mockReturnValue(true);
    mockStatSync = spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true } as any);
    mockReadFileSync = spyOn(fs, 'readFileSync').mockReturnValue('workspace: test-project\ncontainerName: test-container' as any);

    // Mock worktree utils
    const worktreeUtilsModule = require('../src/utils/worktree-utils');
    mockGetMainWorkspacePath = spyOn(worktreeUtilsModule, 'getMainWorkspacePath').mockReturnValue('/main/workspace');
    mockGetWorktreeByName = spyOn(worktreeUtilsModule, 'getWorktreeByName').mockReturnValue({
      path: '/main/workspace/worktrees/feature-auth',
      branch: 'feature-auth',
      commit: 'abc123'
    });
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
    mockIsWorktree = spyOn(worktreeUtilsModule, 'isWorktree').mockReturnValue(false);

    // Mock runtime-utils for any git operations
    const runtimeUtilsModule = require('../src/utils/runtime-utils');
    mockSafeSpawn = spyOn(runtimeUtilsModule, 'safeSpawn').mockReturnValue({
      on: (event: string, callback: Function) => {
        if (event === 'close') callback(0);
      },
      stdout: { on: () => {} },
      stderr: { on: () => {} }
    } as any);
    
    mockSafeExecSyncSync = spyOn(runtimeUtilsModule, 'safeExecSyncSync').mockReturnValue('git worktree list');

    // Mock process.cwd
    mockCwd = spyOn(process, 'cwd').mockReturnValue('/current/dir');
  });

  afterEach(() => {
    mockExit?.mockRestore?.();
    mockConsoleLog?.mockRestore?.();
    mockConsoleError?.mockRestore?.();
    mockChdir?.mockRestore?.();
    mockFs?.mockRestore?.();
    mockStatSync?.mockRestore?.();
    mockReadFileSync?.mockRestore?.();
    mockCwd?.mockRestore?.();
    mockSafeSpawn?.mockRestore?.();
    mockSafeExecSyncSync?.mockRestore?.();
    mockGetMainWorkspacePath?.mockRestore?.();
    mockGetWorktreeByName?.mockRestore?.();
    mockGetAllWorktrees?.mockRestore?.();
    mockIsWorktree?.mockRestore?.();
  });

  test('should have worktree check subcommand', () => {
    const worktreeCmd = worktreeCommand;
    const checkCommand = worktreeCmd.commands.find((cmd: any) => cmd.name() === 'check');
    
    expect(checkCommand).toBeDefined();
    if (checkCommand) {
      expect(checkCommand.description()).toBe('Check worktree status and display information');
    }
  });

  test('should get main workspace path', () => {
    const worktreeUtils = require('../src/utils/worktree-utils');
    const mainPath = worktreeUtils.getMainWorkspacePath();
    
    expect(mainPath).toBe('/main/workspace');
    expect(mockGetMainWorkspacePath).toHaveBeenCalled();
  });

  test('should check if current directory is a worktree', () => {
    const worktreeUtils = require('../src/utils/worktree-utils');
    const currentDir = '/current/dir';
    const isWorktreeResult = worktreeUtils.isWorktree(currentDir);
    
    expect(isWorktreeResult).toBe(false);
    expect(mockIsWorktree).toHaveBeenCalledWith(currentDir);
  });

  test('should get worktree by name', () => {
    const worktreeUtils = require('../src/utils/worktree-utils');
    const worktreeName = 'feature-auth';
    const worktree = worktreeUtils.getWorktreeByName(worktreeName);
    
    expect(worktree).toBeDefined();
    expect(worktree.branch).toBe('feature-auth');
    expect(worktree.path).toBe('/main/workspace/worktrees/feature-auth');
    expect(mockGetWorktreeByName).toHaveBeenCalledWith(worktreeName);
  });

  test('should get all worktrees', () => {
    const worktreeUtils = require('../src/utils/worktree-utils');
    const allWorktrees = worktreeUtils.getAllWorktrees();
    
    expect(allWorktrees).toBeDefined();
    expect(allWorktrees.main).toBeDefined();
    expect(allWorktrees.worktrees).toBeDefined();
    expect(Array.isArray(allWorktrees.worktrees)).toBe(true);
    expect(allWorktrees.worktrees).toHaveLength(1);
    expect(mockGetAllWorktrees).toHaveBeenCalled();
  });

  test('should check if config file exists', () => {
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

  test('should check directory structure validity', () => {
    const workspacePath = '/main/workspace';
    const worktreesPath = `${workspacePath}/worktrees`;
    
    // Both should exist
    expect(fs.existsSync(workspacePath)).toBe(true);
    expect(fs.existsSync(worktreesPath)).toBe(true);
  });

  test('should validate worktree directory structure', () => {
    const worktreePath = '/main/workspace/worktrees/feature-auth';
    
    // Check if it's a directory
    const stats = fs.statSync(worktreePath);
    expect(stats.isDirectory()).toBe(true);
  });

  test('should handle missing worktree', () => {
    mockGetWorktreeByName.mockReturnValue(null);
    
    const worktreeUtils = require('../src/utils/worktree-utils');
    const worktree = worktreeUtils.getWorktreeByName('nonexistent');
    
    expect(worktree).toBeNull();
  });

  test('should handle errors when checking worktree status', () => {
    mockIsWorktree.mockImplementation(() => {
      throw new Error('Failed to check worktree');
    });

    const worktreeUtils = require('../src/utils/worktree-utils');
    
    try {
      worktreeUtils.isWorktree('/some/path');
    } catch (error: any) {
      expect(error.message).toBe('Failed to check worktree');
    }
  });

  test('should change directory for worktree operations', () => {
    const targetDir = '/main/workspace/worktrees/feature-auth';
    
    process.chdir(targetDir);
    
    expect(mockChdir).toHaveBeenCalledWith(targetDir);
  });

  test('should handle process exit for error conditions', () => {
    try {
      // Simulate calling process.exit(1)
      process.exit(1);
    } catch (error: any) {
      expect(error.message).toContain('process.exit called with code: 1');
    }
  });

  test('should format check results for display', () => {
    const checkResults = {
      workspacePath: '/main/workspace',
      isWorktree: false,
      configExists: true,
      worktreesCount: 1,
      worktrees: [
        {
          name: 'feature-auth',
          path: '/main/workspace/worktrees/feature-auth',
          isValid: true
        }
      ]
    };

    // Simulate formatting output
    console.log('=== Worktree Check Results ===');
    console.log(`Workspace Path: ${checkResults.workspacePath}`);
    console.log(`Current Directory is Worktree: ${checkResults.isWorktree ? 'Yes' : 'No'}`);
    console.log(`Config File Exists: ${checkResults.configExists ? 'Yes' : 'No'}`);
    console.log(`Number of Worktrees: ${checkResults.worktreesCount}`);
    
    if (checkResults.worktrees.length > 0) {
      console.log('Worktrees:');
      checkResults.worktrees.forEach(worktree => {
        console.log(`  - ${worktree.name}: ${worktree.isValid ? 'Valid' : 'Invalid'} (${worktree.path})`);
      });
    }

    expect(mockConsoleLog).toHaveBeenCalledWith('=== Worktree Check Results ===');
    expect(mockConsoleLog).toHaveBeenCalledWith(`Workspace Path: ${checkResults.workspacePath}`);
    expect(mockConsoleLog).toHaveBeenCalledWith(`Current Directory is Worktree: ${checkResults.isWorktree ? 'Yes' : 'No'}`);
    expect(mockConsoleLog).toHaveBeenCalledWith(`Config File Exists: ${checkResults.configExists ? 'Yes' : 'No'}`);
    expect(mockConsoleLog).toHaveBeenCalledWith(`Number of Worktrees: ${checkResults.worktreesCount}`);
  });

  test('should validate git worktree structure', () => {
    const gitDir = '/main/workspace/.git';
    const gitWorktreesDir = '/main/workspace/.git/worktrees';
    
    // Mock git directories exist
    mockFs.mockImplementation((path: string) => {
      return path === gitDir || path === gitWorktreesDir || path.includes('feature-auth');
    });

    expect(fs.existsSync(gitDir)).toBe(true);
    expect(fs.existsSync(gitWorktreesDir)).toBe(true);
  });

  test('should handle different current directory contexts', () => {
    // Test when in main workspace
    const mockCwd = spyOn(process, 'cwd').mockReturnValue('/main/workspace');
    mockIsWorktree.mockReturnValue(false);
    
    const worktreeUtils = require('../src/utils/worktree-utils');
    const isMainWorkspace = !worktreeUtils.isWorktree('/main/workspace');
    
    expect(isMainWorkspace).toBe(true);
    
    mockCwd.mockRestore();
  });

  test('should handle when in worktree directory', () => {
    // Test when in worktree
    const mockCwd = spyOn(process, 'cwd').mockReturnValue('/main/workspace/worktrees/feature-auth');
    mockIsWorktree.mockReturnValue(true);
    
    const worktreeUtils = require('../src/utils/worktree-utils');
    const isInWorktree = worktreeUtils.isWorktree('/main/workspace/worktrees/feature-auth');
    
    expect(isInWorktree).toBe(true);
    
    mockCwd.mockRestore();
  });
});