# Implementation Plan: Task 90 - Add Silent Option to Run Command

## Implementation Overview

This implementation plan details the addition of a `--silent` option to the `opencode run` command that suppresses aisanity's informational output while preserving complete tool output from containerized commands. The implementation follows the three-tier verbosity architecture (Silent → Normal → Verbose) and maintains strict separation between application output and tool output.

### Key Implementation Goals
- Add `--silent` flag to run command with optional `--quiet` alias
- Implement centralized Logger class for conditional output management
- Replace all `console.log` calls with conditional logging in run.ts
- Preserve 100% of containerized tool output in all modes
- Maintain error visibility across all verbosity levels
- Ensure backward compatibility with existing behavior

## Component Details

### 1. Logger Utility Class

**Location**: `src/utils/logger.ts`

**Purpose**: Centralized output management with three-tier verbosity support

**Core Features**:
- Conditional informational message logging
- Unconditional error message logging
- Support for silent, normal, and verbose modes
- Simple API for easy integration

**Class Structure**:
```typescript
class Logger {
  constructor(
    private silent: boolean = false,
    private verbose: boolean = false
  ) {}
  
  info(message: string): void        // Suppressed in silent mode
  error(message: string): void       // Always visible
  debug(message: string): void       // Only in verbose mode
}
```

### 2. Run Command Enhancement

**Location**: `src/commands/run.ts`

**Modifications Required**:
- Add `--silent` and `--quiet` options to command definition
- Import and instantiate Logger class
- Replace all `console.log` calls with `logger.info`
- Maintain all `console.error` calls unchanged
- Update utility function calls to support silent mode

**Option Definition**:
```typescript
.option('--silent, --quiet', 'Suppress aisanity output, show only tool output')
```

### 3. Process Management Updates

**Location**: `src/commands/run.ts`

**Stdio Configuration Strategy**:
- Always inherit container process output (stdout/stderr)
- Silent mode only affects aisanity's own console.log calls
- Maintain existing `stdio: ['inherit', 'inherit', 'inherit']` for both `devcontainer up` and `devcontainer exec`

**Process Flow**:
1. Container startup (`devcontainer up`) - tool output always inherited
2. Command execution (`devcontainer exec`) - tool output always inherited
3. Aisanity messages - conditionally suppressed based on silent flag

## Data Structures

### Logger Configuration Interface
```typescript
interface LoggerOptions {
  silent?: boolean;
  verbose?: boolean;
}
```

### Enhanced Run Command Options
```typescript
interface RunCommandOptions {
  command?: string[];
  devcontainerJson?: string;
  forceRecreate?: boolean;
  worktree?: string;
  verbose?: boolean;
  silent?: boolean;    // New addition
  quiet?: boolean;     // Alias for silent
}
```

### Verbosity Mode Enumeration
```typescript
enum VerbosityMode {
  SILENT = 'silent',
  NORMAL = 'normal',
  VERBOSE = 'verbose'
}
```

## API Design

### Logger Class API

**Constructor**:
```typescript
new Logger(silent: boolean, verbose: boolean): Logger
```

**Methods**:
```typescript
logger.info(message: string): void      // Conditional output
logger.error(message: string): void     // Always output
logger.debug(message: string): void     // Verbose-only output
logger.warn(message: string): void      // Always output (optional enhancement)
```

### Integration Pattern

**Command Integration**:
```typescript
// In run command action - silent takes precedence over verbose
const logger = new Logger(
  options.silent || options.quiet || false,
  options.verbose && !options.silent && !options.quiet || false
);
```

**Utility Function Updates**:
```typescript
// Utility functions continue using their existing verbose parameter
// Silent mode ONLY affects console.log calls in run.ts
// No changes needed to utility function signatures or calls
const containerName = getContainerName(cwd, options.verbose || false);
```

## Testing Strategy

### Unit Testing

**Logger Class Tests** (`tests/logger.test.ts`):
- Test info message suppression in silent mode
- Test error message visibility in all modes
- Test debug message visibility only in verbose mode
- Test mode precedence (silent > verbose)

**Run Command Integration Tests** (`tests/run-silent.test.ts`):
- Test silent flag option parsing
- Test quiet alias functionality
- Test conditional message output
- Test error message visibility in silent mode
- Test flag precedence (silent overrides verbose)
- Test utility function independence from silent mode

### Functional Testing

**Silent Mode Scenarios**:
1. Basic command execution with `--silent`
2. Interactive shell session with `--silent`
3. Error handling in silent mode
4. Worktree operations with `--silent`
5. Container startup messages suppression
6. Both `--silent` and `--verbose` flags together (silent wins)
7. Utility function output independence verification

**Output Preservation Tests**:
1. Verify complete tool output preservation
2. Test mixed stdout/stderr from container
3. Verify error output from containerized commands
4. Test long-running process output
5. Interactive command output preservation

**Backward Compatibility Tests**:
1. Default behavior unchanged
2. Verbose mode unchanged
3. Error handling unchanged
4. Exit code preservation
5. Signal handling verification

### Interactive Testing Approach

**Manual Testing Scenarios**:
1. **Basic Silent Mode**: `aisanity run --silent echo "test"` - verify only "test" appears
2. **Interactive Shell**: `aisanity run --silent bash` - verify clean shell prompt
3. **Error Visibility**: `aisanity run --silent invalid-command` - verify error message appears
4. **Verbose Override**: `aisanity run --silent --verbose echo "test"` - verify silent wins
5. **Utility Independence**: Run with worktree and verbose to verify utility output unaffected

**Expected Output Verification**:
- Silent mode: No aisanity messages, only tool output
- Normal mode: Aisanity messages + tool output
- Verbose mode: Aisanity messages + utility output + tool output
- Error cases: Error messages always visible

