# Architectural Analysis: Error Handling Logging

**Task ID:** 100_4_10  
**Parent Feature:** 100 - Workflow State Machine  
**Priority:** Medium  
**Implementation Phase:** 4  

## Context Analysis

This task implements the comprehensive error handling and logging system that provides clear feedback and integrates seamlessly with the existing aisanity infrastructure. As the final task in Phase 4, it builds upon all previously implemented components (YAML parser, FSM engine, command executor, argument templating, confirmation system, and CLI integration) to create a unified error handling and reporting experience.

The error handling system must provide actionable error messages, proper exit codes for different failure scenarios, and maintain consistency with existing aisanity patterns while integrating with the custom Logger utilities. This is a critical cross-cutting concern that impacts user experience, debugging capabilities, and system reliability across all workflow components.

**Critical Design Challenge:** Creating a unified error handling system that spans multiple architectural layers (CLI, FSM, executor, parser) while maintaining clear separation of concerns and providing consistent user experience without retry mechanisms (per architectural decision).

## Technology Recommendations

### **IMPORTANT**: Leverage Existing Error Infrastructure
- **Technology**: Extend error classes from `src/workflow/errors.ts`
- **Rationale**: 
  - Task 100_1_10 already provides comprehensive workflow-specific error classes
  - Maintains consistency with existing error handling patterns
  - Avoids duplication of error handling logic
- **Impact**: Unified error experience across all workflow components

### **IMPORTANT**: Use Existing Logger Integration
- **Technology**: `Logger` class from `src/utils/logger.ts`
- **Rationale**: 
  - Already integrated across all workflow components
  - Supports silent/verbose modes required by CLI
  - Consistent output formatting with existing aisanity commands
- **Impact**: Seamless integration with existing logging infrastructure

### **IMPORTANT**: Exit Code Standardization
- **Technology**: Unix-style exit codes with workflow-specific mappings
- **Rationale**: 
  - Standard convention for CLI tools
  - Integrates with FSM engine's exit code-based transitions
  - Provides clear failure semantics for automation
- **Impact**: Predictable behavior for scripting and automation

### **IMPORTANT**: Error Context Enrichment
- **Technology**: Error wrapping with contextual information
- **Rationale**: 
  - Provides debugging context without exposing sensitive data
  - Maintains error chain for root cause analysis
  - Supports both technical and user-friendly error messages
- **Impact**: Enhanced debugging capabilities while maintaining security

## System Architecture

### Core Components

#### 1. WorkflowErrorHandler (Central Error Coordinator)
```typescript
class WorkflowErrorHandler {
  private logger: Logger;
  private exitCodeMapper: ExitCodeMapper;
  
  constructor(logger?: Logger);
  
  // Main error handling interface
  handleError(error: Error, context: ErrorContext): never;
  
  // Specialized handlers for different error types
  handleValidationError(error: WorkflowValidationError, context: ErrorContext): never;
  handleExecutionError(error: WorkflowExecutionError, context: ErrorContext): never;
  handleTransitionError(error: StateTransitionError, context: ErrorContext): never;
  handleCommandError(error: CommandExecutionError, context: ErrorContext): never;
  
  // Error reporting utilities
  formatErrorMessage(error: Error, context: ErrorContext): string;
  generateUserFriendlyMessage(error: Error, context: ErrorContext): string;
  logError(error: Error, context: ErrorContext): void;
}
```

**Responsibilities:**
- Central coordination of all error handling across workflow components
- Consistent error message formatting and user communication
- Exit code determination and process termination
- Integration with existing Logger for error reporting

#### 2. ExitCodeMapper (Exit Code Management)
```typescript
class ExitCodeMapper {
  // Standard exit codes for different failure scenarios
  static readonly SUCCESS = 0;
  static readonly GENERAL_ERROR = 1;
  static readonly VALIDATION_ERROR = 2;
  static readonly FILE_NOT_FOUND = 3;
  static readonly PERMISSION_DENIED = 4;
  static readonly TIMEOUT_ERROR = 124;  // Standard timeout exit code
  static readonly COMMAND_NOT_FOUND = 127;
  static readonly INVALID_ARGUMENT = 128;
  
  // Map error types to appropriate exit codes
  mapErrorToExitCode(error: Error): number;
  
  // Determine if error is user-correctable
  isUserCorrectable(error: Error): boolean;
  
  // Generate suggested actions for common errors
  getSuggestedAction(error: Error): string | null;
}
```

**Responsibilities:**
- Standardize exit codes across all workflow components
- Provide semantic meaning to different failure scenarios
- Enable automation and scripting based on exit codes
- Support error recovery suggestions

