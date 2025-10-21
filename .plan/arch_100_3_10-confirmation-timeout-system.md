# Architectural Analysis: Confirmation Timeout System

**Task ID:** 100_3_10  
**Parent Feature:** 100 - Workflow State Machine  
**Priority:** Medium  
**Implementation Phase:** 3  

## Context Analysis

This task implements the user interaction layer that provides confirmation prompts with timeout management for the workflow state machine. The Confirmation Timeout System must integrate with the existing CommandExecutor (task 100_2_10) to provide interactive user prompts while maintaining the bash subprocess approach defined in the feature architecture.

The system serves as a critical bridge between automated workflow execution and user decision points, enabling workflows to pause for human confirmation while respecting timeout constraints and providing override capabilities through the `--yes` flag. This component directly impacts user experience by providing clear, responsive confirmation dialogs that integrate seamlessly with the existing aisanity CLI patterns.

**Critical Integration Challenge:** Implementing timeout-aware confirmation prompts that work reliably across different terminal environments while maintaining the bash subprocess pattern established in the feature architecture. The system must handle timeout enforcement, process cleanup, and provide clear progress indication without interfering with the workflow execution flow.

## Technology Recommendations

### **IMPORTANT**: Bash Subprocess Confirmation Pattern
- **Technology**: Extended bash subprocess with timeout support using `timeout` command
- **Rationale**: 
  - Consistent with feature architecture decision for bash subprocess TUI
  - Native timeout support through bash built-in `timeout` command
  - Reliable process cleanup and signal handling
  - Exit code-based results for FSM integration
- **Impact**: Maintains architectural consistency while adding timeout capabilities

### **IMPORTANT**: AbortController for Timeout Management
- **Technology**: AbortController + AbortSignal for timeout coordination
- **Rationale**: 
  - Standard JavaScript API for cancellation
  - Integration with existing CommandExecutor timeout patterns
  - Clean coordination between confirmation timeout and workflow timeout
  - Proper resource cleanup on cancellation
- **Impact**: Consistent timeout handling across the workflow system

### **IMPORTANT**: Progress Indication with Spinner
- **Technology**: Simple character-based spinner using bash subprocess
- **Rationale**: 
  - Lightweight progress indication without external dependencies
  - Compatible with bash subprocess approach
  - Non-blocking progress display during confirmation timeout
  - Clean terminal behavior without readline pollution
- **Impact**: Enhanced user experience with minimal overhead

### **IMPORTANT**: Integration with Existing Logger
- **Technology**: Logger from `src/utils/logger.ts` for confirmation logging
- **Rationale**: 
  - Consistent with existing aisanity patterns
  - Silent mode support for automated workflows
  - Verbose logging for debugging confirmation issues
  - Unified output formatting across commands
- **Impact**: Seamless integration with existing CLI experience

## System Architecture

### Core Components

#### 1. ConfirmationHandler (Main Implementation)
```typescript
class ConfirmationHandler {
  private logger: Logger;
  private executor: CommandExecutor;
  private defaultTimeout: number;
  
  constructor(
    executor: CommandExecutor,
    logger?: Logger,
    defaultTimeout?: number
  );
  
  // Main confirmation interface
  async requestConfirmation(
    message: string,
    options?: ConfirmationOptions
  ): Promise<ConfirmationResult>;
  
  // Specialized confirmation methods
  async confirmWithTimeout(
    message: string,
    timeoutMs: number,
    progressCallback?: (remaining: number) => void
  ): Promise<boolean>;
  
  async confirmWithOverride(
    message: string,
    yesFlag: boolean,
    timeoutMs?: number
  ): Promise<boolean>;
  
  // Progress indication
  private showProgressIndicator(
    timeoutMs: number,
    updateInterval: number = 1000
  ): Promise<void>;
  
  private buildTimeoutCommand(
    promptCommand: string,
    timeoutMs: number
  ): string;
}
```

**Responsibilities:**
- Execute confirmation prompts with timeout enforcement
- Handle `--yes` flag override for automated workflows
- Provide progress indication during confirmation timeout
- Integrate with existing logger for consistent output
- Clean resource management and process cleanup

