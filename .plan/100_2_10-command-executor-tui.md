# Implementation Plan: Command Executor TUI

**Task ID:** 100_2_10  
**Parent Feature:** 100 - Workflow State Machine  
**Priority:** High  
**Implementation Phase:** 2

---

## Implementation Overview

The Command Executor TUI component provides the execution layer for the workflow state machine, bridging the gap between abstract workflow definitions and concrete system commands. This component is responsible for:

1. **Process Execution**: Spawning and managing system processes using Bun's native APIs
2. **Exit Code Capture**: Reliable capture and routing based on command exit codes
3. **TUI Support**: Clean interactive terminal programs via bash subprocess pattern
4. **Resource Management**: Timeout enforcement, output buffering, and cleanup
5. **FSM Integration**: Implementation of the `StateExecutionCoordinator` interface

### Key Design Principles

- **Bun-Native Performance**: Leverage Bun.spawn and $ for optimal process execution
- **Clean Terminal Behavior**: Use bash subprocess patterns to avoid terminal pollution
- **Defensive Resource Management**: Enforce timeouts, memory limits, and concurrent process caps
- **Security-First Approach**: Command validation, injection prevention, and path traversal protection
- **Observable Execution**: Real-time logging and output streaming for debugging

### Architecture Alignment

This implementation aligns with the feature architecture requirements:
- Uses Bun's native process APIs per technology stack specification
- Implements bash subprocess pattern for TUI interactions per architectural decision
- Integrates with FSM engine via `StateExecutionCoordinator` interface
- Leverages existing logger utilities for consistent output handling
- Maintains <500ms startup overhead per performance requirements

---

## Component Details

### 1. CommandExecutor (Main Component)

**File**: `src/workflow/executor.ts`

**Purpose**: Primary execution coordinator implementing the FSM interface

**Key Responsibilities**:
- Execute regular system commands with output capture
- Execute interactive TUI commands via bash subprocess
- Enforce timeout constraints and resource limits
- Integrate with logger for real-time output streaming
- Manage process lifecycle from spawn to cleanup

**Interface Implementation**:
```typescript
// Implements StateExecutionCoordinator from FSM engine
interface StateExecutionCoordinator {
  executeCommand(
    command: string,
    args: string[],
    options: ExecutionOptions
  ): Promise<CommandResult>;
}
```

**Public API**:
```typescript
class CommandExecutor implements StateExecutionCoordinator {
  constructor(
    logger?: Logger,
    defaultTimeout?: number,
    options?: ExecutorOptions
  );
  
  // FSM interface implementation
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
  
  // Convenience methods for common patterns
  async executeConfirmation(
    message: string,
    defaultValue?: boolean,
    timeout?: number
  ): Promise<boolean>;
  
  async executeSelection(
    message: string,
    options: string[],
    timeout?: number
  ): Promise<string | null>;
  
  // Resource management
  cleanup(): Promise<void>;
  getActiveProcessCount(): number;
}
```

**Internal Methods**:
```typescript
private async spawnProcess(
  command: string,
  args: string[],
  options: ProcessSpawnOptions
): Promise<ProcessHandle>;

private enforceTimeout(
  process: ProcessHandle,
  timeoutMs: number
): void;

private captureOutput(
  process: Bun.Process,
  options: OutputCaptureOptions
): Promise<{ stdout: string; stderr: string }>;

private validateCommand(
  command: string,
  args: string[]
): void;

private validateWorkingDirectory(cwd?: string): string;

private async cleanupProcess(handle: ProcessHandle): Promise<void>;
```

**Configuration Options**:
```typescript
interface ExecutorOptions {
  maxOutputSize?: number;         // Default: 10MB
  maxExecutionTime?: number;      // Default: 5 minutes
  maxConcurrentProcesses?: number; // Default: 10
  allowedCommands?: RegExp[];     // Command whitelist
  enableValidation?: boolean;     // Default: true
  streamOutput?: boolean;         // Default: false
}

interface ExecutionOptions {
  timeout?: number;
  cwd?: string;
  env?: Record<string, string>;
  stdin?: 'pipe' | 'inherit' | 'ignore';
  stdout?: 'pipe' | 'inherit' | 'ignore';
  stderr?: 'pipe' | 'inherit' | 'ignore';
  captureOutput?: boolean;        // Default: true
}
```

**Error Handling**:
```typescript
class CommandExecutionError extends Error {
  constructor(
    message: string,
    public command: string,
    public args: string[],
    public code: ExecutionErrorCode,
    public cause?: Error
  );
}

type ExecutionErrorCode =
  | 'COMMAND_NOT_FOUND'
  | 'COMMAND_NOT_ALLOWED'
  | 'TIMEOUT'
  | 'INJECTION_DETECTED'
  | 'PATH_TRAVERSAL'
  | 'RESOURCE_LIMIT'
  | 'SPAWN_FAILED'
  | 'UNKNOWN_ERROR';
```

---

### 2. ProcessHandle (Process Management)

**File**: `src/workflow/process-handle.ts`

**Purpose**: Wrapper around Bun.Process with lifecycle management

**Key Responsibilities**:
- Encapsulate process metadata and state
- Provide unified interface for process monitoring
- Handle graceful and forceful termination
- Track execution timing and resource usage

**Data Structure**:
```typescript
interface ProcessHandle {
  readonly process: Bun.Process;
  readonly abortController: AbortController;
  readonly startTime: number;
  readonly command: string;
  readonly args: string[];
  readonly promise: Promise<ProcessResult>;
  
  kill(signal?: NodeJS.Signals | number): void;
  isRunning(): boolean;
  getDuration(): number;
  getMemoryUsage(): number | null;
}

interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  signal?: NodeJS.Signals;
  timedOut?: boolean;
}
```

**Implementation**:
```typescript
class ProcessHandleImpl implements ProcessHandle {
  private _killed = false;
  private _exitCode: number | null = null;
  
  constructor(
    readonly process: Bun.Process,
    readonly abortController: AbortController,
    readonly startTime: number,
    readonly command: string,
    readonly args: string[],
    readonly promise: Promise<ProcessResult>
  );
  
  kill(signal: NodeJS.Signals | number = 'SIGTERM'): void {
    if (this._killed) return;
    
    this._killed = true;
    this.abortController.abort();
    
    // Attempt graceful termination first
    this.process.kill(signal);
    
    // Forceful termination after 5 seconds
    setTimeout(() => {
      if (this.isRunning()) {
        this.process.kill('SIGKILL');
      }
    }, 5000);
  }
  
  isRunning(): boolean {
    return !this._killed && this._exitCode === null;
  }
  
  getDuration(): number {
    return Date.now() - this.startTime;
  }
  
  getMemoryUsage(): number | null {
    // Bun.Process may not expose memory info directly
    // Return null if unavailable
    return null;
  }
}
```

