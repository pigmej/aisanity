/**
 * Tests for custom error classes
 * Verifies error message formatting and context information
 */

import { describe, it, expect } from 'bun:test';
import {
  WorkflowParseError,
  WorkflowValidationError,
  WorkflowFileError
} from '../../src/workflow/errors';

describe('WorkflowParseError', () => {
  it('should create error with basic information', () => {
    const error = new WorkflowParseError(
      'Test parse error',
      '/path/to/file.yml'
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(WorkflowParseError);
    expect(error.name).toBe('WorkflowParseError');
    expect(error.message).toBe('Test parse error');
    expect(error.filePath).toBe('/path/to/file.yml');
    expect(error.line).toBeUndefined();
    expect(error.column).toBeUndefined();
  });

  it('should create error with line and column information', () => {
    const error = new WorkflowParseError(
      'Test parse error',
      '/path/to/file.yml',
      10,
      5
    );

    expect(error.line).toBe(10);
    expect(error.column).toBe(5);
  });

  it('should format toString correctly with line only', () => {
    const error = new WorkflowParseError(
      'Test parse error',
      '/path/to/file.yml',
      10
    );

    const result = error.toString();
    expect(result).toBe('WorkflowParseError: Test parse error (line 10) in /path/to/file.yml');
  });

  it('should format toString correctly with line and column', () => {
    const error = new WorkflowParseError(
      'Test parse error',
      '/path/to/file.yml',
      10,
      5
    );

    const result = error.toString();
    expect(result).toBe('WorkflowParseError: Test parse error (line 10:5) in /path/to/file.yml');
  });

  it('should format toString correctly without line info', () => {
    const error = new WorkflowParseError(
      'Test parse error',
      '/path/to/file.yml'
    );

    const result = error.toString();
    expect(result).toBe('WorkflowParseError: Test parse error in /path/to/file.yml');
  });
});

describe('WorkflowValidationError', () => {
  it('should create error with basic information', () => {
    const error = new WorkflowValidationError('Test validation error');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(WorkflowValidationError);
    expect(error.name).toBe('WorkflowValidationError');
    expect(error.message).toBe('Test validation error');
    expect(error.workflowName).toBeUndefined();
    expect(error.fieldPath).toBeUndefined();
    expect(error.line).toBeUndefined();
  });

  it('should create error with full context', () => {
    const error = new WorkflowValidationError(
      'Test validation error',
      'test-workflow',
      'states.build.command',
      15
    );

    expect(error.workflowName).toBe('test-workflow');
    expect(error.fieldPath).toBe('states.build.command');
    expect(error.line).toBe(15);
  });

  it('should format toString correctly with all context', () => {
    const error = new WorkflowValidationError(
      'Test validation error',
      'test-workflow',
      'states.build.command',
      15
    );

    const result = error.toString();
    expect(result).toBe(
      'WorkflowValidationError: Test validation error in workflow \'test-workflow\' at field \'states.build.command\' (line 15)'
    );
  });

  it('should format toString correctly with partial context', () => {
    const error = new WorkflowValidationError(
      'Test validation error',
      'test-workflow',
      'states.build.command'
    );

    const result = error.toString();
    expect(result).toBe(
      'WorkflowValidationError: Test validation error in workflow \'test-workflow\' at field \'states.build.command\''
    );
  });

  it('should format toString correctly with workflow name only', () => {
    const error = new WorkflowValidationError(
      'Test validation error',
      'test-workflow'
    );

    const result = error.toString();
    expect(result).toBe(
      'WorkflowValidationError: Test validation error in workflow \'test-workflow\''
    );
  });

  it('should format toString correctly with no context', () => {
    const error = new WorkflowValidationError('Test validation error');

    const result = error.toString();
    expect(result).toBe('WorkflowValidationError: Test validation error');
  });
});

describe('WorkflowFileError', () => {
  it('should create error with required information', () => {
    const error = new WorkflowFileError(
      'Test file error',
      '/path/to/file.yml',
      'missing'
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(WorkflowFileError);
    expect(error.name).toBe('WorkflowFileError');
    expect(error.message).toBe('Test file error');
    expect(error.filePath).toBe('/path/to/file.yml');
    expect(error.reason).toBe('missing');
  });

  it('should format toString correctly', () => {
    const error = new WorkflowFileError(
      'Test file error',
      '/path/to/file.yml',
      'permission'
    );

    const result = error.toString();
    expect(result).toBe('WorkflowFileError: Test file error (permission: /path/to/file.yml)');
  });

  it('should accept all valid reason types', () => {
    const reasons: Array<'missing' | 'permission' | 'invalid'> = ['missing', 'permission', 'invalid'];
    
    reasons.forEach(reason => {
      const error = new WorkflowFileError('Test', '/path', reason);
      expect(error.reason).toBe(reason);
    });
  });
});

describe('Error Inheritance', () => {
  it('should maintain proper instanceof relationships', () => {
    const parseError = new WorkflowParseError('test', '/path');
    const validationError = new WorkflowValidationError('test');
    const fileError = new WorkflowFileError('test', '/path', 'missing');

    expect(parseError).toBeInstanceOf(Error);
    expect(parseError).toBeInstanceOf(WorkflowParseError);
    
    expect(validationError).toBeInstanceOf(Error);
    expect(validationError).toBeInstanceOf(WorkflowValidationError);
    
    expect(fileError).toBeInstanceOf(Error);
    expect(fileError).toBeInstanceOf(WorkflowFileError);
  });

  it('should have proper stack traces', () => {
    const error = new WorkflowParseError('test', '/path');
    
    // Stack trace should exist and include the error constructor
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('WorkflowParseError');
  });
});