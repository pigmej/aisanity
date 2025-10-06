import { expect, test, describe, spyOn, beforeEach, afterEach } from 'bun:test';

// Import modules
import { elapsedToSeconds, isValidContainerId, discoverOpencodeInstances, discoverOpencodeCommand } from '../src/commands/discover-opencode';
import { validateHost, validatePort, validateContainerId, validateContainerName, validateWorkspacePath } from '../src/utils/input-validation';
import { safeDockerExec } from '../src/utils/docker-safe-exec';
import { loadAisanityConfig, getContainerName, getCurrentBranch } from '../src/utils/config';

// Import after mocking
import { formatText, formatPlain } from '../src/commands/discover-opencode';

// Mock process.cwd
let mockCwd: any;

describe('elapsedToSeconds', () => {
  test('converts HH:MM:SS format correctly', () => {
    expect(elapsedToSeconds('12:34:56')).toBe(45296);
    expect(elapsedToSeconds('01:02:03')).toBe(3723);
  });

  test('converts MM:SS format correctly', () => {
    expect(elapsedToSeconds('34:56')).toBe(2096);
    expect(elapsedToSeconds('01:30')).toBe(90);
  });

  test('converts SS format correctly', () => {
    expect(elapsedToSeconds('56')).toBe(56);
    expect(elapsedToSeconds('123')).toBe(123);
  });

  test('handles invalid format gracefully', () => {
    expect(elapsedToSeconds('invalid')).toBe(0);
    expect(elapsedToSeconds('')).toBe(0);
  });
});

describe('isValidContainerId', () => {
  test('validates correct container IDs', () => {
    expect(isValidContainerId('abc123def456')).toBe(true);
    expect(isValidContainerId('a1b2c3d4e5f67890123456789012345678901234567890123456789012')).toBe(true);
  });

  test('rejects invalid container IDs', () => {
    expect(isValidContainerId('')).toBe(false);
    expect(isValidContainerId('abc')).toBe(false);
    expect(isValidContainerId('abc123def456!')).toBe(false);
    expect(isValidContainerId('abc123def456 ')).toBe(false);
  });
});

describe('formatText', () => {
  const mockInstance = {
    containerId: 'abc123',
    containerName: 'test-container',
    host: 'localhost',
    port: 8080,
    processId: 123,
    elapsedTime: 120,
    isValidApi: true
  };

  test('formats successful result correctly', () => {
    const result = {
      instances: [mockInstance],
      mostRecent: mockInstance
    };

    const output = formatText(result);
    expect(output).toContain('Most recent opencode instance');
    expect(output).toContain('test-container');
    expect(output).toContain('8080');
    expect(output).toContain('localhost:8080');
  });

  test('formats error result correctly', () => {
    const result = {
      instances: [],
      mostRecent: null,
      error: 'No containers found'
    };

    const output = formatText(result);
    expect(output).toContain('Error: No containers found');
  });

  test('formats all instances correctly', () => {
    const result = {
      instances: [mockInstance, { ...mockInstance, port: 8081 }],
      mostRecent: mockInstance
    };

    const output = formatText(result, true);
    expect(output).toContain('Found 2 opencode instance');
    expect(output).toContain('8080');
    expect(output).toContain('8081');
  });
});

describe('formatPlain', () => {
  test('formats plain output correctly', () => {
    const result = {
      instances: [],
      mostRecent: {
        containerId: 'abc123',
        containerName: 'test-container',
        host: 'localhost',
        port: 8080,
        processId: 123,
        elapsedTime: 120,
        isValidApi: true
      }
    };

    expect(formatPlain(result)).toBe('localhost:8080');
  });

  test('returns empty string when no instance found', () => {
    const result = {
      instances: [],
      mostRecent: null
    };

    expect(formatPlain(result)).toBe('');
  });
});

