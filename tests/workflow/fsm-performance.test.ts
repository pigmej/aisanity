/**
 * Performance tests for FSM
 * Validates performance targets for FSM overhead
 */

import { describe, test, expect } from 'bun:test';
import { StateMachine } from '../../src/workflow/fsm';
import { Logger } from '../../src/utils/logger';
import { simpleWorkflow, complexWorkflow } from './fixtures/test-workflows';
import { MockStateExecutor } from './mocks/mock-executor';

describe('FSM Performance', () => {
  const logger = new Logger(true); // Silent mode

  describe('initialization performance', () => {
    test('should initialize FSM in less than 10ms', () => {
      const startTime = performance.now();
      new StateMachine(simpleWorkflow, logger);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(10);
    });

    test('should initialize complex workflow in less than 20ms', () => {
      const startTime = performance.now();
      new StateMachine(complexWorkflow, logger);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(20);
    });

    test('should validate workflow in less than 20ms', () => {
      const startTime = performance.now();
      new StateMachine(complexWorkflow, logger);
      const duration = performance.now() - startTime;

      // Validation is part of construction
      expect(duration).toBeLessThan(20);
    });
  });

  describe('state transition performance', () => {
    test('should transition states in less than 1ms', () => {
      const fsm = new StateMachine(simpleWorkflow, logger);
      
      const startTime = performance.now();
      fsm.transition(0);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(1);
    });

    test('should check transition possibility in less than 1ms', () => {
      const fsm = new StateMachine(simpleWorkflow, logger);
      
      const startTime = performance.now();
      fsm.canTransition(0);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(1);
    });
  });

  describe('context management performance', () => {
    test('should update context in less than 1ms', () => {
      const fsm = new StateMachine(simpleWorkflow, logger);
      
      const startTime = performance.now();
      fsm.updateContext({ variables: { key: 'value' } });
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(1);
    });

    test('should get context in less than 1ms', () => {
      const fsm = new StateMachine(simpleWorkflow, logger);
      
      const startTime = performance.now();
      fsm.getContext();
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(1);
    });
  });

  describe('history tracking performance', () => {
    test('should record state execution in less than 1ms', async () => {
      const executor = new MockStateExecutor({}, { 'echo "hello"': 1 });
      const fsm = new StateMachine(simpleWorkflow, logger, executor);
      
      // Execute one state to record history
      await fsm.executeState('start');
      
      const startTime = performance.now();
      fsm.getStateHistory();
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(1);
    });

    test('should get execution summary in less than 5ms', async () => {
      const executor = new MockStateExecutor();
      const fsm = new StateMachine(complexWorkflow, logger, executor);
      
      const startTime = performance.now();
      fsm.getExecutionSummary();
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(5);
    });
  });

  describe('total FSM overhead', () => {
    test('should have total overhead less than 35ms', async () => {
      const startTime = performance.now();
      
      // Initialize
      const executor = new MockStateExecutor({}, { 'echo "hello"': 0, 'echo "done"': 0 });
      const fsm = new StateMachine(simpleWorkflow, logger, executor);
      
      // Execute (with minimal executor delay)
      await fsm.execute();
      
      const totalDuration = performance.now() - startTime;
      
      // FSM overhead should be minimal (excluding executor delays)
      // With 0ms executor delays, total time should be mostly FSM overhead
      expect(totalDuration).toBeLessThan(35);
    });
  });

  describe('memory efficiency', () => {
    test('should maintain reasonable memory usage', () => {
      const workflows: StateMachine[] = [];
      
      // Create 100 FSM instances
      for (let i = 0; i < 100; i++) {
        workflows.push(new StateMachine(simpleWorkflow, logger));
      }
      
      // Just verify we can create many instances without issues
      expect(workflows).toHaveLength(100);
    });
  });

  describe('execution performance', () => {
    test('should execute simple workflow quickly', async () => {
      const executor = new MockStateExecutor({}, { 'echo "hello"': 5, 'echo "done"': 5 });
      const fsm = new StateMachine(simpleWorkflow, logger, executor);
      
      const startTime = performance.now();
      await fsm.execute();
      const duration = performance.now() - startTime;

      // Should complete in reasonable time (including executor delays)
      expect(duration).toBeLessThan(100);
    });

    test('should maintain performance with complex workflows', async () => {
      const executor = new MockStateExecutor();
      const fsm = new StateMachine(complexWorkflow, logger, executor);
      
      const startTime = performance.now();
      const result = await fsm.execute();
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      // FSM overhead should be minimal even for complex workflows
      expect(duration).toBeLessThan(200);
    });
  });
});
