# Implementation Plan: Fix getAllWorktrees Validation

## Implementation Overview

This plan implements proactive validation of git worktree directories before attempting git operations, addressing the root cause of "fatal: not a git repository" errors in `aisanity status`. The solution introduces a new `isValidGitWorktree()` utility function that validates worktree structure through file system checks, then updates `getAllWorktrees()` to use this validation before calling git operations. Finally, we clean up `getCurrentBranch()` by removing stderr suppression.

The implementation follows a phased approach to maintain backward compatibility and ensure no breaking changes are introduced.

## Component Details

### 1. isValidGitWorktree() Validation Utility

**Location**: `src/utils/worktree-utils.ts` (after line 35)

**Purpose**: Proactively validate worktree structure before git operations

**Validation Logic**:
```typescript
function isValidGitWorktree(mainGitDir: string, worktreeName: string): boolean {
  // 1. Check .git/worktrees/<name>/gitdir file exists
  // 2. Read and parse gitdir file content
  // 3. Verify target directory exists at gitdir path
  // 4. Verify target directory contains valid .git file
  // 5. Verify .git file contains proper gitdir: reference
  // 6. Log specific failure reasons for debugging
  // 7. Return boolean validation result
}
```

**Key Features**:
- File system-based validation (no git operations)
- Comprehensive error logging with specific failure reasons
- Graceful handling of edge cases (missing files, permissions, corruption)
- Performance optimized with early returns on first failure

### 2. Updated getAllWorktrees() Function

**Location**: `src/utils/worktree-utils.ts` (lines 207-231)

**Changes**:
- Add validation check before `getCurrentBranch()` call
- Skip invalid worktrees early with informative logging
- Maintain existing try-catch as safety net
- Preserve all existing functionality for valid worktrees

**Flow Enhancement**:
```typescript
for (const worktreeName of worktreeDirs) {
  // NEW: Proactive validation before git operations
  if (!isValidGitWorktree(mainGitDirPath, worktreeName)) {
    continue; // Validation function already logged the reason
  }
  
  const worktreePath = path.join(worktreesDir, worktreeName);
  try {
    // This should now succeed for valid worktrees
    const worktreeBranch = getCurrentBranch(worktreePath);
    // ... rest of existing logic
  } catch (error) {
    // Rare case - keep as safety net
    console.warn(`Unexpected error reading worktree ${worktreeName}:`, error);
  }
}
```

### 3. Clean getCurrentBranch() Implementation

**Location**: `src/utils/config.ts` (lines 40-52)

**Changes**:
- Remove `stdio: ['pipe', 'pipe', 'pipe']` suppression
- Restore clean git command execution
- Rely on upstream validation to prevent errors
- Maintain existing error handling and fallback behavior

**Before/After**:
```typescript
// BEFORE (with stderr suppression):
execSync('git rev-parse --abbrev-ref HEAD', {
  cwd,
  encoding: 'utf8',
  stdio: ['pipe', 'pipe', 'pipe'] // REMOVE
})

// AFTER (clean implementation):
execSync('git rev-parse --abbrev-ref HEAD', {
  cwd,
  encoding: 'utf8'
  // Use default stdio (inherits stderr naturally)
})
```

## Data Structures

### Existing Interfaces (Unchanged)

```typescript
interface WorktreeInfo {
  path: string;          // Absolute path to worktree directory
  branch: string;        // Associated git branch name
  containerName: string; // Generated container name
  isActive: boolean;     // Whether this is the currently active worktree
  configPath: string;    // Path to .aisanity config file
}

interface WorktreeList {
  main: WorktreeInfo;           // Main workspace worktree
  worktrees: WorktreeInfo[];    // Array of additional worktrees
}
```

### New Validation Function Signature

```typescript
/**
 * Validate if a worktree is properly configured and accessible
 * 
 * @param mainGitDir - Path to main repository's .git directory
 * @param worktreeName - Name of the worktree (directory name in .git/worktrees/)
 * @returns true if worktree is valid and accessible, false otherwise
 */
function isValidGitWorktree(mainGitDir: string, worktreeName: string): boolean
```

## API Design

### Public API Changes

**No breaking changes** - all existing function signatures remain unchanged:

- `getAllWorktrees(cwd: string): WorktreeList` - Same signature, improved implementation
- `getCurrentBranch(cwd: string): string` - Same signature, cleaner implementation
- `isValidGitWorktree(mainGitDir: string, worktreeName: string): boolean` - New internal utility

### Internal API Design

**Validation Function Interface**:
```typescript
// Input: mainGitDir (e.g., "/path/to/repo/.git")
//        worktreeName (e.g., "feature-branch")
// Output: boolean validation result
// Side effects: console.warn() for invalid worktrees
```

**Error Logging Strategy**:
- Standard mode: `console.warn('Skipping invalid worktree: name')`
- Debug mode: Detailed validation failure information
- No exceptions thrown for validation failures

### Integration Points

1. **worktree-utils.ts**: Add validation function, update getAllWorktrees()
2. **config.ts**: Clean getCurrentBranch() implementation
3. **Error handling**: Consistent warning messages across components
4. **Logging**: Informative but non-intrusive user feedback

## Testing Strategy

### Unit Tests for isValidGitWorktree()

**Test File**: `tests/worktree-utils.test.ts`

**Test Cases**:
```typescript
describe('isValidGitWorktree', () => {
  // Valid worktree scenarios
  test('returns true for valid worktree structure')
  test('handles absolute paths in gitdir file')
  test('handles relative paths in gitdir file')
  
  // Invalid worktree scenarios
  test('returns false when gitdir file is missing')
  test('returns false when gitdir file is empty')
  test('returns false when gitdir path is invalid')
  test('returns false when target directory is missing')
  test('returns false when target .git file is missing')
  test('returns false when .git file has invalid format')
  test('returns false when file system permissions prevent access')
  
  // Edge cases
  test('handles corrupted gitdir file content')
  test('handles special characters in paths')
  test('handles symlinks in worktree structure')
})
```

