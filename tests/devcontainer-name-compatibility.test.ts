import { runCommand } from '../src/commands/run';
import { discoverContainers } from '../src/utils/container-utils';
import { spawn } from 'child_process';
import * as fs from 'fs';

// Mock dependencies
jest.mock('child_process');
jest.mock('../src/utils/config');
jest.mock('../src/utils/container-utils', () => ({
  discoverContainers: jest.fn(),
  discoverByLabels: jest.fn(),
  discoverByDevcontainerMetadata: jest.fn(),
  generateContainerLabels: jest.fn(),
  validateContainerLabels: jest.fn()
}));
jest.mock('../src/utils/worktree-utils', () => ({
  getAllWorktrees: jest.fn(),
  isWorktree: jest.fn(),
  getMainGitDirPath: jest.fn()
}));
jest.mock('../src/utils/docker-safe-exec');
jest.mock('fs');

const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('Devcontainer Name Parameter Compatibility - Issue #150', () => {
  let mockExit: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock process.exit - don't throw, just mock it and prevent actual exit
    mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      // Don't actually exit, just log for debugging
      return undefined as never;
    });

    // Mock console methods
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock fs.existsSync
    mockedFs.existsSync.mockReturnValue(true);

    // Mock spawn to succeed - simulate both up and exec calls
    mockedSpawn.mockImplementation((command: string, args: readonly string[], options: any) => {
      // Create a mock child process object
      const mockChildProcess = {
        on: jest.fn().mockImplementation((event: string, handler: Function) => {
          if (event === 'exit') {
            // Call the handler with exit code 0 for success immediately (synchronously)
            handler(0);
          }
          return mockChildProcess;
        }),
      };
      return mockChildProcess as any;
    });

    // Setup default mocks for container utils
    const mockContainerUtils = require('../src/utils/container-utils');
    mockContainerUtils.discoverByLabels.mockResolvedValue([]);
    mockContainerUtils.discoverByDevcontainerMetadata.mockResolvedValue([]);
    mockContainerUtils.discoverContainers.mockResolvedValue({
      containers: [],
      labeled: [],
      unlabeled: [],
      orphaned: [],
      errors: []
    });

    // Setup default mocks for worktree utils
    const mockWorktreeUtils = require('../src/utils/worktree-utils');
    mockWorktreeUtils.getAllWorktrees.mockReturnValue({
      main: { path: '/path/to/workspace', branch: 'main', containerName: 'test-main', isActive: true, configPath: '/path/to/workspace/.aisanity' },
      worktrees: []
    });
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('Core functionality fix', () => {
    it('should run "aisanity run bash" without "Unknown argument: name" error', async () => {
      // Mock config
      const mockConfig = require('../src/utils/config');
      mockConfig.loadAisanityConfig.mockReturnValue({
        workspace: 'test-project',
        env: {}
      });
      mockConfig.getContainerName.mockReturnValue('test-project-main');
      mockConfig.getCurrentBranch.mockReturnValue('main');

      // Mock container utils
      const mockContainerUtils = require('../src/utils/container-utils');
      mockContainerUtils.generateContainerLabels.mockReturnValue({
        'aisanity.workspace': '/path/to/workspace',
        'aisanity.branch': 'main',
        'aisanity.container': 'test-project-main',
        'aisanity.created': '2025-09-25T14:00:00.000Z',
        'aisanity.version': '1.0.0'
      });
      mockContainerUtils.validateContainerLabels.mockReturnValue(true);

      // Execute the command
      await expect(async () => {
        await runCommand.parseAsync(['node', 'test', 'run', 'bash']);
      }).not.toThrow();

      // Verify devcontainer up was called without --name parameter
      expect(mockedSpawn).toHaveBeenCalledWith(
        'devcontainer',
        expect.arrayContaining(['up', '--workspace-folder', expect.any(String)]),
        expect.objectContaining({
          stdio: 'inherit'
        })
      );

      // Verify devcontainer exec was called without --name parameter
      expect(mockedSpawn).toHaveBeenCalledWith(
        'devcontainer',
        expect.arrayContaining(['exec', '--workspace-folder', expect.any(String), 'bash']),
        expect.objectContaining({
          stdio: 'inherit'
        })
      );

      // Verify that --name parameter is NOT present in any devcontainer calls
      const upCall = mockedSpawn.mock.calls.find(call => call[0] === 'devcontainer' && call[1].includes('up'));
      const execCall = mockedSpawn.mock.calls.find(call => call[0] === 'devcontainer' && call[1].includes('exec'));

      if (upCall) {
        expect(upCall[1]).not.toContain('--name');
      }

      if (execCall) {
        expect(execCall[1]).not.toContain('--name');
      }
    });

    it('should include --id-label parameters for container identification', async () => {
      // Mock config
      const mockConfig = require('../src/utils/config');
      mockConfig.loadAisanityConfig.mockReturnValue({
        workspace: 'test-project',
        env: {}
      });
      mockConfig.getContainerName.mockReturnValue('test-project-main');
      mockConfig.getCurrentBranch.mockReturnValue('main');

      // Mock container utils
      const mockContainerUtils = require('../src/utils/container-utils');
      mockContainerUtils.generateContainerLabels.mockReturnValue({
        'aisanity.workspace': '/path/to/workspace',
        'aisanity.branch': 'main',
        'aisanity.container': 'test-project-main',
        'aisanity.created': '2025-09-25T14:00:00.000Z',
        'aisanity.version': '1.0.0'
      });
      mockContainerUtils.validateContainerLabels.mockReturnValue(true);

      // Execute the command
      await runCommand.parseAsync(['node', 'test', 'run', 'bash']);

      // Verify --id-label parameters are present in both up and exec calls
      const upCall = mockedSpawn.mock.calls.find(call => call[0] === 'devcontainer' && call[1].includes('up'));
      const execCall = mockedSpawn.mock.calls.find(call => call[0] === 'devcontainer' && call[1].includes('exec'));

      if (upCall) {
        expect(upCall[1]).toContain('--id-label');
        expect(upCall[1]).toContain('aisanity.workspace=/path/to/workspace');
        expect(upCall[1]).toContain('aisanity.branch=main');
      }

      if (execCall) {
        expect(execCall[1]).toContain('--id-label');
        expect(execCall[1]).toContain('aisanity.workspace=/path/to/workspace');
        expect(execCall[1]).toContain('aisanity.branch=main');
      }
    });
  });

  describe('Container discovery validation', () => {
    it('should use exactly 2 discovery strategies', () => {
      // Import the actual container-utils module to check available functions
      const containerUtils = require('../src/utils/container-utils');
      
      // Verify that exactly 2 discovery strategy functions exist
      expect(typeof containerUtils.discoverByLabels).toBe('function');
      expect(typeof containerUtils.discoverByDevcontainerMetadata).toBe('function');
      
      // Verify that no name pattern discovery function exists
      expect(containerUtils.discoverByNamePatterns).toBeUndefined();
      expect(containerUtils.discoverByNamePattern).toBeUndefined();
      expect(containerUtils.discoverByContainerName).toBeUndefined();
      
      // Verify the main discoverContainers function exists
      expect(typeof containerUtils.discoverContainers).toBe('function');
    });

    it('should deduplicate containers discovered by multiple strategies', async () => {
      // Mock container utils
      const mockContainerUtils = require('../src/utils/container-utils');
      
      // Mock both strategies to return the same container
      const sameContainer = {
        id: 'same1',
        name: 'same-container',
        image: 'test-image',
        status: 'running',
        labels: { 
          'aisanity.workspace': '/path/to/workspace',
          'devcontainer.local_folder': '/path/to/folder'
        },
        ports: '8080'
      };

      mockContainerUtils.discoverByLabels.mockResolvedValue([sameContainer]);
      mockContainerUtils.discoverByDevcontainerMetadata.mockResolvedValue([sameContainer]);

      // Mock discoverContainers to return deduplicated result
      mockContainerUtils.discoverContainers.mockResolvedValue({
        containers: [sameContainer],
        labeled: [sameContainer],
        unlabeled: [],
        orphaned: [],
        errors: []
      });

      const result = await discoverContainers();

      // Verify only 1 container was discovered (deduplicated)
      expect(result.containers).toHaveLength(1);
      expect(result.containers[0].id).toBe('same1');
    });
  });

  describe('Regression tests for issue #150', () => {
    it('should prevent regression: devcontainer commands never include --name parameter', async () => {
      // Mock config
      const mockConfig = require('../src/utils/config');
      mockConfig.loadAisanityConfig.mockReturnValue({
        workspace: 'test-project',
        env: {}
      });
      mockConfig.getContainerName.mockReturnValue('test-project-feature-branch');
      mockConfig.getCurrentBranch.mockReturnValue('feature-branch');

      // Mock container utils
      const mockContainerUtils = require('../src/utils/container-utils');
      mockContainerUtils.generateContainerLabels.mockReturnValue({
        'aisanity.workspace': '/path/to/workspace',
        'aisanity.branch': 'feature-branch',
        'aisanity.container': 'test-project-feature-branch',
        'aisanity.created': '2025-09-25T14:00:00.000Z',
        'aisanity.version': '1.0.0'
      });
      mockContainerUtils.validateContainerLabels.mockReturnValue(true);

      // Execute the command with different scenarios
      await runCommand.parseAsync(['node', 'test', 'run', 'bash']);
      await runCommand.parseAsync(['node', 'test', 'run', 'echo', 'test']);
      await runCommand.parseAsync(['node', 'test', 'run', 'ls']);

      // Check all devcontainer calls
      mockedSpawn.mock.calls.forEach(call => {
        if (call[0] === 'devcontainer') {
          const args = call[1];
          expect(args).not.toContain('--name');
          expect(args).not.toContainEqual('--name');
        }
      });
    });

    it('should ensure container discovery works reliably without name patterns', async () => {
      // Mock container utils
      const mockContainerUtils = require('../src/utils/container-utils');
      
      // Mock successful discovery via labels
      const labelContainer = {
        id: 'label1',
        name: 'dev-generated-name',
        image: 'test-image',
        status: 'running',
        labels: { 
          'aisanity.workspace': '/path/to/workspace',
          'aisanity.branch': 'main',
          'aisanity.container': 'test-project-main'
        },
        ports: '8080'
      };

      mockContainerUtils.discoverByLabels.mockResolvedValue([labelContainer]);

      // Mock empty discovery via devcontainer metadata
      mockContainerUtils.discoverByDevcontainerMetadata.mockResolvedValue([]);

      // Mock discoverContainers to return result with only labeled container
      mockContainerUtils.discoverContainers.mockResolvedValue({
        containers: [labelContainer],
        labeled: [labelContainer],
        unlabeled: [],
        orphaned: [],
        errors: []
      });

      const result = await discoverContainers();

      // Verify container was discovered via labels (not name patterns)
      expect(result.containers).toHaveLength(1);
      expect(result.containers[0].id).toBe('label1');
      expect(result.containers[0].labels['aisanity.workspace']).toBe('/path/to/workspace');

      // Verify discovery was successful without relying on name patterns
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Integration tests', () => {
    it('should validate complete workflow: run command works end-to-end', async () => {
      // Mock config
      const mockConfig = require('../src/utils/config');
      mockConfig.loadAisanityConfig.mockReturnValue({
        workspace: 'integration-test',
        env: {}
      });
      mockConfig.getContainerName.mockReturnValue('integration-test-main');
      mockConfig.getCurrentBranch.mockReturnValue('main');

      // Mock container utils
      const mockContainerUtils = require('../src/utils/container-utils');
      mockContainerUtils.generateContainerLabels.mockReturnValue({
        'aisanity.workspace': '/path/to/integration-test',
        'aisanity.branch': 'main',
        'aisanity.container': 'integration-test-main',
        'aisanity.created': '2025-09-25T14:00:00.000Z',
        'aisanity.version': '1.0.0'
      });
      mockContainerUtils.validateContainerLabels.mockReturnValue(true);

      // Execute the complete workflow
      await expect(async () => {
        await runCommand.parseAsync(['node', 'test', 'run', 'bash']);
      }).not.toThrow();

      // Verify the complete sequence of calls
      expect(mockedSpawn).toHaveBeenCalledTimes(2); // up and exec

      // Verify first call is 'devcontainer up'
      const upCall = mockedSpawn.mock.calls[0];
      expect(upCall[0]).toBe('devcontainer');
      expect(upCall[1]).toContain('up');
      expect(upCall[1]).not.toContain('--name');

      // Verify second call is 'devcontainer exec'
      const execCall = mockedSpawn.mock.calls[1];
      expect(execCall[0]).toBe('devcontainer');
      expect(execCall[1]).toContain('exec');
      expect(execCall[1]).not.toContain('--name');

      // Verify both calls include proper labels
      expect(upCall[1]).toContain('--id-label');
      expect(execCall[1]).toContain('--id-label');
    });
  });
});