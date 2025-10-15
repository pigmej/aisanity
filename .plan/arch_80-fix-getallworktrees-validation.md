# Architecture: Fix getAllWorktrees Validation

## Context Analysis

### Problem Summary
The current implementation of `getAllWorktrees()` in `src/utils/worktree-utils.ts` (lines 148-237) iterates through all directories in `.git/worktrees/` and attempts to call `getCurrentBranch()` on each one. When worktree directories become invalid (deleted, moved, or corrupted), these git operations fail with "fatal: not a git repository" errors.

The current approach has two issues:
1. **Symptom suppression**: `getCurrentBranch()` in `src/utils/config.ts` (lines 40-52) suppresses stderr via `stdio: ['pipe', 'pipe', 'pipe']`, hiding errors instead of preventing them
2. **Reactive error handling**: Errors are caught after failed git operations (line 226-229 in worktree-utils.ts), which is inefficient and generates noise

### Root Cause
The system attempts git operations on potentially invalid worktree directories without first validating their structure. Git worktree metadata can become stale when:
- Worktree directories are manually deleted
- Directories are moved without using `git worktree move`
- File system corruption affects worktree structure
- Network shares/portable devices are unmounted

### Current Implementation Analysis

**getAllWorktrees() Flow (lines 148-237)**:
```
1. Get top-level path and worktrees directory
2. Find main git repository path
3. Load main workspace config
4. Iterate through worktree directories
5. For each directory:
   a. Call getCurrentBranch(worktreePath) - MAY FAIL
   b. Load config - validation happens here
   c. Skip if no config found
   d. Add to worktree list
```

**getCurrentBranch() Implementation (lines 40-52)**:
```typescript
// Executes: git rev-parse --abbrev-ref HEAD
// Uses: stdio: ['pipe', 'pipe', 'pipe'] to suppress stderr
// Returns: 'main' on any error
```

### Git Worktree Structure
Based on investigation of `.git/worktrees/<name>/`:

**Required files for valid worktree**:
- `gitdir` - Contains path to actual worktree's .git file
- `HEAD` - Current HEAD reference
- `commondir` - Points to main repo's .git directory

**Validation indicators**:
1. `.git/worktrees/<name>/gitdir` file must exist
2. Path in `gitdir` file must point to existing directory
3. That directory must contain a `.git` file with `gitdir:` reference

### Impact Analysis

**Affected Commands**:
- `aisanity status` - Primary user-facing issue
- `aisanity worktree list` - May show incomplete data
- Any command that calls `getAllWorktrees()`

**User Experience**:
- Error messages leak through despite stderr suppression
- Performance degradation from failed git operations
- Confusion about worktree state

## Technology Recommendations

### Validation Strategy

**IMPORTANT: Use file system checks before git operations**

Instead of relying on git commands to fail, implement proactive validation:

1. **File System Validation** (Fast, no git operations)
   - Check `.git/worktrees/<name>/gitdir` exists
   - Read and parse gitdir file content
   - Verify target directory exists
   - Verify target has valid .git structure

2. **Git Command Validation** (Only when needed)
   - Use `git rev-parse --git-dir` to validate git repository
   - Only call after file system validation passes

### Implementation Approach

**IMPORTANT: Create validation utility first, then refactor consumers**

1. **Phase 1: Add Validation Function**
   - Create `isValidGitWorktree()` utility
   - Implement file system checks
   - Add comprehensive error logging
   - Keep existing functionality unchanged

2. **Phase 2: Update getAllWorktrees()**
   - Add validation before getCurrentBranch() call
   - Skip invalid worktrees early
   - Log skipped worktrees for debugging

3. **Phase 3: Clean getCurrentBranch()**
   - Remove stderr suppression
   - Restore clean implementation
   - Rely on upstream validation

### Error Handling Philosophy

**IMPORTANT: Fail fast, log clearly, recover gracefully**

- **Validation**: Catch issues before git operations
- **Logging**: Informative messages for debugging
- **Recovery**: Skip invalid worktrees, continue processing
- **User Experience**: No scary error messages in normal output

## System Architecture

### Component Structure

```
┌─────────────────────────────────────────────────┐
│           getAllWorktrees()                      │
│  (src/utils/worktree-utils.ts)                  │
└────────────┬────────────────────────────────────┘
             │
             │ For each directory in .git/worktrees/
             │
             ▼
┌─────────────────────────────────────────────────┐
│      isValidGitWorktree()                        │
│      [NEW FUNCTION]                              │
│                                                  │
│  1. Check .git/worktrees/<name>/gitdir exists   │
│  2. Read gitdir file content                    │
│  3. Extract target path from gitdir             │
│  4. Verify target directory exists              │
│  5. Verify target/.git file structure           │
│                                                  │
│  Returns: boolean                                │
│  Side effect: Logs validation failures          │
└────────────┬────────────────────────────────────┘
             │
             │ If valid
             │
             ▼
┌─────────────────────────────────────────────────┐
│      getCurrentBranch()                          │
│      (src/utils/config.ts)                       │
│                                                  │
│  CLEANED UP:                                     │
│  - Remove stdio stderr suppression              │
│  - Let errors propagate naturally               │
│  - Rely on upstream validation                  │
└─────────────────────────────────────────────────┘
```

