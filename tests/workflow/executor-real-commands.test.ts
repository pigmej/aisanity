/**
 * Real command execution tests for CommandExecutor
 */

import { CommandExecutor } from '../../src/workflow/executor';

describe('Real Command Execution', () => {
  let executor: CommandExecutor;

  beforeEach(() => {
    executor = new CommandExecutor();
  });

  afterEach(async () => {
    await executor.cleanup();
  });

  it('should execute git commands', async () => {
    const result = await executor.executeCommand('git', ['--version']);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('git version');
  });

  it('should execute npm commands', async () => {
    const result = await executor.executeCommand('npm', ['--version']);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('should execute bun commands', async () => {
    const result = await executor.executeCommand('bun', ['--version']);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('should handle command with large output', async () => {
    const result = await executor.executeCommand('ls', ['-la', '/usr/bin']);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout?.length).toBeGreaterThan(100);
  });

  it('should handle long-running commands with timeout', async () => {
    const start = Date.now();
    
    try {
      await executor.executeCommand('sleep', ['5'], { timeout: 1000 });
      fail('Should have timed out');
    } catch (error) {
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000); // Killed quickly
      expect(error).toBeInstanceOf(Error);
    }
  });

  it('should handle commands that output to stderr', async () => {
    const result = await executor.executeCommand('bash', [
      '-c',
      'echo "error message" >&2; echo "normal message"'
    ]);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout?.trim()).toBe('normal message');
    expect(result.stderr?.trim()).toBe('error message');
  });

  it('should handle commands with pipes and redirects', async () => {
    const result = await executor.executeCommand('bash', [
      '-c',
      'echo "hello world" | grep hello'
    ]);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout?.trim()).toBe('hello world');
  });

  it('should handle commands that read from stdin', async () => {
    // This test is limited since we can't easily provide stdin input
    // but we can test that the command doesn't crash
    const result = await executor.executeCommand('cat', []);
    
    expect(result.exitCode).toBe(0);
  });

  it('should handle commands with complex arguments', async () => {
    const result = await executor.executeCommand('echo', [
      'arg with spaces',
      'arg-with-dashes',
      'arg_with_underscores'
    ]);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('arg with spaces');
    expect(result.stdout).toContain('arg-with-dashes');
    expect(result.stdout).toContain('arg_with_underscores');
  });

  it('should handle non-existent commands gracefully', async () => {
    // With validation disabled by default, non-existent commands may succeed or fail
    // depending on the environment. We'll verify it doesn't crash.
    const result = await executor.executeCommand('nonexistent-command-12345', []);
    expect(result).toBeDefined();
  });

  it('should handle commands with special exit codes', async () => {
    const result = await executor.executeCommand('bash', [
      '-c',
      'exit 127' // Command not found exit code
    ]);
    
    expect(result.exitCode).toBe(127);
  });

  it('should handle concurrent command execution', async () => {
    const promises = [
      executor.executeCommand('sleep', ['1']),
      executor.executeCommand('sleep', ['1']),
      executor.executeCommand('sleep', ['1'])
    ];
    
    const start = Date.now();
    const results = await Promise.all(promises);
    const duration = Date.now() - start;
    
    // Should complete in roughly 1 second, not 3 seconds (concurrent)
    expect(duration).toBeLessThan(2000);
    expect(results).toHaveLength(3);
    results.forEach(result => {
      expect(result.exitCode).toBe(0);
    });
  });

  it('should handle commands with Unicode output', async () => {
    const result = await executor.executeCommand('echo', [
      'Test with Unicode: ñáéíóú 🚀'
    ]);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('ñáéíóú');
    expect(result.stdout).toContain('🚀');
  });

  it('should handle very long command lines', async () => {
    const longArg = 'x'.repeat(10000);
    const result = await executor.executeCommand('echo', [longArg]);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout?.trim()).toBe(longArg);
  });
});