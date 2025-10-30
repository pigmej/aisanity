# Implementation Plan: Remove Deprecated Methods and Fallback Mechanisms

## Implementation Overview

This plan addresses systematic removal of technical debt accumulated during the transition from a worktree-centric to a workspace-centric architecture. The cleanup targets approximately 200-300 lines of deprecated code across 5 core files, organized into two phases based on risk level and dependency analysis.

### Goals

1. **Code Cleanliness**: Remove ~200-300 lines of deprecated code across 5 files
2. **Reduced Complexity**: Eliminate unused code paths and legacy compatibility layers
3. **Improved Maintainability**: Prevent confusion for new developers encountering deprecated code
4. **Preserved Functionality**: Ensure all current features continue to work with modern implementations
5. **Zero Regressions**: Maintain 100% test pass rate after cleanup

### Phased Approach

**Phase 1: High Priority Safe Removals (Immediate)**
- Risk Level: Low
- Files: 3 files (~50 lines)
- Target: Commented code blocks and deprecated test cases
- Timeline: Can be executed immediately

**Phase 2: Medium Priority Removals (v2.0.0)**
- Risk Level: Medium
- Files: 2 files (~200 lines)
- Target: Deprecated interfaces and legacy configuration handling
- Timeline: Align with v2.0.0 release for justified breaking changes

## Component Details

### Phase 1: Safe Removals

#### 1.1 Remove Disabled Fallback Strategies in container-utils.ts

**Location**: `src/utils/container-utils.ts`

**Lines to Remove**:
- Lines 248-271: Commented fallback strategy for name pattern discovery
- Lines 756-773: Commented devcontainer metadata discovery fallback

**Code Blocks to Remove**:

```typescript
// Strategy 2: Discover by container name pattern (fallback) - DISABLED
// This fallback is too broad and includes non-aisanity containers
// We only want to manage containers that have explicit aisanity.workspace labels
/*
if (containers.length === 0) {
  try {
    const result = await executeDockerCommand(
      `docker ps -a --format "{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Labels}}"`,
      { silent: true, debug },
    );

    if (result.success) {
      const allContainers = parseDockerOutputToContainers(result.stdout, workspaceId);
      // Filter by name pattern that suggests workspace containers
      const workspaceContainers = allContainers.filter(
        (container) => container.name.includes(workspaceId) || container.labels["aisanity.workspace"] === workspaceId,
      );
      containers.push(...workspaceContainers);
    }
  } catch (error: unknown) {
    if (debug) {
      console.log(`Strategy 2 (name pattern) failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
    // Continue to next strategy
  }
}
*/
```

**Rationale**: These code blocks are completely commented out and serve no functional purpose. They were disabled because they were too broad and included non-aisanity containers. The comments provide historical context but clutter the codebase.

**Impact**: Zero functional impact - code is already disabled.

#### 1.2 Update Import References

**Location**: `src/commands/cleanup.ts`

**Current Code**:
```typescript
const discoveryResult = await discoverContainers(options.verbose);
```

**Updated Code**:
```typescript
const discoveryResult = await discoverAllAisanityContainers({
  mode: 'global',
  includeOrphaned: true,
  validationMode: 'permissive',
  verbose: options.verbose || false
});
```

**Files to Check for Import Updates**:
- `src/commands/cleanup.ts` (confirmed usage)
- `src/commands/stop.ts` (potential usage)
- `tests/devcontainer-name-compatibility.test.ts` (test usage - may need test updates)

**Rationale**: The `discoverContainers()` wrapper function is deprecated and delegates to `discoverAllAisanityContainers()`. Direct calls to the modern function improve code clarity and remove unnecessary indirection.

**Impact**: Low - both functions provide identical functionality, just different API signatures.

#### 1.3 Remove Deprecated Test Cases

**Location**: `tests/status-regression.test.ts`

**Test Cases to Remove**:

```typescript
it('should maintain backward compatibility with existing interfaces', async () => {
  // Test that old functions still exist (even if deprecated)
  const statusModule = await import('../src/commands/status');
  
  // These functions should still be available (deprecated)
  expect(statusModule.mapContainersToWorktrees).toBeDefined();
  expect(statusModule.formatWorktreeTable).toBeDefined();
  expect(statusModule.generateWorktreeSummary).toBeDefined();
  
  // Test that the functions are actually callable
  expect(typeof statusModule.mapContainersToWorktrees).toBe('function');
  expect(typeof statusModule.formatWorktreeTable).toBe('function');
  expect(typeof statusModule.generateWorktreeSummary).toBeDefined();
});
```

**Lines**: Approximately lines 178-191

**Rationale**: This test explicitly verifies that deprecated functions still exist. Once we remove those functions in Phase 2, this test becomes invalid. Removing it in Phase 1 prepares the test suite for Phase 2 cleanup.

**Impact**: Low - test only validates existence of deprecated functions that are scheduled for removal.

### Phase 2: Medium Risk Removals (v2.0.0)

#### 2.1 Remove Deprecated Interfaces and Functions in status.ts

**Location**: `src/commands/status.ts`

**Components to Remove**:

1. **WorktreeStatusRow Interface** (Lines 14-25)
   - Deprecated since v1.5.0
   - Replaced by: `WorkspaceStatusRow`
   - Used by: `formatWorktreeTable()`, `generateWorktreeSummary()`, `calculateColumnWidths()`

2. **mapContainersToWorktrees() Function** (Lines 607-710)
   - Deprecated since v1.5.0
   - Replaced by: `groupContainersByWorkspace()`
   - Used by: None (only referenced in tests)
   - Migration pattern documented in deprecation comment

3. **getContainerStatusWithPorts() Function** (Lines 712-766)
   - Deprecated annotation present
   - Replaced by: `getContainerStatus()` from container-utils
   - Used by: None (internal helper, not exported)

4. **formatWorktreeTable() Function** (Lines 868-900)
   - Deprecated since v1.5.0
   - Replaced by: `formatWorkspaceTable()`
   - Used by: None (only referenced in tests)

5. **generateWorktreeSummary() Function** (Lines 902-939)
   - Deprecated since v1.5.0
   - Replaced by: `generateWorkspaceSummary()`
   - Used by: None (only referenced in tests)

6. **calculateColumnWidths() Helper** (Lines 845-865)
   - Helper for deprecated `formatWorktreeTable()`
   - Can be removed with `formatWorktreeTable()`

**Total Lines to Remove**: ~200 lines

**Dependency Chain**:
```
WorktreeStatusRow (interface)
  ├── calculateColumnWidths() [helper]
  ├── formatWorktreeTable() [public, deprecated]
  └── generateWorktreeSummary() [public, deprecated]