### Integration Tests for getAllWorktrees()

**Test Scenarios**:
```typescript
describe('getAllWorktrees with validation', () => {
  test('includes valid worktrees in results')
  test('excludes invalid worktrees from results')
  test('logs warnings for invalid worktrees')
  test('maintains performance with many invalid worktrees')
  test('preserves existing functionality for valid worktrees')
  test('handles mixed valid/invalid worktree scenarios')
})
```

### Regression Tests

**Existing Functionality**:
- Verify `aisanity status` works correctly for valid worktrees
- Confirm no changes to WorktreeInfo data structure
- Ensure backward compatibility with existing configurations
- Test all commands that use getAllWorktrees()

### Performance Tests

**Benchmarking**:
```typescript
describe('Performance', () => {
  test('validation is faster than git operations for invalid worktrees')
  test('overall performance improvement with stale worktrees')
  test('no performance degradation for valid worktrees')
})
```

## Development Phases

### Phase 1: Add Validation Function (Low Risk)

**Tasks**:
1. Implement `isValidGitWorktree()` in `src/utils/worktree-utils.ts`
2. Add comprehensive file system validation logic
3. Implement detailed error logging
4. Add unit tests for validation function
5. Verify no impact on existing functionality

**Validation Criteria**:
- All unit tests pass
- Function correctly identifies valid/invalid worktrees
- Appropriate warning messages logged
- No changes to existing behavior

### Phase 2: Update getAllWorktrees() (Medium Risk)

**Tasks**:
1. Integrate validation into `getAllWorktrees()` loop
2. Add early skip logic for invalid worktrees
3. Update error handling to use validation results
4. Add integration tests
5. Test with various worktree scenarios

**Validation Criteria**:
- Invalid worktrees skipped without git errors
- Valid worktrees processed correctly
- Performance improvement measurable
- Warning messages informative but not intrusive

### Phase 3: Clean getCurrentBranch() (Low Risk)

**Tasks**:
1. Remove stderr suppression from `getCurrentBranch()`
2. Update function documentation
3. Add regression tests
4. Verify no error leakage with validation in place

**Validation Criteria**:
- Clean git command execution
- No error messages in normal operation
- Existing error handling preserved
- All existing tests still pass

### Phase 4: Comprehensive Testing & Documentation

**Tasks**:
1. Full integration testing across all commands
2. Performance benchmarking
3. Update function documentation
4. Add troubleshooting guide
5. Update DEVELOPMENT.md with new patterns

**Validation Criteria**:
- All commands work correctly
- Performance goals met
- Documentation complete and accurate
- No regressions detected

### Phase 5: Optional Enhancements (Future Scope)

**Potential Additions**:
- Worktree cleanup functionality (`git worktree prune`)
- Health checking command (`aisanity worktree validate`)
- Validation result caching
- Detailed diagnostics mode
- Worktree repair suggestions

**Implementation Decision**: These are out of scope for current task but documented for future consideration.

## Critical Implementation Notes

### IMPORTANT: Implementation Order

**Must follow this sequence**:
1. Add `isValidGitWorktree()` function (new code, no breakage)
2. Update `getAllWorktrees()` to use validation (improves behavior)
3. Remove stderr suppression from `getCurrentBranch()` (clean up)

**DO NOT**:
- Change `getCurrentBranch()` first (will leak errors)
- Remove try-catch from `getAllWorktrees()` (safety net needed)
- Change function signatures (breaks backward compatibility)

### IMPORTANT: Validation Criteria

**Required for valid worktree**:
1. ✓ `.git/worktrees/<name>/gitdir` file exists
2. ✓ gitdir file is readable and contains valid path
3. ✓ Target directory exists at gitdir path
4. ✓ Target directory contains `.git` file
5. ✓ `.git` file starts with `gitdir:` reference

**Not required** (handled elsewhere):
- Config file existence (checked later in getAllWorktrees)
- Git commands succeeding (validated by file system checks)
- Branch validity (handled by getCurrentBranch)

### IMPORTANT: Error Handling Strategy

**Validation failures should**:
- Log warning message with worktree name
- Skip the worktree (continue processing others)
- Not throw exceptions (graceful degradation)
- Not exit the process

**Git operation failures after validation should**:
- Be rare (validation should catch most issues)
- Be logged as unexpected errors
- Still skip the worktree
- Not crash the application

### IMPORTANT: Performance Considerations

**Goal**: Reduce git process spawns for invalid worktrees

**Before**: Git operation → Fail → Catch exception → Skip
**After**: File system check → Skip (if invalid) → Git operation → Succeed

**Expected Improvement**: 50%+ reduction in processing time with invalid worktrees

## Success Metrics

### Functional Metrics
- [ ] No "fatal: not a git repository" error messages
- [ ] All valid worktrees appear in status output
- [ ] Invalid worktrees skipped with informative warnings
- [ ] All existing commands maintain functionality
- [ ] Backward compatibility preserved

### Performance Metrics
- [ ] Measurable performance improvement with invalid worktrees
- [ ] No performance degradation for valid worktrees
- [ ] Reduced git process spawns for invalid entries

### Quality Metrics
- [ ] Comprehensive test coverage for new validation
- [ ] Clear, informative error messages
- [ ] Clean, maintainable code structure
- [ ] Complete documentation updates

This implementation plan provides a robust solution that addresses the root cause of git worktree validation issues while maintaining backward compatibility and improving overall system performance and reliability.