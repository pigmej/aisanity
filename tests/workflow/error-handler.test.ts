/**
 * Tests for WorkflowErrorHandler
 */

import { WorkflowErrorHandler } from '../../src/workflow/error-handler';
import { Logger } from '../../src/utils/logger';
import {
  WorkflowValidationError,
  WorkflowFileError,
  StateTransitionError
} from '../../src/workflow/errors';
import {
  createParserContext,
  createFSMContext,
  createExecutorContext,
  EXIT_CODES
} from '../../src/workflow/error-context';

describe('WorkflowErrorHandler', () => {
  let errorHandler: WorkflowErrorHandler;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn()
    } as any;
    
    errorHandler = new WorkflowErrorHandler(mockLogger);
  });

  describe('getExitCode', () => {
    it('should return correct exit code for validation errors', () => {
      const error = new WorkflowValidationError('Invalid workflow', 'test-workflow');
      const exitCode = errorHandler.getExitCode(error);
      expect(exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
    });

    it('should return correct exit code for file not found errors', () => {
      const error = new WorkflowFileError('File not found', '/path/to/file', 'missing');
      const exitCode = errorHandler.getExitCode(error);
      expect(exitCode).toBe(EXIT_CODES.FILE_NOT_FOUND);
    });

    it('should return correct exit code for permission errors', () => {
      const error = new WorkflowFileError('Permission denied', '/path/to/file', 'permission');
      const exitCode = errorHandler.getExitCode(error);
      expect(exitCode).toBe(EXIT_CODES.PERMISSION_DENIED);
    });

    it('should return correct exit code for state transition errors', () => {
      const error = new StateTransitionError('Invalid transition', 'state1', 1, 'test-workflow');
      const exitCode = errorHandler.getExitCode(error);
      expect(exitCode).toBe(1); // Uses the error's exit code
    });

    it('should return general error code for unknown errors', () => {
      const error = new Error('Unknown error');
      const exitCode = errorHandler.getExitCode(error);
      expect(exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
    });

    it('should return timeout error code for timeout messages', () => {
      const error = new Error('Operation timed out');
      const exitCode = errorHandler.getExitCode(error);
      expect(exitCode).toBe(EXIT_CODES.TIMEOUT_ERROR);
    });
  });

  describe('enrichAndThrowSync', () => {
    it('should log error and re-throw', () => {
      const error = new WorkflowValidationError('Test error', 'test-workflow');
      const context = createParserContext('testOperation');

      expect(() => errorHandler.enrichAndThrowSync(error, context)).toThrow('Test error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Workflow validation failed: Test error')
      );
    });

    it('should include suggested action in user message', () => {
      const error = new WorkflowValidationError('Test error', 'test-workflow');
      const context = createParserContext('testOperation');

      try {
        errorHandler.enrichAndThrowSync(error, context);
      } catch (e) {
        // Error should be logged with suggestion
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Suggestion: Check your .aisanity-workflows.yml file')
        );
      }
    });
  });

  describe('Specialized handlers', () => {
    it('should handle validation errors with context', () => {
      const error = new WorkflowValidationError('Invalid workflow', 'test-workflow', 'field.path');
      const context = createParserContext('validate');

      expect(() => errorHandler.handleValidationError(error, context)).toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Workflow validation failed: Invalid workflow')
      );
    });

    it('should handle file errors with context', () => {
      const error = new WorkflowFileError('File missing', '/path/to/file', 'missing');
      const context = createParserContext('loadFile');

      expect(() => errorHandler.handleFileError(error, context)).toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Workflow file error: File missing')
      );
    });

    it('should handle execution errors with context', () => {
      const error = new StateTransitionError('Transition failed', 'state1', 1, 'test-workflow');
      const context = createFSMContext('execute', 'test-workflow', 'state1');

      expect(() => errorHandler.handleTransitionError(error, context)).toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('State transition failed: Transition failed')
      );
    });
  });

  describe('Cleanup handlers', () => {
    it('should execute cleanup handlers before throwing', async () => {
      const cleanupHandler = jest.fn();
      errorHandler.registerCleanupHandler(cleanupHandler);

      const error = new Error('Test error');
      const context = createExecutorContext('test', 'test-command');

      try {
        await errorHandler.enrichAndThrow(error, context);
      } catch (e) {
        // Expected to throw
      }

      expect(cleanupHandler).toHaveBeenCalled();
    });

    it('should handle cleanup handler errors gracefully', async () => {
      const cleanupHandler = jest.fn(() => {
        throw new Error('Cleanup failed');
      });
      errorHandler.registerCleanupHandler(cleanupHandler);

      const error = new Error('Test error');
      const context = createExecutorContext('test', 'test-command');

      expect(() => errorHandler.enrichAndThrowSync(error, context)).toThrow();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cleanup handler failed')
      );
    });
  });

  describe('Message sanitization', () => {
    it('should sanitize user messages', () => {
      const error = new Error('Error with /home/user/path and $ENV_VAR and 192.168.1.1');
      const context = createExecutorContext('test', 'test-command');

      try {
        errorHandler.enrichAndThrowSync(error, context);
      } catch (e) {
        // Check that sensitive info was sanitized in the logged message
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('~/')
        );
        expect(mockLogger.error).not.toHaveBeenCalledWith(
          expect.stringContaining('/home/user/')
        );
      }
    });

    it('should sanitize Windows paths', () => {
      const error = new Error('Error with /Users/admin/secret.txt');
      const context = createExecutorContext('test', 'test-command');

      try {
        errorHandler.enrichAndThrowSync(error, context);
      } catch (e) {
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('~')
        );
      }
    });

    it('should limit error message length', () => {
      const longMessage = 'Error: ' + 'x'.repeat(600);
      const error = new Error(longMessage);
      const context = createExecutorContext('test', 'test-command');

      try {
        errorHandler.enrichAndThrowSync(error, context);
      } catch (e) {
        expect(mockLogger.error).toHaveBeenCalled();
        const errorCall = (mockLogger.error as jest.Mock).mock.calls[0][0];
        expect(errorCall.length).toBeLessThan(600);
      }
    });
  });

  describe('Additional error handlers', () => {
    it('should handle timeout errors', () => {
      const context = createExecutorContext('test', 'test-command');

      expect(() => errorHandler.handleTimeoutError(context, 5000)).toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('timed out after 5000ms')
      );
    });

    it('should handle confirmation errors', () => {
      const context = createExecutorContext('test', 'test-command');

      expect(() => errorHandler.handleConfirmationError(context, 'User declined')).toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Confirmation failed: User declined')
      );
    });

    it('should handle simulation errors', () => {
      const error = new Error('Simulation failed');
      const context = createExecutorContext('test', 'test-command');

      expect(() => errorHandler.handleSimulationError(error, context)).toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Error code mapping', () => {
    it('should map ENOENT errors correctly', () => {
      const error = new Error('Command not found: ENOENT');
      const exitCode = errorHandler.getExitCode(error);
      expect(exitCode).toBe(3); // COMMAND_NOT_FOUND as defined in EXIT_CODES
    });

    it('should map EACCES errors correctly', () => {
      const error = new Error('Permission denied: EACCES');
      const exitCode = errorHandler.getExitCode(error);
      expect(exitCode).toBe(4); // PERMISSION_DENIED as defined in EXIT_CODES
    });

    it('should map timeout messages correctly', () => {
      const error = new Error('Operation timeout occurred');
      const exitCode = errorHandler.getExitCode(error);
      expect(exitCode).toBe(6); // TIMEOUT_ERROR as defined in EXIT_CODES
    });
  });

  describe('Async cleanup handlers', () => {
    it('should handle async cleanup handlers', async () => {
      const asyncCleanup = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      errorHandler.registerCleanupHandler(asyncCleanup);

      const error = new Error('Test error');
      const context = createExecutorContext('test', 'test-command');

      try {
        await errorHandler.enrichAndThrow(error, context);
      } catch (e) {
        // Expected to throw
      }

      expect(asyncCleanup).toHaveBeenCalled();
    });

    it('should warn about async cleanup in sync context', () => {
      const asyncCleanup = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      errorHandler.registerCleanupHandler(asyncCleanup);

      const error = new Error('Test error');
      const context = createExecutorContext('test', 'test-command');

      try {
        errorHandler.enrichAndThrowSync(error, context);
      } catch (e) {
        // Expected to throw
      }

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Async cleanup handler in sync context')
      );
    });
  });
});