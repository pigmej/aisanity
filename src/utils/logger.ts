/**
 * Logger utility for conditional output management
 * Supports four-tier verbosity: Silent → Normal → Verbose → Debug
 */

export class Logger {
  constructor(
    private silent: boolean = false,
    private verboseMode: boolean = false,
    private debugMode: boolean = false
  ) {}

  /**
   * Log informational message - suppressed in silent mode
   * Use for: standard command output, success messages
   */
  info(message: string): void {
    if (!this.silent) {
      console.log(message);
    }
  }

  /**
   * Log error message - always visible regardless of mode
   * Use for: failures, critical issues
   */
  error(message: string): void {
    console.error(message);
  }

  /**
   * User-facing verbose details - requires --verbose flag
   * Use for: detailed status info, worktree listings, orphaned container details
   */
  verbose(message: string): void {
    if (this.verboseMode && !this.silent) {
      console.log(message);
    }
  }

  /**
   * System-level debug information - requires --debug flag
   * Use for: discovery process, timing info, validation metadata
   */
  debug(message: string): void {
    if (this.debugMode && !this.silent) {
      console.log(message);
    }
  }

  /**
   * Log warning message - always visible regardless of mode
   * Use for: non-fatal issues, deprecation notices
   */
  warn(message: string): void {
    console.error(message);
  }
}

/**
 * Create a logger instance from command options
 * Ensures consistent logger configuration across all commands
 */
export function createLogger(options: {
  silent?: boolean;
  verbose?: boolean;
  debug?: boolean;
}): Logger {
  return new Logger(
    options.silent || false,
    options.verbose || false,
    options.debug || false
  );
}

/**
 * Create logger from Commander options object
 * Convenience wrapper for command action handlers
 */
export function createLoggerFromCommandOptions(commandOptions: any): Logger {
  return createLogger({
    silent: commandOptions.silent || false,
    verbose: commandOptions.verbose || false,
    debug: commandOptions.debug || false
  });
}