### Data Flow

```
Input: cwd (current working directory)
  │
  ├─► getMainWorkspacePath(cwd)
  │
  ├─► fs.readdirSync(worktreesDir)
  │     │
  │     └─► For each worktreeName:
  │           │
  │           ├─► isValidGitWorktree(mainGitDir, worktreeName)
  │           │     │
  │           │     ├─► Check .git/worktrees/<name>/gitdir file
  │           │     ├─► Parse gitdir content
  │           │     ├─► Verify target directory exists
  │           │     └─► Return: boolean
  │           │
  │           ├─► If valid:
  │           │     ├─► getCurrentBranch(worktreePath)
  │           │     ├─► loadAisanityConfig(worktreePath)
  │           │     └─► Add to worktrees array
  │           │
  │           └─► If invalid:
  │                 └─► Log and skip
  │
  └─► Return: WorktreeList
```

## Integration Patterns

### Validation Function Interface

```typescript
/**
 * Validate if a worktree is properly configured and accessible
 * 
 * Checks:
 * 1. Worktree metadata exists in .git/worktrees/<name>/
 * 2. gitdir file exists and is readable
 * 3. Target worktree directory exists
 * 4. Target directory has valid git structure
 * 
 * @param mainGitDir - Path to main repository's .git directory
 * @param worktreeName - Name of the worktree (directory name in .git/worktrees/)
 * @returns true if worktree is valid and accessible, false otherwise
 */
function isValidGitWorktree(mainGitDir: string, worktreeName: string): boolean
```

### Integration Points

**1. worktree-utils.ts - getAllWorktrees()**
- Location: Line ~207, before `getCurrentBranch()` call
- Change: Add validation check
- Behavior: Skip invalid worktrees, log skipped entries

**2. config.ts - getCurrentBranch()**
- Location: Lines 40-52
- Change: Remove stderr suppression
- Behavior: Clean implementation, let errors propagate

**3. Error Logging**
- Use `console.warn()` for skipped worktrees
- Format: `Skipping invalid worktree: <name> - <reason>`
- Verbose mode: Include detailed validation failure info

### Backward Compatibility

**IMPORTANT: Maintain existing functionality for valid worktrees**

- Valid worktrees: No behavior change
- Invalid worktrees: Currently skipped silently, will be skipped with warning
- Return types: No changes to WorktreeInfo or WorktreeList interfaces
- API: No changes to public function signatures

### Performance Considerations

**Before (Current)**:
```
For each directory:
  1. Execute git rev-parse (spawns process) ❌ FAILS for invalid
  2. Catch exception
  3. Execute fs.existsSync for config
  4. Skip if no config
```

**After (Optimized)**:
```
For each directory:
  1. Check fs.existsSync for gitdir file ✓ Fast
  2. Read gitdir file ✓ Fast
  3. Check fs.existsSync for target ✓ Fast
  4. If all valid:
     a. Execute git rev-parse ✓ Succeeds
     b. Load config
```

**Performance gain**: Avoid spawning git processes for invalid worktrees

## Implementation Guidance

### Step 1: Create isValidGitWorktree() Function

**Location**: `src/utils/worktree-utils.ts` (after line 35)

**Implementation checklist**:
- [ ] Accept `mainGitDir: string` and `worktreeName: string` parameters
- [ ] Construct path to `.git/worktrees/<name>/gitdir`
- [ ] Check file exists using `fs.existsSync()`
- [ ] Read file content using `fs.readFileSync()`
- [ ] Parse gitdir path from content (remove trailing newline)
- [ ] Verify gitdir path points to existing directory
- [ ] Check that directory contains `.git` file
- [ ] Read `.git` file and verify it starts with `gitdir:`
- [ ] Add try-catch for file system errors
- [ ] Return `false` on any validation failure
- [ ] Log specific failure reason using `console.warn()`

**Edge cases to handle**:
- Missing gitdir file
- Empty gitdir file
- Invalid path in gitdir
- Relative vs absolute paths in gitdir
- Missing target directory
- Missing or invalid .git file in target
- File system permissions errors
- Corrupted file contents

### Step 2: Update getAllWorktrees()

**Location**: `src/utils/worktree-utils.ts`, line ~207

**Changes required**:
```typescript
// BEFORE (current):
for (const worktreeName of worktreeDirs) {
  const worktreePath = path.join(worktreesDir, worktreeName);
  try {
    const worktreeBranch = getCurrentBranch(worktreePath); // MAY FAIL
    // ...
  } catch (error) {
    console.warn(`Skipping invalid worktree: ${worktreeName}`);
  }
}

// AFTER (improved):
for (const worktreeName of worktreeDirs) {
  // Validate before any git operations
  if (!isValidGitWorktree(mainGitDirPath, worktreeName)) {
    // Validation function already logged the reason
    continue;
  }
  
  const worktreePath = path.join(worktreesDir, worktreeName);
  try {
    const worktreeBranch = getCurrentBranch(worktreePath); // SHOULD SUCCEED
    // ...
  } catch (error) {
    // Should rarely happen now, but keep for safety
    console.warn(`Unexpected error reading worktree ${worktreeName}:`, error);
  }
}
```

