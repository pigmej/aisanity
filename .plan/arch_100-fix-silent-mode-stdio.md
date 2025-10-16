# Architecture: Fix Silent Mode Stdio Configuration

## Context Analysis

### Problem Overview
The `--silent` option in the `run` command successfully suppresses aisanity's own logging through the Logger class, but devcontainer CLI infrastructure messages still appear in the output. This occurs because both `devcontainer up` and `devcontainer exec` processes use `stdio: ['inherit', 'inherit', 'inherit']`, which passes through all output streams from the devcontainer CLI.

### Current Implementation
- **Location**: `src/commands/run.ts` (lines 146-183)
- **Logger**: Correctly implemented and tested in `src/utils/logger.ts`
- **Problem Area**: Two Bun.spawn calls with identical stdio configuration:
  1. `devcontainer up` (line 146) - Infrastructure setup that produces unwanted output
  2. `devcontainer exec` (line 176) - User command execution that must preserve output

### Output Categorization
The system has three distinct types of output:
1. **Aisanity Output**: Logger messages controlled by Logger class ✅ Working
2. **Infrastructure Output**: devcontainer CLI startup messages ❌ Not suppressed
3. **Tool Output**: User command results (bash, npm, etc.) ✅ Must preserve

### Existing Patterns
The codebase already demonstrates conditional stdio configuration:
- `worktree-create.ts` (line 106): `stdio: options.verbose ? ['inherit', 'inherit', 'inherit'] : ['pipe', 'pipe', 'pipe']`
- `worktree-remove.ts` (line 142): Same pattern
- Pattern: Pipe stdio when non-verbose, inherit when verbose

## Technology Recommendations

### Bun.spawn stdio Configuration
**IMPORTANT**: Use Bun.spawn's stdio array syntax for granular control over streams.

#### stdio Array Format
```typescript
stdio: [stdin, stdout, stderr]
```

Options for each stream:
- `'inherit'`: Pass through to parent process (visible to user)
- `'pipe'`: Capture for programmatic handling (hidden from user)
- `'ignore'`: Discard output (not recommended for error streams)

#### Recommended Configuration

**For `devcontainer up` (Infrastructure)**:
```typescript
stdio: ['inherit', 'pipe', 'pipe']  // When silent/quiet enabled
stdio: ['inherit', 'inherit', 'inherit']  // When silent/quiet disabled
```

Rationale:
- stdin: `'inherit'` - Not needed for up command, but safe default
- stdout: `'pipe'` - Suppresses JSON output and timing messages
- stderr: `'pipe'` - Suppresses warning/info messages from CLI

**For `devcontainer exec` (User Command)**:
```typescript
stdio: ['inherit', 'inherit', 'inherit']  // Always
```

Rationale:
- Must preserve all user interaction and command output
- No conditional logic needed - always inherit all streams

### Error Handling Strategy
**IMPORTANT**: Piping stdio doesn't eliminate error detection capability.

1. **Exit Code**: `await upResult.exited` still returns exit code
2. **Error Propagation**: Non-zero exit codes still throw errors
3. **Error Messages**: Critical errors handled by try/catch block
4. **User Visibility**: console.error() calls remain visible (not controlled by Logger)

### Option Detection Pattern
Follow existing pattern from logger initialization:
```typescript
const isSilent = options.silent || options.quiet || false;
```

This handles both `--silent` and `--quiet` flags with a single boolean.

## System Architecture

### Component Interaction

```
User Command (--silent)
    ↓
run.ts Command Handler
    ↓
Logger Initialization (silent: true)
    ├─→ Logger.info() → suppressed
    └─→ Logger.error() → visible
    ↓
devcontainer up (stdio: ['inherit', 'pipe', 'pipe'])
    ├─→ stdout → piped (suppressed)
    ├─→ stderr → piped (suppressed)
    └─→ exitCode → checked for errors
    ↓
devcontainer exec (stdio: ['inherit', 'inherit', 'inherit'])
    ├─→ stdin → user input
    ├─→ stdout → command output (visible)
    └─→ stderr → command errors (visible)
```

### Stream Flow Diagram

**Normal Mode**:
```
devcontainer up   → stdout/stderr → Terminal
devcontainer exec → stdout/stderr → Terminal
Logger messages   → stdout/stderr → Terminal
```

**Silent Mode**:
```
devcontainer up   → stdout/stderr → Piped (suppressed)
devcontainer exec → stdout/stderr → Terminal (preserved)
Logger messages   → (suppressed)
Error messages    → stderr → Terminal (preserved)
```

