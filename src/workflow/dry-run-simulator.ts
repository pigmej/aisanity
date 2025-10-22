/**
 * Dry Run Simulator for Workflow Execution Preview
 * Provides comprehensive simulation of workflow execution without running actual commands
 */

import { Workflow } from './interfaces';
import { StateMachine } from './fsm';
import { ArgumentTemplater } from './argument-templater';
import { VariableResolver } from './argument-templater';
import { ExecutionContext } from './execution-context';
import { Logger } from '../utils/logger';

/**
 * Enhanced DryRunResult interface with comprehensive execution preview data
 */
export interface DryRunResult {
  // Core execution results
  success: boolean;
  finalState: string;
  totalDuration: number;
  
  // Execution plan details
  executionPlan: ExecutionPlanStep[];
  executionPath: string[]; // Ordered list of states that would execute
  
  // Template and context information
  templateVariables: Record<string, string>;
  processedSubstitutions: Record<string, { 
    original: string; 
    processed: string;
    appliedTo: string[]; // Which commands/args used this variable
  }>;
  
  // Metadata and warnings
  warnings: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
  hasConfirmationPrompts: boolean;
  totalConfirmations: number;
}

/**
 * Enhanced ExecutionPlanStep interface with detailed state execution information
 */
export interface ExecutionPlanStep {
  // State identification
  stateName: string;
  description: string;
  
  // Command information (before template processing)
  rawCommand: string;
  rawArgs: string[];
  
  // Processed command information (after template processing)
  processedCommand: string;
  processedArgs: string[];
  
  // Template substitutions applied
  substitutions: Record<string, string>;
  hasSubstitutions: boolean;
  
  // Timing estimates
  estimatedDuration: number;
  durationConfidence: 'high' | 'medium' | 'low';
  
  // Transition information
  transitionOnSuccess?: string;
  transitionOnFailure?: string;
  isTerminal: boolean;
  
  // Confirmation requirements
  requiresConfirmation: boolean;
  confirmationMessage?: string;
}

/**
 * Command timing lookup table with confidence levels
 */
const COMMAND_TIMING_LOOKUP: Record<string, { duration: number; confidence: 'high' | 'medium' | 'low' }> = {
  // Git commands
  'git': { duration: 1000, confidence: 'high' },
  'git checkout': { duration: 1500, confidence: 'high' },
  'git merge': { duration: 3000, confidence: 'medium' },
  'git rebase': { duration: 5000, confidence: 'low' },
  'git pull': { duration: 2000, confidence: 'high' },
  'git push': { duration: 2000, confidence: 'high' },
  'git status': { duration: 800, confidence: 'high' },
  'git add': { duration: 1000, confidence: 'high' },
  'git commit': { duration: 2000, confidence: 'high' },
  'git branch': { duration: 1000, confidence: 'high' },
  'git log': { duration: 1500, confidence: 'high' },
  
  // Package manager commands
  'npm': { duration: 3000, confidence: 'medium' },
  'npm install': { duration: 5000, confidence: 'high' },
  'npm test': { duration: 60000, confidence: 'low' },
  'npm run': { duration: 3000, confidence: 'medium' },
  'yarn': { duration: 3000, confidence: 'medium' },
  'yarn install': { duration: 4000, confidence: 'high' },
  'yarn test': { duration: 60000, confidence: 'low' },
  'pnpm': { duration: 2500, confidence: 'medium' },
  'pnpm install': { duration: 3500, confidence: 'high' },
  
  // Shell commands
  'cd': { duration: 100, confidence: 'high' },
  'mkdir': { duration: 200, confidence: 'high' },
  'cp': { duration: 500, confidence: 'high' },
  'mv': { duration: 500, confidence: 'high' },
  'rm': { duration: 300, confidence: 'high' },
  'ls': { duration: 200, confidence: 'high' },
  'cat': { duration: 300, confidence: 'high' },
  'echo': { duration: 100, confidence: 'high' },
  'touch': { duration: 100, confidence: 'high' },
  
  // Build commands
  'build': { duration: 30000, confidence: 'low' },
  'compile': { duration: 30000, confidence: 'low' },
  'make': { duration: 25000, confidence: 'low' },
  'cargo': { duration: 30000, confidence: 'low' },
  'mvn': { duration: 40000, confidence: 'low' },
  'gradle': { duration: 35000, confidence: 'low' },
  
  // Default fallback
  'default': { duration: 1000, confidence: 'low' }
};

