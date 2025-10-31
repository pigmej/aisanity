/**
 * WorkflowErrorHandler - Central Error Coordinator for Workflow System
 * Provides comprehensive error handling, logging, and user guidance
 */

import { Logger } from '../utils/logger';
import {
  WorkflowValidationError,
  WorkflowFileError,
  StateTransitionError,
  WorkflowExecutionError,
  StateNotFoundError,
  WorkflowParseError
} from './errors';
import {
  ErrorContext,
  ErrorReport,
  EXIT_CODES,
  createErrorContext
} from './error-context';

/**
 * Additional error classes for comprehensive error handling
 */
export class CommandExecutionError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly exitCode: number
  ) {
    super(message);
    this.name = 'CommandExecutionError';
  }
}

export class ConfirmationTimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeout: number
  ) {
    super(message);
    this.name = 'ConfirmationTimeoutError';
  }
}

/**
 * Error handling strategy configuration
 */
interface ErrorHandlingStrategy {
  exitCode: number;
  userCorrectable: boolean;
  suggestedAction?: string;
}

/**
 * Main WorkflowErrorHandler class
 */
export class WorkflowErrorHandler {
  private cleanupHandlers: Array<() => Promise<void> | void> = [];

  constructor(private logger?: Logger) {}

  /**
   * Register cleanup handler for resources
   */
  registerCleanupHandler(handler: () => Promise<void> | void): void {
    this.cleanupHandlers.push(handler);
  }

  /**
   * Enrich error with context and re-throw
   * This is the main entry point for error handling
   */
  async enrichAndThrow(error: Error, context: ErrorContext): Promise<never> {
    try {
      await this.performCleanup();
    } finally {
      const report = this.createErrorReport(error, context);
      this.logError(report);
      throw error;
    }
  }

  /**
   * Synchronous version of enrichAndThrow for non-async contexts
   */
  enrichAndThrowSync(error: Error, context: ErrorContext): never {
    try {
      this.performCleanupSync();
    } finally {
      const report = this.createErrorReport(error, context);
      this.logError(report);
      throw error;
    }
  }

  /**
   * Get exit code for CLI boundary handling
   */
  getExitCode(error: Error): number {
    return this.mapErrorToExitCode(error);
  }

  /**
   * Specialized handlers for different error types
   */
  handleValidationError(error: WorkflowValidationError, context: ErrorContext): never {
    const enrichedContext = createErrorContext(context.component, context.operation, {
      ...context,
      additionalData: {
        ...context.additionalData,
        workflowName: error.workflowName,
        fieldPath: error.fieldPath,
        line: error.line
      }
    });
    return this.enrichAndThrowSync(error, enrichedContext);
  }

  handleExecutionError(error: WorkflowExecutionError, context: ErrorContext): never {
    const enrichedContext = createErrorContext(context.component, context.operation, {
      ...context,
      additionalData: {
        ...context.additionalData,
        workflowName: error.workflowName,
        currentState: error.currentState,
        cause: error.cause?.message
      }
    });
    return this.enrichAndThrowSync(error, enrichedContext);
  }

  handleTransitionError(error: StateTransitionError, context: ErrorContext): never {
    const enrichedContext = createErrorContext(context.component, context.operation, {
      ...context,
      additionalData: {
        ...context.additionalData,
        workflowName: error.workflowName,
        fromState: error.fromState,
        exitCode: error.exitCode
      }
    });
    return this.enrichAndThrowSync(error, enrichedContext);
  }

  handleFileError(error: WorkflowFileError, context: ErrorContext): never {
    const enrichedContext = createErrorContext(context.component, context.operation, {
      ...context,
      additionalData: {
        ...context.additionalData,
        filePath: error.filePath,
        reason: error.reason
      }
    });
    return this.enrichAndThrowSync(error, enrichedContext);
  }

  handleTimeoutError(context: ErrorContext, timeout: number): never {
    const error = new ConfirmationTimeoutError(
      `Operation timed out after ${timeout}ms`,
      timeout
    );
    return this.enrichAndThrowSync(error, context);
  }

  handleConfirmationError(context: ErrorContext, reason: string): never {
    const error = new Error(`Confirmation failed: ${reason}`);
    return this.enrichAndThrowSync(error, context);
  }

  handleSimulationError(error: Error, context: ErrorContext): never {
    const enrichedContext = createErrorContext(context.component, context.operation, {
      ...context,
      additionalData: {
        ...context.additionalData,
        isDryRun: true
      }
    });
    return this.enrichAndThrowSync(error, enrichedContext);
  }

  /**
   * Execute cleanup handlers
   */
  private async performCleanup(): Promise<void> {
    for (const handler of this.cleanupHandlers) {
      try {
        await handler();
      } catch (cleanupError) {
        this.logger?.warn(`Cleanup handler failed: ${String(cleanupError)}`);
      }
    }
  }

