# Implementation Plan: FSM Core Engine

**Task ID:** 100_1_20  
**Parent Feature:** 100 - Workflow State Machine  
**Priority:** High  
**Implementation Phase:** 1

## Implementation Overview

This implementation creates a lightweight, high-performance finite state machine engine that serves as the execution heart of the workflow system. The FSM engine consumes structured workflow data from the YAML parser (task 100_1_10) and provides deterministic state management with exit code-based transitions.

The implementation follows the architectural decision to avoid XState dependencies while maintaining simplicity and performance. It provides both sequential workflow execution and single-state execution modes, with comprehensive validation and error handling.

Key characteristics:
- Zero external dependencies (pure TypeScript)
- <500ms startup time performance target
- Immutable execution context for safety
- Event-driven architecture for extensibility
- Comprehensive validation and error reporting

## Component Details

### 1. Execution Context Types (`src/workflow/execution-context.ts`)

Defines immutable data structures for workflow execution:

```typescript
// Immutable execution context for workflow data
export interface ExecutionContext {
  readonly workflowName: string;
  readonly startedAt: Date;
  readonly variables: Record<string, string>; // For future templating
  readonly metadata: Record<string, unknown>; // Extensibility
}

// Result of individual state execution
export interface StateExecutionResult {
  stateName: string;
  exitCode: number;
  executedAt: Date;
  duration: number; // milliseconds
  output?: string; // For logging/debugging
}

// Complete workflow execution result
export interface ExecutionResult {
  success: boolean;
  finalState: string;
  stateHistory: StateHistoryEntry[];
  totalDuration: number;
  error?: Error;
}

// Individual state history entry
export interface StateHistoryEntry {
  stateName: string;
  enteredAt: Date;
  exitedAt: Date;
  exitCode: number;
  duration: number;
  transitionedTo: string | null; // null = terminal state
}

// Command execution options (for future integration)
export interface ExecutionOptions {
  timeout?: number;
  cwd?: string;
  env?: Record<string, string>;
}

// Command execution result (interface for Phase 2)
export interface CommandResult {
  exitCode: number;
  stdout?: string;
  stderr?: string;
  duration: number;
}

// Interface for state execution coordinator (Phase 2 integration)
export interface StateExecutionCoordinator {
  executeCommand(
    command: string,
    args: string[],
    options: ExecutionOptions
  ): Promise<CommandResult>;
}
```

### 2. Main StateMachine Class (`src/workflow/fsm.ts`)

The core orchestrator for workflow execution:

```typescript
import { Workflow, State } from './interfaces';
import { ExecutionContext, ExecutionResult, StateExecutionResult, StateHistoryEntry } from './execution-context';
import { StateTransitionValidator } from './state-validator';
import { Logger } from '../utils/logger';

export class StateMachine {
  private currentState: string;
  private context: ExecutionContext;
  private stateHistory: StateHistoryEntry[];
  private executor?: StateExecutionCoordinator; // Optional for Phase 1

  constructor(
    private workflow: Workflow,
    private logger?: Logger,
    executor?: StateExecutionCoordinator
  ) {
    // Validate workflow structure on construction
    const validationResult = StateTransitionValidator.validateWorkflow(workflow);
    if (!validationResult.valid) {
      throw new WorkflowValidationError(
        `Invalid workflow structure: ${validationResult.errors.join(', ')}`,
        workflow.name,
        'structure'
      );
    }

    this.currentState = workflow.initialState;
    this.stateHistory = [];
    this.executor = executor;
    this.context = {
      workflowName: workflow.name,
      startedAt: new Date(),
      variables: {},
      metadata: {}
    };
  }

  // Factory method for easy construction
  static fromWorkflowName(
    workflowName: string,
    workspacePath: string,
    logger?: Logger
  ): StateMachine {
    const parser = new WorkflowParser(logger);
    const workflow = parser.getWorkflow(workflowName, workspacePath);
    return new StateMachine(workflow, logger);
  }

  // Core execution methods
  async execute(): Promise<ExecutionResult>;
  async executeState(stateName: string): Promise<StateExecutionResult>;

  // State management
  getCurrentState(): string;
  canTransition(exitCode: number): boolean;
  transition(exitCode: number): TransitionResult;

  // Context management
  getContext(): Readonly<ExecutionContext>;
  updateContext(updates: Partial<ExecutionContext>): void;

  // History and debugging
  getStateHistory(): ReadonlyArray<StateHistoryEntry>;
  getExecutionSummary(): ExecutionSummary;
}
```

