import { worktreeCommand } from '../src/commands/worktree';
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('fs');
jest.mock('../src/utils/worktree-utils', () => ({
  getMainWorkspacePath: jest.fn(),
  getWorktreeByName: jest.fn(),
  getAllWorktrees: jest.fn(),
  isWorktree: jest.fn(),
}));

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedWorktreeUtils = require('../src/utils/worktree-utils');

describe('worktree-check command', () => {
  let program: Command;
  let mockExit: jest.SpyInstance;
  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;
  let mockChdir: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock process.exit
    mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
      throw new Error(`process.exit called with code: ${code}`);
    });

    // Mock console.log and console.error
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock process.chdir
    mockChdir = jest.spyOn(process, 'chdir').mockImplementation(() => {});

    // Create a new program instance for each test
    program = new Command();
    program.addCommand(worktreeCommand);

    // Default mock implementations
    mockedWorktreeUtils.getMainWorkspacePath.mockReturnValue('/main/workspace');
    mockedWorktreeUtils.isWorktree.mockReturnValue(false);
    mockedFs.existsSync.mockReturnValue(true);
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockChdir.mockRestore();
  });

  describe('path resolution', () => {
    it('should handle absolute paths', async () => {
      const absolutePath = '/absolute/path/to/feature-auth';
      const worktreeInfo = {
        path: absolutePath,
        branch: 'feature-auth',
        containerName: 'test-project-feature-auth',
        isActive: false,
        configPath: `${absolutePath}/.aisanity`
      };
      
      mockedWorktreeUtils.getWorktreeByName.mockReturnValue(worktreeInfo);

      await program.parseAsync(['node', 'test', 'worktree', 'check', absolutePath]);

      expect(mockedWorktreeUtils.getWorktreeByName).toHaveBeenCalledWith('feature-auth', '/main/workspace');
      expect(mockChdir).toHaveBeenCalledWith(absolutePath);
    });

    it('should handle relative paths', async () => {
      const relativePath = 'worktrees/feature-auth';
      const absolutePath = '/current/dir/worktrees/feature-auth';
      const worktreeInfo = {
        path: absolutePath,
        branch: 'feature-auth',
        containerName: 'test-project-feature-auth',
        isActive: false,
        configPath: `${absolutePath}/.aisanity`
      };
      
      mockedWorktreeUtils.getWorktreeByName.mockReturnValue(worktreeInfo);

      // Mock process.cwd to return current directory
      const mockCwd = jest.spyOn(process, 'cwd').mockReturnValue('/current/dir');

      await program.parseAsync(['node', 'test', 'worktree', 'check', relativePath]);

      expect(mockedWorktreeUtils.getWorktreeByName).toHaveBeenCalledWith('feature-auth', '/main/workspace');
      expect(mockChdir).toHaveBeenCalledWith(absolutePath);

      // Restore will be handled automatically by Jest
      mockCwd.mockRestore();
    });

    it('should handle worktree names', async () => {
      const worktreeInfo = {
        path: '/main/workspace/worktrees/feature-auth',
        branch: 'feature-auth',
        containerName: 'test-project-feature-auth',
        isActive: false,
        configPath: '/main/workspace/worktrees/feature-auth/.aisanity'
      };
      
      mockedWorktreeUtils.getWorktreeByName.mockReturnValue(worktreeInfo);

      await program.parseAsync(['node', 'test', 'worktree', 'check', 'feature-auth']);

      expect(mockedWorktreeUtils.getWorktreeByName).toHaveBeenCalledWith('feature-auth', '/main/workspace');
      expect(mockChdir).toHaveBeenCalledWith('/main/workspace/worktrees/feature-auth');
    });

    it('should handle "main" as special case', async () => {
      const mainWorktreeInfo = {
        path: '/main/workspace',
        branch: 'main',
        containerName: 'test-project-main',
        isActive: false,
        configPath: '/main/workspace/.aisanity'
      };
      
      mockedWorktreeUtils.getAllWorktrees.mockReturnValue({
        main: mainWorktreeInfo,
        worktrees: []
      });

      await program.parseAsync(['node', 'test', 'worktree', 'check', 'main']);

      expect(mockedWorktreeUtils.getAllWorktrees).toHaveBeenCalledWith(process.cwd());
      expect(mockChdir).toHaveBeenCalledWith('/main/workspace');
    });
  });

  describe('validation', () => {
    it('should reject if worktree not found', async () => {
      mockedWorktreeUtils.getWorktreeByName.mockReturnValue(null);

      await expect(async () => {
        await program.parseAsync(['node', 'test', 'worktree', 'check', 'feature-auth']);
      }).rejects.toThrow('process.exit called with code: 1');

      expect(mockConsoleError).toHaveBeenCalledWith("Worktree 'feature-auth' not found");
      expect(mockConsoleError).toHaveBeenCalledWith('Use "aisanity worktree list" to see available worktrees');
    });

    it('should reject if worktree path does not exist', async () => {
      const worktreeInfo = {
        path: '/main/workspace/worktrees/feature-auth',
        branch: 'feature-auth',
        containerName: 'test-project-feature-auth',
        isActive: false,
        configPath: '/main/workspace/worktrees/feature-auth/.aisanity'
      };
      
      mockedWorktreeUtils.getWorktreeByName.mockReturnValue(worktreeInfo);
      
      // Mock fs.existsSync to return false for this test
      mockedFs.existsSync.mockReturnValue(false);

      await expect(async () => {
        await program.parseAsync(['node', 'test', 'worktree', 'check', 'feature-auth']);
      }).rejects.toThrow('process.exit called with code: 1');

      expect(mockConsoleError).toHaveBeenCalledWith('Worktree path does not exist: /main/workspace/worktrees/feature-auth');
    });
  });

  describe('successful check', () => {
    it('should check worktree and show information', async () => {
      const worktreeInfo = {
        path: '/main/workspace/worktrees/feature-auth',
        branch: 'feature-auth',
        containerName: 'test-project-feature-auth',
        isActive: false,
        configPath: '/main/workspace/worktrees/feature-auth/.aisanity'
      };
      
      mockedWorktreeUtils.getWorktreeByName.mockReturnValue(worktreeInfo);
      mockedWorktreeUtils.isWorktree.mockReturnValue(false);

await program.parseAsync(['node', 'test', 'worktree', 'check', 'feature-auth']);

      expect(mockChdir).toHaveBeenCalledWith('/main/workspace/worktrees/feature-auth');
       
      expect(mockConsoleLog).toHaveBeenCalledWith('Checking worktree \'feature-auth\' from main workspace');
      expect(mockConsoleLog).toHaveBeenCalledWith('✓ Worktree exists: feature-auth');
      expect(mockConsoleLog).toHaveBeenCalledWith('  Path: /main/workspace/worktrees/feature-auth');
      expect(mockConsoleLog).toHaveBeenCalledWith('  Branch: feature-auth');
      expect(mockConsoleLog).toHaveBeenCalledWith('  Container: test-project-feature-auth');
      expect(mockConsoleLog).toHaveBeenCalledWith('');
      expect(mockConsoleLog).toHaveBeenCalledWith('Note: If this is your first time in this worktree, run \'aisanity run\' to provision the container');
    });

    it('should show current location when checking from worktree', async () => {
      const worktreeInfo = {
        path: '/main/workspace/worktrees/feature-ui',
        branch: 'feature-ui',
        containerName: 'test-project-feature-ui',
        isActive: false,
        configPath: '/main/workspace/worktrees/feature-ui/.aisanity'
      };
      
      mockedWorktreeUtils.getWorktreeByName.mockReturnValue(worktreeInfo);
      mockedWorktreeUtils.isWorktree.mockReturnValue(true);

      // Mock process.cwd to return current worktree path
      const mockCwd = jest.spyOn(process, 'cwd').mockReturnValue('/main/workspace/worktrees/feature-auth');

      await program.parseAsync(['node', 'test', 'worktree', 'check', 'feature-ui']);

      expect(mockConsoleLog).toHaveBeenCalledWith('Checking worktree \'feature-ui\' from worktree \'feature-auth\'');

      // Restore will be handled automatically by Jest
      mockCwd.mockRestore();
    });

    it('should handle verbose flag', async () => {
      const worktreeInfo = {
        path: '/main/workspace/worktrees/feature-auth',
        branch: 'feature-auth',
        containerName: 'test-project-feature-auth',
        isActive: false,
        configPath: '/main/workspace/worktrees/feature-auth/.aisanity'
      };
      
      mockedWorktreeUtils.getWorktreeByName.mockReturnValue(worktreeInfo);
      mockedWorktreeUtils.isWorktree.mockReturnValue(false);

      // Mock process.cwd to return current directory
      const mockCwd = jest.spyOn(process, 'cwd').mockReturnValue('/current/dir');

      await program.parseAsync(['node', 'test', 'worktree', 'check', 'feature-auth', '--verbose']);

      expect(mockConsoleLog).toHaveBeenCalledWith('Current path: /current/dir');
      expect(mockConsoleLog).toHaveBeenCalledWith('Target path: /main/workspace/worktrees/feature-auth');
      expect(mockConsoleLog).toHaveBeenCalledWith('Target branch: feature-auth');
      expect(mockConsoleLog).toHaveBeenCalledWith('Target container: test-project-feature-auth');

      // Restore will be handled automatically by Jest
      mockCwd.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle general errors', async () => {
      mockedWorktreeUtils.getMainWorkspacePath.mockImplementation(() => {
        throw new Error('Failed to get main path');
      });

      await expect(async () => {
        await program.parseAsync(['node', 'test', 'worktree', 'check', 'feature-auth']);
      }).rejects.toThrow('process.exit called with code: 1');

      expect(mockConsoleError).toHaveBeenCalledWith('Failed to check worktree:', expect.any(Error));
    });
  });
});