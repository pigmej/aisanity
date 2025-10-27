# Architectural Analysis: FSM Core Engine

**Task ID:** 100_1_20  
**Parent Feature:** 100 - Workflow State Machine  
**Priority:** High  
**Implementation Phase:** 1  

## Context Analysis

This task builds the execution heart of the workflow state machine feature. The FSM engine must consume the structured workflow data from the YAML parser (task 100_1_10) and provide a reliable, performant state management system that handles transitions based on exit codes.

The FSM engine serves as the orchestration layer between the parser (which provides workflow definitions) and the command executor (which will run the actual commands). It must maintain execution context, validate state transitions, support both sequential and single-state execution modes, and meet strict performance requirements (<500ms startup).

**Critical Design Constraint:** This is a custom implementation specifically designed to avoid XState dependencies while maintaining simplicity and performance. The engine must be lightweight, deterministic, and integrate seamlessly with existing aisanity patterns.

## Technology Recommendations

### **IMPORTANT**: Custom TypeScript FSM Implementation
- **Technology**: Pure TypeScript class-based state machine
- **Rationale**: 
  - Zero external dependencies (as per feature architecture)
  - Full control over performance optimization
  - Tailored to exit code-based transition requirements
  - Meets <500ms startup requirement
- **Impact**: Custom code to maintain, but optimal for requirements

### **IMPORTANT**: Event-Driven Architecture Pattern
- **Technology**: Event emitter pattern for state change notifications
- **Rationale**: 
  - Decouples state transitions from side effects
  - Enables future extensions (logging, monitoring, hooks)
  - Standard JavaScript/TypeScript pattern
- **Impact**: Clean separation of concerns, testable transitions

### **IMPORTANT**: Immutable Execution Context
- **Technology**: TypeScript readonly properties with object spreading
- **Rationale**: 
  - Prevents accidental state mutations
  - Easier to debug and reason about
  - Facilitates testing and state snapshots
- **Impact**: Predictable state management, reduced bugs

### **IMPORTANT**: Reuse Parser Infrastructure
- **Technology**: Import from `src/workflow/interfaces.ts` and `src/workflow/parser.ts`
- **Rationale**: 
  - Task 100_1_10 provides complete workflow data structures
  - Avoid duplication of type definitions
  - Ensure consistency between parser and executor
- **Impact**: Cleaner integration, reduced code duplication

## System Architecture

### Core Components

#### 1. StateMachine Class (Primary Orchestrator)
```typescript
class StateMachine {
  private currentState: string;
  private workflow: Workflow;
  private context: ExecutionContext;
  private stateHistory: StateHistoryEntry[];
  
  constructor(workflow: Workflow, initialContext?: Partial<ExecutionContext>);
  
  // Core execution methods
  execute(): Promise<ExecutionResult>;
  executeState(stateName: string): Promise<StateExecutionResult>;
  
  // State management
  getCurrentState(): string;
  canTransition(exitCode: number): boolean;
  transition(exitCode: number): TransitionResult;
  
  // Context management
  getContext(): Readonly<ExecutionContext>;
  updateContext(updates: Partial<ExecutionContext>): void;
}
```

**Responsibilities:**
- Maintain current workflow state
- Validate state transitions based on exit codes
- Manage execution context lifecycle
- Track state history for debugging

#### 2. ExecutionContext (State Container)
```typescript
interface ExecutionContext {
  readonly workflowName: string;
  readonly startedAt: Date;
  readonly variables: Record<string, string>; // For future templating
  readonly metadata: Record<string, unknown>; // Extensibility
}

interface StateExecutionResult {
  stateName: string;
  exitCode: number;
  executedAt: Date;
  duration: number; // milliseconds
  output?: string; // For logging/debugging
}

interface ExecutionResult {
  success: boolean;
  finalState: string;
  stateHistory: StateHistoryEntry[];
  totalDuration: number;
  error?: Error;
}
```