mapContainersToWorktrees() [public, deprecated]
  └── No internal dependencies

getContainerStatusWithPorts() [private, deprecated]
  └── No internal dependencies
```

**Migration Guide for External Users** (if any):

```typescript
// OLD API (deprecated)
const { mapped, unmapped } = await mapContainersToWorktrees(path, verbose);
const table = formatWorktreeTable(statusRows);
const summary = generateWorktreeSummary(worktrees, statusRows);

// NEW API (modern)
const { rows, warnings } = await groupContainersByWorkspace(path, { verbose });
const table = formatWorkspaceTable(rows);
const summary = generateWorkspaceSummary(workspaceName, rows);
```

#### 2.2 Remove Legacy Configuration Handling in config.ts

**Location**: `src/utils/config.ts`

**Code to Remove** (Lines 18-29):

```typescript
if (existingConfig && existingConfig.workspace) {
  // Check if this is a legacy config (workspace includes branch separator)
  if (existingConfig.workspace.includes('_')) {
    // Legacy mode: extract project name from workspace_branch format
    const parts = existingConfig.workspace.split('_');
    if (parts.length > 1) {
      // Return just the project name part (everything before the last underscore)
      return parts.slice(0, -1).join('_');
    }
  }
  // New mode: workspace is already branch-agnostic
  return existingConfig.workspace;
}
```

**Simplified Code**:

```typescript
if (existingConfig && existingConfig.workspace) {
  // Modern workspace format is branch-agnostic
  return existingConfig.workspace;
}
```

**Lines to Remove**: ~12 lines

**Rationale**: The old `workspace_branch` format was a one-time migration pattern from earlier versions. Users have had multiple releases to migrate their configurations. Removing this legacy handling simplifies the configuration loading logic.

**Impact**: Medium - Users with very old configurations (pre-v1.0) may need to manually update their `.aisanity` config files. This is acceptable for a v2.0.0 breaking change.

#### 2.3 Remove discoverContainers() Wrapper Function

**Location**: `src/utils/container-utils.ts`

**Function to Remove** (Lines 879-939):

```typescript
/**
 * Legacy wrapper for backward compatibility.
 * Now delegates to new unified discovery system.
 * @deprecated Use `discoverAllAisanityContainers()` for new code.
 */
