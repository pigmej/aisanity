# Architecture Analysis: Fix Stop Command Container Discovery

## Context Analysis

### Current State Assessment
The `stop` command in `src/commands/stop.ts` exhibits architectural inconsistency with the modern container discovery system established in the codebase. While the `--all-worktrees` option correctly uses the unified `discoverAllAisanityContainers()` function, the default behavior relies on deprecated container name generation and legacy fallback patterns.

**Critical Issues Identified:**

1. **Deprecated Container Name Generation**: Line 47 uses `getContainerName()` which generates incorrect container names like `aisanity-cleanup` instead of discovering actual containers via labels.

2. **Missing Branch Filtering**: The command attempts to stop containers without filtering by the current branch, violating the principle of branch-specific operations.

3. **Legacy Fallback Logic**: Lines 59-94 contain multiple fallback strategies:
   - Devcontainer discovery using `devcontainer.local_folder` label (lines 59-75)
   - Workspace name pattern matching for `aisanity-${workspaceName}` and `${workspaceName}-` (lines 77-94)

4. **Inconsistent Discovery Patterns**: The `--all-worktrees` option (lines 107-182) correctly implements modern discovery with workspace mode and permissive validation, while default behavior uses outdated approaches.

### Root Cause Analysis
The inconsistency stems from incomplete migration to the unified container discovery architecture. The stop command represents a hybrid state where:

- Modern discovery is implemented for `--all-worktrees` option
- Legacy patterns remain for default behavior
- Branch-specific filtering is missing entirely
- No integration with the established `ContainerDiscoveryService` patterns

### Impact Assessment
- **User Experience**: Creates confusion with "No such container" errors when stopping containers
- **System Reliability**: Undermines trust in container management operations
- **Architectural Consistency**: Violates established patterns from other commands
- **Operational Safety**: May attempt to stop wrong containers or miss target containers

## Technology Recommendations

### Container Discovery Strategy
**IMPORTANT**: Replace deprecated `getContainerName()` with unified `discoverAllAisanityContainers()` using workspace mode.

**Recommended Approach:**
- Use `discoverAllAisanityContainers()` with workspace mode configuration
- Implement branch filtering using `getCurrentBranch(cwd)` 
- Filter discovered containers by both `aisanity.workspace` and `aisanity.branch` labels
- Remove all legacy fallback patterns

### Branch Filtering Architecture
**IMPORTANT**: Implement branch-specific container stopping to align with workspace-centric architecture.

**Recommended Approach:**
```typescript
// Discovery configuration for branch-specific stopping
const discoveryOptions = {
  mode: 'workspace',
  workspace: cwd,
  includeOrphaned: false,  // Only stop valid containers for current branch
  validationMode: 'strict',
  verbose: options.verbose,
  debug: options.debug
};

// Post-discovery branch filtering
const currentBranch = getCurrentBranch(cwd);
const branchContainers = discoveryResult.containers.filter(container => 
  container.labels?.['aisanity.branch'] === currentBranch
);
```

### Error Handling Strategy
**IMPORTANT**: Implement clear, actionable error messages for branch-specific scenarios.

**Recommended Approach:**
- Show "No containers found for branch: {branch}" when appropriate
- Provide verbose output showing discovered containers and filtering results
- Maintain graceful degradation for Docker daemon issues

## System Architecture

### Current Architecture Flow (Problematic)
```
Default Stop Behavior:
┌─────────────────┐
│ getContainerName │ ── Generates wrong names
└─────────────────┘
         │
┌─────────────────┐
│ Docker Stop     │ ── Fails with "No such container"
└─────────────────┘
         │
┌─────────────────┐
│ Legacy Fallback │ ── Multiple deprecated strategies
└─────────────────┘

--all-worktrees Behavior (Correct):
┌─────────────────────────────┐
│ discoverAllAisanityContainers │ ── Modern discovery
└─────────────────────────────┘
         │
┌─────────────────┐
│ User Confirmation │
└─────────────────┘
         │
┌─────────────────┐
│ Batch Stop      │
└─────────────────┘
```

### Target Architecture (Unified)
```
Unified Stop Behavior:
┌─────────────────────────────┐
│ discoverAllAisanityContainers │ ── Workspace mode discovery
└─────────────────────────────┘
         │
┌─────────────────┐
│ Branch Filter   │ ── Filter by current branch
└─────────────────┘
         │
┌─────────────────┐
│ Container Stop  │ ── Stop filtered containers
└─────────────────┘
```

### Core Components Integration

#### 1. Discovery Configuration
```typescript
interface StopDiscoveryOptions {
  mode: 'workspace';
  workspace: string;
  includeOrphaned: boolean;
  validationMode: 'strict' | 'permissive';
  branchFilter?: string;
  verbose: boolean;
  debug: boolean;
}
```

#### 2. Branch Filtering Service
```typescript
interface BranchFilterService {
  filterContainersByBranch(
    containers: DockerContainer[], 
    branch: string
  ): DockerContainer[];
  getCurrentBranch(cwd: string): string;
  validateBranchContainers(
    containers: DockerContainer[], 
    branch: string
  ): ValidationResult;
}
```

#### 3. Stop Command Orchestrator
```typescript
interface StopCommandOrchestrator {
  discoverBranchContainers(
    workspace: string, 
    branch: string, 
    options: StopDiscoveryOptions
  ): Promise<DockerContainer[]>;
  stopContainers(containers: DockerContainer[]): Promise<StopResult>;
  handleNoContainersFound(branch: string): void;
}
```

## Integration Patterns

### Service Integration Pattern
**IMPORTANT**: Leverage existing `discoverAllAisanityContainers()` function with workspace configuration.