### 3. State Transition Validator (`src/workflow/state-validator.ts`)

Safety layer for workflow validation:

```typescript
import { Workflow, State } from './interfaces';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CircularityResult {
  hasCircularity: boolean;
  cycles: string[][];
}

export class StateTransitionValidator {
  // Validate complete workflow structure
  static validateWorkflow(workflow: Workflow): ValidationResult;

  // Validate individual state transition
  static validateTransition(
    fromState: string,
    toState: string,
    workflow: Workflow
  ): boolean;

  // Detect circular dependencies
  static detectCircularTransitions(workflow: Workflow): CircularityResult;

  // Find terminal states (states with no outgoing transitions)
  static findTerminalStates(workflow: Workflow): string[];

  // Validate all transition targets exist
  static validateTransitionTargets(workflow: Workflow): ValidationResult;

  // Check for unreachable states
  static findUnreachableStates(workflow: Workflow): string[];

  // Validate initial state exists
  static validateInitialState(workflow: Workflow): ValidationResult;
}
```

### 4. FSM-Specific Error Classes (`src/workflow/errors.ts` - Extended)

Add new error types to existing error file:

```typescript
// Add to existing errors.ts file

export class StateTransitionError extends Error {
  constructor(
    message: string,
    public readonly fromState: string,
    public readonly exitCode: number,
    public readonly workflowName: string
  ) {
    super(message);
    this.name = 'StateTransitionError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StateTransitionError);
    }
  }
}

export class WorkflowExecutionError extends Error {
  constructor(
    message: string,
    public readonly workflowName: string,
    public readonly currentState: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'WorkflowExecutionError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WorkflowExecutionError);
    }
  }
}

export class StateNotFoundError extends Error {
  constructor(
    message: string,
    public readonly stateName: string,
    public readonly workflowName: string
  ) {
    super(message);
    this.name = 'StateNotFoundError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StateNotFoundError);
    }
  }
}
```

## Data Structures

### File Structure
```
src/workflow/
├── interfaces.ts          # [EXISTING] From task 100_1_10
├── parser.ts              # [EXISTING] From task 100_1_10
├── validator.ts           # [EXISTING] From task 100_1_10
├── errors.ts              # [EXISTING] From task 100_1_10 (extend)
├── fsm.ts                 # [NEW] Main StateMachine class
├── execution-context.ts   # [NEW] ExecutionContext and result types
├── state-validator.ts     # [NEW] StateTransitionValidator
└── index.ts               # [UPDATE] Export FSM classes
```

### State Transition Logic
```typescript
// Exit code routing strategy
interface ExitCodeRouting {
  0: 'success',           // Standard success
  1-255: 'failure',       // Standard failure codes
  timeout: 'timeout'      // Special timeout handling (Phase 3)
}

// Transition resolution logic
private getNextState(exitCode: number): string | null {
  const currentState = this.workflow.states[this.currentState];
  
  if (exitCode === 0 && currentState.transitions.success) {
    return currentState.transitions.success;
  }
  
  if (exitCode !== 0 && currentState.transitions.failure) {
    return currentState.transitions.failure;
  }
  
  // No transition = terminal state
  return null;
}
```

