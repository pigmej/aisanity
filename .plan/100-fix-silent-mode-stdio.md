# Implementation Plan: Fix Silent Mode Stdio Configuration

## Implementation Overview

This plan addresses the incomplete silent mode implementation in the `run` command where devcontainer CLI infrastructure messages still appear despite the `--silent` flag. The solution involves modifying the stdio configuration for the `devcontainer up` process to use pipe-based streams when silent mode is enabled, while preserving tool output from `devcontainer exec`.

### Core Problem
- Current: Both `devcontainer up` and `devcontainer exec` use `stdio: ['inherit', 'inherit', 'inherit']`
- Issue: Infrastructure output from `devcontainer up` (timing, container metadata) appears in silent mode
- Goal: Suppress infrastructure output while preserving tool output and error handling

### Solution Strategy
1. **Conditional stdio Configuration**: Apply different stdio settings based on silent/quiet flags
2. **Selective Suppression**: Only modify `devcontainer up`, keep `devcontainer exec` unchanged
3. **Pattern Consistency**: Follow existing conditional stdio pattern from `worktree-create.ts`

## Component Details

### Primary Component: run.ts Command Handler

**File**: `src/commands/run.ts`
**Lines**: 145-149 (devcontainer up spawn call)

#### Current Implementation
```typescript
const upResult = Bun.spawn(['devcontainer', ...upArgs], {
  stdio: ['inherit', 'inherit', 'inherit'],
  cwd
});
```

#### Target Implementation
```typescript
const isSilent = options.silent || options.quiet || false;

const upResult = Bun.spawn(['devcontainer', ...upArgs], {
  stdio: isSilent ? ['inherit', 'pipe', 'pipe'] : ['inherit', 'inherit', 'inherit'],
  cwd
});
```

#### Key Changes
1. **Flag Detection**: Extract silent/quiet flag detection before spawn call
2. **Conditional stdio**: Use ternary operator for stream configuration
3. **Preserve exec**: No changes to `devcontainer exec` spawn call (line 176)

### Secondary Component: Test Enhancement

**File**: `tests/run-silent.test.ts`
**Purpose**: Add unit tests for stdio configuration logic

#### New Test Cases
1. Silent flag detection logic
2. Quiet flag equivalence
3. Conditional stdio configuration verification
4. Flag precedence scenarios

## Data Structures

### Option Processing
```typescript
interface RunOptions {
  silent?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  // ... other existing options
}

// Silent flag detection
const isSilent = options.silent || options.quiet || false;
```

### Stdio Configuration Types
```typescript
type StdioConfig = ['inherit' | 'pipe' | 'ignore', 'inherit' | 'pipe' | 'ignore', 'inherit' | 'pipe' | 'ignore'];

// Normal mode: ['inherit', 'inherit', 'inherit']
// Silent mode: ['inherit', 'pipe', 'pipe']
```

### Process Spawn Configuration
```typescript
interface SpawnConfig {
  stdio: StdioConfig;
  cwd: string;
  // ... other Bun.spawn options
}
```

## API Design

### Internal API Changes

#### Silent Flag Detection Function
```typescript
/**
 * Determines if silent mode should be enabled based on command options
 * @param options - Command line options
 * @returns true if silent mode should be enabled
 */
function isSilentMode(options: RunOptions): boolean {
  return options.silent || options.quiet || false;
}
```

#### Stdio Configuration Selector
```typescript
/**
 * Selects appropriate stdio configuration based on silent mode
 * @param isSilent - Whether silent mode is enabled
 * @returns Stdio configuration array
 */
function selectStdioConfig(isSilent: boolean): StdioConfig {
  return isSilent ? ['inherit', 'pipe', 'pipe'] : ['inherit', 'inherit', 'inherit'];
}
```

### External API (No Changes)
- Command interface remains unchanged
- Option parsing unchanged
- Return codes unchanged
- Error handling unchanged

## Testing Strategy

### Unit Testing