export async function discoverContainers(
  verbose: boolean = false,
  cachedWorktrees?: WorktreeList,
): Promise<ContainerDiscoveryResult> {
  // Use new unified discovery with permissive validation
  const result = await discoverAllAisanityContainers({
    mode: "global",
    includeOrphaned: true,
    validationMode: "permissive",
    verbose,
    cachedWorktrees,
  });

  // Return in legacy format for backward compatibility
  return {
    containers: result.containers,
    labeled: result.labeled,
    unlabeled: result.unlabeled,
    orphaned: result.orphaned,
    errors: result.errors,
  };
}
```

**Lines to Remove**: ~60 lines

**Prerequisite**: Must update all references to use `discoverAllAisanityContainers()` instead (completed in Phase 1).

**Rationale**: This wrapper function exists solely for backward compatibility. It adds no functional value and creates confusion about which discovery function to use.

**Impact**: Low (after Phase 1 import updates) - all internal code will already be using the modern function.

## Data Structures

### Current Deprecated Structures

```typescript
// DEPRECATED: Old worktree-centric model
interface WorktreeStatusRow {
  name: string;           // Worktree name (display name)
  branch: string;        // Branch name
  container: string;     // Container name
  status: string;        // Container status
  ports: string;        // Port mapping
  isActive: boolean;     // Whether this is the active worktree
}
```

### Modern Replacement Structures

```typescript
// MODERN: New workspace-centric model
interface WorkspaceStatusRow {
  workspace: string;      // Workspace name (from config.workspace)
  branch: string;         // Branch name (from aisanity.branch label)
  container: string;      // Container name
  worktreeStatus: string; // "✅ worktree-name" | "❌ none"
  status: string;         // Container status (Running/Stopped/Not created)
  ports: string;          // Port information
  isCurrentWorktree: boolean;  // Whether branch matches current active worktree
  validation?: ContainerLabelValidation;  // Label validation metadata
  hasWarning: boolean;    // Indicates if container has label issues
}

// Enhanced validation metadata
interface ContainerLabelValidation {
  isValid: boolean;
  hasWorkspaceLabel: boolean;
  hasBranchLabel: boolean;
  detectedBranch: string | null;
  detectionMethod: 'label' | 'name-pattern' | 'worktree-match' | 'unknown';
  warnings: string[];
}
```

### Key Differences

| Aspect | Deprecated (Worktree-Centric) | Modern (Workspace-Centric) |
|--------|-------------------------------|---------------------------|
| Primary Key | Worktree name | Workspace path |
| Branch Detection | From worktree | From container labels with fallback |
| Validation | None | Full label validation with warnings |
| Error Handling | Basic | Comprehensive with recovery strategies |
| Orphaned Detection | Limited | Enhanced with validation metadata |

## API Design

### Phase 1: No API Changes

Phase 1 focuses on removing disabled code and updating internal implementation without changing public APIs.

### Phase 2: Deprecated API Removal

#### Removed Public Functions

```typescript
// REMOVED in v2.0.0
export async function mapContainersToWorktrees(
  workspacePath: string, 
  verbose: boolean
): Promise<{...}>

export function formatWorktreeTable(rows: WorktreeStatusRow[]): string

export function generateWorktreeSummary(
  worktrees: WorktreeList, 
  statusRows: WorktreeStatusRow[]
): WorktreeSummary

export async function discoverContainers(
  verbose: boolean, 
  cachedWorktrees?: WorktreeList
): Promise<ContainerDiscoveryResult>
```

#### Modern Replacements

```typescript
// MODERN API (retained)
export async function groupContainersByWorkspace(
  workspacePath: string,
  options: { verbose?: boolean; debug?: boolean }
): Promise<{
  workspaceName: string;
  rows: WorkspaceStatusRow[];
  worktreeMap: Map<string, WorktreeInfo>;
  errors: ContainerError[];
  warnings: ContainerWarning[];
}>

export function formatWorkspaceTable(
  rows: WorkspaceStatusRow[]
): string

export function generateWorkspaceSummary(
  workspaceName: string,
  rows: WorkspaceStatusRow[]
): WorkspaceSummary

export async function discoverAllAisanityContainers(
  options: ContainerDiscoveryOptions
): Promise<EnhancedContainerDiscoveryResult>
```

### Breaking Changes Documentation

For v2.0.0 release notes:

```markdown
## Breaking Changes in v2.0.0

### Removed Deprecated Functions

The following functions deprecated since v1.5.0 have been removed:

1. **status.ts**
   - `mapContainersToWorktrees()` → Use `groupContainersByWorkspace()`
   - `formatWorktreeTable()` → Use `formatWorkspaceTable()`
   - `generateWorktreeSummary()` → Use `generateWorkspaceSummary()`
   - `WorktreeStatusRow` interface → Use `WorkspaceStatusRow`

