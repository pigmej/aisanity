# Task 40: Complete Bun Migration Issues

## Implementation Overview

This task completes the Bun migration by addressing 15 remaining test failures that were not resolved in the initial migration (Task 20) and test mocking fixes (Task 30). The focus is on fixing specific CLI command issues, runtime detection mocking with Bun's constraints, and ensuring complete test suite compatibility.

## Integration Strategy

### Building on Task 20 (Core Bun Migration)
- Leverage the existing runtime abstraction layer in `src/utils/runtime-utils.ts`
- Use the established Docker integration patterns from `src/utils/docker-safe-exec.ts`
- Maintain the container runtime detection architecture already implemented

### Building on Task 30 (Test Mocking Strategy)
- Extend the runtime-utils mocking patterns in `tests/helpers/runtime-mocks.ts`
- Utilize the Docker error type handling already established
- Follow the globalThis.Bun constraint handling patterns

## Component Details

### 1. discover-opencode Command Fixes
**File:** `src/commands/discover-opencode.ts`
- Fix verbose flag handling that's failing in Bun environment
- Ensure proper argument parsing with Bun's CLI argument handling
- Address any Bun-specific process.stdout differences
- **Specific Implementation**: Ensure verbose flag is properly passed to safeDockerExec calls throughout the function for all Docker operations
- **Concrete Implementation Example**: 
  ```typescript
  // In discover-opencode.ts, ensure proper parameter passing:
  const verboseEnabled = options.verbose || false;
  await safeDockerExec(['git', 'clone', repoUrl], { verbose: verboseEnabled, ...otherOptions });
  ```
- **Parameter Validation**: Verify verbose parameter is consistently passed through all function calls and maintains its value throughout the execution chain

### 2. Runtime Detection Mocking Enhancement
**Files:** 
- `tests/helpers/runtime-detection-mocks.ts`
- `tests/helpers/runtime-mocks.ts`
- **Fix globalThis.Bun constraint handling in test environment**: Bun has a non-configurable globalThis.Bun property that causes TypeError when trying to override with Object.defineProperty, requiring alternative mocking strategies
- **Specific Bun Mocking Strategy**: Use module-level mocking via spyOn on exported functions instead of modifying globalThis to avoid unconfigurable property errors
- Address any conflicts between Node.js and Bun runtime detection

### 3. Missing Test Imports
**Files:** Multiple test files
- Add missing `afterEach` imports from Bun test framework (import from 'bun:test')
- Ensure all test helper imports are properly resolved
- Fix any import path issues that arose during migration

### 4. worktree-list Command Registration
**Files:**
- `src/commands/worktree-list.ts`
- `src/commands/worktree.ts`
- **Concrete Code Example**: Ensure worktree-list command is properly exported as a subcommand and registered with proper name
- **Specific Fix**: Verify worktreeCommand.addCommand(worktreeListCommand) is properly configured with correct naming
- Ensure proper command registration in CLI structure

### 5. Process Exit Mocking
**Files:** Multiple test files (especially `tests/stats.test.ts`)
- **Bun-Compatible Process Exit Strategy**: Use try-catch patterns with error throwing instead of direct process.exit mocking to avoid Bun's process model conflicts
- Fix `process.exit` mocking that's incompatible with Bun
- Ensure proper test isolation and cleanup
- Address any Bun-specific process handling differences
- **Specific Process Exit Mocking Patterns**:
  ```typescript
  // Instead of: jest.spyOn(process, 'exit').mockImplementation()
  // Use Bun-compatible error simulation:
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress error logs during tests
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  // In test, catch errors that simulate process.exit:
  await expect(async () => {
    // Code that would normally call process.exit(1)
  }).rejects.toThrow();
  ```
- **Alternative Pattern**: Use mock functions that throw custom errors containing exit codes for validation

### 6. CLI Command Structure Completion
**File:** `src/index.ts`
- Ensure all commands are properly registered and accessible
- Fix any command routing issues in Bun environment
- Verify CLI argument parsing works correctly

## Testing Strategy

### Bun-Specific Test Patterns
1. **Global Object Handling**
   - **Bun-Specific Pattern**: Use module-level mocking via spyOn on exported functions (e.g., `spyOn(require('../src/utils/runtime-utils'), 'isBunRuntime')`) instead of trying to modify `globalThis` to avoid unconfigurable property errors
   - Use proper mocking for runtime detection without interfering with actual Bun runtime
   - Ensure test isolation between Node.js and Bun specific tests
   - Handle Bun's different process and global object models

2. **Process Management**
   - **Bun-Compatible Pattern**: Replace direct process.exit spies with try-catch error handling that simulates process exit behavior by throwing errors that contain exit codes
   - Adapt process.exit mocking for Bun's process model by catching and testing for expected error messages
   - Ensure proper cleanup in async test scenarios
   - Handle Bun's different stream and buffer implementations

3. **Docker Integration Testing**
   - Maintain Docker compatibility testing patterns from Task 20
   - Ensure container runtime detection works in test environment
   - Handle any Bun-specific Docker client differences

4. **CLI Command Testing**
   - Test command registration and discovery in Bun environment
   - Verify argument parsing and flag handling
   - Ensure proper error handling and exit codes

### Test File Updates Required
- `tests/discover-opencode.test.ts` - verbose flag fixes, ensure verbose parameter is properly passed to all safeDockerExec calls
- `tests/runtime-detection.test.ts` - Bun constraint handling, fix Object.defineProperty errors for globalThis.Bun
- `tests/worktree-list.test.ts` - command registration, ensure list subcommand is correctly registered
- `tests/devcontainer-templates.test.ts` - missing afterEach import, add 'afterEach' to bun:test import
- `tests/stats.test.ts` - process exit mocking, implement Bun-compatible process.exit error simulation
- Multiple test files as needed for complete test suite validation