### Execution Flow
```typescript
// Sequential execution flow
async execute(): Promise<ExecutionResult> {
  const startTime = Date.now();
  let currentState = this.workflow.initialState;
  
  this.logger?.info(`Starting workflow: ${this.workflow.name}`);
  
  while (currentState) {
    this.logger?.debug(`Executing state: ${currentState}`);
    
    // Execute state (stub for Phase 1)
    const result = await this.executeState(currentState);
    
    // Record in history
    this.recordStateExecution(result);
    
    // Determine next state
    currentState = this.getNextState(result.exitCode);
  }
  
  const totalDuration = Date.now() - startTime;
  this.logger?.info(`Workflow completed in ${totalDuration}ms`);
  
  return {
    success: true,
    finalState: this.currentState,
    stateHistory: this.stateHistory,
    totalDuration
  };
}
```

## API Design

### Public Interface
```typescript
// Import the FSM engine
import { StateMachine } from './workflow';

// Create from workflow definition
const fsm = new StateMachine(workflow, logger);

// Create from workflow name (convenience)
const fsm = StateMachine.fromWorkflowName('deploy', workspacePath, logger);

// Execute complete workflow
const result = await fsm.execute();

// Execute single state
const stateResult = await fsm.executeState('build');

// Get current state and context
const currentState = fsm.getCurrentState();
const context = fsm.getContext();

// Get execution history
const history = fsm.getStateHistory();
```

### Error Handling Pattern
```typescript
try {
  const fsm = new StateMachine(workflow, logger);
  const result = await fsm.execute();
  
  if (!result.success) {
    logger.error(`Workflow failed at state: ${result.finalState}`);
    process.exit(1);
  }
  
} catch (error) {
  if (error instanceof WorkflowValidationError) {
    logger.error(`Workflow validation failed: ${error.message}`);
  } else if (error instanceof StateTransitionError) {
    logger.error(`Transition error: ${error.message}`);
  } else if (error instanceof WorkflowExecutionError) {
    logger.error(`Execution error: ${error.message}`);
  }
  process.exit(1);
}
```

### Integration with Logger
```typescript
// Follow existing Logger pattern
class StateMachine {
  private logger: Logger;
  
  constructor(workflow: Workflow, logger?: Logger) {
    this.logger = logger || new Logger();
  }
  
  private logTransition(from: string, to: string, exitCode: number): void {
    this.logger.debug(
      `State transition: ${from} → ${to} (exit code: ${exitCode})`
    );
  }
  
  private logStateExecution(stateName: string, duration: number): void {
    this.logger.info(
      `State '${stateName}' executed in ${duration}ms`
    );
  }
}
```

## Testing Strategy

### Unit Tests

#### StateMachine Tests (`tests/workflow/fsm.test.ts`)
- Constructor validation with invalid workflows
- State transition logic with various exit codes
- Context management and immutability
- State history tracking
- Error handling and propagation
- Factory method functionality

#### StateTransitionValidator Tests (`tests/workflow/state-validator.test.ts`)
- Valid workflow structure validation
- Invalid workflow detection (missing states, invalid transitions)
- Circular dependency detection
- Terminal state verification
- Unreachable state detection
- Initial state validation

#### ExecutionContext Tests (`tests/workflow/execution-context.test.ts`)
- Interface type compliance
- Immutability verification
- Context update functionality
- History entry creation

### Integration Tests

#### Parser Integration (`tests/workflow/fsm-parser-integration.test.ts`)
- Load workflow from YAML parser
- Validate parsed workflow execution
- Error propagation from parser to FSM
- End-to-end workflow execution with real YAML

#### Logger Integration (`tests/workflow/fsm-logger-integration.test.ts`)
- Debug logging for transitions
- Info logging for workflow lifecycle
- Error logging with proper context
- Silent/verbose mode compatibility

### Test Fixtures

