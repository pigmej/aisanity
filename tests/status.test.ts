import { statusCommand } from '../src/commands/status';
import { getAllWorktrees } from '../src/utils/worktree-utils';
import { safeDockerExec } from '../src/utils/docker-safe-exec';

// Mock the dependencies
jest.mock('../src/utils/worktree-utils');
jest.mock('../src/utils/docker-safe-exec');
jest.mock('../src/utils/config', () => ({
  loadAisanityConfig: jest.fn(),
  getContainerName: jest.fn(),
  getCurrentBranch: jest.fn(),
  getWorkspaceName: jest.fn(),
  sanitizeBranchName: jest.fn(),
  validateContainerNameLength: jest.fn(),
  isWorktree: jest.fn(),
  getWorktreeName: jest.fn(),
  generateExpectedContainerName: jest.fn(),
  detectProjectType: jest.fn(),
}));

// Mock Node.js modules
jest.mock('fs');
jest.mock('child_process');

// Mock worktree-utils to avoid execSync calls
jest.mock('../src/utils/worktree-utils', () => ({
  getAllWorktrees: jest.fn(),
  getWorktreeName: jest.fn(),
  getContainerStatus: jest.fn(),
  generateWorktreeContainerName: jest.fn(),
  // Add other functions as needed
}));

const mockedGetAllWorktrees = getAllWorktrees as jest.MockedFunction<typeof getAllWorktrees>;
const mockedSafeDockerExec = safeDockerExec as jest.MockedFunction<typeof safeDockerExec>;

// Mock fs and child_process
const mockFs = require('fs');
const mockChildProcess = require('child_process');