#### Test Category 1: Flag Detection Logic
```typescript
describe('Silent Mode Flag Detection', () => {
  test('should detect silent flag', () => {
    const options = { silent: true };
    expect(isSilentMode(options)).toBe(true);
  });

  test('should detect quiet flag', () => {
    const options = { quiet: true };
    expect(isSilentMode(options)).toBe(true);
  });

  test('should prioritize silent over quiet', () => {
    const options = { silent: true, quiet: true };
    expect(isSilentMode(options)).toBe(true);
  });

  test('should return false when no flags', () => {
    const options = {};
    expect(isSilentMode(options)).toBe(false);
  });
});
```

#### Test Category 2: Stdio Configuration Selection
```typescript
describe('Stdio Configuration Selection', () => {
  test('should return inherit config for normal mode', () => {
    const config = selectStdioConfig(false);
    expect(config).toEqual(['inherit', 'inherit', 'inherit']);
  });

  test('should return pipe config for silent mode', () => {
    const config = selectStdioConfig(true);
    expect(config).toEqual(['inherit', 'pipe', 'pipe']);
  });
});
```

#### Test Category 3: Integration with Existing Logger Tests
- Extend existing `run-silent.test.ts` with stdio-specific tests
- Verify flag precedence scenarios
- Test error message visibility preservation

### Manual Testing Scenarios

#### Scenario 1: Silent Mode with Interactive Shell
```bash
# Command
aisanity run --silent bash

# Expected Output
# Only bash prompt, no devcontainer messages
# User can interact with shell normally
```

#### Scenario 2: Silent Mode with Specific Command
```bash
# Command
aisanity run --silent echo "Hello World"

# Expected Output
# Only "Hello World", no infrastructure messages
```

#### Scenario 3: Quiet Mode Equivalence
```bash
# Command
aisanity run --quiet npm test

# Expected Output
# Same behavior as --silent flag
# Only test output visible
```

#### Scenario 4: Normal Mode Unchanged
```bash
# Command
aisanity run bash

# Expected Output
# All messages visible (existing behavior preserved)
```

#### Scenario 5: Error Handling in Silent Mode
```bash
# Command
aisanity run --silent invalid-command

# Expected Output
# Error messages still visible
# Infrastructure messages suppressed
```

### Automated Integration Testing

#### Test Approach
Since stdio behavior requires actual process spawning, integration tests will focus on:
1. Flag parsing logic verification
2. Configuration selection validation
3. Error handling preservation
4. Backward compatibility confirmation

#### Test Environment
- Use temporary devcontainer configurations
- Mock devcontainer CLI for predictable output
- Verify exit code handling
- Test with various command types

## Development Phases

### Phase 1: Core Implementation (Priority: High)

#### Step 1.1: Implement Flag Detection
- Add `isSilentMode` function to `run.ts`
- Follow existing pattern from logger initialization
- Handle both `--silent` and `--quiet` flags

#### Step 1.2: Modify Stdio Configuration
- Update `devcontainer up` spawn call with conditional stdio
- Use ternary operator for clean implementation
- Ensure `devcontainer exec` remains unchanged

#### Step 1.3: Verify Error Handling
- Confirm exit code detection works with piped streams
- Test error message visibility through console.error
- Validate exception handling unchanged

### Phase 2: Testing Implementation (Priority: High)

#### Step 2.1: Unit Test Development
- Add flag detection tests to `run-silent.test.ts`
- Implement stdio configuration tests
- Test edge cases and flag combinations

#### Step 2.2: Manual Testing
- Execute all manual testing scenarios
- Verify silent mode behavior
- Confirm normal mode unchanged

#### Step 2.3: Integration Testing
- Test with real devcontainer setups
- Verify interactive shell functionality
- Test various command types

### Phase 3: Validation and Documentation (Priority: Medium)

#### Step 3.1: Regression Testing
- Run full test suite
- Verify existing functionality unchanged
- Test with different Node.js versions

#### Step 3.2: Performance Validation
- Measure any performance impact
- Verify memory usage unchanged
- Test with long-running operations

#### Step 3.3: Documentation Updates
- Update command help text if needed
- Add examples to documentation
- Document silent mode behavior

### Phase 4: Code Review and Refinement (Priority: Medium)

