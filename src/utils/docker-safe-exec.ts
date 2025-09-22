import { spawn } from 'child_process';

/**
 * Custom error types for Docker execution
 */
export class DockerExecError extends Error {
  constructor(message: string, public code?: number, public stderr?: string) {
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
}

/**
 * Executes a Docker command safely using spawnSync with array-based arguments
 * @param args Array of command arguments (without 'docker' prefix)
 * @param options Execution options
 * @returns Promise resolving to stdout as string
 */
export async function safeDockerExec(args: string[], options: DockerExecOptions = {}): Promise<string> {
  const { timeout = 10000, cwd, env, verbose = false } = options;

  // Structured logging for security audit
  if (verbose) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      command: 'docker',
      args: args, // Log args for audit, assuming no secrets
      timeout,
      cwd,
    };
    console.error(JSON.stringify(logEntry));
  }

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
        reject(new DockerExecError(`Docker command failed with exit code ${code}`, code || undefined, stderr));
      }
    });

    child.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(new DockerExecError(`Failed to execute Docker command: ${error.message}`));
    });
  });
}