  /**
   * Synchronous cleanup for non-async contexts
   */
  private performCleanupSync(): void {
    for (const handler of this.cleanupHandlers) {
      try {
        const result = handler();
        if (result instanceof Promise) {
          // Log warning for async cleanup in sync context
          this.logger?.warn('Async cleanup handler in sync context - may not complete');
          result.catch(cleanupError => {
            this.logger?.warn(`Async cleanup handler failed: ${String(cleanupError)}`);
          });
        }
      } catch (cleanupError) {
        this.logger?.warn(`Cleanup handler failed: ${String(cleanupError)}`);
      }
    }
  }

  /**
   * Map error to appropriate exit code
   */
  private mapErrorToExitCode(error: Error): number {
    if (error instanceof WorkflowValidationError) {
      return EXIT_CODES.VALIDATION_ERROR;
    } else if (error instanceof WorkflowFileError) {
      return error.reason === 'missing' ? EXIT_CODES.FILE_NOT_FOUND : EXIT_CODES.PERMISSION_DENIED;
    } else if (error instanceof ConfirmationTimeoutError) {
      return EXIT_CODES.TIMEOUT_ERROR;
    } else if (error instanceof CommandExecutionError) {
      return error.exitCode || EXIT_CODES.GENERAL_ERROR;
    } else if (error instanceof StateTransitionError) {
      return error.exitCode || EXIT_CODES.GENERAL_ERROR;
    } else if (error instanceof WorkflowParseError) {
      return EXIT_CODES.VALIDATION_ERROR;
    } else if (error instanceof WorkflowExecutionError) {
      return EXIT_CODES.GENERAL_ERROR;
    } else if (error instanceof StateNotFoundError) {
      return EXIT_CODES.INVALID_ARGUMENT;
    } else if (error.message.includes('timed out') || error.message.includes('timeout')) {
      return EXIT_CODES.TIMEOUT_ERROR;
    } else if (error.message.includes('not found') || error.message.includes('ENOENT')) {
      return EXIT_CODES.COMMAND_NOT_FOUND;
    } else if (error.message.includes('permission') || error.message.includes('EACCES')) {
      return EXIT_CODES.PERMISSION_DENIED;
    }
    
    return EXIT_CODES.GENERAL_ERROR;
  }

  /**
   * Check if error is user-correctable
   */
  private isUserCorrectable(error: Error): boolean {
    const strategy = this.getErrorStrategy(error);
    return strategy.userCorrectable;
  }

  /**
   * Get suggested action for error
   */
  private getSuggestedAction(error: Error): string | undefined {
    const strategy = this.getErrorStrategy(error);
    return strategy.suggestedAction;
  }

  /**
   * Get error handling strategy
   */
  private getErrorStrategy(error: Error): ErrorHandlingStrategy {
    if (error instanceof WorkflowValidationError) {
      return {
        exitCode: EXIT_CODES.VALIDATION_ERROR,
        userCorrectable: true,
        suggestedAction: 'Check your .aisanity-workflows.yml file for validation errors'
      };
    } else if (error instanceof WorkflowFileError) {
      return {
        exitCode: error.reason === 'missing' ? EXIT_CODES.FILE_NOT_FOUND : EXIT_CODES.PERMISSION_DENIED,
        userCorrectable: true,
        suggestedAction: error.reason === 'missing' 
          ? 'Create the missing workflow file'
          : 'Check file permissions and existence'
      };
    } else if (error instanceof ConfirmationTimeoutError) {
      return {
        exitCode: EXIT_CODES.TIMEOUT_ERROR,
        userCorrectable: true,
        suggestedAction: 'Try running the workflow again or use --yes to skip confirmations'
      };
    } else if (error instanceof CommandExecutionError) {
      return {
        exitCode: error.exitCode || EXIT_CODES.GENERAL_ERROR,
        userCorrectable: false,
        suggestedAction: 'Check command syntax and system requirements'
      };
    } else if (error instanceof StateTransitionError) {
      return {
        exitCode: error.exitCode || EXIT_CODES.GENERAL_ERROR,
        userCorrectable: false,
        suggestedAction: 'Verify workflow state definitions and transitions'
      };
    } else if (error instanceof WorkflowParseError) {
      return {
        exitCode: EXIT_CODES.VALIDATION_ERROR,
        userCorrectable: true,
        suggestedAction: 'Fix YAML syntax errors in your workflow file'
      };
    } else if (error instanceof WorkflowExecutionError) {
      return {
        exitCode: EXIT_CODES.GENERAL_ERROR,
        userCorrectable: false,
        suggestedAction: 'Check workflow configuration and system requirements'
      };
    } else if (error instanceof StateNotFoundError) {
      return {
        exitCode: EXIT_CODES.INVALID_ARGUMENT,
        userCorrectable: true,
        suggestedAction: 'Verify the state name exists in your workflow definition'
      };
    }
    
    return {
      exitCode: EXIT_CODES.GENERAL_ERROR,
      userCorrectable: false,
      suggestedAction: 'Check system requirements and workflow configuration'
    };
  }

