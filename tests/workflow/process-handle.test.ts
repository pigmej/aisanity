/**
 * Tests for ProcessHandle component
 */

import { createProcessHandle, ProcessHandle } from '../../src/workflow/process-handle';

describe('ProcessHandle', () => {
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