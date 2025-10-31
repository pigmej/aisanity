# Architectural Analysis: Command Executor TUI

**Task ID:** 100_2_10  
**Parent Feature:** 100 - Workflow State Machine  
**Priority:** High  
**Implementation Phase:** 2  

## Context Analysis

This task implements the execution layer that bridges the FSM engine (task 100_1_20) with actual system commands. The CommandExecutor must handle both regular command execution and interactive TUI programs while maintaining clean terminal behavior and proper exit code capture.

The executor is a critical component that directly impacts user experience through process performance, error handling, and TUI interaction quality. It must integrate seamlessly with the FSM engine's `StateExecutionCoordinator` interface while leveraging Bun's native process management capabilities for optimal performance.

**Critical Design Challenge:** Balancing the need for interactive TUI support (which typically requires terminal control) with the requirement to prevent terminal pollution and maintain clean workflow execution. The architectural decision to use bash subprocess patterns for confirmations is key to solving this challenge.

## Technology Recommendations

### **IMPORTANT**: Bun Native Process Execution
- **Technology**: Bun's `$` and `Bun.spawn` APIs
- **Rationale**: 
  - Native runtime integration for optimal performance
  - Consistent with feature architecture requirements
  - Superior to Node.js child_process for Bun runtime
  - Built-in timeout and signal handling capabilities
- **Impact**: Maximum performance, reduced overhead, but Bun-specific implementation

### **IMPORTANT**: Bash Subprocess Pattern for TUI
- **Technology**: `bash -c 'read -p "Continue? [y/N]: " -n 1 answer; echo; [[ "$answer" =~ ^[Yy]$ ]] && exit 0 || exit 1'`
- **Rationale**: 
  - Avoids readline library terminal pollution
  - Provides clean, predictable TUI interactions
  - Standard bash pattern with wide compatibility
  - Exit code-based results for FSM integration
- **Impact**: Reliable TUI support but bash environment dependency

### **IMPORTANT**: Process Monitoring with AbortController
- **Technology**: AbortController + AbortSignal for timeout management
- **Rationale**: 
  - Native browser/Node.js API for cancellation
  - Clean integration with Bun.spawn
  - Standardized timeout handling pattern
  - Proper resource cleanup on cancellation
- **Impact**: Reliable timeout enforcement, clean process termination

### **IMPORTANT**: Stream Buffering for Output Capture
- **Technology**: Transform streams for stdout/stderr capture
- **Rationale**: 
  - Efficient memory usage for large outputs
  - Real-time output processing capability
  - Integration with existing logger utilities
  - Configurable output buffering strategies
- **Impact**: Memory-efficient output handling with logging integration

## System Architecture

### Core Components

#### 1. CommandExecutor (Main Implementation)
```typescript
class CommandExecutor implements StateExecutionCoordinator {
  private logger: Logger;
  private defaultTimeout: number;
  
  constructor(logger?: Logger, defaultTimeout?: number);
  
  // Main execution interface (implements StateExecutionCoordinator)
  async executeCommand(
    command: string,
    args: string[],
    options: ExecutionOptions
  ): Promise<CommandResult>;
  
  // Specialized TUI execution
  async executeTUICommand(
    prompt: string,
    timeout?: number
  ): Promise<CommandResult>;
  
  // Process management utilities
  private spawnProcess(
    command: string,
    args: string[],
    options: ProcessSpawnOptions
  ): Promise<ProcessHandle>;
  
  private enforceTimeout(
    process: ProcessHandle,
    timeoutMs: number
  ): AbortController;
}
```

**Responsibilities:**
- Execute system commands with proper exit code capture
- Handle interactive TUI programs via bash subprocess
- Enforce per-command timeout constraints
- Capture and route stdout/stderr appropriately
- Clean resource management and process cleanup

#### 2. ProcessHandle (Process Management)
```typescript
interface ProcessHandle {
  readonly process: Bun.Process;
  readonly abortController: AbortController;
  readonly startTime: number;
  readonly promise: Promise<ProcessResult>;
  
  kill(signal?: number): void;
  isRunning(): boolean;
  getDuration(): number;
}

interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  signal?: string;
}
```