  /**
   * Create comprehensive error report
   */
  private createErrorReport(error: Error, context: ErrorContext): ErrorReport {
    const exitCode = this.mapErrorToExitCode(error);
    const userMessage = this.formatUserMessage(error, context);
    const technicalMessage = this.formatTechnicalMessage(error, context);
    const suggestedAction = this.getSuggestedAction(error);

    return {
      error,
      context,
      exitCode,
      userMessage,
      technicalMessage,
      suggestedAction,
      timestamp: new Date()
    };
  }

  /**
   * Format user-friendly error message
   */
  private formatUserMessage(error: Error, context: ErrorContext): string {
    const baseMessage = this.getBaseErrorMessage(error, context);
    const suggestion = this.getSuggestedAction(error);
    
    let message = baseMessage;
    
    if (suggestion) {
      message += `\nSuggestion: ${suggestion}`;
    }
    
    return this.sanitizeUserMessage(message);
  }

  /**
   * Format technical error message for debugging
   */
  private formatTechnicalMessage(error: Error, context: ErrorContext): string {
    let message = `${error.name}: ${error.message}`;
    message += `\nComponent: ${context.component}`;
    message += `\nOperation: ${context.operation}`;
    
    if (context.workflowName) {
      message += `\nWorkflow: ${context.workflowName}`;
    }
    
    if (context.stateName) {
      message += `\nState: ${context.stateName}`;
    }
    
    if (context.command) {
      message += `\nCommand: ${context.command}`;
    }
    
    if (context.additionalData && Object.keys(context.additionalData).length > 0) {
      message += `\nAdditional Data: ${JSON.stringify(context.additionalData, null, 2)}`;
    }
    
    if (error.stack) {
      message += `\nStack: ${error.stack}`;
    }
    
    return this.sanitizeTechnicalMessage(message);
  }

  /**
   * Get base error message based on error type and context
   */
  private getBaseErrorMessage(error: Error, context: ErrorContext): string {
    if (error instanceof WorkflowValidationError) {
      return `Workflow validation failed: ${error.message}`;
    } else if (error instanceof WorkflowFileError) {
      return `Workflow file error: ${error.message}`;
    } else if (error instanceof ConfirmationTimeoutError) {
      return `Confirmation timed out after ${error.timeout}ms`;
    } else if (error instanceof CommandExecutionError) {
      return `Command execution failed: ${error.message}`;
    } else if (error instanceof StateTransitionError) {
      return `State transition failed: ${error.message}`;
    } else if (error instanceof WorkflowParseError) {
      return `Workflow parsing failed: ${error.message}`;
    } else if (error instanceof WorkflowExecutionError) {
      return `Workflow execution failed: ${error.message}`;
    } else if (error instanceof StateNotFoundError) {
      return `State not found: ${error.message}`;
    }
    
    return `Error in ${context.component}: ${error.message}`;
  }

  /**
   * Sanitize user message to prevent information disclosure
   */
  private sanitizeUserMessage(message: string): string {
    // Remove sensitive file paths from user messages
    message = message.replace(/\/home\/[^\/\s]+/g, '~/');
    message = message.replace(/\/Users\/[^\/\s]+/g, '~');
    
    // Remove environment variables
    message = message.replace(/\$[A-Z_]+/g, '$ENV_VAR');
    
    // Remove sensitive system information
    message = message.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, 'IP_ADDRESS');
    
    // Limit error message length for user display
    if (message.length > 500) {
      message = message.substring(0, 497) + '...';
    }
    
    return message;
  }

  /**
   * Sanitize technical message (less aggressive for debugging)
   */
  private sanitizeTechnicalMessage(message: string): string {
    // Only remove truly sensitive data like passwords/tokens
    message = message.replace(/password[=:]\s*[^\s&]+/gi, 'password=***');
    message = message.replace(/token[=:]\s*[^\s&]+/gi, 'token=***');
    message = message.replace(/key[=:]\s*[^\s&]+/gi, 'key=***');
    
    return message;
  }

  /**
   * Log error using appropriate logger methods
   */
  private logError(report: ErrorReport): void {
    // Always log user message to error output
    this.logger?.error(report.userMessage);
    
    // Log technical details in debug mode if available
    this.logger?.debug(`Technical error details:\n${report.technicalMessage}`);
    
    // Log suggested action if available
    if (report.suggestedAction) {
      this.logger?.info(`Suggested action: ${report.suggestedAction}`);
    }
  }
}