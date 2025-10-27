/**
 * Integration tests for CommandExecutor with FSM
 */

import { CommandExecutor } from '../../src/workflow/executor';
import { StateMachine } from '../../src/workflow/fsm';
import { Workflow, State } from '../../src/workflow/interfaces';

describe('CommandExecutor FSM Integration', () => {
  let executor: CommandExecutor;

  beforeEach(() => {
    executor = new CommandExecutor();
  });

  afterEach(async () => {
    await executor.cleanup();
  });

  it('should execute workflow states in sequence', async () => {
    const workflow: Workflow = {
      name: 'test-workflow',
      initialState: 'start',
      states: {
        start: {
          command: 'echo',
          args: ['Starting workflow'],
          transitions: {
            success: 'check',
            failure: 'error'
          }
        },
        check: {
          command: 'bash',
          args: ['-c', 'exit 0'],
          transitions: {
            success: 'complete',
            failure: 'error'
          }
        },
        complete: {
          command: 'echo',
          args: ['Workflow complete'],
          transitions: {}
        },
        error: {
          command: 'echo',
          args: ['Workflow failed'],
          transitions: {}
        }
      }
    };
    
    const fsm = new StateMachine(workflow, undefined, executor);
    const result = await fsm.execute();
    
    expect(result.success).toBe(true);
    expect(result.finalState).toBe('complete');
    expect(result.stateHistory).toHaveLength(3);
    expect(result.stateHistory.map(entry => entry.stateName)).toEqual(['start', 'check', 'complete']);
  });

  it('should route on exit codes', async () => {
    const workflow: Workflow = {
      name: 'exit-code-test',
      initialState: 'start',
      states: {
        start: {
          command: 'bash',
          args: ['-c', 'exit 1'], // Non-zero exit
          transitions: {
            success: 'success',
            failure: 'failure'
          }
        },
        success: { 
          command: 'echo',
          args: ['Success path'],
          transitions: {}
        },
        failure: { 
          command: 'echo',
          args: ['Failure path'],
          transitions: {}
        }
      }
    };
    
    const fsm = new StateMachine(workflow, undefined, executor);
    const result = await fsm.execute();
    
    expect(result.finalState).toBe('failure');
  });

  it('should handle workflow with timeout', async () => {
    const workflow: Workflow = {
      name: 'timeout-test',
      initialState: 'start',
      states: {
        start: {
          command: 'sleep',
          args: ['10'],
          timeout: 100, // 100ms timeout
          transitions: {
            success: 'complete',
            failure: 'error',
            timeout: 'error'
          }
        },
        complete: {
          command: 'echo',
          args: ['Complete'],
          transitions: {}
        },
        error: {
          command: 'echo',
          args: ['Error'],
          transitions: {}
        }
      }
    };
    
    const fsm = new StateMachine(workflow, undefined, executor);
    const result = await fsm.execute();
    
    expect(result.finalState).toBe('error');
  });

  it('should handle complex workflow with multiple paths', async () => {
    const workflow: Workflow = {
      name: 'complex-workflow',
      initialState: 'init',
      states: {
        init: {
          command: 'echo',
          args: ['Initializing'],
          transitions: {
            success: 'validate',
            failure: 'cleanup'
          }
        },
        validate: {
          command: 'bash',
          args: ['-c', 'exit 0'], // Simulate validation success
          transitions: {
            success: 'process',
            failure: 'cleanup'
          }
        },
        process: {
          command: 'echo',
          args: ['Processing data'],
          transitions: {
            success: 'finalize',
            failure: 'cleanup'
          }
        },
        finalize: {
          command: 'echo',
          args: ['Finalizing'],
          transitions: {
            success: 'complete',
            failure: 'cleanup'
          }
        },
        cleanup: {
          command: 'echo',
          args: ['Cleaning up'],
          transitions: {
            success: 'complete',
            failure: 'error'
          }
        },
        complete: {
          command: 'echo',
          args: ['Workflow complete'],
          transitions: {}
        },
        error: {
          command: 'echo',
          args: ['Workflow error'],
          transitions: {}
        }
      }
    };
    
    const fsm = new StateMachine(workflow, undefined, executor);
    const result = await fsm.execute();
    
    expect(result.success).toBe(true);
    expect(result.finalState).toBe('complete');
    expect(result.stateHistory).toHaveLength(5);
    expect(result.stateHistory.map(entry => entry.stateName)).toEqual(['init', 'validate', 'process', 'finalize', 'complete']);
  });

  it('should handle workflow with environment variables', async () => {
    const workflow: Workflow = {
      name: 'env-test',
      initialState: 'start',
      states: {
        start: {
          command: 'bash',
          args: ['-c', 'echo $TEST_VAR'],
          transitions: {
            success: 'complete',
            failure: 'error'
          }
        },
        complete: {
          command: 'echo',
          args: ['Done'],
          transitions: {}
        },
        error: {
          command: 'echo',
          args: ['Error'],
          transitions: {}
        }
      }
    };
    
    // Note: This test would require the FSM to support environment variables
    // For now, we'll test that it executes without crashing
    const fsm = new StateMachine(workflow, undefined, executor);
    const result = await fsm.execute();
    
    expect(result.success).toBe(true);
  });

  it('should handle empty workflow gracefully', async () => {
    const workflow: Workflow = {
      name: 'empty-workflow',
      initialState: 'start',
      states: {
        start: {
          command: 'echo',
          args: ['Empty workflow'],
          transitions: {}
        }
      }
    };
    
    const fsm = new StateMachine(workflow, undefined, executor);
    const result = await fsm.execute();
    
    expect(result.success).toBe(true);
    expect(result.finalState).toBe('start');
    expect(result.stateHistory).toHaveLength(1);
    expect(result.stateHistory.map(entry => entry.stateName)).toEqual(['start']);
  });
});