#### 3. ErrorContext (Context Information)
```typescript
interface ErrorContext {
  readonly component: 'parser' | 'fsm' | 'executor' | 'templater' | 'cli';
  readonly workflowName?: string;
  readonly stateName?: string;
  readonly command?: string;
  readonly operation: string;
  readonly userAction?: string;
  readonly additionalData?: Record<string, unknown>;
}

interface ErrorReport {
  readonly error: Error;
  readonly context: ErrorContext;
  readonly exitCode: number;
  readonly userMessage: string;
  readonly technicalMessage: string;
  readonly suggestedAction?: string;
  readonly timestamp: Date;
}
```

**Responsibilities:**
- Provide rich context for error debugging
- Maintain security by not exposing sensitive information
- Support both technical and user-friendly error reporting
- Enable error tracking and analysis

#### 4. ErrorReporter (User Communication)
```typescript
class ErrorReporter {
  private logger: Logger;
  private colorizer: ColorFormatter;
  
  constructor(logger: Logger);
  
  // Format and display errors to users
  reportError(report: ErrorReport): void;
  
  // Generate different message formats
  formatUserMessage(report: ErrorReport): string;
  formatTechnicalMessage(report: ErrorReport): string;
  formatVerboseMessage(report: ErrorReport): string;
  
  // Specialized reporting for different contexts
  reportValidationError(error: WorkflowValidationError, context: ErrorContext): void;
  reportExecutionError(error: WorkflowExecutionError, context: ErrorContext): void;
  reportTimeoutError(context: ErrorContext, timeout: number): void;
}
```

**Responsibilities:**
- Transform technical errors into actionable user messages
- Maintain consistent formatting with existing aisanity output
- Support different verbosity levels for different user needs
- Provide clear next steps for error resolution

### Component Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                WorkflowErrorHandler                         │
│  ┌────────────────────────────────────────────────────┐    │
│  │           Error Coordination Layer                 │    │
│  │  - handleError()                                  │    │
│  │  - formatErrorMessage()                           │    │
│  │  - logError()                                     │    │
│  └────────────────────────────────────────────────────┘    │
│                           │                                  │
│  ┌────────────────────────▼────────────────────────────┐   │
│  │              Component Integration                   │   │
│  │  - Parser Error Handling                           │   │
│  │  - FSM Error Handling                              │   │
│  │  - Executor Error Handling                         │   │
│  │  - CLI Error Handling                              │   │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────▼────────────────────────────┐   │
│  │              Supporting Infrastructure               │   │
│  │  - ExitCodeMapper                                  │   │
│  │  - ErrorReporter                                   │   │
│  │  - Logger Integration                              │   │
│  │  - Context Management                              │   │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
            │                              │
            │                              │
       ┌────▼────┐                   ┌─────▼─────┐
       │ Logger  │                   │ Components│
       │ (utils) │                   │ (errors)  │
       └─────────┘                   └───────────┘
```

### File Structure

```
src/
├── workflow/
│   ├── interfaces.ts          # [EXISTING] From task 100_1_10
│   ├── errors.ts              # [EXISTING] From task 100_1_10
│   ├── error-handler.ts       # [NEW] Main WorkflowErrorHandler class
│   ├── exit-code-mapper.ts    # [NEW] ExitCodeMapper class
│   ├── error-reporter.ts      # [NEW] ErrorReporter class
│   ├── error-context.ts       # [NEW] ErrorContext interfaces
│   └── index.ts               # [UPDATE] Export error handling classes
```

## Integration Patterns

### **IMPORTANT**: Integration with YAML Parser (Task 100_1_10)

**Pattern**: Error Enhancement and Context Addition
```typescript
import { WorkflowParser } from './parser';
import { WorkflowErrorHandler } from './error-handler';

class EnhancedWorkflowParser extends WorkflowParser {
  constructor(
    private errorHandler: WorkflowErrorHandler,
    logger?: Logger
  ) {
    super(logger);
  }
  
  loadWorkflows(workspacePath: string): WorkflowDefinitions {
    try {
      return super.loadWorkflows(workspacePath);
    } catch (error) {
      this.errorHandler.handleError(error, {
        component: 'parser',
        operation: 'loadWorkflows',
        workflowName: undefined,
        additionalData: { workspacePath }
      });
    }
  }
}
```

**Integration Points:**
- Enhance existing `WorkflowParseError` and `WorkflowValidationError` with context
- Provide actionable suggestions for YAML syntax errors
- Maintain line number and column information for debugging
- Add file path and workspace context to error reports

### **IMPORTANT**: Integration with FSM Engine (Task 100_1_20)

**Pattern**: State Transition Error Handling
```typescript
import { StateMachine } from './fsm';
import { WorkflowErrorHandler } from './error-handler';

