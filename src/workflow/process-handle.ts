/**
 * ProcessHandle - Wrapper around Bun.Process with lifecycle management
 * Provides unified interface for process monitoring and cleanup
 */

/**
 * Result of process execution
 */
export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  signal?: NodeJS.Signals;
  signalCode?: string | number;
  timedOut?: boolean;
}

/**
 * Handle for managing process lifecycle
 */
export interface IProcessHandle {
  readonly process: any; // Bun.Process equivalent
  readonly abortController: AbortController;
  readonly startTime: number;
  readonly command: string;
  readonly args: string[];
  readonly promise: Promise<ProcessResult>;
  
  kill(signal?: NodeJS.Signals | number): void;
  isRunning(): boolean;
  wasKilled(): boolean;
  getDuration(): number;
  getMemoryUsage(): number | null;
}

/**
 * Process spawn configuration options
 */
export interface ProcessSpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  stdout?: any; // OutputBuffer or stream
  stderr?: any; // OutputBuffer or stream
  stdin?: 'inherit' | 'pipe' | null; // stdin configuration for interactive commands
}

/**
 * Implementation of ProcessHandle
 */
export class ProcessHandleImpl implements IProcessHandle {
  private _killed = false;
  private _exitCode: number | null = null;
  private _signalCode?: string | number;
  
  public readonly process: any; // Bun.Process equivalent
  public readonly abortController: AbortController;
  public readonly startTime: number;
  public readonly command: string;
  public readonly args: string[];
  public readonly promise: Promise<ProcessResult>;

  constructor(
    process: any, // Bun.Process equivalent
    abortController: AbortController,
    startTime: number,
    command: string,
    args: string[],
    promise: Promise<ProcessResult>
  ) {
    this.process = process;
    this.abortController = abortController;
    this.startTime = startTime;
    this.command = command;
    this.args = args;
    this.promise = promise;
  }

  kill(signal: NodeJS.Signals | number = 'SIGTERM'): void {
    if (this._killed) return;
    
    this._killed = true;
    this._signalCode = signal;
    this.abortController.abort();
    
    // Attempt graceful termination first
    this.process.kill(signal);
    
    // Forceful termination after 5 seconds
    setTimeout(() => {
      if (this.isRunning()) {
        this.process.kill('SIGKILL');
      }
    }, 5000);
  }

  isRunning(): boolean {
    return !this._killed && this._exitCode === null;
  }

  wasKilled(): boolean {
    return this._killed;
  }

  getDuration(): number {
    return Date.now() - this.startTime;
  }

  getMemoryUsage(): number | null {
    // Bun.Process may not expose memory info directly
    // Return null if unavailable
    return null;
  }
}

/**
 * Factory function to create process handles
 */
export async function createProcessHandle(
  command: string,
  args: string[],
  options: ProcessSpawnOptions
): Promise<IProcessHandle> {
  const startTime = Date.now();
  const abortController = new AbortController();
  
  // Determine if this is a TUI command (needs full terminal access)
  const isTUICommand = options.stdin === 'inherit';
  
  // Prepare spawn options
  const spawnOptions: any = {
    cwd: options.cwd,
    env: options.env,
    // TUI commands need full terminal access - inherit all streams
    stdio: isTUICommand ? ['inherit', 'inherit', 'inherit'] : [options.stdin ?? 'pipe', 'pipe', 'pipe']
  };
  

  
  const process = Bun.spawn([command, ...args], spawnOptions);
  
  // Create the promise that resolves when the process exits
  const promise = new Promise<ProcessResult>((resolve, reject) => {
    // Handle process completion
    process.exited.then(async (exitCode) => {
      try {

        
        // Read output streams asynchronously (only if not inherited)
        let stdoutOutput = '';
        let stderrOutput = '';
        
        // Only read streams if they're piped (not inherited for TUI commands)
        if (!isTUICommand) {
          // Read stdout if available
          if (process.stdout) {
            try {
              stdoutOutput = await new Response(process.stdout).text();
              
              // Write to buffer if provided
              if (options.stdout && typeof options.stdout === 'object' && options.stdout.write) {
                options.stdout.write(Buffer.from(stdoutOutput));
              }
            } catch (error) {
              // Ignore read errors
            }
          }
          
          // Read stderr if available
          if (process.stderr) {
            try {
              stderrOutput = await new Response(process.stderr).text();
              
              // Write to buffer if provided
              if (options.stderr && typeof options.stderr === 'object' && options.stderr.write) {
                options.stderr.write(Buffer.from(stderrOutput));
              }
            } catch (error) {
              // Ignore read errors
            }
          }
        }
        
        // Get output from buffers if provided (fallback)
        let stdout = stdoutOutput;
        let stderr = stderrOutput;
        
        if (options.stdout && typeof options.stdout === 'object' && options.stdout.getContent) {
          stdout = options.stdout.getContent();
        }
        
        if (options.stderr && typeof options.stderr === 'object' && options.stderr.getContent) {
          stderr = options.stderr.getContent();
        }
        
        resolve({
          exitCode,
          stdout,
          stderr,
          duration: Date.now() - startTime,
          signal: (handle as any)._signalCode,
          signalCode: (handle as any)._signalCode,
          timedOut: false
        });
      } catch (error) {
        reject(error);
      }
    }).catch(reject);
  });
  
  const handle = new ProcessHandleImpl(
    process,
    abortController,
    startTime,
    command,
    args,
    promise
  );
  
  // Set up exit code tracking
  promise.then((result) => {
    (handle as any)._exitCode = result.exitCode;
  }).catch(() => {
    (handle as any)._exitCode = -1; // Error case
  });
  
  return handle;
}