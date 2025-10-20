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