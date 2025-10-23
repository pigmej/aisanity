# Implementation Plan: Error Handling Logging

**Task ID:** 100_4_10  
**Parent Feature:** 100 - Workflow State Machine  
**Priority:** Medium  
**Implementation Phase:** 4  

## Implementation Overview

This implementation creates a comprehensive error handling and logging system that provides clear, actionable error messages while integrating seamlessly with the existing aisanity infrastructure. The system builds upon the existing error classes in `src/workflow/errors.ts` and the Logger utility in `src/utils/logger.ts` to create a unified error handling experience across all workflow components.

The implementation follows the architectural decision to avoid retry mechanisms and focuses on providing clear error reporting with proper exit codes for different failure scenarios. The system is designed to be lightweight, secure, and maintainable while providing excellent user experience through actionable error messages.

### Key Design Principles

1. **Leverage Existing Infrastructure**: Extend existing error classes and Logger utility rather than duplicating functionality
2. **Consistent Exit Codes**: Use Unix-style exit codes with workflow-specific semantic mappings
3. **Context-Rich Errors**: Provide debugging context without exposing sensitive information
4. **User-Friendly Messages**: Transform technical errors into actionable user guidance
5. **Security-First**: Sanitize error messages to prevent information disclosure
6. **Minimal Architecture**: Simple 2-component design for maintainability

### Performance Targets

- Error handling overhead: <5ms per error
- Memory footprint: <1KB for error context
- Startup impact: <10ms additional initialization time

## Component Details

### 1. WorkflowErrorHandler (Central Error Coordinator)

**File**: `src/workflow/error-handler.ts` (NEW)

The WorkflowErrorHandler serves as the central coordination point for all error handling across workflow components. It integrates with the existing Logger utility and provides consistent error reporting. **Important**: This class only handles error formatting and logging - process.exit() is only called at CLI boundary.

**Core Responsibilities:**
- Central coordination of error handling across all workflow components
- Consistent error message formatting and user communication
- Exit code determination (but not process termination)
- Integration with existing Logger for error reporting
- Error context enrichment and sanitization
- Built-in exit code mapping (merged from ExitCodeMapper)

**Key Methods:**
```typescript
class WorkflowErrorHandler {
  constructor(private logger?: Logger) {}
  
  // Enriches error with context and logs, then RE-THROWS
  enrichAndThrow(error: Error, context: ErrorContext): never;
  
  // Gets exit code for CLI boundary
  getExitCode(error: Error): number;
  
  // Specialized handlers for different error types
  handleValidationError(error: WorkflowValidationError, context: ErrorContext): never;
  handleExecutionError(error: WorkflowExecutionError, context: ErrorContext): never;
  handleTransitionError(error: StateTransitionError, context: ErrorContext): never;
  handleFileError(error: WorkflowFileError, context: ErrorContext): never;
  handleTimeoutError(context: ErrorContext, timeout: number): never;
  handleConfirmationError(context: ErrorContext, reason: string): never;
  handleSimulationError(error: Error, context: ErrorContext): never;
  
  // Exit code mapping (merged from ExitCodeMapper)
  private mapErrorToExitCode(error: Error): number;
  private isUserCorrectable(error: Error): boolean;
  private getSuggestedAction(error: Error): string | null;
  
  // Error reporting and formatting utilities
  private createErrorReport(error: Error, context: ErrorContext): ErrorReport;
  private logError(report: ErrorReport): void;
  private formatUserMessage(report: ErrorReport): string;
  private formatTechnicalMessage(report: ErrorReport): string;
}
```

### 2. ErrorContext (Context Information)

**File**: `src/workflow/error-context.ts` (NEW)

ErrorContext provides rich context for error debugging while maintaining security by not exposing sensitive information. It supports both technical and user-friendly error reporting.

**Interface Definitions:**
```typescript
interface ErrorContext {
  readonly component: 'parser' | 'fsm' | 'executor' | 'templater' | 'confirmation' | 'cli';
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

## Data Structures

### Error Context Hierarchy

The error handling system uses a simple context structure to provide rich debugging information:

```typescript
// Complete error report for logging and user display
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