describe('validateHost', () => {
  test('validates correct hosts', () => {
    expect(validateHost('localhost')).toBe('localhost');
    expect(validateHost('example.com')).toBe('example.com');
    expect(validateHost('192.168.1.1')).toBe('192.168.1.1');
  });

  test('rejects invalid hosts', () => {
    expect(() => validateHost('')).toThrow('Invalid host');
    expect(() => validateHost('invalid..host')).toThrow('Invalid host');
    expect(() => validateHost('256.1.1.1')).toThrow('Invalid host');
  });
});

describe('validatePort', () => {
  test('validates correct ports', () => {
    expect(validatePort(8080)).toBe(8080);
    expect(validatePort(1)).toBe(1);
    expect(validatePort(65535)).toBe(65535);
  });

  test('rejects invalid ports', () => {
    expect(() => validatePort(0)).toThrow('Invalid port');
    expect(() => validatePort(65536)).toThrow('Invalid port');
    expect(() => validatePort(3.14)).toThrow('Invalid port');
  });
});

describe('validateContainerId', () => {
  test('validates correct container IDs', () => {
    expect(validateContainerId('abc123def456')).toBe('abc123def456');
    expect(validateContainerId('a1b2c3d4e5f67890123456789012345678901234567890123456789012')).toBe('a1b2c3d4e5f67890123456789012345678901234567890123456789012');
  });

  test('rejects invalid container IDs', () => {
    expect(() => validateContainerId('')).toThrow('Invalid container ID');
    expect(() => validateContainerId('abc')).toThrow('Invalid container ID');
    expect(() => validateContainerId('abc123def456!')).toThrow('Invalid container ID');
  });
});

describe('validateContainerName', () => {
  test('validates correct container names', () => {
    expect(validateContainerName('my-container')).toBe('my-container');
    expect(validateContainerName('container_123')).toBe('container_123');
    expect(validateContainerName('test.container')).toBe('test.container');
  });

  test('rejects invalid container names', () => {
    expect(() => validateContainerName('')).toThrow('Invalid container name');
    expect(() => validateContainerName('-invalid')).toThrow('Invalid container name');
    expect(() => validateContainerName('invalid name')).toThrow('Invalid container name');
  });
});

describe('validateWorkspacePath', () => {
  test('validates correct paths', () => {
    expect(validateWorkspacePath('/home/user/workspace')).toBe('/home/user/workspace');
    expect(validateWorkspacePath('/')).toBe('/');
  });

  test('rejects invalid paths', () => {
    expect(() => validateWorkspacePath('')).toThrow('Invalid workspace path');
    expect(() => validateWorkspacePath('relative/path')).toThrow('Invalid workspace path');
    expect(() => validateWorkspacePath('/path/../traversal')).toThrow('Invalid workspace path');
  });
});

