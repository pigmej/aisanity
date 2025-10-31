# Implementation Plan: Confirmation Timeout System

**Task ID:** 100_3_10  
**Parent Feature:** 100 - Workflow State Machine  
**Priority:** Medium  
**Implementation Phase:** 3

---

## Implementation Overview

The Confirmation Timeout System provides user interaction capabilities for the workflow state machine, enabling automated workflows to pause for human decision points while maintaining robust timeout enforcement and override mechanisms. This component serves as the bridge between automated workflow execution and interactive user confirmations.

### Core Responsibilities

1. **User Confirmation Prompts**: Interactive yes/no confirmation using bash subprocess pattern
2. **Timeout Management**: Per-state timeout configuration and enforcement with progress indication
3. **Override Mechanism**: Global `--yes` flag to bypass all confirmations for automated workflows
4. **Progress Indication**: Real-time countdown and status reporting during confirmation wait
5. **Logger Integration**: Seamless integration with existing aisanity logging utilities

### Key Design Principles

- **Bash Subprocess Pattern**: Use bash subprocess approach per feature architecture (consistent with TUI commands)
- **Timeout-First Design**: Every confirmation has a timeout with configurable defaults
- **Clean User Experience**: Clear prompts, progress indication, and graceful timeout handling
- **Security-First**: Shell escaping and injection prevention for all user-facing prompts
- **Observable Execution**: Integration with Logger for audit trails and debugging

### Architecture Alignment

This implementation aligns with feature architecture requirements:
- Uses bash subprocess pattern per architectural decision (task 100_2_10)
- Integrates with existing CommandExecutor for subprocess execution
- Leverages existing Logger utilities for consistent output
- Implements timeout enforcement using AbortController pattern
- Maintains <500ms overhead per performance requirements

---

## Component Details

### 1. ConfirmationHandler (Main Component)

**File**: `src/workflow/confirmation-handler.ts`

**Purpose**: Primary interface for user confirmations with timeout and override support

**Key Responsibilities**:
- Execute confirmation prompts with timeout enforcement
- Handle `--yes` flag override for automated workflows
- Coordinate with CommandExecutor for subprocess execution
- Integrate with Logger for consistent output and audit trails
- Provide progress indication during confirmation wait

**Public API**:
```typescript
class ConfirmationHandler {
  constructor(
    private executor: CommandExecutor,
    private logger?: Logger,
    private defaultTimeout: number = 30000
  );
  
  // Main confirmation interface
  async requestConfirmation(
    message: string,
    options?: ConfirmationOptions
  ): Promise<ConfirmationResult>;
  
  // Specialized confirmation with explicit timeout
  async confirmWithTimeout(
    message: string,
    timeoutMs: number,
    options?: ConfirmationOptions
  ): Promise<boolean>;
  
  // Confirmation with override support
  async confirmWithOverride(
    message: string,
    yesFlag: boolean,
    timeoutMs?: number
  ): Promise<boolean>;
}
```

**Configuration Types**:
```typescript
interface ConfirmationOptions {
  timeout?: number;              // Timeout in milliseconds
  yesFlag?: boolean;             // Global --yes override
  defaultResponse?: boolean;     // Default on timeout or Enter
  showProgress?: boolean;        // Show countdown indicator (default: true)
  progressInterval?: number;     // Progress update interval (default: 1000ms)
}

interface ConfirmationResult {
  confirmed: boolean;            // User's decision (or default)
  method: ConfirmationMethod;    // How confirmation was resolved
  duration: number;              // Time taken in milliseconds
  timedOut?: boolean;            // Whether timeout occurred
  error?: Error;                 // Any error that occurred
}

type ConfirmationMethod = 'user' | 'override' | 'timeout' | 'error';
```

**Implementation Strategy**:
```typescript
// Core confirmation logic
async requestConfirmation(
  message: string,
  options: ConfirmationOptions = {}
): Promise<ConfirmationResult> {
  const startTime = Date.now();
  
  // Handle --yes flag override first
  if (options.yesFlag) {
    this.logger?.info(`Auto-confirmed: ${message}`);
    return {
      confirmed: true,
      method: 'override',
      duration: 0
    };
  }
  
  // Validate and normalize timeout
  const timeout = this.validateTimeout(options.timeout);
  
  // Build confirmation command
  const command = ConfirmationBuilder.buildTimedConfirmation(
    message,
    timeout,
    options.defaultResponse ?? false
  );
  
  // Start progress indicator if enabled
  const progressIndicator = options.showProgress !== false 
    ? new ProgressIndicator(this.logger)
    : null;
  
  if (progressIndicator) {
    progressIndicator.start(timeout, message, options.progressInterval);
  }
  
  try {
    // Execute confirmation via CommandExecutor
    const result = await this.executor.executeCommand('bash', ['-c', command], {
      timeout,
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit'
    });
    
    const confirmed = result.exitCode === 0;
    
    this.logger?.info(
      `Confirmation ${confirmed ? 'accepted' : 'declined'} (${result.duration}ms)`
    );
    
    return {
      confirmed,
      method: 'user',
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    // Handle timeout or other errors
    this.logger?.warn(`Confirmation error: ${error}`);
    
    return {
      confirmed: options.defaultResponse ?? false,
      method: error.code === 'TIMEOUT' ? 'timeout' : 'error',
      duration: Date.now() - startTime,
      timedOut: error.code === 'TIMEOUT',
      error: error as Error
    };
    
  } finally {
    // Always stop progress indicator
    progressIndicator?.stop();
  }
}
```

**Internal Methods**:
```typescript
private validateTimeout(timeoutMs?: number): number {
  const maxTimeout = 5 * 60 * 1000; // 5 minutes maximum
  const minTimeout = 1000;          // 1 second minimum
  
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
```

---

### 2. ConfirmationBuilder (Prompt Construction)

**File**: `src/workflow/confirmation-builder.ts`

**Purpose**: Generate safe bash commands for timed confirmation prompts

**Key Responsibilities**:
- Generate bash commands with integrated timeout support
- Handle shell argument escaping to prevent injection
- Build confirmation prompts with default value support
- Ensure consistent prompt behavior across environments

**Public API**:
```typescript
class ConfirmationBuilder {
  static buildTimedConfirmation(
    message: string,
    timeoutMs: number,
    defaultValue: boolean = false
  ): string;
  
  static escapePromptText(text: string): string;
  
  private static buildBasePrompt(
    message: string, 
    defaultValue: boolean
  ): string;
  
  private static wrapWithTimeout(
    command: string, 
    timeoutMs: number,
    defaultValue: boolean
  ): string;
}
```