**Responsibilities:**
- Immutable container for workflow execution data
- Track variables for argument templating (future integration)
- Provide metadata for logging and debugging
- Store execution results and timing

#### 3. StateTransitionValidator (Safety Layer)
```typescript
class StateTransitionValidator {
  static validateWorkflow(workflow: Workflow): ValidationResult;
  static validateTransition(
    fromState: string, 
    toState: string, 
    workflow: Workflow
  ): boolean;
  static detectCircularTransitions(workflow: Workflow): CircularityResult;
  static findTerminalStates(workflow: Workflow): string[];
}
```

**Responsibilities:**
- Validate workflow structure before execution
- Detect unreachable states
- Identify circular dependencies
- Ensure all workflows have terminal states

#### 4. StateExecutionCoordinator (Stub for Future Integration)
```typescript
interface StateExecutionCoordinator {
  executeCommand(
    command: string, 
    args: string[], 
    options: ExecutionOptions
  ): Promise<CommandResult>;
}

interface CommandResult {
  exitCode: number;
  stdout?: string;
  stderr?: string;
  duration: number;
}
```

**Responsibilities:**
- **NOTE**: This is a stub interface for task 100_2_10 (command-executor-tui)
- Defines contract for command execution
- Will be implemented in Phase 2
- FSM engine depends on interface, not implementation

### Component Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                     StateMachine                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Workflow Definition (from YAML Parser)            │    │
│  │  - states: Record<string, State>                   │    │
│  │  - initialState: string                            │    │
│  └────────────────────────────────────────────────────┘    │
│                           │                                  │
│  ┌────────────────────────▼────────────────────────────┐   │
│  │  ExecutionContext (Immutable)                       │   │
│  │  - currentState: string                             │   │
│  │  - variables: Record<string, string>                │   │
│  │  - stateHistory: StateHistoryEntry[]                │   │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────▼────────────────────────────┐   │
│  │  State Transition Logic                             │   │
│  │  - Exit code → State mapping                        │   │
│  │  - Transition validation                            │   │
│  │  - Terminal state detection                         │   │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
           │                              │
           │                              │
      ┌────▼────┐                   ┌─────▼─────┐
      │ Logger  │                   │ Validator │
      │ (utils) │                   │ (safety)  │
      └─────────┘                   └───────────┘
```

### File Structure

```
src/
├── workflow/
│   ├── interfaces.ts          # [EXISTING] From task 100_1_10
│   ├── parser.ts              # [EXISTING] From task 100_1_10
│   ├── validator.ts           # [EXISTING] From task 100_1_10
│   ├── errors.ts              # [EXISTING] From task 100_1_10
│   ├── fsm.ts                 # [NEW] Main StateMachine class
│   ├── execution-context.ts  # [NEW] ExecutionContext and result types
│   ├── state-validator.ts    # [NEW] StateTransitionValidator
│   └── index.ts               # [UPDATE] Export FSM classes
```

## Integration Patterns

### **IMPORTANT**: Integration with YAML Parser (Task 100_1_10)

**Pattern**: Constructor Dependency Injection
```typescript
import { WorkflowParser } from './parser';
import { Workflow } from './interfaces';

class StateMachine {
  constructor(
    private workflow: Workflow,
    private logger?: Logger
  ) {
    // Validate workflow structure on construction
    StateTransitionValidator.validateWorkflow(workflow);
  }
  
