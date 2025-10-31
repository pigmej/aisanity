/**
 * TypeScript interfaces for workflow definitions
 * Defines the complete data structure hierarchy for workflows
 */

// Main workflow definitions container
export interface WorkflowDefinitions {
  workflows: Record<string, Workflow>;
  metadata: WorkflowMetadata;
}

// Individual workflow definition
export interface Workflow {
  name: string;
  description?: string;
  initialState: string;
  states: Record<string, State>;
  globalTimeout?: number;
}

// State definition within a workflow
export interface State {
  description?: string;
  command: string;
  args?: string[];
  timeout?: number;
  stdin?: 'inherit' | 'pipe' | null;
  confirmation?: ConfirmationConfig;
  transitions: StateTransitions;
}

// State transition mappings
export interface StateTransitions {
  success?: string;
  failure?: string;
  timeout?: string;
}

// Confirmation prompt configuration
export interface ConfirmationConfig {
  message?: string;
  timeout?: number;
  defaultAccept?: boolean;
}

// Workflow metadata
export interface WorkflowMetadata {
  version?: string;
  created?: string;
  modified?: string;
}