#### 2. TimeoutManager (Timeout Coordination)
```typescript
class TimeoutManager {
  private abortController?: AbortController;
  private startTime?: number;
  private timeoutMs?: number;
  
  startTimeout(timeoutMs: number): AbortController;
  getRemainingTime(): number;
  isExpired(): boolean;
  cancel(): void;
  
  // Progress tracking
  getProgressPercentage(): number;
  onProgress(callback: (remaining: number, percentage: number) => void): void;
}
```

**Responsibilities:**
- Coordinate timeout enforcement across confirmation and workflow
- Provide progress tracking for user feedback
- Handle timeout cancellation and cleanup
- Integrate with existing AbortController patterns

#### 3. ProgressIndicator (User Feedback)
```typescript
class ProgressIndicator {
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;
  
  start(
    timeoutMs: number,
    message: string = 'Waiting for confirmation...',
    updateInterval: number = 1000
  ): void;
  
  stop(): void;
  update(remaining: number, total: number): void;
  
  private renderSpinner(frame: number): string;
  private formatTimeRemaining(ms: number): string;
}
```

**Responsibilities:**
- Display non-blocking progress indication during confirmation
- Show remaining time and spinner animation
- Clean terminal output without interference
- Handle terminal signal propagation

#### 4. ConfirmationBuilder (Prompt Construction)
```typescript
class ConfirmationBuilder {
  static buildTimedConfirmation(
    message: string,
    timeoutMs: number,
    defaultValue: boolean = false
  ): string;
  
  static buildProgressCommand(
    timeoutMs: number,
    updateInterval: number = 1000
  ): string;
  
  static escapePromptText(text: string): string;
  
  private static buildBasePrompt(message: string, defaultValue: boolean): string;
  private static wrapWithTimeout(command: string, timeoutMs: number): string;
}
```

**Responsibilities:**
- Generate safe bash commands for timed confirmations
- Handle shell argument escaping to prevent injection
- Integrate timeout command with confirmation prompt
- Ensure consistent prompt behavior across environments

### Component Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                ConfirmationHandler                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Main Confirmation Interface                       │    │
│  │  - requestConfirmation()                           │    │
│  │  - confirmWithTimeout()                            │    │
│  │  - confirmWithOverride()                           │    │
│  └────────────────────────────────────────────────────┘    │
│                           │                                  │
│  ┌────────────────────────▼────────────────────────────┐   │
│  │  Timeout Management Layer                           │   │
│  │  - TimeoutManager for coordination                 │   │
│  │  - AbortController integration                     │   │
│  │  - Progress tracking                               │   │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────▼────────────────────────────┐   │
│  │  User Interaction Layer                             │   │
│  │  - ProgressIndicator for feedback                  │   │
│  │  - ConfirmationBuilder for prompt generation       │   │
│  │  - Bash subprocess execution                       │   │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
            │                              │
            │                              │
       ┌────▼────┐                   ┌─────▼─────┐
       │ Logger  │                   │ Command   │
       │ (utils) │                   │ Executor  │
       └─────────┘                   └───────────┘
```

### File Structure

```
src/
├── workflow/
│   ├── interfaces.ts          # [EXISTING] From task 100_1_10
│   ├── fsm.ts                 # [EXISTING] From task 100_1_20
│   ├── executor.ts            # [EXISTING] From task 100_2_10
│   ├── confirmation-handler.ts # [NEW] Main ConfirmationHandler class
│   ├── timeout-manager.ts     # [NEW] TimeoutManager class
│   ├── progress-indicator.ts  # [NEW] ProgressIndicator class
│   ├── confirmation-builder.ts # [NEW] ConfirmationBuilder class
│   └── index.ts               # [UPDATE] Export confirmation classes
```

## Integration Patterns

### **IMPORTANT**: CommandExecutor Integration (Task 100_2_10)

**Pattern**: Composition and Delegation
```typescript
import { CommandExecutor } from './executor';

class ConfirmationHandler {
  constructor(
    private executor: CommandExecutor,
    private logger?: Logger,
    private defaultTimeout: number = 30000
  ) {}
  
