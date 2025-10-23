import { Command } from 'commander';
import { WorkflowParser, StateMachine, CommandExecutor, ConfirmationHandler, WorkflowExecutionError, WorkflowFileError } from '../workflow';
import { Logger } from '../utils/logger';
import picocolors from 'picocolors';

/**
 * Command options interface for state execute command
 */
interface ExecuteOptions {
  yes?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  silent?: boolean;
  quiet?: boolean;
}

/**
 * CLI parameter mapping for template substitution
 */
interface CLIParameterMapping {
  [key: string]: string;
}

/**
 * Enhanced workflow execution error with error code support
 */
class EnhancedWorkflowExecutionError extends WorkflowExecutionError {
  public readonly errorCode: string;

  constructor(
    message: string,
    workflowName: string,
    currentState: string,
    errorCode: string,
    cause?: Error
  ) {
    super(message, workflowName, currentState, cause);
    this.errorCode = errorCode;
    this.name = 'EnhancedWorkflowExecutionError';
  }
}

/**
 * Main state command with subcommands
 */
export const stateCommand = new Command('state')
  .description('Manage and execute workflow states');

/**
 * Execute subcommand for running workflows and states
 */
const executeSubcommand = new Command('execute')
  .description('Execute a specific workflow state')
  .argument('<workflow_name>', 'Name of workflow to execute')
  .argument('[state]', 'Specific state to execute (defaults to initial state)')
  .argument('[args...]', 'Additional arguments for template substitution')
  .option('--yes', 'Bypass confirmation prompts')
  .option('--dry-run', 'Show execution plan without running commands. Shows state execution order, timing estimates, template variables, and final state. Confirmations are detected but not executed. Example: aisanity state execute my-workflow --dry-run')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--silent, --quiet', 'Suppress aisanity output')
  .action(executeWorkflowAction);

stateCommand.addCommand(executeSubcommand);

/**
 * Main action function for workflow execution
 */
async function executeWorkflowAction(
  workflowName: string,
  stateName: string | undefined,
  args: string[],
  options: ExecuteOptions
): Promise<void> {
  // Initialize logger with proper precedence
  const logger = new Logger(
    options.silent || options.quiet || false,
    options.verbose && !options.silent && !options.quiet || false
  );
  
  try {
    // Validate inputs
    await validateInputs(workflowName, stateName, args, logger);
    
    // Load and validate workflow
    const workspacePath = process.cwd();
    const workflow = await loadWorkflow(workflowName, workspacePath, logger);
    
    // Initialize state machine with dependencies
    const stateMachine = await createStateMachine(workflow, logger, options);
    
    // Process CLI arguments through templating system
    const templateVariables = processCLIArguments(args, workflowName, logger);
    
    // Update state machine context with template variables
    // Variables are stored in ExecutionContext.variables for template substitution
    stateMachine.updateContext({ variables: templateVariables });
    
    // Execute state or workflow
    const result = await executeStateOrWorkflow(
      stateMachine, 
      stateName, 
      options,
      logger
    );
    
    // Report results
    reportExecutionResult(result, logger);
    
    // Exit successfully
    process.exit(0);
    
  } catch (error) {
    handleCommandError(error, logger);
    process.exit(1);
  }
}

/**
 * Validate command inputs before processing
 */
async function validateInputs(
  workflowName: string,
  stateName: string | undefined,
  args: string[],
  logger: Logger
): Promise<void> {
  // Validate workflow name
  if (!workflowName || workflowName.trim().length === 0) {
    throw new WorkflowExecutionError(
      'Workflow name is required',
      workflowName,
      'validation'
    );
  }

  // Validate workflow name format (alphanumeric, hyphens, underscores)
  if (!/^[a-zA-Z0-9_-]+$/.test(workflowName)) {
    throw new EnhancedWorkflowExecutionError(
      'Workflow name must contain only alphanumeric characters, hyphens, and underscores',
      workflowName,
      'validation',
      'validation'
    );
  }

  // Validate state name if provided
  if (stateName && !/^[a-zA-Z0-9_-]+$/.test(stateName)) {
    throw new EnhancedWorkflowExecutionError(
      'State name must contain only alphanumeric characters, hyphens, and underscores',
      workflowName,
      'validation',
      'validation'
    );
  }

  // Validate CLI arguments for template injection
  for (const arg of args) {
    if (arg.includes('=')) {
      const [key, value] = arg.split('=', 2);
      if (!key || !value) {
        throw new EnhancedWorkflowExecutionError(
          `Invalid template argument format: ${arg}. Expected format: key=value`,
          workflowName,
          'validation',
          'validation'
        );
      }
      
      // Validate key format
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        throw new EnhancedWorkflowExecutionError(
          `Invalid template variable name: ${key}. Must start with letter or underscore and contain only alphanumeric characters and underscores`,
          workflowName,
          'validation',
          'validation'
        );
      }
      
      // Basic injection prevention
      if (value.includes('`') || value.includes('$(') || value.includes('${')) {
        throw new EnhancedWorkflowExecutionError(
          `Invalid template argument value: ${value}. Contains potentially dangerous characters`,
          workflowName,
          'validation',
          'validation'
        );
      }
    }
  }

  logger.debug('Input validation passed');
}

