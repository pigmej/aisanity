/**
 * Custom error classes for workflow parsing and validation
 * Provides detailed context for debugging workflow configuration issues
 */

export class WorkflowParseError extends Error {
  public readonly filePath: string;
  public readonly line?: number;
  public readonly column?: number;

  constructor(
    message: string,
    filePath: string,
    line?: number,
    column?: number
  ) {
    super(message);
    this.filePath = filePath;
    this.line = line;
    this.column = column;
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
  public readonly workflowName?: string;
  public readonly fieldPath?: string;
  public readonly line?: number;

  constructor(
    message: string,
    workflowName?: string,
    fieldPath?: string,
    line?: number
  ) {
    super(message);
    this.workflowName = workflowName;
    this.fieldPath = fieldPath;
    this.line = line;
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
  public readonly filePath: string;
  public readonly reason: 'missing' | 'permission' | 'invalid';

  constructor(
    message: string,
    filePath: string,
    reason: 'missing' | 'permission' | 'invalid'
  ) {
    super(message);
    this.filePath = filePath;
    this.reason = reason;
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
  public readonly fromState: string;
  public readonly exitCode: number;
  public readonly workflowName: string;

  constructor(
    message: string,
    fromState: string,
    exitCode: number,
    workflowName: string
  ) {
    super(message);
    this.fromState = fromState;
    this.exitCode = exitCode;
    this.workflowName = workflowName;
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
  public readonly workflowName: string;
  public readonly currentState: string;
  public readonly cause?: Error;

  constructor(
    message: string,
    workflowName: string,
    currentState: string,
    cause?: Error
  ) {
    super(message);
    this.workflowName = workflowName;
    this.currentState = currentState;
    this.cause = cause;
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
  public readonly stateName: string;
  public readonly workflowName: string;

  constructor(
    message: string,
    stateName: string,
    workflowName: string
  ) {
    super(message);
    this.stateName = stateName;
    this.workflowName = workflowName;
    this.name = 'StateNotFoundError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StateNotFoundError);
    }
  }

  toString(): string {
    return `${this.name}: ${this.message} (workflow: ${this.workflowName}, state: ${this.stateName})`;
  }
}