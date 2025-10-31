/**
 * ProgressIndicator - Display non-blocking progress indication during confirmation timeout
 * Shows countdown timer with spinner animation for visual feedback
 */

import { Logger } from '../utils/logger';

/**
 * Progress indicator for confirmation timeouts
 */
export class ProgressIndicator {
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;
  private startTime = 0;
  private readonly spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  
  constructor(private logger?: Logger) {}

  /**
   * Start displaying progress indicator
   * @param timeoutMs Total timeout duration
   * @param message Optional message to display (default: 'Waiting for confirmation...')
   * @param updateInterval Update frequency in milliseconds (default: 1000)
   */
  start(
    timeoutMs: number,
    message: string = 'Waiting for confirmation...',
    updateInterval: number = 1000
  ): void {
    if (this.isRunning) {
      return; // Already running
    }
    
    this.isRunning = true;
    this.startTime = Date.now();
    
    // Show initial message
    this.logger?.info(message);
    
    this.intervalId = setInterval(() => {
      if (!this.isRunning) {
        return;
      }
      
      const elapsed = Date.now() - this.startTime;
      const remaining = Math.max(0, timeoutMs - elapsed);
      
      if (remaining <= 0) {
        this.stop();
        return;
      }
      
      // Calculate spinner frame based on elapsed time
      const frame = Math.floor(elapsed / 200) % this.spinnerFrames.length;
      const spinner = this.renderSpinner(frame);
      const timeStr = this.formatTimeRemaining(remaining);
      
      // Use carriage return for inline updates (overwrites current line)
      process.stdout.write(`\r${spinner} ${message} (${timeStr} remaining)`);
      
    }, updateInterval);
  }

  /**
   * Stop progress indicator and clean up terminal
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    
    // Clear the progress line
    this.clearLine();
  }

  /**
   * Render spinner frame
   * @param frame Frame index
   * @returns Spinner character
   */
  private renderSpinner(frame: number): string {
    return this.spinnerFrames[frame % this.spinnerFrames.length];
  }

  /**
   * Format remaining time in human-readable format
   * @param ms Remaining time in milliseconds
   * @returns Formatted time string
   */
  private formatTimeRemaining(ms: number): string {
    const seconds = Math.ceil(ms / 1000);
    
    if (seconds < 60) {
      return `${seconds}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    }
  }

  /**
   * Clear current terminal line
   */
  private clearLine(): void {
    // Clear current line and move cursor to beginning
    const terminalWidth = process.stdout.columns || 80;
    process.stdout.write('\r' + ' '.repeat(terminalWidth) + '\r');
  }
}