import { spawn } from 'child_process';
import { isBunRuntime, getRuntimeInfo } from './runtime-utils';
import type { RuntimeEnvironment, RuntimeInfo } from './runtime-utils';

// Re-export runtime functions for backward compatibility
export { isBunRuntime, getRuntimeInfo };
export type { RuntimeEnvironment, RuntimeInfo };

/**
 * Custom error types for Docker execution
 */
export class DockerExecError extends Error {
  constructor(
    message: string, 
    public code?: number, 
    public stderr?: string,
    public runtime?: RuntimeEnvironment
  ) {
    super(message);
    this.name = 'DockerExecError';
  }
}

export class DockerTimeoutError extends Error {
  constructor(timeout: number) {
    super(`Docker command timed out after ${timeout}ms`);
    this.name = 'DockerTimeoutError';
  }
}

/**
 * Safe Docker command execution using parameterized commands
 */
export interface DockerExecOptions {
  timeout?: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  verbose?: boolean;
  signal?: AbortSignal; // For enhanced timeout handling
}

/**
 * Executes a Docker command safely using Bun.spawn with Node.js fallback
 * @param args Array of command arguments (without 'docker' prefix)
 * @param options Execution options
 * @returns Promise resolving to stdout as string
 */
export async function safeDockerExec(args: string[], options: DockerExecOptions = {}): Promise<string> {
  const { timeout = 10000, cwd, env, verbose = false, signal } = options;

  // Enhanced logging with runtime detection
  if (verbose) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      command: 'docker',
      args: args,
      timeout,
      cwd,
      runtime: isBunRuntime() ? 'bun' : 'node'
    };
    console.error(JSON.stringify(logEntry));
  }

  // Bun implementation with enhanced error handling
  if (isBunRuntime()) {
    return safeDockerExecBun(args, options);
  } else {
    // Fallback to Node.js implementation
    return safeDockerExecNode(args, options);
  }
}

/**
 * Bun-specific Docker execution using Bun.spawn
 */
async function safeDockerExecBun(args: string[], options: DockerExecOptions = {}): Promise<string> {
  const { timeout = 10000, cwd, env, signal } = options;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // Chain abort signals if provided
  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }

  // Track if timeout occurred separately
  let timeoutOccurred = false;
  controller.signal.addEventListener('abort', () => {
    timeoutOccurred = true;
  });

  try {
    const bunGlobal = globalThis as any;
    const child = bunGlobal.Bun.spawn(['docker', ...args], {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
      cwd,
      env: env || process.env,
      signal: controller.signal
    });

    const resultPromise = new Response(child.stdout).text();
    const exitCodePromise = child.exited;

    // Race the promises with a timeout check
    let result: string;
    let exitCode: number;

    try {
      [result, exitCode] = await Promise.all([resultPromise, exitCodePromise]);
    } catch (error: any) {
      clearTimeout(timeoutId);
      // Check if timeout occurred before processing the error
      if (timeoutOccurred) {
        throw new DockerTimeoutError(timeout);
      }
      if (error && error.name === 'AbortError') {
        throw new DockerTimeoutError(timeout);
      }
      throw error;
    }

    clearTimeout(timeoutId);

    // If timeout occurred, throw timeout error regardless of exit code
    if (timeoutOccurred) {
      throw new DockerTimeoutError(timeout);
    }
    
    if (exitCode !== 0) {
      const stderr = await new Response(child.stderr).text();
      throw new DockerExecError(`Docker command failed`, exitCode, stderr, 'bun');
    }
    
    return result;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (timeoutOccurred || (error && error.name === 'AbortError')) {
      throw new DockerTimeoutError(timeout);
    }
    throw new DockerExecError(`Docker execution failed: ${error.message}`, undefined, undefined, 'bun');
  }
}

/**
 * Node.js fallback Docker execution using child_process.spawn
 */
async function safeDockerExecNode(args: string[], options: DockerExecOptions = {}): Promise<string> {
  const { timeout = 10000, cwd, env } = options;

  return new Promise<string>((resolve, reject) => {
    const child = spawn('docker', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
      env: env || process.env,
      shell: false, // Prevent shell interpretation
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timeoutId = setTimeout(() => {
      child.kill();
      reject(new DockerTimeoutError(timeout));
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timeoutId);
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new DockerExecError(`Docker command failed with exit code ${code}`, code || undefined, stderr, 'node'));
      }
    });

    child.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(new DockerExecError(`Failed to execute Docker command: ${error.message}`, undefined, undefined, 'node'));
    });
  });
}

/**
 * Utility for shell command execution with Bun.$ fallback
 */
export interface ShellExecOptions {
  timeout?: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  silent?: boolean;
}

export async function safeShellExec(
  command: string,
  options?: ShellExecOptions
): Promise<string> {
  if (isBunRuntime()) {
    const bunGlobal = globalThis as any;
    return await bunGlobal.Bun.$`bash -c ${command}`.text();
  } else {
    const { execSync } = require('child_process');
    return execSync(command, { 
      encoding: 'utf8', 
      timeout: options?.timeout || 10000,
      cwd: options?.cwd
    });
  }
}