## Integration Patterns

### Pattern 1: Conditional stdio Configuration (Recommended)
**IMPORTANT**: This is the primary integration pattern to implement.

```typescript
const isSilent = options.silent || options.quiet || false;

const upResult = Bun.spawn(['devcontainer', ...upArgs], {
  stdio: isSilent ? ['inherit', 'pipe', 'pipe'] : ['inherit', 'inherit', 'inherit'],
  cwd
});
```

**Advantages**:
- Minimal code changes
- Follows existing patterns in codebase
- Clear conditional logic
- Maintains backward compatibility

**Location**: Apply to `devcontainer up` spawn call only (line 146)

### Pattern 2: Output Capture for Error Context
**Optional Enhancement**: Consider for future iterations.

```typescript
let upStderr = '';
let upStdout = '';

const upResult = Bun.spawn(['devcontainer', ...upArgs], {
  stdio: isSilent ? ['inherit', 'pipe', 'pipe'] : ['inherit', 'inherit', 'inherit'],
  cwd
});

if (isSilent && upResult.stdout) {
  upStdout = await new Response(upResult.stdout).text();
}
if (isSilent && upResult.stderr) {
  upStderr = await new Response(upResult.stderr).text();
}

const upExitCode = await upResult.exited;
if (upExitCode !== 0) {
  // Optionally log captured output for debugging
  if (upStderr || upStdout) {
    console.error('Devcontainer startup failed. Use --verbose for details.');
  }
  throw new Error(`devcontainer up failed with code ${upExitCode}`);
}
```

**Advantages**:
- Preserves error context for debugging
- Can provide better error messages
- Useful for troubleshooting

**Trade-offs**:
- More complex implementation
- Requires async stream reading
- May not be needed for MVP

### Pattern 3: Stdin Handling Consideration
**Analysis**: Current implementation uses `'inherit'` for stdin in all cases.

For `devcontainer up`:
- Command doesn't require user input
- Could use `'ignore'` or `'pipe'` instead of `'inherit'`
- Current `'inherit'` is harmless but unnecessary

**Recommendation**: Keep `'inherit'` for consistency and safety.

## Implementation Guidance

### Step 1: Identify Change Location
**File**: `src/commands/run.ts`
**Line**: 146-149 (devcontainer up spawn call)

### Step 2: Extract Silent Flag
Add before the devcontainer up call (around line 145):
```typescript
const isSilent = options.silent || options.quiet || false;
```

### Step 3: Modify stdio Configuration
**IMPORTANT**: Only modify the `devcontainer up` spawn call.

Change from:
```typescript
const upResult = Bun.spawn(['devcontainer', ...upArgs], {
  stdio: ['inherit', 'inherit', 'inherit'],
  cwd
});
```

To:
```typescript
const upResult = Bun.spawn(['devcontainer', ...upArgs], {
  stdio: isSilent ? ['inherit', 'pipe', 'pipe'] : ['inherit', 'inherit', 'inherit'],
  cwd
});
```

### Step 4: Verify exec Remains Unchanged
**IMPORTANT**: Do NOT modify the `devcontainer exec` spawn call (line 176).

This call must always use `['inherit', 'inherit', 'inherit']` to preserve tool output.

### Step 5: Error Handling Verification
Confirm existing error handling works with piped streams:
- Exit code checking: Already implemented ✅
- Error throwing: Already implemented ✅
- Error message visibility: Uses console.error() ✅

No changes needed - existing error handling is compatible with piped stdio.

### Step 6: Testing Strategy

#### Manual Testing
1. **Silent mode with interactive shell**:
   ```bash
   aisanity run --silent bash
   # Expected: Only bash prompt, no devcontainer messages
   ```

2. **Silent mode with command**:
   ```bash
   aisanity run --silent echo "Hello World"
   # Expected: Only "Hello World", no infrastructure messages
   ```

3. **Quiet mode equivalence**:
   ```bash
   aisanity run --quiet bash
   # Expected: Same behavior as --silent
   ```

4. **Normal mode unchanged**:
   ```bash
   aisanity run bash
   # Expected: All messages visible (existing behavior)
   ```

5. **Error visibility in silent mode**:
   ```bash
   aisanity run --silent invalid-command
   # Expected: Error messages still visible
   ```

#### Automated Testing
Extend `tests/run-silent.test.ts`:

**Test Case 1**: Verify silent flag detection
```typescript
test('should set isSilent flag when --silent provided', () => {
  const options = { silent: true };
  const isSilent = options.silent || options.quiet || false;
  expect(isSilent).toBe(true);
});
```

