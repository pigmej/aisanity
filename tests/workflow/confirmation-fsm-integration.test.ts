/**
 * Integration tests for ConfirmationHandler with FSM
 */

import { StateMachine } from '../../src/workflow/fsm';
import { ConfirmationHandler } from '../../src/workflow/confirmation-handler';
import { CommandExecutor } from '../../src/workflow/executor';
import { Logger } from '../../src/utils/logger';
import { Workflow } from '../../src/workflow/interfaces';

describe('Confirmation FSM Integration', () => {
  let executor: jest.Mocked<CommandExecutor>;
  let confirmationHandler: ConfirmationHandler;
  let mockLogger: jest.Mocked<Logger>;
  let fsm: StateMachine;
  let workflow: Workflow;

  beforeEach(() => {
    executor = {
      executeCommand: jest.fn(),
      executeTUICommand: jest.fn(),
      executeConfirmation: jest.fn(),
      executeSelection: jest.fn(),
      cleanup: jest.fn(),
      getActiveProcessCount: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any;

    confirmationHandler = new ConfirmationHandler(executor, mockLogger);

    workflow = {
      name: 'test-with-confirmation',
      initialState: 'start',
      states: {
        start: {
          command: 'echo',
          args: ['Starting...'],
          confirmation: {
            message: 'Begin workflow?',
            timeout: 30000,
            defaultAccept: false
          },
          transitions: {
            success: 'process',
            failure: 'cancelled'
          }
        },
        process: {
          command: 'echo',
          args: ['Processing...'],
          transitions: {
            success: 'complete'
          }
        },
        complete: { 
          command: 'echo',
          args: ['Complete!'],
          transitions: {}
        },
        cancelled: { 
          command: 'echo',
          args: ['Cancelled!'],
          transitions: {}
        }
      }
    };

    fsm = new StateMachine(workflow, mockLogger, executor, confirmationHandler);
  });

  it('should pause for confirmation before state execution', async () => {
    // Mock user confirming
    jest.spyOn(confirmationHandler, 'requestConfirmation')
      .mockResolvedValue({
        confirmed: true,
        method: 'user',
        duration: 100
      });
    
    // Mock successful command execution
    executor.executeCommand.mockResolvedValue({
      exitCode: 0,
      stdout: 'Starting...',
      stderr: '',
      duration: 50
    });

    const result = await fsm.executeState('start');
    
    expect(confirmationHandler.requestConfirmation).toHaveBeenCalledWith(
      'Begin workflow?',
      expect.objectContaining({
        timeout: 30000,
        defaultResponse: false
      })
    );
    
    expect(result.exitCode).toBe(0);
    expect(result.stateName).toBe('start');
  });

  it('should route to failure on declined confirmation', async () => {
    // Mock user declining
    jest.spyOn(confirmationHandler, 'requestConfirmation')
      .mockResolvedValue({
        confirmed: false,
        method: 'user',
        duration: 50
      });
    
    const result = await fsm.executeState('start');
    
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Confirmation declined');
  });

  it('should skip confirmation with --yes flag', async () => {
    const requestConfirmationSpy = jest.spyOn(confirmationHandler, 'requestConfirmation');
    
    executor.executeCommand.mockResolvedValue({
      exitCode: 0,
      stdout: 'Starting...',
      stderr: '',
      duration: 50
    });

    const result = await fsm.executeState('start', { yesFlag: true });
    
    // Confirmation should be bypassed
    expect(result.exitCode).toBe(0);
    expect(requestConfirmationSpy).not.toHaveBeenCalled();
    
    requestConfirmationSpy.mockRestore();
  });

  it('should handle confirmation timeout', async () => {
    // Mock timeout
    jest.spyOn(confirmationHandler, 'requestConfirmation')
      .mockResolvedValue({
        confirmed: false,  // defaultAccept is false
        method: 'timeout',
        duration: 30000,
        timedOut: true
      });
    
    const result = await fsm.executeState('start');
    
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Confirmation declined');
  });

  it('should execute full workflow with confirmation', async () => {
    // Mock confirmation acceptance
    jest.spyOn(confirmationHandler, 'requestConfirmation')
      .mockResolvedValue({
        confirmed: true,
        method: 'user',
        duration: 100
      });
    
    // Mock successful command executions
    executor.executeCommand.mockResolvedValue({
      exitCode: 0,
      stdout: 'Success',
      stderr: '',
      duration: 50
    });

    const result = await fsm.execute();
    
    expect(result.success).toBe(true);
    expect(result.finalState).toBe('complete');
    expect(result.stateHistory).toHaveLength(3); // start, process, complete
  });

  it('should handle workflow cancellation via confirmation', async () => {
    // Mock confirmation decline
    jest.spyOn(confirmationHandler, 'requestConfirmation')
      .mockResolvedValue({
        confirmed: false,
        method: 'user',
        duration: 50
      });
    
    const result = await fsm.execute();
    
    expect(result.success).toBe(true); // Workflow completes successfully
    expect(result.finalState).toBe('cancelled');
    expect(result.stateHistory.length).toBeGreaterThanOrEqual(1); // At least start state executed
  });

  it('should work with --yes flag for entire workflow', async () => {
    const requestConfirmationSpy = jest.spyOn(confirmationHandler, 'requestConfirmation');
    
    // Mock successful command executions
    executor.executeCommand.mockResolvedValue({
      exitCode: 0,
      stdout: 'Success',
      stderr: '',
      duration: 50
    });

    const result = await fsm.execute({ yesFlag: true });
    
    expect(result.success).toBe(true);
    expect(result.finalState).toBe('complete');
    expect(requestConfirmationSpy).not.toHaveBeenCalled();
    
    requestConfirmationSpy.mockRestore();
  });

  it('should handle states without confirmation', async () => {
    // Create workflow with mixed confirmation states
    const mixedWorkflow: Workflow = {
      name: 'mixed-confirmation',
      initialState: 'step1',
      states: {
        step1: {
          command: 'echo',
          args: ['Step 1'],
          confirmation: {
            message: 'Run step 1?'
          },
          transitions: { success: 'step2' }
        },
        step2: {
          command: 'echo',
          args: ['Step 2'],
          transitions: { success: 'complete' }
        },
        complete: {
          command: 'echo',
          args: ['Complete!'],
          transitions: {}
        }
      }
    };

    const mixedFsm = new StateMachine(mixedWorkflow, mockLogger, executor, confirmationHandler);

    // Mock confirmation acceptance
    jest.spyOn(confirmationHandler, 'requestConfirmation')
      .mockResolvedValue({
        confirmed: true,
        method: 'user',
        duration: 100
      });
    
    // Mock successful command executions
    executor.executeCommand.mockResolvedValue({
      exitCode: 0,
      stdout: 'Success',
      stderr: '',
      duration: 50
    });

    const result = await mixedFsm.execute();
    
    expect(result.success).toBe(true);
    expect(result.finalState).toBe('complete');
    
    // Confirmation should only be called for step1
    expect(confirmationHandler.requestConfirmation).toHaveBeenCalledTimes(1);
    expect(confirmationHandler.requestConfirmation).toHaveBeenCalledWith('Run step 1?', {
      defaultResponse: undefined,
      timeout: undefined,
      yesFlag: false
    });
  });

  it('should handle confirmation with custom message', async () => {
    const customWorkflow: Workflow = {
      name: 'custom-message',
      initialState: 'start',
      states: {
        start: {
          command: 'echo',
          args: ['Start'],
          confirmation: {
            message: 'Custom confirmation message?',
            timeout: 15000,
            defaultAccept: true
          },
          transitions: { success: 'complete' }
        },
        complete: {
          command: 'echo',
          args: ['Complete!'],
          transitions: {}
        }
      }
    };

    const customFsm = new StateMachine(customWorkflow, mockLogger, executor, confirmationHandler);

    // Mock confirmation acceptance
    jest.spyOn(confirmationHandler, 'requestConfirmation')
      .mockResolvedValue({
        confirmed: true,
        method: 'user',
        duration: 100
      });
    
    executor.executeCommand.mockResolvedValue({
      exitCode: 0,
      stdout: 'Success',
      stderr: '',
      duration: 50
    });

    await customFsm.executeState('start');
    
    expect(confirmationHandler.requestConfirmation).toHaveBeenCalledWith(
      'Custom confirmation message?',
      {
        timeout: 15000,
        defaultResponse: true,
        yesFlag: false
      }
    );
  });
});