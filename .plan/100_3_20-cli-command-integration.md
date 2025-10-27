# Implementation Plan: CLI Command Integration

## Implementation Overview

This implementation plan details the creation of the CLI command interface for the workflow state machine system. The command `aisanity state execute <workflow_name> <state> [args]` will serve as the primary user interface for interacting with workflow execution, orchestrating all previously implemented components including the FSM engine, argument templating, confirmation system, and command executor.

The implementation follows existing aisanity patterns using commander.js for command structure, integrates seamlessly with the current CLI framework, and provides comprehensive error handling with actionable user guidance.

## Component Details

### 1. State Command Structure

**File:** `src/commands/state.ts`

The main command will follow aisanity's established pattern with subcommands for different workflow operations:

```typescript
export const stateCommand = new Command('state')
  .description('Manage and execute workflow states')
  .addCommand(executeSubcommand);
```

**Execute Subcommand:**
```typescript
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
```

### 2. Command Action Implementation

**Core Action Function:**
```typescript
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
```

### 3. Integration Components

**Workflow Loading:**
```typescript
async function loadWorkflow(workflowName: string, workspacePath: string, logger: Logger): Promise<Workflow> {
  try {
    const parser = new WorkflowParser(logger);
    const workflow = parser.getWorkflow(workflowName, workspacePath);
    
    if (!workflow) {
      throw new WorkflowExecutionError(
        `Workflow '${workflowName}' not found in .aisanity-workflows.yml`,
        workflowName,
        'not_found'
      );
    }
    
    logger.info(`Loaded workflow: ${workflow.name}`);
    return workflow;
    
  } catch (error) {
    if (error instanceof WorkflowFileError) {
      throw new WorkflowExecutionError(
        `Failed to load workflow file: ${error.message}`,
        workflowName,
        'file_error'
      );
    }
    throw error;
  }
}
```

**State Machine Factory:**
```typescript
async function createStateMachine(
  workflow: Workflow,
  logger: Logger,
  options: ExecuteOptions
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
```

**CLI Argument Processing:**
```typescript
function processCLIArguments(
  args: string[],
  workflowName: string,
  logger: Logger
): Record<string, string> {
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
  
  logger.verbose(`Processed ${Object.keys(cliParameters).length} CLI parameters`);
  return cliParameters;
}
```

### 4. Execution Logic

**State/Workflow Execution:**
```typescript
async function executeStateOrWorkflow(
  stateMachine: StateMachine,
  stateName: string | undefined,
  options: ExecuteOptions,
  logger: Logger
): Promise<ExecutionResult> {
  
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
    // TODO: Add executeState method to StateMachine for specific state execution
    // For now, execute from current state with yesFlag for confirmation bypass
    return await stateMachine.execute({ yesFlag: options.yes });
  } else {
    logger.info(`Executing workflow from initial state`);
    return await stateMachine.execute({ yesFlag: options.yes });
  }
}
```

## Data Structures

### 1. Command Options Interface

```typescript
interface ExecuteOptions {
  yes?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  silent?: boolean;
  quiet?: boolean;
}
```

### 2. Execution Context Extension

```typescript
interface CLIExecutionContext extends ExecutionContext {
  cliParameters: CLIParameterMapping;
  commandOptions: ExecuteOptions;
  workflowName: string;
  requestedState?: string;
}
```

### 3. Error Handling Types

```typescript
interface CommandError {
  type: 'validation' | 'workflow' | 'execution' | 'system';
  message: string;
  workflowName?: string;
  stateName?: string;
  suggestions: string[];
  exitCode: number;
}
```

## API Design

### 1. Public Command Interface

The command exposes a clean, intuitive interface following aisanity conventions:

```bash
# Execute entire workflow from initial state
aisanity state execute deploy

# Execute specific state
aisanity state execute deploy build

# Execute with template arguments
aisanity state execute deploy build branch=feature/new-api environment=staging

# Execute with confirmation bypass
aisanity state execute deploy --yes

# Dry run to preview execution
aisanity state execute deploy --dry-run

# Verbose execution with detailed logging
aisanity state execute deploy --verbose
```

