# Implementation Plan: Fix Dry-Run Functionality for CLI Commands

## Implementation Overview

The dry-run functionality needs significant enhancement to provide users with comprehensive workflow execution previews. Currently, the `--dry-run` flag only shows basic placeholder messages and returns incomplete result structures with "undefined" values. This implementation will extend the StateMachine with simulation capabilities and enhance CLI reporting to deliver meaningful execution previews.

### Core Problem Analysis

- **Current State**: Minimal dry-run implementation showing only "Would execute workflow" messages
- **Missing Components**: 
  - State-by-state execution plan simulation
  - Template variable processing and display
  - Timing estimates and execution flow visualization
  - Structured result objects with finalState and totalDuration
- **User Impact**: Users cannot make informed decisions about workflow execution without seeing what would actually happen

### Simulation Assumptions

**Critical Design Decisions**:
- **Exit Code Strategy**: By default, assume success transitions (exit code 0) for all states during simulation
- **Git State Validation**: Do NOT validate actual git state or file existence during dry-run
- **Template Processing**: Process templates but allow undefined variables (show warnings instead of failing)
- **Confirmation Handling**: Detect confirmation prompts but do NOT execute them in dry-run mode
- **Error Behavior**: Continue simulation on template resolution failures, showing warnings for undefined variables

### Implementation Strategy

Extend the existing StateMachine with dry-run simulation methods while maintaining separation between simulation and actual execution. Leverage existing template processing and validation infrastructure to provide accurate previews without side effects.

## Component Details

### 1. DryRunSimulator Class (New Component)

**Purpose**: Handle dry-run execution simulation without running actual commands

```typescript
interface DryRunResult {
  success: boolean;
  finalState: string;
  totalDuration: number;
  executionPlan: ExecutionPlanStep[];
  templateVariables: Record<string, string>;
  warnings: string[];
}

interface ExecutionPlanStep {
  stateName: string;
  description: string;
  command: string;
  args: string[];
  substitutions: Record<string, string>;
  estimatedDuration: number;
  durationConfidence: 'high' | 'medium' | 'low';
  transitionOnSuccess?: string;
  transitionOnFailure?: string;
}
```

**Key Responsibilities**:
- Generate execution path based on workflow structure and transition rules
- Simulate state execution without running commands
- Process template variables in simulation context (allow undefined variables)
- Calculate timing estimates using command lookup table
- Build comprehensive execution preview data with confidence levels
- Detect potential issues and generate warnings

**Implementation Details**:
- Simulate state transitions using existing `getNextState` logic with success assumption
- Use command lookup table for timing estimates (see Timing Estimation Algorithm)
- Process templates with current context variables, allowing undefined variables
- Track execution path and generate warnings for potential issues
- Validate variable injection but allow non-existent paths in dry-run

### 2. Enhanced StateMachine

**New Methods to Add**:

```typescript
// Generate dry-run execution plan
simulateExecution(options?: { 
  startingState?: string; 
  templateVariables?: Record<string, string> 
}): Promise<DryRunResult>;

// Get execution plan without simulation
getExecutionPlan(startingState?: string): ExecutionPlanStep[];

// Estimate timing for execution
estimateTiming(plan: ExecutionPlanStep[]): number;
```

**Integration Points**:
- Reuse existing `getNextState` logic for path prediction (assume success by default)
- Leverage `updateContext` for template variable integration
- Use existing state validation and transition logic
- Call `VariableResolver.resolveBuiltInVariables()` for template processing
- Maintain compatibility with normal execution methods

### 3. Enhanced CLI Integration

**Current Limitations**:
- Basic dry-run message in `executeStateOrWorkflow` (lines 283-294)
- Incomplete result structure missing finalState and totalDuration
- No template variable display
- Minimal execution plan information

**Required Enhancements**:

```typescript
// Enhanced dry-run handling
if (options.dryRun) {
  const dryRunResult = await stateMachine.simulateExecution({
    startingState: stateName,
    templateVariables: templateVariables
  });
  
  return formatDryRunResult(dryRunResult, logger);
}
```

**CLI Help Text Enhancement**:
```bash
--dry-run    Show execution plan without running commands
            Shows: state execution order, timing estimates, template variables,
            and final state. Confirmations are detected but not executed.
```

**Enhanced Result Formatting**:
- Color-coded output using picocolors
- State-by-state breakdown with timing estimates and confidence levels
- Template variable substitutions display (before/after processing)
- Progress indicators for multi-state workflows
- Warning messages for potentially dangerous operations
- Example output format in CLI help text

## Data Structures

### Enhanced DryRunResult Interface

