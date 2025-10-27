/**
 * Public API exports for workflow module
 * Provides a clean interface for other components to consume
 */

// Core interfaces and types
export type {
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

export {
  CommandExecutionError,
  ConfirmationTimeoutError,
  WorkflowErrorHandler
} from './error-handler';

// Execution context types
export type {
  ExecutionContext,
  ExecutionOptions,
  ExecutionResult,
  StateExecutionResult,
  StateExecutionCoordinator,
  TransitionResult,
  ExecutionSummary,
  StateHistoryEntry,
  CommandResult
} from './execution-context';

// State machine
export { StateMachine } from './fsm';

// State validator
export {
  StateTransitionValidator
} from './state-validator';

export type {
  ValidationResult,
  CircularityResult
} from './state-validator';

// Command executor and related components
export {
  CommandExecutor
} from './executor';

export type {
  ExecutorOptions,
  ExecutionErrorCode
} from './executor';

export {
  ProcessHandleImpl as ProcessHandle,
  createProcessHandle
} from './process-handle';

export type {
  IProcessHandle,
  ProcessResult,
  ProcessSpawnOptions
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
  VariableResolver
} from './argument-templater';

export type {
  CLIParameterMapping,
  TemplateVariableRegistry,
  ProcessedCommand,
  ValidationResult as TemplateValidationResult
} from './argument-templater';

// Confirmation timeout system
export {
  ConfirmationHandler
} from './confirmation-handler';

export type {
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