### Error Type Mapping

The WorkflowErrorHandler maps existing error classes to appropriate handling strategies:

```typescript
type ErrorHandlingStrategy = {
  exitCode: number;
  userCorrectable: boolean;
  suggestedAction?: string;
};

const ERROR_STRATEGIES: Map<new (...args: any[]) => Error, ErrorHandlingStrategy> = new Map([
  [WorkflowValidationError, {
    exitCode: 2,
    userCorrectable: true,
    suggestedAction: 'Check your .aisanity-workflows.yml file for validation errors'
  }],
  [WorkflowFileError, {
    exitCode: 3, // or 4 for permission
    userCorrectable: true,
    suggestedAction: 'Check file permissions and existence'
  }],
  [WorkflowExecutionError, {
    exitCode: 1,
    userCorrectable: false,
    suggestedAction: 'Check command syntax and system requirements'
  }],
  [StateTransitionError, {
    exitCode: 1,
    userCorrectable: false,
    suggestedAction: 'Verify workflow state definitions and transitions'
  }],
  [CommandExecutionError, {
    exitCode: 1,
    userCorrectable: false,
    suggestedAction: 'Verify command syntax and system requirements'
  }],
  [ConfirmationTimeoutError, {
    exitCode: 124,
    userCorrectable: true,
    suggestedAction: 'Try running the workflow again or use --no-confirm to skip confirmations'
  }]
]);
```

### Exit Code Constants

```typescript
const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  VALIDATION_ERROR: 2,
  FILE_NOT_FOUND: 3,
  PERMISSION_DENIED: 4,
  TIMEOUT_ERROR: 124,  // Standard timeout exit code
  COMMAND_NOT_FOUND: 127,
  INVALID_ARGUMENT: 128
} as const;
```

## API Design

### Public API Surface

The error handling system provides a clean, minimal API that integrates seamlessly with existing components:

```typescript
// Main entry point for error handling
export class WorkflowErrorHandler {
  constructor(logger?: Logger);
  enrichAndThrow(error: Error, context: ErrorContext): never;
  getExitCode(error: Error): number;
}

// Context creation helpers
export function createErrorContext(
  component: ErrorContext['component'],
  operation: string,
  overrides?: Partial<ErrorContext>
): ErrorContext;

// Additional error classes (if needed)
export class CommandExecutionError extends Error {
  constructor(message: string, public readonly command: string, public readonly exitCode: number) {
    super(message);
    this.name = 'CommandExecutionError';
  }
}

export class ConfirmationTimeoutError extends Error {
  constructor(message: string, public readonly timeout: number) {
    super(message);
    this.name = 'ConfirmationTimeoutError';
  }
}
```

### Integration Pattern: Direct Modification

**IMPORTANT**: We will modify existing classes directly to accept optional errorHandler parameter, following the existing handleCommandError() pattern.

**Pattern: Optional Constructor Parameter**
```typescript
// Modified existing classes to accept optional errorHandler
class WorkflowParser {
  constructor(
    private logger?: Logger,
    private errorHandler?: WorkflowErrorHandler  // NEW: Optional parameter
  ) {}
  
  loadWorkflows(workspacePath: string): WorkflowDefinitions {
    try {
      return super.loadWorkflows(workspacePath);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.enrichAndThrow(error, {
          component: 'parser',
          operation: 'loadWorkflows',
          additionalData: { workspacePath }
        });
      }
      throw error; // Re-throw for CLI boundary handling
    }
  }
}

class StateMachine {
  constructor(
    workflow: Workflow,
    executor: CommandExecutor,
    logger?: Logger,
    errorHandler?: WorkflowErrorHandler  // NEW: Optional parameter
  ) {}
  
  async execute(): Promise<void> {
    try {
      // Existing execution logic
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.enrichAndThrow(error, {
          component: 'fsm',
          operation: 'execute',
          workflowName: this.workflow.name
        });
      }
      throw error; // Re-throw for CLI boundary handling
    }
  }
}
```