**Factory Function**:
```typescript
async function createProcessHandle(
  command: string,
  args: string[],
  options: ProcessSpawnOptions
): Promise<ProcessHandle> {
  const startTime = Date.now();
  const abortController = new AbortController();
  
  const process = Bun.spawn([command, ...args], {
    cwd: options.cwd,
    env: options.env,
    stdin: options.stdin,
    stdout: options.stdout,
    stderr: options.stderr
  });
  
  const promise = new Promise<ProcessResult>((resolve, reject) => {
    process.exited.then(exitCode => {
      resolve({
        exitCode,
        stdout: '', // Populated by OutputBuffer
        stderr: '', // Populated by OutputBuffer
        duration: Date.now() - startTime,
        timedOut: false
      });
    }).catch(reject);
  });
  
  return new ProcessHandleImpl(
    process,
    abortController,
    startTime,
    command,
    args,
    promise
  );
}
```

---

### 3. TUIPromptBuilder (Interactive Interface)

**File**: `src/workflow/tui-prompt-builder.ts`

**Purpose**: Generate safe bash commands for interactive TUI prompts

**Key Responsibilities**:
- Build bash subprocess commands for various prompt types
- Handle shell argument escaping to prevent injection
- Ensure consistent prompt behavior across environments
- Support multiple prompt patterns (confirmation, selection, input)

**Public API**:
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
    defaultValue?: string,
    validator?: string  // Bash regex pattern
  ): string;
  
  private static escapeShellArg(arg: string): string;
  private static validatePromptArgs(args: string[]): void;
}
```

**Implementation Examples**:

```typescript
// Confirmation Prompt
static buildConfirmationPrompt(
  message: string,
  defaultValue: boolean = false
): string {
  const escapedMessage = this.escapeShellArg(message);
  const defaultChar = defaultValue ? 'Y/n' : 'y/N';
  const defaultExit = defaultValue ? 0 : 1;
  
  return `bash -c '
    read -p "${escapedMessage} [${defaultChar}]: " -n 1 answer
    echo
    if [[ "$answer" =~ ^[Yy]$ ]]; then
      exit 0
    elif [[ "$answer" =~ ^[Nn]$ ]]; then
      exit 1
    else
      exit ${defaultExit}
    fi
  '`;
}

// Selection Prompt
static buildSelectionPrompt(
  message: string,
  options: string[],
  defaultIndex?: number
): string {
  const escapedMessage = this.escapeShellArg(message);
  const escapedOptions = options.map(opt => this.escapeShellArg(opt));
  
  // Use bash select for menu
  return `bash -c '
    echo "${escapedMessage}"
    PS3="Select option: "
    select opt in ${escapedOptions.join(' ')}; do
      if [ -n "$opt" ]; then
        echo "$opt"
        exit 0
      fi
    done
    exit 1
  '`;
}

// Input Prompt
static buildInputPrompt(
  message: string,
  defaultValue?: string,
  validator?: string
): string {
  const escapedMessage = this.escapeShellArg(message);
  const escapedDefault = defaultValue 
    ? this.escapeShellArg(defaultValue) 
    : '';
  
  let validatorCheck = '';
  if (validator) {
    validatorCheck = `
      if [[ ! "$input" =~ ${validator} ]]; then
        echo "Invalid input" >&2
        exit 1
      fi
    `;
  }
  
  return `bash -c '
    read -p "${escapedMessage} [${escapedDefault}]: " input
    input=\${input:-${escapedDefault}}
    ${validatorCheck}
    echo "$input"
    exit 0
  '`;
}
```

**Security Considerations**:
```typescript
private static escapeShellArg(arg: string): string {
  // Use single quotes and escape any embedded single quotes
  // Pattern: 'text' -> 'text'\''more text'
  return arg.replace(/'/g, "'\"'\"'");
}

private static validatePromptArgs(args: string[]): void {
  for (const arg of args) {
    // Prevent malicious input in prompts
    if (arg.includes('\n') || arg.includes('\r')) {
      throw new Error('Prompt arguments cannot contain newlines');
    }
    if (arg.length > 1000) {
      throw new Error('Prompt argument too long');
    }
  }
}
```

---

### 4. OutputBuffer (Stream Management)

**File**: `src/workflow/output-buffer.ts`

**Purpose**: Efficiently capture and buffer process output streams

**Key Responsibilities**:
- Buffer stdout/stderr from spawned processes
- Prevent memory exhaustion from large outputs
- Support real-time logging integration
- Implement configurable size limits

**Class Design**:
```typescript
class OutputBuffer extends Transform {
  private chunks: Buffer[] = [];
  private currentSize: number = 0;
  private maxSize: number;
  private encoding: BufferEncoding;
  private logger?: Logger;
  private streamType?: 'stdout' | 'stderr';
  
  constructor(
    maxSize: number = 10 * 1024 * 1024, // 10MB default
    encoding: BufferEncoding = 'utf8'
  );
  
  // Transform stream implementation
  _transform(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void;
  
  _flush(callback: TransformCallback): void;
  
  // Content access
  getContent(): string;
  getSize(): number;
  clear(): void;
  isTruncated(): boolean;
  
  // Logger integration
  pipeToLogger(logger: Logger, streamType: 'stdout' | 'stderr'): void;
}
```

**Implementation**:
```typescript
class OutputBuffer extends Transform {
  private chunks: Buffer[] = [];
  private currentSize = 0;
  private maxSize: number;
  private encoding: BufferEncoding;
  private logger?: Logger;
  private streamType?: 'stdout' | 'stderr';
  private truncated = false;
  
  constructor(
    maxSize = 10 * 1024 * 1024,
    encoding: BufferEncoding = 'utf8'
  ) {
    super();
    this.maxSize = maxSize;
    this.encoding = encoding;
  }
  
