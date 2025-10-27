/**
 * Finite State Machine for workflow execution
 * Manages state transitions, execution context, and workflow flow
 */

import { Workflow } from './interfaces';
import {
  ExecutionContext,
  ExecutionResult,
  StateExecutionResult,
  StateHistoryEntry,
  StateExecutionCoordinator,
  TransitionResult,
  ExecutionSummary
} from './execution-context';
import { StateTransitionValidator } from './state-validator';
import { WorkflowParser } from './parser';
import { Logger } from '../utils/logger';
import {
  WorkflowValidationError,
  WorkflowExecutionError,
  StateNotFoundError
} from './errors';
import { CommandExecutionError } from './error-handler';
import { ConfirmationHandler } from './confirmation-handler';
import { WorkflowErrorHandler } from './error-handler';
import { createFSMContext } from './error-context';

/**
 * Main StateMachine class for workflow execution
 * Provides deterministic state management with exit code-based transitions
 */
export class StateMachine {
  private currentState: string;
  private context: ExecutionContext;
  private stateHistory: StateHistoryEntry[];
  private executor?: StateExecutionCoordinator;
  private confirmationHandler?: ConfirmationHandler;
  private maxIterations: number = 1000; // Prevent infinite loops

  constructor(
    private workflow: Workflow,
    private logger?: Logger,
    executor?: StateExecutionCoordinator,
    confirmationHandler?: ConfirmationHandler,
    private errorHandler?: WorkflowErrorHandler
  ) {
    // Validate workflow structure on construction
    const validationResult = StateTransitionValidator.validateWorkflow(workflow);
    if (!validationResult.valid) {
      const error = new WorkflowValidationError(
        `Invalid workflow structure: ${validationResult.errors.join(', ')}`,
        workflow.name,
        'structure'
      );
      if (this.errorHandler) {
        this.errorHandler.handleValidationError(error, createFSMContext('constructor', workflow.name));
      }
      throw error;
    }

    // Log warnings
    if (this.logger && validationResult.warnings.length > 0) {
      for (const warning of validationResult.warnings) {
        this.logger.warn(`Workflow validation warning: ${warning}`);
      }
    }

    this.currentState = workflow.initialState;
    this.stateHistory = [];
    this.executor = executor;
    this.confirmationHandler = confirmationHandler;
    this.context = {
      workflowName: workflow.name,
      startedAt: new Date(),
      variables: {},
      metadata: {}
    };

    this.logger?.debug(`StateMachine initialized for workflow '${workflow.name}'`);
  }

  /**
   * Factory method to create StateMachine from workflow name
   */
  static fromWorkflowName(
    workflowName: string,
    workspacePath: string,
    logger?: Logger,
    errorHandler?: WorkflowErrorHandler
  ): StateMachine {
    const parser = new WorkflowParser(logger, errorHandler);
    const workflow = parser.getWorkflow(workflowName, workspacePath);
    return new StateMachine(workflow, logger, undefined, undefined, errorHandler);
  }