**Implementation Examples**:

```typescript
// Main confirmation builder
static buildTimedConfirmation(
  message: string,
  timeoutMs: number,
  defaultValue: boolean = false
): string {
  const basePrompt = this.buildBasePrompt(message, defaultValue);
  return this.wrapWithTimeout(basePrompt, timeoutMs, defaultValue);
}

// Base confirmation prompt (without timeout)
private static buildBasePrompt(
  message: string,
  defaultValue: boolean
): string {
  const escapedMessage = this.escapePromptText(message);
  const defaultChar = defaultValue ? 'Y/n' : 'y/N';
  
  return `read -p "${escapedMessage} [${defaultChar}]: " -n 1 answer; echo; [[ "$answer" =~ ^[Yy]$ ]] && exit 0 || [[ "$answer" =~ ^[Nn]$ ]] && exit 1 || exit ${defaultValue ? '0' : '1'}`;
}

// Wrap prompt with bash timeout command
private static wrapWithTimeout(
  command: string,
  timeoutMs: number,
  defaultValue: boolean
): string {
  const timeoutSeconds = Math.ceil(timeoutMs / 1000);
  const defaultExit = defaultValue ? 0 : 1;
  
  // Use bash timeout command with proper signal handling
  // Exit code 124 indicates timeout occurred
  return `
    timeout ${timeoutSeconds} bash -c '${command}' || {
      exit_code=$?
      if [ $exit_code -eq 124 ]; then
        exit ${defaultExit}
      else
        exit $exit_code
      fi
    }
  `.trim().replace(/\s+/g, ' ');
}

// Security: Shell argument escaping
static escapePromptText(text: string): string {
  // Comprehensive shell escaping for confirmation messages
  return text
    .replace(/\\/g, '\\\\')    // Escape backslashes first
    .replace(/'/g, "'\"'\"'")  // Escape single quotes
    .replace(/"/g, '\\"')      // Escape double quotes
    .replace(/`/g, '\\`')      // Escape backticks (command substitution)
    .replace(/\$/g, '\\$')     // Escape dollar signs (variable expansion)
    .replace(/\n/g, '\\n')     // Escape newlines
    .replace(/\r/g, '\\r');    // Escape carriage returns
}
```

**Security Validation**:
```typescript
private static validatePromptMessage(message: string): void {
  if (!message || message.trim().length === 0) {
    throw new Error('Confirmation message cannot be empty');
  }
  
  if (message.length > 500) {
    throw new Error('Confirmation message too long (max 500 characters)');
  }
  
  // Prevent control characters (except spaces and newlines handled by escaping)
  const controlChars = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/;
  if (controlChars.test(message)) {
    throw new Error('Confirmation message contains invalid control characters');
  }
}
```

---

### 3. ProgressIndicator (User Feedback)

**File**: `src/workflow/progress-indicator.ts`

**Purpose**: Display non-blocking progress indication during confirmation timeout

**Key Responsibilities**:
- Show countdown timer during confirmation wait
- Display spinner animation for visual feedback
- Clean terminal output without interference
- Handle graceful stopping and cleanup

**Public API**:
```typescript
class ProgressIndicator {
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;
  private startTime: number = 0;
  
  constructor(private logger?: Logger);
  
  start(
    timeoutMs: number,
    message: string = 'Waiting for confirmation...',
    updateInterval: number = 1000
  ): void;
  
  stop(): void;
  
  private renderSpinner(frame: number): string;
  private formatTimeRemaining(ms: number): string;
  private clearLine(): void;
}
```

**Implementation**:
```typescript
class ProgressIndicator {
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;
  private startTime = 0;
  private readonly spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  
  constructor(private logger?: Logger) {}
  
  start(
    timeoutMs: number,
    message: string = 'Waiting for confirmation...',
    updateInterval: number = 1000
  ): void {
    if (this.isRunning) {
      return; // Already running
    }
    
    this.isRunning = true;
    this.startTime = Date.now();
    
    // Show initial message
    this.logger?.info(message);
    
    this.intervalId = setInterval(() => {
      if (!this.isRunning) {
        return;
      }
      
      const elapsed = Date.now() - this.startTime;
      const remaining = Math.max(0, timeoutMs - elapsed);
      
      if (remaining === 0) {
        this.stop();
        return;
      }
      
      // Calculate spinner frame based on elapsed time
      const frame = Math.floor(elapsed / 200) % this.spinnerFrames.length;
      const spinner = this.renderSpinner(frame);
      const timeStr = this.formatTimeRemaining(remaining);
      
      // Use carriage return for inline updates (overwrites current line)
      process.stdout.write(`\r${spinner} ${message} (${timeStr} remaining)`);
      
    }, updateInterval);
  }
  
  stop(): void {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    
    // Clear the progress line
    this.clearLine();
  }
  
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
  
  private clearLine(): void {
    // Clear current line and move cursor to beginning
    const terminalWidth = process.stdout.columns || 80;
    process.stdout.write('\r' + ' '.repeat(terminalWidth) + '\r');
  }
}
```

**Alternative Simple Implementation** (if spinner is too complex):
```typescript
// Simpler progress without spinner animation
start(timeoutMs: number, message: string): void {
  this.isRunning = true;
  this.startTime = Date.now();
  
  this.logger?.info(`${message} (timeout: ${timeoutMs / 1000}s)`);
  
  // Just log periodic reminders, no fancy animation
  this.intervalId = setInterval(() => {
    const elapsed = Date.now() - this.startTime;
    const remaining = Math.max(0, timeoutMs - elapsed);
    
    if (remaining === 0) {
      this.stop();
      return;
    }
    
    const secondsLeft = Math.ceil(remaining / 1000);
    this.logger?.debug(`Waiting... ${secondsLeft}s remaining`);
  }, 5000); // Update every 5 seconds
}
```

---

### 4. TimeoutManager (Timeout Coordination)

**File**: `src/workflow/timeout-manager.ts`

**Purpose**: Coordinate timeout enforcement across confirmation and workflow contexts

**Key Responsibilities**:
- Create and manage AbortController instances for timeout
- Track remaining time and progress
- Handle parent-child timeout relationships
- Provide progress tracking callbacks

**Public API**:
```typescript
class TimeoutManager {
  private abortController?: AbortController;
  private startTime?: number;
  private timeoutMs?: number;
  private timeoutId?: NodeJS.Timeout;
  
  startTimeout(
    timeoutMs: number,
    parentSignal?: AbortSignal
  ): AbortController;
  