2. **container-utils.ts**
   - `discoverContainers()` → Use `discoverAllAisanityContainers()`

### Legacy Configuration Support Removed

The old `workspace_branch` configuration format is no longer supported. 
If you have a configuration from pre-v1.0, update your `.aisanity` file:

```yaml
# OLD (no longer supported)
workspace: myproject_main

# NEW (required)
workspace: myproject
```

### Migration Guide

See full migration guide in UPGRADING.md for detailed examples.
```

## Testing Strategy

### Pre-Removal Testing (Validation)

1. **Identify All References**
   ```bash
   # Search for deprecated function usage
   rg "mapContainersToWorktrees" --type ts
   rg "formatWorktreeTable" --type ts
   rg "generateWorktreeSummary" --type ts
   rg "discoverContainers\(" --type ts
   rg "WorktreeStatusRow" --type ts
   ```

2. **Verify Modern Implementations**
   - Ensure `groupContainersByWorkspace()` has comprehensive test coverage
   - Verify `formatWorkspaceTable()` produces correct output
   - Confirm `discoverAllAisanityContainers()` handles all edge cases

3. **Baseline Test Run**
   ```bash
   bun test
   bun test:integration
   ```
   - Document current test pass rate
   - Identify any flaky tests unrelated to deprecation removal

### Phase 1 Testing

**After Removing Commented Code Blocks**:
```bash
# Verify syntax is valid
bun run build

# Run all tests
bun test

# Specifically test container discovery
bun test tests/container-discovery*.test.ts
bun test tests/container-utils.test.ts
```

**Expected Results**:
- All tests pass (100% pass rate maintained)
- Build completes successfully
- No runtime errors in discovery logic

**After Updating Import References**:
```bash
# Test cleanup command with new API
bun test tests/cleanup.test.ts

# Integration tests
bun test:integration
```

**Expected Results**:
- Cleanup command works identically to before
- No behavioral changes observed
- Performance characteristics unchanged

**After Removing Deprecated Test Cases**:
```bash
# Run status regression tests
bun test tests/status-regression.test.ts

# Run all status-related tests
bun test tests/status*.test.ts
```

**Expected Results**:
- Test suite passes without deprecated test case
- Other regression tests continue to validate core functionality

### Phase 2 Testing

**After Removing Deprecated Functions in status.ts**:
```bash
# Check for compilation errors
bun run build

# Run status command tests
bun test tests/status*.test.ts
bun test tests/workspace*.test.ts

# Run integration tests
bun test tests/command-discovery-consistency-integration.test.ts
```

**Expected Results**:
- Modern implementations work correctly
- No references to removed functions remain
- All workspace-centric tests pass

**After Removing Legacy Config Handling**:
```bash
# Test configuration loading
bun test tests/config.test.ts

# Test initialization with modern config
bun test tests/init.test.ts
```

**Expected Results**:
- Modern configuration format works correctly
- No errors loading branch-agnostic workspace names

**After Removing discoverContainers() Wrapper**:
```bash
# Test container discovery
bun test tests/container-discovery*.test.ts
bun test tests/discover-opencode*.test.ts

# Full integration test suite
bun test:integration
```

**Expected Results**:
- Modern discovery function works identically
- No performance degradation
- All orphaned container detection continues to work

### Final Validation

**Full Test Suite**:
```bash
# Run complete test suite
bun test

# Run integration tests
bun test:integration

