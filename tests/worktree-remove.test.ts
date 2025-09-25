import { worktreeCommand } from '../src/commands/worktree';
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, execSync } from 'child_process';

// Mock dependencies
jest.mock('fs');
jest.mock('child_process');
jest.mock('readline', () => ({
  createInterface: jest.fn().mockReturnValue({
    question: jest.fn().mockImplementation((question, callback) => {
      callback('y');
    }),
    close: jest.fn()
  })
}));

jest.mock('../src/utils/worktree-utils', () => ({
  getMainWorkspacePath: jest.fn(),
  getWorktreeByName: jest.fn(),
  getAllWorktrees: jest.fn(),
}));

jest.mock('../src/utils/docker-safe-exec', () => ({
  safeDockerExec: jest.fn(),
}));

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockedWorktreeUtils = require('../src/utils/worktree-utils');
const mockedDockerSafeExec = require('../src/utils/docker-safe-exec');

describe('worktree-remove command', () => {
  let program: Command;
  let mockExit: jest.SpyInstance;
  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock process.exit
    mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
      throw new Error(`process.exit called with code: ${code}`);
    });

    // Mock console.log and console.error
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock process.cwd
    jest.spyOn(process, 'cwd').mockReturnValue('/main/workspace');

    // Create a new program instance for each test
    program = new Command();
    program.addCommand(worktreeCommand);

    // Default mock implementations
    mockedWorktreeUtils.getMainWorkspacePath.mockReturnValue('/main/workspace');
    mockedWorktreeUtils.getWorktreeByName.mockReturnValue({
      path: '/main/workspace/worktrees/feature-auth',
      branch: 'feature-auth',
      containerName: 'test-project-feature-auth',
      isActive: false,
      configPath: '/main/workspace/worktrees/feature-auth/.aisanity'
    });
    mockedWorktreeUtils.getAllWorktrees.mockReturnValue({
      main: {
        path: '/main/workspace',
        branch: 'main',
        containerName: 'test-project-main',
        isActive: false,
        configPath: '/main/workspace/.aisanity'
      },
      worktrees: []
    });
    mockedFs.existsSync.mockImplementation((path) => {
      const pathStr = path.toString();
      if (pathStr === '/main/workspace/.aisanity') return true;
      if (pathStr === '/main/workspace/worktrees/feature-auth') return true;
      return false;
    });
    mockedFs.readFileSync.mockReturnValue('workspace: test-project\n');
    mockedFs.rmSync.mockImplementation(() => {});

    // Mock execSync for git commands
    mockedExecSync.mockImplementation((command: string, options?: any) => {
      if (options?.encoding === 'utf8') {
        return '/main/workspace\n';
      }
      return Buffer.from('/main/workspace\n', 'utf8');
    });

    // Mock spawn to succeed
    mockedSpawn.mockReturnValue({
      on: jest.fn().mockImplementation((event, handler) => {
        if (event === 'exit') handler(0);
        return this;
      }),
    } as any);

    // Mock docker operations to succeed
    mockedDockerSafeExec.safeDockerExec.mockResolvedValue('');
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('path resolution', () => {
    it('should handle absolute paths', async () => {
      const absolutePath = '/absolute/path/to/feature-auth';
      mockedFs.existsSync.mockReturnValue(true);

      await program.parseAsync(['node', 'test', 'worktree', 'remove', absolutePath]);

      expect(mockedWorktreeUtils.getWorktreeByName).toHaveBeenCalledWith('feature-auth', '/main/workspace');
    });

    it('should handle relative paths', async () => {
      const relativePath = 'worktrees/feature-auth';
      
      await program.parseAsync(['node', 'test', 'worktree', 'remove', relativePath]);

      expect(mockedWorktreeUtils.getWorktreeByName).toHaveBeenCalledWith('feature-auth', '/main/workspace');
    });

    it('should handle worktree names', async () => {
      await program.parseAsync(['node', 'test', 'worktree', 'remove', 'feature-auth']);

      expect(mockedWorktreeUtils.getWorktreeByName).toHaveBeenCalledWith('feature-auth', '/main/workspace');
    });
  });

  describe('validation', () => {
    it('should reject if worktree not found', async () => {
      mockedWorktreeUtils.getWorktreeByName.mockReturnValue(null);

      await expect(async () => {
        await program.parseAsync(['node', 'test', 'worktree', 'remove', 'feature-auth']);
      }).rejects.toThrow("Worktree 'feature-auth' not found");

      expect(mockConsoleError).toHaveBeenCalledWith('Failed to remove worktree:', expect.any(Error));
    });

    it('should reject if worktree path does not exist', async () => {
      mockedFs.existsSync.mockReturnValue(false);

      await expect(async () => {
        await program.parseAsync(['node', 'test', 'worktree', 'remove', 'feature-auth']);
      }).rejects.toThrow('Worktree path does not exist');

      expect(mockConsoleError).toHaveBeenCalledWith('Failed to remove worktree:', expect.any(Error));
    });
  });

  describe('confirmation', () => {
    it('should prompt for confirmation by default', async () => {
      // Override the question implementation for this specific test
      const readline = require('readline');
      const mockQuestion = jest.fn().mockImplementation((question, callback) => {
        callback('y');
      });
      
      readline.createInterface.mockReturnValue({
        question: mockQuestion,
        close: jest.fn()
      });

      await program.parseAsync(['node', 'test', 'worktree', 'remove', 'feature-auth']);

      expect(readline.createInterface).toHaveBeenCalledWith({
        input: process.stdin,
        output: process.stdout
      });
      expect(mockQuestion).toHaveBeenCalledWith(
        `Are you sure you want to remove worktree 'feature-auth'? This will delete the directory and remove the container. [y/N]: `,
        expect.any(Function)
      );
    });

    it('should cancel removal if user declines', async () => {
      // Override the question implementation for this specific test
      const readline = require('readline');
      const mockQuestion = jest.fn().mockImplementation((question, callback) => {
        callback('n');
      });
      
      readline.createInterface.mockReturnValue({
        question: mockQuestion,
        close: jest.fn()
      });

      await expect(async () => {
        await program.parseAsync(['node', 'test', 'worktree', 'remove', 'feature-auth']);
      }).rejects.toThrow('Worktree removal cancelled by user');

      expect(mockConsoleLog).toHaveBeenCalledWith('Worktree removal cancelled');
    });

    it('should skip confirmation with --force flag', async () => {
      await program.parseAsync(['node', 'test', 'worktree', 'remove', 'feature-auth', '--force']);

      // Should not prompt for confirmation
      expect(mockConsoleLog).toHaveBeenCalledWith('Worktree to remove:');
    });
  });

  describe('successful removal', () => {
    it('should stop and remove container', async () => {
      await program.parseAsync(['node', 'test', 'worktree', 'remove', 'feature-auth', '--force']);

      expect(mockedDockerSafeExec.safeDockerExec).toHaveBeenCalledWith(
        ['stop', 'test-project-feature-auth'],
        { verbose: undefined, timeout: 30000 }
      );
      expect(mockedDockerSafeExec.safeDockerExec).toHaveBeenCalledWith(
        ['rm', 'test-project-feature-auth'],
        { verbose: undefined, timeout: 30000 }
      );
    });

    it('should remove git worktree using spawn', async () => {
      await program.parseAsync(['node', 'test', 'worktree', 'remove', 'feature-auth', '--force']);

      expect(mockedSpawn).toHaveBeenCalledWith('git', ['worktree', 'remove', '/main/workspace/worktrees/feature-auth'], {
        cwd: '/main/workspace',
        stdio: 'pipe'
      });
    });

    it('should remove worktree directory', async () => {
      await program.parseAsync(['node', 'test', 'worktree', 'remove', 'feature-auth', '--force']);

      expect(mockedFs.rmSync).toHaveBeenCalledWith('/main/workspace/worktrees/feature-auth', {
        recursive: true,
        force: true
      });
    });

    it('should show success message and remaining worktrees', async () => {
      await program.parseAsync(['node', 'test', 'worktree', 'remove', 'feature-auth', '--force']);

      expect(mockConsoleLog).toHaveBeenCalledWith("✓ Successfully removed worktree 'feature-auth'");
      expect(mockConsoleLog).toHaveBeenCalledWith('');
      expect(mockConsoleLog).toHaveBeenCalledWith('Remaining worktrees: 0');
    });

    it('should handle verbose flag', async () => {
      await program.parseAsync(['node', 'test', 'worktree', 'remove', 'feature-auth', '--force', '--verbose']);

      expect(mockedSpawn).toHaveBeenCalledWith('git', ['worktree', 'remove', '/main/workspace/worktrees/feature-auth'], {
        cwd: '/main/workspace',
        stdio: 'inherit'
      });

      expect(mockConsoleLog).toHaveBeenCalledWith('Removing worktree: feature-auth');
    });
  });

  describe('error handling', () => {
    it('should handle container stop failure gracefully', async () => {
      mockedDockerSafeExec.safeDockerExec.mockImplementation((args: any) => {
        if (args[0] === 'stop') {
          throw new Error('Container not running');
        }
        return Promise.resolve('');
      });

      await program.parseAsync(['node', 'test', 'worktree', 'remove', 'feature-auth', '--force']);

      // Should continue with removal
      expect(mockedSpawn).toHaveBeenCalledWith('git', ['worktree', 'remove', '/main/workspace/worktrees/feature-auth'], {
        cwd: '/main/workspace',
        stdio: 'inherit'
      });
    });

    it('should handle container remove failure gracefully', async () => {
      mockedDockerSafeExec.safeDockerExec.mockImplementation((args: any) => {
        if (args[0] === 'rm') {
          throw new Error('Container does not exist');
        }
        return Promise.resolve('');
      });

      await program.parseAsync(['node', 'test', 'worktree', 'remove', 'feature-auth', '--force']);

      // Should continue with removal
      expect(mockedSpawn).toHaveBeenCalledWith('git', ['worktree', 'remove', '/main/workspace/worktrees/feature-auth'], {
        cwd: '/main/workspace',
        stdio: 'inherit'
      });
    });

    it('should handle git worktree remove failure gracefully', async () => {
      mockedSpawn.mockReturnValue({
        on: jest.fn().mockImplementation((event, handler) => {
          if (event === 'exit') handler(1);
          if (event === 'error') handler(new Error('Git command failed'));
          return this;
        }),
      } as any);

      await program.parseAsync(['node', 'test', 'worktree', 'remove', 'feature-auth', '--force']);

      // Should continue with directory removal
      expect(mockConsoleError).toHaveBeenCalledWith('Failed to remove git worktree: Error: Git command failed');
      expect(mockedFs.rmSync).toHaveBeenCalledWith('/main/workspace/worktrees/feature-auth', {
        recursive: true,
        force: true
      });
    });

    it('should handle general errors', async () => {
      mockedWorktreeUtils.getMainWorkspacePath.mockImplementation(() => {
        throw new Error('Failed to get main path');
      });

      await expect(async () => {
        await program.parseAsync(['node', 'test', 'worktree', 'remove', 'feature-auth']);
      }).rejects.toThrow('Failed to get main path');

      expect(mockConsoleError).toHaveBeenCalledWith('Failed to remove worktree:', expect.any(Error));
    });
  });
});