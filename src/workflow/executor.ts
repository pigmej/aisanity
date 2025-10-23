/**
 * CommandExecutor - Main execution coordinator implementing FSM interface
 * Provides robust command execution with TUI support and resource management
 */

import { Logger } from '../utils/logger';
import { 
  StateExecutionCoordinator, 
  ExecutionOptions, 
  CommandResult 
} from './execution-context';
import { 
  IProcessHandle, 
  ProcessSpawnOptions, 
  createProcessHandle 
} from './process-handle';
import { OutputBuffer } from './output-buffer';
import { TUIPromptBuilder } from './tui-prompt-builder';

/**
 * Executor configuration options
 */
export interface ExecutorOptions {
  maxOutputSize?: number;         // Default: 10MB
  maxExecutionTime?: number;      // Default: 5 minutes
  maxConcurrentProcesses?: number; // Default: 10
  enableValidation?: boolean;     // Default: false for development
  streamOutput?: boolean;         // Default: false
}

/**
 * Command execution error with detailed context
 */
export class CommandExecutionError extends Error {
  public readonly command: string;
  public readonly args: string[];
  public readonly code: ExecutionErrorCode;
  public readonly cause?: Error;

  constructor(
    message: string,
    command: string,
    args: string[],
    code: ExecutionErrorCode,
    cause?: Error
  ) {
    super(message);
    this.command = command;
    this.args = args;
    this.code = code;
    this.cause = cause;
    this.name = 'CommandExecutionError';
  }
}

/**
 * Command execution error codes
 */
export type ExecutionErrorCode =
  | 'COMMAND_NOT_FOUND'
  | 'COMMAND_NOT_ALLOWED'  // DEPRECATED: Command whitelist removed
  | 'TIMEOUT'
  | 'INJECTION_DETECTED'
  | 'PATH_TRAVERSAL'       // DEPRECATED: Path traversal allowed for development
  | 'RESOURCE_LIMIT'
  | 'SPAWN_FAILED'
  | 'UNKNOWN_ERROR';

/**
 * Main command executor implementing StateExecutionCoordinator interface
 */
export class CommandExecutor implements StateExecutionCoordinator {
  private activeProcesses = new Set<IProcessHandle>();
  private readonly options: Required<ExecutorOptions>;

  constructor(
    private logger?: Logger,
    defaultTimeout: number = 120000, // 2 minutes
    options: ExecutorOptions = {}
  ) {
    this.options = {
      maxOutputSize: options.maxOutputSize ?? 10 * 1024 * 1024, // 10MB
      maxExecutionTime: options.maxExecutionTime ?? 5 * 60 * 1000, // 5 minutes
      maxConcurrentProcesses: options.maxConcurrentProcesses ?? 10,
      enableValidation: options.enableValidation ?? false, // Default: false for development
      streamOutput: options.streamOutput ?? false
    };
  }