  _transform(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    // Check if adding this chunk would exceed limit
    if (this.currentSize + chunk.length > this.maxSize) {
      this.truncated = true;
      
      // Keep newest content, drop oldest
      const spaceNeeded = chunk.length;
      while (this.chunks.length > 0 && this.currentSize + spaceNeeded > this.maxSize) {
        const removed = this.chunks.shift();
        if (removed) {
          this.currentSize -= removed.length;
        }
      }
    }
    
    // Add new chunk
    this.chunks.push(chunk);
    this.currentSize += chunk.length;
    
    // Pass through for real-time processing
    this.push(chunk);
    
    // Stream to logger if configured
    if (this.logger && this.streamType) {
      const text = chunk.toString(this.encoding);
      if (this.streamType === 'stdout') {
        this.logger.info(text.trim());
      } else {
        this.logger.error(text.trim());
      }
    }
    
    callback();
  }
  
  _flush(callback: TransformCallback): void {
    if (this.truncated) {
      const warning = Buffer.from(
        '\n[Output truncated due to size limit]\n',
        this.encoding
      );
      this.push(warning);
    }
    callback();
  }
  
  getContent(): string {
    return Buffer.concat(this.chunks).toString(this.encoding);
  }
  
  getSize(): number {
    return this.currentSize;
  }
  
  clear(): void {
    this.chunks = [];
    this.currentSize = 0;
    this.truncated = false;
  }
  
  isTruncated(): boolean {
    return this.truncated;
  }
  
  pipeToLogger(logger: Logger, streamType: 'stdout' | 'stderr'): void {
    this.logger = logger;
    this.streamType = streamType;
  }
}
```

**Usage Pattern**:
```typescript
// Create output buffers
const stdoutBuffer = new OutputBuffer();
const stderrBuffer = new OutputBuffer();

// Optionally enable real-time logging
if (logger) {
  stdoutBuffer.pipeToLogger(logger, 'stdout');
  stderrBuffer.pipeToLogger(logger, 'stderr');
}

// Spawn process with buffered output
const process = Bun.spawn(['command', ...args], {
  stdout: stdoutBuffer,
  stderr: stderrBuffer
});

// Wait for completion
await process.exited;

// Retrieve captured output
const stdout = stdoutBuffer.getContent();
const stderr = stderrBuffer.getContent();
```

---

## Data Structures

### Core Types

```typescript
// Command execution options
interface ExecutionOptions {
  timeout?: number;
  cwd?: string;
  env?: Record<string, string>;
  stdin?: 'pipe' | 'inherit' | 'ignore';
  stdout?: 'pipe' | 'inherit' | 'ignore';
  stderr?: 'pipe' | 'inherit' | 'ignore';
  captureOutput?: boolean;
}

// Command execution result
interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  timedOut?: boolean;
  signal?: NodeJS.Signals;
}

// Process spawn configuration
interface ProcessSpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  stdin?: 'pipe' | 'inherit' | 'ignore';
  stdout?: 'pipe' | 'inherit' | 'ignore' | WritableStream;
  stderr?: 'pipe' | 'inherit' | 'ignore' | WritableStream;
}

// Output capture configuration
interface OutputCaptureOptions {
  maxSize?: number;
  encoding?: BufferEncoding;
  streamToLogger?: boolean;
}

// Executor configuration
interface ExecutorOptions {
  maxOutputSize?: number;
  maxExecutionTime?: number;
  maxConcurrentProcesses?: number;
  allowedCommands?: RegExp[];
  enableValidation?: boolean;
  streamOutput?: boolean;
}
```

### Error Types

```typescript
class CommandExecutionError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly args: string[],
    public readonly code: ExecutionErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'CommandExecutionError';
  }
}

type ExecutionErrorCode =
  | 'COMMAND_NOT_FOUND'
  | 'COMMAND_NOT_ALLOWED'
  | 'TIMEOUT'
  | 'INJECTION_DETECTED'
  | 'PATH_TRAVERSAL'
  | 'RESOURCE_LIMIT'
  | 'SPAWN_FAILED'
  | 'UNKNOWN_ERROR';
```

### Process Management Types

```typescript
interface ProcessHandle {
  readonly process: Bun.Process;
  readonly abortController: AbortController;
  readonly startTime: number;
  readonly command: string;
  readonly args: string[];
  readonly promise: Promise<ProcessResult>;
  
  kill(signal?: NodeJS.Signals | number): void;
  isRunning(): boolean;
  getDuration(): number;
  getMemoryUsage(): number | null;
}

interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  signal?: NodeJS.Signals;
  timedOut?: boolean;
}
```

---

## API Design

### CommandExecutor API

#### Constructor

```typescript
constructor(
  logger?: Logger,
  defaultTimeout: number = 120000, // 2 minutes
  options?: ExecutorOptions
)
```

**Parameters**:
- `logger`: Optional Logger instance for output streaming
- `defaultTimeout`: Default timeout for commands (milliseconds)
- `options`: Executor configuration options

**Example**:
```typescript
const executor = new CommandExecutor(
  logger,
  60000, // 1 minute default timeout
  {
    maxOutputSize: 5 * 1024 * 1024, // 5MB
    maxConcurrentProcesses: 5,
    streamOutput: true
  }
);
```

#### executeCommand()

```typescript
async executeCommand(
  command: string,
  args: string[],
  options?: ExecutionOptions
): Promise<CommandResult>
```

**Purpose**: Execute a system command with output capture

**Parameters**:
- `command`: Command to execute (e.g., 'git', 'npm', 'bash')
- `args`: Command arguments array
- `options`: Execution configuration options

**Returns**: Promise resolving to CommandResult

**Throws**: CommandExecutionError on validation or execution failures

**Example**:
```typescript
const result = await executor.executeCommand('git', ['status', '--short'], {
  timeout: 30000,
  cwd: '/path/to/repo',
  captureOutput: true
});

console.log('Exit code:', result.exitCode);
console.log('Output:', result.stdout);
```

#### executeTUICommand()

```typescript
async executeTUICommand(
  prompt: string,
  timeout: number = 30000
): Promise<CommandResult>
```

**Purpose**: Execute an interactive TUI prompt using bash subprocess

**Parameters**:
- `prompt`: Bash command string for TUI interaction
- `timeout`: Maximum wait time for user input (milliseconds)

**Returns**: Promise resolving to CommandResult (exitCode indicates user choice)

**Example**:
```typescript
const bashPrompt = TUIPromptBuilder.buildConfirmationPrompt(
  'Continue with deployment?',
  false
);

const result = await executor.executeTUICommand(bashPrompt, 30000);
const userConfirmed = result.exitCode === 0;
```

#### executeConfirmation()

```typescript
async executeConfirmation(
  message: string,
  defaultValue: boolean = false,
  timeout: number = 30000
): Promise<boolean>
```

**Purpose**: Convenience method for yes/no confirmation prompts

**Parameters**:
- `message`: Prompt message to display
- `defaultValue`: Default choice if user presses Enter
- `timeout`: Maximum wait time for user input

**Returns**: Promise resolving to boolean (true = yes, false = no)

**Example**:
```typescript
const confirmed = await executor.executeConfirmation(
  'Delete all temporary files?',
  false,
  30000
);