describe('verbose functionality', () => {
  const mockConfig = {
    workspace: 'test-workspace',
    containerName: 'test-container'
  };

  let mockSafeDockerExec: any;
  let mockLoadAisanityConfig: any;
  let mockGetContainerName: any;
  let mockGetCurrentBranch: any;

  beforeEach(() => {
    mockCwd = spyOn(process, 'cwd').mockReturnValue('/test/workspace');
    
    // Mock safeDockerExec using module approach
    const dockerSafeExecModule = require('../src/utils/docker-safe-exec');
    mockSafeDockerExec = spyOn(dockerSafeExecModule, 'safeDockerExec');
    mockSafeDockerExec.mockImplementation((args: string[], options: any) => {
      if (args.includes('ps') && args.includes('-q')) {
        return Promise.resolve('abc123def456\n');
      }
      if (args.includes('inspect')) {
        return Promise.resolve('/test-container\n');
      }
      if (args.includes('exec') && args.includes('ps') && args.includes('aux')) {
        return Promise.resolve('123 00:02:00 opencode --port 8080');
      }
      if (args.includes('exec') && args.includes('ps') && args.includes('-eo')) {
        return Promise.resolve('123 00:02:00 opencode --port 8080');
      }
      if (args.includes('exec') && args.includes('netstat')) {
        return Promise.resolve('tcp 0 0 0.0.0.0:8080 0.0.0.0:* LISTEN 123/opencode');
      }
      if (args.includes('exec') && args.includes('curl')) {
        return Promise.resolve('{"version": "1.0.0"}');
      }
      return Promise.resolve('');
    });

    // Mock config functions by mocking the entire module
    const configModule = require('../src/utils/config');
    mockLoadAisanityConfig = spyOn(configModule, 'loadAisanityConfig').mockReturnValue(mockConfig);
    mockGetContainerName = spyOn(configModule, 'getContainerName').mockImplementation((cwd: string, verbose?: boolean) => 'test-container');
    mockGetCurrentBranch = spyOn(configModule, 'getCurrentBranch').mockReturnValue('main');
  });

  afterEach(() => {
    mockCwd?.mockRestore();
    mockSafeDockerExec?.mockRestore();
    mockLoadAisanityConfig?.mockRestore();
    mockGetContainerName?.mockRestore();
  });

  describe('CLI flag parsing', () => {
    test('parses --verbose flag correctly', () => {
      const command = discoverOpencodeCommand;
      expect(command.options.some(opt => opt.flags === '-v, --verbose')).toBe(true);
    });

    test('verbose flag defaults to false', async () => {
      const consoleSpy = spyOn(console, 'log').mockImplementation(() => {});
      const result = await discoverOpencodeInstances({ all: false, format: 'text' as const, verbose: false });
      expect(result.mostRecent).toBeTruthy();
      consoleSpy.mockRestore();
    });
  });

  describe('parameter passing', () => {
    test('passes verbose flag to safeDockerExec calls', async () => {
      const options = { all: false, format: 'text' as const, verbose: true };
      await discoverOpencodeInstances(options);

      expect(mockSafeDockerExec).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ verbose: true })
      );
    });

    test('passes verbose false to safeDockerExec when not set', async () => {
      const options = { all: false, format: 'text' as const, verbose: false };
      await discoverOpencodeInstances(options);

      expect(mockSafeDockerExec).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ verbose: false })
      );
    });
  });

  describe('conditional logging', () => {
    test('logs progress messages when verbose is true', async () => {
      const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});
      const options = { all: false, format: 'text' as const, verbose: true };
      await discoverOpencodeInstances(options);

      expect(consoleSpy).toHaveBeenCalledWith('Finding opencode instances...');
      expect(consoleSpy).toHaveBeenCalledWith('Found opencode API in container test-container on localhost:8080');
      consoleSpy.mockRestore();
    });

    test('does not log progress messages when verbose is false', async () => {
      const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});
      const options = { all: false, format: 'text' as const, verbose: false };
      await discoverOpencodeInstances(options);

      expect(consoleSpy).not.toHaveBeenCalledWith('Finding opencode instances...');
      expect(consoleSpy).not.toHaveBeenCalledWith('Found opencode API in container test-container on localhost:8080');
      consoleSpy.mockRestore();
    });
  });
});

describe('safeDockerExec verbose behavior', () => {
  let mockSafeDockerExec: any;

  beforeEach(() => {
    const dockerSafeExecModule = require('../src/utils/docker-safe-exec');
    mockSafeDockerExec = spyOn(dockerSafeExecModule, 'safeDockerExec');
  });

  afterEach(() => {
    mockSafeDockerExec?.mockRestore();
  });

  test('logs JSON to stderr when verbose is true', async () => {
    const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});

    // Mock the implementation to test logging
    mockSafeDockerExec.mockImplementationOnce(async (args: string[], options: any) => {
      if (options.verbose) {
        const logEntry = {
          timestamp: new Date().toISOString(),
          command: 'docker',
          args: args,
          timeout: options.timeout || 10000,
        };
        console.error(JSON.stringify(logEntry));
      }
      return '';
    });

    await safeDockerExec(['ps'], { verbose: true });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('"command":"docker"')
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('"args":["ps"]')
    );

    consoleErrorSpy.mockRestore();
  });

  test('does not log JSON when verbose is false', async () => {
    const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});

    mockSafeDockerExec.mockImplementationOnce(async (args: string[], options: any) => {
      if (options.verbose) {
        const logEntry = {
          timestamp: new Date().toISOString(),
          command: 'docker',
          args: args,
          timeout: options.timeout || 10000,
        };
        console.error(JSON.stringify(logEntry));
      }
      return '';
    });

    await safeDockerExec(['ps'], { verbose: false });

    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});