  async requestConfirmation(
    message: string,
    options: ConfirmationOptions = {}
  ): Promise<ConfirmationResult> {
    // Handle --yes flag override
    if (options.yesFlag) {
      this.logger?.info(`Auto-confirmed: ${message}`);
      return { confirmed: true, method: 'override', duration: 0 };
    }
    
    // Use executor for bash subprocess execution
    const command = ConfirmationBuilder.buildTimedConfirmation(
      message,
      options.timeout || this.defaultTimeout,
      options.defaultResponse
    );
    
    const startTime = Date.now();
    
    try {
      const result = await this.executor.executeCommand('bash', ['-c', command], {
        timeout: options.timeout || this.defaultTimeout,
        stdin: 'inherit',
        stdout: 'inherit',
        stderr: 'inherit'
      });
      
      return {
        confirmed: result.exitCode === 0,
        method: 'user',
        duration: Date.now() - startTime
      };
    } catch (error) {
      // Handle timeout or other errors
      this.logger?.warn(`Confirmation failed: ${error}`);
      return {
        confirmed: options.defaultResponse || false,
        method: 'timeout',
        duration: Date.now() - startTime,
        error: error as Error
      };
    }
  }
}
```

**Integration Points:**
- Uses CommandExecutor for all bash subprocess execution
- Leverages existing timeout enforcement mechanisms
- Integrates with logger for consistent output formatting
- Maintains error handling patterns from executor

### **IMPORTANT**: FSM Engine Integration (Task 100_1_20)

**Pattern**: State Execution Enhancement
```typescript
// Extend FSM execution context to support confirmations
interface StateExecutionOptions extends ExecutionOptions {
  confirmation?: {
    message: string;
    timeout?: number;
    defaultResponse?: boolean;
  };
  yesFlag?: boolean; // Global --yes flag from CLI
}

class StateMachine {
  constructor(
    private workflow: Workflow,
    private executor: CommandExecutor,
    private confirmationHandler?: ConfirmationHandler,
    private logger?: Logger
  ) {}
  
  async executeState(stateName: string, options: StateExecutionOptions = {}): Promise<StateExecutionResult> {
    const state = this.workflow.states[stateName];
    
    // Handle confirmation before state execution
    if (state.confirmation && !options.yesFlag) {
      const confirmationResult = await this.confirmationHandler?.requestConfirmation(
        state.confirmation.message,
        {
          timeout: state.confirmation.timeout,
          defaultResponse: state.confirmation.defaultResponse,
          yesFlag: options.yesFlag
        }
      );
      
      if (!confirmationResult?.confirmed) {
        // User declined or timed out - route to failure transition
        return {
          stateName,
          exitCode: 1, // Treat as failure
          executedAt: new Date(),
          duration: 0,
          confirmationResult
        };
      }
    }
    
    // Continue with normal state execution
    return this.executeStateCommand(state, options);
  }
}
```

**Benefits:**
- Seamless integration with existing FSM execution flow
- Confirmation results become part of state execution context
- Timeout handling integrates with FSM transition logic
- Maintains exit code-based transition semantics

### **IMPORTANT**: Logger Integration

**Pattern**: Contextual Logging
```typescript
class ConfirmationHandler {
  constructor(
    private executor: CommandExecutor,
    private logger?: Logger
  ) {}
  
  async confirmWithTimeout(
    message: string,
    timeoutMs: number,
    progressCallback?: (remaining: number) => void
  ): Promise<boolean> {
    this.logger?.info(`Requesting confirmation: ${message}`);
    this.logger?.debug(`Confirmation timeout: ${timeoutMs}ms`);
    
    const timeoutManager = new TimeoutManager();
    const abortController = timeoutManager.startTimeout(timeoutMs);
    
    // Start progress indication
    const progressIndicator = new ProgressIndicator(this.logger);
    progressIndicator.start(timeoutMs, message);
    
    try {
      const result = await this.executeConfirmationWithTimeout(
        message,
        timeoutMs,
        abortController.signal
      );
      
      this.logger?.info(`Confirmation ${result ? 'accepted' : 'declined'}`);
      return result;
    } catch (error) {
      this.logger?.error(`Confirmation error: ${error}`);
      return false;
    } finally {
      progressIndicator.stop();
      timeoutManager.cancel();
    }
  }
}
```

**Benefits:**
- Consistent logging with existing aisanity commands
- Silent mode support for automated workflows
- Debug information for troubleshooting confirmation issues
- Clear audit trail of user interactions

### **IMPORTANT**: Timeout Coordination

**Pattern**: Hierarchical Timeout Management
```typescript
class TimeoutManager {
  private abortController?: AbortController;
  private parentTimeout?: number;
  private childTimeouts: Set<AbortController> = new Set();
  
