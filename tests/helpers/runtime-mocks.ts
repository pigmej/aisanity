/**
 * Runtime mocking utilities for cross-platform compatibility testing
 * Provides standardized mocking patterns for runtime-utils functions
 */

import { spyOn } from 'bun:test';

// Import the actual functions we'll be mocking
import { 
  safeSpawn, 
  safeExecSyncSync, 
  safeExecSync, 
  isBunRuntime,
  getRuntimeInfo 
} from '../../src/utils/runtime-utils';

import { 
  safeDockerExec,
  DockerExecError,
  DockerTimeoutError 
} from '../../src/utils/docker-safe-exec';

export interface RuntimeMocks {
  safeSpawn: any;
  safeExecSyncSync: any;
  safeExecSync: any;
  isBunRuntime: any;
  getRuntimeInfo: any;
  safeDockerExec: any;
  DockerExecError: any;
  DockerTimeoutError: any;
}

export interface MockConfiguration {
  defaultExitCode?: number;
  defaultStdout?: string;
  defaultStderr?: string;
  runtimeType?: 'bun' | 'node';
  enableErrorSimulation?: boolean;
}

export interface MockSpawnResult {
  on: (event: string, callback: Function) => void;
  stdout: { on: (event: string, callback: Function) => void };
  stderr: { on: (event: string, callback: Function) => void };
  pid?: number;
  killed?: boolean;
}

export interface TestContext {
  mocks: RuntimeMocks;
  configuration: MockConfiguration;
  originalEnvironment: any;
  testDirectory: string;
}

/**
 * Creates a mock spawn result that mimics real process behavior
 */
export function createMockSpawnResult(options: {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  pid?: number;
} = {}): MockSpawnResult {
  const { exitCode = 0, stdout = '', stderr = '', pid = 12345 } = options;
  
  return {
    on: (event: string, callback: Function) => {
      if (event === 'close') {
        // Simulate async behavior
        setTimeout(() => callback(exitCode), 0);
      }
      if (event === 'error' && exitCode !== 0) {
        setTimeout(() => callback(new Error(`Process exited with code ${exitCode}`)), 0);
      }
    },
    stdout: { 
      on: (event: string, callback: Function) => {
        if (event === 'data' && stdout) {
          setTimeout(() => callback(Buffer.from(stdout)), 0);
        }
      }
    },
    stderr: { 
      on: (event: string, callback: Function) => {
        if (event === 'data' && stderr) {
          setTimeout(() => callback(Buffer.from(stderr)), 0);
        }
      }
    },
    pid
  };
}

/**
 * Creates mock exec output for common git commands
 */
export function createMockGitOutput(command: string, args: string[]): string {
  const cmdStr = `${command} ${args.join(' ')}`;
  
  if (cmdStr.includes('git status')) {
    return 'On branch main\nnothing to commit, working tree clean';
  }
  if (cmdStr.includes('git branch')) {
    return '* main\n  feature-auth\n  hotfix-123';
  }
  if (cmdStr.includes('git worktree list')) {
    return '/main/workspace abc123 [main]\n/main/workspace/worktrees/feature-auth def456 [feature-auth]';
  }
  if (cmdStr.includes('git worktree prune')) {
    return ''; // No output for successful prune
  }
  
  return 'git command executed successfully';
}

/**
 * Creates mock Docker execution errors
 */
export function createMockDockerExecError(
  message: string, 
  code: number, 
  stderr: string, 
  runtime: 'bun' | 'node'
): DockerExecError {
  return new DockerExecError(message, code, stderr, runtime);
}

/**
 * Creates mock Docker timeout errors
 */
export function createMockDockerTimeoutError(timeout: number): DockerTimeoutError {
  return new DockerTimeoutError(timeout);
}

/**
 * Creates runtime mocks with default configuration
 */
export function setupDefaultRuntimeMocks(): RuntimeMocks {
  return createRuntimeMocks();
}

/**
 * Creates runtime mocks with custom configuration
 */