/**
 * Load workflow from file system
 */
async function loadWorkflow(workflowName: string, workspacePath: string, logger: Logger): Promise<any> {
  try {
    const parser = new WorkflowParser(logger);
    const workflow = parser.getWorkflow(workflowName, workspacePath);
    
    if (!workflow) {
      throw new EnhancedWorkflowExecutionError(
        `Workflow '${workflowName}' not found in .aisanity-workflows.yml`,
        workflowName,
        'not_found',
        'not_found'
      );
    }
    
    logger.info(`Loaded workflow: ${workflow.name}`);
    return workflow;
    
  } catch (error) {
    if (error instanceof WorkflowFileError) {
      throw new EnhancedWorkflowExecutionError(
        `Failed to load workflow file: ${error.message}`,
        workflowName,
        'file_error',
        'file_error'
      );
    }
    throw error;
  }
}

/**
 * Create StateMachine with all required dependencies
 */
async function createStateMachine(
  workflow: any,
  logger: Logger,
  _options: ExecuteOptions
): Promise<StateMachine> {
  // Create command executor
  const executor = new CommandExecutor(logger, 120000, {});
  
  // Create confirmation handler
  const confirmationHandler = new ConfirmationHandler(executor, logger, {
    defaultTimeout: 30000,
    enableProgressIndicator: true,
    progressUpdateInterval: 1000
  });
  
  // Create state machine with dependencies
  return new StateMachine(workflow, logger, executor, confirmationHandler);
}

/**
 * Process CLI arguments into template variables
 */
function processCLIArguments(
  args: string[],
  workflowName: string,
  logger: Logger
): CLIParameterMapping {
  // Parse CLI arguments into key=value pairs or positional arguments
  const cliParameters: CLIParameterMapping = {};
  
  args.forEach((arg, index) => {
    if (arg.includes('=')) {
      const [key, value] = arg.split('=', 2);
      cliParameters[key] = value;
    } else {
      // Positional arguments
      cliParameters[`arg${index + 1}`] = arg;
    }
  });
  
  // Add workflow context
  cliParameters['workflow'] = workflowName;
  
  logger.debug(`Processed ${Object.keys(cliParameters).length} CLI parameters`);
  return cliParameters;
}

/**
   * Execute state or workflow based on parameters
   */
  export async function executeStateOrWorkflow(
  stateMachine: StateMachine,
  stateName: string | undefined,
  options: ExecuteOptions,
  logger: Logger
): Promise<any> {
  
  if (options.dryRun) {
    logger.info('DRY RUN: Showing execution plan without running commands');
    
    try {
      // Use enhanced dry-run simulation
      const context = stateMachine.getContext();
      const dryRunResult = await stateMachine.simulateExecution({
        startingState: stateName,
        templateVariables: context.variables,
        includeTimingEstimates: true,
        includeWarnings: true,
        assumeSuccess: true
      });

      // Format and display dry-run results
      formatDryRunResult(dryRunResult, logger);
      
      return dryRunResult;
    } catch (error) {
      logger.error(`Dry-run simulation failed: ${error}`);
      logger.info('Falling back to basic dry-run information');
      
      // Basic fallback
      logger.info(`Would execute workflow from current state`);
      if (stateName) {
        logger.info(`Starting from state: ${stateName}`);
      }
      logger.info(`Template variables available in context`);
      return { success: true, message: 'Basic dry run completed' };
    }
  }
  
  if (stateName) {
    logger.info(`Executing state '${stateName}' in workflow`);
    return await stateMachine.executeState(stateName, { yesFlag: options.yes });
  } else {
    logger.info(`Executing workflow from initial state`);
    return await stateMachine.execute({ yesFlag: options.yes });
  }
}

/**
 * Report execution results to user
 */
