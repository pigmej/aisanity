/**
 * Tests for SchemaValidator class and type guards
 * Covers validation rules for each schema level
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { SchemaValidator } from '../../src/workflow/validator';
import {
  isWorkflowDefinitions,
  isWorkflow,
  isState,
  isStateTransitions,
  isConfirmationConfig,
  isWorkflowMetadata
} from '../../src/workflow/validator';

describe('Type Guards', () => {
  describe('isWorkflowMetadata', () => {
    it('should return true for valid metadata', () => {
      const metadata = {
        version: '1.0.0',
        created: '2025-01-20',
        modified: '2025-01-20'
      };
      
      expect(isWorkflowMetadata(metadata)).toBe(true);
    });

    it('should return true for empty metadata', () => {
      expect(isWorkflowMetadata({})).toBe(true);
    });

    it('should return false for invalid version', () => {
      const metadata = { version: 123 };
      expect(isWorkflowMetadata(metadata)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isWorkflowMetadata(null)).toBe(false);
      expect(isWorkflowMetadata('string')).toBe(false);
    });
  });

  describe('isConfirmationConfig', () => {
    it('should return true for valid confirmation config', () => {
      const config = {
        message: 'Continue?',
        timeout: 30,
        defaultAccept: true
      };
      
      expect(isConfirmationConfig(config)).toBe(true);
    });

    it('should return true for minimal config', () => {
      expect(isConfirmationConfig({})).toBe(true);
    });

    it('should return false for invalid timeout', () => {
      const config = { timeout: -10 };
      expect(isConfirmationConfig(config)).toBe(false);
    });

    it('should return false for invalid defaultAccept', () => {
      const config = { defaultAccept: 'true' };
      expect(isConfirmationConfig(config)).toBe(false);
    });
  });

  describe('isStateTransitions', () => {
    it('should return true for valid transitions', () => {
      const transitions = {
        success: 'next-state',
        failure: 'cleanup',
        timeout: 'retry'
      };
      
      expect(isStateTransitions(transitions)).toBe(true);
    });

    it('should return true for empty transitions', () => {
      expect(isStateTransitions({})).toBe(true);
    });

    it('should return false for non-string transition', () => {
      const transitions = { success: 123 };
      expect(isStateTransitions(transitions)).toBe(false);
    });
  });

  describe('isState', () => {
    it('should return true for valid state', () => {
      const state = {
        description: 'Test state',
        command: 'echo test',
        args: ['--verbose'],
        timeout: 60,
        confirmation: {
          message: 'Continue?',
          timeout: 30
        },
        transitions: {
          success: 'next',
          failure: 'cleanup'
        }
      };
      
      expect(isState(state)).toBe(true);
    });

    it('should return true for minimal state', () => {
      const state = {
        command: 'echo test',
        transitions: {}
      };
      
      expect(isState(state)).toBe(true);
    });

    it('should return false for missing command', () => {
      const state = { transitions: {} };
      expect(isState(state)).toBe(false);
    });

    it('should return false for empty command', () => {
      const state = {
        command: '',
        transitions: {}
      };
      expect(isState(state)).toBe(false);
    });

    it('should return false for invalid args', () => {
      const state = {
        command: 'echo test',
        args: 'not-array',
        transitions: {}
      };
      expect(isState(state)).toBe(false);
    });

    it('should return false for invalid timeout', () => {
      const state = {
        command: 'echo test',
        timeout: -10,
        transitions: {}
      };
      expect(isState(state)).toBe(false);
    });
  });

  describe('isWorkflow', () => {
    it('should return true for valid workflow', () => {
      const workflow = {
        name: 'Test Workflow',
        description: 'A test workflow',
        initialState: 'start',
        globalTimeout: 1800,
        states: {
          start: {
            command: 'echo start',
            transitions: {}
          }
        }
      };
      
      expect(isWorkflow(workflow)).toBe(true);
    });

    it('should return false for missing name', () => {
      const workflow = {
        initialState: 'start',
        states: {}
      };
      expect(isWorkflow(workflow)).toBe(false);
    });

    it('should return false for empty name', () => {
      const workflow = {
        name: '',
        initialState: 'start',
        states: {}
      };
      expect(isWorkflow(workflow)).toBe(false);
    });

    it('should return false for missing initialState', () => {
      const workflow = {
        name: 'Test',
        states: {}
      };
      expect(isWorkflow(workflow)).toBe(false);
    });

    it('should return false for missing states', () => {
      const workflow = {
        name: 'Test',
        initialState: 'start'
      };
      expect(isWorkflow(workflow)).toBe(false);
    });

    it('should return false for invalid globalTimeout', () => {
      const workflow = {
        name: 'Test',
        initialState: 'start',
        globalTimeout: -100,
        states: {
          start: {
            command: 'echo test',
            transitions: {}
          }
        }
      };
      expect(isWorkflow(workflow)).toBe(false);
    });
  });

  describe('isWorkflowDefinitions', () => {
    it('should return true for valid definitions', () => {
      const definitions = {
        workflows: {
          test: {
            name: 'Test Workflow',
            initialState: 'start',
            states: {
              start: {
                command: 'echo test',
                transitions: {}
              }
            }
          }
        },
        metadata: {
          version: '1.0.0'
        }
      };
      
      expect(isWorkflowDefinitions(definitions)).toBe(true);
    });

    it('should return true for definitions without metadata', () => {
      const definitions = {
        workflows: {
          test: {
            name: 'Test Workflow',
            initialState: 'start',
            states: {
              start: {
                command: 'echo test',
                transitions: {}
              }
            }
          }
        }
      };
      
      expect(isWorkflowDefinitions(definitions)).toBe(true);
    });

    it('should return false for missing workflows', () => {
      const definitions = {};
      expect(isWorkflowDefinitions(definitions)).toBe(false);
    });

    it('should return false for invalid metadata', () => {
      const definitions = {
        workflows: {},
        metadata: {
          version: 123
        }
      };
      expect(isWorkflowDefinitions(definitions)).toBe(false);
    });
  });
});

describe('SchemaValidator', () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    validator = new SchemaValidator();
  });

  describe('validateWorkflowDefinitions', () => {
    it('should validate valid definitions', () => {
      const definitions = {
        workflows: {
          test: {
            name: 'Test Workflow',
            initialState: 'start',
            states: {
              start: {
                command: 'echo test',
                transitions: {}
              }
            }
          }
        },
        metadata: {}
      };
      
      const result = validator.validateWorkflowDefinitions(definitions);
      expect(result).toEqual(definitions);
    });

    it('should throw error for invalid structure', () => {
      const definitions = { invalid: 'structure' };
      
      expect(() => {
        validator.validateWorkflowDefinitions(definitions);
      }).toThrow('Invalid workflow definitions structure');
    });
  });

  describe('validateWorkflow', () => {
    it('should validate workflow with valid initial state', () => {
      const workflow = {
        name: 'Test Workflow',
        initialState: 'start',
        states: {
          start: {
            command: 'echo test',
            transitions: {}
          }
        }
      };
      
      const result = validator.validateWorkflow(workflow, 'test');
      expect(result).toEqual(workflow);
    });

    it('should throw error for non-existent initial state', () => {
      const workflow = {
        name: 'Test Workflow',
        initialState: 'nonexistent',
        states: {
          start: {
            command: 'echo test',
            transitions: {}
          }
        }
      };
      
      expect(() => {
        validator.validateWorkflow(workflow, 'test');
      }).toThrow("Initial state 'nonexistent' does not exist");
    });
  });

  describe('validateState', () => {
    it('should validate valid state', () => {
      const state = {
        command: 'echo test',
        transitions: {}
      };
      
      const result = validator.validateState(state, 'test', 'workflow');
      expect(result).toEqual(state);
    });

    it('should throw error for empty command', () => {
      const state = {
        command: '   ',
        transitions: {}
      };
      
      expect(() => {
        validator.validateState(state, 'test', 'workflow');
      }).toThrow("Invalid state structure for 'test'");
    });
  });

  describe('validateTransitions', () => {
    it('should validate transitions with valid targets', () => {
      const transitions = {
        success: 'target-state',
        failure: 'cleanup'
      };
      const availableStates = ['target-state', 'cleanup'];
      
      const result = validator.validateTransitions(
        transitions,
        'source-state',
        'workflow',
        availableStates
      );
      expect(result).toEqual(transitions);
    });

    it('should throw error for non-existent target state', () => {
      const transitions = {
        success: 'nonexistent'
      };
      const availableStates = ['target-state'];
      
      expect(() => {
        validator.validateTransitions(
          transitions,
          'source-state',
          'workflow',
          availableStates
        );
      }).toThrow("Transition 'success' from state 'source-state' references non-existent state 'nonexistent'");
    });
  });
});