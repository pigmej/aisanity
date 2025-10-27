/**
 * Tests for ProcessHandle component
 */

import { createProcessHandle, IProcessHandle } from '../../src/workflow/process-handle';

// Store original Bun.spawn
const originalSpawn = Bun.spawn;

// Create a mock process object that mimics Bun.Process
const createMockProcess = (exitCode: number = 0, stdout: string = '', stderr: string = '', command?: string, args?: string[]) => {
  // Determine if this is a sleep command to simulate actual delay
  const isSleepCommand = command === 'sleep' && args && args.length > 0;
  const sleepDuration = isSleepCommand ? parseInt(args[0]) * 1000 : 0;
  
  let resolveExited: (value: number) => void;
  let currentExitCode = exitCode;
  let killedSignal: string | undefined;
  
  const mockProcess = {
    exited: new Promise<number>((resolve) => {
      resolveExited = resolve;
      if (isSleepCommand) {
        setTimeout(() => resolve(currentExitCode), sleepDuration);
      } else {
        resolve(currentExitCode);
      }
    }),
    stdout: stdout ? new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(stdout));
        controller.close();
      }
    }) : null,
    stderr: stderr ? new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(stderr));
        controller.close();
      }
    }) : null,
    kill: jest.fn((signal?: string | number) => {
      killedSignal = signal as string;
      currentExitCode = 143; // SIGTERM exit code
      if (resolveExited) {
        resolveExited(currentExitCode);
      }
    }),
    pid: 12345,
    success: exitCode === 0,
    terminated: false,
    // Add signal property for tests to check
    get signal() { return killedSignal; }
  };
  return mockProcess;
};

// Mock Bun.spawn
const mockSpawn = jest.fn();
(Bun.spawn as any) = mockSpawn;

// Set up default mock
mockSpawn.mockImplementation((command: any, args: any) => {
  // Handle invalid commands that should fail
  if (command && command.includes('nonexistent-command')) {
    throw new Error(`Command not found: ${command}`);
  }
  return createMockProcess(0, '', '', command, args);
});

describe('ProcessHandle', () => {
  afterEach(() => {
    // Restore original Bun.spawn
    (Bun.spawn as any) = originalSpawn;
  });
  it('should track process lifecycle', async () => {
    const handle = await createProcessHandle('echo', ['test'], {});
    
    expect(handle.isRunning()).toBe(true);
    
    const result = await handle.promise;
    
    expect(handle.isRunning()).toBe(false);
    expect(result.exitCode).toBe(0);
  });

  it('should measure execution duration', async () => {
    const handle = await createProcessHandle('sleep', ['1'], {});
    
    await handle.promise;
    
    expect(handle.getDuration()).toBeGreaterThanOrEqual(1000);
  });

  it('should support graceful termination', async () => {
    const handle = await createProcessHandle('sleep', ['10'], {});
    
    setTimeout(() => handle.kill('SIGTERM'), 100);
    
    const result = await handle.promise;
    
    expect(result.signal).toBe('SIGTERM');
  });

  it('should support forceful termination', async () => {
    const handle = await createProcessHandle('sleep', ['10'], {});
    
    handle.kill('SIGKILL');
    
    const result = await handle.promise;
    
    expect(result.signal).toBe('SIGKILL');
  });

  it('should handle process with custom working directory', async () => {
    const handle = await createProcessHandle('pwd', [], {
      cwd: '/tmp'
    });
    
    const result = await handle.promise;
    
    expect(result.exitCode).toBe(0);
  });

  it('should handle process with environment variables', async () => {
    const handle = await createProcessHandle('bash', ['-c', 'echo $TEST_VAR'], {
      env: { TEST_VAR: 'test_value' }
    });
    
    const result = await handle.promise;
    
    expect(result.exitCode).toBe(0);
  });

  it('should return null for memory usage', async () => {
    const handle = await createProcessHandle('echo', ['test'], {});
    
    const memoryUsage = handle.getMemoryUsage();
    
    expect(memoryUsage).toBeNull();
  });

  it('should handle process spawn failure', async () => {
    await expect(
      createProcessHandle('nonexistent-command-12345', [], {})
    ).rejects.toThrow();
  });
});