# Performance benchmarks
bun test tests/*performance*.test.ts
```

**Manual Testing Checklist**:
- [ ] `aisanity status` displays correct workspace table
- [ ] `aisanity status --verbose` shows warnings and orphaned containers
- [ ] `aisanity cleanup` discovers and removes orphaned containers
- [ ] `aisanity stop --all-worktrees` finds all containers
- [ ] Legacy configurations (if any) trigger helpful error messages
- [ ] Multi-worktree scenarios work correctly
- [ ] Single worktree scenarios work correctly
- [ ] Container discovery handles missing Docker gracefully
- [ ] Orphaned container detection works correctly

### Regression Prevention

**Create Regression Tests for Modern Implementations**:

```typescript
// tests/modern-api-regression.test.ts
describe('Modern API Regression Prevention', () => {
  it('groupContainersByWorkspace returns correct structure', async () => {
    const result = await groupContainersByWorkspace(testPath, { verbose: false });
    
    expect(result).toHaveProperty('workspaceName');
    expect(result).toHaveProperty('rows');
    expect(result).toHaveProperty('worktreeMap');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
    
    expect(Array.isArray(result.rows)).toBe(true);
    expect(result.rows[0]).toHaveProperty('workspace');
    expect(result.rows[0]).toHaveProperty('branch');
    expect(result.rows[0]).toHaveProperty('worktreeStatus');
  });
  
  it('discoverAllAisanityContainers provides enhanced metadata', async () => {
    const result = await discoverAllAisanityContainers({
      mode: 'global',
      includeOrphaned: true,
      validationMode: 'permissive'
    });
    
    expect(result).toHaveProperty('validationResults');
    expect(result).toHaveProperty('discoveryMetadata');
    expect(result.discoveryMetadata).toHaveProperty('validationMode');
  });
});
```

## Development Phases

### Phase 1: Safe Removals (Timeline: 1-2 days)

#### Step 1.1: Remove Commented Code Blocks (1 hour)

**Tasks**:
1. Open `src/utils/container-utils.ts`
2. Remove lines 248-271 (Strategy 2 fallback comment block)
3. Remove lines 756-773 (Devcontainer discovery fallback comment block)
4. Run `bun run build` to verify syntax
5. Run `bun test tests/container-utils.test.ts`

**Validation**:
- [ ] File compiles without errors
- [ ] No functional changes to container discovery
- [ ] All container-utils tests pass

**Commit Message**:
```
refactor: remove disabled fallback strategies in container discovery

Remove commented-out fallback code blocks that were too broad and
included non-aisanity containers. These strategies were disabled and
served no functional purpose. Keeping them as comments only added
clutter to the codebase.

- Remove Strategy 2 (name pattern fallback) lines 248-271
- Remove devcontainer metadata discovery fallback lines 756-773

Part of technical debt cleanup for v2.0.0.
```

#### Step 1.2: Update Import References (2-3 hours)

**Tasks**:
1. Update `src/commands/cleanup.ts`:
   ```typescript
   // OLD
   const discoveryResult = await discoverContainers(options.verbose);
   
   // NEW
   const discoveryResult = await discoverAllAisanityContainers({
     mode: 'global',
     includeOrphaned: true,
     validationMode: 'permissive',
     verbose: options.verbose || false
   });
   ```

2. Search for other usages:
   ```bash
   rg "discoverContainers\(" --type ts src/
   ```

3. Update any found references to use modern API

4. Run tests:
   ```bash
   bun test tests/cleanup.test.ts
   bun test tests/container-discovery*.test.ts
   ```

**Validation**:
- [ ] All imports updated to use `discoverAllAisanityContainers()`
- [ ] Cleanup command functionality unchanged
- [ ] All tests pass

**Commit Message**:
```
refactor: update cleanup to use modern container discovery API

Replace deprecated discoverContainers() with discoverAllAisanityContainers()
to use the modern discovery API with enhanced validation metadata.

This prepares the codebase for removing the deprecated wrapper function
in Phase 2 while maintaining identical functionality.

- Update src/commands/cleanup.ts to use new API
- Maintain backward-compatible behavior
- Preserve all existing functionality
```

#### Step 1.3: Remove Deprecated Test Cases (1 hour)

**Tasks**:
1. Open `tests/status-regression.test.ts`
2. Remove test case "should maintain backward compatibility with existing interfaces" (lines ~178-191)
3. Run `bun test tests/status-regression.test.ts`
4. Verify other regression tests still pass

**Validation**:
- [ ] Test file compiles
- [ ] Other regression tests continue to pass
- [ ] No test failures introduced

**Commit Message**:
```
test: remove backward compatibility test for deprecated functions

Remove test case that validates existence of deprecated functions
(mapContainersToWorktrees, formatWorktreeTable, generateWorktreeSummary).

This test served to ensure deprecated functions remained available during
the transition period. With Phase 2 deprecation removal approaching,
this test is no longer needed.

Preparation for v2.0.0 deprecated function removal.
```

#### Step 1.4: Phase 1 Final Validation (1 hour)

**Tasks**:
1. Run full test suite: `bun test`
2. Run integration tests: `bun test:integration`
3. Verify build: `bun run build`
4. Manual smoke testing of key commands

**Validation Checklist**:
- [ ] All tests pass (100% pass rate)
- [ ] Build completes successfully
- [ ] No runtime errors in container discovery
- [ ] Cleanup command works correctly
- [ ] Status command works correctly

### Phase 2: Medium Risk Removals (Timeline: 3-4 days, aligned with v2.0.0)

#### Step 2.1: Remove Deprecated Functions in status.ts (4-6 hours)

**Tasks**:

1. **Remove WorktreeStatusRow interface** (lines 14-25)
2. **Remove mapContainersToWorktrees()** (lines 607-710)
3. **Remove getContainerStatusWithPorts()** (lines 712-766)
4. **Remove calculateColumnWidths() helper** (lines 845-865)
5. **Remove formatWorktreeTable()** (lines 868-900)
6. **Remove generateWorktreeSummary()** (lines 902-939)

**Implementation Order**:
```
1. Remove WorktreeStatusRow interface
2. Remove helper function calculateColumnWidths()
3. Remove public deprecated functions:
   - mapContainersToWorktrees()
   - getContainerStatusWithPorts()
   - formatWorktreeTable()
   - generateWorktreeSummary()
```

**After Each Removal**:
```bash
# Check compilation
bun run build

# Run affected tests
bun test tests/status*.test.ts
```

**Validation**:
- [ ] File compiles without WorktreeStatusRow references
- [ ] No broken imports in other files
- [ ] All status tests pass with modern implementations

**Commit Message**:
```
feat!: remove deprecated worktree-centric functions and interfaces

BREAKING CHANGE: Remove deprecated functions and interfaces from status.ts
that were marked for removal in v2.0.0:

- WorktreeStatusRow interface → use WorkspaceStatusRow
- mapContainersToWorktrees() → use groupContainersByWorkspace()
- formatWorktreeTable() → use formatWorkspaceTable()
- generateWorktreeSummary() → use generateWorkspaceSummary()
- getContainerStatusWithPorts() → use getContainerStatus() from container-utils
- calculateColumnWidths() helper → internal to formatWorktreeTable()

These functions were deprecated since v1.5.0 during the transition from
worktree-centric to workspace-centric architecture. All functionality
is preserved through modern replacement functions.

Removes ~200 lines of deprecated code.
See migration guide in UPGRADING.md for replacement patterns.
```

#### Step 2.2: Remove Legacy Config Handling (2 hours)

**Tasks**:

1. Open `src/utils/config.ts`
2. Locate `getWorkspaceName()` function
3. Remove legacy `workspace_branch` format handling (lines 18-29)
4. Simplify to modern format only:
   ```typescript
   export function getWorkspaceName(cwd: string): string {
     const existingConfig = loadAisanityConfig(cwd);
     if (existingConfig && existingConfig.workspace) {
       // Modern workspace format is branch-agnostic
       return existingConfig.workspace;
     }

     // Generate default workspace name from folder
     const folderName = path.basename(cwd);
     const sanitizedFolder = folderName.replace(/[^a-zA-Z0-9]/g, '_');
     return sanitizedFolder;
   }
   ```

5. Run tests:
   ```bash
   bun test tests/config.test.ts
   bun test tests/init.test.ts
   ```

**Validation**:
- [ ] Modern configuration format works correctly
- [ ] No errors loading branch-agnostic workspace names
- [ ] All config tests pass

**Commit Message**:
```
feat!: remove legacy workspace_branch configuration format support

BREAKING CHANGE: Remove support for legacy workspace_branch configuration
format (e.g., "myproject_main"). This format was used in pre-v1.0 versions
and has been replaced by branch-agnostic workspace names.

Users with legacy configurations should update their .aisanity config:
  OLD: workspace: myproject_main
  NEW: workspace: myproject

Simplifies configuration loading logic by removing one-time migration code.
Removes ~12 lines of legacy compatibility code.
```

#### Step 2.3: Remove discoverContainers() Wrapper (2 hours)

**Tasks**:

1. Verify all references updated (should be done in Phase 1)
   ```bash
   rg "discoverContainers\(" --type ts src/
   # Should return 0 results in src/ directory
   ```

2. Open `src/utils/container-utils.ts`
3. Remove `discoverContainers()` function (lines 879-939)
4. Update exports if needed
5. Update test files that reference this function:
   ```bash
   rg "discoverContainers\(" --type ts tests/
   # Update remaining test references
   ```

**Validation**:
- [ ] No references to discoverContainers() in src/ directory
- [ ] All container discovery tests pass
- [ ] Integration tests pass

**Commit Message**:
```
feat!: remove deprecated discoverContainers() wrapper function

BREAKING CHANGE: Remove deprecated discoverContainers() wrapper function
that provided backward compatibility with the legacy discovery API.

Use discoverAllAisanityContainers() instead:

  OLD:
  const result = await discoverContainers(verbose);

  NEW:
  const result = await discoverAllAisanityContainers({
    mode: 'global',
    includeOrphaned: true,
    validationMode: 'permissive',
    verbose: verbose
  });

The modern API provides enhanced validation metadata and clearer
configuration options. Removes ~60 lines of wrapper code.
```

#### Step 2.4: Phase 2 Final Validation (4 hours)

**Tasks**:

1. **Full Test Suite**:
   ```bash
   bun test
   bun test:integration
   bun test tests/*performance*.test.ts
   ```

2. **Build Verification**:
   ```bash
   bun run build
   npm pack  # Verify package builds correctly
   ```

3. **Manual Testing**:
   - Test status command in various scenarios
   - Test cleanup command
   - Test stop --all-worktrees
   - Test with single worktree
   - Test with multiple worktrees
   - Test with orphaned containers
   - Test with missing Docker

4. **Documentation Updates**:
   - Create UPGRADING.md with migration guide
   - Update CHANGELOG.md with breaking changes
   - Update README.md if any examples reference deprecated functions
   - Update DEVELOPMENT.md if needed

**Validation Checklist**:
- [ ] All tests pass (100% pass rate maintained)
- [ ] Build completes successfully
- [ ] Package can be created
- [ ] Manual testing scenarios all work correctly
- [ ] Documentation updated
- [ ] Migration guide created
- [ ] CHANGELOG.md updated with breaking changes

### Post-Removal Activities

#### Documentation Updates

**Create UPGRADING.md**:

```markdown
# Upgrading to v2.0.0

## Breaking Changes

### Deprecated Function Removal

The following functions deprecated since v1.5.0 have been removed in v2.0.0.

#### Status Functions

**mapContainersToWorktrees()**
```typescript
// OLD (removed)
const { mapped, unmapped } = await mapContainersToWorktrees(path, verbose);

// NEW (use this)
const { rows, warnings } = await groupContainersByWorkspace(path, { verbose });
```

**formatWorktreeTable()**
```typescript
// OLD (removed)
const table = formatWorktreeTable(statusRows);

// NEW (use this)
const table = formatWorkspaceTable(workspaceRows);
```

**generateWorktreeSummary()**
```typescript
// OLD (removed)
const summary = generateWorktreeSummary(worktrees, statusRows);

// NEW (use this)
const summary = generateWorkspaceSummary(workspaceName, workspaceRows);
```

#### Container Discovery

**discoverContainers()**
```typescript
// OLD (removed)
const result = await discoverContainers(verbose);

// NEW (use this)
const result = await discoverAllAisanityContainers({
  mode: 'global',
  includeOrphaned: true,
  validationMode: 'permissive',
  verbose: verbose
});
```

### Legacy Configuration Format

The old `workspace_branch` format is no longer supported.

**Update your .aisanity config:**
```yaml
# OLD (no longer supported)
workspace: myproject_main

# NEW (required in v2.0.0)
workspace: myproject
```

### Removed Interfaces

- `WorktreeStatusRow` → Use `WorkspaceStatusRow`

## Migration Timeline

- v1.5.0: Functions deprecated with warnings
- v1.6.0 - v1.9.0: Deprecation warnings in place
- v2.0.0: Deprecated functions removed
```

**Update CHANGELOG.md**:

```markdown
# Changelog

## [2.0.0] - YYYY-MM-DD

### Breaking Changes

- **Removed deprecated functions**: `mapContainersToWorktrees()`, `formatWorktreeTable()`, 
  `generateWorktreeSummary()`, `discoverContainers()` (deprecated since v1.5.0)
- **Removed deprecated interfaces**: `WorktreeStatusRow` (use `WorkspaceStatusRow`)
- **Removed legacy config support**: Old `workspace_branch` format no longer supported
- See UPGRADING.md for complete migration guide

### Removed

- Disabled fallback strategies in container discovery (~50 lines)
- Legacy configuration format handling (~12 lines)
- Deprecated worktree-centric functions (~200 lines)
- Backward compatibility wrapper functions (~60 lines)

### Improved

- Cleaner codebase with ~300 lines of deprecated code removed
- Reduced complexity in container discovery
- Simplified configuration loading logic
- Better maintainability for new developers

## [1.5.0] - Previous Release

### Deprecated

- `mapContainersToWorktrees()` - Use `groupContainersByWorkspace()` instead
- `formatWorktreeTable()` - Use `formatWorkspaceTable()` instead
- `generateWorktreeSummary()` - Use `generateWorkspaceSummary()` instead
- `discoverContainers()` - Use `discoverAllAisanityContainers()` instead
- `WorktreeStatusRow` interface - Use `WorkspaceStatusRow` instead
```

#### Static Analysis Setup

**Add ESLint Rules** (if ESLint is configured):

```json
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": [{
        "group": ["**/status"],
        "importNames": ["mapContainersToWorktrees", "formatWorktreeTable", "generateWorktreeSummary"],
        "message": "These functions were removed in v2.0.0. See UPGRADING.md for migration guide."
      }]
    }]
  }
}
```

#### Git Tags and Release Notes

```bash
# After Phase 2 completion
git tag -a v2.0.0-beta.1 -m "Beta release with deprecated code removal"
git push origin v2.0.0-beta.1