  static fromWorkflowName(
    workflowName: string, 
    workspacePath: string,
    logger?: Logger
  ): StateMachine {
    const parser = new WorkflowParser(logger);
    const workflow = parser.getWorkflow(workflowName, workspacePath);
    return new StateMachine(workflow, logger);
  }
}
```

**Benefits:**
- Clean separation between parsing and execution
- Testable with mock workflows
- Reuses all parser validation logic

### **IMPORTANT**: Logger Integration

**Pattern**: Optional Logger Injection (Following Existing Pattern)
```typescript
import { Logger } from '../utils/logger';

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
}
```

**Integration Points:**
- Debug logging for all state transitions
- Info logging for workflow start/completion
- Error logging for validation failures
- Respects silent/verbose modes from logger instance

### **IMPORTANT**: Preparation for Command Executor (Task 100_2_10)

**Pattern**: Interface-Based Dependency (Future Integration Point)
```typescript
// Define interface now, implement in Phase 2
interface StateExecutionCoordinator {
  executeCommand(
    command: string,
    args: string[],
    options: ExecutionOptions
  ): Promise<CommandResult>;
}

class StateMachine {
  constructor(
    private workflow: Workflow,
    private executor?: StateExecutionCoordinator, // Optional for Phase 1
    private logger?: Logger
  ) {}
  
  async executeState(stateName: string): Promise<StateExecutionResult> {
    const state = this.workflow.states[stateName];
    
    if (!this.executor) {
      // Phase 1: Return mock result for testing
      throw new Error('State executor not configured');
    }
    
    // Phase 2: Actual execution
    const result = await this.executor.executeCommand(
      state.command,
      state.args || [],
      { timeout: state.timeout }
    );
    
    return {
      stateName,
      exitCode: result.exitCode,
      executedAt: new Date(),
      duration: result.duration
    };
  }
}
```

**Benefits:**
- FSM engine testable without command executor
- Clear contract for Phase 2 integration
- Separation of concerns maintained

### **IMPORTANT**: Error Handling Integration

**Pattern**: Reuse Existing Workflow Errors
```typescript
import { 
  WorkflowValidationError 
} from './errors';

// Add new FSM-specific errors
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
```

## Implementation Guidance

### Phase 1: Core FSM Structure (Day 1)

1. **Define Execution Context Types**
   - Create `execution-context.ts` with all result interfaces
   - Ensure immutability with `readonly` properties
   - Add JSDoc comments for all interfaces

2. **Implement StateMachine Class**
   - Basic constructor with workflow validation
   - State tracking and history management
   - Simple state getters and setters

3. **Add Logger Integration**
   - Follow existing Logger pattern from utils
   - Debug logging for transitions
   - Info logging for workflow lifecycle

### Phase 2: Transition Logic (Day 1-2)

1. **Implement Exit Code-Based Routing**
   ```typescript
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

2. **Implement Transition Validation**
   - Check target state exists
   - Prevent invalid transitions
   - Handle timeout transitions (preparation for Phase 3)

3. **Add State History Tracking**
   - Record all transitions with timestamps
   - Track exit codes and durations
   - Provide history access for debugging

### Phase 3: Validation Layer (Day 2)

1. **Implement StateTransitionValidator**
   - Workflow structure validation
   - Circular dependency detection
   - Terminal state verification
   - Unreachable state detection

2. **Add Pre-Execution Validation**
   ```typescript
   constructor(workflow: Workflow, logger?: Logger) {
     const validationResult = StateTransitionValidator.validateWorkflow(workflow);
     
     if (!validationResult.valid) {
       throw new WorkflowValidationError(
         `Invalid workflow structure: ${validationResult.errors.join(', ')}`,
         workflow.name,
         'structure'
       );
     }
     
     // Continue with initialization
   }
   ```

3. **Create Helpful Error Messages**
   - Suggest corrections for common mistakes
   - Include state names in error messages
   - Provide validation context

### Phase 4: Execution Modes (Day 2-3)

1. **Sequential Workflow Execution**
   ```typescript
   async execute(): Promise<ExecutionResult> {
     const startTime = Date.now();
     let currentState = this.workflow.initialState;
     
     while (currentState) {
       this.logger.debug(`Executing state: ${currentState}`);
       
       // Execute state (stub for Phase 1)
       const result = await this.executeState(currentState);
       
       // Record in history
       this.recordStateExecution(result);
       
       // Determine next state
       currentState = this.getNextState(result.exitCode);
     }
     
     return {
       success: true,
       finalState: this.currentState,
       stateHistory: this.stateHistory,
       totalDuration: Date.now() - startTime
     };
   }
   ```

