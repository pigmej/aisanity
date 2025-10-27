/**
 * Mock state execution coordinator for testing
 * Simulates command execution without running actual commands
 */

import {
  StateExecutionCoordinator,
  ExecutionOptions,
  CommandResult
} from '../../../src/workflow/execution-context';

/**
 * Mock executor for testing FSM without real command execution
 */
export class MockStateExecutor implements StateExecutionCoordinator {
  private exitCodeMap: Record<string, number>;
  private delayMap: Record<string, number>;
  private executionLog: Array<{ command: string; args: string[]; timestamp: Date }> = [];

  constructor(
    exitCodeMap: Record<string, number> = {},
    delayMap: Record<string, number> = {}
  ) {
    this.exitCodeMap = exitCodeMap;
    this.delayMap = delayMap;
  }

  /**
   * Execute a command (mocked)
   */
  async executeCommand(
    command: string,
    args: string[],
    options: ExecutionOptions
  ): Promise<CommandResult> {
    // Log execution
    this.executionLog.push({
      command,
      args,
      timestamp: new Date()
    });

    // Simulate delay
    const delay = this.delayMap[command] || 10;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Get exit code - check for command+args combination first, then command only
    const commandWithArgs = `${command} ${args.join(' ')}`;
    const exitCode = this.exitCodeMap[commandWithArgs] ?? this.exitCodeMap[command] ?? 0;

    // Check timeout
    if (options.timeout && delay > options.timeout) {
      return {
        exitCode: 124, // Standard timeout exit code
        stdout: '',
        stderr: 'Command timed out',
        duration: delay
      };
    }

    return {
      exitCode,
      stdout: `Mock output for: ${command} ${args.join(' ')}`,
      stderr: exitCode !== 0 ? `Mock error for: ${command}` : '',
      duration: delay
    };
  }

  /**
   * Get execution log for verification
   */
  getExecutionLog(): Array<{ command: string; args: string[]; timestamp: Date }> {
    return this.executionLog;
  }

  /**
   * Clear execution log
   */
  clearExecutionLog(): void {
    this.executionLog = [];
  }

  /**
   * Set exit code for a specific command
   */
  setExitCode(command: string, exitCode: number): void {
    this.exitCodeMap[command] = exitCode;
  }

  /**
   * Set delay for a specific command
   */
  setDelay(command: string, delay: number): void {
    this.delayMap[command] = delay;
  }
}