if (confirmed) {
  // Proceed with deletion
}
```

#### executeSelection()

```typescript
async executeSelection(
  message: string,
  options: string[],
  timeout: number = 60000
): Promise<string | null>
```

**Purpose**: Display a selection menu and capture user choice

**Parameters**:
- `message`: Prompt message to display
- `options`: Array of choices to present
- `timeout`: Maximum wait time for user input

**Returns**: Promise resolving to selected option string or null on timeout/cancel

**Example**:
```typescript
const selected = await executor.executeSelection(
  'Choose deployment environment:',
  ['development', 'staging', 'production'],
  60000
);

if (selected) {
  console.log('Deploying to:', selected);
}
```

#### cleanup()

```typescript
async cleanup(): Promise<void>
```

**Purpose**: Terminate all active processes and clean up resources

**Returns**: Promise resolving when all processes are terminated

**Example**:
```typescript
try {
  // Execute commands...
} finally {
  await executor.cleanup();
}
```

#### getActiveProcessCount()

```typescript
getActiveProcessCount(): number
```

**Purpose**: Get count of currently running processes

**Returns**: Number of active processes

**Example**:
```typescript
const count = executor.getActiveProcessCount();
console.log(`${count} processes running`);
```

---

### TUIPromptBuilder API

#### buildConfirmationPrompt()

```typescript
static buildConfirmationPrompt(
  message: string,
  defaultValue: boolean = false
): string
```

**Purpose**: Generate bash command for yes/no confirmation

**Parameters**:
- `message`: Prompt message
- `defaultValue`: Default choice (true = yes, false = no)

**Returns**: Bash command string

**Example**:
```typescript
const prompt = TUIPromptBuilder.buildConfirmationPrompt(
  'Proceed with installation?',
  true
);
// Returns: bash -c 'read -p "..." ...'
```

#### buildSelectionPrompt()

```typescript
static buildSelectionPrompt(
  message: string,
  options: string[],
  defaultIndex?: number
): string
```

**Purpose**: Generate bash command for selection menu

**Parameters**:
- `message`: Prompt message
- `options`: Array of choices
- `defaultIndex`: Optional default selection index

**Returns**: Bash command string

**Example**:
```typescript
const prompt = TUIPromptBuilder.buildSelectionPrompt(
  'Select environment:',
  ['dev', 'staging', 'prod']
);
```

#### buildInputPrompt()

```typescript
static buildInputPrompt(
  message: string,
  defaultValue?: string,
  validator?: string
): string
```

**Purpose**: Generate bash command for text input

**Parameters**:
- `message`: Prompt message
- `defaultValue`: Optional default value
- `validator`: Optional bash regex pattern for validation

**Returns**: Bash command string

**Example**:
```typescript
const prompt = TUIPromptBuilder.buildInputPrompt(
  'Enter branch name:',
  'main',
  '^[a-z0-9-]+$' // Only lowercase, numbers, hyphens
);
```

---

### OutputBuffer API

#### Constructor

```typescript
constructor(
  maxSize: number = 10 * 1024 * 1024,
  encoding: BufferEncoding = 'utf8'
)
```

**Parameters**:
- `maxSize`: Maximum buffer size in bytes
- `encoding`: Text encoding for output

#### pipeToLogger()

```typescript
pipeToLogger(logger: Logger, streamType: 'stdout' | 'stderr'): void
```

**Purpose**: Enable real-time logging of stream output

**Parameters**:
- `logger`: Logger instance
- `streamType`: Stream identifier

#### getContent()

```typescript
getContent(): string
```

**Purpose**: Retrieve buffered output as string

**Returns**: Complete buffered output

#### isTruncated()

```typescript
isTruncated(): boolean
```

**Purpose**: Check if output was truncated due to size limit

**Returns**: True if truncated

---

## Testing Strategy

### Unit Tests

#### CommandExecutor Tests

**File**: `tests/workflow/executor.test.ts`

**Test Coverage**:

1. **Basic Command Execution**
   ```typescript
   describe('executeCommand', () => {
     it('should execute simple command successfully', async () => {
       const executor = new CommandExecutor();
       const result = await executor.executeCommand('echo', ['hello']);
       
       expect(result.exitCode).toBe(0);
       expect(result.stdout.trim()).toBe('hello');
       expect(result.duration).toBeGreaterThan(0);
     });
     
     it('should capture non-zero exit codes', async () => {
       const executor = new CommandExecutor();
       const result = await executor.executeCommand('bash', [
         '-c',
         'exit 42'
       ]);
       
       expect(result.exitCode).toBe(42);
     });
     
     it('should capture stdout and stderr separately', async () => {
       const executor = new CommandExecutor();
       const result = await executor.executeCommand('bash', [
         '-c',
         'echo "out"; echo "err" >&2'
       ]);
       
       expect(result.stdout.trim()).toBe('out');
       expect(result.stderr.trim()).toBe('err');
     });
   });
   ```

2. **Timeout Enforcement**
   ```typescript
   describe('timeout handling', () => {
     it('should timeout long-running commands', async () => {
       const executor = new CommandExecutor();
       
       await expect(
         executor.executeCommand('sleep', ['10'], { timeout: 100 })
       ).rejects.toThrow('timed out');
     });
     
     it('should mark timed-out results', async () => {
       const executor = new CommandExecutor();
       
       try {
         await executor.executeCommand('sleep', ['10'], { timeout: 100 });
       } catch (error) {
         expect(error).toBeInstanceOf(CommandExecutionError);
         expect((error as CommandExecutionError).code).toBe('TIMEOUT');
       }
     });
   });
   ```

3. **TUI Command Execution**
   ```typescript
   describe('executeTUICommand', () => {
     it('should execute confirmation prompts', async () => {
       const executor = new CommandExecutor();
       const prompt = TUIPromptBuilder.buildConfirmationPrompt('Test?');
       
       // Mock bash response (automated testing)
       const result = await executor.executeTUICommand(prompt);
       
       expect(result.exitCode).toBeOneOf([0, 1]);
     });
   });
   ```

4. **Error Handling**
   ```typescript
   describe('error handling', () => {
     it('should handle command not found', async () => {
       const executor = new CommandExecutor();
       
       await expect(
         executor.executeCommand('nonexistent-command', [])
       ).rejects.toThrow(CommandExecutionError);
     });
     
     it('should validate allowed commands', async () => {
       const executor = new CommandExecutor(undefined, 120000, {
         allowedCommands: [/^git$/, /^npm$/]
       });
       
       await expect(
         executor.executeCommand('rm', ['-rf', '/'])
       ).rejects.toThrow('not allowed');
     });
   });
   ```

5. **Resource Management**
   ```typescript
   describe('resource management', () => {
     it('should enforce concurrent process limits', async () => {
       const executor = new CommandExecutor(undefined, 120000, {
         maxConcurrentProcesses: 2
       });
       
       // Start 2 long-running processes
       const p1 = executor.executeCommand('sleep', ['5']);
       const p2 = executor.executeCommand('sleep', ['5']);
       
       // Third should fail
       await expect(
         executor.executeCommand('sleep', ['5'])
       ).rejects.toThrow('Too many concurrent processes');
       
       await Promise.all([p1, p2]);
     });
     
     it('should cleanup on explicit cleanup call', async () => {
       const executor = new CommandExecutor();
       
       const promise = executor.executeCommand('sleep', ['10']);
       await executor.cleanup();
       
       await expect(promise).rejects.toThrow();
       expect(executor.getActiveProcessCount()).toBe(0);
     });
   });
   ```

#### ProcessHandle Tests

**File**: `tests/workflow/process-handle.test.ts`

**Test Coverage**:

```typescript
describe('ProcessHandle', () => {
  it('should track process lifecycle', async () => {
    const handle = await createProcessHandle('echo', ['test'], {});
    
    expect(handle.isRunning()).toBe(true);
    
    const result = await handle.promise;
    
    expect(handle.isRunning()).toBe(false);
    expect(result.exitCode).toBe(0);
  });
  
  it('should measure execution duration', async () => {
    const handle = await createProcessHandle('sleep', ['1'], {});
    
    await handle.promise;
    
    expect(handle.getDuration()).toBeGreaterThanOrEqual(1000);
  });
  
  it('should support graceful termination', async () => {
    const handle = await createProcessHandle('sleep', ['10'], {});
    
    setTimeout(() => handle.kill('SIGTERM'), 100);
    
    const result = await handle.promise;
    
    expect(result.signal).toBe('SIGTERM');
  });
  
  it('should support forceful termination', async () => {
    const handle = await createProcessHandle('sleep', ['10'], {});
    
    handle.kill('SIGKILL');
    
    const result = await handle.promise;
    
    expect(result.signal).toBe('SIGKILL');
  });
});
```

#### TUIPromptBuilder Tests

**File**: `tests/workflow/tui-prompt-builder.test.ts`

**Test Coverage**:

```typescript
describe('TUIPromptBuilder', () => {
  describe('buildConfirmationPrompt', () => {
    it('should build valid bash confirmation', () => {
      const prompt = TUIPromptBuilder.buildConfirmationPrompt('Continue?');
      
      expect(prompt).toContain('bash -c');
      expect(prompt).toContain('read -p');
      expect(prompt).toContain('Continue?');
      expect(prompt).toContain('[y/N]');
    });
    
    it('should escape shell special characters', () => {
      const prompt = TUIPromptBuilder.buildConfirmationPrompt(
        "Don't delete?"
      );
      
      // Should handle single quotes safely
      expect(prompt).not.toContain("Don't");
      expect(prompt).toContain('Don');
    });
    
    it('should support default values', () => {
      const promptYes = TUIPromptBuilder.buildConfirmationPrompt(
        'Test?',
        true
      );
      const promptNo = TUIPromptBuilder.buildConfirmationPrompt(
        'Test?',
        false
      );
      
      expect(promptYes).toContain('[Y/n]');
      expect(promptNo).toContain('[y/N]');
    });
  });
  
  describe('buildSelectionPrompt', () => {
    it('should build valid selection menu', () => {
      const prompt = TUIPromptBuilder.buildSelectionPrompt(
        'Choose:',
        ['option1', 'option2', 'option3']
      );
      
      expect(prompt).toContain('select opt in');
      expect(prompt).toContain('option1');
      expect(prompt).toContain('option2');
      expect(prompt).toContain('option3');
    });
  });
  
  describe('buildInputPrompt', () => {
    it('should build valid input prompt', () => {
      const prompt = TUIPromptBuilder.buildInputPrompt(
        'Enter name:',
        'default'
      );
      
      expect(prompt).toContain('read -p');
      expect(prompt).toContain('Enter name:');
      expect(prompt).toContain('default');
    });
    
    it('should include validator when provided', () => {
      const prompt = TUIPromptBuilder.buildInputPrompt(
        'Enter email:',
        undefined,
        '^[a-z]+@[a-z]+\\.[a-z]+$'
      );
      
      expect(prompt).toContain('=~');
      expect(prompt).toContain('[a-z]+@');
    });
  });
  
  describe('security', () => {
    it('should prevent command injection', () => {
      const malicious = "'; rm -rf / #";
      const prompt = TUIPromptBuilder.buildConfirmationPrompt(malicious);
      
      // Should not contain raw semicolon or command
      expect(prompt).not.toContain('; rm -rf');
    });
  });
});
```

#### OutputBuffer Tests

**File**: `tests/workflow/output-buffer.test.ts`

**Test Coverage**:

```typescript
describe('OutputBuffer', () => {
  it('should buffer stream data', async () => {
    const buffer = new OutputBuffer();
    
    buffer.write('line 1\n');
    buffer.write('line 2\n');
    buffer.end();
    
    expect(buffer.getContent()).toBe('line 1\nline 2\n');
  });
  
  it('should enforce size limits', async () => {
    const buffer = new OutputBuffer(100); // 100 bytes
    
    buffer.write('x'.repeat(50));
    buffer.write('y'.repeat(60)); // Exceeds limit
    buffer.end();
    
    const content = buffer.getContent();
    expect(content.length).toBeLessThanOrEqual(100);
    expect(buffer.isTruncated()).toBe(true);
  });
  
  it('should stream to logger', async () => {
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    } as any;
    
    const buffer = new OutputBuffer();
    buffer.pipeToLogger(mockLogger, 'stdout');
    
    buffer.write('test output\n');
    buffer.end();
    
    expect(mockLogger.info).toHaveBeenCalledWith('test output');
  });
  
  it('should handle large outputs efficiently', async () => {
    const buffer = new OutputBuffer(10 * 1024 * 1024); // 10MB
    
    const largeData = 'x'.repeat(1024 * 1024); // 1MB chunks
    
    for (let i = 0; i < 5; i++) {
      buffer.write(largeData);
    }
    buffer.end();
    
    expect(buffer.getSize()).toBeLessThanOrEqual(10 * 1024 * 1024);
  });
});
```

---

### Integration Tests

#### FSM Integration Tests

**File**: `tests/workflow/executor-fsm-integration.test.ts`

**Test Coverage**:

```typescript
describe('CommandExecutor FSM Integration', () => {
  let executor: CommandExecutor;
  let fsm: StateMachine;
  
  beforeEach(() => {
    executor = new CommandExecutor();
    
    const workflow = {
      name: 'test-workflow',
      states: {
        start: {
          command: 'echo',
          args: ['Starting workflow'],
          on_success: 'check',
          on_failure: 'error'
        },
        check: {
          command: 'bash',
          args: ['-c', 'exit 0'],
          on_success: 'complete',
          on_failure: 'error'
        },
        complete: {
          type: 'final'
        },
        error: {
          type: 'final'
        }
      }
    };
    
    fsm = new StateMachine(workflow, executor);
  });
  
  it('should execute workflow states in sequence', async () => {
    const result = await fsm.execute();
    
    expect(result.success).toBe(true);
    expect(result.finalState).toBe('complete');
    expect(result.stateHistory).toEqual(['start', 'check', 'complete']);
  });
  
  it('should route on exit codes', async () => {
    const workflow = {
      name: 'exit-code-test',
      states: {
        start: {
          command: 'bash',
          args: ['-c', 'exit 1'], // Non-zero exit
          on_success: 'success',
          on_failure: 'failure'
        },
        success: { type: 'final' },
        failure: { type: 'final' }
      }
    };
    
    const fsm = new StateMachine(workflow, executor);
    const result = await fsm.execute();
    
    expect(result.finalState).toBe('failure');
  });
  
  it('should handle TUI confirmations', async () => {
    // This test would require mocking user input
    // In practice, we'd use environment variables or test doubles
  });
});
```

#### Real Command Tests

**File**: `tests/workflow/executor-real-commands.test.ts`

**Test Coverage**:

```typescript
describe('Real Command Execution', () => {
  let executor: CommandExecutor;
  
  beforeEach(() => {
    executor = new CommandExecutor();
  });
  
  afterEach(async () => {
    await executor.cleanup();
  });
  
  it('should execute git commands', async () => {
    const result = await executor.executeCommand('git', ['--version']);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('git version');
  });
  
  it('should execute npm commands', async () => {
    const result = await executor.executeCommand('npm', ['--version']);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/^\d+\.\d+\.\d+/);
  });
  
  it('should handle command with large output', async () => {
    const result = await executor.executeCommand('ls', ['-la', '/usr/bin']);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(100);
  });
  
  it('should handle long-running commands with timeout', async () => {
    const start = Date.now();
    
    try {
      await executor.executeCommand('sleep', ['5'], { timeout: 1000 });
      fail('Should have timed out');
    } catch (error) {
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000); // Killed quickly
      expect(error).toBeInstanceOf(CommandExecutionError);
    }
  });
});
```

---

### Mock Strategy

**Mock Bun.spawn for Controlled Testing**:

```typescript
// tests/mocks/bun-spawn.ts
interface MockProcessOptions {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  delay?: number;
  signal?: NodeJS.Signals;
}