### CLI Boundary Integration

Only CLI commands will call process.exit(). Internal components throw errors:

```typescript
// In CLI command files (e.g., src/commands/run.ts)
export const runCommand = async (workflowName: string, options: RunOptions) => {
  const errorHandler = new WorkflowErrorHandler(logger);
  
  try {
    const parser = new WorkflowParser(logger, errorHandler);
    const executor = new CommandExecutor(logger, errorHandler);
    const fsm = new StateMachine(workflow, executor, logger, errorHandler);
    
    await fsm.execute();
  } catch (error) {
    // Only at CLI boundary do we exit the process
    const exitCode = errorHandler.getExitCode(error as Error);
    process.exit(exitCode);
  }
};
```

## File Modifications

### New Files to Create

1. **`src/workflow/error-handler.ts`** (NEW)
   - WorkflowErrorHandler class with merged exit code mapping
   - Error formatting and logging utilities
   - Integration with existing Logger

2. **`src/workflow/error-context.ts`** (NEW)
   - ErrorContext interface definition
   - ErrorReport interface definition
   - Context creation helper functions

### Existing Files to Modify

1. **`src/workflow/parser.ts`** (MODIFY)
   - Add optional `errorHandler?: WorkflowErrorHandler` parameter to constructor
   - Wrap parsing logic with error handling
   - Add context information to parsing errors

2. **`src/workflow/fsm.ts`** (MODIFY)
   - Add optional `errorHandler?: WorkflowErrorHandler` parameter to constructor
   - Wrap state transition logic with error handling
   - Add context information to transition errors

3. **`src/workflow/executor.ts`** (MODIFY)
   - Add optional `errorHandler?: WorkflowErrorHandler` parameter to constructor
   - Wrap command execution logic with error handling
   - Add timeout and command-specific error handling

4. **`src/workflow/argument-templater.ts`** (MODIFY)
    - Add optional `errorHandler?: WorkflowErrorHandler` parameter to constructor
    - Wrap templating logic with error handling
    - Add validation error context
    ```typescript
    class ArgumentTemplater {
      constructor(
        private logger?: Logger,
        private errorHandler?: WorkflowErrorHandler
      ) {}
      
      substituteArguments(template: string, context: ArgumentContext): string {
        try {
          return this.performSubstitution(template, context);
        } catch (error) {
          if (this.errorHandler) {
            this.errorHandler.enrichAndThrow(error, {
              component: 'templater',
              operation: 'substituteArguments',
              additionalData: { template, contextKeys: Object.keys(context) }
            });
          }
          throw error;
        }
      }
    }
    ```

5. **`src/workflow/confirmation-handler.ts`** (MODIFY)
    - Add optional `errorHandler?: WorkflowErrorHandler` parameter to constructor
    - Wrap confirmation logic with error handling
    - Add timeout and user interaction error context
    ```typescript
    class ConfirmationHandler {
      constructor(
        private logger?: Logger,
        private errorHandler?: WorkflowErrorHandler
      ) {}
      
      async requestConfirmation(message: string, timeout: number): Promise<boolean> {
        try {
          return await this.performConfirmation(message, timeout);
        } catch (error) {
          if (this.errorHandler) {
            if (error.message.includes('timeout')) {
              this.errorHandler.enrichAndThrow(
                new ConfirmationTimeoutError(`Confirmation timed out after ${timeout}s`, timeout),
                { component: 'confirmation', operation: 'requestConfirmation', userAction: 'user input' }
              );
            } else {
              this.errorHandler.enrichAndThrow(error, {
                component: 'confirmation',
                operation: 'requestConfirmation',
                userAction: 'user input'
              });
            }
          }
          throw error;
        }
      }
    }
    ```

6. **`src/commands/run.ts`** (MODIFY)
    - Add top-level error handling with process.exit()
    - Create WorkflowErrorHandler instance
    - Pass errorHandler to all workflow components