class EnhancedStateMachine extends StateMachine {
  constructor(
    workflow: Workflow,
    private errorHandler: WorkflowErrorHandler,
    executor?: StateExecutionCoordinator,
    logger?: Logger
  ) {
    super(workflow, executor, logger);
  }
  
  async execute(): Promise<ExecutionResult> {
    try {
      return await super.execute();
    } catch (error) {
      this.errorHandler.handleError(error, {
        component: 'fsm',
        operation: 'execute',
        workflowName: this.workflow.name,
        stateName: this.getCurrentState(),
        userAction: 'Check workflow configuration and state definitions'
      });
    }
  }
  
  async executeState(stateName: string): Promise<StateExecutionResult> {
    try {
      return await super.executeState(stateName);
    } catch (error) {
      this.errorHandler.handleError(error, {
        component: 'fsm',
        operation: 'executeState',
        workflowName: this.workflow.name,
        stateName,
        userAction: 'Verify state exists and command is valid'
      });
    }
  }
}
```

**Integration Points:**
- Handle `StateTransitionError` with state context
- Provide workflow and state information in error reports
- Suggest workflow configuration fixes for common issues
- Maintain execution history for debugging failed transitions

### **IMPORTANT**: Integration with Command Executor (Task 100_2_10)

**Pattern**: Command Execution Error Handling
```typescript
import { CommandExecutor } from './executor';
import { WorkflowErrorHandler } from './error-handler';

class EnhancedCommandExecutor extends CommandExecutor {
  constructor(
    private errorHandler: WorkflowErrorHandler,
    logger?: Logger,
    defaultTimeout?: number
  ) {
    super(logger, defaultTimeout);
  }
  
  async executeCommand(
    command: string,
    args: string[],
    options: ExecutionOptions
  ): Promise<CommandResult> {
    try {
      return await super.executeCommand(command, args, options);
    } catch (error) {
      this.errorHandler.handleError(error, {
        component: 'executor',
        operation: 'executeCommand',
        command,
        additionalData: { args, options },
        userAction: 'Check command existence and permissions'
      });
    }
  }
}
```

**Integration Points:**
- Handle `CommandExecutionError` with command context
- Provide timeout-specific error messages and suggestions
- Include command arguments and options in error reports
- Suggest permission and path fixes for common command issues

### **IMPORTANT**: Integration with CLI Command (Task 100_3_20)

**Pattern**: Top-Level Error Handling and User Communication
```typescript
import { WorkflowErrorHandler } from './error-handler';

export const stateCommand = {
  command: 'state',
  describe: 'Manage workflow states',
  builder: (yargs: any) => {
    return yargs
      .command('execute <workflow> [state]', 'Execute a workflow state', executeCommand)
      .demandCommand(1, 'You need to specify a subcommand');
  },
  handler: (argv: any) => {
    // Top-level error handling for state command group
    const errorHandler = new WorkflowErrorHandler();
    
    try {
      // Command execution logic here
    } catch (error) {
      errorHandler.handleError(error, {
        component: 'cli',
        operation: 'stateCommand',
        userAction: 'Use --help for usage information'
      });
    }
  }
};