**Responsibilities:**
- Wrap Bun.Process with additional metadata
- Provide unified interface for process monitoring
- Handle graceful and forceful termination
- Track execution timing and resource usage

#### 3. TUIPromptBuilder (Interactive Interface)
```typescript
class TUIPromptBuilder {
  static buildConfirmationPrompt(
    message: string,
    defaultValue: boolean = false
  ): string;
  
  static buildSelectionPrompt(
    message: string,
    options: string[],
    defaultIndex?: number
  ): string;
  
  static buildInputPrompt(
    message: string,
    defaultValue?: string
  ): string;
  
  private static escapeShellArgs(args: string[]): string;
}
```

**Responsibilities:**
- Generate safe bash subprocess commands for TUI interactions
- Handle shell argument escaping to prevent injection
- Support various prompt types (confirmation, selection, input)
- Ensure consistent prompt behavior across environments

#### 4. OutputBuffer (Stream Management)
```typescript
class OutputBuffer extends Transform {
  private chunks: Buffer[] = [];
  private maxSize: number;
  private encoding: BufferEncoding;
  
  constructor(maxSize: number = 1024 * 1024, encoding: BufferEncoding = 'utf8');
  
  _transform(chunk: Buffer, encoding: BufferEncoding, callback: Function): void;
  _flush(callback: Function): void;
  
  getContent(): string;
  getSize(): number;
  clear(): void;
  
  // Stream to logger integration
  pipeToLogger(logger: Logger, stream: 'stdout' | 'stderr'): void;
}
```

**Responsibilities:**
- Efficiently buffer process output streams
- Prevent memory exhaustion from large outputs
- Provide real-time logging integration
- Support configurable output capture strategies

### Component Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                  CommandExecutor                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  StateExecutionCoordinator Interface               │    │
│  │  - executeCommand()                               │    │
│  │  - executeTUICommand()                            │    │
│  └────────────────────────────────────────────────────┘    │
│                           │                                  │
│  ┌────────────────────────▼────────────────────────────┐   │
│  │  Process Management Layer                           │   │
│  │  - Bun.spawn() integration                         │   │
│  │  - AbortController timeout handling                │   │
│  │  - ProcessHandle wrapper                           │   │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────▼────────────────────────────┐   │
│  │  TUI & Output Handling                             │   │
│  │  - TUIPromptBuilder for interactive prompts        │   │
│  │  - OutputBuffer for stream capture                 │   │
│  │  - Logger integration for real-time output         │   │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
            │                              │
            │                              │
       ┌────▼────┐                   ┌─────▼─────┐
       │ Logger  │                   │ FSM Engine│
       │ (utils) │                   │ (consumer)│
       └─────────┘                   └───────────┘
```

### File Structure

```
src/
├── workflow/
│   ├── interfaces.ts          # [EXISTING] From task 100_1_10
│   ├── fsm.ts                 # [EXISTING] From task 100_1_20
│   ├── execution-context.ts  # [EXISTING] From task 100_1_20
│   ├── executor.ts            # [NEW] Main CommandExecutor class
│   ├── process-handle.ts     # [NEW] ProcessHandle and ProcessResult
│   ├── tui-prompt-builder.ts # [NEW] TUIPromptBuilder class
│   ├── output-buffer.ts      # [NEW] OutputBuffer stream class
│   └── index.ts               # [UPDATE] Export CommandExecutor
```

## Integration Patterns

### **IMPORTANT**: FSM Engine Integration (Task 100_1_20)

**Pattern**: Interface Implementation
```typescript
import { StateExecutionCoordinator, ExecutionOptions, CommandResult } from './execution-context';

class CommandExecutor implements StateExecutionCoordinator {
  async executeCommand(
    command: string,
    args: string[],
    options: ExecutionOptions
  ): Promise<CommandResult> {
    // Implementation using Bun.spawn
    const process = await this.spawnProcess(command, args, {
      timeout: options.timeout,
      cwd: options.cwd,
      env: options.env
    });
    
    const result = await process.promise;
    
    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      duration: result.duration
    };
  }
}
```

**Integration Points:**
- Implements `StateExecutionCoordinator` interface defined in FSM engine
- Consumes `ExecutionOptions` from FSM context
- Returns `CommandResult` compatible with FSM expectations
- Handles timeout enforcement per FSM requirements

### **IMPORTANT**: Logger Integration

**Pattern**: Real-time Output Streaming
```typescript
class CommandExecutor {
  constructor(private logger?: Logger) {}
  