```typescript
interface DryRunResult {
  // Core execution results
  success: boolean;
  finalState: string;
  totalDuration: number;
  
  // Execution plan details
  executionPlan: ExecutionPlanStep[];
  executionPath: string[]; // Ordered list of states that would execute
  
  // Template and context information
  templateVariables: Record<string, string>;
  processedSubstitutions: Record<string, { 
    original: string; 
    processed: string;
    appliedTo: string[]; // Which commands/args used this variable
  }>;
  
  // Metadata and warnings
  warnings: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
  hasConfirmationPrompts: boolean;
  totalConfirmations: number;
}

interface ExecutionPlanStep {
  // State identification
  stateName: string;
  description: string;
  
  // Command information (before template processing)
  rawCommand: string;
  rawArgs: string[];
  
  // Processed command information (after template processing)
  processedCommand: string;
  processedArgs: string[];
  
  // Template substitutions applied
  substitutions: Record<string, string>;
  hasSubstitutions: boolean;
  
  // Timing estimates
  estimatedDuration: number;
  durationConfidence: 'high' | 'medium' | 'low';
  
  // Transition information
  transitionOnSuccess?: string;
  transitionOnFailure?: string;
  isTerminal: boolean;
  
  // Confirmation requirements
  requiresConfirmation: boolean;
  confirmationMessage?: string;
}

### Timing Estimation Algorithm

**Command Lookup Table**:
```typescript
const COMMAND_TIMING_LOOKUP: Record<string, { duration: number; confidence: 'high' | 'medium' | 'low' }> = {
  // Git commands
  'git': { duration: 1000, confidence: 'high' },
  'git checkout': { duration: 1500, confidence: 'high' },
  'git merge': { duration: 3000, confidence: 'medium' },
  'git rebase': { duration: 5000, confidence: 'low' },
  'git pull': { duration: 2000, confidence: 'high' },
  'git push': { duration: 2000, confidence: 'high' },
  
  // Package manager commands
  'npm': { duration: 3000, confidence: 'medium' },
  'npm install': { duration: 5000, confidence: 'high' },
  'yarn': { duration: 3000, confidence: 'medium' },
  'yarn install': { duration: 4000, confidence: 'high' },
  'pnpm': { duration: 2500, confidence: 'medium' },
  
  // Shell commands
  'cd': { duration: 100, confidence: 'high' },
  'mkdir': { duration: 200, confidence: 'high' },
  'cp': { duration: 500, confidence: 'high' },
  'mv': { duration: 500, confidence: 'high' },
  'rm': { duration: 300, confidence: 'high' },
  
  // Build commands
  'build': { duration: 30000, confidence: 'low' },
  'compile': { duration: 30000, confidence: 'low' },
  'test': { duration: 60000, confidence: 'low' },
  
  // Default fallback
  'default': { duration: 1000, confidence: 'low' }
};
```

**Algorithm**:
1. Parse command to identify base command and subcommands
2. Look up timing estimate in COMMAND_TIMING_LOOKUP
3. If not found, use default duration (1000ms) with low confidence
4. For complex commands, add overhead based on argument count
5. Sum all step durations for totalDuration

### Template Variable Context Enhancement

```typescript
interface TemplateVariableContext {
  // Built-in variables (from VariableResolver)
  builtIn: Record<string, string>;
  
  // CLI-provided variables
  cliProvided: Record<string, string>;
  
  // Workflow context variables
  workflowContext: Record<string, string>;
  
  // Combined variables used for template processing
  combined: Record<string, string>;
}
```

## API Design

### StateMachine API Extensions

```typescript
export class StateMachine {
  // Existing methods remain unchanged
  execute(options?: { yesFlag?: boolean }): Promise<ExecutionResult>;
  executeState(stateName: string, options?: { yesFlag?: boolean }): Promise<StateExecutionResult>;
  
  // NEW: Dry-run simulation methods
  simulateExecution(options?: DryRunOptions): Promise<DryRunResult>;
  getExecutionPlan(startingState?: string): ExecutionPlanStep[];
  estimateTiming(plan: ExecutionPlanStep[]): number;
  
  // NEW: Template variable management for dry-run
  getTemplateVariables(): Promise<TemplateVariableContext>;
  validateTemplateVariables(variables: Record<string, string>): ValidationResult;
}

interface DryRunOptions {
  startingState?: string;
  templateVariables?: Record<string, string>;
  includeTimingEstimates?: boolean;
  includeWarnings?: boolean;
  assumeSuccess?: boolean; // Default: true, assume all states succeed
}
```

### CLI Integration API

```typescript
// Enhanced executeStateOrWorkflow function signature
async function executeStateOrWorkflow(
  stateMachine: StateMachine,
  stateName: string | undefined,
  options: ExecuteOptions,
  logger: Logger
): Promise<DryRunResult | ExecutionResult>;

