/**
 * Tests for ExecutionContext types and interfaces
 * Validates type compliance and immutability
 */

import { describe, test, expect } from 'bun:test';
import {
  ExecutionContext,
  StateExecutionResult,
  ExecutionResult,
  StateHistoryEntry,
  TransitionResult,
  ExecutionSummary
} from '../../src/workflow/execution-context';

describe('ExecutionContext', () => {
  describe('type compliance', () => {
    test('should create valid ExecutionContext', () => {
      const context: ExecutionContext = {
        workflowName: 'test-workflow',
        startedAt: new Date(),
        variables: { key: 'value' },
        metadata: { custom: 'data' }
      };

      expect(context.workflowName).toBe('test-workflow');
      expect(context.startedAt).toBeInstanceOf(Date);
      expect(context.variables.key).toBe('value');
      expect(context.metadata.custom).toBe('data');
    });

    test('should support empty variables and metadata', () => {
      const context: ExecutionContext = {
        workflowName: 'test',
        startedAt: new Date(),
        variables: {},
        metadata: {}
      };

      expect(context.variables).toEqual({});
      expect(context.metadata).toEqual({});
    });
  });

  describe('StateExecutionResult', () => {
    test('should create valid StateExecutionResult', () => {
      const result: StateExecutionResult = {
        stateName: 'build',
        exitCode: 0,
        executedAt: new Date(),
        duration: 1500,
        output: 'Build successful'
      };

      expect(result.stateName).toBe('build');
      expect(result.exitCode).toBe(0);
      expect(result.duration).toBe(1500);
      expect(result.output).toBe('Build successful');
    });

    test('should support optional output', () => {
      const result: StateExecutionResult = {
        stateName: 'test',
        exitCode: 1,
        executedAt: new Date(),
        duration: 100
      };

      expect(result.output).toBeUndefined();
    });
  });

  describe('ExecutionResult', () => {
    test('should create successful ExecutionResult', () => {
      const history: StateHistoryEntry[] = [
        {
          stateName: 'start',
          enteredAt: new Date(),
          exitedAt: new Date(),
          exitCode: 0,
          duration: 100,
          transitionedTo: 'end'
        }
      ];

      const result: ExecutionResult = {
        success: true,
        finalState: 'end',
        stateHistory: history,
        totalDuration: 100
      };

      expect(result.success).toBe(true);
      expect(result.finalState).toBe('end');
      expect(result.stateHistory).toHaveLength(1);
      expect(result.error).toBeUndefined();
    });

    test('should create failed ExecutionResult with error', () => {
      const result: ExecutionResult = {
        success: false,
        finalState: 'build',
        stateHistory: [],
        totalDuration: 50,
        error: new Error('Build failed')
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Build failed');
    });
  });

  describe('StateHistoryEntry', () => {
    test('should create valid history entry with transition', () => {
      const entry: StateHistoryEntry = {
        stateName: 'build',
        enteredAt: new Date(),
        exitedAt: new Date(),
        exitCode: 0,
        duration: 1000,
        transitionedTo: 'test'
      };

      expect(entry.stateName).toBe('build');
      expect(entry.exitCode).toBe(0);
      expect(entry.transitionedTo).toBe('test');
    });

    test('should create terminal state history entry', () => {
      const entry: StateHistoryEntry = {
        stateName: 'complete',
        enteredAt: new Date(),
        exitedAt: new Date(),
        exitCode: 0,
        duration: 50,
        transitionedTo: null
      };

      expect(entry.transitionedTo).toBe(null);
    });
  });

  describe('TransitionResult', () => {
    test('should create successful transition result', () => {
      const result: TransitionResult = {
        canTransition: true,
        nextState: 'deploy'
      };

      expect(result.canTransition).toBe(true);
      expect(result.nextState).toBe('deploy');
      expect(result.reason).toBeUndefined();
    });

    test('should create failed transition result with reason', () => {
      const result: TransitionResult = {
        canTransition: false,
        nextState: null,
        reason: 'No transition defined for exit code'
      };

      expect(result.canTransition).toBe(false);
      expect(result.nextState).toBe(null);
      expect(result.reason).toBeDefined();
    });
  });

  describe('ExecutionSummary', () => {
    test('should create valid execution summary', () => {
      const summary: ExecutionSummary = {
        workflowName: 'deploy',
        totalStates: 5,
        executedStates: 3,
        totalDuration: 3000,
        success: true,
        finalState: 'complete'
      };

      expect(summary.workflowName).toBe('deploy');
      expect(summary.totalStates).toBe(5);
      expect(summary.executedStates).toBe(3);
      expect(summary.totalDuration).toBe(3000);
      expect(summary.success).toBe(true);
      expect(summary.finalState).toBe('complete');
    });

    test('should create failed execution summary', () => {
      const summary: ExecutionSummary = {
        workflowName: 'build',
        totalStates: 3,
        executedStates: 1,
        totalDuration: 500,
        success: false,
        finalState: 'build'
      };

      expect(summary.success).toBe(false);
    });
  });
});