  private async executeWithLogging(
    command: string,
    args: string[],
    options: ProcessSpawnOptions
  ): Promise<ProcessResult> {
    const stdoutBuffer = new OutputBuffer();
    const stderrBuffer = new OutputBuffer();
    
    // Pipe real-time output to logger if available
    if (this.logger) {
      stdoutBuffer.pipeToLogger(this.logger, 'stdout');
      stderrBuffer.pipeToLogger(this.logger, 'stderr');
    }
    
    const process = Bun.spawn([command, ...args], {
      stdout: stdoutBuffer,
      stderr: stderrBuffer,
      ...options
    });
    
    const result = await process.exited;
    
    return {
      exitCode: result,
      stdout: stdoutBuffer.getContent(),
      stderr: stderrBuffer.getContent(),
      duration: Date.now() - startTime
    };
  }
}
```

**Benefits:**
- Real-time output visibility during long-running commands
- Silent mode support through logger configuration
- Verbose debugging capabilities
- Consistent output formatting with existing aisanity commands

### **IMPORTANT**: TUI Confirmation Integration

**Pattern**: Bash Subprocess Execution
```typescript
class CommandExecutor {
  async executeTUICommand(
    prompt: string,
    timeout: number = 30000
  ): Promise<CommandResult> {
    const bashCommand = TUIPromptBuilder.buildConfirmationPrompt(prompt);
    
    return this.executeCommand('bash', ['-c', bashCommand], {
      timeout,
      // TUI commands should always use real terminal
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit'
    });
  }
}

class TUIPromptBuilder {
  static buildConfirmationPrompt(
    message: string,
    defaultValue: boolean = false
  ): string {
    const escapedMessage = this.escapeShellArg(message);
    const defaultChar = defaultValue ? 'Y' : 'N';
    
    return `read -p "${escapedMessage} [${defaultChar}/y]: " -n 1 answer; echo; [[ "$answer" =~ ^[Yy]$ ]] && exit 0 || exit 1`;
  }
  
