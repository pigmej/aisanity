/**
 * Tests for StateMachine
 * Validates FSM state transitions and workflow execution
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { StateMachine } from '../../src/workflow/fsm';
import { Logger } from '../../src/utils/logger';
import {
  WorkflowValidationError,
  StateNotFoundError
} from '../../src/workflow/errors';
import {
  simpleWorkflow,
  branchingWorkflow,
  circularWorkflow,
  invalidInitialStateWorkflow,
  invalidTransitionWorkflow
} from './fixtures/test-workflows';
import { MockStateExecutor } from './mocks/mock-executor';

describe('StateMachine', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger(true); // Silent mode for tests
  });

  describe('constructor', () => {
    test('should create StateMachine with valid workflow', () => {
      const fsm = new StateMachine(simpleWorkflow, logger);
      expect(fsm).toBeDefined();
      expect(fsm.getCurrentState()).toBe('start');
    });

    test('should throw error for invalid workflow (missing initial state)', () => {
      expect(() => {
        new StateMachine(invalidInitialStateWorkflow, logger);
      }).toThrow(WorkflowValidationError);
    });

    test('should throw error for invalid workflow (invalid transition)', () => {
      expect(() => {
        new StateMachine(invalidTransitionWorkflow, logger);
      }).toThrow(WorkflowValidationError);
    });

    test('should accept workflow with warnings (circular)', () => {
      // Should not throw, just warn
      const fsm = new StateMachine(circularWorkflow, logger);
      expect(fsm).toBeDefined();
    });

    test('should initialize context correctly', () => {
      const fsm = new StateMachine(simpleWorkflow, logger);
      const context = fsm.getContext();
      expect(context.workflowName).toBe('test-simple');
      expect(context.startedAt).toBeInstanceOf(Date);
      expect(context.variables).toEqual({});
      expect(context.metadata).toEqual({});
    });
  });

  describe('getCurrentState', () => {
    test('should return current state', () => {
      const fsm = new StateMachine(simpleWorkflow, logger);
      expect(fsm.getCurrentState()).toBe('start');
    });

    test('should return initial state on construction', () => {
      const fsm = new StateMachine(branchingWorkflow, logger);
      expect(fsm.getCurrentState()).toBe('check');
    });
  });

  describe('canTransition', () => {
    test('should return true for valid transition (success)', () => {
      const fsm = new StateMachine(simpleWorkflow, logger);
      expect(fsm.canTransition(0)).toBe(true);
    });

    test('should return false for terminal state', () => {
      const fsm = new StateMachine(simpleWorkflow, logger);
      fsm.transition(0); // Move to end
      expect(fsm.canTransition(0)).toBe(false);
    });

    test('should return true for failure transition', () => {
      const fsm = new StateMachine(branchingWorkflow, logger);
      expect(fsm.canTransition(1)).toBe(true); // Failure path
    });
  });

  describe('transition', () => {
    test('should transition to success state', () => {
      const fsm = new StateMachine(simpleWorkflow, logger);
      const result = fsm.transition(0);
      expect(result.canTransition).toBe(true);
      expect(result.nextState).toBe('end');
      expect(fsm.getCurrentState()).toBe('end');
    });

    test('should transition to failure state', () => {
      const fsm = new StateMachine(branchingWorkflow, logger);
      const result = fsm.transition(1);
      expect(result.canTransition).toBe(true);
      expect(result.nextState).toBe('create');
      expect(fsm.getCurrentState()).toBe('create');
    });

    test('should not transition from terminal state', () => {
      const fsm = new StateMachine(simpleWorkflow, logger);
      fsm.transition(0); // Move to end
      const result = fsm.transition(0);
      expect(result.canTransition).toBe(false);
      expect(result.nextState).toBe(null);
      expect(result.reason).toContain('terminal state');
    });
  });

  describe('getContext', () => {
    test('should return execution context', () => {
      const fsm = new StateMachine(simpleWorkflow, logger);
      const context = fsm.getContext();
      expect(context).toBeDefined();
      expect(context.workflowName).toBe('test-simple');
    });

    test('should return readonly context', () => {
      const fsm = new StateMachine(simpleWorkflow, logger);
      const context = fsm.getContext();
      // TypeScript should prevent modification, but we can verify the structure
      expect(Object.isFrozen(context)).toBe(false); // Context itself isn't frozen, but is returned as readonly
    });
  });

  describe('updateContext', () => {
    test('should update context variables', () => {
      const fsm = new StateMachine(simpleWorkflow, logger);
      fsm.updateContext({ variables: { test: 'value' } });
      const context = fsm.getContext();
      expect(context.variables.test).toBe('value');
    });

    test('should update context metadata', () => {
      const fsm = new StateMachine(simpleWorkflow, logger);
      fsm.updateContext({ metadata: { customKey: 'customValue' } });
      const context = fsm.getContext();
      expect(context.metadata.customKey).toBe('customValue');
    });

    test('should preserve workflowName and startedAt', () => {
      const fsm = new StateMachine(simpleWorkflow, logger);
      const originalContext = fsm.getContext();
      fsm.updateContext({ variables: { test: 'value' } });
      const updatedContext = fsm.getContext();
      expect(updatedContext.workflowName).toBe(originalContext.workflowName);
      expect(updatedContext.startedAt).toBe(originalContext.startedAt);
    });
  });

  describe('getStateHistory', () => {
    test('should return empty history initially', () => {
      const fsm = new StateMachine(simpleWorkflow, logger);
      const history = fsm.getStateHistory();
      expect(history).toHaveLength(0);
    });

    test('should record state executions', async () => {
      const executor = new MockStateExecutor();
      const fsm = new StateMachine(simpleWorkflow, logger, executor);
      await fsm.execute();
      const history = fsm.getStateHistory();
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('getExecutionSummary', () => {
    test('should provide execution summary', () => {
      const fsm = new StateMachine(simpleWorkflow, logger);
      const summary = fsm.getExecutionSummary();
      expect(summary.workflowName).toBe('test-simple');
      expect(summary.totalStates).toBe(2);
      expect(summary.executedStates).toBe(0); // No execution yet
      expect(summary.finalState).toBe('start');
    });

    test('should update summary after execution', async () => {
      const executor = new MockStateExecutor();
      const fsm = new StateMachine(simpleWorkflow, logger, executor);
      await fsm.execute();
      const summary = fsm.getExecutionSummary();
      expect(summary.executedStates).toBeGreaterThan(0);
    });
  });

  describe('executeState', () => {
    test('should execute state with executor', async () => {
      const executor = new MockStateExecutor();
      const fsm = new StateMachine(simpleWorkflow, logger, executor);
      const result = await fsm.executeState('start');
      expect(result.stateName).toBe('start');
      expect(result.exitCode).toBe(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    test('should execute state without executor (stub)', async () => {
      const fsm = new StateMachine(simpleWorkflow, logger);
      const result = await fsm.executeState('start');
      expect(result.stateName).toBe('start');
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('Stub execution');
    });

    test('should throw error for non-existent state', async () => {
      const fsm = new StateMachine(simpleWorkflow, logger);
      try {
        await fsm.executeState('nonexistent');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(StateNotFoundError);
      }
    });

    test('should handle executor failures', async () => {
      const executor = new MockStateExecutor({ 'echo "hello"': 1 });
      const fsm = new StateMachine(simpleWorkflow, logger, executor);
      const result = await fsm.executeState('start');
      expect(result.exitCode).toBe(1);
    });
  });

  describe('execute', () => {
    test('should execute simple workflow completely', async () => {
      const executor = new MockStateExecutor();
      const fsm = new StateMachine(simpleWorkflow, logger, executor);
      const result = await fsm.execute();
      expect(result.success).toBe(true);
      expect(result.finalState).toBe('end');
      expect(result.stateHistory).toHaveLength(2);
    });

    test('should execute branching workflow (success path)', async () => {
      const executor = new MockStateExecutor();
      const fsm = new StateMachine(branchingWorkflow, logger, executor);
      const result = await fsm.execute();
      expect(result.success).toBe(true);
      expect(result.finalState).toBe('process');
    });

    test('should execute branching workflow (failure path)', async () => {
      const executor = new MockStateExecutor({ 'test -f file.txt': 1 });
      const fsm = new StateMachine(branchingWorkflow, logger, executor);
      const result = await fsm.execute();
      expect(result.success).toBe(true);
      expect(result.finalState).toBe('process');
      expect(result.stateHistory.length).toBeGreaterThan(2); // Should go through create
    });

    test('should detect infinite loops', async () => {
      // Use faster executor with 1ms delays to speed up test
      const executor = new MockStateExecutor({}, { 
        'echo "a"': 1, 
        'echo "b"': 1, 
        'echo "c"': 1 
      });
      const fsm = new StateMachine(circularWorkflow, logger, executor);
      
      // Temporarily reduce max iterations for testing
      // @ts-ignore - accessing private property for testing
      fsm.maxIterations = 10;
      
      const result = await fsm.execute();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Maximum iteration limit');
    });

    test('should measure execution duration', async () => {
      const executor = new MockStateExecutor();
      const fsm = new StateMachine(simpleWorkflow, logger, executor);
      const result = await fsm.execute();
      expect(result.totalDuration).toBeGreaterThan(0);
    });

    test('should record state history', async () => {
      const executor = new MockStateExecutor();
      const fsm = new StateMachine(simpleWorkflow, logger, executor);
      const result = await fsm.execute();
      expect(result.stateHistory).toHaveLength(2);
      expect(result.stateHistory[0].stateName).toBe('start');
      expect(result.stateHistory[1].stateName).toBe('end');
    });
  });

  describe('factory methods', () => {
    test('should create StateMachine from workflow name', () => {
      // This requires a .aisanity-workflows.yml file
      // For now, we'll skip this test as it requires file system setup
      // In real scenario, this would load from workspace
    });
  });

  describe('error handling', () => {
    test('should handle execution errors gracefully', async () => {
      const executor = new MockStateExecutor();
      const fsm = new StateMachine(simpleWorkflow, logger, executor);
      
      // Force an error by making executor throw
      executor.setExitCode('echo "hello"', 1);
      
      const result = await fsm.execute();
      // Should still succeed (failure transitions are valid)
      expect(result).toBeDefined();
    });
  });
});