  startTimeout(timeoutMs: number, parentSignal?: AbortSignal): AbortController {
    this.abortController = new AbortController();
    
    // Handle parent timeout (from workflow state)
    if (parentSignal) {
      parentSignal.addEventListener('abort', () => {
        this.cancel();
      });
    }
    
    // Handle local timeout
    if (timeoutMs > 0) {
      setTimeout(() => {
        this.abortController?.abort();
      }, timeoutMs);
    }
    
    return this.abortController;
  }
  
  createChildTimeout(timeoutMs: number): AbortController {
    const childController = new AbortController();
    this.childTimeouts.add(childController);
    
    // Propagate parent cancellation to children
    this.abortController?.signal.addEventListener('abort', () => {
      childController.abort();
    });
    
    return childController;
  }
  
  cancel(): void {
    this.abortController?.abort();
    // Cancel all child timeouts
    for (const child of this.childTimeouts) {
      child.abort();
    }
    this.childTimeouts.clear();
  }
}
```

**Benefits:**
- Coordinated timeout handling between workflow and confirmations
- Proper cleanup of all timeout resources
- Parent-child timeout relationships
- Integration with existing AbortController patterns

## Implementation Guidance

### Phase 1: Core Confirmation Handler (Day 1)

1. **Implement Basic ConfirmationHandler**
   ```typescript
   class ConfirmationHandler {
     async requestConfirmation(
       message: string,
       options: ConfirmationOptions = {}
     ): Promise<ConfirmationResult> {
       // Handle --yes override
       if (options.yesFlag) {
         return { confirmed: true, method: 'override', duration: 0 };
       }
       
       // Build confirmation command
       const command = ConfirmationBuilder.buildTimedConfirmation(
         message,
         options.timeout || 30000
       );
       
       // Execute via CommandExecutor
       const result = await this.executor.executeCommand('bash', ['-c', command], {
         timeout: options.timeout || 30000,
         stdin: 'inherit',
         stdout: 'inherit',
         stderr: 'inherit'
       });
       
       return {
         confirmed: result.exitCode === 0,
         method: 'user',
         duration: result.duration
       };
     }
   }
   ```

2. **Implement ConfirmationBuilder**
   ```typescript
   class ConfirmationBuilder {
     static buildTimedConfirmation(
       message: string,
       timeoutMs: number,
       defaultValue: boolean = false
     ): string {
       const basePrompt = this.buildBasePrompt(message, defaultValue);
       return this.wrapWithTimeout(basePrompt, timeoutMs);
     }
     
     private static wrapWithTimeout(command: string, timeoutMs: number): string {
       const timeoutSeconds = Math.ceil(timeoutMs / 1000);
       return `timeout ${timeoutSeconds} bash -c '${command}' || exit ${defaultValue ? '0' : '1'}`;
     }
     
     private static buildBasePrompt(message: string, defaultValue: boolean): string {
       const escapedMessage = this.escapePromptText(message);
       const defaultChar = defaultValue ? 'Y' : 'N';
       return `read -p "${escapedMessage} [${defaultChar}/y]: " -n 1 answer; echo; [[ "$answer" =~ ^[Yy]$ ]] && exit 0 || exit 1`;
     }
   }
   ```

3. **Add Basic Timeout Support**
   - Integrate with existing CommandExecutor timeout handling
   - Handle timeout errors gracefully
   - Provide default response on timeout

### Phase 2: Progress Indication (Day 1-2)

1. **Implement ProgressIndicator**
   ```typescript
   class ProgressIndicator {
     start(timeoutMs: number, message: string = 'Waiting for confirmation...'): void {
       this.isRunning = true;
       const startTime = Date.now();
       
       this.intervalId = setInterval(() => {
         if (!this.isRunning) return;
         
         const elapsed = Date.now() - startTime;
         const remaining = Math.max(0, timeoutMs - elapsed);
         
         if (remaining === 0) {
           this.stop();
           return;
         }
         
         const spinner = this.renderSpinner(Math.floor(elapsed / 200) % 4);
         const timeStr = this.formatTimeRemaining(remaining);
         
         // Use carriage return for inline updates
         process.stdout.write(`\r${spinner} ${message} (${timeStr} remaining)`);
       }, 1000);
     }
     
     stop(): void {
       this.isRunning = false;
       if (this.intervalId) {
         clearInterval(this.intervalId);
         this.intervalId = undefined;
       }
       // Clear the line
       process.stdout.write('\r' + ' '.repeat(process.stdout.columns || 80) + '\r');
     }
   }
   ```

2. **Integrate Progress with Confirmation**
   - Start progress indicator when confirmation begins
   - Stop indicator on user response or timeout
   - Handle terminal signal propagation
   - Ensure clean terminal state

3. **Add TimeoutManager**
   - Coordinate timeout between confirmation and progress
   - Provide remaining time calculations
   - Handle timeout cancellation and cleanup

### Phase 3: Advanced Features (Day 2)

1. **Implement Hierarchical Timeout Management**
   ```typescript
   class TimeoutManager {
     startTimeout(timeoutMs: number, parentSignal?: AbortSignal): AbortController {
       const controller = new AbortController();
       
       // Parent timeout propagation
       if (parentSignal?.aborted) {
         controller.abort();
         return controller;
       }
       
       parentSignal?.addEventListener('abort', () => {
         controller.abort();
       });
       
       // Local timeout
       if (timeoutMs > 0) {
         setTimeout(() => controller.abort(), timeoutMs);
       }
       
       return controller;
     }
   }
   ```

2. **Add Confirmation Result Tracking**
   ```typescript
   interface ConfirmationResult {
     confirmed: boolean;
     method: 'user' | 'override' | 'timeout' | 'error';
     duration: number;
     error?: Error;
     metadata?: Record<string, unknown>;
   }
   ```

3. **Enhanced Error Handling**
   - Handle terminal interruption (Ctrl+C)
   - Process cleanup on errors
   - Graceful degradation for unsupported terminals
   - Comprehensive error reporting

### Phase 4: Integration and Testing (Day 2-3)

1. **FSM Integration**
   - Integrate ConfirmationHandler with StateMachine
   - Add confirmation configuration to workflow states
   - Handle confirmation results in state transitions
   - Update execution context with confirmation data

2. **CLI Integration Preparation**
   - Support global `--yes` flag propagation
   - Integrate with existing CLI argument parsing
   - Add confirmation-specific CLI options
   - Ensure consistent help and usage information

3. **Comprehensive Testing**
   - Unit tests for all confirmation scenarios
   - Integration tests with FSM engine
   - Timeout behavior verification
   - Progress indication testing

### Critical Implementation Details

#### Bash Timeout Integration Strategy
```typescript
class ConfirmationBuilder {
  static buildTimedConfirmation(
    message: string,
    timeoutMs: number,
    defaultValue: boolean = false
  ): string {
    const basePrompt = this.buildBasePrompt(message, defaultValue);
    const timeoutSeconds = Math.ceil(timeoutMs / 1000);
    
    // Use bash timeout command with proper signal handling
    return `
      timeout ${timeoutSeconds} bash -c '
        ${basePrompt}
      ' || {
        # Handle timeout case
        exit_code=$?
        if [ $exit_code -eq 124 ]; then
          # Timeout occurred
          exit ${defaultValue ? '0' : '1'}
        else
          # Other error
          exit $exit_code
        fi
      }
    `.trim().replace(/\s+/g, ' ');
  }
}
```

#### Progress Indication Pattern
```typescript
class ProgressIndicator {
  private readonly spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  
  private renderSpinner(frame: number): string {
    return this.spinnerFrames[frame % this.spinnerFrames.length];
  }
  