# After validation period
git tag -a v2.0.0 -m "v2.0.0: Major cleanup - deprecated code removal"
git push origin v2.0.0
```

## Success Metrics

### Quantitative Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Lines of Code Removed | 200-300 | `git diff --stat` |
| Test Coverage Maintained | ≥95% | `bun test --coverage` |
| Performance Impact | <5% degradation | Performance benchmarks |
| Build Time Impact | <10% increase | CI/CD pipeline timing |
| Test Pass Rate | 100% | `bun test` output |

### Qualitative Metrics

| Metric | Success Criteria |
|--------|------------------|
| Code Readability | No deprecated code markers in codebase |
| API Clarity | Single clear API for each operation |
| Documentation | Complete migration guide available |
| Developer Experience | New developers don't encounter deprecated patterns |

### Validation Checklist

**Phase 1 Completion**:
- [ ] ~50 lines of commented code removed
- [ ] All imports updated to modern APIs
- [ ] Deprecated test cases removed
- [ ] All tests passing (100%)
- [ ] Build successful
- [ ] Zero functional changes

**Phase 2 Completion**:
- [ ] ~200 lines of deprecated functions removed
- [ ] ~12 lines of legacy config handling removed
- [ ] ~60 lines of wrapper functions removed
- [ ] Total: ~300 lines removed across 5 files
- [ ] All tests passing (100%)
- [ ] Build successful
- [ ] Manual testing complete
- [ ] Documentation updated
- [ ] Migration guide created
- [ ] CHANGELOG.md updated

### Rollback Plan

**If Critical Issues Found**:

1. **Phase 1 Rollback**:
   ```bash
   git revert <commit-hash>  # Revert specific commits
   git push origin main
   ```

2. **Phase 2 Rollback**:
   ```bash
   # Revert to pre-Phase 2 state
   git revert <commit-hash-range>
   
   # Or create hotfix from previous tag
   git checkout -b hotfix/revert-deprecation-removal v1.9.0
   ```

3. **Communication**:
   - Issue GitHub release note explaining rollback
   - Update documentation to indicate functions remain deprecated
   - Plan alternative migration timeline

**Rollback Triggers**:
- Critical functionality broken
- >10% performance degradation
- Widespread user complaints
- Security vulnerability introduced
- Test pass rate drops below 95%

## Risk Assessment

### Phase 1 Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Import update breaks functionality | Low | Medium | Extensive testing before removal |
| Test removal causes regression | Very Low | Low | Other regression tests remain |
| Commented code had hidden dependency | Very Low | Low | Code already disabled |

### Phase 2 Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| External users depend on deprecated API | Low | High | Deprecation warnings since v1.5.0, migration guide |
| Legacy config breaks for old users | Low | Medium | Clear error messages, documentation |
| Hidden dependencies on deprecated functions | Low | High | Comprehensive static analysis before removal |
| Performance regression | Very Low | Medium | Performance benchmarks before/after |

### Overall Risk Level

- **Phase 1**: **LOW** - Removing already disabled code and updating internal references
- **Phase 2**: **MEDIUM** - Breaking changes but justified by v2.0.0 semantic versioning

## Conclusion

This implementation plan provides a structured, phased approach to removing approximately 300 lines of deprecated code across 5 files in the aisanity codebase. By separating the work into low-risk immediate removals (Phase 1) and medium-risk breaking changes aligned with v2.0.0 (Phase 2), we minimize disruption while achieving significant technical debt reduction.

The plan emphasizes:
- **Comprehensive testing** at each step
- **Clear migration paths** for external users
- **Detailed documentation** of breaking changes
- **Rollback strategies** for risk mitigation
- **Success metrics** for validation

Expected outcomes:
- Cleaner, more maintainable codebase
- Reduced complexity in core functions
- Clear, modern API surface
- No functional regressions
- Improved developer experience

**Recommended Next Steps**:
1. Review and approve this implementation plan
2. Schedule Phase 1 for immediate execution (1-2 days)
3. Schedule Phase 2 aligned with v2.0.0 release planning (3-4 days)
4. Allocate time for documentation updates and migration guide creation
5. Plan beta release for early validation of Phase 2 changes
