/**
 * ConfirmationHandler - Main interface for user confirmations with timeout and override support
 * Provides user interaction capabilities for workflow state machine
 */

import { CommandExecutor } from './executor';
import { Logger } from '../utils/logger';
import { ConfirmationBuilder } from './confirmation-builder';
import { ProgressIndicator } from './progress-indicator';

/**
 * Confirmation configuration options
 */
export interface ConfirmationOptions {
  timeout?: number;              // Timeout in milliseconds (default: 30000)
  yesFlag?: boolean;             // Global --yes override flag
  defaultResponse?: boolean;     // Default response on timeout/Enter (default: false)
  showProgress?: boolean;        // Show progress indicator (default: true)
  progressInterval?: number;     // Progress update interval (default: 1000ms)
}

/**
 * Confirmation execution result
 */
export interface ConfirmationResult {
  confirmed: boolean;            // User's decision or default
  method: ConfirmationMethod;    // How confirmation was resolved
  duration: number;              // Time taken in milliseconds
  timedOut?: boolean;            // Whether timeout occurred
  error?: Error;                 // Any error that occurred
  metadata?: Record<string, unknown>; // Additional context
}

/**
 * How confirmation was resolved
 */
export type ConfirmationMethod = 'user' | 'override' | 'timeout' | 'error';

/**
 * Confirmation handler configuration
 */
export interface ConfirmationHandlerConfig {
  defaultTimeout?: number;       // Default timeout (default: 30000ms)
  minTimeout?: number;           // Minimum allowed timeout (default: 1000ms)
  maxTimeout?: number;           // Maximum allowed timeout (default: 300000ms)
  enableProgressIndicator?: boolean; // Enable progress by default (default: true)
  progressUpdateInterval?: number;   // Progress update interval (default: 1000ms)
}

/**
 * Main confirmation handler class
 */
export class ConfirmationHandler {
  private readonly config: Required<ConfirmationHandlerConfig>;
  private executor: CommandExecutor;
  private logger?: Logger;

  constructor(
    executor: CommandExecutor,
    logger?: Logger,
    config?: ConfirmationHandlerConfig
  ) {
    this.executor = executor;
    this.logger = logger;
    this.config = {
      defaultTimeout: config?.defaultTimeout ?? 30000,
      minTimeout: config?.minTimeout ?? 1000,
      maxTimeout: config?.maxTimeout ?? 300000,
      enableProgressIndicator: config?.enableProgressIndicator ?? true,
      progressUpdateInterval: config?.progressUpdateInterval ?? 1000
    };
  }

  /**
   * Main confirmation interface
   * @param message Confirmation message to display
   * @param options Optional configuration options
   * @returns Promise resolving to ConfirmationResult
   */
  async requestConfirmation(
    message: string,
    options: ConfirmationOptions = {}
  ): Promise<ConfirmationResult> {
    const startTime = Date.now();
    
    // Handle --yes flag override first
    if (options.yesFlag) {
      this.logger?.info(`Auto-confirmed: ${message}`);
      return {
        confirmed: true,
        method: 'override',
        duration: 0
      };
    }
    
    // Validate and normalize timeout
    const timeout = this.validateTimeout(options.timeout);
    
    // Build confirmation command
    const command = ConfirmationBuilder.buildTimedConfirmation(
      message,
      timeout,
      options.defaultResponse ?? false
    );
    
    // Start progress indicator if enabled
    const showProgress = options.showProgress ?? this.config.enableProgressIndicator;
    const progressIndicator = showProgress 
      ? new ProgressIndicator(this.logger)
      : null;
    
    if (progressIndicator) {
      progressIndicator.start(timeout, message, options.progressInterval ?? this.config.progressUpdateInterval);
    }
    
    try {
      // Execute confirmation via CommandExecutor
      const result = await this.executor.executeCommand('bash', ['-c', command], {
        timeout
      });
      
      const confirmed = result.exitCode === 0;
      
      this.logger?.info(
        `Confirmation ${confirmed ? 'accepted' : 'declined'} (${result.duration}ms)`
      );
      
      return {
        confirmed,
        method: 'user',
        duration: Date.now() - startTime
      };
      
    } catch (error: any) {
      // Handle timeout or other errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.warn(`Confirmation error: ${errorMessage}`);
      
      const isTimeout = error.code === 'TIMEOUT';
      
      return {
        confirmed: options.defaultResponse ?? false,
        method: isTimeout ? 'timeout' : 'error',
        duration: Date.now() - startTime,
        timedOut: isTimeout,
        error: error instanceof Error ? error : new Error(errorMessage)
      };
      
    } finally {
      // Always stop progress indicator
      progressIndicator?.stop();
    }
  }

  /**
   * Specialized confirmation with explicit timeout
   * @param message Confirmation message
   * @param timeoutMs Timeout in milliseconds
   * @param options Optional configuration (excluding timeout)
   * @returns Promise resolving to boolean (true = confirmed)
   */
  async confirmWithTimeout(
    message: string,
    timeoutMs: number,
    options: Omit<ConfirmationOptions, 'timeout'> = {}
  ): Promise<boolean> {
    const result = await this.requestConfirmation(message, {
      ...options,
      timeout: timeoutMs
    });
    
    return result.confirmed;
  }

  /**
   * Confirmation with explicit --yes flag override support
   * @param message Confirmation message
   * @param yesFlag Whether to skip confirmation (--yes flag)
   * @param timeoutMs Optional timeout (uses default if not provided)
   * @returns Promise resolving to boolean (true = confirmed)
   */
  async confirmWithOverride(
    message: string,
    yesFlag: boolean,
    timeoutMs?: number
  ): Promise<boolean> {
    const result = await this.requestConfirmation(message, {
      yesFlag,
      timeout: timeoutMs
    });
    
    return result.confirmed;
  }

  /**
   * Validate timeout range and enforce limits
   * @param timeoutMs Optional timeout in milliseconds
   * @returns Validated timeout in milliseconds
   */
  private validateTimeout(timeoutMs?: number): number {
    if (!timeoutMs) {
      return this.config.defaultTimeout;
    }
    
    if (timeoutMs < this.config.minTimeout) {
      this.logger?.warn(`Timeout too short, using minimum: ${this.config.minTimeout}ms`);
      return this.config.minTimeout;
    }
    
    if (timeoutMs > this.config.maxTimeout) {
      this.logger?.warn(`Timeout too long, using maximum: ${this.config.maxTimeout}ms`);
      return this.config.maxTimeout;
    }
    
    return timeoutMs;
  }
}