#### Mock Workflows (`tests/workflow/fixtures/test-workflows.ts`)
```typescript
export const simpleWorkflow: Workflow = {
  name: 'test-simple',
  initialState: 'start',
  states: {
    start: {
      command: 'echo "hello"',
      transitions: { success: 'end' }
    },
    end: {
      command: 'echo "done"',
      transitions: {}
    }
  }
};

export const branchingWorkflow: Workflow = {
  name: 'test-branching',
  initialState: 'check',
  states: {
    check: {
      command: 'test -f file.txt',
      transitions: { 
        success: 'process', 
        failure: 'create' 
      }
    },
    create: {
      command: 'touch file.txt',
      transitions: { success: 'process' }
    },
    process: {
      command: 'cat file.txt',
      transitions: {}
    }
  }
};

export const circularWorkflow: Workflow = {
  name: 'test-circular',
  initialState: 'a',
  states: {
    a: {
      command: 'echo "a"',
      transitions: { success: 'b' }
    },
    b: {
      command: 'echo "b"',
      transitions: { success: 'c' }
    },
    c: {
      command: 'echo "c"',
      transitions: { success: 'a' } // Circular reference
    }
  }
};
```

#### Mock Executor (`tests/workflow/mocks/mock-executor.ts`)
```typescript
class MockStateExecutor implements StateExecutionCoordinator {
  constructor(
    private exitCodeMap: Record<string, number> = {},
    private delayMap: Record<string, number> = {}
  ) {}
  
  async executeCommand(
    command: string,
    args: string[],
    options: ExecutionOptions
  ): Promise<CommandResult> {
    const delay = this.delayMap[command] || 10;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    const exitCode = this.exitCodeMap[command] ?? 0;
    
    return {
      exitCode,
      stdout: `Mock output for: ${command}`,
      stderr: '',
      duration: delay
    };
  }
}
```

### Performance Tests

#### Startup Time (`tests/workflow/fsm-performance.test.ts`)
- FSM initialization <10ms
- Workflow validation <20ms
- Context setup <5ms
- Total FSM overhead <35ms

#### Runtime Performance
- State transition <1ms (excluding command execution)
- Context updates <1ms
- History recording <1ms
- Validation checks <5ms

## Development Phases

### Phase 1: Core Structure (Day 1)
1. **Create Execution Context Types**
   - Implement `execution-context.ts` with all interfaces
   - Add comprehensive JSDoc documentation
   - Ensure immutability with `readonly` properties

2. **Implement Basic StateMachine**
   - Constructor with workflow validation
   - State tracking and basic getters
   - Context management methods
   - Logger integration following existing patterns

3. **Add Error Classes**
   - Extend existing `errors.ts` with FSM-specific errors
   - Include context information (state names, exit codes)
   - Test error message formatting

### Phase 2: Transition Logic (Day 1-2)
1. **Implement Exit Code Routing**
   - Add `getNextState()` method
   - Handle success/failure transitions
   - Support terminal state detection

2. **Add State History Tracking**
   - Implement `recordStateExecution()` method
   - Track timestamps, durations, and transitions
   - Provide history access methods

3. **Create StateTransitionValidator**
   - Implement workflow structure validation
   - Add circular dependency detection
   - Validate transition targets

### Phase 3: Execution Modes (Day 2-3)
1. **Sequential Workflow Execution**
   - Implement `execute()` method
   - Add state iteration loop
   - Handle workflow completion

2. **Single-State Execution**
   - Implement `executeState()` method
   - Add state validation
   - Prepare for Phase 2 integration

3. **Factory Methods**
   - Add `StateMachine.fromWorkflowName()`
   - Add `StateMachine.fromWorkflowDefinition()`
   - Ensure consistent error handling

### Phase 4: Integration & Polish (Day 3-4)
1. **Comprehensive Testing**
   - Unit tests for all components
   - Integration tests with YAML parser
   - Performance benchmarks
   - Error handling validation

2. **Logger Integration**
   - Debug logging for all transitions
   - Info logging for workflow lifecycle
   - Error logging with context
   - Silent mode compatibility

