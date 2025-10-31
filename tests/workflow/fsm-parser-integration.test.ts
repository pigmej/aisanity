/**
 * Integration tests for FSM with WorkflowParser
 * Validates end-to-end workflow loading and execution
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import * as path from 'path';
import { StateMachine } from '../../src/workflow/fsm';
import { WorkflowParser } from '../../src/workflow/parser';
import { Logger } from '../../src/utils/logger';
import { MockStateExecutor } from './mocks/mock-executor';

describe('FSM Parser Integration', () => {
  let logger: Logger;
  let parser: WorkflowParser;
  const fixturesPath = path.join(__dirname, 'fixtures');

  beforeEach(() => {
    logger = new Logger(true); // Silent mode
    parser = new WorkflowParser(logger);
  });

  describe('loading workflows from YAML', () => {
    test('should load and execute simple workflow', async () => {
      const workflow = parser.getWorkflow('simple', fixturesPath);
      expect(workflow).toBeDefined();
      expect(workflow.name).toBe('Simple Workflow');
      expect(workflow.initialState).toBe('start');

      const executor = new MockStateExecutor();
      const fsm = new StateMachine(workflow, logger, executor);
      const result = await fsm.execute();

      expect(result.success).toBe(true);
      expect(result.finalState).toBe('end');
    });

    test('should load and validate deploy workflow', async () => {
      const workflow = parser.getWorkflow('deploy', fixturesPath);
      expect(workflow).toBeDefined();
      expect(workflow.name).toBe('Deploy Application');
      expect(workflow.initialState).toBe('build');

      const executor = new MockStateExecutor();
      const fsm = new StateMachine(workflow, logger, executor);

      // Validate workflow structure
      expect(fsm.getCurrentState()).toBe('build');
    });

    test('should execute deploy workflow (success path)', async () => {
      const workflow = parser.getWorkflow('deploy', fixturesPath);
      const executor = new MockStateExecutor();
      const fsm = new StateMachine(workflow, logger, executor);

      const result = await fsm.execute();
      expect(result.success).toBe(true);
      expect(result.finalState).toBe('complete');
      expect(result.stateHistory.length).toBeGreaterThan(0);
    });

    test('should execute deploy workflow (failure path)', async () => {
      const workflow = parser.getWorkflow('deploy', fixturesPath);
      
      // Simulate build failure only, let cleanup succeed
      const executor = new MockStateExecutor({ 'npm run build': 1, 'npm run clean': 0 });
      const fsm = new StateMachine(workflow, logger, executor);

      const result = await fsm.execute();
      expect(result.success).toBe(true);
      expect(result.finalState).toBe('complete');
      
      // Should go through cleanup instead of test
      const buildState = result.stateHistory.find(h => h.stateName === 'build');
      expect(buildState).toBeDefined();
      expect(buildState?.transitionedTo).toBe('cleanup');
    });
  });

  describe('factory method integration', () => {
    test('should create FSM from workflow name', () => {
      const fsm = StateMachine.fromWorkflowName('simple', fixturesPath, logger);
      expect(fsm).toBeDefined();
      expect(fsm.getCurrentState()).toBe('start');
    });

    test('should throw error for non-existent workflow', () => {
      expect(() => {
        StateMachine.fromWorkflowName('nonexistent', fixturesPath, logger);
      }).toThrow();
    });
  });

  describe('error propagation', () => {
    test('should propagate parser errors to FSM', () => {
      const invalidPath = path.join(__dirname, 'nonexistent');
      
      expect(() => {
        StateMachine.fromWorkflowName('any', invalidPath, logger);
      }).toThrow();
    });
  });

  describe('state history tracking', () => {
    test('should track complete execution history', async () => {
      const workflow = parser.getWorkflow('simple', fixturesPath);
      const executor = new MockStateExecutor();
      const fsm = new StateMachine(workflow, logger, executor);

      const result = await fsm.execute();
      
      expect(result.stateHistory).toHaveLength(2);
      
      // Verify first state
      const firstState = result.stateHistory[0];
      expect(firstState.stateName).toBe('start');
      expect(firstState.exitCode).toBe(0);
      expect(firstState.transitionedTo).toBe('end');
      
      // Verify second state
      const secondState = result.stateHistory[1];
      expect(secondState.stateName).toBe('end');
      expect(secondState.exitCode).toBe(0);
      expect(secondState.transitionedTo).toBe(null); // Terminal state
    });

    test('should track timing information', async () => {
      const workflow = parser.getWorkflow('simple', fixturesPath);
      const executor = new MockStateExecutor({}, { 'echo "Starting"': 50, 'echo "Finished"': 30 });
      const fsm = new StateMachine(workflow, logger, executor);

      const result = await fsm.execute();
      
      expect(result.totalDuration).toBeGreaterThan(0);
      
      for (const entry of result.stateHistory) {
        expect(entry.duration).toBeGreaterThan(0);
        expect(entry.enteredAt).toBeInstanceOf(Date);
        expect(entry.exitedAt).toBeInstanceOf(Date);
      }
    });
  });

  describe('context management', () => {
    test('should maintain context throughout execution', async () => {
      const workflow = parser.getWorkflow('simple', fixturesPath);
      const executor = new MockStateExecutor();
      const fsm = new StateMachine(workflow, logger, executor);

      const contextBefore = fsm.getContext();
      await fsm.execute();
      const contextAfter = fsm.getContext();

      expect(contextAfter.workflowName).toBe(contextBefore.workflowName);
      expect(contextAfter.startedAt).toBe(contextBefore.startedAt);
    });

    test('should allow context updates during execution', async () => {
      const workflow = parser.getWorkflow('simple', fixturesPath);
      const executor = new MockStateExecutor();
      const fsm = new StateMachine(workflow, logger, executor);

      fsm.updateContext({ variables: { testVar: 'value' } });
      await fsm.execute();

      const context = fsm.getContext();
      expect(context.variables.testVar).toBe('value');
    });
  });
});
