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
  WorkflowFileError
} from './errors';