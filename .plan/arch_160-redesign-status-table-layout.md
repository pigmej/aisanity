# Architecture Analysis: Redesign Status Table Layout

## Context Analysis

### Current Problem
The `aisanity status` command operates on a flawed mental model that assumes every container must map to a git worktree. This creates several issues:

1. **Incorrect Primary Grouping**: Uses "Worktree" as the main table column when workspace should be primary
2. **Confusing "Unmapped" Labels**: Shows containers as "unmapped" even when they correctly belong to the workspace via `aisanity.workspace` label
3. **Missing Worktree Status**: Doesn't clearly indicate which branches have associated worktrees vs those that don't
4. **Wrong Data Hierarchy**: Prioritizes worktree existence over workspace membership

### Current Data Flow
```
Git Worktrees → Container Mapping → Table Display
     ↓               ↓                ↓
WorktreeInfo → mapContainersToWorktrees() → WorktreeStatusRow[]
```

### Key Insight
The fundamental issue is treating worktree existence as the primary organizing principle. The correct model should be:
- **Workspace** = Primary grouping (via `aisanity.workspace` label)
- **Branch** = Secondary grouping (via `aisanity.branch` label)  
- **Worktree** = Optional attribute (✅/❌ status indicator)

## Technology Recommendations

### Data Model Transformation
**IMPORTANT**: The core change requires shifting from worktree-centric to workspace-centric data structures.

**Current Interface:**
```typescript
interface WorktreeStatusRow {
  name: string;           // Worktree name
  branch: string;        // Branch name
  container: string;     // Container name
  status: string;        // Container status
  ports: string;        // Port information
  isActive: boolean;     // Active worktree indicator
}
```

**New Interface:**
```typescript
interface WorkspaceStatusRow {
  workspace: string;     // Workspace name (from config)
  branch: string;        // Branch name (from container labels)
  container: string;     // Container name
  worktreeStatus: string; // "✅ worktree-name" or "❌ none"
  status: string;        // Container status
  ports: string;        // Port information
  isActive: boolean;     // Active worktree indicator (if applicable)
}
```

### Container Discovery Strategy
**IMPORTANT**: Leverage existing `discoverWorkspaceContainers()` but change the mapping logic:

1. **Primary Discovery**: Use `aisanity.workspace` label as authoritative source
2. **Branch Association**: Use `aisanity.branch` label for secondary grouping
3. **Worktree Lookup**: Cross-reference with git worktrees to determine worktree status
4. **Eliminate "Unmapped"**: All containers with correct workspace label belong to workspace

### Table Rendering Architecture
Maintain existing table formatting infrastructure but update column structure:

- **Column 1**: Workspace (primary grouping)
- **Column 2**: Branch (secondary grouping)  
- **Column 3**: Container (container name)
- **Column 4**: Worktree (✅/❌ status with worktree name)
- **Column 5**: Status (Running/Stopped/Not created)
- **Column 6**: Ports (port mappings)

## System Architecture

### Data Processing Pipeline
```
1. Container Discovery
   ├── discoverWorkspaceContainers(workspacePath)
   └── Filter by aisanity.workspace label

2. Workspace Grouping
   ├── Group containers by workspace name
   └── Sort by workspace name

3. Branch Organization  
   ├── Within each workspace, group by branch
   └── Sort by branch name

4. Worktree Status Resolution
   ├── getAllWorktrees() for worktree list
   ├── Cross-reference branch → worktree mapping
   └── Generate ✅/❌ status indicators

5. Table Generation
   ├── Create WorkspaceStatusRow[] 
   ├── Format with existing table utilities
   └── Display with workspace summary
```

### Key Components

#### 1. Container-to-Workspace Mapper
```typescript
async function mapContainersToWorkspace(
  workspacePath: string, 
  options: { verbose?: boolean }
): Promise<{
  containers: Container[];
  workspaceGroups: Map<string, WorkspaceStatusRow[]>;
  worktreeMap: Map<string, WorktreeInfo>;
}>
```

#### 2. Worktree Status Resolver
```typescript
function resolveWorktreeStatus(
  branchName: string,
  worktreeMap: Map<string, WorktreeInfo>
): { hasWorktree: boolean; worktreeName?: string }
```

#### 3. Workspace Table Formatter
```typescript
function formatWorkspaceTable(rows: WorkspaceStatusRow[]): string
```

### Integration Patterns

#### Backward Compatibility Strategy
**IMPORTANT**: Maintain all existing CLI options and behaviors:

1. **`--worktree <path>` option**: Continue to work but show filtered workspace view
2. **`--verbose` flag**: Preserve enhanced logging and debugging information  
3. **Single vs Multi-worktree logic**: Keep existing decision tree but apply to workspace view
4. **Error handling**: Maintain Docker fallback and error recovery mechanisms

#### Data Source Integration
- **Container Utils**: Reuse existing `discoverWorkspaceContainers()` and `parseDockerOutputToContainers()`
- **Worktree Utils**: Leverage `getAllWorktrees()` for worktree status resolution
- **Config Utils**: Use `loadAisanityConfig()` for workspace name determination

#### Caching Strategy
- Preserve existing container status caching (5-second TTL)
- Add workspace-level caching for worktree status lookups
- Maintain performance characteristics of current implementation

## Implementation Guidance

### Phase 1: Data Model Migration
1. Create new `WorkspaceStatusRow` interface
2. Update `mapContainersToWorktrees()` → `mapContainersToWorkspace()`
3. Implement worktree status resolution logic
4. Preserve all existing data fields in new structure

### Phase 2: Table Rendering Updates  
1. Modify `formatWorktreeTable()` → `formatWorkspaceTable()`
2. Update column headers and width calculations
3. Implement ✅/❌ worktree status formatting
4. Add workspace name extraction from config

### Phase 3: Display Logic Integration
1. Update `displayUnifiedWorktreeStatus()` to use workspace-centric view
2. Modify summary generation for workspace statistics
3. Preserve single worktree detailed view behavior
4. Maintain orphaned container detection and warnings

### Phase 4: Backward Compatibility Assurance
1. Test all existing CLI options work unchanged
2. Verify error handling and Docker fallback scenarios
3. Ensure performance characteristics are maintained
4. Validate verbose logging provides appropriate detail

### Critical Design Decisions

#### Workspace as Primary Identifier
**IMPORTANT**: The `aisanity.workspace` label becomes the authoritative source for container ownership, replacing the current worktree-first approach.

#### Worktree as Optional Attribute
Worktree existence becomes a display attribute rather than an organizational requirement, enabling proper handling of containers for branches without worktrees.

#### Elimination of "Unmapped" Concept
All containers with correct `aisanity.workspace` label inherently belong to that workspace, removing the confusing "unmapped" category.

#### Preservation of Existing Infrastructure
Leverage existing container discovery, caching, and error handling mechanisms to minimize risk and maintain stability.

### Testing Strategy
1. **Unit Tests**: Test new data transformation functions
2. **Integration Tests**: Verify workspace discovery and table formatting
3. **Regression Tests**: Ensure all existing CLI options continue working
4. **Edge Case Tests**: Handle containers with missing labels, Docker failures, etc.

### Migration Considerations
- No breaking changes to public API
- Internal function signatures updated but behavior preserved
- Existing configuration files remain compatible
- Container labels and naming conventions unchanged