function executeCommand(argv: any) {
  const errorHandler = new WorkflowErrorHandler();
  
  try {
    // Execute workflow state logic
  } catch (error) {
    errorHandler.handleError(error, {
      component: 'cli',
      operation: 'executeState',
      workflowName: argv.workflow,
      stateName: argv.state,
      userAction: 'Check workflow name and state existence'
    });
  }
}
```

**Integration Points:**
- Top-level error handling for all CLI operations
- User-friendly error messages with actionable suggestions
- Consistent exit code handling for automation
- Integration with existing CLI error patterns

## Implementation Guidance

### Phase 1: Core Error Handling Infrastructure (Day 1)

1. **Implement ExitCodeMapper**
   ```typescript
   class ExitCodeMapper {
     static readonly EXIT_CODES = {
       SUCCESS: 0,
       GENERAL_ERROR: 1,
       VALIDATION_ERROR: 2,
       FILE_NOT_FOUND: 3,
       PERMISSION_DENIED: 4,
       TIMEOUT_ERROR: 124,
       COMMAND_NOT_FOUND: 127,
       INVALID_ARGUMENT: 128
     } as const;
     
     mapErrorToExitCode(error: Error): number {
       if (error instanceof WorkflowValidationError) {
         return this.EXIT_CODES.VALIDATION_ERROR;
       } else if (error instanceof WorkflowFileError) {
         return error.reason === 'permission' 
           ? this.EXIT_CODES.PERMISSION_DENIED 
           : this.EXIT_CODES.FILE_NOT_FOUND;
       } else if (error instanceof StateTransitionError) {
         return this.EXIT_CODES.GENERAL_ERROR;
       } else if (error instanceof WorkflowExecutionError) {
         return this.EXIT_CODES.GENERAL_ERROR;
       } else if (error.message.includes('timed out')) {
         return this.EXIT_CODES.TIMEOUT_ERROR;
       } else if (error.message.includes('not found')) {
         return this.EXIT_CODES.COMMAND_NOT_FOUND;
       }
       
       return this.EXIT_CODES.GENERAL_ERROR;
     }
     
     isUserCorrectable(error: Error): boolean {
       return error instanceof WorkflowValidationError ||
              error instanceof WorkflowFileError ||
              error.message.includes('permission') ||
              error.message.includes('not found');
     }
     
     getSuggestedAction(error: Error): string | null {
       if (error instanceof WorkflowValidationError) {
         return 'Check your .aisanity-workflows.yml file for syntax errors';
       } else if (error instanceof WorkflowFileError) {
         if (error.reason === 'missing') {
           return 'Create a .aisanity-workflows.yml file in your workspace';
         } else if (error.reason === 'permission') {
           return 'Check file permissions for .aisanity-workflows.yml';
         }
       } else if (error instanceof StateTransitionError) {
         return 'Verify state transitions in your workflow configuration';
       }
       
       return null;
     }
   }
   ```

2. **Create ErrorContext Interfaces**
   ```typescript
   interface ErrorContext {
     readonly component: 'parser' | 'fsm' | 'executor' | 'templater' | 'cli';
     readonly workflowName?: string;
     readonly stateName?: string;
     readonly command?: string;
     readonly operation: string;
     readonly userAction?: string;
     readonly additionalData?: Record<string, unknown>;
   }
   
   interface ErrorReport {
     readonly error: Error;
     readonly context: ErrorContext;
     readonly exitCode: number;
     readonly userMessage: string;
     readonly technicalMessage: string;
     readonly suggestedAction?: string;
     readonly timestamp: Date;
   }
   ```

3. **Implement Basic WorkflowErrorHandler**
   ```typescript
   class WorkflowErrorHandler {
     private exitCodeMapper: ExitCodeMapper;
     
     constructor(private logger?: Logger) {
       this.exitCodeMapper = new ExitCodeMapper();
     }
     
     handleError(error: Error, context: ErrorContext): never {
       const exitCode = this.exitCodeMapper.mapErrorToExitCode(error);
       const report = this.createErrorReport(error, context, exitCode);
       
       this.logError(report);
       this.displayError(report);
       
       process.exit(exitCode);
     }
     
     private createErrorReport(
       error: Error, 
       context: ErrorContext, 
       exitCode: number
     ): ErrorReport {
       return {
         error,
         context,
         exitCode,
         userMessage: this.generateUserMessage(error, context),
         technicalMessage: this.generateTechnicalMessage(error, context),
         suggestedAction: this.exitCodeMapper.getSuggestedAction(error),
         timestamp: new Date()
       };
     }
   }
   ```

### Phase 2: Error Reporting and User Communication (Day 1-2)

1. **Implement ErrorReporter**
   ```typescript
   class ErrorReporter {
     constructor(private logger: Logger) {}
     
     reportError(report: ErrorReport): void {
       const userMessage = this.formatUserMessage(report);
       const technicalMessage = this.formatTechnicalMessage(report);
       
       // Always show user message
       this.logger.error(userMessage);
       
       // Show technical details in verbose mode
       if (this.logger.verbose) {
         this.logger.debug(`Technical details: ${technicalMessage}`);
       }
       
       // Show suggested action if available
       if (report.suggestedAction) {
         this.logger.info(`Suggested action: ${report.suggestedAction}`);
       }
     }
     
     private formatUserMessage(report: ErrorReport): string {
       const { error, context } = report;
       
       if (error instanceof WorkflowValidationError) {
         return `Workflow validation failed: ${error.message}`;
       } else if (error instanceof StateTransitionError) {
         return `State transition failed in workflow '${context.workflowName}': ${error.message}`;
       } else if (error instanceof WorkflowExecutionError) {
         return `Workflow execution failed at state '${context.stateName}': ${error.message}`;
       } else if (error.message.includes('timed out')) {
         return `Operation timed out after ${context.additionalData?.timeout}ms`;
       } else {
         return `Error: ${error.message}`;
       }
     }
     
     private formatTechnicalMessage(report: ErrorReport): string {
       const { error, context } = report;
       
       let message = `${error.name}: ${error.message}`;
       message += ` (component: ${context.component}, operation: ${context.operation})`;
       
       if (context.workflowName) {
         message += `, workflow: ${context.workflowName}`;
       }
       
       if (context.stateName) {
         message += `, state: ${context.stateName}`;
       }
       
       if (error.stack) {
         message += `\nStack trace: ${error.stack}`;
       }
       
       return message;
     }
   }
   ```

2. **Add Specialized Error Handlers**
   ```typescript
   class WorkflowErrorHandler {
     handleValidationError(error: WorkflowValidationError, context: ErrorContext): never {
       const enhancedContext: ErrorContext = {
         ...context,
         userAction: 'Check your .aisanity-workflows.yml file for validation errors',
         additionalData: {
           ...context.additionalData,
           fieldPath: error.fieldPath,
           line: error.line
         }
       };
       
       this.handleError(error, enhancedContext);
     }
     
     handleExecutionError(error: WorkflowExecutionError, context: ErrorContext): never {
       const enhancedContext: ErrorContext = {
         ...context,
         userAction: 'Check command configuration and system requirements',
         additionalData: {
           ...context.additionalData,
           currentState: error.currentState,
           cause: error.cause?.message
         }
       };
       
       this.handleError(error, enhancedContext);
     }
     
     handleTimeoutError(context: ErrorContext, timeout: number): never {
       const error = new Error(`Operation timed out after ${timeout}ms`);
       const enhancedContext: ErrorContext = {
         ...context,
         userAction: 'Increase timeout configuration or optimize command performance',
         additionalData: {
           ...context.additionalData,
           timeout
         }
       };
       
       this.handleError(error, enhancedContext);
     }
   }
   ```

### Phase 3: Component Integration (Day 2-3)

1. **Enhance Existing Components with Error Handling**
   
   **YAML Parser Enhancement:**
   ```typescript
   // In parser.ts
   import { WorkflowErrorHandler } from './error-handler';
   
   export class WorkflowParser {
     constructor(
       private errorHandler?: WorkflowErrorHandler,
       private logger?: Logger
     ) {}
     
     loadWorkflows(workspacePath: string): WorkflowDefinitions {
       try {
         // Existing parsing logic
         return this.parseWorkflows(workspacePath);
       } catch (error) {
         if (this.errorHandler) {
           this.errorHandler.handleError(error, {
             component: 'parser',
             operation: 'loadWorkflows',
             additionalData: { workspacePath }
           });
         }
         throw error;
       }
     }
   }
   ```

   **FSM Engine Enhancement:**
   ```typescript
   // In fsm.ts
   import { WorkflowErrorHandler } from './error-handler';
   
   export class StateMachine {
     constructor(
       private workflow: Workflow,
       private executor?: StateExecutionCoordinator,
       private logger?: Logger,
       private errorHandler?: WorkflowErrorHandler
     ) {}
     
     async execute(): Promise<ExecutionResult> {
       try {
         // Existing execution logic
         return this.runWorkflow();
       } catch (error) {
         if (this.errorHandler) {
           this.errorHandler.handleError(error, {
             component: 'fsm',
             operation: 'execute',
             workflowName: this.workflow.name,
             stateName: this.getCurrentState()
           });
         }
         throw error;
       }
     }
   }
   ```

2. **CLI Integration with Top-Level Error Handling**
   ```typescript
   // In commands/state.ts
   import { WorkflowErrorHandler } from '../workflow/error-handler';
   
   export const stateCommand = {
     command: 'state',
     describe: 'Manage workflow states',
     builder: (yargs: any) => {
       return yargs
         .command('execute <workflow> [state]', 'Execute a workflow state', executeCommand)
         .demandCommand(1, 'You need to specify a subcommand');
     },
     handler: (argv: any) => {
       const errorHandler = new WorkflowErrorHandler();
       
       try {
         // Command routing logic
       } catch (error) {
         errorHandler.handleError(error, {
           component: 'cli',
           operation: 'stateCommand',
           userAction: 'Use --help for usage information'
         });
       }
     }
   };
   
   function executeCommand(argv: any) {
     const errorHandler = new WorkflowErrorHandler();
     
     try {
       // Execute workflow state with all components
       const logger = new Logger(argv.silent, argv.verbose);
       const workflowParser = new WorkflowParser(errorHandler, logger);
       const commandExecutor = new CommandExecutor(errorHandler, logger);
       const stateMachine = new StateMachine(
         workflow,
         commandExecutor,
         logger,
         errorHandler
       );
       
       // Execute workflow
       const result = await stateMachine.execute();
       
       // Handle successful execution
       if (result.success) {
         logger.info(`Workflow completed successfully`);
         process.exit(0);
       } else {
         logger.error(`Workflow failed at state: ${result.finalState}`);
         process.exit(1);
       }
       
     } catch (error) {
       errorHandler.handleError(error, {
         component: 'cli',
         operation: 'executeState',
         workflowName: argv.workflow,
         stateName: argv.state,
         userAction: 'Check workflow name and state existence'
       });
     }
   }
   ```

### Phase 4: Advanced Error Handling Features (Day 3)

1. **Error Recovery Suggestions**
   ```typescript
   class ErrorRecoveryAdvisor {
     static generateRecoverySteps(error: Error, context: ErrorContext): string[] {
       const steps: string[] = [];
       
       if (error instanceof WorkflowValidationError) {
         steps.push('1. Check .aisanity-workflows.yml syntax');
         steps.push('2. Verify all required fields are present');
         steps.push('3. Ensure state names match transition targets');
         
         if (error.fieldPath) {
           steps.push(`4. Check field: ${error.fieldPath}`);
         }
         
         if (error.line) {
           steps.push(`5. Review line ${error.line} in the YAML file`);
         }
       } else if (error instanceof StateTransitionError) {
         steps.push('1. Verify state exists in workflow definition');
         steps.push('2. Check transition configuration');
         steps.push('3. Review command execution permissions');
         
         if (context.workflowName) {
           steps.push(`4. Examine workflow: ${context.workflowName}`);
         }
       } else if (error.message.includes('timed out')) {
         steps.push('1. Increase timeout in workflow configuration');
         steps.push('2. Optimize command performance');
         steps.push('3. Check system resources');
       }
       
       return steps;
     }
   }
   ```

2. **Error Aggregation for Batch Operations**
   ```typescript
   interface ErrorAggregator {
     addError(error: Error, context: ErrorContext): void;
     hasErrors(): boolean;
     getErrorSummary(): string;
     getDetailedReport(): ErrorReport[];
   }
   
   class WorkflowErrorAggregator implements ErrorAggregator {
     private errors: ErrorReport[] = [];
     
     addError(error: Error, context: ErrorContext): void {
       const exitCodeMapper = new ExitCodeMapper();
       const exitCode = exitCodeMapper.mapErrorToExitCode(error);
       
       this.errors.push({
         error,
         context,
         exitCode,
         userMessage: this.generateUserMessage(error, context),
         technicalMessage: this.generateTechnicalMessage(error, context),
         suggestedAction: exitCodeMapper.getSuggestedAction(error),
         timestamp: new Date()
       });
     }
     
     hasErrors(): boolean {
       return this.errors.length > 0;
     }
     
     getErrorSummary(): string {
       if (this.errors.length === 0) {
         return 'No errors encountered';
       }
       
       const summary = `Encountered ${this.errors.length} error(s):`;
       const errorTypes = this.errors.map(e => e.error.constructor.name);
       const uniqueTypes = [...new Set(errorTypes)];
       
       return `${summary} ${uniqueTypes.join(', ')}`;
     }
     
     getDetailedReport(): ErrorReport[] {
       return [...this.errors];
     }
   }
   ```

### Critical Implementation Details

#### Error Message Strategy
```typescript
class ErrorMessageFormatter {
  static formatForUser(error: Error, context: ErrorContext): string {
    // User-friendly messages that focus on what went wrong and how to fix it
    const baseMessage = this.getBaseErrorMessage(error, context);
    const contextInfo = this.getContextualInfo(context);
    const suggestion = this.getSuggestion(error, context);
    
    let message = baseMessage;
    
    if (contextInfo) {
      message += `\nContext: ${contextInfo}`;
    }
    
    if (suggestion) {
      message += `\nSuggestion: ${suggestion}`;
    }
    
    return message;
  }
  
