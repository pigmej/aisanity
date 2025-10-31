# Architecture Analysis: Fix Container Discovery Inconsistency

## Context Analysis

### Current State Assessment
The container discovery system suffers from fundamental architectural inconsistencies between two critical commands:

**Status Command Behavior:**
- Uses workspace-specific container discovery
- Leverages cached worktree data for consistency
- Detects orphaned containers through label-based identification
- Reports 12 orphaned containers in the reported scenario

**Stop Command Behavior (--all-worktrees):**
- Uses global container discovery with fresh validation
- Validates worktrees before container discovery
- Filters out containers associated with invalid worktrees
- Reports 0 containers due to worktree validation blocking

### Root Cause Analysis
The inconsistency stems from three architectural issues:

1. **Discovery Strategy Divergence**: Different commands use different container discovery mechanisms
2. **Validation Timing Mismatch**: Worktree validation occurs at different points in the workflow
3. **Orphaned Detection Logic Variation**: Inconsistent criteria for identifying orphaned containers

### Impact Assessment
- **User Experience**: Creates confusion and undermines trust in cleanup workflows
- **System Reliability**: Orphaned containers accumulate without reliable cleanup mechanism
- **Operational Consistency**: Different commands provide conflicting information about the same system state

## Technology Recommendations

### Container Discovery Strategy
**IMPORTANT**: Implement a unified container discovery service that serves all commands consistently.

**Recommended Approach:**
- Centralized `ContainerDiscoveryService` with configurable discovery modes
- Label-based primary discovery mechanism for aisanity containers
- Fallback to name-based discovery for unlabeled containers
- Cached worktree data integration for consistency

### Worktree Validation Architecture
**IMPORTANT**: Separate worktree validation from container discovery to ensure orphaned detection reliability.

**Recommended Approach:**
- Two-phase validation: container discovery first, worktree validation second
- Permissive validation mode for orphaned container detection
- Strict validation mode for worktree-specific operations
- Validation result caching to avoid repeated filesystem checks

### Orphaned Container Detection
**Recommended Approach:**
- Container-centric detection: identify containers first, then validate worktrees
- Label-based orphaned identification using `aisanity.worktree` and `aisanity.workspace` labels
- Graceful degradation when worktree validation fails
- Age-based categorization for enhanced user experience

## System Architecture

### Core Components

#### 1. ContainerDiscoveryService
```typescript
interface ContainerDiscoveryService {
  discoverContainers(options: DiscoveryOptions): Promise<Container[]>
  discoverOrphanedContainers(options: DiscoveryOptions): Promise<Container[]>
  discoverByWorkspace(workspace: string): Promise<Container[]>
  discoverByWorktree(worktree: string): Promise<Container[]>
}
```

**Responsibilities:**
- Unified container discovery across all commands
- Configurable discovery strategies (global, workspace, worktree-specific)
- Integration with container runtime (Docker/Podman)
- Label-based container identification and categorization

#### 2. WorktreeValidationService
```typescript
interface WorktreeValidationService {
  validateWorktree(worktree: string): Promise<ValidationResult>
  validateWorktrees(worktrees: string[]): Promise<ValidationResult[]>
  getCachedWorktrees(): Promise<Worktree[]>
  refreshWorktreeCache(): Promise<void>
}
```

**Responsibilities:**
- Worktree existence and validity checking
- Git directory validation
- Cached worktree data management
- Permissive vs strict validation modes

#### 3. OrphanedContainerDetector
```typescript
interface OrphanedContainerDetector {
  detectOrphanedContainers(containers: Container[]): Promise<OrphanedContainer[]>
  categorizeByAge(containers: Container[]): Promise<AgeCategorizedContainers[]>
  generateCleanupReport(orphaned: OrphanedContainer[]): Promise<CleanupReport>
}
```

**Responsibilities:**
- Orphaned container identification logic
- Age-based categorization and reporting
- Cleanup recommendation generation
- Integration with discovery and validation services

### Data Flow Architecture

#### Unified Discovery Flow
1. **Container Discovery**: Identify all aisanity-related containers
2. **Worktree Validation**: Validate associated worktrees (non-blocking)
3. **Orphaned Detection**: Categorize containers based on validation results
4. **Result Aggregation**: Combine results for consistent reporting