function createMockProcess(options: MockProcessOptions = {}): any {
  const {
    exitCode = 0,
    stdout = '',
    stderr = '',
    delay = 0,
    signal
  } = options;
  
  const stdoutStream = new ReadableStream({
    start(controller) {
      if (stdout) {
        controller.enqueue(new TextEncoder().encode(stdout));
      }
      controller.close();
    }
  });
  
  const stderrStream = new ReadableStream({
    start(controller) {
      if (stderr) {
        controller.enqueue(new TextEncoder().encode(stderr));
      }
      controller.close();
    }
  });
  
  const exitedPromise = new Promise(resolve => {
    setTimeout(() => resolve(exitCode), delay);
  });
  
  return {
    stdout: stdoutStream,
    stderr: stderrStream,
    exited: exitedPromise,
    kill: jest.fn(),
    killed: false,
    pid: Math.floor(Math.random() * 10000)
  };
}

// Mock Bun.spawn globally
global.Bun = {
  spawn: jest.fn((cmd, options) => {
    return createMockProcess();
  })
} as any;
```

**Usage in Tests**:

```typescript
import { createMockProcess } from './mocks/bun-spawn';

describe('CommandExecutor with mocks', () => {
  beforeEach(() => {
    (global.Bun.spawn as jest.Mock).mockClear();
  });
  
  it('should handle mock process', async () => {
    (global.Bun.spawn as jest.Mock).mockReturnValue(
      createMockProcess({
        exitCode: 0,
        stdout: 'mock output'
      })
    );
    
    const executor = new CommandExecutor();
    const result = await executor.executeCommand('test', []);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('mock output');
  });
});
```

---

## Development Phases

### Phase 1: Core Command Execution (Days 1-2)

**Goal**: Implement basic command execution with exit code capture

**Tasks**:

1. **Create CommandExecutor Class** (4 hours)
   - Create `src/workflow/executor.ts`
   - Implement constructor with configuration
   - Add basic `executeCommand()` method
   - Implement StateExecutionCoordinator interface
   - Add input validation

2. **Implement ProcessHandle** (3 hours)
   - Create `src/workflow/process-handle.ts`
   - Define ProcessHandle interface and implementation
   - Add process lifecycle tracking
   - Implement kill() and monitoring methods
   - Create factory function

3. **Add Timeout Enforcement** (3 hours)
   - Implement AbortController pattern
   - Add timeout logic to executeCommand()
   - Handle timeout errors gracefully
   - Add timeout configuration options
   - Test timeout behavior

4. **Basic Error Handling** (2 hours)
   - Create CommandExecutionError class
   - Add error type definitions
   - Implement error wrapping
   - Add command validation
   - Handle spawn failures

**Deliverables**:
- ✅ `src/workflow/executor.ts` - CommandExecutor implementation
- ✅ `src/workflow/process-handle.ts` - ProcessHandle wrapper
- ✅ Basic unit tests for command execution
- ✅ Exit code capture working correctly

**Validation Criteria**:
- Can execute simple commands (echo, ls, git)
- Captures exit codes correctly (0 and non-zero)
- Enforces timeouts and kills processes
- Handles command not found errors

---

### Phase 2: Output Capture and Logging (Days 2-3)

**Goal**: Implement efficient output buffering and logger integration

**Tasks**:

1. **Implement OutputBuffer** (4 hours)
   - Create `src/workflow/output-buffer.ts`
   - Extend Transform stream
   - Implement chunk buffering logic
   - Add size limit enforcement
   - Handle memory efficiently

2. **Integrate with Logger** (3 hours)
   - Add `pipeToLogger()` method
   - Implement real-time streaming
   - Support silent/verbose modes
   - Handle output formatting
   - Test logger integration

3. **Enhanced Process Execution** (3 hours)
   - Integrate OutputBuffer into spawnProcess()
   - Capture stdout and stderr separately
   - Wire up logger streaming
   - Add output capture options
   - Handle large output scenarios

4. **Output Testing** (2 hours)
   - Test with large outputs (>10MB)
   - Verify truncation behavior
   - Test logger integration
   - Benchmark memory usage
   - Test stream performance

**Deliverables**:
- ✅ `src/workflow/output-buffer.ts` - OutputBuffer implementation
- ✅ Logger integration in CommandExecutor
- ✅ Tests for output capture and buffering
- ✅ Support for configurable output limits

**Validation Criteria**:
- Captures stdout/stderr without memory issues
- Real-time logging works correctly
- Output truncation at size limits
- No memory leaks with large outputs

---

### Phase 3: TUI Support (Days 3-4)

**Goal**: Implement interactive TUI program execution

**Tasks**:

1. **Implement TUIPromptBuilder** (4 hours)
   - Create `src/workflow/tui-prompt-builder.ts`
   - Implement buildConfirmationPrompt()
   - Implement buildSelectionPrompt()
   - Implement buildInputPrompt()
   - Add shell escaping logic

2. **Add TUI Execution Methods** (3 hours)
   - Implement executeTUICommand()
   - Add executeConfirmation() convenience method
   - Add executeSelection() convenience method
   - Handle terminal inheritance
   - Support various prompt types

3. **Terminal Management** (2 hours)
   - Ensure clean terminal state
   - Handle signal propagation
   - Test terminal buffer cleanliness
   - Prevent readline pollution
   - Verify bash subprocess pattern

4. **TUI Testing** (3 hours)
   - Create mock TUI tests
   - Test prompt generation
   - Test shell escaping
   - Test injection prevention
   - Manual integration testing

**Deliverables**:
- ✅ `src/workflow/tui-prompt-builder.ts` - TUIPromptBuilder class
- ✅ TUI execution methods in CommandExecutor
- ✅ Tests for prompt generation and execution
- ✅ Secure shell escaping implementation

**Validation Criteria**:
- Confirmation prompts work cleanly
- Selection menus display correctly
- Input validation works
- No terminal pollution
- Shell injection prevention verified

---

### Phase 4: Security and Resource Management (Days 4-5)

**Goal**: Implement security validations and resource limits

**Tasks**:

1. **Command Validation** (3 hours)
   - Implement command whitelist
   - Add argument injection detection
   - Validate working directories
   - Add path traversal protection
   - Test security measures

2. **Resource Limits** (3 hours)
   - Add concurrent process limiting
   - Enforce maximum execution time
   - Implement output size caps
   - Track active processes
   - Add resource cleanup

3. **Enhanced Error Handling** (2 hours)
   - Categorize error types
   - Add detailed error messages
   - Improve error context
   - Handle edge cases
   - Test error scenarios

4. **Cleanup and Signal Handling** (2 hours)
   - Implement cleanup() method
   - Handle SIGINT/SIGTERM
   - Graceful shutdown logic
   - Resource release on errors
   - Test cleanup behavior

**Deliverables**:
- ✅ Security validation in CommandExecutor
- ✅ Resource limit enforcement
- ✅ Comprehensive error handling
- ✅ Clean shutdown and cleanup

**Validation Criteria**:
- Command whitelist enforced
- Injection attempts blocked
- Resource limits prevent overload
- Clean shutdown on signals
- No resource leaks

---

### Phase 5: Integration and Testing (Days 5-6)

**Goal**: Complete integration with FSM and comprehensive testing

**Tasks**:

1. **FSM Integration** (3 hours)
   - Verify StateExecutionCoordinator implementation
   - Test with FSM engine
   - Validate state transition routing
   - Test workflow execution
   - Fix integration issues

2. **Comprehensive Testing** (4 hours)
   - Write integration tests
   - Test real command execution
   - Performance benchmarking
   - Memory usage profiling
   - Edge case testing

3. **Documentation** (2 hours)
   - Add JSDoc comments
   - Create usage examples
   - Document configuration options
   - Write troubleshooting guide
   - Update integration docs

4. **Final Validation** (1 hour)
   - Run full test suite
   - Verify all requirements met
   - Check performance targets
   - Review code quality
   - Prepare for next phase

**Deliverables**:
- ✅ Complete integration with FSM engine
- ✅ Full test coverage (>90%)
- ✅ Documentation and examples
- ✅ Performance validation

**Validation Criteria**:
- All unit tests passing
- Integration tests passing
- Performance targets met (<100ms overhead)
- Code coverage >90%
- FSM integration working

---

## Performance Targets

### Execution Time Budget

| Operation | Target | Maximum |
|-----------|--------|---------|
| Command spawn overhead | <10ms | <50ms |
| Simple command execution | <100ms total | <200ms |
| TUI prompt execution | <50ms overhead | <100ms |
| Timeout enforcement | <1ms overhead | <5ms |
| Output capture (per MB) | <5ms | <20ms |
| Process cleanup | <10ms | <50ms |

### Memory Usage Targets

| Component | Target | Maximum |
|-----------|--------|---------|
| CommandExecutor instance | <1KB | <5KB |
| ProcessHandle per process | <100B | <500B |
| OutputBuffer default | <1MB | <10MB |
| 10 concurrent processes | <5MB total | <50MB |

### Resource Efficiency

- **Process Reuse**: Cache process handles where safe (not implemented in v1)
- **Stream Buffering**: Prevent memory spikes with configurable limits
- **Lazy Output Capture**: Only capture when captureOutput=true
- **Efficient Cleanup**: Release resources immediately after process exit

---

## Security Considerations

### Command Injection Prevention

**Strategy**: Whitelist approach with pattern validation

```typescript
private validateCommand(command: string, args: string[]): void {
  // Default allowed commands
  const allowedCommands = this.options.allowedCommands || [
    /^git$/,
    /^npm$/,
    /^bun$/,
    /^node$/,
    /^bash$/,
    /^sh$/,
    /^echo$/,
    /^test$/,
    /^cat$/,
    /^ls$/,
    /^pwd$/,
    /^docker$/
  ];
  
  const isAllowed = allowedCommands.some(pattern => 
    pattern.test(command)
  );
  
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
    /[;&|`$(){}[\]]/,  // Shell metacharacters
    /\.\./,             // Path traversal
    /\/etc\//,          // System file access
    />|<|>>|<</         // Redirection operators
  ];
  
  return dangerousPatterns.some(pattern => pattern.test(arg));
}
```

**Exceptions**: Bash commands for TUI prompts are constructed internally and escaped

### Path Traversal Protection

**Strategy**: Validate working directories against workspace root

```typescript
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
```

### Resource Protection

**Strategy**: Hard limits on resource consumption

```typescript
private readonly MAX_OUTPUT_SIZE = 10 * 1024 * 1024; // 10MB
private readonly MAX_EXECUTION_TIME = 5 * 60 * 1000; // 5 minutes
private readonly MAX_CONCURRENT_PROCESSES = 10;

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
  
  // Execute with enforced limits
  // ...
}
```

---

## Integration Examples

### Basic Usage

```typescript
import { CommandExecutor } from './workflow/executor';
import { logger } from './utils/logger';

// Create executor with logger
const executor = new CommandExecutor(logger);

// Execute simple command
const result = await executor.executeCommand('git', ['status', '--short']);

if (result.exitCode === 0) {
  console.log('Git status:', result.stdout);
} else {
  console.error('Git failed:', result.stderr);
}

// Cleanup when done
await executor.cleanup();
```

### FSM Integration

```typescript
import { StateMachine } from './workflow/fsm';
import { CommandExecutor } from './workflow/executor';

// Create executor
const executor = new CommandExecutor();

// Create FSM with executor
const fsm = new StateMachine(workflowDefinition, executor);

// Execute workflow
const result = await fsm.execute();

console.log('Workflow completed:', result.finalState);
console.log('States visited:', result.stateHistory);
```

### TUI Confirmation

```typescript
import { CommandExecutor } from './workflow/executor';

const executor = new CommandExecutor();

// Simple yes/no confirmation
const confirmed = await executor.executeConfirmation(
  'Deploy to production?',
  false,  // default: no
  30000   // 30 second timeout
);

if (confirmed) {
  // Proceed with deployment
  await executor.executeCommand('deploy', ['production']);
}
```

### Selection Menu

```typescript
const environment = await executor.executeSelection(
  'Choose deployment environment:',
  ['development', 'staging', 'production'],
  60000  // 1 minute timeout
);

if (environment) {
  await executor.executeCommand('deploy', [environment]);
}
```

---

## Next Steps

### Immediate Next Tasks (Phase 2+)

1. **Task 100_2_20: Argument Templating System**
   - Integrate with CommandExecutor for argument substitution
   - Use executor to validate templated commands
   - Test security with templated arguments

2. **Task 100_3_10: Confirmation Timeout System**
   - Enhance executeTUICommand() with advanced timeout handling
   - Add timeout monitoring and warnings
   - Implement default value on timeout

3. **Task 100_3_20: CLI Command Integration**
   - Create CLI interface for workflow execution
   - Wire up CommandExecutor to CLI commands
   - Add progress reporting and output formatting

4. **Task 100_4_10: Error Handling and Logging**
   - Enhance error messages and context
   - Add structured logging
   - Improve debugging capabilities

### Dependencies

**Consumes**:
- `src/workflow/interfaces.ts` - StateExecutionCoordinator interface (from task 100_1_20)
- `src/workflow/execution-context.ts` - ExecutionOptions, CommandResult types (from task 100_1_20)
- `src/utils/logger.ts` - Logger for output streaming

**Provides**:
- CommandExecutor implementation for FSM engine
- TUI prompt capabilities for confirmation system
- Secure command execution foundation

**Integrates**:
- FSM engine (task 100_1_20) via StateExecutionCoordinator
- Workflow parser (task 100_1_10) via command definitions
- Logger utilities for consistent output

---

## File Structure

```
src/workflow/
├── interfaces.ts              # [EXISTING] From task 100_1_10
├── fsm.ts                     # [EXISTING] From task 100_1_20
├── execution-context.ts       # [EXISTING] From task 100_1_20
├── executor.ts                # [NEW] CommandExecutor implementation
├── process-handle.ts          # [NEW] ProcessHandle wrapper
├── tui-prompt-builder.ts      # [NEW] TUI prompt generation
├── output-buffer.ts           # [NEW] Output buffering
└── index.ts                   # [UPDATE] Export new components

tests/workflow/
├── executor.test.ts           # [NEW] CommandExecutor unit tests
├── process-handle.test.ts     # [NEW] ProcessHandle tests
├── tui-prompt-builder.test.ts # [NEW] TUI prompt tests
├── output-buffer.test.ts      # [NEW] OutputBuffer tests
├── executor-fsm-integration.test.ts    # [NEW] FSM integration
└── executor-real-commands.test.ts      # [NEW] Real command tests
```

---

## Success Criteria

### Functional Requirements

- ✅ Execute system commands with exit code capture
- ✅ Support TUI programs via bash subprocess pattern
- ✅ Implement timeout enforcement for all commands
- ✅ Capture stdout and stderr separately
- ✅ Integrate with FSM engine via StateExecutionCoordinator
- ✅ Real-time output logging support
- ✅ Clean terminal behavior (no pollution)
- ✅ Graceful error handling and cleanup

### Performance Requirements

- ✅ Command execution overhead <100ms
- ✅ TUI prompt overhead <50ms
- ✅ Memory usage <5MB for typical workflows
- ✅ Support 10+ concurrent processes
- ✅ Handle large outputs (>10MB) efficiently

### Security Requirements

- ✅ Command whitelist enforcement
- ✅ Injection pattern detection
- ✅ Path traversal protection
- ✅ Resource limit enforcement
- ✅ Safe shell escaping for TUI prompts

### Quality Requirements

- ✅ >90% code coverage
- ✅ All unit tests passing
- ✅ Integration tests with FSM passing
- ✅ No memory leaks detected
- ✅ Clean code with comprehensive documentation

---

This implementation plan provides a complete roadmap for building the Command Executor TUI component, following the architectural decisions and integrating seamlessly with the workflow state machine system.