### Integration Testing

**Container Lifecycle Tests**:
1. Silent mode with `devcontainer up`
2. Silent mode with `devcontainer exec`
3. Error scenarios in silent mode
4. Container failure handling
5. Worktree container operations

**Edge Case Testing**:
1. Invalid worktree paths in silent mode
2. Missing devcontainer.json in silent mode
3. Network connectivity issues
4. Docker daemon failures
5. Resource constraint scenarios

## Development Phases

### Phase 1: Foundation Implementation
**Duration**: 1-2 days

**Tasks**:
1. Create Logger utility class in `src/utils/logger.ts`
2. Implement basic conditional logging functionality
3. Add unit tests for Logger class
4. Verify Logger class functionality

**Deliverables**:
- Logger utility class
- Logger unit tests
- Basic functionality verification

### Phase 2: Run Command Integration
**Duration**: 2-3 days

**Tasks**:
1. Add `--silent` and `--quiet` options to run command
2. Import and integrate Logger class in run.ts
3. Replace all `console.log` calls with `logger.info`
4. Update command option processing logic
5. Add basic integration tests

**Deliverables**:
- Enhanced run command with silent option
- Integration tests for silent functionality
- Basic end-to-end verification

### Phase 3: Process Management Verification
**Duration**: 1-2 days

**Tasks**:
1. Verify stdio configuration for container processes
2. Test tool output preservation in silent mode
3. Verify error handling in silent mode
4. Test interactive command support
5. Add comprehensive functional tests

**Deliverables**:
- Verified process management
- Tool output preservation tests
- Error handling verification

### Phase 4: Comprehensive Testing
**Duration**: 2-3 days

**Tasks**:
1. Complete unit test coverage
2. Add integration test scenarios
3. Test edge cases and error conditions
4. Verify backward compatibility
5. Performance impact assessment

**Deliverables**:
- Complete test suite
- Edge case coverage
- Performance benchmarks
- Compatibility verification

### Phase 5: Documentation and Polish
**Duration**: 1 day

**Tasks**:
1. Update command help text
2. Add usage examples
3. Update README documentation
4. Code review and refinement
5. Final testing and validation

**Deliverables**:
- Updated documentation
- Usage examples
- Code review completion
- Final validation

## Implementation Guidelines

### **IMPORTANT: Output Separation Principles**

1. **Strict Separation**: Never suppress containerized tool output
2. **Error Visibility**: Critical errors always visible regardless of mode
3. **Conditional Logging**: Only aisanity's informational messages are conditional
4. **Process Inheritance**: Container process stdio always inherited

### **IMPORTANT: Utility Function Interaction**

1. **No Changes to Utility Functions**: Utility functions (getContainerName, discoverContainers, etc.) continue using their existing `verbose` parameter
2. **Silent Mode Scope**: Silent mode ONLY affects console.log calls in run.ts through the Logger class
3. **Separation of Concerns**: Utility function verbosity is independent of command-level silent mode
4. **No Signature Changes**: Do not modify utility function signatures or implementation

### Code Modification Patterns

**Option Addition Pattern**:
```typescript
.option('--silent, --quiet', 'Suppress aisanity output, show only tool output')
```

**Logger Integration Pattern**:
```typescript
const logger = new Logger(
  options.silent || options.quiet || false,
  options.verbose && !options.silent && !options.quiet || false
);
```

**Output Replacement Pattern**:
```typescript
// Before
console.log(`Starting container for workspace: ${workspaceName}`);

// After
logger.info(`Starting container for workspace: ${workspaceName}`);

// Errors remain unchanged
console.error('Failed to run container:', error);
```

### Process Management Guidelines

**Stdio Configuration**:
```typescript
// Always inherit tool output, regardless of silent mode
const child = Bun.spawn(['devcontainer', ...args], {
  stdio: ['inherit', 'inherit', 'inherit'],
  cwd
});
```

**Error Handling**:
```typescript
// Errors always use console.error, never logger.info
try {
  // operation
} catch (error) {
  console.error('Operation failed:', error);
  process.exit(1);
}
```

## Risk Mitigation

### Technical Risks
- **Risk**: Breaking existing functionality
- **Mitigation**: Comprehensive backward compatibility testing
- **Risk**: Tool output suppression
- **Mitigation**: Strict stdio inheritance verification

### User Experience Risks
- **Risk**: Confusing silent mode behavior
- **Mitigation**: Clear documentation and help text
- **Risk**: Error visibility issues
- **Mitigation**: Unconditional error message handling

### Performance Risks
- **Risk**: Logging overhead
- **Mitigation**: Minimal conditional checks, performance testing
- **Risk**: Memory usage increase
- **Mitigation**: Lightweight Logger implementation

## Success Criteria

### Functional Success
1. `--silent` flag successfully suppresses aisanity output
2. Tool output completely preserved in silent mode
3. Error messages visible in all modes
4. Backward compatibility maintained
5. Interactive commands work properly in silent mode

### Quality Success
1. 100% test coverage for new functionality
2. No performance regression
3. Code follows existing patterns
4. Documentation is complete and accurate
5. User experience is intuitive

### Integration Success
1. Seamless integration with existing verbose option
2. Proper interaction with worktree functionality
3. Compatible with all container operations
4. Maintains existing error handling patterns
5. Works across different platforms and environments

---

**Implementation Priority**: High
**Estimated Total Duration**: 7-11 days
**Risk Level**: Low
**Backward Compatibility**: 100% maintained

This implementation plan provides a comprehensive roadmap for adding the silent option to the run command while maintaining the architectural principles of output separation and backward compatibility.