  static formatForTechnical(error: Error, context: ErrorContext): string {
    // Technical messages with full debugging information
    let message = `${error.name}: ${error.message}`;
    message += `\nComponent: ${context.component}`;
    message += `\nOperation: ${context.operation}`;
    
    if (context.workflowName) {
      message += `\nWorkflow: ${context.workflowName}`;
    }
    
    if (context.stateName) {
      message += `\nState: ${context.stateName}`;
    }
    
    if (error.stack) {
      message += `\nStack: ${error.stack}`;
    }
    
    return message;
  }
  
  private static getBaseErrorMessage(error: Error, context: ErrorContext): string {
    switch (context.component) {
      case 'parser':
        return `Failed to parse workflow configuration: ${error.message}`;
      case 'fsm':
        return `Workflow execution error: ${error.message}`;
      case 'executor':
        return `Command execution failed: ${error.message}`;
      case 'cli':
        return `Command line error: ${error.message}`;
      default:
        return `Error: ${error.message}`;
    }
  }
}
```

#### Exit Code Consistency
```typescript
class ExitCodeEnforcer {
  private static readonly WORKFLOW_EXIT_CODES = {
    // Success scenarios
    SUCCESS: 0,
    
    // User input errors
    INVALID_ARGUMENT: 2,
    WORKFLOW_NOT_FOUND: 3,
    STATE_NOT_FOUND: 4,
    
    // Configuration errors
    VALIDATION_ERROR: 10,
    PERMISSION_DENIED: 11,
    FILE_NOT_FOUND: 12,
    
    // Execution errors
    COMMAND_FAILED: 20,
    TIMEOUT_ERROR: 124,
    COMMAND_NOT_FOUND: 127,
    
    // System errors
    GENERAL_ERROR: 1,
    INTERNAL_ERROR: 125
  } as const;
  