  getRemainingTime(): number;
  getElapsedTime(): number;
  getProgressPercentage(): number;
  isExpired(): boolean;
  cancel(): void;
}
```

**Implementation**:
```typescript
class TimeoutManager {
  private abortController?: AbortController;
  private startTime?: number;
  private timeoutMs?: number;
  private timeoutId?: NodeJS.Timeout;
  
  startTimeout(
    timeoutMs: number,
    parentSignal?: AbortSignal
  ): AbortController {
    // Clean up any existing timeout
    this.cancel();
    
    this.abortController = new AbortController();
    this.startTime = Date.now();
    this.timeoutMs = timeoutMs;
    
    // Handle parent timeout propagation
    if (parentSignal) {
      if (parentSignal.aborted) {
        // Parent already aborted, abort immediately
        this.abortController.abort();
        return this.abortController;
      }
      
      // Listen for parent abort
      parentSignal.addEventListener('abort', () => {
        this.cancel();
      });
    }
    
    // Set local timeout
    if (timeoutMs > 0) {
      this.timeoutId = setTimeout(() => {
        this.abortController?.abort();
      }, timeoutMs);
    }
    
    return this.abortController;
  }
  
  getRemainingTime(): number {
    if (!this.startTime || !this.timeoutMs) {
      return 0;
    }
    
    const elapsed = Date.now() - this.startTime;
    return Math.max(0, this.timeoutMs - elapsed);
  }
  
  getElapsedTime(): number {
    if (!this.startTime) {
      return 0;
    }
    
    return Date.now() - this.startTime;
  }
  
  getProgressPercentage(): number {
    if (!this.startTime || !this.timeoutMs) {
      return 0;
    }
    
    const elapsed = this.getElapsedTime();
    return Math.min(100, (elapsed / this.timeoutMs) * 100);
  }
  
  isExpired(): boolean {
    return this.getRemainingTime() === 0;
  }
  
  cancel(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    
    this.abortController?.abort();
    this.abortController = undefined;
    this.startTime = undefined;
    this.timeoutMs = undefined;
  }
}
```

---

## Data Structures

### Core Types

```typescript
// Confirmation configuration options
interface ConfirmationOptions {
  timeout?: number;              // Timeout in milliseconds (default: 30000)
  yesFlag?: boolean;             // Global --yes override flag
  defaultResponse?: boolean;     // Default response on timeout/Enter (default: false)
  showProgress?: boolean;        // Show progress indicator (default: true)
  progressInterval?: number;     // Progress update interval (default: 1000ms)
}

// Confirmation execution result
interface ConfirmationResult {
  confirmed: boolean;            // User's decision or default
  method: ConfirmationMethod;    // How confirmation was resolved
  duration: number;              // Time taken in milliseconds
  timedOut?: boolean;            // Whether timeout occurred
  error?: Error;                 // Any error that occurred
  metadata?: Record<string, unknown>; // Additional context
}

// How confirmation was resolved
type ConfirmationMethod = 'user' | 'override' | 'timeout' | 'error';

// Confirmation handler configuration
interface ConfirmationHandlerConfig {
  defaultTimeout?: number;       // Default timeout (default: 30000ms)
  minTimeout?: number;           // Minimum allowed timeout (default: 1000ms)
  maxTimeout?: number;           // Maximum allowed timeout (default: 300000ms)
  enableProgressIndicator?: boolean; // Enable progress by default (default: true)
  progressUpdateInterval?: number;   // Progress update interval (default: 1000ms)
}
```

### Integration Types (from existing interfaces.ts)

```typescript
// From src/workflow/interfaces.ts - already defined
interface ConfirmationConfig {
  message?: string;              // Confirmation prompt message
  timeout?: number;              // Timeout in milliseconds
  defaultAccept?: boolean;       // Default on timeout (maps to defaultResponse)
}

// Extend State interface to include confirmation
interface State {
  description?: string;
  command: string;
  args?: string[];
  timeout?: number;
  confirmation?: ConfirmationConfig; // Confirmation before state execution
  transitions: StateTransitions;
}
```

---

## API Design

### ConfirmationHandler API

#### Constructor

```typescript
constructor(
  executor: CommandExecutor,
  logger?: Logger,
  config?: ConfirmationHandlerConfig
)
```

**Parameters**:
- `executor`: CommandExecutor instance for subprocess execution
- `logger`: Optional Logger instance for output and audit trails
- `config`: Optional configuration for handler behavior

**Example**:
```typescript
const confirmationHandler = new ConfirmationHandler(
  executor,
  logger,
  {
    defaultTimeout: 60000,      // 1 minute
    minTimeout: 5000,           // 5 seconds
    maxTimeout: 300000,         // 5 minutes
    enableProgressIndicator: true
  }
);
```

#### requestConfirmation()

```typescript
async requestConfirmation(
  message: string,
  options?: ConfirmationOptions
): Promise<ConfirmationResult>
```

**Purpose**: Request user confirmation with full control over options

**Parameters**:
- `message`: Confirmation message to display
- `options`: Optional configuration options

**Returns**: Promise resolving to ConfirmationResult

**Example**:
```typescript
const result = await confirmationHandler.requestConfirmation(
  'Deploy to production?',
  {
    timeout: 30000,
    defaultResponse: false,
    showProgress: true
  }
);

if (result.confirmed) {
  console.log('User confirmed deployment');
} else if (result.timedOut) {
  console.log('Confirmation timed out');
}
```

#### confirmWithTimeout()

```typescript
async confirmWithTimeout(
  message: string,
  timeoutMs: number,
  options?: Omit<ConfirmationOptions, 'timeout'>
): Promise<boolean>
```

**Purpose**: Convenience method for simple confirmation with explicit timeout

**Parameters**:
- `message`: Confirmation message
- `timeoutMs`: Timeout in milliseconds
- `options`: Optional configuration (excluding timeout)

**Returns**: Promise resolving to boolean (true = confirmed)

**Example**:
```typescript
const confirmed = await confirmationHandler.confirmWithTimeout(
  'Continue with migration?',
  45000,  // 45 seconds
  { defaultResponse: false }
);

if (confirmed) {
  // Proceed with migration
}
```

#### confirmWithOverride()

```typescript
async confirmWithOverride(
  message: string,
  yesFlag: boolean,
  timeoutMs?: number
): Promise<boolean>
```

**Purpose**: Confirmation with explicit --yes flag override support

**Parameters**:
- `message`: Confirmation message
- `yesFlag`: Whether to skip confirmation (--yes flag)
- `timeoutMs`: Optional timeout (uses default if not provided)

**Returns**: Promise resolving to boolean (true = confirmed)

**Example**:
```typescript
// From CLI: aisanity run deploy --yes
const yesFlag = program.opts().yes;