```typescript
// Integration with existing discovery service
const discoveryResult = await discoverAllAisanityContainers({
  mode: 'workspace',
  workspace: cwd,
  includeOrphaned: false,
  validationMode: 'strict',
  verbose: options.verbose,
  debug: options.debug
});

// Branch-specific filtering
const currentBranch = getCurrentBranch(cwd);
const targetContainers = discoveryResult.containers.filter(container =>
  container.labels?.['aisanity.workspace'] === cwd &&
  container.labels?.['aisanity.branch'] === currentBranch
);
```

### Configuration Pattern
**IMPORTANT**: Use workspace mode discovery with branch filtering for default stop behavior.

```typescript
const stopDiscoveryConfig = {
  // Default behavior: branch-specific stopping
  default: {
    mode: 'workspace',
    includeOrphaned: false,
    validationMode: 'strict'
  },
  // --all-worktrees: existing behavior preserved
  allWorktrees: {
    mode: 'global', 
    includeOrphaned: true,
    validationMode: 'permissive'
  },
  // --worktree: worktree-specific behavior
  worktree: {
    mode: 'worktree',
    includeOrphaned: false,
    validationMode: 'strict'
  }
};
```

### Error Handling Pattern
**IMPORTANT**: Implement branch-specific error messaging and graceful degradation.

```typescript
interface StopErrorHandling {
  noContainersForBranch(branch: string): void;
  discoveryError(error: Error): void;
  containerStopError(container: string, error: Error): void;
  dockerDaemonError(error: Error): void;
}
```

## Implementation Guidance

### Phase 1: Discovery Integration
1. **Replace getContainerName()**: Remove line 47 and implement `discoverAllAisanityContainers()` with workspace mode
2. **Add Branch Filtering**: Implement `getCurrentBranch(cwd)` and filter containers by `aisanity.branch` label
3. **Remove Legacy Fallbacks**: Delete lines 59-94 (devcontainer and workspace pattern fallbacks)

### Phase 2: Error Handling Enhancement
1. **Branch-Specific Messages**: Implement "No containers found for branch: {branch}" messaging
2. **Verbose Discovery Output**: Show discovered containers and filtering results in verbose mode
3. **Graceful Degradation**: Handle Docker daemon issues consistently

### Phase 3: Option Preservation
1. **Maintain --worktree**: Preserve existing worktree-specific functionality
2. **Preserve --all-worktrees**: Keep existing global discovery behavior unchanged
3. **Consistent Verbosity**: Ensure verbose/debug options work across all modes

### IMPORTANT: Critical Implementation Decisions

#### Discovery Strategy Unification
**IMPORTANT**: Default stop behavior must use the same discovery patterns as `--all-worktrees` but with branch filtering.

- Default: `mode: 'workspace', includeOrphaned: false, validationMode: 'strict'`
- All-worktrees: `mode: 'global', includeOrphaned: true, validationMode: 'permissive'`
- Worktree: `mode: 'worktree', includeOrphaned: false, validationMode: 'strict'`

#### Branch Filtering Logic
**IMPORTANT**: Container filtering must use both workspace and branch labels for precise targeting.

```typescript
const targetContainers = discoveryResult.containers.filter(container => {
  const workspaceMatch = container.labels?.['aisanity.workspace'] === cwd;
  const branchMatch = container.labels?.['aisanity.branch'] === currentBranch;
  return workspaceMatch && branchMatch;
});
```

#### Legacy Code Removal
**IMPORTANT**: Complete removal of all fallback patterns as specified in user requirements.

- Remove `getContainerName()` usage (line 47)
- Remove devcontainer fallback (lines 59-75)
- Remove workspace name pattern fallback (lines 77-94)
- No compatibility layers or gradual migration

#### Error Message Consistency
**IMPORTANT**: Provide clear, actionable feedback that matches user expectations.

- "No containers found for branch: {branch}" when no containers exist
- Show discovered container count in verbose mode
- Maintain existing success/error message patterns

### Testing Strategy
1. **Unit Tests**: Test branch filtering logic with various container label combinations
2. **Integration Tests**: Test stop command with real Docker containers and different branches
3. **Regression Tests**: Ensure `--worktree` and `--all-worktrees` options continue working
4. **Edge Case Tests**: Test behavior with no containers, invalid branches, Docker daemon issues

### Migration Considerations

#### Backward Compatibility
- Preserve all existing command-line options and flags
- Maintain existing output formats and success/error messages
- Ensure existing scripts and automation continue to function

#### Performance Optimization
- Leverage existing container discovery caching mechanisms
- Minimize Docker API calls through batch operations
- Use efficient label-based filtering

#### Security Considerations
- Validate workspace and branch inputs to prevent path traversal
- Ensure container stopping operations are properly authorized
- Maintain existing Docker socket security practices

## Success Metrics

### Functional Metrics
- **Container Discovery Accuracy**: 100% correct container identification for current branch
- **Legacy Code Removal**: Complete elimination of fallback patterns (lines 59-94)
- **Option Preservation**: All existing options (`--worktree`, `--all-worktrees`) function unchanged

### User Experience Metrics
- **Error Message Clarity**: Clear feedback when no containers found for branch
- **Operation Success Rate**: Elimination of "No such container" errors for valid scenarios
- **Consistency**: Uniform behavior across all stop command modes

### Architectural Metrics
- **Code Consistency**: Default behavior uses same discovery patterns as `--all-worktrees`
- **Maintainability**: Removal of legacy code reduces complexity
- **Test Coverage**: Comprehensive coverage for new branch filtering logic

This architectural analysis provides a structured approach to fixing the stop command container discovery while maintaining consistency with the established unified discovery architecture and preserving all existing functionality.