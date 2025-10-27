/**
 * TimeoutManager - Coordinate timeout enforcement across confirmation and workflow contexts
 * Creates and manages AbortController instances for timeout with progress tracking
 */

/**
 * Timeout coordination and tracking manager
 */
export class TimeoutManager {
  private abortController?: AbortController;
  private startTime?: number;
  private timeoutMs?: number;
  private timeoutId?: NodeJS.Timeout;

  /**
   * Start a new timeout with optional parent coordination
   * @param timeoutMs Timeout duration in milliseconds
   * @param parentSignal Optional parent AbortSignal for coordination
   * @returns AbortController for the timeout
   */
  startTimeout(
    timeoutMs: number,
    parentSignal?: AbortSignal
  ): AbortController {
    // Clean up any existing timeout
    this.cancel();
    
    this.abortController = new AbortController();
    this.startTime = Date.now();
    this.timeoutMs = timeoutMs;
    
    // Handle parent timeout propagation
    if (parentSignal) {
      if (parentSignal.aborted) {
        // Parent already aborted, abort immediately
        this.abortController.abort();
        return this.abortController;
      }
      
      // Listen for parent abort
      parentSignal.addEventListener('abort', () => {
        this.cancel();
      });
    }
    
    // Set local timeout
    if (timeoutMs > 0) {
      this.timeoutId = setTimeout(() => {
        this.abortController?.abort();
      }, timeoutMs);
    }
    
    return this.abortController;
  }

  /**
   * Get remaining time before timeout
   * @returns Milliseconds remaining (0 if expired)
   */
  getRemainingTime(): number {
    if (!this.startTime || !this.timeoutMs) {
      return 0;
    }
    
    const elapsed = Date.now() - this.startTime;
    return Math.max(0, this.timeoutMs - elapsed);
  }

  /**
   * Get elapsed time since timeout started
   * @returns Milliseconds elapsed
   */
  getElapsedTime(): number {
    if (!this.startTime) {
      return 0;
    }
    
    return Date.now() - this.startTime;
  }

  /**
   * Get progress percentage of timeout
   * @returns Progress percentage (0-100)
   */
  getProgressPercentage(): number {
    if (!this.startTime || !this.timeoutMs) {
      return 0;
    }
    
    const elapsed = this.getElapsedTime();
    return Math.min(100, (elapsed / this.timeoutMs) * 100);
  }

  /**
   * Check if timeout has expired
   * @returns True if expired
   */
  isExpired(): boolean {
    if (!this.startTime || !this.timeoutMs) {
      return false;
    }
    return this.getRemainingTime() === 0;
  }

  /**
   * Cancel timeout and cleanup resources
   */
  cancel(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    
    this.abortController?.abort();
    this.abortController = undefined;
    this.startTime = undefined;
    this.timeoutMs = undefined;
  }
}