const confirmed = await confirmationHandler.confirmWithOverride(
  'Deploy to staging?',
  yesFlag,
  30000
);

// If yesFlag is true, returns immediately with true
// Otherwise prompts user with 30s timeout
```

---

### ConfirmationBuilder API

#### buildTimedConfirmation()

```typescript
static buildTimedConfirmation(
  message: string,
  timeoutMs: number,
  defaultValue: boolean = false
): string
```

**Purpose**: Generate bash command for timed confirmation prompt

**Parameters**:
- `message`: Confirmation message
- `timeoutMs`: Timeout in milliseconds
- `defaultValue`: Default choice on timeout or Enter

**Returns**: Bash command string

**Example**:
```typescript
const command = ConfirmationBuilder.buildTimedConfirmation(
  'Delete all logs?',
  30000,
  false  // Default to 'no' on timeout
);

// Returns: 'timeout 30 bash -c \'read -p "Delete all logs? [y/N]:" ...\''
```

#### escapePromptText()

```typescript
static escapePromptText(text: string): string
```

**Purpose**: Escape shell special characters in prompt text

**Parameters**:
- `text`: Raw prompt text

**Returns**: Shell-escaped text

**Example**:
```typescript
const escaped = ConfirmationBuilder.escapePromptText("Don't proceed?");
// Returns: "Don'\"'\"'t proceed?"
```

---

### ProgressIndicator API

#### start()

```typescript
start(
  timeoutMs: number,
  message?: string,
  updateInterval?: number
): void
```

**Purpose**: Start displaying progress indicator

**Parameters**:
- `timeoutMs`: Total timeout duration
- `message`: Optional message to display (default: 'Waiting for confirmation...')
- `updateInterval`: Update frequency in milliseconds (default: 1000)

**Example**:
```typescript
const indicator = new ProgressIndicator(logger);
indicator.start(30000, 'Waiting for deployment approval', 1000);

// Display updates every second:
// ⠋ Waiting for deployment approval (30s remaining)
// ⠙ Waiting for deployment approval (29s remaining)
// ...
```

#### stop()

```typescript
stop(): void
```

**Purpose**: Stop progress indicator and clean up terminal

**Example**:
```typescript
try {
  indicator.start(30000);
  await someAsyncOperation();
} finally {
  indicator.stop(); // Always cleanup
}
```

---

### TimeoutManager API

#### startTimeout()

```typescript
startTimeout(
  timeoutMs: number,
  parentSignal?: AbortSignal
): AbortController
```

**Purpose**: Start a new timeout with optional parent coordination

**Parameters**:
- `timeoutMs`: Timeout duration in milliseconds
- `parentSignal`: Optional parent AbortSignal for coordination

**Returns**: AbortController for the timeout

**Example**:
```typescript
const manager = new TimeoutManager();

// Simple timeout
const controller = manager.startTimeout(30000);

// With parent coordination (propagate parent cancellation)
const parentController = new AbortController();
const childController = manager.startTimeout(30000, parentController.signal);