  static ensureConsistentExit(error: Error, context: ErrorContext): number {
    // Map all errors to consistent exit codes
    if (error instanceof WorkflowValidationError) {
      return this.WORKFLOW_EXIT_CODES.VALIDATION_ERROR;
    } else if (error instanceof StateNotFoundError) {
      return this.WORKFLOW_EXIT_CODES.STATE_NOT_FOUND;
    } else if (error instanceof WorkflowFileError) {
      return error.reason === 'missing' 
        ? this.WORKFLOW_EXIT_CODES.FILE_NOT_FOUND
        : this.WORKFLOW_EXIT_CODES.PERMISSION_DENIED;
    } else if (error.message.includes('timed out')) {
      return this.WORKFLOW_EXIT_CODES.TIMEOUT_ERROR;
    } else if (error.message.includes('not found')) {
      return this.WORKFLOW_EXIT_CODES.COMMAND_NOT_FOUND;
    }
    
    return this.WORKFLOW_EXIT_CODES.GENERAL_ERROR;
  }
}
```

#### Security Considerations in Error Messages
```typescript
class ErrorSanitizer {
  static sanitizeForUser(error: Error, context: ErrorContext): string {
    let message = error.message;
    
    // Remove sensitive file paths
    message = message.replace(/\/home\/[^\/\s]+/g, '~/');
    message = message.replace(/\/Users\/[^\/\s]+/g, '~');
    
    // Remove environment variables
    message = message.replace(/\$[A-Z_]+/g, '$ENV_VAR');
    
    // Remove sensitive system information
    message = message.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, 'IP_ADDRESS');
    
