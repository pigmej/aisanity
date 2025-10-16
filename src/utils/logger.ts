/**
 * Logger utility for conditional output management
 * Supports three-tier verbosity: Silent → Normal → Verbose
 */

export class Logger {
  constructor(
    private silent: boolean = false,
    private verbose: boolean = false
  ) {}

  /**
   * Log informational message - suppressed in silent mode
   */
  info(message: string): void {
    if (!this.silent) {
      console.log(message);
    }
  }

  /**
   * Log error message - always visible regardless of mode
   */
  error(message: string): void {
    console.error(message);
  }

  /**
   * Log debug message - only visible in verbose mode
   */
  debug(message: string): void {
    if (this.verbose && !this.silent) {
      console.log(message);
    }
  }

  /**
   * Log warning message - always visible regardless of mode
   */
  warn(message: string): void {
    console.error(message);
  }
}