2. **Single-State Execution Mode**
   ```typescript
   async executeState(stateName: string): Promise<StateExecutionResult> {
     // Validate state exists
     if (!this.workflow.states[stateName]) {
       throw new WorkflowValidationError(
         `State '${stateName}' not found in workflow`,
         this.workflow.name,
         'states'
       );
     }
     
     // For Phase 1: Return mock result
     // For Phase 2: Call executor
     return {
       stateName,
       exitCode: 0, // Mock success
       executedAt: new Date(),
       duration: 0
     };
   }
   ```

3. **Add Factory Methods**
   - `StateMachine.fromWorkflowName()` for easy construction
   - `StateMachine.fromWorkflowDefinition()` for testing
   - Consistent error handling across all factories

### Critical Implementation Details

#### Exit Code Routing Strategy
```typescript
interface ExitCodeRouting {
  0: 'success',           // Standard success
  1-255: 'failure',       // Standard failure codes
  timeout: 'timeout'      // Special timeout handling (Phase 3)
}
```

**Implementation:**
- Exit code 0 always routes to success transition
- Any non-zero exit code routes to failure transition
- Timeout is handled separately (future integration)

#### State History Design
```typescript
interface StateHistoryEntry {
  stateName: string;
  enteredAt: Date;
  exitedAt: Date;
  exitCode: number;
  duration: number;
  transitionedTo: string | null; // null = terminal state
}
```

**Benefits:**
- Complete audit trail of execution
- Debugging support for failures
- Performance analysis data
- Foundation for future monitoring

#### Performance Optimization Techniques

1. **Fast State Lookup**
   ```typescript
   // Use direct object property access (O(1))
   const state = this.workflow.states[stateName];
   
   // Avoid array iteration
   ```

2. **Minimal Object Creation**
   ```typescript
   // Reuse context object, update immutably
   this.context = { ...this.context, ...updates };
   
   // Avoid creating new objects in hot paths
   ```

3. **Lazy Validation**
   ```typescript
   // Validate workflow structure once on construction
   // Don't re-validate on every transition
   ```

4. **Efficient History Tracking**
   ```typescript
   // Pre-allocate array if max states known
   private stateHistory: StateHistoryEntry[] = [];
   
   // Use push() instead of spread for better performance
   this.stateHistory.push(entry);
   ```

### Testing Strategy

#### Unit Tests (Test Each Component Independently)

1. **StateMachine Tests**
   - Constructor validation
   - State transition logic
   - Exit code routing
   - Context management
   - Error handling

2. **StateTransitionValidator Tests**
   - Valid workflow structures
   - Invalid workflow detection
   - Circular dependency detection
   - Terminal state verification

3. **Integration Tests with Parser**
   - Load workflow from YAML
   - Validate parsed workflow
   - Execute mock workflow
   - Error propagation

#### Test Fixtures

```typescript
// tests/workflow/fixtures/test-workflows.ts
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
```

#### Mock Command Executor (For Phase 1 Testing)