**Test Case 2**: Verify quiet flag equivalence
```typescript
test('should set isSilent flag when --quiet provided', () => {
  const options = { quiet: true };
  const isSilent = options.silent || options.quiet || false;
  expect(isSilent).toBe(true);
});
```

**Note**: Integration testing of stdio behavior requires spawning actual processes, which may be beyond the scope of unit tests. Focus on flag logic testing and rely on manual testing for full stdio verification.

### Step 7: Code Review Checklist
- [ ] Only `devcontainer up` stdio modified
- [ ] `devcontainer exec` stdio unchanged (preserves tool output)
- [ ] Both `--silent` and `--quiet` flags handled
- [ ] Backward compatibility maintained (normal mode unchanged)
- [ ] Error handling remains functional
- [ ] Logger class unchanged (no modifications needed)
- [ ] console.error() calls remain for critical errors
- [ ] Manual testing completed for all scenarios

### Step 8: Documentation Updates
Update command help text if needed (optional):
```typescript
.option('--silent, --quiet', 'Suppress infrastructure output, show only tool output')
```

Current help text is acceptable, but could be more specific about what gets suppressed.

## Implementation Constraints

### What NOT to Change
**IMPORTANT**: The following components are working correctly and must NOT be modified:

1. **Logger Class** (`src/utils/logger.ts`): Already correctly implemented
2. **Logger Tests** (`tests/run-silent.test.ts`): Comprehensive and passing
3. **devcontainer exec stdio**: Must remain `['inherit', 'inherit', 'inherit']`
4. **Error Handling Logic**: Exit code checking and error throwing work correctly
5. **Option Parsing**: Commander.js handling of `--silent` and `--quiet` flags

### Scope Boundaries
This task is focused ONLY on:
- Modifying the `devcontainer up` stdio configuration
- Making it conditional based on silent/quiet flags
- Verifying tool output remains visible

Out of scope:
- Changing Logger implementation
- Modifying other commands (rebuild, status, etc.)
- Adding new verbosity levels
- Buffering output for post-processing
- Creating debug modes

### Risk Mitigation

**Risk 1**: Breaking tool output visibility
- **Mitigation**: Only modify `devcontainer up`, never `devcontainer exec`
- **Verification**: Manual testing with interactive shells

**Risk 2**: Losing error visibility
- **Mitigation**: Keep error handling logic unchanged, rely on exit codes
- **Verification**: Test error scenarios in silent mode

**Risk 3**: Regression in normal mode
- **Mitigation**: Use conditional operator, preserve existing default behavior
- **Verification**: Test without --silent flag

**Risk 4**: Breaking other commands
- **Mitigation**: Changes are isolated to run.ts, no shared code modified
- **Verification**: Run full test suite

## Performance Considerations

### Stream Processing Overhead
Piping stdio has negligible performance impact:
- No buffering or processing of piped streams
- Streams are simply discarded rather than written to terminal
- Exit code checking is synchronous and fast

### Memory Usage
Piped streams don't accumulate in memory unless explicitly read:
- Current implementation doesn't read piped streams
- No memory accumulation risk
- Safe for long-running devcontainer operations

### Latency Impact
No impact on command execution latency:
- Piping vs inheriting is a kernel-level operation
- No additional system calls introduced
- User commands execute at same speed

## Alternative Approaches Considered

### Alternative 1: Output Filtering with grep/sed
Pipe devcontainer output through text filtering:
```typescript
stdio: ['inherit', 'inherit', 'pipe']
// Then filter stderr with regex to remove unwanted messages
```

**Rejected because**:
- More complex to implement
- Requires parsing devcontainer output format
- Fragile - breaks if devcontainer CLI changes output format
- Performance overhead of text processing

### Alternative 2: Wrapper Script
Create shell script wrapper around devcontainer CLI:
```bash
#!/bin/bash
if [ "$SILENT" = "true" ]; then
  devcontainer up "$@" 2>&1 > /dev/null
else
  devcontainer up "$@"
fi
```

**Rejected because**:
- Adds external dependency
- Platform compatibility concerns (Windows)
- Adds complexity to deployment
- Bun.spawn stdio configuration is simpler

### Alternative 3: Environment Variable Control
Check if devcontainer CLI has environment variable for output control:
```typescript
env: { ...process.env, DEVCONTAINER_CLI_QUIET: 'true' }
```