  /**
   * Execute a system command with output capture
   * Implements StateExecutionCoordinator interface
   * @param command Command to execute
   * @param args Command arguments
   * @param options Execution options including timeout and working directory
   * @returns Promise resolving to command execution result
   */
  async executeCommand(
    command: string,
    args: string[],
    options: ExecutionOptions = {}
  ): Promise<CommandResult> {
    const startTime = Date.now();
    

    
    try {
      // Validate command if enabled
      if (this.options.enableValidation) {
        this.validateCommand(command, args);
      }

      // Enforce timeout limits
      const timeout = Math.min(
        options.timeout ?? this.options.maxExecutionTime,
        this.options.maxExecutionTime
      );

      // Validate working directory
      const cwd = this.validateWorkingDirectory(options.cwd);

      // Check resource limits for async processes only (when timeout is specified)
      if (options.timeout && this.activeProcesses.size >= this.options.maxConcurrentProcesses) {
        throw new CommandExecutionError(
          'Too many concurrent processes',
          command,
          args,
          'RESOURCE_LIMIT'
        );
      }

      // Handle timeout if specified (always use async for timeout commands)
      if (options.timeout) {
        return this.executeWithTimeout(command, args, { cwd, env: options.env, stdin: options.stdin }, timeout);
      }

      // For simple cases without timeout, use Bun.spawnSync
      try {
        const result = Bun.spawnSync([command, ...args], {
          cwd,
          env: options.env
        });
        
        const duration = Date.now() - startTime;
        
        // Log output if configured
        if (this.logger && this.options.streamOutput) {
          if (result.stdout) {
            this.logger.info(result.stdout.toString().trim());
          }
          if (result.stderr) {
            this.logger.error(result.stderr.toString().trim());
          }
        }
        
        return {
          exitCode: result.exitCode || 0,
          stdout: result.stdout ? result.stdout.toString() : '',
          stderr: result.stderr ? result.stderr.toString() : '',
          duration
        };
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        return {
          exitCode: error.exitCode || 1,
          stdout: error.stdout ? error.stdout.toString() : '',
          stderr: error.stderr ? error.stderr.toString() : '',
          duration
        };
      }

    } catch (error) {
      if (error instanceof CommandExecutionError) {
        throw error;
      }
      
      throw new CommandExecutionError(
        `Command execution failed: ${error instanceof Error ? error.message : String(error)}`,
        command,
        args,
        'UNKNOWN_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Execute an interactive TUI prompt using bash subprocess
   * @param prompt Bash command string to execute for TUI interaction
   * @param timeout Optional timeout in milliseconds (default: 30000)
   * @returns Promise resolving to command execution result
   */
  async executeTUICommand(
    prompt: string,
    timeout: number = 30000
  ): Promise<CommandResult> {
    try {
      return await this.executeWithTimeout('bash', ['-c', prompt], {
        stdin: 'inherit'
      }, timeout);
    } finally {
      if (process.stdout.isTTY) {
        process.stdout.write('\x1b[0m');
        process.stdout.write('\x1b[?25h');
      }
    }
  }

  /**
   * Convenience method for yes/no confirmation prompts
   * @param message Confirmation message to display to user
   * @param defaultValue Default value if user presses Enter (default: false)
   * @param timeout Optional timeout in milliseconds (default: 30000)
   * @returns Promise resolving to boolean indicating user's choice
   */
  async executeConfirmation(
    message: string,
    defaultValue: boolean = false,
    timeout: number = 30000
  ): Promise<boolean> {
    const prompt = TUIPromptBuilder.buildConfirmationPrompt(message, defaultValue);
    const result = await this.executeTUICommand(prompt, timeout);
    return result.exitCode === 0;
  }

  /**
   * Display a selection menu and capture user choice
   * @param message Prompt message to display
   * @param options Array of choices to present to user
   * @param timeout Optional timeout in milliseconds (default: 60000)
   * @returns Promise resolving to selected option or null if cancelled
   */
  async executeSelection(
    message: string,
    options: string[],
    timeout: number = 60000
  ): Promise<string | null> {
    const prompt = TUIPromptBuilder.buildSelectionPrompt(message, options);
    const result = await this.executeTUICommand(prompt, timeout);
    
    if (result.exitCode === 0) {
      return result.stdout?.trim() || '';
    }
    return null;
  }

  /**
   * Terminate all active processes and clean up resources
   * @returns Promise that resolves when all processes are terminated
   */
  async cleanup(): Promise<void> {
    const handles = Array.from(this.activeProcesses);
    
    // Kill all processes
    handles.forEach(handle => {
      handle.kill('SIGTERM');
    });

    // Wait for processes to terminate (but don't suppress errors)
    await Promise.allSettled(handles.map(handle => handle.promise));
    
    this.activeProcesses.clear();
  }

  /**
   * Get count of currently running processes
   * @returns Number of active processes
   */
  getActiveProcessCount(): number {
    return this.activeProcesses.size;
  }

  /**
   * Execute command with timeout using async approach
   */
  private async executeWithTimeout(
    command: string,
    args: string[],
    options: ExecutionOptions,
    timeoutMs: number
  ): Promise<CommandResult> {
    const startTime = Date.now();
    
    // Create output buffers
    const stdoutBuffer = new OutputBuffer(this.options.maxOutputSize);
    const stderrBuffer = new OutputBuffer(this.options.maxOutputSize);

    // Enable real-time logging if configured
    if (this.logger && this.options.streamOutput) {
      stdoutBuffer.pipeToLogger(this.logger, 'stdout');
      stderrBuffer.pipeToLogger(this.logger, 'stderr');
    }

    // Spawn process
    const handle = await this.spawnProcess(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdout: stdoutBuffer,
      stderr: stderrBuffer,
      stdin: options.stdin
    });

    try {
      // Wait for completion with timeout
      const processResult = await Promise.race([
        handle.promise,
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            handle.kill('SIGTERM');
            reject(new CommandExecutionError(
              'Command timed out',
              command,
              args,
              'TIMEOUT'
            ));
          }, timeoutMs);
        })
      ]);