// NEW: Dry-run result formatting
function formatDryRunResult(result: DryRunResult, logger: Logger): void;
function renderExecutionPlan(plan: ExecutionPlanStep[], logger: Logger): void;
function renderTemplateVariables(variables: Record<string, string>, logger: Logger): void;
```

### DryRunSimulator API

```typescript
export class DryRunSimulator {
  constructor(
    private stateMachine: StateMachine,
    private logger?: Logger
  );
  
  simulate(options: DryRunOptions): Promise<DryRunResult>;
  generateExecutionPlan(startingState?: string): ExecutionPlanStep[];
  estimateStepDuration(step: ExecutionPlanStep): number;
  detectPotentialIssues(plan: ExecutionPlanStep[]): string[];
}
```

## Testing Strategy

### Unit Tests

1. **DryRunSimulator Tests**
   - Test execution plan generation for various workflow structures
   - Test timing estimation accuracy
   - Test template variable processing in simulation context
   - Test error handling for invalid workflows

2. **StateMachine Integration Tests**
   - Test `simulateExecution` method with different starting states
   - Test consistency between simulation and actual execution paths
   - Test template variable context integration

3. **CLI Integration Tests**
   - Test dry-run output formatting and color coding
   - Test result structure completeness (finalState, totalDuration, etc.)
   - Test template variable display in dry-run mode

### Integration Tests

1. **End-to-End Dry-Run Tests**
   - Test complete workflow dry-run scenarios
   - Test multi-state workflow execution previews
   - Test confirmation prompt simulation
   - Test complex template variable substitution scenarios

2. **Performance Tests**
   - Test dry-run simulation performance (<100ms for typical workflows)
   - Test memory usage during simulation
   - Test scalability with large workflow definitions

### Test Scenarios

```typescript
// Example test scenarios
describe('Dry-Run Functionality', () => {
  test('should generate complete execution plan for multi-state workflow');
  test('should process template variables correctly in simulation (allowing undefined)');
  test('should provide accurate timing estimates using lookup table');
  test('should display color-coded output for better readability');
  test('should handle confirmation prompts in simulation (detect but not execute)');
  test('should warn about potentially dangerous operations');
  test('should maintain consistency with actual execution paths');
  test('should complete simulation in <100ms for typical workflows');
  test('should handle template resolution failures gracefully');
  test('should work with infinite loop workflows (detect and warn)');
  test('should validate variable injection but allow non-existent paths');
});
```

### Mock and Stub Strategy

- Mock CommandExecutor for simulation (no actual command execution)
- Mock external dependencies (git commands, file system operations)
- Use in-memory workflow definitions for testing
- Mock timing for consistent test results
- Mock template variable resolution with undefined variable scenarios
- Mock infinite loop and edge case workflows

## Development Phases

### Phase 1: Core Dry-Run Simulation (Week 1-2)

**Objective**: Implement basic dry-run simulation functionality

**Tasks**:
1. Design and implement `DryRunSimulator` class (`src/workflow/dry-run-simulator.ts`)
   - Execution plan generation logic
   - State transition simulation (assume success by default)
   - Basic timing estimates using lookup table
   - Template variable processing with undefined variable handling

2. Extend `StateMachine` with simulation methods
   - `simulateExecution()` method with DryRunOptions
   - `getExecutionPlan()` method
   - Integration with existing state validation
   - Update `reportExecutionResult()` to handle `DryRunResult` type

3. Basic CLI integration
   - Replace placeholder dry-run messages
   - Return structured `DryRunResult` objects
   - Basic result formatting with `formatDryRunResult()` helper
   - Update CLI help text with dry-run output example
   - Create `renderExecutionPlan()` and `renderTemplateVariables()` helpers

**Deliverables**:
- Working dry-run simulation that shows execution plan
- Structured results with finalState and totalDuration
- Basic timing estimates with confidence levels
- Template variable processing (allowing undefined variables)
- Color-coded output formatting

### Phase 2: Enhanced Template Integration (Week 3)

**Objective**: Integrate template variable processing into dry-run

**Tasks**:
1. Enhanced template variable context access
   - Call `VariableResolver.resolveBuiltInVariables()` in simulation
   - Process CLI-provided template variables
   - Display variable substitutions in output
   - Show before/after template processing

2. Template validation in dry-run context
   - Validate template syntax without execution
   - Show warnings for undefined variables (don't fail)
   - Display applied substitutions with context
   - Handle template resolution failures gracefully

3. Enhanced result formatting
   - Color-coded template variable display
   - Show variable usage per state
   - Highlight potentially dangerous variable substitutions
   - Progress indicators for multi-state workflows

**Deliverables**:
- Complete template variable processing in dry-run
- Display of template substitutions with warnings for undefined variables
- Enhanced dry-run output with variable context and color coding
- Security validation for variable injection

### Phase 3: Advanced Features and Polish (Week 4)

**Objective**: Add advanced features and improve user experience

**Tasks**:
1. Enhanced timing estimation
   - Command lookup table implementation (Git: 1000ms, npm: 3000ms, etc.)
   - Confidence level assignment based on command type
   - Overhead calculation for complex arguments
   - Total duration calculation with confidence intervals

2. Advanced output formatting
   - Progress indicators for multi-state workflows
   - Color-coded state types and transitions
   - Warning messages for potential issues
   - Example output mockup in documentation
   - Confirmation prompt detection display

3. Error handling and edge cases
   - Infinite loop detection and warning
   - No terminal state handling
   - Template resolution failure behavior
   - Performance optimization for large workflows

**Deliverables**:
- Advanced timing estimates with confidence levels using lookup table
- Rich, color-coded output formatting with example mockups
- Performance-optimized simulation with edge case handling
- Comprehensive warning and validation messages
- Security validation for dry-run mode

### Phase 4: Testing and Documentation (Week 5)

**Objective**: Comprehensive testing and documentation

**Tasks**:
1. Complete test suite implementation
   - Unit tests for all new components
   - Integration tests for end-to-end scenarios
   - Performance and scalability tests

2. User documentation
   - CLI usage examples
   - Output format documentation
   - Best practices guide

3. Code quality and review
   - Code review and refactoring
   - Documentation updates
   - Error handling improvements

**Deliverables**:
- Complete test coverage for dry-run functionality
- Comprehensive user documentation
- Production-ready implementation

## Success Criteria

### Technical Success Metrics

1. **Functionality**
   - Dry-run output includes all required information (finalState, totalDuration, execution plan)
   - No "undefined" values in dry-run output
   - Template variables properly displayed and processed
   - Execution plan shows state-by-state breakdown

2. **Performance**
   - Dry-run simulation completes in <100ms for typical workflows
   - Memory usage remains minimal during simulation
   - No performance impact on normal execution

3. **User Experience**
   - Users can make informed decisions based on dry-run preview
   - Output is clear, readable, and informative
   - Color coding and formatting enhance usability

4. **Integration**
   - Seamless integration with existing StateMachine
   - No breaking changes to existing APIs
   - Consistent with overall system architecture
   - Security validation for variable injection in dry-run mode

### User Experience Success Metrics

1. **Comprehensive Preview**
   - Shows which states would execute in order (with success assumption)
   - Displays estimated timing information using command lookup table
   - Shows template variables that would be used (with undefined variable warnings)
   - Indicates final state that would be reached
   - Clearly shows what commands would run
   - Confirms confirmations are detected but not executed

2. **Decision Support**
   - Users can identify potential issues before execution
   - Clear indication of confirmation prompts required
   - Warning messages for potentially dangerous operations
   - Summary statistics (total states, estimated time, complexity level)
   - Example output format in help text

3. **Usability**
   - Color-coded output for better readability with confidence levels
   - Progress indication for multi-state workflows
   - Clear, structured information presentation
   - Easy to understand execution flow
   - Template variable display showing before/after processing

### Example Dry-Run Output

```bash
$ aisanity state execute my-workflow --dry-run

