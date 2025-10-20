/**
 * Tests for StateTransitionValidator
 * Validates workflow structure and state transitions
 */

import { describe, test, expect } from 'bun:test';
import { StateTransitionValidator } from '../../src/workflow/state-validator';
import {
  simpleWorkflow,
  branchingWorkflow,
  circularWorkflow,
  unreachableStateWorkflow,
  invalidInitialStateWorkflow,
  invalidTransitionWorkflow,
  complexWorkflow
} from './fixtures/test-workflows';

describe('StateTransitionValidator', () => {
  describe('validateWorkflow', () => {
    test('should validate simple workflow successfully', () => {
      const result = StateTransitionValidator.validateWorkflow(simpleWorkflow);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate branching workflow successfully', () => {
      const result = StateTransitionValidator.validateWorkflow(branchingWorkflow);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should warn about circular workflow', () => {
      const result = StateTransitionValidator.validateWorkflow(circularWorkflow);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('Circular'))).toBe(true);
    });

    test('should warn about unreachable states', () => {
      const result = StateTransitionValidator.validateWorkflow(unreachableStateWorkflow);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('Unreachable'))).toBe(true);
      expect(result.warnings.some(w => w.includes('unreachable'))).toBe(true);
    });

    test('should fail validation for invalid initial state', () => {
      const result = StateTransitionValidator.validateWorkflow(invalidInitialStateWorkflow);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Initial state'))).toBe(true);
    });

    test('should fail validation for invalid transition target', () => {
      const result = StateTransitionValidator.validateWorkflow(invalidTransitionWorkflow);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('non-existent state'))).toBe(true);
    });

    test('should validate complex workflow successfully', () => {
      const result = StateTransitionValidator.validateWorkflow(complexWorkflow);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateTransition', () => {
    test('should validate valid transition', () => {
      const result = StateTransitionValidator.validateTransition(
        'start',
        'end',
        simpleWorkflow
      );
      expect(result).toBe(true);
    });

    test('should reject transition from non-existent state', () => {
      const result = StateTransitionValidator.validateTransition(
        'nonexistent',
        'end',
        simpleWorkflow
      );
      expect(result).toBe(false);
    });

    test('should reject transition to non-existent state', () => {
      const result = StateTransitionValidator.validateTransition(
        'start',
        'nonexistent',
        simpleWorkflow
      );
      expect(result).toBe(false);
    });

    test('should reject undefined transition', () => {
      const result = StateTransitionValidator.validateTransition(
        'end',
        'start',
        simpleWorkflow
      );
      expect(result).toBe(false);
    });
  });

  describe('detectCircularTransitions', () => {
    test('should not detect cycles in linear workflow', () => {
      const result = StateTransitionValidator.detectCircularTransitions(simpleWorkflow);
      expect(result.hasCircularity).toBe(false);
      expect(result.cycles).toHaveLength(0);
    });

    test('should detect cycles in circular workflow', () => {
      const result = StateTransitionValidator.detectCircularTransitions(circularWorkflow);
      expect(result.hasCircularity).toBe(true);
      expect(result.cycles.length).toBeGreaterThan(0);
    });

    test('should not detect cycles in branching workflow', () => {
      const result = StateTransitionValidator.detectCircularTransitions(branchingWorkflow);
      expect(result.hasCircularity).toBe(false);
      expect(result.cycles).toHaveLength(0);
    });
  });

  describe('findTerminalStates', () => {
    test('should find terminal state in simple workflow', () => {
      const result = StateTransitionValidator.findTerminalStates(simpleWorkflow);
      expect(result).toContain('end');
      expect(result).toHaveLength(1);
    });

    test('should find terminal state in branching workflow', () => {
      const result = StateTransitionValidator.findTerminalStates(branchingWorkflow);
      expect(result).toContain('process');
      expect(result).toHaveLength(1);
    });

    test('should not find terminal states in circular workflow', () => {
      const result = StateTransitionValidator.findTerminalStates(circularWorkflow);
      expect(result).toHaveLength(0);
    });

    test('should find multiple terminal states in complex workflow', () => {
      const result = StateTransitionValidator.findTerminalStates(complexWorkflow);
      expect(result).toContain('error');
      expect(result).toContain('complete');
      expect(result.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('validateTransitionTargets', () => {
    test('should validate all transition targets exist', () => {
      const result = StateTransitionValidator.validateTransitionTargets(simpleWorkflow);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid transition targets', () => {
      const result = StateTransitionValidator.validateTransitionTargets(invalidTransitionWorkflow);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('nonexistent'))).toBe(true);
    });
  });

  describe('findUnreachableStates', () => {
    test('should find no unreachable states in simple workflow', () => {
      const result = StateTransitionValidator.findUnreachableStates(simpleWorkflow);
      expect(result).toHaveLength(0);
    });

    test('should find unreachable state', () => {
      const result = StateTransitionValidator.findUnreachableStates(unreachableStateWorkflow);
      expect(result).toContain('unreachable');
      expect(result).toHaveLength(1);
    });

    test('should find no unreachable states in complex workflow', () => {
      const result = StateTransitionValidator.findUnreachableStates(complexWorkflow);
      expect(result).toHaveLength(0);
    });
  });

  describe('validateInitialState', () => {
    test('should validate existing initial state', () => {
      const result = StateTransitionValidator.validateInitialState(simpleWorkflow);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should fail for non-existent initial state', () => {
      const result = StateTransitionValidator.validateInitialState(invalidInitialStateWorkflow);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Initial state'))).toBe(true);
    });
  });
});