    // Limit error message length to prevent information disclosure
    if (message.length > 500) {
      message = message.substring(0, 497) + '...';
    }
    
    return message;
  }
  
  static sanitizeForTechnical(error: Error): string {
    // Technical messages can include more detail but still sanitize sensitive data
    let message = error.message;
    
    // Remove passwords and tokens
    message = message.replace(/password["\s]*[:=]["\s]*[^"\\s]+/gi, 'password: [REDACTED]');
    message = message.replace(/token["\s]*[:=]["\s]*[^"\\s]+/gi, 'token: [REDACTED]');
    
    return message;
  }
}
```

### Testing Strategy

#### Unit Tests for Error Handling Components
```typescript
describe('WorkflowErrorHandler', () => {
  let errorHandler: WorkflowErrorHandler;
  let mockLogger: jest.Mocked<Logger>;
  
  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn()
    } as any;
    
    errorHandler = new WorkflowErrorHandler(mockLogger);
  });
  
  describe('handleError', () => {
    it('should exit with correct exit code for validation errors', () => {
      const error = new WorkflowValidationError('Invalid workflow', 'test-workflow');
      const context = { component: 'parser' as const, operation: 'validate' };
      
      expect(() => errorHandler.handleError(error, context)).toThrow();
      expect(process.exit).toHaveBeenCalledWith(2);
    });
    
    it('should log user-friendly error message', () => {
      const error = new WorkflowValidationError('Invalid workflow', 'test-workflow');
      const context = { component: 'parser' as const, operation: 'validate' };
      
      try {
        errorHandler.handleError(error, context);
      } catch (e) {
        // Expected to exit
      }
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Workflow validation failed')
      );
    });
  });
});