**Rejected because**:
- Devcontainer CLI 0.80.1 doesn't support such variables
- Would require dependency on upstream feature
- Not under our control

### Alternative 4: Post-processing Output
Capture all output and filter before displaying:
```typescript
const output = await new Response(upResult.stdout).text();
const filtered = output.split('\n').filter(line => !line.includes('[') && !line.includes('outcome'));
console.log(filtered.join('\n'));
```

**Rejected because**:
- Complex and brittle
- Requires maintaining filter patterns
- Might accidentally hide important information
- Simple pipe approach is more robust

## Security Considerations

### Command Injection
No new security risks introduced:
- No user input in stdio configuration
- stdio values are hardcoded strings ('inherit', 'pipe')
- No template strings or concatenation

### Information Disclosure
Piping output actually improves security:
- Suppresses container IDs and paths in silent mode
- Reduces information leakage in logs
- Better for CI/CD environments

### Error Message Leakage
Error messages remain visible in silent mode:
- This is intentional and necessary
- Users need error context for debugging
- console.error() bypasses Logger class
- No sensitive information in devcontainer error messages

## Backward Compatibility

### Existing Behavior Preservation
Normal mode (no --silent flag) must work exactly as before:
- All output visible
- Same error messages
- Same performance characteristics

### Flag Compatibility
Both `--silent` and `--quiet` must work identically:
- Already aliased in option definition: `--silent, --quiet`
- Both set same option value
- Logger handles both through OR condition

### API Stability
No changes to command interface:
- No new flags added
- No flags removed
- Option behavior unchanged
- Return codes unchanged

## Future Enhancements

### Enhancement 1: Verbose Mode Override
Allow `--verbose` to override silent mode for debugging:
```typescript
const isSilent = (options.silent || options.quiet) && !options.verbose;
```

**Trade-offs**:
- More flexible for users
- Might be confusing (which flag wins?)
- Current precedence is clear: silent always wins

### Enhancement 2: Progressive Feedback
Show minimal progress indicators in silent mode for long operations:
```typescript
if (isSilent) {
  console.log('Starting container...');
  // Suppress detailed output
  console.log('Container ready');
}
```

**Trade-offs**:
- Better UX for slow operations
- Violates "true silent" requirement
- Could add `--progress` flag instead

### Enhancement 3: Debug Mode
Add `--debug` flag that shows what's being suppressed:
```typescript
if (options.debug) {
  console.log('Suppressing devcontainer up output');
  console.log('Command:', upArgs);
}
```

**Trade-offs**:
- Useful for troubleshooting
- Adds complexity
- Overlaps with --verbose

### Enhancement 4: Apply to Other Commands
Consider silent mode for `rebuild`, `status`, etc.:
- Same pattern can be reused
- Each command needs evaluation
- User feedback will guide priorities

## Success Criteria

### Functional Requirements
1. ✅ `devcontainer up` output suppressed in silent mode
2. ✅ `devcontainer exec` output preserved in all modes
3. ✅ Error messages remain visible in silent mode
4. ✅ Both --silent and --quiet work identically
5. ✅ Normal mode behavior unchanged

### User Experience
1. ✅ `aisanity run --silent bash` shows only bash prompt
2. ✅ No JSON output from devcontainer CLI
3. ✅ No timing information ([1 ms] messages)
4. ✅ No container ID or metadata output
5. ✅ Clean output suitable for scripts/automation

### Technical Validation
1. ✅ Exit codes properly detected
2. ✅ Error handling functional
3. ✅ No memory leaks from piped streams
4. ✅ No performance degradation
5. ✅ Existing tests continue passing

### Edge Cases
1. ✅ Long-running commands work correctly
2. ✅ Interactive shells (bash, zsh) work properly
3. ✅ Commands with stderr output preserved
4. ✅ Signal handling (Ctrl+C) works correctly
5. ✅ Non-zero exit codes properly propagated

## Conclusion

This is a focused, low-risk change that addresses the user's feedback about incomplete silent mode implementation. The solution leverages existing patterns in the codebase (conditional stdio based on verbosity flags) and requires minimal code changes. The key insight is distinguishing between infrastructure output (devcontainer up) and tool output (devcontainer exec), suppressing only the former while preserving the latter.

**Implementation Complexity**: Low
**Risk Level**: Low
**User Impact**: High (fixes broken feature)
**Code Changes**: ~2 lines
**Testing Effort**: Medium (manual testing required for stdio behavior)

The architectural approach prioritizes simplicity and maintainability while achieving the desired behavior of true silent mode where only tool output is visible to the user.