7. **`src/workflow/dry-run-simulator.ts`** (MODIFY)
    - Add optional `errorHandler?: WorkflowErrorHandler` parameter to constructor
    - Wrap dry-run simulation with error handling
    - Add simulation-specific error context
    ```typescript
    class DryRunSimulator {
      constructor(
        private logger?: Logger,
        private errorHandler?: WorkflowErrorHandler
      ) {}
      
      async simulateExecution(workflow: Workflow): Promise<SimulationResult> {
        try {
          return await this.performSimulation(workflow);
        } catch (error) {
          if (this.errorHandler) {
            this.errorHandler.enrichAndThrow(error, {
              component: 'simulator',
              operation: 'simulateExecution',
              workflowName: workflow.name,
              additionalData: { isDryRun: true }
            });
          }
          throw error;
        }
      }
    }
    ```

8. **`src/workflow/executor.ts`** (MODIFY)
    - Add optional `errorHandler?: WorkflowErrorHandler` parameter to constructor
    - Wrap command execution logic with error handling
    - Add timeout and command-specific error handling
    ```typescript
    class CommandExecutor {
      constructor(
        private logger?: Logger,
        private errorHandler?: WorkflowErrorHandler
      ) {}
      
      async executeCommand(command: string, options: ExecutionOptions): Promise<ExecutionResult> {
        try {
          return await this.performExecution(command, options);
        } catch (error) {
          if (this.errorHandler) {
            const exitCode = error.exitCode || 1;
            this.errorHandler.enrichAndThrow(
              new CommandExecutionError(`Command failed: ${command}`, command, exitCode),
              {
                component: 'executor',
                operation: 'executeCommand',
                command,
                additionalData: { exitCode, timeout: options.timeout }
              }
            );
          }
          throw error;
        }
      }
    }
    ```

### Integration Points

- **Confirmation Handler Integration**: Add error handling for timeout scenarios and user interaction failures
- **Dry-Run Integration**: Add error handling for simulation failures and validation errors
- **CLI Integration**: Ensure consistent error reporting and exit codes across all CLI commands

## Testing Strategy

### Unit Testing Approach

The testing strategy focuses on verifying error handling behavior, exit code mapping, and message formatting:

```typescript
describe('WorkflowErrorHandler', () => {
  let errorHandler: WorkflowErrorHandler;
  let mockLogger: jest.Mocked<Logger>;
  
  beforeEach(() => {
    mockLogger = createMockLogger();
    errorHandler = new WorkflowErrorHandler(mockLogger);
  });
  
  describe('enrichAndThrow', () => {
    it('should enrich and throw error with context', () => {
      const error = new WorkflowValidationError('Invalid workflow', 'test-workflow');
      const context = { component: 'parser' as const, operation: 'validate' };
      
      expect(() => errorHandler.enrichAndThrow(error, context)).toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Workflow validation failed')
      );
    });
  });
  
  describe('getExitCode', () => {
    it('should return correct exit code for validation errors', () => {
      const error = new WorkflowValidationError('Invalid workflow', 'test-workflow');
      
      const exitCode = errorHandler.getExitCode(error);
      expect(exitCode).toBe(2);
    });
    
    it('should return correct exit code for timeout errors', () => {
      const error = new ConfirmationTimeoutError('Confirmation timed out', 30);
      
      const exitCode = errorHandler.getExitCode(error);
      expect(exitCode).toBe(124);
    });
  });
});
```

### Integration Testing

Integration tests verify error handling across component boundaries:

```typescript
describe('Component Error Integration', () => {
  describe('Parser Integration', () => {
    it('should handle YAML parsing errors with context', () => {
      const errorHandler = new WorkflowErrorHandler();
      const parser = new WorkflowParser(errorHandler);
      
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
      const fsm = new StateMachine(workflow, executor, logger, errorHandler);
      
      await expect(fsm.execute()).rejects.toThrow();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('State transition failed')
      );
    });
  });
  
  describe('ArgumentTemplater Integration', () => {
    it('should handle template substitution errors', () => {
      const errorHandler = new WorkflowErrorHandler();
      const templater = new ArgumentTemplater(logger, errorHandler);
      
      expect(() => {
        templater.substituteArguments('Hello ${name}', {});
      }).toThrow();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Template substitution failed')
      );
    });
  });
  
  describe('ConfirmationHandler Integration', () => {
    it('should handle confirmation timeout errors', async () => {
      const errorHandler = new WorkflowErrorHandler();
      const handler = new ConfirmationHandler(logger, errorHandler);
      
      await expect(handler.requestConfirmation('Continue?', 0.001)).rejects.toThrow(
        ConfirmationTimeoutError
      );
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Confirmation timed out')
      );
    });
  });
  
  describe('DryRunSimulator Integration', () => {
    it('should handle simulation errors', async () => {
      const errorHandler = new WorkflowErrorHandler();
      const simulator = new DryRunSimulator(logger, errorHandler);
      const invalidWorkflow = { name: 'invalid', steps: null };
      
      await expect(simulator.simulateExecution(invalidWorkflow)).rejects.toThrow();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Simulation failed')
      );
    });
  });
  
  describe('CommandExecutor Integration', () => {
    it('should handle command execution errors', async () => {
      const errorHandler = new WorkflowErrorHandler();
      const executor = new CommandExecutor(logger, errorHandler);
      
      await expect(executor.executeCommand('nonexistent-command', {})).rejects.toThrow(
        CommandExecutionError
      );
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Command failed')
      );
    });
  });
});
```

### End-to-End Error Scenarios

E2E tests verify complete error handling workflows:

```typescript
describe('End-to-End Error Scenarios', () => {
  it('should handle complete workflow failure gracefully', async () => {
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
});
```

## Development Phases

### Phase 1: Core Infrastructure (Day 1)

**Objective**: Implement the foundational error handling components

**Tasks**:
1. **ErrorContext Interfaces**
   - Define ErrorContext interface
   - Create ErrorReport interface
   - Implement context creation helpers
   - Add context validation

2. **WorkflowErrorHandler Implementation**
   - Implement enrichAndThrow method (merged ExitCodeMapper functionality)
   - Add getExitCode method for CLI boundary
   - Add error report creation
   - Integrate with Logger utility
   - Add exit code mapping (internal, no process.exit())
   - Implement user and technical message formatting

3. **ErrorRecoveryAdvisor Implementation**
   - Move from Phase 4 to Phase 2 as "actionable information" is core requirement
   - Implement suggestion generation logic
   - Add error classification for user-correctable issues

**Deliverables**:
- `src/workflow/error-context.ts`
- `src/workflow/error-handler.ts` (complete implementation)

### Phase 2: Error Recovery and Actionable Information (Day 1-2)

**Objective**: Implement core error recovery and suggestion system

**Tasks**:
1. **ErrorRecoveryAdvisor Implementation**
   - Implement suggestion generation logic
   - Add error classification for user-correctable issues
   - Create actionable error message templates
   - Add context-aware suggestion mapping

2. **Confirmation Error Handling Details**
   - Specify how ConfirmationHandler timeout errors are caught
   - Define ConfirmationTimeoutError class
   - Add timeout-specific user messages
   - Implement confirmation failure recovery suggestions

3. **Dry-Run Error Handling**
   - Add handleSimulationError() method for dry-run failures
   - Specify different user messages for simulation vs. real execution
   - Add dry-run specific error context
   - Implement simulation failure recovery suggestions

**Deliverables**:
- ErrorRecoveryAdvisor with actionable suggestions
- ConfirmationTimeoutError class and handling
- Dry-run specific error handling methods
- Enhanced error message templates

### Phase 3: Component Integration (Day 2-3)

**Objective**: Integrate error handling with existing workflow components

**Tasks**:
1. **Parser Integration**
   - Enhance WorkflowParser with error handling
   - Add context to parsing errors
   - Include line/column information
   - Provide YAML-specific suggestions

2. **FSM Engine Integration**
   - Enhance StateMachine with error handling
   - Add state transition error context
   - Include workflow execution history
   - Provide state-specific suggestions

