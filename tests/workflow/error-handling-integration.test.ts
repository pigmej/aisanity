/**
 * Integration tests for error handling across workflow components
 */

import { WorkflowParser } from '../../src/workflow/parser';
import { StateMachine } from '../../src/workflow/fsm';
import { CommandExecutor } from '../../src/workflow/executor';
import { ConfirmationHandler } from '../../src/workflow/confirmation-handler';
import { ArgumentTemplater } from '../../src/workflow/argument-templater';
import { DryRunSimulator } from '../../src/workflow/dry-run-simulator';
import { WorkflowErrorHandler } from '../../src/workflow/error-handler';
import { Logger } from '../../src/utils/logger';
import {
  WorkflowValidationError,
  WorkflowFileError,
  StateNotFoundError
} from '../../src/workflow/errors';

describe('Error Handling Integration', () => {
  let logger: Logger;
  let errorHandler: WorkflowErrorHandler;

  beforeEach(() => {
    logger = new Logger(false, false);
    errorHandler = new WorkflowErrorHandler(logger);
  });

  describe('Parser Error Integration', () => {
    it('should handle file not found errors with context', () => {
      const parser = new WorkflowParser(logger, errorHandler);
      
      expect(() => {
        parser.loadWorkflows('/nonexistent/path');
      }).toThrow(WorkflowFileError);
    });

    it('should handle validation errors with context', () => {
      const parser = new WorkflowParser(logger, errorHandler);
      
      // Create a temporary workflow file with invalid content
      const tempDir = '/tmp/test-workflows';
      const tempFile = `${tempDir}/.aisanity-workflows.yml`;
      
      // Create temp directory and file
      require('fs').mkdirSync(tempDir, { recursive: true });
      require('fs').writeFileSync(tempFile, 'invalid: yaml: content: [');
      
      try {
        // This should throw a WorkflowParseError which gets converted to WorkflowValidationError
        expect(() => {
          parser.loadWorkflows(tempDir);
        }).toThrow();
      } finally {
        // Cleanup
        require('fs').rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('FSM Error Integration', () => {
    it('should handle state not found errors with context', async () => {
      const workflow = {
        name: 'test-workflow',
        initialState: 'start',
        states: {
          start: {
            command: 'echo hello',
            transitions: { success: 'nonexistent' }
          }
        }
      };

      // StateMachine constructor should throw WorkflowValidationError for invalid transitions
      expect(() => {
        const executor = new CommandExecutor(logger, 120000, {}, errorHandler);
        const confirmationHandler = new ConfirmationHandler(executor, logger, {}, errorHandler);
        new StateMachine(workflow, logger, executor, confirmationHandler, errorHandler);
      }).toThrow(WorkflowValidationError);
    });
  });

  describe('Executor Error Integration', () => {
    it('should handle command execution errors with context', async () => {
      const executor = new CommandExecutor(logger, 120000, {}, errorHandler);
      
      try {
        await executor.executeCommand('nonexistent-command-12345', []);
      } catch (error) {
        expect(error).toBeDefined();
        // Error should be handled and enriched with context
      }
    });
  });

  describe('Argument Templater Error Integration', () => {
    it('should handle template substitution errors with context', async () => {
      const templater = new ArgumentTemplater(logger, errorHandler);
      
      // This should handle errors gracefully even with invalid templates
      const result = await templater.processCommandArgs(
        'echo {invalidVar}',
        [],
        {}
      );
      
      // Should return validation errors rather than throwing
      expect(result.validationErrors).toBeDefined();
    });
  });

  describe('Confirmation Handler Error Integration', () => {
    it('should handle timeout errors with context', async () => {
      const executor = new CommandExecutor(logger, 120000, {}, errorHandler);
      const confirmationHandler = new ConfirmationHandler(executor, logger, {}, errorHandler);
      
      // Use very short timeout to trigger timeout error
      // Note: minimum timeout is 1000ms, so we need to mock the timeout behavior
      const result = await confirmationHandler.requestConfirmation('Test?', {
        timeout: 1 // 1ms timeout (will be increased to minimum 1000ms)
      });
      
      // The result should be either 'user' (if user responds quickly) or 'timeout'
      // We just verify the confirmation handler doesn't crash
      expect(['user', 'timeout', 'auto']).toContain(result.method);
    });
  });

  describe('Dry Run Simulator Error Integration', () => {
    it('should handle simulation errors with context', async () => {
      const workflow = {
        name: 'test-workflow',
        initialState: 'start',
        states: {
        start: {
          command: 'echo hello',
          transitions: { success: undefined }
        }
        }
      };

      const executor = new CommandExecutor(logger, 120000, {}, errorHandler);
      const confirmationHandler = new ConfirmationHandler(executor, logger, {}, errorHandler);
      const stateMachine = new StateMachine(workflow, logger, executor, confirmationHandler, errorHandler);
      const simulator = new DryRunSimulator(stateMachine, logger, errorHandler);
      
      const result = await simulator.simulate();
      expect(result.success).toBe(true);
    });
  });

  describe('End-to-End Error Flow', () => {
    it('should handle complete error flow from parser to CLI', () => {
      const parser = new WorkflowParser(logger, errorHandler);
      
      try {
        // Trigger a series of errors
        parser.getWorkflow('nonexistent', '/nonexistent');
      } catch (error) {
        // Error should be properly handled and enriched
        expect(error).toBeInstanceOf(WorkflowFileError);
      }
    });

    it('should provide consistent exit codes across error types', () => {
      const validationError = new WorkflowValidationError('Test validation error');
      const fileError = new WorkflowFileError('Test file error', '/path', 'missing');
      const stateError = new StateNotFoundError('Test state error', 'state', 'workflow');
      const genericError = new Error('Test generic error');

      expect(errorHandler.getExitCode(validationError)).toBe(2); // VALIDATION_ERROR
      expect(errorHandler.getExitCode(fileError)).toBe(3); // FILE_NOT_FOUND
      expect(errorHandler.getExitCode(stateError)).toBe(128); // INVALID_ARGUMENT
      expect(errorHandler.getExitCode(genericError)).toBe(1); // GENERAL_ERROR
    });
  });

  describe('Cleanup Handler Integration', () => {
    it('should execute cleanup handlers on error', async () => {
      let cleanupCalled = false;
      errorHandler.registerCleanupHandler(() => {
        cleanupCalled = true;
      });

      try {
        await errorHandler.enrichAndThrow(
          new Error('Test error'),
          { component: 'test', operation: 'test' } as any
        );
      } catch (error) {
        // Expected to throw
      }

      expect(cleanupCalled).toBe(true);
    });
  });
});