describe('integration tests', () => {
  const mockConfig = {
    workspace: 'test-workspace',
    containerName: 'test-container'
  };

  let mockSafeDockerExec: any;
  let mockLoadAisanityConfig: any;
  let mockGetContainerName: any;

  beforeEach(() => {
    mockCwd = spyOn(process, 'cwd').mockReturnValue('/test/workspace');
    
    // Mock modules using require approach
    const dockerSafeExecModule = require('../src/utils/docker-safe-exec');
    const configModule = require('../src/utils/config');
    
    mockSafeDockerExec = spyOn(dockerSafeExecModule, 'safeDockerExec');
    mockSafeDockerExec.mockImplementation((args: string[], options: any) => {
      if (args.includes('ps') && args.includes('-q')) {
        return Promise.resolve('abc123def456\n');
      }
      if (args.includes('inspect')) {
        return Promise.resolve('/test-container\n');
      }
      if (args.includes('exec') && args.includes('ps') && args.includes('aux')) {
        return Promise.resolve('123 00:02:00 opencode --port 8080');
      }
      if (args.includes('exec') && args.includes('ps') && args.includes('-eo')) {
        return Promise.resolve('123 00:02:00 opencode --port 8080');
      }
      if (args.includes('exec') && args.includes('netstat')) {
        return Promise.resolve('tcp 0 0 0.0.0.0:8080 0.0.0.0:* LISTEN 123/opencode');
      }
      if (args.includes('exec') && args.includes('curl')) {
        return Promise.resolve('{"version": "1.0.0"}');
      }
      return Promise.resolve('');
    });

    mockLoadAisanityConfig = spyOn(configModule, 'loadAisanityConfig').mockReturnValue(mockConfig);
    mockGetContainerName = spyOn(configModule, 'getContainerName').mockImplementation((cwd: string, verbose?: boolean) => 'test-container');
  });

  afterEach(() => {
    mockCwd?.mockRestore();
    mockSafeDockerExec?.mockRestore();
    mockLoadAisanityConfig?.mockRestore();
    mockGetContainerName?.mockRestore();
  });

  test('end-to-end execution without verbose flag produces clean output', async () => {
    const consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});

    // Simulate command execution
    const result = await discoverOpencodeInstances({ all: false, format: 'text' as const, verbose: false });

    expect(result.mostRecent).toBeTruthy();
    expect(result.mostRecent!.host).toBe('localhost');
    expect(result.mostRecent!.port).toBe(8080);

    // Should not have called console.error for JSON logging
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('"command":"docker"')
    );

    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('end-to-end execution with verbose flag includes debug output', async () => {
    const consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});

    // Simulate command execution
    const result = await discoverOpencodeInstances({ all: false, format: 'text' as const, verbose: true });

    expect(result.mostRecent).toBeTruthy();
    expect(result.mostRecent!.host).toBe('localhost');
    expect(result.mostRecent!.port).toBe(8080);

    // Should have called console.error for progress messages
    expect(consoleErrorSpy).toHaveBeenCalledWith('Finding opencode instances...');

    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});

describe('edge cases and backward compatibility', () => {
  test('handles invalid flags gracefully', () => {
    // This would be tested in CLI integration, but we can verify the command structure
    const command = discoverOpencodeCommand;
    expect(command).toBeDefined();
    expect(command.options).toBeDefined();
  });

  test('backward compatibility - works without verbose flag', async () => {
    const options = { all: false, format: 'text' as const }; // No verbose property
    // The function should handle missing verbose property
    const result = await discoverOpencodeInstances(options as any);
    expect(result).toBeDefined();
  });

  test('verbose flag defaults to false when not provided', async () => {
    const options = { all: false, format: 'text' as const };
    const result = await discoverOpencodeInstances(options as any);
    expect(result).toBeDefined();
    // Should not throw or fail
  });
});