3. **Command Executor Integration**
   - Enhance CommandExecutor with error handling
   - Add command execution context
   - Include timeout-specific handling
   - Provide command-specific suggestions

4. **CLI Integration**
   - Add top-level error handling to CLI commands
   - Ensure consistent exit codes
   - Provide user-friendly CLI error messages
   - Include help suggestions

**Deliverables**:
- Enhanced existing components with error handling
- CLI command error integration
- Integration test coverage

### Phase 4: CLI Integration and Testing (Day 3-4)

**Objective**: Add CLI boundary error handling and complete testing

**Tasks**:
1. **CLI Integration**
   - Add top-level error handling to CLI commands
   - Ensure consistent exit codes at process boundary
   - Provide user-friendly CLI error messages
   - Include help suggestions

2. **Security and Performance**
   - Implement error message sanitization
   - Add performance optimizations to meet <5ms target
   - Include security validations
   - Optimize memory usage to <1KB target

3. **Complete Test Coverage**
   - Unit tests for WorkflowErrorHandler
   - Integration tests for all components
   - End-to-end error scenario tests
   - Performance benchmarks

4. **Documentation**
    - Add error handling documentation
    - Include usage examples
    - Create troubleshooting guide
    - Document error class hierarchy and usage patterns
    - Add integration examples for all components

5. **Implementation Checklist**
    - Define all error classes needed (CommandExecutionError, ConfirmationTimeoutError)
    - Verify exit code uniqueness across all error types
    - Test process.exit() is ONLY in CLI files
    - Validate enrichAndThrow() API consistency
    - Confirm ErrorRecoveryAdvisor integration
    - Verify resource cleanup handlers work correctly
    - Test sanitization strategies for user vs technical messages

**Deliverables**:
- CLI command error integration
- Complete test suite
- Documentation and examples
- Performance validation
- Implementation checklist verification
- Resource cleanup strategy documentation
- Error handling integration guide for all components

## Critical Implementation Details

### Resource Cleanup Strategy

The WorkflowErrorHandler implements graceful resource cleanup before error exit:

```typescript
class WorkflowErrorHandler {
  private cleanupHandlers: Array<() => Promise<void> | void> = [];
  
  // Register cleanup handlers for resources
  registerCleanupHandler(handler: () => Promise<void> | void): void {
    this.cleanupHandlers.push(handler);
  }
  
  // Execute cleanup before re-throwing error
  private async performCleanup(): Promise<void> {
    for (const handler of this.cleanupHandlers) {
      try {
        await handler();
      } catch (cleanupError) {
        // Log cleanup errors but don't mask original error
        this.logger?.warn('Cleanup handler failed:', cleanupError);
      }
    }
  }
  
  async enrichAndThrow(error: Error, context: ErrorContext): Promise<never> {
    try {
      await this.performCleanup();
    } finally {
      // Always re-throw original error
      const report = this.createErrorReport(error, context);
      this.logError(report);
      throw error;
    }
  }
}
```

### Error Message Strategy

The WorkflowErrorHandler implements a two-tier message strategy:

1. **User Messages**: Focus on what went wrong and how to fix it
2. **Technical Messages**: Provide full debugging information for verbose mode

```typescript
class WorkflowErrorHandler {
  private formatUserMessage(error: Error, context: ErrorContext): string {
    const baseMessage = this.getBaseErrorMessage(error, context);
    const suggestion = this.getSuggestedAction(error);
    
    let message = baseMessage;
    
    if (suggestion) {
      message += `\nSuggestion: ${suggestion}`;
    }
    
    return message;
  }
  
  private formatTechnicalMessage(error: Error, context: ErrorContext): string {
    let message = `${error.name}: ${error.message}`;
    message += `\nComponent: ${context.component}`;
    message += `\nOperation: ${context.operation}`;
    
    if (context.workflowName) {
      message += `\nWorkflow: ${context.workflowName}`;
    }
    
    if (error.stack) {
      message += `\nStack: ${error.stack}`;
    }
    
    return message;
  }
}
```