3. **Documentation & Examples**
   - API documentation with examples
   - Integration patterns for other components
   - Performance optimization notes

## Critical Implementation Details

### Performance Optimization

#### Fast State Lookup
```typescript
// Use direct object property access (O(1))
const state = this.workflow.states[stateName];

// Avoid array iteration for performance
```

#### Minimal Object Creation
```typescript
// Reuse context object, update immutably
this.context = { ...this.context, ...updates };

// Avoid creating new objects in hot paths
```

#### Efficient History Tracking
```typescript
// Pre-allocate array if max states known
private stateHistory: StateHistoryEntry[] = [];

// Use push() instead of spread for better performance
this.stateHistory.push(entry);
```

### Security Considerations

#### Input Validation
- Validate workflow structure before execution
- Ensure state names are safe identifiers
- Check transition targets exist
- Validate timeout values are reasonable

#### Safe State Transitions
- Prevent infinite loops with max iteration limit
- Detect circular dependencies during validation
- Enforce terminal states exist in workflow
- Track execution time to prevent runaway workflows

### Integration Patterns

#### **IMPORTANT**: Reuse Parser Infrastructure
- Import from `src/workflow/interfaces.ts` and `src/workflow/parser.ts`
- Avoid duplication of type definitions
- Ensure consistency between parser and executor

#### **IMPORTANT**: Logger Integration
- Follow existing Logger pattern from utils
- Debug logging for transitions
- Info logging for workflow lifecycle
- Respect silent/verbose modes

#### **IMPORTANT**: Preparation for Command Executor
- Define `StateExecutionCoordinator` interface now
- Implement in Phase 2 (task 100_2_10)
- FSM engine depends on interface, not implementation

### Error Handling Strategy

#### Validation Errors (Construction Time)
```typescript
try {
  const fsm = new StateMachine(workflow, logger);
} catch (error) {
  if (error instanceof WorkflowValidationError) {
    logger.error(`Workflow validation failed: ${error.message}`);
    process.exit(1);
  }
}
```

#### Runtime Errors (Execution Time)
```typescript
try {
  const result = await fsm.execute();
  if (!result.success) {
    logger.error(`Workflow failed at state: ${result.finalState}`);
  }
} catch (error) {
  if (error instanceof StateTransitionError) {
    logger.error(`Transition error: ${error.message}`);
  } else if (error instanceof WorkflowExecutionError) {
    logger.error(`Execution error: ${error.message}`);
  }
}
```

## Performance Targets

### Startup Time Budget (<500ms total)
- Workflow parsing: <50ms (handled by parser task)
- FSM initialization: <10ms
- Workflow validation: <20ms
- Context setup: <5ms
- **FSM overhead budget: <35ms**

### Runtime Performance
- State transition: <1ms (excluding command execution)
- Context updates: <1ms
- History recording: <1ms
- Validation checks: <5ms

### Memory Efficiency
- Workflow definition: ~10KB
- Execution context: ~1KB
- State history: ~1KB per state
- Total FSM overhead: <50KB

## Integration Requirements

### Dependencies
- **Consumes**: Workflow definitions from task 100_1_10 (yaml-workflow-parser)
- **Provides**: FSM execution engine for task 100_2_10 (command-executor-tui)
- **Integrates**: Logger from `src/utils/logger.ts`

### Future Integration Points
1. **Task 100_2_10** will implement `StateExecutionCoordinator`
2. **Task 100_2_20** will add argument templating to context
3. **Task 100_3_10** will integrate timeout handling
4. **Task 100_3_20** will add CLI command interface

### Critical Constraints
- **NO XState dependency** - Custom implementation required
- **<500ms startup time** - Performance optimization critical
- **Zero external dependencies** - Pure TypeScript implementation
- **Exit code-based routing** - Unix convention compliance
- **Immutable context** - Safety and predictability

This implementation plan provides a solid, performant foundation for the workflow state machine while maintaining clean boundaries for future integration with command execution and argument templating systems.