  private static escapeShellArg(arg: string): string {
    // Simple shell escaping for safety
    return arg.replace(/'/g, "'\"'\"'");
  }
}
```

**Benefits:**
- Clean terminal interaction without readline pollution
- Exit code-based results for FSM integration
- Consistent prompt behavior across environments
- Safe argument handling to prevent injection

### **IMPORTANT**: Timeout and Resource Management

**Pattern**: AbortController Integration
```typescript
class CommandExecutor {
  private enforceTimeout(
    process: Bun.Process,
    timeoutMs: number
  ): { abortController: AbortController, promise: Promise<number> } {
    const abortController = new AbortController();
    const { signal } = abortController;
    
    const timeoutPromise = new Promise<number>((_, reject) => {
      const timeoutId = setTimeout(() => {
        abortController.abort();
        process.kill(9); // SIGKILL
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      
      signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
      });
    });
    
    const processPromise = process.exited;
    
    return {
      abortController,
      promise: Promise.race([processPromise, timeoutPromise])
    };
  }
}
```

**Benefits:**
- Reliable timeout enforcement
- Clean resource cleanup on cancellation
- Integration with Bun's signal handling
- Prevents hanging processes

## Implementation Guidance

### Phase 1: Core Command Execution (Day 1)

1. **Implement Basic CommandExecutor**
   ```typescript
   class CommandExecutor implements StateExecutionCoordinator {
     async executeCommand(
       command: string,
       args: string[],
       options: ExecutionOptions
     ): Promise<CommandResult> {
       const startTime = Date.now();
       
       const process = Bun.spawn([command, ...args], {
         cwd: options.cwd,
         env: { ...process.env, ...options.env },
         stdout: 'pipe',
         stderr: 'pipe'
       });
       
       const exitCode = await process.exited;
       const duration = Date.now() - startTime;
       
       return {
         exitCode,
         stdout: '', // Will implement in Phase 2
         stderr: '', // Will implement in Phase 2
         duration
       };
     }
   }
   ```

2. **Add ProcessHandle Wrapper**
   - Create ProcessHandle interface and implementation
   - Add process monitoring capabilities
   - Implement graceful termination methods

3. **Basic Timeout Handling**
   - Implement AbortController pattern
   - Add timeout enforcement to executeCommand
   - Handle timeout errors appropriately

### Phase 2: Output Capture and Logging (Day 1-2)

1. **Implement OutputBuffer Stream**
   ```typescript
   class OutputBuffer extends Transform {
     private chunks: Buffer[] = [];
     
     _transform(chunk: Buffer, encoding: BufferEncoding, callback: Function): void {
       this.chunks.push(chunk);
       this.push(chunk); // Pass through for real-time processing
       callback();
     }
     
     getContent(): string {
       return Buffer.concat(this.chunks).toString();
     }
   }
   ```

2. **Integrate with Logger**
   - Add real-time output streaming to logger
   - Support silent/verbose modes
   - Handle large output buffering efficiently

3. **Enhanced Process Execution**
   - Integrate OutputBuffer into command execution
   - Capture both stdout and stderr separately
   - Add output size limits to prevent memory issues

### Phase 3: TUI Support (Day 2)

1. **Implement TUIPromptBuilder**
   ```typescript
   class TUIPromptBuilder {
     static buildConfirmationPrompt(message: string): string {
       const escaped = this.escapeShellArg(message);
       return `read -p "${escaped} [y/N]: " -n 1 answer; echo; [[ "$answer" =~ ^[Yy]$ ]] && exit 0 || exit 1`;
     }
     
     static buildSelectionPrompt(message: string, options: string[]): string {
       const escapedMessage = this.escapeShellArg(message);
       const escapedOptions = options.map(opt => this.escapeShellArg(opt));
       // Build select menu using bash select command
       return `select opt in ${escapedOptions.join(' ')}; do [ "$opt" ] && break; done; echo "$opt"`;
     }
     
     private static escapeShellArg(arg: string): string {
       return `'${arg.replace(/'/g, "'\"'\"'")}'`;
     }
   }
   ```

2. **Add TUI Execution Methods**
   - Implement `executeTUICommand()` method
   - Handle terminal inheritance for interactive programs
   - Support various prompt types (confirmation, selection, input)

3. **Terminal Management**
   - Ensure clean terminal state before/after TUI commands
   - Handle terminal signal propagation
   - Maintain terminal buffer cleanliness

### Phase 4: Error Handling and Cleanup (Day 2-3)

1. **Comprehensive Error Handling**
   ```typescript
   class CommandExecutor {
     private async executeWithErrorHandling(
       command: string,
       args: string[],
       options: ExecutionOptions
     ): Promise<CommandResult> {
       try {
         return await this.executeCommand(command, args, options);
       } catch (error) {
         if (error instanceof Error) {
           if (error.message.includes('ENOENT')) {
             throw new CommandExecutionError(
               `Command not found: ${command}`,
               command,
               args,
               'COMMAND_NOT_FOUND'
             );
           } else if (error.message.includes('timed out')) {
             throw new CommandExecutionError(
               `Command timed out: ${command}`,
               command,
               args,
               'TIMEOUT'
             );
           }
         }
         
         throw new CommandExecutionError(
           `Command execution failed: ${error}`,
           command,
           args,
           'UNKNOWN_ERROR',
           error as Error
         );
       }
     }
   }
   ```

2. **Resource Cleanup**
   - Ensure all processes are properly terminated
   - Clean up AbortController instances
   - Release file descriptors and stream resources

3. **Signal Handling**
   - Handle SIGINT/SIGTERM propagation
   - Graceful shutdown of running processes
   - Cleanup on unexpected termination

### Critical Implementation Details

#### Bun.spawn Integration Strategy
```typescript
interface ProcessSpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  stdin?: 'pipe' | 'inherit' | 'ignore';
  stdout?: 'pipe' | 'inherit' | 'ignore';
  stderr?: 'pipe' | 'inherit' | 'ignore';
}