### Exit Code Mapping

The WorkflowErrorHandler ensures consistent exit codes across all components:

```typescript
class WorkflowErrorHandler {
  getExitCode(error: Error): number {
    if (error instanceof WorkflowValidationError) {
      return 2; // VALIDATION_ERROR
    } else if (error instanceof WorkflowFileError) {
      return error.reason === 'missing' ? 3 : 4; // FILE_NOT_FOUND or PERMISSION_DENIED
    } else if (error instanceof ConfirmationTimeoutError) {
      return 124; // TIMEOUT_ERROR
    } else if (error instanceof CommandExecutionError) {
      return error.exitCode || 1; // Use command's exit code or default
    } else if (error.message.includes('timed out')) {
      return 124; // TIMEOUT_ERROR
    }
    
    return 1; // GENERAL_ERROR
  }
}
```

### Security Considerations

The system implements comprehensive security measures with separate sanitization strategies:

```typescript
class WorkflowErrorHandler {
  private sanitizeUserMessage(message: string): string {
    // Remove sensitive file paths from user messages
    message = message.replace(/\/home\/[^\/\s]+/g, '~/');
    message = message.replace(/\/Users\/[^\/\s]+/g, '~');
    
    // Remove environment variables
    message = message.replace(/\$[A-Z_]+/g, '$ENV_VAR');
    
    // Remove sensitive system information
    message = message.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, 'IP_ADDRESS');
    
    // Limit error message length for user display
    if (message.length > 500) {
      message = message.substring(0, 497) + '...';
    }
    
    return message;
  }
  
  private sanitizeTechnicalMessage(message: string): string {
    // Less aggressive sanitization for technical/debug messages
    // Only remove truly sensitive data like passwords/tokens
    message = message.replace(/password[=:]\s*[^\s&]+/gi, 'password=***');
    message = message.replace(/token[=:]\s*[^\s&]+/gi, 'token=***');
    message = message.replace(/key[=:]\s*[^\s&]+/gi, 'key=***');
    
    return message;
  }
}
```

## Implementation Checklist

### Error Classes Required
- [ ] CommandExecutionError (extends Error directly)
- [ ] ConfirmationTimeoutError (extends Error directly)
- [ ] Verify existing error classes are sufficient

### Exit Code Uniqueness Verification
- [ ] Exit code 2: VALIDATION_ERROR (WorkflowValidationError)
- [ ] Exit code 3: FILE_NOT_FOUND (WorkflowFileError - missing)
- [ ] Exit code 4: PERMISSION_DENIED (WorkflowFileError - permission)
- [ ] Exit code 124: TIMEOUT_ERROR (ConfirmationTimeoutError, timeout messages)
- [ ] Exit code 127: COMMAND_NOT_FOUND (CommandExecutionError)
- [ ] Exit code 128: INVALID_ARGUMENT (validation errors)
- [ ] Exit code 1: GENERAL_ERROR (all other errors)

### API Consistency Verification
- [ ] enrichAndThrow() method implemented correctly
- [ ] getExitCode() method works for all error types
- [ ] ErrorRecoveryAdvisor integration complete
- [ ] handleSimulationError() method for dry-run failures
- [ ] Resource cleanup handlers registered and executed
- [ ] User vs technical message sanitization implemented

### Process.exit() Verification
- [ ] Confirm process.exit() is ONLY called in CLI files
- [ ] Verify internal components only throw errors
- [ ] Test CLI boundary error handling

### File Structure Clarification
- [ ] No separate exit-code-mapper.ts file (merged into WorkflowErrorHandler)
- [ ] No separate error-reporter.ts file (merged into WorkflowErrorHandler)
- [ ] Clean file structure with minimal components

This streamlined implementation plan provides a robust foundation for error handling and logging that integrates seamlessly with the existing aisanity infrastructure while providing clear, actionable error messages and maintaining security and performance standards. The plan addresses all critical feedback including proper error class hierarchy, resource cleanup strategy, comprehensive integration examples, and clear sanitization strategies for different message types.