### 2. Help System Integration

**Command Help:**
```bash
aisanity state execute --help
```

**Example Output:**
```
Usage: aisanity state execute <workflow_name> [state] [args...]

Execute a specific workflow state or entire workflow

Arguments:
  workflow_name    Name of workflow to execute from .aisanity-workflows.yml
  state            Specific state to execute (defaults to initial state)
  args...          Additional arguments for template substitution (key=value or positional)

Options:
  --yes            Bypass confirmation prompts
  --dry-run        Show what would be executed without running
  -v, --verbose    Enable verbose logging
  --silent, --quiet Suppress aisanity output
  -h, --help       Display help for command

Examples:
  aisanity state execute deploy
  aisanity state execute deploy build
  aisanity state execute deploy build branch=main environment=prod
  aisanity state execute deploy --yes --verbose
```

### 3. Error Message Design

**Input Validation Errors:**
```typescript
// Missing workflow file
"Error: No .aisanity-workflows.yml file found in current directory.
Create a workflow file or run from a directory containing workflow definitions."

// Workflow not found
"Error: Workflow 'deploy' not found in .aisanity-workflows.yml.
Available workflows: build, test, deploy"

// State not found
"Error: State 'compile' not found in workflow 'deploy'.
Available states: build, test, deploy"
```

**Execution Errors:**
```typescript
// Template validation error
"Error: Invalid template argument 'branch=feature/..invalid'.
Template arguments must contain only alphanumeric characters, underscores, and hyphens."

// Command execution failure
"Error: Command 'npm run build' failed with exit code 1.
Check the command output above for details and ensure all dependencies are installed."
```

## Testing Strategy

### 1. Unit Tests

**Command Parsing Tests:**
- Test argument parsing for workflow name, state, and args
- Test option handling (--yes, --dry-run, --verbose, --silent)
- Test help system functionality
- Test error message formatting

**Integration Component Tests:**
- Test workflow loading with valid and invalid files
- Test state machine initialization with dependencies
- Test CLI argument processing through templating system
- Test error handling and user-friendly message conversion

### 2. Integration Tests

**End-to-End Workflow Tests:**
```typescript
describe('CLI Command Integration', () => {
  test('executes complete workflow successfully', async () => {
    // Mock workflow file and commands
    // Execute full workflow
    // Verify correct state transitions
    // Check output formatting
  });
  
  test('executes specific state with arguments', async () => {
    // Mock workflow with template variables
    // Execute specific state with CLI args
    // Verify template substitution
    // Check command execution
  });
  
  test('handles dry-run mode correctly', async () => {
    // Execute with --dry-run flag
    // Verify no actual commands run
    // Check execution plan output
  });
});
```

### 3. Error Scenario Tests

**Validation Error Tests:**
- Test missing workflow file handling
- Test invalid workflow name handling
- Test invalid state name handling
- Test malformed CLI arguments

**Execution Error Tests:**
- Test workflow validation failures
- Test command execution failures
- Test template injection attempts
- Test timeout scenarios

### 4. Performance Tests

**Startup Performance:**
- Verify command initialization < 500ms
- Test workflow loading performance
- Measure memory usage during execution

**Large Workflow Tests:**
- Test with complex workflow definitions
- Verify performance with many states
- Test with long argument lists

## Development Phases

### Phase 1: Command Structure Setup (Days 1-2)

**Objectives:**
- Create basic command structure following aisanity patterns
- Implement argument parsing and validation
- Add standard options (--verbose, --help, --silent)
- Register command in main CLI

**Deliverables:**
- `src/commands/state.ts` with basic structure
- Command registration in `src/index.ts`
- Basic argument validation
- Help system integration

**Testing:**
- Unit tests for command parsing
- Integration tests for CLI registration
- Help system verification

### Phase 2: Core Integration (Days 3-4)

**Objectives:**
- Integrate WorkflowParser for loading workflow definitions
- Initialize StateMachine with proper dependencies
- Implement argument templating with CLI parameter mapping
- Add basic state execution functionality

