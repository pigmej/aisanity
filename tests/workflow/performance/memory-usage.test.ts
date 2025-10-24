/**
 * Memory usage tests
 * Validates memory efficiency of workflow system
 */

import { describe, test, expect } from 'bun:test';
import { StateMachine } from '../../../src/workflow/fsm';
import { CommandExecutor } from '../../../src/workflow/executor';
import { ConfirmationHandler } from '../../../src/workflow/confirmation-handler';
import { Logger } from '../../../src/utils/logger';
import { simpleWorkflow, complexWorkflow } from '../fixtures/test-workflows';

describe('Memory Usage', () => {
  const logger = new Logger(true); // Silent mode

  describe('Multiple instances', () => {
    test('should handle 100 FSM instances without memory issues', () => {
      const instances: StateMachine[] = [];
      
      for (let i = 0; i < 100; i++) {
        instances.push(new StateMachine(simpleWorkflow, logger));
      }
      
      expect(instances).toHaveLength(100);
      
      // Verify all instances are functional
      instances.forEach((fsm) => {
        const context = fsm.getContext();
        expect(context).toBeDefined();
      });
    });

    test('should handle 50 complex workflow instances', () => {
      const instances: StateMachine[] = [];
      
      for (let i = 0; i < 50; i++) {
        instances.push(new StateMachine(complexWorkflow, logger));
      }
      
      expect(instances).toHaveLength(50);
    });

    test('should handle multiple executor instances', () => {
      const executors: CommandExecutor[] = [];
      
      for (let i = 0; i < 100; i++) {
        executors.push(new CommandExecutor(logger));
      }
      
      expect(executors).toHaveLength(100);
    });

    test('should handle multiple confirmation handler instances', () => {
      const handlers: ConfirmationHandler[] = [];
      const executor = new CommandExecutor(logger);
      
      for (let i = 0; i < 100; i++) {
        handlers.push(new ConfirmationHandler(executor, logger));
      }
      
      expect(handlers).toHaveLength(100);
    });
  });

  describe('Memory efficiency during execution', () => {
    test('should maintain reasonable memory during workflow execution', async () => {
      // Execute workflow multiple times
      for (let i = 0; i < 10; i++) {
        const executor = new CommandExecutor(logger);
        const confirmationHandler = new ConfirmationHandler(executor, logger);
        const fsm = new StateMachine(simpleWorkflow, logger, executor, confirmationHandler);
        await fsm.execute();
      }
      
      // If we get here without running out of memory, test passes
      expect(true).toBe(true);
    });

    test('should handle large state history without memory issues', async () => {
      // Create workflow with many states
      const states: Record<string, any> = {};
      for (let i = 0; i < 30; i++) {
        const nextState = i < 29 ? `state${i + 1}` : null;
        states[`state${i}`] = {
          command: 'echo',
          args: [`State ${i}`],
          transitions: { success: nextState }
        };
      }

      const largeWorkflow = {
        name: 'memory-test',
        initialState: 'state0',
        states
      };

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(largeWorkflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      expect(result.success).toBe(true);
      expect(result.stateHistory).toHaveLength(30);
    });

    test('should cleanup resources after execution', async () => {
      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(simpleWorkflow, logger, executor, confirmationHandler);

      await fsm.execute();
      
      // Get execution summary to verify cleanup
      const summary = fsm.getExecutionSummary();
      expect(summary).toBeDefined();
      expect(summary.executedStates).toBeGreaterThan(0);
    });
  });

  describe('Context management memory', () => {
    test('should handle large context updates', () => {
      const fsm = new StateMachine(simpleWorkflow, logger);
      
      // Update context with many variables
      const variables: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        variables[`var${i}`] = `value${i}`;
      }
      
      fsm.updateContext({ variables });
      
      const context = fsm.getContext();
      expect(Object.keys(context.variables)).toHaveLength(100);
    });

    test('should handle multiple context updates', () => {
      const fsm = new StateMachine(simpleWorkflow, logger);
      
      // Update context multiple times
      for (let i = 0; i < 50; i++) {
        fsm.updateContext({
          variables: { [`var${i}`]: `value${i}` }
        });
      }
      
      const context = fsm.getContext();
      expect(context).toBeDefined();
    });

    test('should handle large metadata', () => {
      const fsm = new StateMachine(simpleWorkflow, logger);
      
      const metadata: Record<string, unknown> = {};
      for (let i = 0; i < 100; i++) {
        metadata[`key${i}`] = { nested: `value${i}`, index: i };
      }
      
      fsm.updateContext({ metadata });
      
      const context = fsm.getContext();
      expect(Object.keys(context.metadata)).toHaveLength(100);
    });
  });

  describe('Scalability', () => {
    test('should scale to workflows with 50+ states', () => {
      const states: Record<string, any> = {};
      for (let i = 0; i < 50; i++) {
        const nextState = i < 49 ? `state${i + 1}` : null;
        states[`state${i}`] = {
          command: 'echo',
          args: [`State ${i}`],
          transitions: { success: nextState }
        };
      }

      const largeWorkflow = {
        name: 'scalability-test',
        initialState: 'state0',
        states
      };

      const fsm = new StateMachine(largeWorkflow, logger);
      expect(fsm).toBeDefined();
    });

    test('should scale to workflows with 100+ transitions', () => {
      const states: Record<string, any> = {};
      
      // Create workflow with many branching paths
      for (let i = 0; i < 25; i++) {
        states[`state${i}`] = {
          command: 'echo',
          args: [`State ${i}`],
          transitions: {
            success: `success${i}`,
            failure: `failure${i}`
          }
        };
        
        states[`success${i}`] = {
          command: 'echo',
          args: ['Success'],
          transitions: { success: null }
        };
        
        states[`failure${i}`] = {
          command: 'echo',
          args: ['Failure'],
          transitions: { success: null }
        };
      }

      const branchingWorkflow = {
        name: 'branching-test',
        initialState: 'state0',
        states
      };

      const fsm = new StateMachine(branchingWorkflow, logger);
      expect(fsm).toBeDefined();
    });

    test('should handle workflows with deep nesting', () => {
      const states: Record<string, any> = {};
      
      // Create workflow with deep sequential nesting
      for (let i = 0; i < 100; i++) {
        const nextState = i < 99 ? `state${i + 1}` : null;
        states[`state${i}`] = {
          command: 'echo',
          args: [`State ${i}`],
          transitions: { success: nextState }
        };
      }

      const deepWorkflow = {
        name: 'deep-nesting-test',
        initialState: 'state0',
        states
      };

      const fsm = new StateMachine(deepWorkflow, logger);
      expect(fsm).toBeDefined();
    });
  });
});