// If parent aborts, child is also aborted
parentController.abort();
```

#### getRemainingTime()

```typescript
getRemainingTime(): number
```

**Purpose**: Get remaining time before timeout

**Returns**: Milliseconds remaining (0 if expired)

**Example**:
```typescript
const remaining = manager.getRemainingTime();
console.log(`${remaining}ms remaining`);
```

#### cancel()

```typescript
cancel(): void
```

**Purpose**: Cancel timeout and cleanup resources

**Example**:
```typescript
try {
  const controller = manager.startTimeout(30000);
  // ... operation completed early
} finally {
  manager.cancel(); // Cleanup
}
```

---

## Testing Strategy

### Unit Tests

#### ConfirmationHandler Tests

**File**: `tests/workflow/confirmation-handler.test.ts`

**Test Coverage**:

1. **Basic Confirmation**
   ```typescript
   describe('requestConfirmation', () => {
     it('should request confirmation successfully', async () => {
       const handler = new ConfirmationHandler(mockExecutor);
       
       // Mock user accepting confirmation
       mockExecutor.executeCommand.mockResolvedValue({
         exitCode: 0,
         stdout: '',
         stderr: '',
         duration: 100
       });
       
       const result = await handler.requestConfirmation('Continue?');
       
       expect(result.confirmed).toBe(true);
       expect(result.method).toBe('user');
       expect(result.duration).toBeGreaterThan(0);
     });
     
     it('should handle user declining confirmation', async () => {
       const handler = new ConfirmationHandler(mockExecutor);
       
       // Mock user declining (exit code 1)
       mockExecutor.executeCommand.mockResolvedValue({
         exitCode: 1,
         stdout: '',
         stderr: '',
         duration: 50
       });
       
       const result = await handler.requestConfirmation('Delete?');
       
       expect(result.confirmed).toBe(false);
       expect(result.method).toBe('user');
     });
   });
   ```

2. **--yes Flag Override**
   ```typescript
   describe('--yes flag override', () => {
     it('should auto-confirm with --yes flag', async () => {
       const handler = new ConfirmationHandler(mockExecutor, mockLogger);
       
       const result = await handler.requestConfirmation('Deploy?', {
         yesFlag: true
       });
       
       expect(result.confirmed).toBe(true);
       expect(result.method).toBe('override');
       expect(result.duration).toBe(0);
       expect(mockLogger.info).toHaveBeenCalledWith('Auto-confirmed: Deploy?');
       
       // Executor should not be called
       expect(mockExecutor.executeCommand).not.toHaveBeenCalled();
     });
     
     it('should work with confirmWithOverride helper', async () => {
       const handler = new ConfirmationHandler(mockExecutor);
       
       const confirmed = await handler.confirmWithOverride(
         'Migrate database?',
         true  // --yes flag
       );
       
       expect(confirmed).toBe(true);
       expect(mockExecutor.executeCommand).not.toHaveBeenCalled();
     });
   });
   ```

3. **Timeout Handling**
   ```typescript
   describe('timeout handling', () => {
     it('should handle timeout with default response', async () => {
       const handler = new ConfirmationHandler(mockExecutor);
       
       // Mock timeout error
       mockExecutor.executeCommand.mockRejectedValue({
         code: 'TIMEOUT',
         message: 'Command timed out'
       });
       
       const result = await handler.requestConfirmation('Approve?', {
         timeout: 1000,
         defaultResponse: false
       });
       
       expect(result.confirmed).toBe(false);
       expect(result.method).toBe('timeout');
       expect(result.timedOut).toBe(true);
     });
     
     it('should respect defaultResponse on timeout', async () => {
       const handler = new ConfirmationHandler(mockExecutor);
       
       mockExecutor.executeCommand.mockRejectedValue({
         code: 'TIMEOUT',
         message: 'Command timed out'
       });
       
       const resultAccept = await handler.requestConfirmation('Test?', {
         timeout: 1000,
         defaultResponse: true  // Default to yes
       });
       
       expect(resultAccept.confirmed).toBe(true);
       expect(resultAccept.method).toBe('timeout');
     });
     
     it('should validate timeout ranges', async () => {
       const handler = new ConfirmationHandler(
         mockExecutor,
         mockLogger,
         { minTimeout: 5000, maxTimeout: 60000 }
       );
       
       // Too short
       await handler.requestConfirmation('Test?', { timeout: 100 });
       expect(mockLogger.warn).toHaveBeenCalledWith(
         expect.stringContaining('too short')
       );
       
       // Too long
       await handler.requestConfirmation('Test?', { timeout: 600000 });
       expect(mockLogger.warn).toHaveBeenCalledWith(
         expect.stringContaining('too long')
       );
     });
   });
   ```

4. **Progress Indication**
   ```typescript
   describe('progress indication', () => {
     it('should start and stop progress indicator', async () => {
       const mockProgress = new MockProgressIndicator();
       const handler = new ConfirmationHandler(mockExecutor, mockLogger);
       
       // Mock executor to delay response
       mockExecutor.executeCommand.mockImplementation(
         () => new Promise(resolve => 
           setTimeout(() => resolve({ exitCode: 0, stdout: '', stderr: '', duration: 100 }), 500)
         )
       );
       
       await handler.requestConfirmation('Wait?', {
         timeout: 5000,
         showProgress: true
       });
       
       // Progress indicator should have been used
       // (actual implementation would inject ProgressIndicator)
     });
     
     it('should skip progress when disabled', async () => {
       const handler = new ConfirmationHandler(mockExecutor);
       
       mockExecutor.executeCommand.mockResolvedValue({
         exitCode: 0,
         stdout: '',
         stderr: '',
         duration: 10
       });
       
       const result = await handler.requestConfirmation('Quick?', {
         showProgress: false
       });
       
       expect(result.confirmed).toBe(true);
       // No progress indicator should be created
     });
   });
   ```

5. **Logger Integration**
   ```typescript
   describe('logger integration', () => {
     it('should log confirmation request', async () => {
       const handler = new ConfirmationHandler(mockExecutor, mockLogger);
       
       mockExecutor.executeCommand.mockResolvedValue({
         exitCode: 0,
         stdout: '',
         stderr: '',
         duration: 100
       });
       
       await handler.requestConfirmation('Deploy now?');
       
       expect(mockLogger.info).toHaveBeenCalledWith(
         expect.stringContaining('Deploy now?')
       );
     });
     
     it('should log confirmation result', async () => {
       const handler = new ConfirmationHandler(mockExecutor, mockLogger);
       
       mockExecutor.executeCommand.mockResolvedValue({
         exitCode: 0,
         stdout: '',
         stderr: '',
         duration: 150
       });
       
       await handler.requestConfirmation('Continue?');
       
       expect(mockLogger.info).toHaveBeenCalledWith(
         expect.stringMatching(/Confirmation accepted.*150ms/)
       );
     });
   });
   ```

#### ConfirmationBuilder Tests

**File**: `tests/workflow/confirmation-builder.test.ts`

**Test Coverage**:

```typescript
describe('ConfirmationBuilder', () => {
  describe('buildTimedConfirmation', () => {
    it('should build valid timed confirmation command', () => {
      const command = ConfirmationBuilder.buildTimedConfirmation(
        'Continue?',
        30000,
        false
      );
      
      expect(command).toContain('timeout 30');
      expect(command).toContain('bash -c');
      expect(command).toContain('read -p');
      expect(command).toContain('Continue?');
      expect(command).toContain('[y/N]');
    });
    
    it('should handle default value true', () => {
      const command = ConfirmationBuilder.buildTimedConfirmation(
        'Accept?',
        15000,
        true
      );
      
      expect(command).toContain('[Y/n]');
      expect(command).toContain('exit 0'); // Default exit for timeout
    });
    
    it('should convert milliseconds to seconds', () => {
      const command = ConfirmationBuilder.buildTimedConfirmation(
        'Test?',
        45500,  // 45.5 seconds
        false
      );
      
      // Should round up to 46 seconds
      expect(command).toContain('timeout 46');
    });
  });
  
  describe('escapePromptText', () => {
    it('should escape single quotes', () => {
      const escaped = ConfirmationBuilder.escapePromptText("Don't stop");
      expect(escaped).not.toContain("Don't");
      expect(escaped).toContain('Don');
    });
    
    it('should escape double quotes', () => {
      const escaped = ConfirmationBuilder.escapePromptText('Say "yes"');
      expect(escaped).toContain('\\"yes\\"');
    });
    
    it('should escape backticks', () => {
      const escaped = ConfirmationBuilder.escapePromptText('Run `command`');
      expect(escaped).toContain('\\`command\\`');
    });
    
    it('should escape dollar signs', () => {
      const escaped = ConfirmationBuilder.escapePromptText('Cost is $100');
      expect(escaped).toContain('\\$100');
    });
    
    it('should handle complex injection attempts', () => {
      const malicious = "'; rm -rf / #";
      const escaped = ConfirmationBuilder.escapePromptText(malicious);
      
      // Should not contain raw semicolon or command
      expect(escaped).not.toContain('; rm -rf');
      expect(escaped).toContain("'\"'\"'"); // Escaped single quote
    });
  });
  
  describe('security validation', () => {
    it('should reject empty messages', () => {
      expect(() => {
        ConfirmationBuilder.buildTimedConfirmation('', 30000, false);
      }).toThrow('cannot be empty');
    });
    
    it('should reject overly long messages', () => {
      const longMessage = 'x'.repeat(600);
      expect(() => {
        ConfirmationBuilder.buildTimedConfirmation(longMessage, 30000, false);
      }).toThrow('too long');
    });
  });
});
```

#### ProgressIndicator Tests

**File**: `tests/workflow/progress-indicator.test.ts`

**Test Coverage**:

```typescript
describe('ProgressIndicator', () => {
  let indicator: ProgressIndicator;
  let mockLogger: Logger;
  
  beforeEach(() => {
    mockLogger = createMockLogger();
    indicator = new ProgressIndicator(mockLogger);
  });
  
  afterEach(() => {
    indicator.stop();
  });
  
  describe('start and stop', () => {
    it('should start progress indication', () => {
      indicator.start(10000, 'Testing...');
      
      expect(indicator['isRunning']).toBe(true);
      expect(indicator['intervalId']).toBeDefined();
    });
    
    it('should stop progress indication', () => {
      indicator.start(10000);
      indicator.stop();
      
      expect(indicator['isRunning']).toBe(false);
      expect(indicator['intervalId']).toBeUndefined();
    });
    
    it('should handle multiple stop calls', () => {
      indicator.start(10000);
      indicator.stop();
      indicator.stop(); // Should not throw
      
      expect(indicator['isRunning']).toBe(false);
    });
    
    it('should ignore start when already running', () => {
      indicator.start(10000);
      const firstIntervalId = indicator['intervalId'];
      
      indicator.start(10000); // Second start should be ignored
      
      expect(indicator['intervalId']).toBe(firstIntervalId);
    });
  });
  
  describe('progress updates', () => {
    it('should update progress periodically', async () => {
      const writeSpy = jest.spyOn(process.stdout, 'write');
      
      indicator.start(5000, 'Waiting...', 100); // Fast updates for testing
      
      await new Promise(resolve => setTimeout(resolve, 250));
      
      expect(writeSpy).toHaveBeenCalled();
      expect(writeSpy.mock.calls[0][0]).toContain('Waiting...');
      
      indicator.stop();
      writeSpy.mockRestore();
    });
    
    it('should display remaining time correctly', () => {
      const formatted = indicator['formatTimeRemaining'](65000);
      expect(formatted).toBe('1m 5s');
      
      const formatted2 = indicator['formatTimeRemaining'](30000);
      expect(formatted2).toBe('30s');
    });
    
    it('should render spinner frames', () => {
      const frame0 = indicator['renderSpinner'](0);
      const frame1 = indicator['renderSpinner'](1);
      
      expect(frame0).toBeTruthy();
      expect(frame1).toBeTruthy();
      expect(frame0).not.toBe(frame1);
    });
  });
  
  describe('cleanup', () => {
    it('should clear terminal line on stop', () => {
      const writeSpy = jest.spyOn(process.stdout, 'write');
      
      indicator.start(5000);
      indicator.stop();
      
      // Should clear line with spaces and carriage return
      const lastCall = writeSpy.mock.calls[writeSpy.mock.calls.length - 1];
      expect(lastCall[0]).toContain('\r');
      
      writeSpy.mockRestore();
    });
  });
});
```

#### TimeoutManager Tests

**File**: `tests/workflow/timeout-manager.test.ts`

**Test Coverage**:

```typescript
describe('TimeoutManager', () => {
  let manager: TimeoutManager;
  
  beforeEach(() => {
    manager = new TimeoutManager();
  });
  
  afterEach(() => {
    manager.cancel();
  });
  
  describe('timeout lifecycle', () => {
    it('should start timeout', () => {
      const controller = manager.startTimeout(5000);
      
      expect(controller).toBeInstanceOf(AbortController);
      expect(controller.signal.aborted).toBe(false);
    });
    
    it('should abort after timeout', async () => {
      const controller = manager.startTimeout(100);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(controller.signal.aborted).toBe(true);
    });
    
    it('should cancel timeout', () => {
      const controller = manager.startTimeout(5000);
      
      manager.cancel();
      
      expect(controller.signal.aborted).toBe(true);
    });
    
    it('should handle multiple cancellations', () => {
      manager.startTimeout(5000);
      manager.cancel();
      manager.cancel(); // Should not throw
    });
  });
  
  describe('parent timeout coordination', () => {
    it('should respect parent signal', () => {
      const parentController = new AbortController();
      const childController = manager.startTimeout(5000, parentController.signal);
      
      parentController.abort();
      
      expect(childController.signal.aborted).toBe(true);
    });
    
    it('should handle already aborted parent', () => {
      const parentController = new AbortController();
      parentController.abort();
      
      const childController = manager.startTimeout(5000, parentController.signal);
      
      expect(childController.signal.aborted).toBe(true);
    });
  });
  
  describe('time tracking', () => {
    it('should track remaining time', async () => {
      manager.startTimeout(5000);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const remaining = manager.getRemainingTime();
      expect(remaining).toBeLessThan(5000);
      expect(remaining).toBeGreaterThan(3500);
    });
    
    it('should return 0 when expired', async () => {
      manager.startTimeout(100);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(manager.getRemainingTime()).toBe(0);
      expect(manager.isExpired()).toBe(true);
    });
    
    it('should track elapsed time', async () => {
      manager.startTimeout(5000);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const elapsed = manager.getElapsedTime();
      expect(elapsed).toBeGreaterThanOrEqual(500);
    });
    
    it('should calculate progress percentage', async () => {
      manager.startTimeout(1000);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const progress = manager.getProgressPercentage();
      expect(progress).toBeGreaterThan(40);
      expect(progress).toBeLessThan(60);
    });
  });
});
```

---

### Integration Tests

#### FSM Integration Tests

**File**: `tests/workflow/confirmation-fsm-integration.test.ts`

**Test Coverage**:

```typescript
describe('Confirmation FSM Integration', () => {
  let executor: CommandExecutor;
  let confirmationHandler: ConfirmationHandler;
  let fsm: StateMachine;
  
  beforeEach(() => {
    executor = new CommandExecutor();
    confirmationHandler = new ConfirmationHandler(executor);
    
    const workflow = {
      name: 'test-with-confirmation',
      states: {
        start: {
          command: 'echo',
          args: ['Starting...'],
          confirmation: {
            message: 'Begin workflow?',
            timeout: 30000,
            defaultAccept: false
          },
          on_success: 'process',
          on_failure: 'cancelled'
        },
        process: {
          command: 'echo',
          args: ['Processing...'],
          on_success: 'complete'
        },
        complete: { type: 'final' },
        cancelled: { type: 'final' }
      }
    };
    
    fsm = new StateMachine(workflow, executor, confirmationHandler);
  });
  
  it('should pause for confirmation before state execution', async () => {
    // Mock user confirming
    jest.spyOn(confirmationHandler, 'requestConfirmation')
      .mockResolvedValue({
        confirmed: true,
        method: 'user',
        duration: 100
      });
    
    const result = await fsm.executeState('start');
    
    expect(confirmationHandler.requestConfirmation).toHaveBeenCalledWith(
      'Begin workflow?',
      expect.objectContaining({
        timeout: 30000,
        defaultResponse: false
      })
    );
    
    expect(result.success).toBe(true);
    expect(result.nextState).toBe('process');
  });
  
  it('should route to failure on declined confirmation', async () => {
    // Mock user declining
    jest.spyOn(confirmationHandler, 'requestConfirmation')
      .mockResolvedValue({
        confirmed: false,
        method: 'user',
        duration: 50
      });
    
    const result = await fsm.executeState('start');
    
    expect(result.success).toBe(false);
    expect(result.nextState).toBe('cancelled');
  });
  
  it('should skip confirmation with --yes flag', async () => {
    const result = await fsm.executeState('start', { yesFlag: true });
    
    // Confirmation should be bypassed
    expect(result.success).toBe(true);
    expect(result.nextState).toBe('process');
  });
  
  it('should handle confirmation timeout', async () => {
    // Mock timeout
    jest.spyOn(confirmationHandler, 'requestConfirmation')
      .mockResolvedValue({
        confirmed: false,  // defaultAccept is false
        method: 'timeout',
        duration: 30000,
        timedOut: true
      });
    
    const result = await fsm.executeState('start');
    
    expect(result.success).toBe(false);
    expect(result.nextState).toBe('cancelled');
  });
});
```

---

### Mock Strategy

#### Mock Executor

```typescript
// tests/workflow/mocks/mock-executor.ts
class MockExecutor implements StateExecutionCoordinator {
  executeCommand = jest.fn();
  executeTUICommand = jest.fn();
  executeConfirmation = jest.fn();
  cleanup = jest.fn();
  