### Test Validation Strategy
- **Specific Test Validation for All 15 Failures**: Create a detailed matrix tracking each of the 15 failing tests and their resolution status:
  ```bash
  # Before starting fixes:
  bun test --reporter=verbose 2>&1 | grep -E "(FAIL|failed|✗)" | wc -l
  # Should show 15 failures initially
  
  # After each fix implementation:
  bun test tests/failing_test_file.test.ts
  # Validate specific test is fixed
  
  # Final validation:
  bun test --reporter=verbose
  # Should show 0 failures
  ```
- **Cross-Platform Validation**: Test command execution and functionality on different platforms:
  ```bash
  # On macOS:
  bun run build && bun aisanity discover-opencode --verbose
  # On Linux:
  bun run build && bun aisanity discover-opencode --verbose
  # Verify consistent behavior across platforms
  ```

## Development Phases

### Phase 1: Core Infrastructure Fixes
1. Fix missing test imports (afterEach, etc.) across test files
2. **Enhance runtime detection mocking for Bun constraints**: Implement alternative global object mocking strategy that works with Bun's non-configurable properties
3. **Update process exit mocking patterns**: Replace direct process.exit mocking with Bun-compatible error simulation
4. **Validate Bun-specific mocking patterns**: Ensure all mocks work correctly without causing test interference

### Phase 2: Command-Specific Fixes
1. **Fix discover-opencode verbose flag handling**: Ensure verbose flag is passed to all safeDockerExec calls and enables proper logging
2. **Resolve worktree-list command registration issues**: Fix command structure to ensure list subcommand exists and functions correctly
3. **Test CLI command structure completeness**: Verify all commands are properly registered and accessible

### Phase 3: Integration and Validation
1. Run full test suite and identify remaining failures
2. Fix any Docker integration issues specific to Bun
3. Ensure all 15 test failures are resolved
4. **Cross-Platform Validation**: Test functionality on Windows, macOS, and Linux to ensure compatibility
   - Run discover-opencode command with verbose flag on each platform
   - Verify worktree commands function correctly across platforms
   - Confirm Docker integration works consistently

### Phase 4: Final Validation
1. Run tests in both Node.js and Bun environments
2. Verify CLI functionality works correctly
3. Ensure no regressions in existing functionality
4. **Complete Test Suite Validation**: Execute comprehensive validation that all 15 originally failing tests now pass
5. **Cross-Platform Verification**: Final confirmation of functionality across different operating systems

## Dependencies

### Required from Task 20
- Runtime abstraction layer (`src/utils/runtime-utils.ts`)
- Docker integration patterns (`src/utils/docker-safe-exec.ts`)
- Container runtime detection architecture

### Required from Task 30
- Runtime-utils mocking patterns (`tests/helpers/runtime-mocks.ts`)
- Docker error type handling
- GlobalThis.Bun constraint handling approaches

### New Dependencies
- Bun test framework specific mocking patterns for global objects
- Additional test helper functions for Bun-specific process.exit simulation
- CLI command registration validation utilities

## Success Criteria

1. All 15 remaining test failures are resolved
2. Test suite passes consistently in Bun environment
3. CLI commands work correctly with proper flag handling
4. Runtime detection works reliably in test environment with Bun-compatible mocks
5. No regressions in existing functionality
6. Migration is complete and fully functional

## Risk Mitigation

### Potential Issues
- Bun's non-configurable globalThis.Bun property causing test interference during mocking
- Process handling differences affecting CLI testing with process.exit
- Docker client compatibility issues with Bun

### Mitigation Strategies
- **Test Isolation**: Use temporary global property replacement instead of Object.defineProperty for Bun mocking
- **Process Exit Alternative**: Implement try-catch error simulation for process.exit behavior
- **Fallback mechanisms**: Ensure Bun-specific features gracefully fall back to alternatives
- Extensive integration testing across environments
- Rollback procedures for critical issues

### Rollback Strategy with Checkpoints
- **Checkpoint 1**: After fixing missing test imports (afterEach, etc.)
  - Validation: Run `bun test tests/devcontainer-templates.test.ts` to ensure import fixes work
  - Rollback: Revert import changes if tests fail
- **Checkpoint 2**: After runtime detection mocking fixes
  - Validation: Run `bun test tests/runtime-detection.test.ts` to ensure Bun constraint handling works
  - Rollback: Restore previous mocking approach if global object issues persist
- **Checkpoint 3**: After process exit mocking updates
  - Validation: Run `bun test tests/stats.test.ts` to ensure process.exit simulation works
  - Rollback: Revert to previous process.exit mock if issues occur
- **Checkpoint 4**: After discover-opencode verbose flag fixes
  - Validation: Run `bun test tests/discover-opencode.test.ts` to ensure flag passing works
  - Rollback: Restore previous parameter passing if broken
- **Checkpoint 5**: After worktree-list command registration fixes
  - Validation: Run `bun test tests/worktree-list.test.ts` to ensure command structure is correct
  - Rollback: Revert command registration if CLI functionality breaks
- **Final Validation**: Run entire test suite to confirm all 15 failures are resolved
  - Rollback: If more than 3 tests still fail, revert all changes and implement alternative approach

## Deliverables

1. Updated source files with Bun compatibility fixes
2. Enhanced test helpers with Bun-specific mocking strategies for global objects and process.exit
3. Complete test suite with all tests passing
4. Documentation of Bun-specific patterns and considerations for future development
5. Validation of CLI functionality in Bun environment