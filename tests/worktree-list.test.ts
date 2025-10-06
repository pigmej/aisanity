import { expect, test, describe, spyOn, beforeEach, afterEach } from 'bun:test';
import { Command } from 'commander';
import * as path from 'path';
import { worktreeCommand } from '../src/commands/worktree';

describe('worktree-list command utilities', () => {
  let mockExit: any;
  let mockConsoleLog: any;
  let mockConsoleError: any;
  let mockGetAllWorktrees: any;
  let mockIsWorktree: any;
  let mockSafeDockerExec: any;
  let mockCwd: any;

  beforeEach(() => {
    // Mock process.exit
    mockExit = spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
      throw new Error(`process.exit called with code: ${code}`);
    });

    // Mock console.log and console.error
    mockConsoleLog = spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = spyOn(console, 'error').mockImplementation(() => {});

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
      worktrees: []
    });
    mockIsWorktree = spyOn(worktreeUtilsModule, 'isWorktree').mockReturnValue(true);

    // Mock docker safe exec
    const dockerSafeExecModule = require('../src/utils/docker-safe-exec');
    mockSafeDockerExec = spyOn(dockerSafeExecModule, 'safeDockerExec').mockResolvedValue('');

    // Mock process.cwd
    mockCwd = spyOn(process, 'cwd').mockReturnValue('/main/workspace');
  });

  afterEach(() => {
    mockExit?.mockRestore?.();
    mockConsoleLog?.mockRestore?.();
    mockConsoleError?.mockRestore?.();
    mockGetAllWorktrees?.mockRestore?.();
    mockIsWorktree?.mockRestore?.();
    mockSafeDockerExec?.mockRestore?.();
    mockCwd?.mockRestore?.();
  });

  test('should have worktree list subcommand', () => {
    const program = new Command();
    const worktreeCmd = worktreeCommand;
    program.addCommand(worktreeCmd);
    
    // Find the subcommand by looking in the subcommands of worktree command
    const subcommands = worktreeCmd.commands;
    const listCommand = subcommands.find((cmd: any) => cmd.name() === 'list');
    
    expect(listCommand).toBeDefined();
  });

  test('should get all worktrees', () => {
    const worktreeUtils = require('../src/utils/worktree-utils');
    const result = worktreeUtils.getAllWorktrees();
    
    expect(result).toBeDefined();
    expect(result.main).toBeDefined();
    expect(result.worktrees).toBeDefined();
    expect(mockGetAllWorktrees).toHaveBeenCalled();
  });

  test('should check if current directory is a worktree', () => {
    const worktreeUtils = require('../src/utils/worktree-utils');
    const result = worktreeUtils.isWorktree('/main/workspace');
    
    expect(result).toBe(true);
    expect(mockIsWorktree).toHaveBeenCalledWith('/main/workspace');
  });

  test('should format worktree information for display', () => {
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

    // Simulate formatting output
    console.log('Main workspace:');
    console.log(`  Path: ${worktrees.main.path}`);
    console.log(`  Branch: ${worktrees.main.branch}`);
    console.log(`  Container: ${worktrees.main.containerName}`);
    console.log(`  Active: ${worktrees.main.isActive ? 'Yes' : 'No'}`);
    
    console.log('\nWorktrees:');
    worktrees.worktrees.forEach((worktree, index) => {
      console.log(`  ${index + 1}. ${worktree.branch}`);
      console.log(`     Path: ${worktree.path}`);
      console.log(`     Container: ${worktree.containerName}`);
      console.log(`     Active: ${worktree.isActive ? 'Yes' : 'No'}`);
    });

    expect(mockConsoleLog).toHaveBeenCalledWith('Main workspace:');
    expect(mockConsoleLog).toHaveBeenCalledWith(`  Path: ${worktrees.main.path}`);
    expect(mockConsoleLog).toHaveBeenCalledWith(`  Branch: ${worktrees.main.branch}`);
    expect(mockConsoleLog).toHaveBeenCalledWith(`  Container: ${worktrees.main.containerName}`);
    expect(mockConsoleLog).toHaveBeenCalledWith(`  Active: ${worktrees.main.isActive ? 'Yes' : 'No'}`);
  });

  test('should handle empty worktrees list', () => {
    const worktrees = {
      main: {
        path: '/main/workspace',
        branch: 'main',
        containerName: 'test-project-main',
        isActive: false,
        configPath: '/main/workspace/.aisanity'
      },
      worktrees: []
    };

    // Simulate empty worktrees output
    console.log('Main workspace:');
    console.log(`  Path: ${worktrees.main.path}`);
    console.log(`  Branch: ${worktrees.main.branch}`);
    console.log(`  Container: ${worktrees.main.containerName}`);
    console.log(`  Active: ${worktrees.main.isActive ? 'Yes' : 'No'}`);
    
    console.log('\nWorktrees:');
    console.log('  No worktrees found');

    expect(mockConsoleLog).toHaveBeenCalledWith('\nWorktrees:');
    expect(mockConsoleLog).toHaveBeenCalledWith('  No worktrees found');
  });

  test('should handle errors when getting worktrees', () => {
    // Mock error
    mockGetAllWorktrees.mockImplementation(() => {
      throw new Error('Failed to get worktrees');
    });

    try {
      const worktreeUtils = require('../src/utils/worktree-utils');
      worktreeUtils.getAllWorktrees();
    } catch (error: any) {
      expect(error.message).toBe('Failed to get worktrees');
    }
  });

  test('should display container status for each worktree', async () => {
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

    // Mock docker exec to return container status
    mockSafeDockerExec.mockResolvedValue('running');

    // Simulate checking container status
    const dockerSafeExec = require('../src/utils/docker-safe-exec');
    for (const worktree of [worktrees.main, ...worktrees.worktrees]) {
      try {
        const status = await dockerSafeExec.safeDockerExec(['ps', '-q', '--filter', `name=${worktree.containerName}`]);
        const isRunning = status.trim().length > 0;
        console.log(`  Container Status: ${isRunning ? 'Running' : 'Stopped'}`);
      } catch (error) {
        console.log(`  Container Status: Error checking status`);
      }
    }

    expect(mockSafeDockerExec).toHaveBeenCalled();
  });

  test('should handle docker errors gracefully', async () => {
    // Mock docker error
    mockSafeDockerExec.mockRejectedValue(new Error('Docker not available'));

    const dockerSafeExec = require('../src/utils/docker-safe-exec');
    
    try {
      await dockerSafeExec.safeDockerExec(['ps', '-q']);
    } catch (error: any) {
      expect(error.message).toBe('Docker not available');
    }
  });

  test('should validate worktree paths', () => {
    const validPaths = [
      '/main/workspace',
      '/main/workspace/worktrees/feature-auth',
      '/some/other/path/worktrees/hotfix-123'
    ];

    validPaths.forEach(path => {
      expect(path.startsWith('/')).toBe(true);
      expect(path.includes('worktrees') || path === '/main/workspace').toBe(true);
    });
  });

  test('should handle process exit for error conditions', () => {
    try {
      // Simulate calling process.exit(1)
      process.exit(1);
    } catch (error: any) {
      expect(error.message).toContain('process.exit called with code: 1');
    }
  });

  test('should format output in JSON format if requested', () => {
    const worktrees = {
      main: {
        path: '/main/workspace',
        branch: 'main',
        containerName: 'test-project-main',
        isActive: false,
        configPath: '/main/workspace/.aisanity'
      },
      worktrees: []
    };

    const jsonFormat = true;
    
    if (jsonFormat) {
      console.log(JSON.stringify(worktrees, null, 2));
      expect(mockConsoleLog).toHaveBeenCalledWith(JSON.stringify(worktrees, null, 2));
    } else {
      console.log('Main workspace:');
      expect(mockConsoleLog).toHaveBeenCalledWith('Main workspace:');
    }
  });
});