  private formatTimeRemaining(ms: number): string {
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    }
  }
}
```

#### Timeout Coordination Pattern
```typescript
class ConfirmationHandler {
  async confirmWithTimeout(
    message: string,
    timeoutMs: number,
    parentSignal?: AbortSignal
  ): Promise<boolean> {
    const timeoutManager = new TimeoutManager();
    const abortController = timeoutManager.startTimeout(timeoutMs, parentSignal);
    
    const progressIndicator = new ProgressIndicator(this.logger);
    progressIndicator.start(timeoutMs, message);
    
    try {
      const command = ConfirmationBuilder.buildTimedConfirmation(message, timeoutMs);
      
      const result = await this.executor.executeCommand('bash', ['-c', command], {
        timeout: timeoutMs,
        signal: abortController.signal,
        stdin: 'inherit',
        stdout: 'inherit',
        stderr: 'inherit'
      });
      
      return result.exitCode === 0;
    } finally {
      progressIndicator.stop();
      timeoutManager.cancel();
    }
  }
}
```

### Testing Strategy

#### Unit Tests

1. **ConfirmationHandler Tests**
   - Basic confirmation with user input
   - `--yes` flag override behavior
   - Timeout handling and default responses
   - Error handling for various failure modes

2. **TimeoutManager Tests**
   - Timeout coordination and cancellation
   - Parent-child timeout relationships
   - Progress tracking accuracy
   - Resource cleanup verification

3. **ProgressIndicator Tests**
   - Spinner animation and updates
   - Time formatting and display
   - Terminal cleanup behavior
   - Signal handling

4. **ConfirmationBuilder Tests**
   - Bash command generation safety
   - Shell argument escaping
   - Timeout command wrapping
   - Injection prevention

#### Integration Tests

1. **FSM Integration Tests**
   ```typescript
   describe('FSM Confirmation Integration', () => {
     let fsm: StateMachine;
     let confirmationHandler: ConfirmationHandler;
     
     beforeEach(() => {
       const executor = new CommandExecutor();
       confirmationHandler = new ConfirmationHandler(executor);
       fsm = new StateMachine(testWorkflow, executor, confirmationHandler);
     });
     
     it('should pause for confirmation before state execution', async () => {
       // Mock user confirmation
       const result = await fsm.executeState('confirm-step', { yesFlag: false });
       expect(result.confirmationResult?.method).toBe('user');
     });
     
     it('should skip confirmation with --yes flag', async () => {
       const result = await fsm.executeState('confirm-step', { yesFlag: true });
       expect(result.confirmationResult?.method).toBe('override');
     });
   });
   ```

2. **Real Command Tests**
   - Test with actual bash confirmation prompts
   - Verify timeout behavior with real commands
   - Test progress indication in terminal
   - Validate signal handling

#### Mock Strategy for Testing

```typescript
class MockConfirmationHandler extends ConfirmationHandler {
  constructor(
    private mockResponses: Record<string, boolean> = {},
    executor: CommandExecutor,
    logger?: Logger
  ) {
    super(executor, logger);
  }
  
