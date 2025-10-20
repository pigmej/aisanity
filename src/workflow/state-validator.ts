/**
 * State transition validator for workflow structure validation
 * Ensures workflows have valid state graphs and transitions
 */

import { Workflow } from './interfaces';

/**
 * Result of workflow validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Result of circularity detection
 */
export interface CircularityResult {
  hasCircularity: boolean;
  cycles: string[][];
}

/**
 * State transition validator
 * Provides static methods for validating workflow structures
 */
export class StateTransitionValidator {
  /**
   * Validate complete workflow structure
   */
  static validateWorkflow(workflow: Workflow): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate initial state exists
    const initialStateResult = this.validateInitialState(workflow);
    errors.push(...initialStateResult.errors);
    warnings.push(...initialStateResult.warnings);

    // Validate transition targets exist
    const transitionTargetsResult = this.validateTransitionTargets(workflow);
    errors.push(...transitionTargetsResult.errors);
    warnings.push(...transitionTargetsResult.warnings);

    // Check for unreachable states
    const unreachableStates = this.findUnreachableStates(workflow);
    if (unreachableStates.length > 0) {
      warnings.push(
        `Unreachable states found: ${unreachableStates.join(', ')}`
      );
    }

    // Detect circular dependencies
    const circularityResult = this.detectCircularTransitions(workflow);
    if (circularityResult.hasCircularity) {
      warnings.push(
        `Circular transitions detected: ${circularityResult.cycles
          .map(cycle => cycle.join(' → '))
          .join(', ')}`
      );
    }

    // Find terminal states
    const terminalStates = this.findTerminalStates(workflow);
    if (terminalStates.length === 0) {
      warnings.push('No terminal states found - workflow may run indefinitely');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate individual state transition
   */
  static validateTransition(
    fromState: string,
    toState: string,
    workflow: Workflow
  ): boolean {
    // Check if from state exists
    if (!workflow.states[fromState]) {
      return false;
    }

    // Check if to state exists
    if (!workflow.states[toState]) {
      return false;
    }

    // Check if transition is defined
    const state = workflow.states[fromState];
    const transitions = state.transitions;

    return (
      transitions.success === toState ||
      transitions.failure === toState ||
      transitions.timeout === toState
    );
  }

  /**
   * Detect circular transitions in workflow
   */
  static detectCircularTransitions(workflow: Workflow): CircularityResult {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (stateName: string, path: string[]): void => {
      visited.add(stateName);
      recursionStack.add(stateName);
      path.push(stateName);

      const state = workflow.states[stateName];
      if (state) {
        const nextStates = [
          state.transitions.success,
          state.transitions.failure,
          state.transitions.timeout
        ].filter((s): s is string => s !== undefined);

        for (const nextState of nextStates) {
          if (!visited.has(nextState)) {
            dfs(nextState, [...path]);
          } else if (recursionStack.has(nextState)) {
            // Cycle detected
            const cycleStart = path.indexOf(nextState);
            const cycle = [...path.slice(cycleStart), nextState];
            cycles.push(cycle);
          }
        }
      }

      recursionStack.delete(stateName);
    };

    // Start DFS from initial state
    dfs(workflow.initialState, []);

    return {
      hasCircularity: cycles.length > 0,
      cycles
    };
  }

  /**
   * Find terminal states (states with no outgoing transitions)
   */
  static findTerminalStates(workflow: Workflow): string[] {
    const terminalStates: string[] = [];

    for (const [stateName, state] of Object.entries(workflow.states)) {
      const hasTransitions =
        state.transitions.success ||
        state.transitions.failure ||
        state.transitions.timeout;

      if (!hasTransitions) {
        terminalStates.push(stateName);
      }
    }

    return terminalStates;
  }

  /**
   * Validate all transition targets exist
   */
  static validateTransitionTargets(workflow: Workflow): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const [stateName, state] of Object.entries(workflow.states)) {
      const transitions = [
        { type: 'success', target: state.transitions.success },
        { type: 'failure', target: state.transitions.failure },
        { type: 'timeout', target: state.transitions.timeout }
      ];

      for (const transition of transitions) {
        if (transition.target && !workflow.states[transition.target]) {
          errors.push(
            `State '${stateName}' has ${transition.type} transition to non-existent state '${transition.target}'`
          );
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Find unreachable states (states not reachable from initial state)
   */
  static findUnreachableStates(workflow: Workflow): string[] {
    const reachable = new Set<string>();
    const visited = new Set<string>();

    const dfs = (stateName: string): void => {
      if (visited.has(stateName)) {
        return;
      }

      visited.add(stateName);
      reachable.add(stateName);

      const state = workflow.states[stateName];
      if (state) {
        const nextStates = [
          state.transitions.success,
          state.transitions.failure,
          state.transitions.timeout
        ].filter((s): s is string => s !== undefined);

        for (const nextState of nextStates) {
          dfs(nextState);
        }
      }
    };

    // Start DFS from initial state
    dfs(workflow.initialState);

    // Find states not in reachable set
    const allStates = Object.keys(workflow.states);
    return allStates.filter(state => !reachable.has(state));
  }

  /**
   * Validate initial state exists
   */
  static validateInitialState(workflow: Workflow): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!workflow.initialState) {
      errors.push('Workflow must have an initialState');
    } else if (!workflow.states[workflow.initialState]) {
      errors.push(
        `Initial state '${workflow.initialState}' does not exist in workflow states`
      );
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}