```typescript
// tests/workflow/mocks/mock-executor.ts
class MockStateExecutor implements StateExecutionCoordinator {
  constructor(
    private exitCodeMap: Record<string, number> = {}
  ) {}
  
  async executeCommand(
    command: string,
    args: string[],
    options: ExecutionOptions
  ): Promise<CommandResult> {
    const exitCode = this.exitCodeMap[command] ?? 0;
    
    return {
      exitCode,
      stdout: `Mock output for: ${command}`,
      stderr: '',
      duration: 10
    };
  }
}
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

#### Context Isolation
- Immutable context prevents accidental mutations
- No shared state between workflow instances
- Clean execution environment per workflow
- Proper cleanup on errors

### Performance Targets

#### Startup Time Budget (<500ms total)
- Workflow parsing: <50ms (handled by parser task)
- FSM initialization: <10ms
- Workflow validation: <20ms
- Context setup: <5ms
- **FSM overhead budget: <35ms**

#### Runtime Performance
- State transition: <1ms (excluding command execution)
- Context updates: <1ms
- History recording: <1ms
- Validation checks: <5ms

#### Memory Efficiency
- Workflow definition: ~10KB
- Execution context: ~1KB
- State history: ~1KB per state
- Total FSM overhead: <50KB

### Error Handling Strategy

#### Validation Errors (Construction Time)
```typescript
try {
  const fsm = new StateMachine(workflow, logger);
} catch (error) {
  if (error instanceof WorkflowValidationError) {
    // Workflow structure invalid
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
    process.exit(1);
  }
} catch (error) {
  if (error instanceof StateTransitionError) {
    // Invalid transition
    logger.error(`Transition error: ${error.message}`);
  } else if (error instanceof WorkflowExecutionError) {
    // Execution failure
    logger.error(`Execution error: ${error.message}`);
  }
  process.exit(1);
}
```

#### Graceful Degradation
- On validation error: Fail fast with clear message
- On transition error: Report current state and exit code
- On execution error: Preserve state history for debugging
- Always exit cleanly, never leave hanging processes

## Considerations

### Scalability

#### Workflow Complexity
- Support 50+ state workflows without performance degradation
- Handle deeply nested state transitions efficiently
- Scale memory usage linearly with workflow size
- Maintain <1ms transition overhead regardless of workflow size

#### Future Extensions
- Architecture supports async state handlers (Phase 2)
- Prepared for parallel state execution (future)
- Event system enables monitoring/logging hooks
- Immutable context allows state snapshots

### Maintainability

#### Code Organization
- Clear separation: FSM logic, validation, context management
- Single Responsibility Principle for all classes
- Comprehensive type definitions for safety
- JSDoc comments for all public APIs

#### Extensibility Points
- Interface-based executor integration
- Event emitter for lifecycle hooks
- Pluggable validators for custom rules
- Flexible context metadata for extensions

#### Testing Strategy
- 100% unit test coverage for core FSM logic
- Integration tests with real workflow YAML
- Performance benchmarks for regression detection
- Mock executor for isolated FSM testing

### Security

#### State Transition Safety
- Validation prevents invalid transitions
- Circular dependency detection
- Max iteration limit (1000 states per execution)
- Timeout enforcement (preparation for Phase 3)

#### Execution Isolation
- No global state or shared variables
- Clean context per workflow instance
- Proper error boundaries
- Resource cleanup on termination

### Performance

#### Critical Path Optimization
- Direct object access for state lookup (O(1))
- Minimal object allocations in hot paths
- Lazy evaluation where possible
- Pre-computed validation results

#### Memory Management
- Reuse context objects with immutable updates
- Efficient history tracking with pre-allocated arrays
- No memory leaks from event handlers
- Clear references on workflow completion

## Next Steps

### Immediate Actions (This Task)
1. Create `execution-context.ts` with all type definitions
2. Implement `StateMachine` class with core logic
3. Build `StateTransitionValidator` for safety
4. Add comprehensive unit tests
5. Create integration tests with YAML parser

### Future Integration Points (Phase 2)
1. **Task 100_2_10** will implement `StateExecutionCoordinator`
2. **Task 100_2_20** will add argument templating to context
3. **Task 100_3_10** will integrate timeout handling
4. **Task 100_3_20** will add CLI command interface

### Dependencies
- **Consumes**: Workflow definitions from task 100_1_10 (yaml-workflow-parser)
- **Provides**: FSM execution engine for task 100_2_10 (command-executor-tui)
- **Integrates**: Logger from `src/utils/logger.ts`

This architecture provides a solid, performant foundation for the workflow state machine while maintaining clean boundaries for future integration with command execution and argument templating systems.