#### Step 4.1: Code Review
- Review implementation against architectural guidelines
- Verify adherence to existing patterns
- Check for potential edge cases

#### Step 4.2: Refinement
- Optimize implementation if needed
- Improve error messages
- Enhance test coverage

#### Step 4.3: Final Validation
- Complete end-to-end testing
- Verify all requirements met
- Confirm user experience improvement

## Implementation Constraints and Guidelines

### Critical Constraints (IMPORTANT)
1. **Do NOT modify Logger class** - Already working correctly
2. **Do NOT modify devcontainer exec stdio** - Must preserve tool output
3. **Do NOT change option parsing** - Commander.js handling is correct
4. **Do NOT break backward compatibility** - Normal mode must remain unchanged

### Scope Boundaries
**In Scope:**
- Modify `devcontainer up` stdio configuration
- Add conditional logic based on silent/quiet flags
- Enhance test coverage for new behavior
- Verify error handling preservation

**Out of Scope:**
- Changes to Logger implementation
- Modifications to other commands
- New verbosity levels
- Output buffering or post-processing
- Debug mode implementation

### Risk Mitigation Strategies

#### Risk 1: Breaking Tool Output
- **Mitigation**: Only modify `devcontainer up`, never `devcontainer exec`
- **Verification**: Manual testing with interactive shells

#### Risk 2: Losing Error Visibility
- **Mitigation**: Preserve existing error handling logic
- **Verification**: Test error scenarios in silent mode

#### Risk 3: Normal Mode Regression
- **Mitigation**: Use conditional operator, preserve defaults
- **Verification**: Test without --silent flag

#### Risk 4: Test Suite Failures
- **Mitigation**: Focus on unit tests for logic, manual for stdio
- **Verification**: Run full test suite after changes

## Success Criteria

### Functional Requirements
1. ✅ `devcontainer up` output suppressed in silent mode
2. ✅ `devcontainer exec` output preserved in all modes
3. ✅ Error messages remain visible in silent mode
4. ✅ Both `--silent` and `--quiet` work identically
5. ✅ Normal mode behavior unchanged

### User Experience Requirements
1. ✅ `aisanity run --silent bash` shows only bash prompt
2. ✅ No JSON output from devcontainer CLI in silent mode
3. ✅ No timing information messages in silent mode
4. ✅ No container metadata output in silent mode
5. ✅ Clean output suitable for automation scripts

### Technical Requirements
1. ✅ Exit codes properly detected with piped streams
2. ✅ Error handling functional with new configuration
3. ✅ No memory leaks from piped streams
4. ✅ No performance degradation
5. ✅ All existing tests continue passing

### Quality Assurance
1. ✅ Code follows existing patterns and conventions
2. ✅ Implementation is minimal and focused
3. ✅ Test coverage adequate for new functionality
4. ✅ Documentation updated as needed
5. ✅ Manual testing completed for all scenarios

## Future Enhancement Opportunities

### Enhancement 1: Error Context Capture
- Capture devcontainer output for debugging when errors occur
- Provide optional verbose output for troubleshooting
- Add debug mode that shows suppressed content

### Enhancement 2: Progressive Feedback
- Show minimal progress indicators for long operations
- Add `--progress` flag for user feedback
- Implement status updates without full output

### Enhancement 3: Pattern Application
- Apply same pattern to other commands (rebuild, status)
- Evaluate each command for silent mode applicability
- Create reusable stdio configuration utilities

### Enhancement 4: Advanced Flag Handling
- Implement flag precedence hierarchy
- Add `--debug` flag override capability
- Support multiple verbosity levels

## Conclusion

This implementation plan provides a focused, low-risk solution to the silent mode stdio configuration issue. The approach leverages existing patterns in the codebase and requires minimal code changes while achieving the desired behavior of true silent mode.

**Implementation Complexity**: Low
**Risk Level**: Low  
**User Impact**: High (fixes broken feature)
**Code Changes**: ~3 lines
**Testing Effort**: Medium (manual testing required)

The solution prioritizes simplicity and maintainability while ensuring that silent mode works as originally intended by users, providing a clean output experience suitable for automation and scripting scenarios.