  mockConfirmation(accepted: boolean, duration: number = 100) {
    this.executeCommand.mockResolvedValue({
      exitCode: accepted ? 0 : 1,
      stdout: '',
      stderr: '',
      duration
    });
  }
  
  mockTimeout() {
    this.executeCommand.mockRejectedValue({
      code: 'TIMEOUT',
      message: 'Command timed out'
    });
  }
  
  mockError(error: Error) {
    this.executeCommand.mockRejectedValue(error);
  }
}
```

#### Mock Logger

```typescript
// tests/workflow/helpers/mock-logger.ts
function createMockLogger(): Logger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    success: jest.fn()
  } as any;
}
```

---

## Development Phases

### Phase 1: Core Confirmation Handler (Days 1-2)

**Goal**: Implement basic confirmation with timeout support

**Tasks**:

1. **Create ConfirmationHandler Class** (4 hours)
   - Create `src/workflow/confirmation-handler.ts`
   - Implement constructor with configuration
   - Add basic `requestConfirmation()` method
   - Integrate with CommandExecutor
   - Add logger integration

2. **Implement ConfirmationBuilder** (3 hours)
   - Create `src/workflow/confirmation-builder.ts`
   - Implement `buildTimedConfirmation()`
   - Add shell escaping with `escapePromptText()`
   - Implement timeout wrapping logic
   - Add validation

3. **Add --yes Flag Override** (2 hours)
   - Implement override logic in requestConfirmation()
   - Add `confirmWithOverride()` helper method
   - Test override behavior
   - Add logging for overrides

4. **Basic Testing** (3 hours)
   - Create unit tests for ConfirmationHandler
   - Test ConfirmationBuilder security
   - Test --yes flag behavior
   - Test timeout validation

**Deliverables**:
- ✅ `src/workflow/confirmation-handler.ts`
- ✅ `src/workflow/confirmation-builder.ts`
- ✅ Basic unit tests
- ✅ --yes flag override working

**Validation Criteria**:
- Can request simple confirmations
- --yes flag bypasses prompts
- Timeout validation working
- Shell escaping prevents injection

---

### Phase 2: Timeout Management (Days 2-3)

**Goal**: Implement robust timeout coordination and tracking

**Tasks**:

1. **Implement TimeoutManager** (3 hours)
   - Create `src/workflow/timeout-manager.ts`
   - Implement AbortController coordination
   - Add time tracking methods
   - Support parent timeout propagation
   - Handle cleanup

2. **Integrate Timeout into Confirmation** (2 hours)
   - Use TimeoutManager in ConfirmationHandler
   - Handle timeout errors gracefully
   - Respect defaultResponse on timeout
   - Test timeout behavior

3. **Timeout Testing** (2 hours)
   - Test timeout enforcement
   - Test parent-child coordination
   - Test time tracking accuracy
   - Test cleanup on cancellation

4. **Error Handling** (1 hour)
   - Handle timeout errors specifically
   - Distinguish timeout from other errors
   - Add error context to results
   - Test error scenarios

**Deliverables**:
- ✅ `src/workflow/timeout-manager.ts`
- ✅ Timeout integration in ConfirmationHandler
- ✅ Comprehensive timeout tests
- ✅ Robust error handling

**Validation Criteria**:
- Timeouts enforced correctly
- Parent timeout propagates to children
- Time tracking accurate
- Clean resource cleanup

---

### Phase 3: Progress Indication (Days 3-4)

**Goal**: Implement user-friendly progress feedback

**Tasks**:

1. **Implement ProgressIndicator** (3 hours)
   - Create `src/workflow/progress-indicator.ts`
   - Implement spinner animation
   - Add countdown timer display
   - Handle terminal cleanup
   - Integrate with logger

2. **Integrate Progress into Confirmation** (2 hours)
   - Start progress on confirmation request
   - Stop progress on completion/timeout
   - Handle progress configuration options
   - Test progress behavior

3. **Progress Testing** (2 hours)
   - Test spinner rendering
   - Test time formatting
   - Test terminal cleanup
   - Test enable/disable options

4. **Polish and Refinement** (1 hour)
   - Adjust update intervals
   - Improve visual appearance
   - Test in various terminals
   - Handle edge cases

**Deliverables**:
- ✅ `src/workflow/progress-indicator.ts`
- ✅ Progress integration in ConfirmationHandler
- ✅ Progress indicator tests
- ✅ Clean terminal behavior

**Validation Criteria**:
- Progress displays correctly
- No terminal pollution
- Clean cleanup on stop
- Configurable behavior

---

### Phase 4: Integration and Testing (Days 4-5)

**Goal**: Complete FSM integration and comprehensive testing

**Tasks**:

1. **FSM Integration** (3 hours)
   - Update StateMachine to use ConfirmationHandler
   - Handle confirmation before state execution
   - Route based on confirmation results
   - Add confirmation to execution context
   - Test with FSM engine

2. **Interface Updates** (2 hours)
   - Update `src/workflow/interfaces.ts` if needed
   - Ensure ConfirmationConfig compatibility
   - Add confirmation types to exports
   - Update `src/workflow/index.ts`

3. **Comprehensive Testing** (4 hours)
   - FSM integration tests
   - Real command execution tests
   - Edge case testing
   - Performance validation
   - Security testing

4. **Documentation** (1 hour)
   - Add JSDoc comments
   - Create usage examples
   - Document configuration options
   - Update integration guides

**Deliverables**:
- ✅ FSM integration complete
- ✅ Full test coverage (>90%)
- ✅ Documentation and examples
- ✅ All requirements met

**Validation Criteria**:
- All tests passing
- FSM integration working
- Performance targets met
- Code coverage >90%
- Documentation complete

---

## Performance Targets

### Execution Time Budget

| Operation | Target | Maximum |
|-----------|--------|---------|
| Confirmation prompt display | <50ms | <100ms |
| --yes flag override | <1ms | <5ms |
| Progress indicator updates | <10ms | <50ms |
| Timeout enforcement | <5ms overhead | <20ms |
| Resource cleanup | <5ms | <20ms |

### Memory Usage Targets

| Component | Target | Maximum |
|-----------|--------|---------|
| ConfirmationHandler instance | <2KB | <5KB |
| TimeoutManager per confirmation | <500B | <1KB |
| ProgressIndicator instance | <1KB | <2KB |
| Total overhead per confirmation | <5KB | <10KB |

### Resource Efficiency

- **Minimal Overhead**: Confirmation system adds <10ms to state execution
- **Clean Cleanup**: All resources released within 5ms of completion
- **Memory Efficiency**: No memory leaks over extended workflows
- **CPU Usage**: Progress updates use <1% CPU

---

## Security Considerations

### Command Injection Prevention

**Strategy**: Comprehensive shell escaping for all user-facing text

```typescript
// All confirmation messages must be escaped
static escapePromptText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')    // Backslashes first
    .replace(/'/g, "'\"'\"'")  // Single quotes
    .replace(/"/g, '\\"')      // Double quotes
    .replace(/`/g, '\\`')      // Backticks (command substitution)
    .replace(/\$/g, '\\$')     // Dollar signs (variable expansion)
    .replace(/\n/g, '\\n')     // Newlines
    .replace(/\r/g, '\\r');    // Carriage returns
}
```

**Validation**: All confirmation messages validated before escaping

### Timeout Enforcement

**Strategy**: Hard limits on timeout values

```typescript
private validateTimeout(timeoutMs?: number): number {
  const maxTimeout = 5 * 60 * 1000; // 5 minutes maximum
  const minTimeout = 1000;          // 1 second minimum
  
  if (!timeoutMs) return this.defaultTimeout;
  
  // Enforce limits
  return Math.max(minTimeout, Math.min(timeoutMs, maxTimeout));
}
```

### Resource Protection

**Strategy**: Limit concurrent confirmations

```typescript
private readonly MAX_CONCURRENT_CONFIRMATIONS = 5;
private activeConfirmations = new Set<Promise<ConfirmationResult>>();

async requestConfirmation(...): Promise<ConfirmationResult> {
  if (this.activeConfirmations.size >= this.MAX_CONCURRENT_CONFIRMATIONS) {
    throw new Error('Too many concurrent confirmation requests');
  }
  
  const promise = this.executeConfirmation(...);
  this.activeConfirmations.add(promise);
  
  try {
    return await promise;
  } finally {
    this.activeConfirmations.delete(promise);
  }
}
```

---

## Integration Points

### With CommandExecutor (Task 100_2_10)

**Pattern**: Composition - ConfirmationHandler uses CommandExecutor

```typescript
// ConfirmationHandler delegates to CommandExecutor
async requestConfirmation(...): Promise<ConfirmationResult> {
  const command = ConfirmationBuilder.buildTimedConfirmation(...);
  
  const result = await this.executor.executeCommand('bash', ['-c', command], {
    timeout: options.timeout,
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
```

### With FSM Engine (Task 100_1_20)

**Pattern**: Pre-execution hook - confirmation before state execution

```typescript
// StateMachine checks for confirmation before executing state
async executeState(stateName: string, options: ExecutionOptions) {
  const state = this.workflow.states[stateName];
  
  // Handle confirmation if configured
  if (state.confirmation) {
    const result = await this.confirmationHandler?.requestConfirmation(
      state.confirmation.message || `Execute ${stateName}?`,
      {
        timeout: state.confirmation.timeout,
        defaultResponse: state.confirmation.defaultAccept,
        yesFlag: options.yesFlag
      }
    );
    
    if (!result?.confirmed) {
      // Route to failure transition
      return {
        success: false,
        nextState: state.transitions.failure,
        confirmationResult: result
      };
    }
  }
  
  // Continue with state execution...
}
```

### With CLI (Task 100_3_20)

**Pattern**: Flag propagation - --yes flag passed through execution context

```typescript
// CLI command propagates --yes flag
program
  .command('run <workflow> <state>')
  .option('-y, --yes', 'Skip all confirmations')
  .action(async (workflow, state, options) => {
    const result = await fsm.executeState(state, {
      yesFlag: options.yes  // Propagate to execution context
    });
  });
```

---

## Next Steps

### Immediate Actions (This Task)
1. Create `confirmation-handler.ts` with main ConfirmationHandler class
2. Implement `confirmation-builder.ts` for safe prompt generation
3. Build `progress-indicator.ts` for user feedback
4. Add `timeout-manager.ts` for timeout coordination
5. Create comprehensive unit and integration tests
6. Update `src/workflow/index.ts` to export new components

### Future Integration Points (Phase 3+)
1. **Task 100_3_20** will integrate CLI command interface with confirmation system
2. **Task 100_4_10** will enhance error handling and logging for confirmations
3. **Task 100_4_20** will add comprehensive testing and documentation

### Dependencies
- **Consumes**: CommandExecutor from task 100_2_10 (already implemented)
- **Consumes**: Logger from `src/utils/logger.ts` (existing)
- **Consumes**: State interfaces from task 100_1_10 (already implemented)
- **Provides**: Confirmation capabilities for FSM engine and CLI integration

---

This implementation plan provides a complete roadmap for building the Confirmation Timeout System that seamlessly integrates with the existing workflow infrastructure while maintaining the bash subprocess approach and providing comprehensive timeout management and user interaction capabilities.