describe('ExitCodeMapper', () => {
  describe('mapErrorToExitCode', () => {
    it('should map validation errors to exit code 2', () => {
      const error = new WorkflowValidationError('Invalid', 'test');
      const exitCode = ExitCodeMapper.mapErrorToExitCode(error);
      expect(exitCode).toBe(2);
    });
    
    it('should map timeout errors to exit code 124', () => {
      const error = new Error('Command timed out after 5000ms');
      const exitCode = ExitCodeMapper.mapErrorToExitCode(error);
      expect(exitCode).toBe(124);
    });
  });
});
```

#### Integration Tests for Component Error Handling
```typescript
describe('Component Error Integration', () => {
  let errorHandler: WorkflowErrorHandler;
  let mockLogger: jest.Mocked<Logger>;
  
  beforeEach(() => {
    mockLogger = createMockLogger();
    errorHandler = new WorkflowErrorHandler(mockLogger);
  });
  
  describe('Parser Integration', () => {
    it('should handle YAML parsing errors with context', () => {
      const parser = new WorkflowParser(errorHandler, mockLogger);
      
      expect(() => {
        parser.loadWorkflows('/nonexistent/path');
      }).toThrow();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Workflow file not found')
      );
    });
  });
  
  describe('FSM Integration', () => {
    it('should handle state transition errors', async () => {
      const workflow = createTestWorkflow();
      const executor = new MockCommandExecutor(1); // Always fail
      const fsm = new StateMachine(workflow, executor, mockLogger, errorHandler);
      
      await expect(fsm.execute()).rejects.toThrow();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('State transition failed')
      );
    });
  });
});
```

#### End-to-End Error Scenario Tests
```typescript
describe('End-to-End Error Scenarios', () => {
  it('should handle complete workflow failure gracefully', async () => {
    // Test scenario: Invalid YAML -> Parser Error -> User Notification
    const invalidYaml = `
      workflows:
        test:
          name: "Test Workflow"
          # Missing required fields
    `;
    
    const tempFile = createTempFile(invalidYaml);
    
    try {
      await executeWorkflowCommand('test', {
        workspacePath: tempFile.dirname
      });
    } catch (error) {
      expect(error.exitCode).toBe(2);
      expect(error.message).toContain('validation failed');
    }
  });
  
  it('should handle command execution failures with suggestions', async () => {
    // Test scenario: Valid workflow -> Command failure -> Actionable error
    const workflowWithInvalidCommand = `
      workflows:
        test:
          name: "Test Workflow"
          initialState: "start"
          states:
            start:
              command: "nonexistent-command-12345"
              transitions: {}
    `;
    
    const tempFile = createTempFile(workflowWithInvalidCommand);
    
    try {
      await executeWorkflowCommand('test', {
        workspacePath: tempFile.dirname
      });
    } catch (error) {
      expect(error.exitCode).toBe(127);
      expect(error.message).toContain('command not found');
      expect(error.suggestion).toContain('Check command existence');
    }
  });
});
```

## Considerations

### Security

#### Error Message Sanitization
- Remove sensitive file paths and environment variables from user-facing messages
- Sanitize technical messages to prevent information disclosure
- Limit error message length to prevent buffer overflow attacks
- Validate error context data before inclusion in messages

#### Secure Error Logging
- Ensure sensitive data is not written to log files
- Implement log rotation to prevent disk space exhaustion
- Use appropriate log levels to avoid exposing sensitive information in verbose mode
- Validate all error context data before logging

#### Input Validation in Error Context
- Sanitize all user-provided data in error context
- Validate file paths to prevent path traversal disclosure
- Escape special characters in error messages to prevent injection
- Limit the size of additional data in error context

### Performance

#### Error Handling Overhead
- Minimize error handling overhead in success paths
- Use lazy error message formatting only when needed
- Cache error message templates to avoid repeated string operations
- Optimize error context creation to reduce object allocation

#### Memory Management
- Limit error history size to prevent memory leaks
- Clean up error context objects after reporting
- Use efficient string concatenation for error messages
- Implement proper cleanup in error aggregators

#### Fast Error Reporting
- Prioritize user-facing error messages over technical details
- Use synchronous error reporting for critical failures
- Implement fast exit paths for unrecoverable errors
- Minimize blocking operations in error handling

### Maintainability

#### Extensible Error Types
- Design error hierarchy to support future error types
- Use composition over inheritance for error context
- Implement error type registration for dynamic error handling
- Provide clear interfaces for custom error handlers

#### Consistent Error Patterns
- Establish consistent error message formats across components
- Use standard error context structure throughout the system
- Implement consistent exit code mappings
- Maintain error handling documentation and examples

#### Debugging Support
- Include sufficient technical information in verbose mode
- Provide error correlation IDs for tracking
- Implement error history for complex workflows
- Support error export for external analysis

### Usability

#### Actionable Error Messages
- Focus on what the user can do to fix the problem
- Provide step-by-step recovery instructions
- Include relevant context without overwhelming users
- Use clear, non-technical language when possible

#### Progressive Error Detail
- Show simple error messages by default
- Provide additional details in verbose mode
- Include technical information for debugging
- Offer help commands for common error scenarios

#### Error Recovery Guidance
- Suggest specific actions for common error types
- Provide links to documentation when available
- Include examples of correct configuration
- Offer workflow validation commands

This comprehensive error handling and logging architecture provides a robust foundation for the workflow state machine while maintaining consistency with existing aisanity patterns and ensuring a superior user experience through clear, actionable error reporting.