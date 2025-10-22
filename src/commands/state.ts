import { Command } from 'commander';
import { WorkflowParser, StateMachine, CommandExecutor, ConfirmationHandler, WorkflowExecutionError, WorkflowFileError } from '../workflow';
import { Logger } from '../utils/logger';

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
  .option('--dry-run', 'Show what would be executed without running')
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
async function executeStateOrWorkflow(
  stateMachine: StateMachine,
  stateName: string | undefined,
  options: ExecuteOptions,
  logger: Logger
): Promise<any> {
  
  if (options.dryRun) {
    logger.info('DRY RUN: Showing execution plan without running commands');
    // Note: Dry-run functionality needs to be implemented in StateMachine
    // For now, just log what would be executed
    logger.info(`Would execute workflow from current state`);
    if (stateName) {
      logger.info(`Starting from state: ${stateName}`);
    }
    // TODO: Add method to StateMachine to get current context variables for display
    logger.info(`Template variables available in context`);
    return { success: true, message: 'Dry run completed' };
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