**Testing checklist**:
- [ ] Valid worktrees still appear in list
- [ ] Invalid worktrees are skipped
- [ ] Warning messages are logged for invalid worktrees
- [ ] No git error messages in output
- [ ] Performance improvement measurable

### Step 3: Clean Up getCurrentBranch()

**Location**: `src/utils/config.ts`, lines 40-52

**Changes required**:
```typescript
// BEFORE (current):
export function getCurrentBranch(cwd: string): string {
  try {
    const gitBranch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'] // ❌ REMOVE THIS
    }).trim();
    return gitBranch || 'main';
  } catch (error) {
    return 'main';
  }
}

// AFTER (clean):
export function getCurrentBranch(cwd: string): string {
  try {
    const gitBranch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd,
      encoding: 'utf8'
      // ✓ Use default stdio (inherits stderr)
    }).trim();
    return gitBranch || 'main';
  } catch (error) {
    // Git operation failed - directory is not a valid git repo
    return 'main';
  }
}
```

**Important**: This change should be made AFTER validation is in place, otherwise errors will leak through.

### Step 4: Enhanced Logging

**Add verbose logging option** (Optional enhancement):

```typescript
export function isValidGitWorktree(
  mainGitDir: string, 
  worktreeName: string,
  verbose: boolean = false
): boolean {
  if (verbose) {
    console.log(`Validating worktree: ${worktreeName}`);
  }
  
  // Validation logic...
  
  if (!valid) {
    if (verbose) {
      console.warn(`Validation failed: ${reason}`);
      console.warn(`  gitdir path: ${gitdirPath}`);
      console.warn(`  target path: ${targetPath}`);
    } else {
      console.warn(`Skipping invalid worktree: ${worktreeName}`);
    }
  }
  
  return valid;
}
```

### Step 5: Testing Strategy

**Unit tests to add** (`tests/worktree-utils.test.ts`):

1. **isValidGitWorktree tests**:
   - Valid worktree returns true
   - Missing gitdir file returns false
   - Invalid gitdir path returns false
   - Missing target directory returns false
   - Invalid .git file returns false
   - Corrupted file content returns false

2. **getAllWorktrees integration tests**:
   - Valid worktrees are included
   - Invalid worktrees are excluded
   - Warning messages are logged
   - No git errors in output

3. **Performance tests**:
   - Measure time with invalid worktrees
   - Confirm no git process spawns for invalid entries

### Step 6: Documentation Updates

**Update function documentation**:
- Document validation behavior in getAllWorktrees()
- Add JSDoc for isValidGitWorktree()
- Update error handling section in DEVELOPMENT.md
- Add troubleshooting guide for stale worktrees

### Step 7: Future Enhancements (Not in Scope)

Based on task's "Additional Suggestions":
- Worktree cleanup functionality (`git worktree prune`)
- Health checking command (`aisanity worktree validate`)
- Repair functionality for broken references
- Worktree orphan detection (already exists: `detectOrphanedContainers`)
- Validation result caching
- Detailed diagnostics command

## Critical Decisions

### IMPORTANT: Validation Criteria

**Required for valid worktree**:
1. ✓ `.git/worktrees/<name>/gitdir` file exists
2. ✓ gitdir file is readable and contains valid path
3. ✓ Target directory exists at gitdir path
4. ✓ Target directory contains `.git` file
5. ✓ `.git` file starts with `gitdir:` reference

**Not required** (handled by other validation):
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

### IMPORTANT: Implementation Order

**Must follow this sequence**:
1. Add isValidGitWorktree() function (new code, no breakage)
2. Update getAllWorktrees() to use validation (improves behavior)
3. Remove stderr suppression from getCurrentBranch() (clean up)

**DO NOT**:
- Change getCurrentBranch() first (will leak errors)
- Remove try-catch from getAllWorktrees() (safety net needed)
- Change function signatures (breaks backward compatibility)

### IMPORTANT: Performance Impact

**Goal**: Reduce git process spawns for invalid worktrees

**Measurement**:
- Benchmark before: Time to process N worktrees with M invalid
- Benchmark after: Should be faster by (M × git_process_spawn_time)
- Target: >50% reduction in processing time with invalid worktrees

**Trade-off**: Slight increase in file system operations, but much faster than process spawning

## Summary

This architecture implements proactive validation of git worktree structure before attempting git operations, improving performance, user experience, and system reliability. The solution follows the principle of "fail fast" by catching structural issues early through file system checks rather than waiting for git commands to fail.

**Key benefits**:
- No more git error messages in user output
- Better performance (avoid failed git operations)
- Clearer error messages for debugging
- Maintains backward compatibility
- Follows separation of concerns (validation → operations)

**Implementation effort**:
- Low complexity (file system checks)
- High impact (fixes user-facing issue)
- Low risk (additive changes first)
- Easy to test (file system mocking)