export function createRuntimeMocks(config: MockConfiguration = {}): RuntimeMocks {
  const {
    defaultExitCode = 0,
    defaultStdout = '',
    defaultStderr = '',
    runtimeType = 'bun',
    enableErrorSimulation = false
  } = config;

  // Mock safeSpawn
  const mockSafeSpawn = spyOn({ safeSpawn }, 'safeSpawn').mockImplementation(
    (command: string, args: string[], options: any = {}) => {
      if (enableErrorSimulation && command === 'error') {
        throw new Error('Simulated spawn error');
      }
      return createMockSpawnResult({
        exitCode: defaultExitCode,
        stdout: defaultStdout,
        stderr: defaultStderr
      });
    }
  );

  // Mock safeExecSyncSync
  const mockSafeExecSyncSync = spyOn({ safeExecSyncSync }, 'safeExecSyncSync').mockImplementation(
    (command: string, options: any = {}) => {
      if (enableErrorSimulation && command.includes('error')) {
        throw new Error(`Command failed: ${command}`);
      }
      return createMockGitOutput(command, command.split(' ').slice(1));
    }
  );

  // Mock safeExecSync (async version)
  const mockSafeExecSync = spyOn({ safeExecSync }, 'safeExecSync').mockImplementation(
    async (command: string, options: any = {}) => {
      if (enableErrorSimulation && command.includes('error')) {
        throw new Error(`Command failed: ${command}`);
      }
      return createMockGitOutput(command, command.split(' ').slice(1));
    }
  );

  // Mock isBunRuntime
  const mockIsBunRuntime = spyOn({ isBunRuntime }, 'isBunRuntime').mockReturnValue(
    runtimeType === 'bun'
  );

  // Mock getRuntimeInfo
  const mockGetRuntimeInfo = spyOn({ getRuntimeInfo }, 'getRuntimeInfo').mockReturnValue({
    runtime: runtimeType,
    version: runtimeType === 'bun' ? '1.2.0' : process.version,
    features: {
      nativeTypeScript: runtimeType === 'bun',
      enhancedSpawn: runtimeType === 'bun',
      shellHelper: runtimeType === 'bun'
    }
  });

  // Mock safeDockerExec
  const mockSafeDockerExec = spyOn({ safeDockerExec }, 'safeDockerExec').mockImplementation(
    async (args: string[], options: any = {}) => {
      if (enableErrorSimulation && args.includes('error')) {
        throw createMockDockerExecError('Docker command failed', 1, 'docker: error', runtimeType);
      }
      if (args.includes('timeout')) {
        throw createMockDockerTimeoutError(10000);
      }
      if (args.includes('ps')) {
        return 'container-id-123\ncontainer-id-456';
      }
      return 'docker-command-output';
    }
  );

  // Mock Docker error constructors
  const mockDockerExecError = spyOn(DockerExecError as any, 'constructor').mockImplementation(
    (message: string, code?: number, stderr?: string, runtime?: 'bun' | 'node') => {
      const error = new Error(message) as any;
      error.name = 'DockerExecError';
      error.code = code;
      error.stderr = stderr;
      error.runtime = runtime;
      return error;
    }
  );

  const mockDockerTimeoutError = spyOn(DockerTimeoutError as any, 'constructor').mockImplementation(
    (timeout: number) => {
      const error = new Error(`Docker command timed out after ${timeout}ms`) as any;
      error.name = 'DockerTimeoutError';
      error.timeout = timeout;
      return error;
    }
  );

  return {
    safeSpawn: mockSafeSpawn,
    safeExecSyncSync: mockSafeExecSyncSync,
    safeExecSync: mockSafeExecSync,
    isBunRuntime: mockIsBunRuntime,
    getRuntimeInfo: mockGetRuntimeInfo,
    safeDockerExec: mockSafeDockerExec,
    DockerExecError: mockDockerExecError,
    DockerTimeoutError: mockDockerTimeoutError
  };
}

/**
 * Restores all runtime mocks to original state
 */
export function restoreRuntimeMocks(mocks: RuntimeMocks): void {
  Object.values(mocks).forEach(mock => {
    mock?.mockRestore?.();
  });
}

/**
 * Validates that mocks are properly configured
 */
export function validateMockConfiguration(mocks: RuntimeMocks): boolean {
  return Object.values(mocks).every(mock => 
    mock && typeof mock.mockReturnValue === 'function'
  );
}

/**
 * Creates mock error objects that match runtime error patterns
 */
export function createMockRuntimeError(message: string, code?: number): Error {
  const error = new Error(message);
  if (code) {
    (error as any).code = code;
  }
  return error;
}

/**
 * Helper for platform-specific mock responses
 */
export function createPlatformMock(windowsResponse: string, unixResponse: string): string {
  return process.platform === 'win32' ? windowsResponse : unixResponse;
}

/**
 * Pre-created common mock results to avoid recreation
 */
export const COMMON_MOCK_RESULTS = {
  successSpawn: createMockSpawnResult({ exitCode: 0 }),
  errorSpawn: createMockSpawnResult({ exitCode: 1 }),
  gitStatus: 'On branch main\nnothing to commit, working tree clean',
  gitBranch: '* main\n  feature-auth\n  hotfix-123',
  gitWorktreeList: '/main/workspace abc123 [main]\n/main/workspace/worktrees/feature-auth def456 [feature-auth]',
  dockerRunning: 'container-id-123\ncontainer-id-456',
  dockerStopped: '',
  dockerNotFound: createMockDockerExecError('Docker command failed', 127, 'docker: command not found', 'node'),
  dockerTimeout: createMockDockerTimeoutError(5000)
};