#### Command-Specific Adaptations
- **Status Command**: Discovery + orphaned detection + reporting
- **Stop Command**: Discovery + validation + user confirmation + execution
- **Cleanup Command**: Discovery + orphaned detection + batch operations

## Integration Patterns

### Service Integration Pattern
**IMPORTANT**: Use dependency injection for service composition and testability.

```typescript
class ContainerCommand {
  constructor(
    private discoveryService: ContainerDiscoveryService,
    private validationService: WorktreeValidationService,
    private orphanedDetector: OrphanedContainerDetector
  ) {}
}
```

### Configuration Pattern
**IMPORTANT**: Use configuration objects to control discovery behavior per command.

```typescript
interface DiscoveryOptions {
  mode: 'global' | 'workspace' | 'worktree';
  includeOrphaned: boolean;
  validationMode: 'strict' | 'permissive';
  useCache: boolean;
  workspace?: string;
  worktree?: string;
}
```

### Error Handling Pattern
**IMPORTANT**: Implement graceful degradation for validation failures.

```typescript
interface ValidationResult {
  isValid: boolean;
  worktree: string;
  error?: Error;
  isOrphaned: boolean;
}
```

### Caching Pattern
**IMPORTANT**: Implement intelligent caching to ensure consistency and performance.

```typescript
interface CacheManager {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}
```

## Implementation Guidance

### Phase 1: Service Foundation
1. **Create ContainerDiscoveryService**: Extract and unify existing discovery logic
2. **Implement WorktreeValidationService**: Centralize validation with caching
3. **Develop OrphanedContainerDetector**: Create specialized orphaned detection logic

### Phase 2: Command Integration
1. **Refactor Status Command**: Integrate with unified discovery service
2. **Update Stop Command**: Implement two-phase discovery and validation
3. **Add Cleanup Command**: Create dedicated orphaned container cleanup workflow

### Phase 3: Enhancement Features
1. **Dry-run Support**: Add preview capability for destructive operations
2. **Age-based Reporting**: Enhance orphaned container categorization
3. **Verbose Logging**: Improve debugging and diagnostic capabilities

### Critical Implementation Decisions

#### Discovery Strategy Unification
**IMPORTANT**: All commands must use the same underlying `ContainerDiscoveryService` with appropriate configuration.

- Status: `mode: 'global', includeOrphaned: true, validationMode: 'permissive'`
- Stop: `mode: 'global', includeOrphaned: true, validationMode: 'permissive'`
- Worktree-specific: `mode: 'worktree', worktree: 'name', validationMode: 'strict'`

#### Validation Timing
**IMPORTANT**: Container discovery must occur before worktree validation to ensure orphaned detection reliability.

- Phase 1: Discover all aisanity containers (label-based)
- Phase 2: Validate associated worktrees (non-blocking)
- Phase 3: Categorize and report results

#### Error Handling Strategy
**IMPORTANT**: Validation failures should not prevent orphaned container detection.

- Log validation errors for debugging
- Continue processing even when worktree validation fails
- Provide clear feedback about validation issues in verbose mode

#### Backward Compatibility
**IMPORTANT**: All existing command-line interfaces must continue to work unchanged.

- Preserve existing option flags and behaviors
- Maintain current output formats
- Ensure existing scripts continue to function

### Testing Strategy
1. **Unit Tests**: Test each service in isolation with mocked dependencies
2. **Integration Tests**: Test command workflows with real container scenarios
3. **Consistency Tests**: Verify that status and stop commands report identical results
4. **Edge Case Tests**: Test orphaned detection with various worktree failure scenarios

### Performance Considerations
1. **Caching Strategy**: Cache worktree validation results to avoid repeated filesystem checks
2. **Parallel Processing**: Process container discovery and validation in parallel where possible
3. **Lazy Loading**: Load detailed container information only when needed
4. **Batch Operations**: Minimize container runtime API calls through batching

This architecture ensures consistent container discovery across all commands while maintaining the flexibility needed for different operational contexts and preserving backward compatibility.