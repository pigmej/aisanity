/**
 * Error Context and Reporting Interfaces for Workflow Error Handling
 * Provides rich context for error debugging while maintaining security
 */

/**
 * Error context information for debugging and user guidance
 */
export interface ErrorContext {
  readonly component: 'parser' | 'fsm' | 'executor' | 'templater' | 'confirmation' | 'cli';
  readonly workflowName?: string;
  readonly stateName?: string;
  readonly command?: string;
  readonly operation: string;
  readonly userAction?: string;
  readonly additionalData?: Record<string, unknown>;
}

/**
 * Complete error report for logging and user display
 */
export interface ErrorReport {
  readonly error: Error;
  readonly context: ErrorContext;
  readonly exitCode: number;
  readonly userMessage: string;
  readonly technicalMessage: string;
  readonly suggestedAction?: string;
  readonly timestamp: Date;
}

/**
 * Exit code constants for consistent error reporting
 */
export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  VALIDATION_ERROR: 2,
  FILE_NOT_FOUND: 3,
  PERMISSION_DENIED: 4,
  TIMEOUT_ERROR: 124,  // Standard timeout exit code
  COMMAND_NOT_FOUND: 127,
  INVALID_ARGUMENT: 128
} as const;

/**
 * Create error context with validation
 */
export function createErrorContext(
  component: ErrorContext['component'],
  operation: string,
  overrides?: Partial<ErrorContext>
): ErrorContext {
  const context: ErrorContext = {
    component,
    operation,
    ...overrides
  };

  // Validate required fields
  if (!component) {
    throw new Error('Component is required for error context');
  }
  if (!operation) {
    throw new Error('Operation is required for error context');
  }

  return context;
}

/**
 * Create error context for parser operations
 */
export function createParserContext(
  operation: string,
  overrides?: Partial<ErrorContext>
): ErrorContext {
  return createErrorContext('parser', operation, overrides);
}

/**
 * Create error context for FSM operations
 */
export function createFSMContext(
  operation: string,
  workflowName?: string,
  stateName?: string,
  overrides?: Partial<ErrorContext>
): ErrorContext {
  return createErrorContext('fsm', operation, {
    workflowName,
    stateName,
    ...overrides
  });
}

/**
 * Create error context for executor operations
 */
export function createExecutorContext(
  operation: string,
  command?: string,
  overrides?: Partial<ErrorContext>
): ErrorContext {
  return createErrorContext('executor', operation, {
    command,
    ...overrides
  });
}

/**
 * Create error context for templater operations
 */
export function createTemplaterContext(
  operation: string,
  overrides?: Partial<ErrorContext>
): ErrorContext {
  return createErrorContext('templater', operation, overrides);
}

/**
 * Create error context for confirmation operations
 */
export function createConfirmationContext(
  operation: string,
  userAction?: string,
  overrides?: Partial<ErrorContext>
): ErrorContext {
  return createErrorContext('confirmation', operation, {
    userAction,
    ...overrides
  });
}

/**
 * Create error context for CLI operations
 */
export function createCLIContext(
  operation: string,
  overrides?: Partial<ErrorContext>
): ErrorContext {
  return createErrorContext('cli', operation, overrides);
}