class CommandExecutor {
  private async spawnProcess(
    command: string,
    args: string[],
    options: ProcessSpawnOptions
  ): Promise<ProcessHandle> {
    const startTime = Date.now();
    
    const process = Bun.spawn([command, ...args], {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
      stdin: options.stdin || 'pipe',
      stdout: options.stdout || 'pipe',
      stderr: options.stderr || 'pipe'
    });
    
    const abortController = new AbortController();
    
    // Apply timeout if specified
    if (options.timeout) {
      this.enforceTimeout(process, options.timeout, abortController);
    }
    
    const promise = process.exited.then(exitCode => ({
      exitCode,
      stdout: '', // Will be populated by OutputBuffer
      stderr: '', // Will be populated by OutputBuffer
      duration: Date.now() - startTime
    }));
    
    return new ProcessHandle(process, abortController, startTime, promise);
  }
}
```

#### TUI Execution Pattern
```typescript
class CommandExecutor {
  async executeConfirmation(
    message: string,
    timeout: number = 30000
  ): Promise<boolean> {
    const bashCommand = TUIPromptBuilder.buildConfirmationPrompt(message);
    
    try {
      const result = await this.executeCommand('bash', ['-c', bashCommand], {
        timeout,
        stdin: 'inherit',
        stdout: 'inherit',
        stderr: 'inherit'
      });
      
      return result.exitCode === 0;
    } catch (error) {
      // On timeout or error, default to false for safety
      this.logger?.warn(`Confirmation prompt failed: ${error}`);
      return false;
    }
  }
}
```

#### Performance Optimization Techniques

1. **Stream Buffering Strategy**
   ```typescript
   class OutputBuffer extends Transform {
     private maxSize: number;
     private currentSize: number = 0;
     
     constructor(maxSize: number = 1024 * 1024) { // 1MB default
       super();
       this.maxSize = maxSize;
     }
     
     _transform(chunk: Buffer, encoding: BufferEncoding, callback: Function): void {
       if (this.currentSize + chunk.length > this.maxSize) {
         // Truncate old content to stay within limits
         const excess = (this.currentSize + chunk.length) - this.maxSize;
         this.chunks.shift(); // Remove oldest chunk
         this.currentSize -= this.chunks[0]?.length || 0;
       }
       
       this.chunks.push(chunk);
       this.currentSize += chunk.length;
       this.push(chunk);
       callback();
     }
   }
   ```

2. **Process Pool for Repeated Commands**
   ```typescript
   class ProcessPool {
     private pools: Map<string, Bun.Process[]> = new Map();
     
     async getProcess(command: string): Promise<Bun.Process> {
       const pool = this.pools.get(command) || [];
       
       // Reuse existing process if available
       const existingProcess = pool.find(p => !p.killed);
       if (existingProcess) {
         return existingProcess;
       }
       
       // Create new process
       const process = Bun.spawn([command], {
         stdout: 'pipe',
         stderr: 'pipe'
       });
       
       pool.push(process);
       this.pools.set(command, pool);
       
       return process;
     }
   }
   ```

### Testing Strategy

#### Unit Tests (Test Each Component Independently)

1. **CommandExecutor Tests**
   - Basic command execution with various exit codes
   - Timeout enforcement and cancellation
   - Error handling for missing commands
   - TUI prompt execution and parsing

2. **ProcessHandle Tests**
   - Process lifecycle management
   - Graceful and forceful termination
   - Duration tracking accuracy
   - Signal handling

3. **TUIPromptBuilder Tests**
   - Shell argument escaping safety
   - Prompt generation for various types
   - Injection prevention
   - Output format consistency

4. **OutputBuffer Tests**
   - Stream transformation accuracy
   - Memory usage with large outputs
   - Real-time logging integration
   - Size limit enforcement

#### Integration Tests

1. **FSM Integration Tests**
   ```typescript
   describe('FSM Integration', () => {
     let fsm: StateMachine;
     let executor: CommandExecutor;
     
     beforeEach(() => {
       executor = new CommandExecutor();
       fsm = new StateMachine(testWorkflow, executor);
     });
     
     it('should execute workflow states correctly', async () => {
       const result = await fsm.execute();
       expect(result.success).toBe(true);
       expect(result.stateHistory).toHaveLength(3);
     });
     
     it('should handle TUI confirmations', async () => {
       // Mock bash confirmation to return 'y'
       const result = await fsm.executeState('confirm-step');
       expect(result.exitCode).toBe(0);
     });
   });
   ```

2. **Real Command Tests**
   - Execute actual system commands
   - Test with long-running processes
   - Verify timeout behavior
   - Test TUI interactions with real prompts

#### Mock Strategy for Testing

```typescript
// Mock Bun.spawn for controlled testing
const mockSpawn = jest.fn();
global.Bun = { spawn: mockSpawn } as any;