  /**
   * Execute the complete workflow sequentially
   * Returns execution result with history and final state
   */
  async execute(options: { yesFlag?: boolean } = {}): Promise<ExecutionResult> {
    const startTime = Date.now();
    let iterations = 0;

    this.logger?.info(`Starting workflow: ${this.workflow.name}`);

    // Set up global timeout if specified
    let globalTimeoutHandle: NodeJS.Timeout | undefined;
    let globalTimeoutOccurred = false;
    this.logger?.info(`Global timeout setting: ${this.workflow.globalTimeout}`);
    this.logger?.info(`Workflow object keys: ${Object.keys(this.workflow)}`);
    this.logger?.info(`Workflow globalTimeout type: ${typeof this.workflow.globalTimeout}`);
    if (this.workflow.globalTimeout) {
      this.logger?.info(`Setting global timeout: ${this.workflow.globalTimeout}ms`);
      globalTimeoutHandle = setTimeout(() => {
        this.logger?.error(`Global timeout triggered: ${this.workflow.globalTimeout}ms`);
        globalTimeoutOccurred = true;
      }, this.workflow.globalTimeout);
    } else {
      this.logger?.info('No global timeout specified');
    }

    try {
      while (this.currentState) {
        // Check for infinite loop protection
        if (iterations++ >= this.maxIterations) {
          const error = new WorkflowExecutionError(
            `Maximum iteration limit (${this.maxIterations}) reached - possible infinite loop`,
            this.workflow.name,
            this.currentState
          );
          if (this.errorHandler) {
            this.errorHandler.handleExecutionError(error, createFSMContext('execute', this.workflow.name, this.currentState));
          }
          throw error;
        }

        this.logger?.debug(`Executing state: ${this.currentState}`);

        // Check if global timeout occurred
        if (globalTimeoutOccurred) {
          this.logger?.error(`Global timeout occurred during state '${this.currentState}' execution`);
          // Simulate timeout result for current state
          const timeoutResult = {
            stateName: this.currentState,
            exitCode: 124, // TIMEOUT_ERROR
            executedAt: new Date(),
            duration: 0,
            output: `Global timeout: ${this.workflow.globalTimeout}ms exceeded`
          };
          
          // Record in history
          this.recordStateExecution(timeoutResult);
          
          // Determine next state based on timeout exit code
          const nextState = this.getNextState(timeoutResult.exitCode);
          
          if (nextState) {
            this.logger?.debug(
              `State transition: ${this.currentState} → ${nextState} (global timeout)`
            );
            this.currentState = nextState;
          } else {
            this.logger?.debug(
              `Reached terminal state: ${this.currentState} (global timeout)`
            );
            break;
          }
          continue;
        }

        // Execute current state
        const result = await this.executeState(this.currentState, options);

        // Record in history
        this.recordStateExecution(result);

        // Determine next state based on exit code
        const nextState = this.getNextState(result.exitCode);

        if (nextState) {
          this.logger?.debug(
            `State transition: ${this.currentState} → ${nextState} (exit code: ${result.exitCode})`
          );
          this.currentState = nextState;
        } else {
          this.logger?.debug(
            `Reached terminal state: ${this.currentState} (exit code: ${result.exitCode})`
          );
          break;
        }
      }

      const totalDuration = Date.now() - startTime;
      this.logger?.info(`Workflow completed in ${totalDuration}ms`);

      // Clear global timeout
      if (globalTimeoutHandle) {
        clearTimeout(globalTimeoutHandle);
      }

      // Determine success based on final state execution
      const lastExecution = this.stateHistory[this.stateHistory.length - 1];
      const success = lastExecution ? lastExecution.exitCode === 0 : false;

      return {
        success,
        finalState: this.currentState,
        stateHistory: this.stateHistory,
        totalDuration
      };
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      
      // Clear global timeout
      if (globalTimeoutHandle) {
        clearTimeout(globalTimeoutHandle);
      }
      
      // Handle error with error handler if available
      // Skip errors that were already handled by executeState()
      if (this.errorHandler && error instanceof Error) {
        if (error instanceof WorkflowExecutionError && error.message.includes('global timeout')) {
          // Global timeout - don't handle through error handler, just re-throw
          throw error;
        } else if (error instanceof WorkflowExecutionError) {
          this.logger?.error(`Workflow execution failed: ${error instanceof Error ? error.message : String(error)}`);
          this.errorHandler.handleExecutionError(error, createFSMContext('execute', this.workflow.name, this.currentState));
        } else if (error instanceof CommandExecutionError) {
          // CommandExecutionError should have been handled at state level
          // If we get here, it's an unexpected error
          this.logger?.error(`Unexpected command execution error: ${error.message}`);
          throw error;
        } else {
          this.logger?.error(`Workflow execution failed: ${error instanceof Error ? error.message : String(error)}`);
          this.errorHandler.enrichAndThrowSync(error, createFSMContext('execute', this.workflow.name, this.currentState));
        }
      }

      return {
        success: false,
        finalState: this.currentState,
        stateHistory: this.stateHistory,
        totalDuration,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Execute a single state
   * Returns the execution result for that state
   */
  async executeState(stateName: string, options: { yesFlag?: boolean } = {}): Promise<StateExecutionResult> {
    // Validate state exists
    const state = this.workflow.states[stateName];
    if (!state) {
      const error = new StateNotFoundError(
        `State '${stateName}' not found in workflow`,
        stateName,
        this.workflow.name
      );
      if (this.errorHandler) {
        this.errorHandler.enrichAndThrowSync(error, createFSMContext('executeState', this.workflow.name, stateName));
      }
      throw error;
    }

    const startTime = Date.now();
    const executedAt = new Date();

    // Handle confirmation if configured
    if (state.confirmation && this.confirmationHandler) {
      // Skip confirmation entirely if --yes flag is set
      if (!options.yesFlag) {
        const result = await this.confirmationHandler.requestConfirmation(
          state.confirmation.message || `Execute ${stateName}?`,
          {
            timeout: state.confirmation.timeout,
            defaultResponse: state.confirmation.defaultAccept,
            yesFlag: false
          }
        );
        
        if (!result.confirmed) {
          // Return failure result for declined confirmation
          const duration = Date.now() - startTime;
          this.logger?.info(`State '${stateName}' confirmation declined`);
          
          return {
            stateName,
            exitCode: 1,
            executedAt,
            duration,
            output: `Confirmation declined: ${state.confirmation.message || `Execute ${stateName}?`}`
          };
        }
      } else {
        this.logger?.info(`State '${stateName}' confirmation bypassed with --yes flag`);
      }
    }

    this.logger?.debug(`Executing command in state '${stateName}': ${state.command}`);

    // If executor is provided, execute the command
    if (this.executor) {
      try {
        const result = await this.executor.executeCommand(
          state.command,
          state.args || [],
          {
            timeout: state.timeout,
            cwd: undefined,
            env: undefined,
            stdin: state.stdin
          }
        );

        const duration = Date.now() - startTime;
        this.logger?.info(`State '${stateName}' executed in ${duration}ms (exit code: ${result.exitCode})`);

        return {
          stateName,
          exitCode: result.exitCode,
          executedAt,
          duration,
          output: result.stdout
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        this.logger?.error(`State '${stateName}' execution failed: ${error instanceof Error ? error.message : String(error)}`);

        // Handle timeout errors specially - return timeout exit code for transition handling
        if (error instanceof CommandExecutionError && error.message.includes('timed out')) {
          return {
            stateName,
            exitCode: 124, // Standard timeout exit code
            executedAt,
            duration,
            output: error.message
          };
        }

        // Handle error with error handler if available
        if (this.errorHandler && error instanceof Error) {
          this.errorHandler.enrichAndThrowSync(error, createFSMContext('executeState', this.workflow.name, stateName, {
            command: state.command
          }));
        }

        // Return failure result
        return {
          stateName,
          exitCode: 1,
          executedAt,
          duration,
          output: error instanceof Error ? error.message : String(error)
        };
      }
    } else {
      // No executor provided - stub execution for Phase 1
      const duration = Date.now() - startTime;
      this.logger?.debug(`No executor provided - stub execution for state '${stateName}'`);

      return {
        stateName,
        exitCode: 0,
        executedAt,
        duration,
        output: `Stub execution: ${state.command}`
      };
    }
  }

  /**
   * Get current state name
   */
  getCurrentState(): string {
    return this.currentState;
  }

  /**
   * Check if transition is possible from current state with given exit code
   */
  canTransition(exitCode: number): boolean {
    const nextState = this.getNextState(exitCode);
    return nextState !== null;
  }

  /**
   * Attempt to transition to next state based on exit code
   * Returns transition result
   */
  transition(exitCode: number): TransitionResult {
    const nextState = this.getNextState(exitCode);

    if (nextState === null) {
      return {
        canTransition: false,
        nextState: null,
        reason: 'No transition defined for this exit code (terminal state)'
      };
    }

    // Validate the transition exists
    if (!StateTransitionValidator.validateTransition(
      this.currentState,
      nextState,
      this.workflow
    )) {
      return {
        canTransition: false,
        nextState: null,
        reason: `Invalid transition from '${this.currentState}' to '${nextState}'`
      };
    }

    // Perform the transition
    this.currentState = nextState;

    return {
      canTransition: true,
      nextState,
      reason: undefined
    };
  }

  /**
   * Get immutable execution context
   */
  getContext(): Readonly<ExecutionContext> {
    return this.context;
  }

  /**
   * Simulate workflow execution without running actual commands
   * Returns comprehensive dry-run results with execution plan and timing estimates
   */
  async simulateExecution(options: {
    startingState?: string;
    templateVariables?: Record<string, string>;
    includeTimingEstimates?: boolean;
    includeWarnings?: boolean;
    assumeSuccess?: boolean;
  } = {}): Promise<any> {
    // This will be implemented with DryRunSimulator integration
    // For now, provide a basic implementation that can be enhanced
    
    const {
      startingState,
      templateVariables = {},
      includeTimingEstimates = true,
      includeWarnings = true,
      assumeSuccess = true
    } = options;

    try {
      // Import and use DryRunSimulator
      const { DryRunSimulator } = await import('./dry-run-simulator');
      const simulator = new DryRunSimulator(this, this.logger);
      
      return await simulator.simulate({
        startingState,
        templateVariables,
        includeTimingEstimates,
        includeWarnings,
        assumeSuccess
      });
    } catch (error) {
      // Fallback to basic simulation if DryRunSimulator is not available
      this.logger?.warn('DryRunSimulator not available, using basic simulation');
      return this.basicSimulateExecution(options);
    }
  }

  /**
   * Basic simulation method for fallback
   */
  private basicSimulateExecution(options: {
    startingState?: string;
    templateVariables?: Record<string, string>;
  } = {}): any {
    const { startingState, templateVariables = {} } = options;
    const workflow = this.workflow;
    let currentState = startingState || workflow.initialState;
    const executionPlan: any[] = [];
    let totalDuration = 0;
    let iterations = 0;

    // Validate starting state
    if (!workflow.states[currentState]) {
      throw new Error(`Starting state '${currentState}' not found in workflow`);
    }

    while (currentState && iterations < this.maxIterations) {
      iterations++;
      const state = workflow.states[currentState];
      
      if (!state) break;

      const step = {
        stateName: currentState,
        description: state.description || 'No description',
        command: state.command,
        args: state.args || [],
        estimatedDuration: 1000, // Default estimate
        durationConfidence: 'low' as const,
        requiresConfirmation: !!state.confirmation,
        isTerminal: !state.transitions.success && !state.transitions.failure,
        transitionOnSuccess: state.transitions.success,
        transitionOnFailure: state.transitions.failure
      };

      executionPlan.push(step);
      totalDuration += step.estimatedDuration;

      // Default to success transition
      const nextState = state.transitions.success;
      if (!nextState) {
        break;
      }
      currentState = nextState;
    }

    const finalState = executionPlan.length > 0 
      ? executionPlan[executionPlan.length - 1].stateName
      : this.currentState;

    return {
      success: true,
      finalState,
      totalDuration,
      executionPlan,
      executionPath: executionPlan.map((step: any) => step.stateName),
      templateVariables: { ...templateVariables },
      processedSubstitutions: {},
      warnings: [],
      estimatedComplexity: 'medium' as const,
      hasConfirmationPrompts: executionPlan.some((step: any) => step.requiresConfirmation),
      totalConfirmations: executionPlan.filter((step: any) => step.requiresConfirmation).length
    };
  }

  /**
   * Update execution context (creates new immutable context)
   */
  updateContext(updates: Partial<Omit<ExecutionContext, 'workflowName' | 'startedAt'>>): void {
    this.context = {
      ...this.context,
      ...updates
    };
    this.logger?.debug('Execution context updated');
  }

  /**
   * Get state execution history
   */
  getStateHistory(): ReadonlyArray<StateHistoryEntry> {
    return this.stateHistory;
  }

  /**
   * Get execution summary
   */
  getExecutionSummary(): ExecutionSummary {
    const totalDuration = this.stateHistory.reduce(
      (sum, entry) => sum + entry.duration,
      0
    );

    return {
      workflowName: this.workflow.name,
      totalStates: Object.keys(this.workflow.states).length,
      executedStates: this.stateHistory.length,
      totalDuration,
      success: true, // Will be updated based on execution result
      finalState: this.currentState
    };
  }

  /**
   * Get the workflow definition (for dry-run integration)
   */
  getWorkflow(): Workflow {
    return this.workflow;
  }

  /**
   * Determine next state based on exit code
   * Returns null if no transition exists (terminal state)
   */
  private getNextState(exitCode: number): string | null {
    const currentState = this.workflow.states[this.currentState];

    if (!currentState) {
      const error = new StateNotFoundError(
        `Current state '${this.currentState}' not found in workflow`,
        this.currentState,
        this.workflow.name
      );
      if (this.errorHandler) {
        this.errorHandler.enrichAndThrowSync(error, createFSMContext('getNextState', this.workflow.name, this.currentState));
      }
      throw error;
    }

    // Check for success transition (exit code 0)
    if (exitCode === 0 && currentState.transitions.success) {
      return currentState.transitions.success;
    }

    // Check for timeout transition (exit code 124)
    if (exitCode === 124 && currentState.transitions.timeout) {
      return currentState.transitions.timeout;
    }

    // Check for failure transition (non-zero exit code, but not timeout)
    if (exitCode !== 0 && exitCode !== 124 && currentState.transitions.failure) {
      return currentState.transitions.failure;
    }

    // No transition = terminal state
    return null;
  }

  /**
   * Record state execution in history
   */
  private recordStateExecution(result: StateExecutionResult): void {
    const nextState = this.getNextState(result.exitCode);

    const historyEntry: StateHistoryEntry = {
      stateName: result.stateName,
      enteredAt: result.executedAt,
      exitedAt: new Date(result.executedAt.getTime() + result.duration),
      exitCode: result.exitCode,
      duration: result.duration,
      transitionedTo: nextState,
      timestamp: result.executedAt // Alias for enteredAt
    };

    this.stateHistory.push(historyEntry);
    this.logger?.debug(`Recorded state execution: ${result.stateName}`);
  }
}
