/**
 * Custom error classes for workflow parsing and validation
 * Provides detailed context for debugging workflow configuration issues
 */

export class WorkflowParseError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly line?: number,
    public readonly column?: number
  ) {
    super(message);
    this.name = 'WorkflowParseError';
    
    // Maintain proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WorkflowParseError);
    }
  }

  toString(): string {
    let result = `${this.name}: ${this.message}`;
    if (this.line) {
      result += ` (line ${this.line}`;
      if (this.column) {
        result += `:${this.column}`;
      }
      result += ')';
    }
    result += ` in ${this.filePath}`;
    return result;
  }
}

export class WorkflowValidationError extends Error {
  constructor(
    message: string,
    public readonly workflowName?: string,
    public readonly fieldPath?: string,
    public readonly line?: number
  ) {
    super(message);
    this.name = 'WorkflowValidationError';
    
    // Maintain proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WorkflowValidationError);
    }
  }

  toString(): string {
    let result = `${this.name}: ${this.message}`;
    if (this.workflowName) {
      result += ` in workflow '${this.workflowName}'`;
    }
    if (this.fieldPath) {
      result += ` at field '${this.fieldPath}'`;
    }
    if (this.line) {
      result += ` (line ${this.line})`;
    }
    return result;
  }
}

export class WorkflowFileError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly reason: 'missing' | 'permission' | 'invalid'
  ) {
    super(message);
    this.name = 'WorkflowFileError';
    
    // Maintain proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WorkflowFileError);
    }
  }

  toString(): string {
    return `${this.name}: ${this.message} (${this.reason}: ${this.filePath})`;
  }
}

/**
 * Error thrown when a state transition is invalid or fails
 */
export class StateTransitionError extends Error {
  constructor(
    message: string,
    public readonly fromState: string,
    public readonly exitCode: number,
    public readonly workflowName: string
  ) {
    super(message);
    this.name = 'StateTransitionError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StateTransitionError);
    }
  }

  toString(): string {
    return `${this.name}: ${this.message} (workflow: ${this.workflowName}, state: ${this.fromState}, exit code: ${this.exitCode})`;
  }
}

/**
 * Error thrown during workflow execution
 */
export class WorkflowExecutionError extends Error {
  constructor(
    message: string,
    public readonly workflowName: string,
    public readonly currentState: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'WorkflowExecutionError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WorkflowExecutionError);
    }
  }

  toString(): string {
    let result = `${this.name}: ${this.message} (workflow: ${this.workflowName}, state: ${this.currentState})`;
    if (this.cause) {
      result += ` - Caused by: ${this.cause.message}`;
    }
    return result;
  }
}

/**
 * Error thrown when a requested state is not found in the workflow
 */
export class StateNotFoundError extends Error {
  constructor(
    message: string,
    public readonly stateName: string,
    public readonly workflowName: string
  ) {
    super(message);
    this.name = 'StateNotFoundError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StateNotFoundError);
    }
  }

  toString(): string {
    return `${this.name}: ${this.message} (workflow: ${this.workflowName}, state: ${this.stateName})`;
  }
}