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

// Command executor and related components
export {
  CommandExecutor,
  CommandExecutionError,
  ExecutionErrorCode,
  ExecutorOptions
} from './executor';

export {
  ProcessHandle,
  ProcessResult,
  ProcessSpawnOptions,
  createProcessHandle
} from './process-handle';

export {
  OutputBuffer
} from './output-buffer';

export {
  TUIPromptBuilder
} from './tui-prompt-builder';

// Argument templating system
export {
  ArgumentTemplater,
  TemplateValidator,
  VariableResolver,
  ProcessedCommand,
  ValidationResult as TemplateValidationResult,
  CLIParameterMapping,
  TemplateVariableRegistry
} from './argument-templater';

// Confirmation timeout system
export {
  ConfirmationHandler,
  ConfirmationOptions,
  ConfirmationResult,
  ConfirmationMethod,
  ConfirmationHandlerConfig
} from './confirmation-handler';

export {
  ConfirmationBuilder
} from './confirmation-builder';

export {
  ProgressIndicator
} from './progress-indicator';

export {
  TimeoutManager
} from './timeout-manager';