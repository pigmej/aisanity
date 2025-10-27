/**
 * Public API exports for workflow module
 * Provides a clean interface for other components to consume
 */

// Core interfaces and types
export {
  WorkflowDefinitions,
  Workflow,
  State,
  StateTransitions,
  ConfirmationConfig,
  WorkflowMetadata
} from './interfaces';

// Main parser class
export { WorkflowParser } from './parser';

// Validation utilities
export { SchemaValidator } from './validator';

// Type guards
export {
  isWorkflowDefinitions,
  isWorkflow,
  isState,
  isStateTransitions,
  isConfirmationConfig,
  isWorkflowMetadata
} from './validator';

// Error classes
export {
  WorkflowParseError,
  WorkflowValidationError,
  WorkflowFileError,
  StateTransitionError,
  WorkflowExecutionError,
  StateNotFoundError
} from './errors';

// Execution context types
export {
  ExecutionContext,
  ExecutionResult,
  StateExecutionResult,
  StateHistoryEntry,
  ExecutionOptions,
  CommandResult,
  StateExecutionCoordinator,
  TransitionResult,
  ExecutionSummary
} from './execution-context';

// State machine
export { StateMachine } from './fsm';

// State validator
export {
  StateTransitionValidator,
  ValidationResult,
  CircularityResult
} from './state-validator';