**Deliverables:**
- Workflow loading integration
- State machine factory implementation
- CLI argument processing through templating
- Basic execution flow

**Testing:**
- Integration tests with mock workflow files
- Template substitution tests
- State machine initialization tests

### Phase 3: Advanced Features (Days 5-6)

**Objectives:**
- Integrate ConfirmationHandler with --yes flag support
- Add comprehensive error handling and validation
- Implement dry-run functionality for preview mode
- Add detailed logging and progress indication

**Deliverables:**
- Confirmation system integration
- Comprehensive error handling
- Dry-run mode implementation
- Enhanced logging and user feedback

**Testing:**
- Error scenario testing
- Dry-run functionality tests
- Confirmation bypass tests
- Logging output verification

### Phase 4: Polish and Testing (Days 7-8)

**Objectives:**
- Implement result formatting and reporting
- Add integration tests for complete workflow
- Performance optimization and error recovery
- Documentation and examples

**Deliverables:**
- Result formatting system
- Complete test suite
- Performance optimizations
- Usage documentation

**Testing:**
- End-to-end workflow tests
- Performance benchmarking
- User acceptance testing
- Documentation verification

### Phase 5: Integration and Deployment (Day 9)

**Objectives:**
- Final integration testing with all workflow components
- Cross-platform compatibility verification
- Documentation updates
- Release preparation

**Deliverables:**
- Fully integrated CLI command
- Complete documentation
- Release notes
- Deployment verification

**Testing:**
- Full system integration tests
- Cross-platform testing
- Documentation review
- Release validation

## Critical Implementation Details

### 1. Security Considerations

**Input Validation:**
- Validate all CLI parameters before template substitution
- Use existing `TemplateValidator` for injection prevention
- Sanitize file paths and workspace references
- Implement proper error message sanitization

**Command Execution Safety:**
- Leverage existing security measures in CommandExecutor
- Ensure proper escaping of templated arguments
- Validate workspace boundaries for file operations
- Implement timeout enforcement for all operations

### 2. Performance Requirements

**Startup Performance:**
- Target < 500ms for command initialization
- Lazy load workflow definitions only when needed
- Minimize dependency initialization overhead
- Use efficient parsing and validation

**Memory Usage:**
- Maintain minimal memory footprint
- Clean up resources after execution
- Avoid memory leaks in long-running processes
- Use streaming for large output handling

### 3. Error Handling Strategy

**Layered Error Handling:**
1. **Input Validation**: Validate workflow and state names before loading
2. **Workflow Validation**: Use existing WorkflowParser validation
3. **Execution Errors**: Catch and format StateMachine execution errors
4. **User-Friendly Messages**: Convert technical errors to actionable guidance

**Error Recovery:**
- Provide clear next steps for common failures
- Suggest corrective actions for validation errors
- Include workflow debugging information
- Offer help system integration for guidance

### 4. Integration Points

**StateMachine Integration:**
- Use `new WorkflowParser(logger)` and `parser.getWorkflow(workflowName, workspacePath)`
- Create StateMachine with proper constructor: `new StateMachine(workflow, logger, executor, confirmationHandler)`
- Update context with template variables: `stateMachine.updateContext({ variables: templateVariables })`
- Handle `--yes` flag via execute options: `stateMachine.execute({ yesFlag: options.yes })`
- Use existing `Logger` instance for consistent output formatting

**Available vs. Future Methods:**
- Available: `stateMachine.execute(options)`, `stateMachine.updateContext(context)`
- Future Work: `stateMachine.getWorkflowName()`, `stateMachine.executeState(stateName, options)`

**Existing Utilities:**
- Leverage `Logger` for consistent output formatting
- Use `picocolors` for terminal colors and emphasis
- Follow existing error handling patterns
- Maintain consistency with other aisanity commands

This implementation plan ensures the CLI command serves as an intuitive, secure, and performant interface to the workflow system while maintaining consistency with existing aisanity patterns and leveraging all previously implemented components.