function reportExecutionResult(result: any, logger: Logger): void {
  if (result.success) {
    logger.info(`✓ Workflow execution completed successfully`);
    logger.info(`Final state: ${result.finalState}`);
    logger.info(`Total duration: ${result.totalDuration}ms`);
    
    if (result.stateHistory && result.stateHistory.length > 0) {
      logger.info(`States executed: ${result.stateHistory.length}`);
      result.stateHistory.forEach((entry: any) => {
        logger.debug(`  - ${entry.stateName} (${entry.duration}ms)`);
      });
    }
  } else {
    logger.error(`✗ Workflow execution failed`);
    logger.error(`Final state: ${result.finalState}`);
    logger.error(`Total duration: ${result.totalDuration}ms`);
    
    if (result.error) {
      logger.error(`Error: ${result.error.message}`);
    }
  }
}

/**
 * Format and display dry-run results with color-coded output
 */
function formatDryRunResult(result: any, logger: Logger): void {
  const { cyan, yellow, red, green, bold, dim } = picocolors;
  
  logger.info('');
  logger.info(bold(cyan('🔍 DRY RUN: Workflow Execution Preview')));
  logger.info('');
  
  if (result.executionPlan && result.executionPlan.length > 0) {
    logger.info(bold('📋 Execution Plan:'));
    result.executionPlan.forEach((step: any, index: number) => {
      const duration = step.estimatedDuration;
      const confidence = step.durationConfidence;
      const durationText = confidence === 'high' 
        ? `${duration}ms` 
        : `${duration}ms (${confidence} confidence)`;
      
const commandText = step.hasSubstitutions 
          ? `${step.processedCommand} ${step.processedArgs.join(' ')}`.trim()
          : `${step.rawCommand} ${step.rawArgs.join(' ')}`.trim();
      
      const confirmationText = step.requiresConfirmation ? ' [CONFIRMATION REQUIRED]' : '';
      const terminalText = step.isTerminal ? ' (TERMINAL)' : '';
      
      logger.info(`  ${index + 1}. ${yellow(step.stateName)} (${durationText}) - ${cyan(commandText)}${confirmationText}${terminalText}`);
      
      // Show template substitutions if any
      if (step.hasSubstitutions && Object.keys(step.substitutions).length > 0) {
        logger.info(dim(`     Substitutions: ${Object.entries(step.substitutions).map(([k, v]) => `${k}=${v}`).join(', ')}`));
      }
    });
    logger.info('');
  }
  
  // Summary information
  logger.info(`${bold('🎯 Final State:')} ${result.finalState}`);
  logger.info(`${bold('⏱️  Total Duration:')} ${result.totalDuration}ms (estimated)`);
  logger.info(`${bold(':variables:')} ${Object.keys(result.templateVariables).length} template variables processed`);
  
  if (result.warnings && result.warnings.length > 0) {
    logger.info(`${bold(red('⚠️  Warnings:'))} ${result.warnings.join(', ')}`);
  }
  
  if (result.hasConfirmationPrompts) {
    logger.info(`${bold(yellow(`📝 Confirmations: ${result.totalConfirmations} confirmation prompt(s)`))}`);
  }
  
  logger.info('');
  logger.info(green('Would execute workflow with these parameters. No commands were actually run.'));
  logger.info('');
}

/**
 * Handle command errors with user-friendly messages
 */
function handleCommandError(error: any, logger: Logger): void {
  if (error instanceof EnhancedWorkflowExecutionError) {
    switch (error.errorCode) {
      case 'not_found':
        logger.error(`Error: ${error.message}`);
        logger.error('Available workflows can be found in .aisanity-workflows.yml');
        logger.error('Run "aisanity state execute --help" for usage information');
        break;
        
      case 'file_error':
        logger.error(`Error: ${error.message}`);
        logger.error('Ensure .aisanity-workflows.yml exists in the current directory');
        logger.error('Or run from a directory containing workflow definitions');
        break;
        
      case 'validation':
        logger.error(`Error: ${error.message}`);
        logger.error('Run "aisanity state execute --help" for usage information');
        break;
        
      default:
        logger.error(`Error: ${error.message}`);
        break;
    }
  } else if (error instanceof WorkflowExecutionError) {
    logger.error(`Error: ${error.message}`);
    logger.error(`Workflow: ${error.workflowName}, State: ${error.currentState}`);
  } else if (error instanceof Error) {
    logger.error(`Unexpected error: ${error.message}`);
    logger.debug(`Stack trace: ${error.stack}`);
  } else {
    logger.error(`Unknown error: ${String(error)}`);
  }
}