🔍 DRY RUN: Workflow Execution Preview

📋 Execution Plan:
1. checkout-feature (1.5s) - git checkout feature-branch
2. install-deps (5.0s) - npm install  [CONFIRMATION REQUIRED]
3. run-tests (60.0s) - npm test
4. merge-main (3.0s) - git merge main

🎯 Final State: completed
⏱️  Total Duration: ~69.5s (estimated)
:variables: 3 template variables processed
⚠️  Warnings: 1 confirmation prompt, long test execution

Template Variables:
- branch: feature-123 (from git context)
- version: 1.2.3 (from package.json)
- env: staging (CLI provided)

Would execute workflow with these parameters. No commands were actually run.
```

This implementation plan addresses all critical review feedback by:

**Critical Issues Resolved**:
1. **Path Simulation Ambiguity**: Default to success (exit code 0) for all state transitions during simulation
2. **Timing Estimation Algorithm**: Implemented concrete lookup table with command-specific durations (Git: 1000ms, npm: 3000ms, etc.)
3. **Template Processing**: `ArgumentTemplater.processCommandArgs()` will be called but allow undefined variables with warnings
4. **Error Handling**: Continue simulation on template failures, detect infinite loops, validate variables but allow non-existent paths

**Key Additions**:
- **Simulation Assumptions** section specifying success defaults and validation behavior
- **Timing Estimation Algorithm** with command lookup table and confidence levels
- **Template variable processing** with `VariableResolver.resolveBuiltInVariables()` integration
- **Enhanced CLI integration** including `reportExecutionResult()` updates and example output
- **Security considerations** for variable injection validation in dry-run mode
- **File path specification**: `src/workflow/dry-run-simulator.ts`

The plan ensures users get comprehensive workflow execution previews with timing estimates, template variable display, and clear decision-making information while maintaining system security and performance.