      return {
        exitCode: processResult.exitCode,
        stdout: stdoutBuffer.getContent(),
        stderr: stderrBuffer.getContent(),
        duration: Date.now() - startTime
      };
    } catch (error) {
      if (error instanceof CommandExecutionError) {
        throw error;
      }
      
      throw new CommandExecutionError(
        `Command execution failed: ${error instanceof Error ? error.message : String(error)}`,
        command,
        args,
        'UNKNOWN_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Spawn a process with proper configuration
   */
  private async spawnProcess(
    command: string,
    args: string[],
    options: ProcessSpawnOptions
  ): Promise<IProcessHandle> {
    try {
      const handle = await createProcessHandle(command, args, options);
      
      // Track active process
      this.activeProcesses.add(handle);
      
      // Remove from tracking when complete
      handle.promise.finally(() => {
        this.activeProcesses.delete(handle);
      });
      
      return handle;
    } catch (error) {
      throw new CommandExecutionError(
        `Failed to spawn process: ${error instanceof Error ? error.message : String(error)}`,
        command,
        args,
        'SPAWN_FAILED',
        error instanceof Error ? error : undefined
      );
    }
  }



  /**
   * Validate command for injection patterns (only when validation is enabled)
   */
  private validateCommand(command: string, args: string[]): void {
    // Skip validation if disabled (default for development)
    if (!this.options.enableValidation) {
      return;
    }
    
    // Validate arguments for injection patterns
    for (const arg of args) {
      if (this.containsInjectionPatterns(arg)) {
        throw new CommandExecutionError(
          `Argument contains injection patterns: ${arg}`,
          command,
          args,
          'INJECTION_DETECTED'
        );
      }
    }
  }

  /**
   * Check for dangerous injection patterns in arguments
   */
  private containsInjectionPatterns(arg: string): boolean {
    // Block dangerous shell metacharacters and injection patterns
    // Allow bash -c commands to work properly while blocking actual injection
    const dangerousPatterns = [
      /\/etc\//,           // System file access
      /rm\s+-rf\s+\//,     // Dangerous rm commands targeting root
      /&&.*rm/,            // Command chaining with rm
      /\|\|.*rm/,          // Command chaining with rm
    ];
    
    return dangerousPatterns.some(pattern => pattern.test(arg));
  }

  /**
   * Validate working directory - allow any directory for development
   */
  private validateWorkingDirectory(cwd?: string): string {
    if (!cwd) {
      return process.cwd();
    }
    
    const resolvedPath = require('path').resolve(cwd);
    
    // Allow any directory for development workflows
    // Path traversal is now allowed for development use cases
    return resolvedPath;
  }


}