/**
 * Schema validation logic and type guards for workflow definitions
 * Provides comprehensive validation without external dependencies
 */

import {
  WorkflowDefinitions,
  Workflow,
  State,
  StateTransitions,
  ConfirmationConfig,
  WorkflowMetadata
} from './interfaces';
import { WorkflowValidationError } from './errors';

/**
 * Type guard functions for runtime validation
 */

export function isWorkflowMetadata(data: unknown): data is WorkflowMetadata {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const metadata = data as Record<string, unknown>;
  
  // All fields are optional, but if present must be strings
  if (metadata.version !== undefined && typeof metadata.version !== 'string') {
    return false;
  }
  if (metadata.created !== undefined && typeof metadata.created !== 'string') {
    return false;
  }
  if (metadata.modified !== undefined && typeof metadata.modified !== 'string') {
    return false;
  }

  return true;
}

export function isConfirmationConfig(data: unknown): data is ConfirmationConfig {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const config = data as Record<string, unknown>;
  
  if (config.message !== undefined && typeof config.message !== 'string') {
    return false;
  }
  if (config.timeout !== undefined && (typeof config.timeout !== 'number' || config.timeout < 0)) {
    return false;
  }
  if (config.defaultAccept !== undefined && typeof config.defaultAccept !== 'boolean') {
    return false;
  }

  return true;
}

export function isStateTransitions(data: unknown): data is StateTransitions {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const transitions = data as Record<string, unknown>;
  
  // All fields are optional, but if present must be strings
  if (transitions.success !== undefined && typeof transitions.success !== 'string') {
    return false;
  }
  if (transitions.failure !== undefined && typeof transitions.failure !== 'string') {
    return false;
  }
  if (transitions.timeout !== undefined && typeof transitions.timeout !== 'string') {
    return false;
  }

  return true;
}

export function isState(data: unknown): data is State {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const state = data as Record<string, unknown>;
  
  // Required fields
  if (typeof state.command !== 'string' || state.command.trim().length === 0) {
    return false;
  }

  if (!isStateTransitions(state.transitions)) {
    return false;
  }

  // Optional fields
  if (state.description !== undefined && typeof state.description !== 'string') {
    return false;
  }
  
  if (state.args !== undefined) {
    if (!Array.isArray(state.args)) {
      return false;
    }
    if (!state.args.every(arg => typeof arg === 'string')) {
      return false;
    }
  }
  
  if (state.timeout !== undefined && (typeof state.timeout !== 'number' || state.timeout < 0)) {
    return false;
  }
  
  if (state.confirmation !== undefined && !isConfirmationConfig(state.confirmation)) {
    return false;
  }

  return true;
}

export function isWorkflow(data: unknown): data is Workflow {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const workflow = data as Record<string, unknown>;
  
  // Required fields
  if (typeof workflow.name !== 'string' || workflow.name.trim().length === 0) {
    return false;
  }
  
  if (typeof workflow.initialState !== 'string' || workflow.initialState.trim().length === 0) {
    return false;
  }
  
  if (!workflow.states || typeof workflow.states !== 'object') {
    return false;
  }

  // Validate states object
  const states = workflow.states as Record<string, unknown>;
  for (const [_stateName, stateData] of Object.entries(states)) {
    if (!isState(stateData)) {
      return false;
    }
  }

  // Optional fields
  if (workflow.description !== undefined && typeof workflow.description !== 'string') {
    return false;
  }
  
  if (workflow.globalTimeout !== undefined && (typeof workflow.globalTimeout !== 'number' || workflow.globalTimeout < 0)) {
    return false;
  }

  return true;
}

export function isWorkflowDefinitions(data: unknown): data is WorkflowDefinitions {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const definitions = data as Record<string, unknown>;
  
  // Required workflows field
  if (!definitions.workflows || typeof definitions.workflows !== 'object') {
    return false;
  }

  // Validate workflows object
  const workflows = definitions.workflows as Record<string, unknown>;
  for (const [_workflowName, workflowData] of Object.entries(workflows)) {
    if (!isWorkflow(workflowData)) {
      return false;
    }
  }

  // Optional metadata field
  if (definitions.metadata !== undefined && !isWorkflowMetadata(definitions.metadata)) {
    return false;
  }

  return true;
}

/**
 * Schema validation class with detailed error reporting
 */

export class SchemaValidator {
  /**
   * Validate workflow definitions structure
   */
  validateWorkflowDefinitions(data: unknown): WorkflowDefinitions {
    if (!isWorkflowDefinitions(data)) {
      throw new WorkflowValidationError(
        'Invalid workflow definitions structure',
        undefined,
        'workflows'
      );
    }

    // Cross-reference validation
    this.validateWorkflowCrossReferences(data);

    return data as WorkflowDefinitions;
  }

  /**
   * Validate individual workflow
   */
  validateWorkflow(data: unknown, workflowName: string): Workflow {
    if (!isWorkflow(data)) {
      throw new WorkflowValidationError(
        'Invalid workflow structure',
        workflowName
      );
    }

    const workflow = data as Workflow;

    // Validate initial state exists
    if (!workflow.states[workflow.initialState]) {
      throw new WorkflowValidationError(
        `Initial state '${workflow.initialState}' does not exist in workflow`,
        workflowName,
        'initialState'
      );
    }

    // Validate state transitions reference existing states
    this.validateStateTransitions(workflow.states, workflowName);

    return workflow;
  }

  /**
   * Validate state definition
   */
  validateState(data: unknown, stateName: string, workflowName: string): State {
    if (!isState(data)) {
      throw new WorkflowValidationError(
        `Invalid state structure for '${stateName}'`,
        workflowName,
        `states.${stateName}`
      );
    }

    // Validate command is not empty after trimming
    const state = data as State;
    if (state.command.trim().length === 0) {
      throw new WorkflowValidationError(
        `State '${stateName}' has empty command`,
        workflowName,
        `states.${stateName}.command`
      );
    }

    return state;
  }

  /**
   * Validate transitions
   */
  validateTransitions(
    data: unknown,
    stateName: string,
    workflowName: string,
    availableStates: string[]
  ): StateTransitions {
    if (!isStateTransitions(data)) {
      throw new WorkflowValidationError(
        `Invalid transitions structure for state '${stateName}'`,
        workflowName,
        `states.${stateName}.transitions`
      );
    }

    const transitions = data as StateTransitions;

    // Validate transition targets exist
    for (const [transitionType, targetState] of Object.entries(transitions)) {
      if (targetState && !availableStates.includes(targetState)) {
        throw new WorkflowValidationError(
          `Transition '${transitionType}' from state '${stateName}' references non-existent state '${targetState}'`,
          workflowName,
          `states.${stateName}.transitions.${transitionType}`
        );
      }
    }

    return transitions;
  }

  /**
   * Cross-reference validation for workflows
   */
  private validateWorkflowCrossReferences(data: WorkflowDefinitions): void {
    for (const [workflowName, workflow] of Object.entries(data.workflows)) {
      this.validateWorkflow(workflow, workflowName);
    }
  }

  /**
   * Validate all state transitions reference existing states
   */
  private validateStateTransitions(states: Record<string, State>, workflowName: string): void {
    const stateNames = Object.keys(states);

    for (const [stateName, state] of Object.entries(states)) {
      this.validateTransitions(
        state.transitions,
        stateName,
        workflowName,
        stateNames
      );
    }
  }
}