# Architecture Analysis: Resolve Container IP Address for 0.0.0.0 Listeners

## Context Analysis

### Current Problem
The `discover-opencode` command currently converts `0.0.0.0` listeners to `localhost`, which provides inaccurate connection information. When opencode listens on `0.0.0.0:42327`, users see `localhost:42327` but the actual reachable address is the container's IP (e.g., `192.168.215.3:42327`).

### Existing Architecture
- **Discovery Logic**: Located in `src/commands/discover-opencode.ts`
- **Host Resolution**: Line 222 contains the problematic conversion logic
- **Container Integration**: Uses `docker exec` commands for container inspection
- **Error Handling**: Follows try/catch patterns with fallbacks
- **Logging**: Uses console.error for verbose output and picocolors for formatting

### Key Constraints
- Only trigger IP resolution for `0.0.0.0` listeners
- Preserve existing behavior for specific IPs
- Maintain backward compatibility
- Follow existing code patterns for Docker command execution

## Technology Recommendations

### Docker Integration
- **IMPORTANT**: Use `docker inspect` commands for IP resolution
- Primary method: `docker inspect --format '{{.NetworkSettings.IPAddress}}'`
- Fallback method: `docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'`
- Leverage existing `$` from Bun for command execution

### Error Handling Strategy
- Implement graceful fallback to `localhost` on IP resolution failure
- Use try/catch blocks following existing patterns
- Maintain non-breaking behavior for all error scenarios

### Performance Considerations
- IP resolution only triggered when `0.0.0.0` is detected
- Consider optional caching for repeated container inspections
- Minimal overhead since resolution is conditional

## System Architecture

### Core Components

#### 1. Container IP Resolution Function
```typescript
async function getContainerIpAddress(
  containerId: string, 
  verbose: boolean
): Promise<string>
```

**Responsibilities:**
- Execute `docker inspect` commands to retrieve container IP
- Implement primary and fallback IP resolution strategies
- Handle errors with appropriate fallbacks
- Provide verbose logging for debugging

#### 2. Enhanced Host Resolution Logic
**Location**: Line 222 in `discover-opencode.ts`
**Modification**: Replace static `localhost` conversion with dynamic IP resolution

**Decision Flow:**
1. Detect `0.0.0.0` listener
2. Call `getContainerIpAddress()`
3. Use resolved IP or fallback to `localhost`
4. Preserve existing behavior for non-`0.0.0.0` addresses

#### 3. Integration Points
- **Container Discovery**: Leverage existing container ID collection
- **Process Inspection**: Integrate with current netstat parsing
- **Output Formatting**: Maintain compatibility with existing formatters

### Data Flow
```
netstat output → Address parsing → 0.0.0.0 detection → 
IP resolution → Host assignment → API validation → Output
```

## Integration Patterns

### Docker Command Execution
- Follow existing `$` from Bun pattern for command execution
- Use `.text()` method for output capture
- Implement consistent error handling with existing codebase

### Logging Integration
- Use `console.error` for verbose output (existing pattern)
- Leverage picocolors for formatted output
- Maintain consistency with existing verbose logging

### Error Recovery
- Primary IP resolution failure → fallback method
- Both methods fail → fallback to `localhost`
- Ensure discovery process continues regardless of IP resolution outcome

### Network Compatibility
- Support bridge networks (primary use case)
- Handle custom Docker networks
- Maintain compatibility with host networking mode

## Implementation Guidance

### Function Placement
- **IMPORTANT**: Add `getContainerIpAddress()` function in `src/commands/discover-opencode.ts`
- Place before main `discoverOpencodeInstances()` function
- Follow existing function organization patterns

### Host Resolution Modification
- **CRITICAL**: Modify line 222 logic to call IP resolution function
- Preserve existing regex pattern for address parsing
- Maintain current structure for non-`0.0.0.0` addresses

### Error Handling Implementation
```typescript
try {
  const ipAddress = await getContainerIpAddress(containerId, verbose);
  const host = ipAddress || 'localhost';
} catch (error) {
  const host = 'localhost'; // Fallback behavior
  if (verbose) console.error('IP resolution failed:', error);
}
```

### Verbose Logging Strategy
- Log IP resolution attempts when verbose mode enabled
- Show resolved IP vs fallback decisions
- Display Docker command execution details for debugging
- Follow existing verbose logging patterns in the file

### Testing Considerations
- Verify IP resolution with running containers
- Test fallback behavior with invalid container IDs
- Ensure existing functionality remains intact
- Validate different network configurations

### Backward Compatibility
- **IMPORTANT**: All existing host resolution behavior must be preserved
- Specific IP addresses (127.0.0.1, 192.168.1.100, etc.) unchanged
- Output formats remain consistent
- Error scenarios handled gracefully

### Performance Optimization
- IP resolution only when `0.0.0.0` detected
- Consider caching mechanism for repeated container inspections
- Minimal impact on discovery performance
- Async execution to prevent blocking

## Success Criteria

### Functional Requirements
1. `discover-opencode` shows actual container IP for `0.0.0.0` listeners
2. Existing behavior preserved for specific IP addresses
3. Robust error handling with appropriate fallbacks
4. Verbose logging provides debugging insights

### Non-Functional Requirements
1. No performance degradation in discovery process
2. Maintains backward compatibility
3. Follows existing code patterns and conventions
4. Handles various Docker network configurations

### User Experience
1. Accurate connection information displayed
2. Clear verbose output for troubleshooting
3. Graceful handling of edge cases
4. Consistent behavior across different environments