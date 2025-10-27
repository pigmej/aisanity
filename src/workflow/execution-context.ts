/**
 * Execution context types and interfaces for workflow state machine
 * Defines immutable data structures for workflow execution tracking
 */

/**
 * Immutable execution context for workflow data
 * Contains workflow metadata and runtime information
 */
export interface ExecutionContext {
  readonly workflowName: string;
  readonly startedAt: Date;
  readonly variables: Record<string, string>; // For future templating
  readonly metadata: Record<string, unknown>; // Extensibility
}

/**
 * Result of individual state execution
 * Captures the outcome and timing of a single state
 */
export interface StateExecutionResult {
  stateName: string;
  exitCode: number;
  executedAt: Date;
  duration: number; // milliseconds
  output?: string; // For logging/debugging
}

/**
 * Complete workflow execution result
 * Summarizes the entire workflow execution outcome
 */
export interface ExecutionResult {
  success: boolean;
  finalState: string;
  stateHistory: StateHistoryEntry[];
  totalDuration: number;
  error?: Error;
}

/**
 * Individual state history entry
 * Records detailed information about a state's execution
 */
export interface StateHistoryEntry {
  stateName: string;
  enteredAt: Date;
  exitedAt: Date;
  exitCode: number;
  duration: number;
  transitionedTo: string | null; // null = terminal state
}

/**
 * Command execution options (for future integration)
 * Configures how commands are executed in states
 */
export interface ExecutionOptions {
  timeout?: number;
  cwd?: string;
  env?: Record<string, string>;
}

/**
 * Command execution result (interface for Phase 2)
 * Captures the result of executing a command
 */
export interface CommandResult {
  exitCode: number;
  stdout?: string;
  stderr?: string;
  duration: number;
}

/**
 * Interface for state execution coordinator (Phase 2 integration)
 * Provides the contract for executing commands in states
 */
export interface StateExecutionCoordinator {
  executeCommand(
    command: string,
    args: string[],
    options: ExecutionOptions
  ): Promise<CommandResult>;
}

/**
 * Result of a state transition attempt
 * Indicates whether a transition is possible and the target state
 */
export interface TransitionResult {
  canTransition: boolean;
  nextState: string | null;
  reason?: string;
}

/**
 * Summary of workflow execution
 * Provides a high-level view of the execution
 */
export interface ExecutionSummary {
  workflowName: string;
  totalStates: number;
  executedStates: number;
  totalDuration: number;
  success: boolean;
  finalState: string;
}