/**
 * Options for dry-run simulation
 */
export interface DryRunOptions {
  startingState?: string;
  templateVariables?: Record<string, string>;
  includeTimingEstimates?: boolean;
  includeWarnings?: boolean;
  assumeSuccess?: boolean; // Default: true, assume all states succeed
}

/**
 * Main DryRunSimulator class for workflow execution simulation
 */
export class DryRunSimulator {
  private templater: ArgumentTemplater;
  private variableResolver: VariableResolver;
  private workflow: Workflow;
  private maxIterations: number = 1000; // Prevent infinite loops

  constructor(
    private stateMachine: StateMachine,
    private logger?: Logger
  ) {
    this.templater = new ArgumentTemplater(logger);
    this.variableResolver = new VariableResolver(logger);
    this.workflow = this.extractWorkflowFromStateMachine();
  }

  /**
   * Main simulation method that generates comprehensive dry-run results
   */
  async simulate(options: DryRunOptions = {}): Promise<DryRunResult> {
    const startTime = Date.now();
    
    // Set default options
    const simulationOptions = {
      startingState: options.startingState,
      templateVariables: options.templateVariables || {},
      includeTimingEstimates: options.includeTimingEstimates ?? true,
      includeWarnings: options.includeWarnings ?? true,
      assumeSuccess: options.assumeSuccess ?? true
    };

    this.logger?.debug(`Starting dry-run simulation from state: ${simulationOptions.startingState || 'initial'}`);

    try {
      // Get execution context and template variables
      const context = this.stateMachine.getContext();
      const builtInVariables = await this.variableResolver.resolveBuiltInVariables();
      const allVariables = {
        ...builtInVariables,
        ...context.variables,
        ...simulationOptions.templateVariables
      };

      // Generate execution plan
      const executionPlan = await this.generateExecutionPlan(
        simulationOptions.startingState,
        allVariables,
        simulationOptions.assumeSuccess
      );

      // Estimate timing if requested
      let totalDuration = 0;
      if (simulationOptions.includeTimingEstimates) {
        totalDuration = this.estimateTiming(executionPlan);
      }

      // Detect potential issues and generate warnings
      const warnings: string[] = [];
      if (simulationOptions.includeWarnings) {
        warnings.push(...this.detectPotentialIssues(executionPlan));
      }

      // Calculate complexity based on execution plan
      const estimatedComplexity = this.calculateComplexity(executionPlan);

      // Determine final state
      const finalState = executionPlan.length > 0 
        ? executionPlan[executionPlan.length - 1].stateName
        : this.stateMachine.getCurrentState();

      // Extract execution path
      const executionPath = executionPlan.map(step => step.stateName);

      // Count confirmation prompts
      const confirmations = executionPlan.filter(step => step.requiresConfirmation);
      const hasConfirmationPrompts = confirmations.length > 0;
      const totalConfirmations = confirmations.length;

      // Process template variable usage
      const processedSubstitutions = this.analyzeTemplateVariableUsage(executionPlan);

      this.logger?.debug(`Dry-run simulation completed. Final state: ${finalState}, Duration: ${totalDuration}ms`);

      return {
        success: true,
        finalState,
        totalDuration,
        executionPlan,
        executionPath,
        templateVariables: allVariables,
        processedSubstitutions,
        warnings,
        estimatedComplexity,
        hasConfirmationPrompts,
        totalConfirmations
      };

    } catch (error) {
      this.logger?.error(`Dry-run simulation failed: ${error}`);
      return {
        success: false,
        finalState: this.stateMachine.getCurrentState(),
        totalDuration: Date.now() - startTime,
        executionPlan: [],
        executionPath: [],
        templateVariables: {},
        processedSubstitutions: {},
        warnings: [`Simulation error: ${error instanceof Error ? error.message : String(error)}`],
        estimatedComplexity: 'high',
        hasConfirmationPrompts: false,
        totalConfirmations: 0
      };
    }
  }

