import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { worktreeCommand } from '../src/commands/worktree';

// Mock fs, path, spawn, and other dependencies
jest.mock('fs');
jest.mock('child_process');
jest.mock('../src/utils/worktree-utils', () => ({
  getMainWorkspacePath: jest.fn(),
  validateBranchName: jest.fn(),
  worktreeExists: jest.fn(),
  copyConfigToWorktree: jest.fn(),
  createAisanityDirectory: jest.fn(),
  getAllWorktrees: jest.fn(),
  isWorktree: jest.fn(),
  getWorktreeName: jest.fn(),
}));

jest.mock('../src/utils/config', () => ({
  loadAisanityConfig: jest.fn(),
  getCurrentBranch: jest.fn(),
}));

// Mock process.chdir
const mockChdir = jest.fn();
Object.defineProperty(process, 'chdir', {
  value: mockChdir,
  writable: true,
});

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockedWorktreeUtils = require('../src/utils/worktree-utils');
const mockedConfig = require('../src/utils/config');

describe('worktree-create command', () => {
  let program: Command;
  let mockExit: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock process.exit
    mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
      throw new Error(`process.exit called with code: ${code}`);
    });

    // Create a new program instance for each test
    program = new Command();
    program.addCommand(worktreeCommand);

    // Default mock implementations
    mockedWorktreeUtils.validateBranchName.mockReturnValue(true);
    mockedWorktreeUtils.getMainWorkspacePath.mockReturnValue('/main/workspace');
    mockedWorktreeUtils.worktreeExists.mockReturnValue(false);
    mockedWorktreeUtils.getAllWorktrees.mockReturnValue({ worktrees: [] });
    mockedConfig.loadAisanityConfig.mockReturnValue({ workspace: 'test-project', env: {} });
    mockedConfig.getCurrentBranch.mockReturnValue('main');
    
    // Mock execSync for git commands
    mockedExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('show-toplevel')) return '/main/workspace/git\n';
      if (cmd.includes('show-ref')) throw new Error('Branch does not exist'); // New branch
      return '';
    });
    
    mockedFs.existsSync.mockImplementation((path: any) => {
        if (typeof path === 'string') {
          if (path.includes('worktrees')) return false; // worktrees directory doesn't exist
          if (path.includes('.aisanity')) return true; // config exists
        }
        return true; // other paths exist
      });
    mockedFs.mkdirSync.mockImplementation(() => undefined);
    mockedFs.readFileSync.mockReturnValue('{}');
    mockedFs.writeFileSync.mockImplementation(() => {});
    mockedFs.readdirSync.mockReturnValue([]);
    mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
    
    // Mock spawn to succeed
    mockedSpawn.mockReturnValue({
      on: jest.fn().mockImplementation((event, handler) => {
        if (event === 'exit') handler(0);
        return this;
      }),
    } as any);
    
    // Mock getAllWorktrees to return a worktree object
    mockedWorktreeUtils.getAllWorktrees.mockReturnValue({
      worktrees: [
        {
          path: path.join('/main/workspace', 'worktrees', 'feature-auth'),
          branch: 'feature-auth',
          containerName: 'test-project-feature-auth',
          configPath: path.join('/main/workspace', 'worktrees', 'feature-auth', '.aisanity', 'config.json')
        }
      ]
    });
  });

  afterEach(() => {
    mockExit.mockRestore();
  });

  describe('validation', () => {
    it('should reject invalid branch names', async () => {
      mockedWorktreeUtils.validateBranchName.mockReturnValue(false);
      
      await expect(async () => {
        await program.parseAsync(['node', 'test', 'worktree', 'create', 'invalid branch']);
      }).rejects.toThrow('process.exit called with code: 1');
      
      expect(mockedWorktreeUtils.validateBranchName).toHaveBeenCalledWith('invalid branch');
    });

    it('should reject if worktree already exists', async () => {
      mockedWorktreeUtils.worktreeExists.mockReturnValue(true);
      
      await expect(async () => {
        await program.parseAsync(['node', 'test', 'worktree', 'create', 'feature-auth']);
      }).rejects.toThrow('process.exit called with code: 1');
      
      expect(mockedWorktreeUtils.worktreeExists).toHaveBeenCalledWith('feature-auth', '/main/workspace');
    });

    it('should reject if no .aisanity config found', async () => {
      mockedConfig.loadAisanityConfig.mockReturnValue(null);
      
      await expect(async () => {
        await program.parseAsync(['node', 'test', 'worktree', 'create', 'feature-auth']);
      }).rejects.toThrow('process.exit called with code: 1');
    });
  });

  describe('successful worktree creation', () => {
    it('should create worktree with new branch', async () => {
      // Mock execSync to simulate branch doesn't exist (so it uses -b flag)
      const originalExecSync = require('child_process').execSync;
      const mockedExecSync = jest.fn()
        .mockImplementation(() => {
          throw new Error('Branch does not exist');
        });
      
      require('child_process').execSync = mockedExecSync;
      
      await program.parseAsync(['node', 'test', 'worktree', 'create', 'feature-auth']);
      
      expect(mockedWorktreeUtils.getMainWorkspacePath).toHaveBeenCalledWith(process.cwd());
      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(
        path.join('/main/workspace', 'worktrees'),
        { recursive: true }
      );
      
      // Check git worktree add command for new branch
      expect(mockedSpawn).toHaveBeenCalledWith('git', ['worktree', 'add', '-b', 'feature-auth', path.join('/main/workspace', 'worktrees', 'feature-auth')], {
        cwd: '/main/workspace',
        stdio: 'pipe'
      });
      
      // Restore original execSync
      require('child_process').execSync = originalExecSync;
    });

    it('should create worktree with existing branch', async () => {
      // Mock git show-ref to simulate existing branch
      const originalExecSync = require('child_process').execSync;
      const mockedExecSync = jest.fn()
        .mockReturnValueOnce('') // First call for branch check (success)
        .mockReturnValueOnce('feature-auth\n'); // Second call for getCurrentBranch
      
      require('child_process').execSync = mockedExecSync;
      
      await program.parseAsync(['node', 'test', 'worktree', 'create', 'feature-auth']);
      
      // Check git worktree add command for existing branch (no -b flag) - CORRECT ORDER: path first, then branch
      expect(mockedSpawn).toHaveBeenCalledWith('git', ['worktree', 'add', path.join('/main/workspace', 'worktrees', 'feature-auth'), 'feature-auth'], {
        cwd: '/main/workspace',
        stdio: 'pipe'
      });
      
      // Restore original execSync
      require('child_process').execSync = originalExecSync;
    });

    it('should handle verbose flag', async () => {
      // Mock execSync to simulate branch doesn't exist (so it uses -b flag)
      const originalExecSync = require('child_process').execSync;
      const mockedExecSync = jest.fn()
        .mockImplementation(() => {
          throw new Error('Branch does not exist');
        });
      
      require('child_process').execSync = mockedExecSync;
      
      await program.parseAsync(['node', 'test', 'worktree', 'create', 'feature-auth', '--verbose']);
      
      expect(mockedSpawn).toHaveBeenCalledWith('git', ['worktree', 'add', '-b', 'feature-auth', path.join('/main/workspace', 'worktrees', 'feature-auth')], {
        cwd: '/main/workspace',
        stdio: 'inherit'
      });
      
      // Restore original execSync
      require('child_process').execSync = originalExecSync;
    });

    it('should not switch to worktree when --no-switch is used', async () => {
      mockChdir.mockClear();
      
      await program.parseAsync(['node', 'test', 'worktree', 'create', 'feature-auth', '--no-switch']);
      
      expect(mockChdir).not.toHaveBeenCalled();
    });

    it('should switch to worktree by default', async () => {
      // Mock execSync to simulate branch doesn't exist (so it uses -b flag)
      const originalExecSync = require('child_process').execSync;
      const mockedExecSync = jest.fn()
        .mockImplementation(() => {
          throw new Error('Branch does not exist');
        });
      
      require('child_process').execSync = mockedExecSync;
      
      mockChdir.mockClear();
      
      await program.parseAsync(['node', 'test', 'worktree', 'create', 'feature-auth']);
      
      expect(mockChdir).toHaveBeenCalledWith(path.join('/main/workspace', 'worktrees', 'feature-auth'));
      
      // Restore original execSync
      require('child_process').execSync = originalExecSync;
    });
  });

  describe('error handling', () => {
    it('should handle git worktree add failure', async () => {
      mockedSpawn.mockReturnValue({
        on: jest.fn().mockImplementation((event, handler) => {
          if (event === 'exit') handler(1);
          if (event === 'error') handler(new Error('Git command failed'));
          return this;
        }),
      } as any);
      
      await expect(async () => {
        await program.parseAsync(['node', 'test', 'worktree', 'create', 'feature-auth']);
      }).rejects.toThrow('process.exit called with code: 1');
    });

    it('should handle container provisioning failure gracefully', async () => {
      // Mock execSync to simulate branch doesn't exist (so it uses -b flag)
      const originalExecSync = require('child_process').execSync;
      const mockedExecSync = jest.fn()
        .mockImplementation(() => {
          throw new Error('Branch does not exist');
        });
      
      require('child_process').execSync = mockedExecSync;
      
      // Mock devcontainer spawn to fail
      const originalSpawn = mockedSpawn;
      mockedSpawn.mockImplementation((command: string, args: readonly string[], options: any) => {
        if (command === 'devcontainer') {
          return {
            on: jest.fn().mockImplementation((event, handler) => {
              if (event === 'exit') handler(1);
              if (event === 'error') handler(new Error('Devcontainer failed'));
              return this;
            }),
          } as any;
        }
        return originalSpawn(command, args, options);
      });
      
      // Mock fs.existsSync to return true for devcontainer.json
      mockedFs.existsSync.mockImplementation((path: any) => {
        if (typeof path === 'string' && path.includes('.devcontainer/devcontainer.json')) {
          return true;
        }
        if (typeof path === 'string' && path.includes('worktrees') && !path.includes('devcontainer.json')) {
          return false; // worktrees directory doesn't exist
        }
        return true;
      });
      
      await program.parseAsync(['node', 'test', 'worktree', 'create', 'feature-auth']);
      
      // Should not exit, should continue with warning
      expect(mockExit).not.toHaveBeenCalled();
      
      // Restore original execSync
      require('child_process').execSync = originalExecSync;
    });
  });
});