class MockCommandExecutor extends CommandExecutor {
  protected override async spawnProcess(
    command: string,
    args: string[],
    options: ProcessSpawnOptions
  ): Promise<ProcessHandle> {
    // Return mock process for testing
    const mockProcess = {
      exited: Promise.resolve(0),
      kill: jest.fn(),
      killed: false
    } as any;
    
    return new ProcessHandle(
      mockProcess,
      new AbortController(),
      Date.now(),
      Promise.resolve({
        exitCode: 0,
        stdout: 'mock output',
        stderr: '',
        duration: 100
      })
    );
  }
}
```

### Security Considerations

#### Command Injection Prevention
```typescript
class CommandExecutor {
  private validateCommand(command: string, args: string[]): void {
    // Allow only safe command patterns
    const allowedCommands = [
      /^git$/, /^npm$/, /^bun$/, /^node$/,
      /^docker$/, /^bash$/, /^sh$/, /^echo$/,
      /^test$/, /^cat$/, /^ls$/, /^pwd$/
    ];
    
    const isAllowed = allowedCommands.some(pattern => pattern.test(command));
    if (!isAllowed) {
      throw new CommandExecutionError(
        `Command not allowed: ${command}`,
        command,
        args,
        'COMMAND_NOT_ALLOWED'
      );
    }
    
    // Validate arguments for injection patterns
    for (const arg of args) {
      if (this.containsInjectionPatterns(arg)) {
        throw new CommandExecutionError(
          `Argument contains injection patterns: ${arg}`,
          command,
          args,
          'INJECTION_DETECTED'
        );
      }
    }
  }
  