  async requestConfirmation(
    message: string,
    options?: ConfirmationOptions
  ): Promise<ConfirmationResult> {
    // Return predefined response for testing
    const confirmed = this.mockResponses[message] ?? options?.defaultResponse ?? false;
    
    return {
      confirmed,
      method: options?.yesFlag ? 'override' : 'user',
      duration: 100
    };
  }
}
```

### Security Considerations

#### Command Injection Prevention
```typescript
class ConfirmationBuilder {
  static escapePromptText(text: string): string {
    // Comprehensive shell escaping for confirmation messages
    return text
      .replace(/\\/g, '\\\\')   // Escape backslashes
      .replace(/'/g, "'\"'\"'") // Escape single quotes
      .replace(/"/g, '\\"')     // Escape double quotes
      .replace(/`/g, '\\`')     // Escape backticks
      .replace(/\$/g, '\\$')    // Escape dollar signs
      .replace(/\n/g, '\\n')    // Escape newlines
      .replace(/\r/g, '\\r');   // Escape carriage returns
  }
}
```

#### Timeout Enforcement
```typescript
class ConfirmationHandler {
  private validateTimeout(timeoutMs?: number): number {
    const maxTimeout = 5 * 60 * 1000; // 5 minutes maximum
    const minTimeout = 1000; // 1 second minimum
    
    if (!timeoutMs) {
      return this.defaultTimeout;
    }
    
    if (timeoutMs < minTimeout) {
      this.logger?.warn(`Timeout too short, using minimum: ${minTimeout}ms`);
      return minTimeout;
    }
    
    if (timeoutMs > maxTimeout) {
      this.logger?.warn(`Timeout too long, using maximum: ${maxTimeout}ms`);
      return maxTimeout;
    }
    
    return timeoutMs;
  }
}
```

#### Resource Limits
```typescript
class ConfirmationHandler {
  private readonly MAX_CONCURRENT_CONFIRMATIONS = 5;
  private activeConfirmations: Set<Promise<ConfirmationResult>> = new Set();
  
  async requestConfirmation(
    message: string,
    options?: ConfirmationOptions
  ): Promise<ConfirmationResult> {
    // Check concurrent confirmation limit
    if (this.activeConfirmations.size >= this.MAX_CONCURRENT_CONFIRMATIONS) {
      throw new Error('Too many concurrent confirmation requests');
    }
    
    const confirmationPromise = this.executeConfirmation(message, options);
    this.activeConfirmations.add(confirmationPromise);
    
    try {
      return await confirmationPromise;
    } finally {
      this.activeConfirmations.delete(confirmationPromise);
    }
  }
}
```

### Performance Targets

#### Response Time Budget
- Confirmation prompt display: <100ms
- Progress indicator updates: <50ms
- Timeout enforcement: <10ms overhead
- Resource cleanup: <5ms

#### Memory Usage Targets
- ConfirmationHandler instance: <2KB
- TimeoutManager per confirmation: <500B
- ProgressIndicator instance: <1KB
- Total overhead per confirmation: <5KB

#### Resource Efficiency
- Minimal bash subprocess overhead
- Efficient timeout management
- Clean resource cleanup
- Low CPU usage for progress indication

## Considerations

### Scalability

#### Concurrent Confirmations
- Support for multiple concurrent confirmation requests
- Resource limits to prevent system overload
- Efficient timeout coordination
- Clean isolation between confirmation instances

#### Workflow Complexity
- Handle complex workflows with multiple confirmation points
- Maintain performance with 50+ confirmation steps
- Scale memory usage linearly with confirmation count
- Support for long-running confirmation timeouts

#### Terminal Compatibility
- Support for various terminal types and capabilities
- Graceful degradation for limited terminals
- Consistent behavior across different environments
- Proper signal handling and cleanup

### Maintainability

#### Code Organization
- Clear separation between confirmation, timeout, and progress logic
- Single Responsibility Principle for all classes
- Comprehensive error handling with specific error types
- Extensive documentation and examples

#### Extensibility Points
- Pluggable progress indicators for different UI needs
- Configurable timeout policies
- Extensible confirmation prompt types
- Hook system for pre/post confirmation actions

#### Testing Strategy
- 100% unit test coverage for all confirmation paths
- Integration tests with real bash commands
- Performance benchmarks for timeout handling
- Security testing for injection prevention

### Security

#### Command Validation
- Comprehensive shell argument escaping
- Validation of confirmation message content
- Prevention of command injection through prompts
- Safe timeout command construction

#### Resource Protection
- Memory limits for confirmation operations
- Timeout enforcement to prevent hanging
- Concurrent confirmation limits
- Clean resource cleanup on errors

#### Isolation
- Separate execution contexts for confirmations
- No shared state between confirmation instances
- Clean environment for each confirmation
- Proper signal handling and cleanup

### Performance

#### Critical Path Optimization
- Minimal overhead for confirmation display
- Efficient timeout enforcement mechanisms
- Fast progress indication updates
- Quick resource cleanup

#### Memory Management
- Efficient timeout tracking
- Minimal object allocation during confirmation
- Proper cleanup of completed confirmations
- Configurable limits for resource usage

#### User Experience
- Responsive confirmation prompts
- Clear progress indication
- Fast timeout handling
- Clean terminal behavior

## Next Steps

### Immediate Actions (This Task)
1. Create `confirmation-handler.ts` with main ConfirmationHandler class
2. Implement `timeout-manager.ts` for timeout coordination
3. Build `progress-indicator.ts` for user feedback
4. Add `confirmation-builder.ts` for safe prompt generation
5. Create comprehensive unit and integration tests

### Future Integration Points (Phase 3+)
1. **Task 100_3_20** will integrate CLI command interface with confirmation system
2. **Task 100_4_10** will enhance error handling and logging for confirmations
3. **Task 100_4_20** will add comprehensive testing and documentation

### Dependencies
- **Consumes**: CommandExecutor from task 100_2_10
- **Consumes**: FSM engine interfaces from task 100_1_20
- **Consumes**: Workflow definitions from task 100_1_10
- **Integrates**: Logger from `src/utils/logger.ts`
- **Provides**: Confirmation capabilities for FSM engine and CLI

This architecture provides a robust, user-friendly confirmation system that seamlessly integrates with the existing workflow infrastructure while maintaining the bash subprocess approach and providing comprehensive timeout management and progress indication.