  /**
   * Generate execution plan by simulating state transitions
   */
  private async generateExecutionPlan(
    startingState: string | undefined,
    variables: Record<string, string>,
    assumeSuccess: boolean
  ): Promise<ExecutionPlanStep[]> {
    const plan: ExecutionPlanStep[] = [];
    let currentState: string = startingState ? startingState : this.workflow.initialState;
    let iterations = 0;

    // Validate starting state exists
    if (!this.workflow.states[currentState]) {
      throw new Error(`Starting state '${currentState}' not found in workflow`);
    }

    while (currentState && iterations < this.maxIterations) {
      iterations++;
      
      const state = this.workflow.states[currentState];
      if (!state) {
        break;
      }

      // Process command and args with template variables (allow undefined variables)
      const processedCommandResult = await this.templater.processCommandArgs(
        state.command,
        state.args || [],
        variables
      );

      // Estimate duration for this step
      const estimatedDuration = this.estimateStepDuration(processedCommandResult.command);
      const durationConfidence = this.getDurationConfidence(processedCommandResult.command);

      // Determine next states
      const transitionOnSuccess = state.transitions.success;
      const transitionOnFailure = state.transitions.failure;

      // Create execution plan step
      const step: ExecutionPlanStep = {
        stateName: currentState,
        description: state.description || 'No description',
        
        // Raw command information
        rawCommand: state.command,
        rawArgs: state.args || [],
        
        // Processed command information
        processedCommand: processedCommandResult.command,
        processedArgs: processedCommandResult.args,
        
        // Template substitutions
        substitutions: processedCommandResult.substitutions,
        hasSubstitutions: processedCommandResult.hasPlaceholders,
        
        // Timing estimates
        estimatedDuration,
        durationConfidence,
        
        // Transition information
        transitionOnSuccess,
        transitionOnFailure,
        isTerminal: !transitionOnSuccess && !transitionOnFailure,
        
        // Confirmation requirements
        requiresConfirmation: !!state.confirmation,
        confirmationMessage: state.confirmation?.message
      };

      plan.push(step);

      // Log warnings for undefined variables
      if (processedCommandResult.validationErrors.length > 0) {
        this.logger?.warn(`Template warnings in state '${currentState}': ${processedCommandResult.validationErrors.join(', ')}`);
      }

      // Determine next state based on simulation assumptions
      let nextState: string | undefined;
      if (assumeSuccess) {
        // Default to success transition (exit code 0)
        nextState = transitionOnSuccess;
      } else {
        // For more complex simulation, could consider failure paths
        nextState = transitionOnSuccess;
      }

      // Check for terminal state
      if (!nextState) {
        break;
      }

      currentState = nextState;
    }

    if (iterations >= this.maxIterations) {
      this.logger?.warn(`Maximum iterations (${this.maxIterations}) reached - possible infinite loop detected`);
    }

    return plan;
  }

  /**
   * Estimate timing for an execution plan
   */
  private estimateTiming(plan: ExecutionPlanStep[]): number {
    return plan.reduce((total, step) => total + step.estimatedDuration, 0);
  }

  /**
   * Estimate duration for a single command
   */
  private estimateStepDuration(command: string): number {
    // Get base command for lookup
    const baseCommand = this.getBaseCommand(command);
    
    // Look up timing in our command table
    const timingInfo = COMMAND_TIMING_LOOKUP[baseCommand] || 
                      COMMAND_TIMING_LOOKUP[command.split(' ')[0]] ||
                      COMMAND_TIMING_LOOKUP.default;

    let duration = timingInfo.duration;

    // Add overhead for complex arguments
    const argCount = command.split(' ').length - 1;
    if (argCount > 5) {
      duration += argCount * 100; // Add 100ms per argument beyond 5
    }

    return duration;
  }

