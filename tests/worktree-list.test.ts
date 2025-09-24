import { Command } from 'commander';
import * as path from 'path';
import { worktreeCommand } from '../src/commands/worktree';

// Mock dependencies
jest.mock('../src/utils/worktree-utils', () => ({
  getAllWorktrees: jest.fn(),
  isWorktree: jest.fn(),
}));

jest.mock('../src/utils/docker-safe-exec', () => ({
  safeDockerExec: jest.fn(),
}));

const mockedWorktreeUtils = require('../src/utils/worktree-utils');
const mockedDockerSafeExec = require('../src/utils/docker-safe-exec');

describe('worktree-list command', () => {
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

    // Create a new program instance for each test
    program = new Command();
    program.addCommand(worktreeCommand);

    // Default mock implementations
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

    mockedWorktreeUtils.isWorktree.mockReturnValue(false);
    mockedDockerSafeExec.safeDockerExec.mockResolvedValue('test-project-main\tUp 2 hours\n');
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('successful listing', () => {
it('should list worktrees with main workspace only', async () => {
      await program.parseAsync(['node', 'test', 'worktree', 'list']);

      expect(mockedWorktreeUtils.getAllWorktrees).toHaveBeenCalledWith(process.cwd());
      expect(mockedDockerSafeExec.safeDockerExec).toHaveBeenCalledWith(
        ['ps', '-a', '--filter', 'name=test-project-main', '--format', '{{.Names}}\t{{.Status}}'],
        { verbose: false, timeout: 5000 }
      );

      // Check console output
      expect(mockConsoleLog).toHaveBeenCalledWith('Worktrees for this repository:');
      expect(mockConsoleLog).toHaveBeenCalledWith('');
      expect(mockConsoleLog).toHaveBeenCalledWith('  Main Workspace ');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Path: /main/workspace');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Branch: main');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Container: test-project-main');
      
      // Find the status call
      const statusCall = mockConsoleLog.mock.calls.find(call => 
        call[0] && call[0].includes('Status:')
      );
      expect(statusCall).toBeTruthy();
      expect(statusCall[0]).toBe('   Status: Running (Up 2 hours)');
      
      expect(mockConsoleLog).toHaveBeenCalledWith('   Config: /main/workspace/.aisanity');
      expect(mockConsoleLog).toHaveBeenCalledWith('');
      expect(mockConsoleLog).toHaveBeenCalledWith('No additional worktrees found.');
      expect(mockConsoleLog).toHaveBeenCalledWith('Use "aisanity worktree create <branch>" to create a new worktree.');
      expect(mockConsoleLog).toHaveBeenCalledWith('Current location: Main workspace');
    });

    it('should list worktrees with additional worktrees', async () => {
      mockedWorktreeUtils.getAllWorktrees.mockReturnValue({
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
          },
          {
            path: '/main/workspace/worktrees/feature-ui',
            branch: 'feature-ui',
            containerName: 'test-project-feature-ui',
            isActive: false,
            configPath: '/main/workspace/worktrees/feature-ui/.aisanity'
          }
        ]
      });

      // Mock different container statuses - use a simpler approach
      mockedDockerSafeExec.safeDockerExec.mockImplementation((args: any, options: any) => {
        const filterArg = args.find((arg: string) => arg.startsWith('name='));
        const containerName = filterArg ? filterArg.substring(5) : 'unknown';
        
        if (containerName === 'test-project-main') {
          return Promise.resolve('test-project-main\tUp 2 hours\n');
        } else if (containerName === 'test-project-feature-auth') {
          return Promise.resolve('test-project-feature-auth\tExited (0) 1 hour ago\n');
        } else if (containerName === 'test-project-feature-ui') {
          return Promise.resolve(''); // No container
        }
        return Promise.resolve('');
      });

      await program.parseAsync(['node', 'test', 'worktree', 'list']);

      // Check console output for additional worktrees
      expect(mockConsoleLog).toHaveBeenCalledWith('Additional Worktrees:');
      expect(mockConsoleLog).toHaveBeenCalledWith('');
      expect(mockConsoleLog).toHaveBeenCalledWith('→ feature-auth (active)');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Path: /main/workspace/worktrees/feature-auth');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Branch: feature-auth');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Container: test-project-feature-auth');
      
      // Check that safeDockerExec was called for each container
      expect(mockedDockerSafeExec.safeDockerExec).toHaveBeenCalledWith(
        ['ps', '-a', '--filter', 'name=test-project-main', '--format', '{{.Names}}\t{{.Status}}'],
        { verbose: false, timeout: 5000 }
      );
      expect(mockedDockerSafeExec.safeDockerExec).toHaveBeenCalledWith(
        ['ps', '-a', '--filter', 'name=test-project-feature-auth', '--format', '{{.Names}}\t{{.Status}}'],
        { verbose: false, timeout: 5000 }
      );
      expect(mockedDockerSafeExec.safeDockerExec).toHaveBeenCalledWith(
        ['ps', '-a', '--filter', 'name=test-project-feature-ui', '--format', '{{.Names}}\t{{.Status}}'],
        { verbose: false, timeout: 5000 }
      );
      
      // Find the stopped status call
      const stoppedStatusCalls = mockConsoleLog.mock.calls.filter(call => 
        call[0] && call[0].includes('Status:') && call[0].includes('Stopped')
      );
      expect(stoppedStatusCalls.length).toBeGreaterThan(0);
      expect(stoppedStatusCalls[0][0]).toBe('   Status: Stopped (Exited (0) 1 hour ago)');
      
      expect(mockConsoleLog).toHaveBeenCalledWith('   Config: /main/workspace/worktrees/feature-auth/.aisanity');
      expect(mockConsoleLog).toHaveBeenCalledWith('');
      expect(mockConsoleLog).toHaveBeenCalledWith('  feature-ui ');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Path: /main/workspace/worktrees/feature-ui');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Branch: feature-ui');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Container: test-project-feature-ui');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Status: Not created');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Config: /main/workspace/worktrees/feature-ui/.aisanity');
    });

    it('should handle verbose flag', async () => {
      await program.parseAsync(['node', 'test', 'worktree', 'list', '--verbose']);

      expect(mockedDockerSafeExec.safeDockerExec).toHaveBeenCalledWith(
        ['ps', '-a', '--filter', 'name=test-project-main', '--format', '{{.Names}}\t{{.Status}}'],
        { verbose: true, timeout: 5000 }
      );
    });

    it('should show current worktree when in worktree', async () => {
      mockedWorktreeUtils.isWorktree.mockReturnValue(true);
      
      // Mock process.cwd to return worktree path
      const originalCwd = process.cwd;
      process.cwd = jest.fn().mockReturnValue('/main/workspace/worktrees/feature-auth');

      await program.parseAsync(['node', 'test', 'worktree', 'list']);

      expect(mockConsoleLog).toHaveBeenCalledWith('Current worktree: feature-auth');

      // Restore original cwd
      process.cwd = originalCwd;
    });
  });

  describe('container status handling', () => {
    it('should handle container not created', async () => {
      mockedDockerSafeExec.safeDockerExec.mockResolvedValue('');

      await program.parseAsync(['node', 'test', 'worktree', 'list']);

      expect(mockConsoleLog).toHaveBeenCalledWith('   Status: Not created');
    });

    it('should handle container running', async () => {
      mockedDockerSafeExec.safeDockerExec.mockResolvedValue('test-project-main\tUp 2 hours\n');

      await program.parseAsync(['node', 'test', 'worktree', 'list']);

      // Find the call with the status message
      const statusCall = mockConsoleLog.mock.calls.find(call => 
        call[0] && call[0].includes('Status:')
      );
      expect(statusCall).toBeTruthy();
      expect(statusCall[0]).toBe('   Status: Running (Up 2 hours)');
    });

    it('should handle container stopped', async () => {
      mockedDockerSafeExec.safeDockerExec.mockResolvedValue('test-project-main\tExited (0) 1 hour ago\n');

      await program.parseAsync(['node', 'test', 'worktree', 'list']);

      // Find the call with the status message
      const statusCall = mockConsoleLog.mock.calls.find(call => 
        call[0] && call[0].includes('Status:')
      );
      expect(statusCall).toBeTruthy();
      expect(statusCall[0]).toBe('   Status: Stopped (Exited (0) 1 hour ago)');
    });

    it('should handle docker error', async () => {
      mockedDockerSafeExec.safeDockerExec.mockRejectedValue(new Error('Docker not available'));

      await program.parseAsync(['node', 'test', 'worktree', 'list']);

      expect(mockConsoleLog).toHaveBeenCalledWith('   Status: Unknown (Docker error)');
    });

    it('should handle multiple containers matching filter', async () => {
      mockedDockerSafeExec.safeDockerExec.mockResolvedValue(
        'wrong-container\tUp 1 hour\n' +
        'test-project-main\tUp 2 hours\n' +
        'another-container\tUp 30 minutes\n'
      );

      await program.parseAsync(['node', 'test', 'worktree', 'list']);

      expect(mockConsoleLog).toHaveBeenCalledWith('   Status: Running (Up 2 hours)');
    });
  });

  describe('error handling', () => {
    it('should handle getAllWorktrees failure', async () => {
      mockedWorktreeUtils.getAllWorktrees.mockImplementation(() => {
        throw new Error('Failed to get worktrees');
      });

      await expect(async () => {
        await program.parseAsync(['node', 'test', 'worktree', 'list']);
      }).rejects.toThrow('process.exit called with code: 1');

      expect(mockConsoleError).toHaveBeenCalledWith('Failed to list worktrees:', expect.any(Error));
    });
  });
});