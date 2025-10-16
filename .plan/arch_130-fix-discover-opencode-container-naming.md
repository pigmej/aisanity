# Architecture Plan: Fix Discover-Opencode Container Naming Issue

## Context Analysis

The `discover-opencode` command currently fails to find running opencode instances due to container naming mismatches between aisanity's expected naming convention and VS Code Dev Containers' actual naming patterns. The issue stems from incomplete container discovery logic that only checks for containers by name and `devcontainer.local_folder` labels, but misses containers with the `aisanity.container` label that VS Code Dev Containers uses when creating aisanity-managed containers.

### Current Discovery Strategy
The existing implementation in `src/commands/discover-opencode.ts` uses two discovery methods:
1. **Name-based discovery**: `docker ps -q --filter name=${containerName}`
2. **Devcontainer folder discovery**: `docker ps -q --filter label=devcontainer.local_folder=${cwd}`

### Problem Gap
The missing discovery method is **label-based discovery** for containers tagged with `aisanity.container=${containerName}`, which is how VS Code Dev Containers identifies aisanity-managed containers.

## Technology Recommendations

### Container Discovery Patterns
- **Multi-strategy discovery**: Continue using multiple Docker filter strategies for robustness
- **Label-based identification**: Leverage Docker's label system for container metadata
- **Graceful fallback**: Each discovery method should fail independently without affecting others

### Docker Integration
- **Docker CLI filters**: Use `docker ps -q --filter` for efficient container querying
- **Error isolation**: Wrap each discovery method in try-catch blocks
- **Set-based deduplication**: Use Set data structure to avoid duplicate container IDs

### Testing Strategy
- **Unit testing**: Test individual discovery methods with mocked Docker responses
- **Integration testing**: Test end-to-end discovery with real Docker containers
- **Label validation**: Ensure proper label format and content

## System Architecture

### Enhanced Discovery Flow
```
1. Load aisanity configuration
2. Generate expected container name
3. Initialize container ID set
4. Execute discovery strategies in parallel:
   - Name-based filter (existing)
   - Devcontainer folder filter (existing)  
   - Aisanity container label filter (NEW)
5. Deduplicate container IDs
6. Validate containers have opencode processes
7. Extract API endpoints and return instances
```

### New Label-Based Discovery Component
```typescript
// New filter to add around line 140
try {
  const labelOutput = await $`docker ps -q --filter label=aisanity.container=${containerName}`.text();
  labelOutput.trim().split('\n')
    .filter((id: string) => id.length > 0)
    .forEach((id: string) => containerIdsSet.add(id));
} catch (error) {
  // Handle label discovery failure gracefully
}
```

### Integration Points
- **Config system**: Uses existing `getContainerName()` from `src/utils/config.ts`
- **Container utilities**: Leverages existing label patterns from `src/utils/container-utils.ts`
- **Error handling**: Follows existing try-catch patterns in discovery function
- **Logging**: Integrates with existing verbose logging system

## Implementation Guidance

### IMPORTANT: Core Implementation Steps

1. **Add Label Filter Implementation**
   - Insert new Docker filter after line 140 in `discover-opencode.ts`
   - Use exact command: `docker ps -q --filter label=aisanity.container=${containerName}`
   - Follow existing error handling pattern with try-catch block
   - Add discovered IDs to existing `containerIdsSet`

2. **Maintain Backward Compatibility**
   - Keep existing name-based and devcontainer folder filters unchanged
   - Ensure new filter doesn't interfere with current discovery methods
   - Preserve existing error messages and return structures

3. **Error Handling Strategy**
   - Wrap new filter in try-catch like existing filters
   - Fail silently for label discovery failures (don't break overall discovery)
   - Log verbose output if verbose flag is enabled

### Testing Implementation

1. **Unit Test Addition**
   - Create test case for label-based discovery in new or existing test file
   - Mock Docker CLI responses for different filter scenarios
   - Test deduplication when multiple discovery methods find same container

2. **Integration Test Scenarios**
   - Test with containers having only `aisanity.container` label
   - Test with containers having multiple discovery attributes
   - Verify backward compatibility with existing container types

### Performance Considerations

- **Sequential execution**: New filter runs sequentially with existing filters (minimal overhead)
- **Docker CLI efficiency**: Each filter makes one Docker call (optimal)
- **Memory usage**: Set-based deduplication prevents duplicate container processing
- **Network impact**: No additional network calls beyond existing Docker commands

## Security and Maintainability

### Security Aspects
- **Command injection protection**: Use template literals with proper variable interpolation
- **Docker permissions**: No additional Docker privileges required
- **Input validation**: Container name already validated by existing config system

### Maintainability Features
- **Consistent patterns**: New filter follows existing code structure exactly
- **Clear separation**: Each discovery method is independently testable
- **Documentation**: Add comments explaining the label-based discovery purpose
- **Error isolation**: Individual filter failures don't cascade

### Future Extensibility
- **Additional filters**: Architecture supports adding more discovery methods
- **Label evolution**: System can adapt to new label patterns
- **Discovery prioritization**: Framework allows for future priority-based discovery

## Critical Decisions

### IMPORTANT: Label Filter Priority
- **Decision**: Add label filter as third discovery method after existing filters
- **Rationale**: Maintains backward compatibility while adding new capability
- **Impact**: Minimal risk to existing functionality

### IMPORTANT: Error Handling Approach  
- **Decision**: Silent failure for label discovery (like existing filters)
- **Rationale**: Prevents one discovery method failure from breaking overall discovery
- **Impact**: Robust discovery across different container configurations

### IMPORTANT: Container ID Deduplication
- **Decision**: Use existing Set-based deduplication approach
- **Rationale**: Prevents duplicate processing when containers match multiple filters
- **Impact**: Efficient and consistent with current implementation

## Success Criteria

1. **Functional Requirements**
   - discover-opencode finds containers with `aisanity.container` label
   - Command works with both aisanity-managed and VS Code Dev Containers
   - Existing functionality remains unchanged

2. **Quality Requirements**
   - No regressions in existing test suite
   - New test coverage for label-based discovery
   - Proper error handling for all discovery scenarios

3. **Performance Requirements**
   - No significant increase in discovery time
   - Memory usage remains consistent
   - Docker CLI calls remain efficient

This architecture provides a minimal, focused solution that extends the existing discovery system without disrupting current functionality, ensuring robust container discovery across different naming conventions and container management approaches.