  /**
   * Get confidence level for timing estimate
   */
  private getDurationConfidence(command: string): 'high' | 'medium' | 'low' {
    const baseCommand = this.getBaseCommand(command);
    const timingInfo = COMMAND_TIMING_LOOKUP[baseCommand] || 
                      COMMAND_TIMING_LOOKUP[command.split(' ')[0]] ||
                      COMMAND_TIMING_LOOKUP.default;
    
    return timingInfo.confidence;
  }

  /**
   * Extract base command for timing lookup
   */
  private getBaseCommand(command: string): string {
    const parts = command.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0]} ${parts[1]}`; // Try two-word command first
    }
    return parts[0] || 'default';
  }

  /**
   * Detect potential issues in execution plan
   */
  private detectPotentialIssues(plan: ExecutionPlanStep[]): string[] {
    const warnings: string[] = [];

    // Check for long-running operations
    const longRunningSteps = plan.filter(step => step.estimatedDuration > 30000);
    if (longRunningSteps.length > 0) {
      warnings.push(`${longRunningSteps.length} long-running operation(s) detected (${longRunningSteps.map(s => s.stateName).join(', ')})`);
    }

    // Check for confirmation prompts
    const confirmationSteps = plan.filter(step => step.requiresConfirmation);
    if (confirmationSteps.length > 0) {
      warnings.push(`Confirmation required for: ${confirmationSteps.map(s => s.stateName).join(', ')}`);
    }

    // Check for undefined template variables
    const undefinedVarSteps = plan.filter(step => 
      step.hasSubstitutions && Object.keys(step.substitutions).length === 0
    );
    if (undefinedVarSteps.length > 0) {
      warnings.push(`Template variables may be undefined in: ${undefinedVarSteps.map(s => s.stateName).join(', ')}`);
    }

    // Check for potentially dangerous commands
    const dangerousCommands = ['rm -rf', 'chmod', 'chown', 'sudo'];
    const dangerousSteps = plan.filter(step => 
      dangerousCommands.some(cmd => step.processedCommand.includes(cmd))
    );
    if (dangerousSteps.length > 0) {
      warnings.push(`Potentially dangerous commands detected: ${dangerousSteps.map(s => s.stateName).join(', ')}`);
    }

    return warnings;
  }

  /**
   * Calculate overall complexity of execution plan
   */
  private calculateComplexity(plan: ExecutionPlanStep[]): 'low' | 'medium' | 'high' {
    const totalDuration = this.estimateTiming(plan);
    const stateCount = plan.length;
    const confirmationCount = plan.filter(step => step.requiresConfirmation).length;
    const highConfidenceCount = plan.filter(step => step.durationConfidence === 'high').length;

    // Base complexity on multiple factors
    let complexityScore = 0;

    if (totalDuration > 60000) complexityScore += 3; // More than 1 minute
    else if (totalDuration > 10000) complexityScore += 2; // More than 10 seconds
    else complexityScore += 1;

    if (stateCount > 10) complexityScore += 2;
    else if (stateCount > 5) complexityScore += 1;

    if (confirmationCount > 2) complexityScore += 2;
    else if (confirmationCount > 0) complexityScore += 1;

    if (highConfidenceCount < plan.length * 0.5) complexityScore += 1; // Low confidence estimates

    if (complexityScore >= 5) return 'high';
    if (complexityScore >= 3) return 'medium';
    return 'low';
  }

  /**
   * Analyze template variable usage across execution plan
   */
  private analyzeTemplateVariableUsage(plan: ExecutionPlanStep[]): Record<string, { 
    original: string; 
    processed: string;
    appliedTo: string[]; 
  }> {
    const variableUsage: Record<string, { original: string; processed: string; appliedTo: string[] }> = {};

    for (const step of plan) {
      for (const [varName, value] of Object.entries(step.substitutions)) {
        if (!variableUsage[varName]) {
          variableUsage[varName] = {
            original: `{${varName}}`,
            processed: value,
            appliedTo: []
          };
        }
        variableUsage[varName].appliedTo.push(step.stateName);
      }
    }

    return variableUsage;
  }

  /**
   * Extract workflow from state machine
   */
  private extractWorkflowFromStateMachine(): Workflow {
    return this.stateMachine.getWorkflow();
  }
}