describe('Status Command', () => {
  let mockConsoleLog: jest.SpiedFunction<typeof console.log>;
  let mockConsoleError: jest.SpiedFunction<typeof console.error>;
  let mockProcessExit: jest.SpiedFunction<typeof process.exit>;

  beforeEach(() => {
    // Setup console and process mocks
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockProcessExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`process.exit called with code: ${code}`);
    });

    // Reset all mocks but don't clear the mock implementations
    jest.clearAllMocks();
    
    // Set up default mock implementations
    mockedGetAllWorktrees.mockReturnValue({
      main: {
        path: '/main/workspace',
        branch: 'main',
        containerName: 'myapp-main',
        isActive: true,
        configPath: '/main/workspace/.aisanity'
      },
      worktrees: []
    });
    
    // Mock other worktree-utils functions
    const { getWorktreeName, getContainerStatus, generateWorktreeContainerName } = require('../src/utils/worktree-utils');
    (getWorktreeName as jest.Mock).mockImplementation((path: string) => path.split('/').pop() || 'unknown');
    (getContainerStatus as jest.Mock).mockResolvedValue({ status: 'Running', ports: '3000->3000/tcp' });
    (generateWorktreeContainerName as jest.Mock).mockImplementation((workspace: string, name: string) => `${workspace}-${name}`);
    
    mockedSafeDockerExec.mockResolvedValue('myapp-main\tUp 2 hours\t3000->3000/tcp');
    
    // Set up default fs and child_process mocks
    mockFs.existsSync.mockReturnValue(true);
    mockChildProcess.execSync.mockReturnValue('NAMES\tSTATUS\tPORTS\nmyapp-main\tUp 2 hours\t3000->3000/tcp\n');
    
    // Set up config mocks
    const { loadAisanityConfig, getContainerName, getCurrentBranch, getWorkspaceName } = require('../src/utils/config');
    (loadAisanityConfig as jest.Mock).mockReturnValue({
      workspace: 'myapp',
      containerName: 'myapp-main'
    });
    (getContainerName as jest.Mock).mockReturnValue('myapp-main');
    (getCurrentBranch as jest.Mock).mockReturnValue('main');
    (getWorkspaceName as jest.Mock).mockReturnValue('myapp');
  });

  afterEach(() => {
    // Restore all mocks
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockProcessExit.mockRestore();
  });

  describe('Multiple Worktrees Display', () => {
    it('should display unified table format when multiple worktrees exist', async () => {
      // Mock worktree data
      const mockWorktrees = {
        main: {
          path: '/main/workspace',
          branch: 'main',
          containerName: 'myapp-main',
          isActive: true,
          configPath: '/main/workspace/.aisanity'
        },
        worktrees: [
          {
            path: '/main/workspace/worktrees/feature-auth',
            branch: 'feature-auth',
            containerName: 'myapp-feature-auth',
            isActive: false,
            configPath: '/main/workspace/worktrees/feature-auth/.aisanity'
          }
        ]
      };

      mockedGetAllWorktrees.mockReturnValue(mockWorktrees);
      
      // Mock Docker responses
      mockedSafeDockerExec
        .mockResolvedValueOnce('myapp-main\tUp 2 hours\t3000->3000/tcp')  // main container
        .mockResolvedValueOnce('myapp-feature-auth\tExited (0) 1 hour ago\t');  // feature-auth container

      // Execute command
      await statusCommand.parseAsync(['node', 'test', 'status']);

      // Verify getAllWorktrees was called
      expect(mockedGetAllWorktrees).toHaveBeenCalledWith(process.cwd());

      // Verify Docker calls
      expect(mockedSafeDockerExec).toHaveBeenCalledTimes(2);
      expect(mockedSafeDockerExec).toHaveBeenCalledWith(
        ['ps', '-a', '--filter', 'name=myapp-main', '--format', '{{.Names}}\t{{.Status}}\t{{.Ports}}'],
        { verbose: false, timeout: 5000 }
      );
      expect(mockedSafeDockerExec).toHaveBeenCalledWith(
        ['ps', '-a', '--filter', 'name=myapp-feature-auth', '--format', '{{.Names}}\t{{.Status}}\t{{.Ports}}'],
        { verbose: false, timeout: 5000 }
      );

      // Verify table output contains expected elements
      const consoleCalls = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(consoleCalls).toContain('Worktree');
      expect(consoleCalls).toContain('Branch');
      expect(consoleCalls).toContain('Container');
      expect(consoleCalls).toContain('Status');
      expect(consoleCalls).toContain('Ports');
      expect(consoleCalls).toContain('→ main');  // Active worktree indicator
      expect(consoleCalls).toContain('feature-auth');
      expect(consoleCalls).toContain('Running');
      expect(consoleCalls).toContain('Stopped');
      expect(consoleCalls).toContain('3000->3000/tcp');
      expect(consoleCalls).toContain('Current:');  // Summary section
      expect(consoleCalls).toContain('Total:');    // Summary section
    });

    it('should handle Docker errors gracefully', async () => {
      // Mock worktree data for multiple worktrees (to trigger unified format)
      const mockWorktrees = {
        main: {
          path: '/main/workspace',
          branch: 'main',
          containerName: 'myapp-main',
          isActive: true,
          configPath: '/main/workspace/.aisanity'
        },
        worktrees: [
          {
            path: '/main/workspace/worktrees/feature-auth',
            branch: 'feature-auth',
            containerName: 'myapp-feature-auth',
            isActive: false,
            configPath: '/main/workspace/worktrees/feature-auth/.aisanity'
          }
        ]
      };

      mockedGetAllWorktrees.mockReturnValue(mockWorktrees);
      
      // Mock Docker error
      mockedSafeDockerExec.mockRejectedValue(new Error('Docker not available'));

      // Execute command
      await statusCommand.parseAsync(['node', 'test', 'status']);

      // Verify error handling - should show Unknown status instead of crashing
      const consoleCalls = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(consoleCalls).toContain('Unknown');  // Should show Unknown status for containers
    });
  });

  describe('Single Worktree Display', () => {
    it('should display detailed format when only one worktree exists', async () => {
      // Mock single worktree data
      const mockWorktrees = {
        main: {
          path: '/main/workspace',
          branch: 'main',
          containerName: 'myapp-main',
          isActive: true,
          configPath: '/main/workspace/.aisanity'
        },
        worktrees: []
      };

      mockedGetAllWorktrees.mockReturnValue(mockWorktrees);

      // Mock config and other dependencies
      const { loadAisanityConfig, getContainerName, getCurrentBranch } = require('../src/utils/config');
      (loadAisanityConfig as jest.Mock).mockReturnValue({
        workspace: 'myapp',
        containerName: 'myapp-main'
      });
      (getContainerName as jest.Mock).mockReturnValue('myapp-main');
      (getCurrentBranch as jest.Mock).mockReturnValue('main');

      // Mock Docker execSync for detailed format
      mockChildProcess.execSync
        .mockReturnValueOnce('NAMES\tSTATUS\tPORTS\nmyapp-main\tUp 2 hours\t3000->3000/tcp\n')
        .mockReturnValueOnce('NAMES\tSTATUS\tIMAGE\nmyapp-main-dev\tUp 2 hours\tvscode:latest\n');

      // Execute command
      await statusCommand.parseAsync(['node', 'test', 'status']);

      // Verify detailed format elements
      const consoleCalls = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(consoleCalls).toContain('Workspace: myapp');
      expect(consoleCalls).toContain('Branch: main');
      expect(consoleCalls).toContain('Container: myapp-main');
      expect(consoleCalls).toContain('Main Container:');
      expect(consoleCalls).toContain('Configuration:');
    });
  });

  describe('Worktree Option', () => {
    it('should show status for specific worktree when --worktree option is used', async () => {
      // Mock file system
      mockFs.existsSync.mockReturnValue(true);

      // Mock config and other dependencies for specific worktree
      const { loadAisanityConfig, getContainerName, getCurrentBranch } = require('../src/utils/config');
      (loadAisanityConfig as jest.Mock).mockReturnValue({
        workspace: 'myapp',
        containerName: 'myapp-feature-auth'
      });
      (getContainerName as jest.Mock).mockReturnValue('myapp-feature-auth');
      (getCurrentBranch as jest.Mock).mockReturnValue('feature-auth');

      // Mock Docker execSync for detailed format
      mockChildProcess.execSync
        .mockReturnValueOnce('NAMES\tSTATUS\tPORTS\nmyapp-feature-auth\tUp 1 hour\t3001->3000/tcp\n')
        .mockReturnValueOnce('NAMES\tSTATUS\tIMAGE\nmyapp-feature-auth-dev\tUp 1 hour\tvscode:latest\n');

      // Execute command with worktree option
      await statusCommand.parseAsync(['node', 'test', 'status', '--worktree', '/path/to/worktree']);

      // Verify worktree path handling
      expect(mockFs.existsSync).toHaveBeenCalledWith('/path/to/worktree');

      // Verify detailed format for specific worktree
      const consoleCalls = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(consoleCalls).toContain('Showing status for worktree: /path/to/worktree');
      expect(consoleCalls).toContain('Workspace: myapp');
      expect(consoleCalls).toContain('Branch: feature-auth');
      expect(consoleCalls).toContain('Container: myapp-feature-auth');
    });

    it('should show error when worktree path does not exist', async () => {
      // Mock file system - path doesn't exist
      mockFs.existsSync.mockReturnValue(false);

      // Execute command with non-existent worktree path
      await expect(
        statusCommand.parseAsync(['node', 'test', 'status', '--worktree', '/nonexistent/path'])
      ).rejects.toThrow('process.exit called with code: 1');

      // Verify error message
      expect(mockConsoleError).toHaveBeenCalledWith('Worktree path does not exist: /nonexistent/path');
    });
  });
});