  private containsInjectionPatterns(arg: string): boolean {
    const dangerousPatterns = [
      /[;&|`$(){}[\]]/, // Shell metacharacters
      /\.\./,           // Path traversal
      /\/etc\//,        // System file access
      />|<|>>|<</       // Redirection operators
    ];
    
    return dangerousPatterns.some(pattern => pattern.test(arg));
  }
}
```

#### Path Traversal Protection
```typescript
class CommandExecutor {
  private validateWorkingDirectory(cwd?: string): string {
    if (!cwd) {
      return process.cwd();
    }
    
    const resolvedPath = path.resolve(cwd);
    const workspaceRoot = process.cwd();
    
    // Ensure CWD is within workspace
    if (!resolvedPath.startsWith(workspaceRoot)) {
      throw new CommandExecutionError(
        `Working directory outside workspace: ${resolvedPath}`,
        '',
        [],
        'PATH_TRAVERSAL'
      );
    }
    
    return resolvedPath;
  }
}
```

#### Resource Limits
```typescript
class CommandExecutor {
  private readonly MAX_OUTPUT_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly MAX_EXECUTION_TIME = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CONCURRENT_PROCESSES = 10;
  
  private activeProcesses: Set<ProcessHandle> = new Set();
  
  private async executeWithLimits(
    command: string,
    args: string[],
    options: ExecutionOptions
  ): Promise<CommandResult> {
    // Check concurrent process limit
    if (this.activeProcesses.size >= this.MAX_CONCURRENT_PROCESSES) {
      throw new CommandExecutionError(
        'Too many concurrent processes',
        command,
        args,
        'RESOURCE_LIMIT'
      );
    }
    
    // Enforce maximum timeout
    const timeout = Math.min(
      options.timeout || this.MAX_EXECUTION_TIME,
      this.MAX_EXECUTION_TIME
    );
    
    // Execute with limits
    const process = await this.spawnProcess(command, args, {
      ...options,
      timeout
    });
    
    this.activeProcesses.add(process);
    
    try {
      const result = await process.promise;
      return result;
    } finally {
      this.activeProcesses.delete(process);
    }
  }
}
```

### Performance Targets

#### Execution Time Budget
- Simple command execution: <100ms overhead
- TUI prompt execution: <50ms overhead
- Process spawning: <10ms
- Timeout enforcement: <1ms overhead
- Output capture: <5ms per MB of output

#### Memory Usage Targets
- CommandExecutor instance: <1KB
- ProcessHandle per process: <100B
- OutputBuffer per command: <1MB (configurable)
- Total executor overhead: <5MB with 10 concurrent processes

#### Resource Efficiency
- Process reuse for repeated commands (where safe)
- Stream buffering to prevent memory spikes
- Lazy output capture only when needed
- Efficient cleanup of completed processes

## Considerations

### Scalability

#### Concurrent Execution
- Support for multiple concurrent command executions
- Resource limits to prevent system overload
- Efficient process pool management
- Clean isolation between command executions

#### Large Output Handling
- Streaming output capture to prevent memory issues
- Configurable output size limits
- Real-time logging for long-running processes
- Efficient buffer management and cleanup

#### Workflow Complexity
- Handle complex multi-step workflows efficiently
- Maintain performance with 50+ state workflows
- Scale memory usage linearly with workflow size
- Support for long-running workflow executions

### Maintainability

#### Code Organization
- Clear separation between execution, TUI, and output handling
- Single Responsibility Principle for all classes
- Comprehensive error handling with specific error types
- Extensive documentation and examples

#### Extensibility Points
- Pluggable output handlers for different logging needs
- Configurable security policies for command validation
- Extensible TUI prompt types and builders
- Hook system for pre/post command execution

#### Testing Strategy
- 100% unit test coverage for all execution paths
- Integration tests with real system commands
- Performance benchmarks for regression detection
- Security testing for injection prevention

### Security

#### Command Validation
- Whitelist approach for allowed commands
- Argument validation for injection patterns
- Path traversal protection for working directories
- Environment variable sanitization

#### Resource Protection
- Memory limits for output capture
- Timeout enforcement for all commands
- Concurrent process limits
- Clean resource cleanup on errors

#### Isolation
- Separate process execution contexts
- No shared state between command executions
- Clean environment for each command
- Proper signal handling and cleanup

### Performance

#### Critical Path Optimization
- Direct Bun.spawn usage for minimal overhead
- Efficient stream handling for output capture
- Optimized timeout enforcement with AbortController
- Minimal object allocation in hot paths

#### Memory Management
- Streaming output processing to prevent buffering
- Efficient process handle lifecycle management
- Configurable limits for resource usage
- Proper cleanup of completed processes

#### Execution Speed
- Native Bun process execution for performance
- Minimal abstraction layer overhead
- Efficient error handling without performance impact
- Fast timeout and cancellation mechanisms

## Next Steps

### Immediate Actions (This Task)
1. Create `executor.ts` with CommandExecutor implementation
2. Implement `process-handle.ts` for process management
3. Build `tui-prompt-builder.ts` for interactive prompts
4. Add `output-buffer.ts` for stream handling
5. Create comprehensive unit and integration tests

### Future Integration Points (Phase 2+)
1. **Task 100_2_20** will integrate argument templating with command execution
2. **Task 100_3_10** will enhance timeout handling and monitoring
3. **Task 100_3_20** will add CLI command interface
4. **Task 100_4_10** will integrate error handling and logging

### Dependencies
- **Consumes**: FSM engine interfaces from task 100_1_20
- **Consumes**: Workflow definitions from task 100_1_10
- **Integrates**: Logger from `src/utils/logger.ts`
- **Provides**: Command execution capability for FSM engine

This architecture provides a robust, secure, and performant command execution foundation that seamlessly integrates with the FSM engine while supporting both regular commands and interactive TUI programs through clean bash subprocess patterns.