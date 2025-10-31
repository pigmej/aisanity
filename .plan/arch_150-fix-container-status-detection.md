# Architectural Analysis: Fix Container Status Detection

## Context Analysis

The `aisanity status` command is experiencing critical failures in container status detection, leading to incorrect "Unknown" status displays and missing container detection. The core issue stems from unreliable Docker command execution using Bun's template literals, combined with insufficient container discovery mechanisms.

### Current Problems Identified:
1. **Command Execution Failure**: `getContainerStatusWithPorts` function uses Bun `$` template literals that fail silently
2. **Incomplete Discovery**: Only 3 of 5 running containers are detected
3. **Poor Error Handling**: Docker failures are masked as "Unknown" status
4. **Worktree Mapping Issues**: Container-to-worktree mapping is incomplete

## Technology Recommendations

### IMPORTANT: Replace Bun Template Literals
- **Current Issue**: Bun `$` template literals for Docker commands are unreliable
- **Recommendation**: Use Node.js `child_process.execSync` with proper error handling
- **Rationale**: More reliable, better error reporting, wider compatibility

### IMPORTANT: Leverage Existing Container Utilities
- **Current Issue**: Direct Docker command execution instead of using established patterns
- **Recommendation**: Utilize `discoverContainers` from `container-utils.ts`
- **Rationale**: Consistent with codebase, already tested, handles edge cases

### Container Discovery Strategy
- **Primary**: Use `aisanity.workspace` label filtering for current workspace
- **Secondary**: Fallback to name-based discovery for legacy containers
- **Tertiary**: Full Docker API query as last resort

## System Architecture

### Container Status Detection Flow
```
1. Workspace Detection → 2. Container Discovery → 3. Status Query → 4. Worktree Mapping → 5. Display
```

### Component Responsibilities

#### Status Command (`src/commands/status.ts`)
- **Primary**: Orchestrate status display workflow
- **Secondary**: Handle user interface and formatting
- **IMPORTANT**: Should NOT directly execute Docker commands

#### Container Utilities (`src/utils/container-utils.ts`)
- **Primary**: Container discovery and status querying
- **Secondary**: Docker command execution with proper error handling
- **IMPORTANT**: All Docker interactions should be centralized here

#### Worktree Utilities (`src/utils/worktree-utils.ts`)
- **Primary**: Worktree discovery and management
- **Secondary**: Container-to-worktree mapping logic

## Integration Patterns

### Error Handling Strategy
- **Silent Failures**: Eliminated - all errors should be logged
- **Fallback Mechanisms**: Multi-tier discovery approach
- **User Feedback**: Clear diagnostic messages in verbose mode

### Logging Strategy
- **Standard Mode**: Essential status information only
- **Verbose Mode**: Docker command execution, discovery details, timing
- **Debug Mode**: Full Docker API responses, internal state

### Performance Considerations
- **Caching**: Container status information for short periods (5-10 seconds)
- **Batching**: Group Docker commands to reduce overhead
- **Lazy Loading**: Only query container details when needed

## Implementation Guidance

### IMPORTANT: Centralize Docker Interactions with Backward Compatibility
All Docker command execution should be centralized in `container-utils.ts` while maintaining:
- Consistent error handling with existing patterns
- Proper logging integration with existing logger.ts
- Easier testing without breaking existing test structure
- Single point of optimization
- **Backward compatibility** - existing function signatures must be preserved
- **Integration** - enhance existing `discoverContainers` function rather than replacing

### Container Discovery Enhancement with Integration
```typescript
// Enhanced existing function with backward compatibility
async function discoverContainers(options?: {
  workspaceId?: string;  // NEW: optional workspace filtering
  includeStopped?: boolean;
}): Promise<Container[]> {
  // 1. If workspaceId provided, try label-based discovery (primary)
  // 2. Fallback to name-based discovery (secondary) 
  // 3. Use existing discovery logic as fallback (maintains compatibility)
  // 4. Use Docker API as last resort
}

// NEW: Specific workspace discovery function
async function discoverWorkspaceContainers(workspaceId: string): Promise<Container[]> {
  return discoverContainers({ workspaceId });
}
```

### Status Query Reliability
```typescript
// Recommended approach
async function getContainerStatus(containerId: string): Promise<ContainerStatus> {
  // 1. Use execSync with proper error handling
  // 2. Parse Docker output reliably
  // 3. Provide detailed error information
}
```

### Worktree Mapping Strategy
- **Label-Based**: Use `aisanity.branch` label when available
- **Name-Based**: Parse container names for branch information
- **Fallback**: Show containers without worktree mapping

## Critical Constraints

### Security
- No Docker socket exposure to user input
- Validate all container IDs and names
- Sanitize branch names and labels

### Performance
- Status command should complete within 2-3 seconds
- Container discovery should not block UI
- Implement intelligent caching

### Compatibility
- Must work with existing container naming schemes
- Backward compatibility with current status output format
- Support for different Docker versions

## Testing Strategy

### Unit Tests
- Mock Docker command outputs
- Test error handling scenarios
- Validate container parsing logic

### Integration Tests
- Test with actual Docker containers
- Verify worktree mapping accuracy
- Performance benchmarking

### Edge Cases
- Missing worktrees for existing containers
- Orphaned containers without labels
- Docker daemon unavailable scenarios
- Network connectivity issues

## Migration Path

### Phase 1: Fix Core Issues
- Replace Bun template literals with execSync
- Implement proper error handling
- Add verbose logging

### Phase 2: Enhance Discovery
- Improve container discovery logic
- Better worktree mapping
- Add fallback mechanisms

### Phase 3: Optimize Performance
- Implement caching
- Batch Docker operations
- Performance tuning

This architectural analysis provides the foundation for implementing a robust, reliable container status detection system that addresses all identified issues while maintaining performance and compatibility.