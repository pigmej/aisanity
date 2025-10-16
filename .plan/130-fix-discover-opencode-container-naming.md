# Implementation Plan: Fix Discover-Opencode Container Naming Issue

## Implementation Overview

This plan addresses the container discovery failure in the `discover-opencode` command by adding label-based container discovery. The current implementation only searches for containers by name and devcontainer folder labels, missing containers created by VS Code Dev Containers that use the `aisanity.container` label for identification.

### Problem Summary
- **Current Issue**: `discover-opencode` returns "No running containers found" despite running opencode instances
- **Root Cause**: Container naming mismatch - VS Code Dev Containers assigns random names (e.g., `vibrant_cori`) while aisanity expects specific names (e.g., `aisanity-main`)
- **Missing Component**: Label-based discovery using `aisanity.container` label

### Solution Approach
Add a third container discovery strategy using Docker label filters to find containers tagged with `aisanity.container=${containerName}`. This approach maintains backward compatibility while extending discovery capabilities to cover VS Code Dev Containers.

### Key Design Principles
1. **Minimal Change**: Add only the missing label filter without modifying existing discovery logic
2. **Graceful Degradation**: Each discovery method fails independently without breaking overall discovery
3. **Backward Compatibility**: Preserve existing name-based and devcontainer folder discovery methods
4. **Consistency**: Follow existing code patterns for error handling, logging, and data structures

## Component Details

### 1. Enhanced Discovery Function

**Location**: `src/commands/discover-opencode.ts` (lines 124-141)

**Current Implementation Structure**:
```typescript
// Existing discovery methods (lines 124-140)
const containerIdsSet = new Set<string>();

// Method 1: Name-based discovery (lines 127-132)
try {
  const mainOutput = await $`docker ps -q --filter name=${containerName}`.text();
  mainOutput.trim().split('\n')
    .filter((id: string) => id.length > 0)
    .forEach((id: string) => containerIdsSet.add(id));
} catch (error) {
  // No main container
}

// Method 2: Devcontainer folder discovery (lines 134-140)
try {
  const devOutput = await $`docker ps -q --filter label=devcontainer.local_folder=${cwd}`.text();
  devOutput.trim().split('\n')
    .filter((id: string) => id.length > 0)
    .forEach((id: string) => containerIdsSet.add(id));
} catch (error) {
  // No devcontainer
}
```

**New Implementation Addition**:
```typescript
// Method 3: Aisanity label discovery (NEW - insert after line 140)
try {
  const labelOutput = await $`docker ps -q --filter label=aisanity.container=${containerName}`.text();
  labelOutput.trim().split('\n')
    .filter((id: string) => id.length > 0)
    .forEach((id: string) => containerIdsSet.add(id));
  
  if (options.verbose && labelOutput.trim().length > 0) {
    console.error(`Found containers via aisanity.container label: ${labelOutput.trim().split('\n').length}`);
  }
} catch (error) {
  // Label discovery failed - continue with other methods
  if (options.verbose) {
    console.error('Label-based discovery failed:', error);
  }
}
```

**Implementation Details**:
- **Insertion Point**: Immediately after line 140, before `const containerIds = Array.from(containerIdsSet);`
- **Docker Command**: Uses `docker ps -q` with `--filter label=aisanity.container=${containerName}`
- **Output Processing**: Splits by newline, filters empty strings, adds to existing Set
- **Error Handling**: Silent failure with optional verbose logging
- **Deduplication**: Automatic via Set data structure

### 2. Integration Points

**Config System Integration**:
- Uses existing `getContainerName(cwd, options.verbose)` function (line 119)
- Container name already validated and sanitized by config utilities
- No additional validation required

**Label System Integration**:
- Aligns with label patterns in `src/utils/container-utils.ts`
- `aisanity.container` label defined in `ContainerLabels` interface (line 8)
- Label format consistent with existing container labeling strategy

**Error Handling Integration**:
- Follows identical try-catch pattern as existing discovery methods
- Graceful failure prevents cascade errors
- Optional verbose logging for debugging

### 3. Discovery Flow Enhancement

**Enhanced Discovery Sequence**:
```
1. Load aisanity configuration from .aisanity file
2. Generate container name using getContainerName()
3. Initialize empty Set for container IDs (deduplication)
4. Execute three parallel discovery strategies:
   a. Name-based filter (existing)
   b. Devcontainer folder filter (existing)
   c. Aisanity container label filter (NEW)
5. Convert Set to Array (removes duplicates)
6. Validate containers have running opencode processes
7. Extract API endpoints and validate opencode API
8. Return discovered instances with metadata
```

**Discovery Strategy Priority**:
- All three methods run sequentially but independently
- No priority ordering - all results merged via Set
- Set deduplication handles containers matching multiple criteria
- First valid opencode API instance becomes "most recent"

## Data Structures

### Input Data Structures

**CommandOptions** (existing):
```typescript
interface CommandOptions {
  all: boolean;           // Return all instances vs most recent
  format: 'text' | 'json' | 'yaml' | 'plain';  // Output format
  filter?: string;        // Filter containers by name pattern
  verbose: boolean;       // Enable verbose logging
}
```

**AisanityConfig** (from config.ts):
```typescript
interface AisanityConfig {
  workspace: string;      // Workspace identifier
  containerName?: string; // Optional explicit container name
  env?: Record<string, string>;  // Environment variables
  envWhitelist?: string[];       // Whitelisted env vars
  worktree?: boolean;     // Worktree functionality enabled
}
```

### Intermediate Data Structures

**Container ID Set** (existing, enhanced):
```typescript
const containerIdsSet = new Set<string>();
// Properties:
// - Automatic deduplication of container IDs
// - Contains IDs from all three discovery methods
// - Order not guaranteed (Set is unordered)
// - Empty Set indicates no containers found
```

**Container Discovery Results**:
```typescript
// Raw Docker output format (per discovery method):
// - One container ID per line
// - 12-64 character hexadecimal strings
// - Empty lines filtered out
// - Example: "3f2a1b9c8d7e\na4b5c6d7e8f9\n"
```

### Output Data Structures

**OpencodeInstance** (existing):
```typescript
interface OpencodeInstance {
  containerId: string;    // Docker container ID (short or long)
  containerName: string;  // Human-readable container name
  host: string;           // API host (localhost, 127.0.0.1, etc.)
  port: number;           // API port number
  processId: number;      // opencode process PID
  elapsedTime: number;    // Process elapsed time in seconds
  isValidApi: boolean;    // API validation result
}
```

**DiscoveryResult** (existing):
```typescript
interface DiscoveryResult {
  instances: OpencodeInstance[];        // All discovered instances
  mostRecent: OpencodeInstance | null;  // Most recent instance (lowest elapsed time)
  error?: string;                       // Error message if discovery failed
}
```

### Data Flow Example

```
Input:
  - cwd: "/Users/user/project"
  - containerName: "aisanity-main"
  - verbose: true

Processing:
  Method 1 (name): [] (no match for "aisanity-main")
  Method 2 (folder): [] (no devcontainer.local_folder label)
  Method 3 (label): ["3f2a1b9c8d7e"] (found via aisanity.container=aisanity-main)
  
  containerIdsSet: Set { "3f2a1b9c8d7e" }
  containerIds: ["3f2a1b9c8d7e"]

Validation:
  - Container "3f2a1b9c8d7e" has opencode process ✓
  - Port 3000 responds to /config endpoint ✓
  
Output:
  {
    instances: [{
      containerId: "3f2a1b9c8d7e",
      containerName: "vibrant_cori",
      host: "localhost",
      port: 3000,
      processId: 1234,
      elapsedTime: 300,
      isValidApi: true
    }],
    mostRecent: { ... same instance ... },
    error: undefined
  }
```

## API Design

### Modified Function Signature

**Function**: `discoverOpencodeInstances`

```typescript
/**
 * Discover running opencode instances in Docker containers
 * 
 * Uses three discovery strategies:
 * 1. Container name matching
 * 2. Devcontainer local folder label
 * 3. Aisanity container label (NEW)
 * 
 * @param options - Discovery options including verbosity and filtering
 * @returns Promise resolving to discovered instances and most recent instance
 * 
 * @example
 * const result = await discoverOpencodeInstances({ 
 *   all: false, 
 *   format: 'text', 
 *   verbose: true 
 * });
 * 
 * if (result.mostRecent) {
 *   console.log(`Opencode API: ${result.mostRecent.host}:${result.mostRecent.port}`);
 * }
 */
export async function discoverOpencodeInstances(
  options: CommandOptions
): Promise<DiscoveryResult>
```

**No signature changes** - function signature remains identical to maintain backward compatibility.

### Internal API Changes

**New Docker CLI Invocation**:
```typescript
// Docker CLI command structure
docker ps -q --filter label=aisanity.container=${containerName}

// Bun shell template literal
const labelOutput = await $`docker ps -q --filter label=aisanity.container=${containerName}`.text();

// Parameters:
// - ps: List containers
// - -q: Quiet mode (only IDs)
// - --filter: Filter by label
// - label=aisanity.container=${containerName}: Match specific label value
```

**Output Format**:
```
Input containerName: "aisanity-main"
Docker command: docker ps -q --filter label=aisanity.container=aisanity-main
Docker output: "3f2a1b9c8d7e\na4b5c6d7e8f9\n"
Parsed result: ["3f2a1b9c8d7e", "a4b5c6d7e8f9"]
```

### Error Handling API

**Error Scenarios**:

1. **Docker command failure**:
```typescript
catch (error) {
  // Silent failure - don't break overall discovery
  // Optional verbose logging
  if (options.verbose) {
    console.error('Label-based discovery failed:', error);
  }
}
```

2. **Empty results**:
```typescript
// Not an error - simply no containers found via this method
// Other discovery methods may still succeed
const labelOutput = ""; // Empty output is valid
```

3. **Malformed container IDs**:
```typescript
// Filtered by existing validation
// isValidContainerId() function validates format (lines 57-70)
// Invalid IDs naturally filtered by subsequent validation steps
```

### Verbose Logging API

**New Logging Points**:
```typescript
// Log successful label discovery
if (options.verbose && labelOutput.trim().length > 0) {
  const count = labelOutput.trim().split('\n').filter(id => id.length > 0).length;
  console.error(`Found ${count} container(s) via aisanity.container label`);
}

// Log label discovery failure
if (options.verbose) {
  console.error('Label-based discovery failed:', error);
}
```

**Logging Consistency**:
- Uses `console.error()` for verbose output (matches existing pattern)
- Conditional on `options.verbose` flag
- Non-blocking - doesn't affect functionality

## Testing Strategy

### Unit Testing

**Test File**: `tests/discover-opencode-label.test.ts` (new file)

**Test Suite Structure**:
```typescript
import { expect, test, describe, beforeEach, mock } from 'bun:test';
import { discoverOpencodeInstances } from '../src/commands/discover-opencode';

describe('discover-opencode label-based discovery', () => {
  describe('Label filter discovery', () => {
    test('should discover containers via aisanity.container label', async () => {
      // Mock docker ps command to return container IDs
      // Mock docker exec to return opencode process
      // Mock docker exec curl to validate API
      // Assert instance discovered
    });

    test('should handle empty label discovery results', async () => {
      // Mock docker ps to return empty string
      // Assert continues with other discovery methods
    });

    test('should deduplicate containers found by multiple methods', async () => {
      // Mock all three discovery methods to return same container ID
      // Assert only one instance in results
    });

    test('should handle label discovery failure gracefully', async () => {
      // Mock docker ps to throw error
      // Assert other discovery methods still work
    });
  });

  describe('Multi-strategy discovery', () => {
    test('should use name-based discovery as fallback', async () => {
      // Mock label discovery to fail
      // Mock name-based discovery to succeed
      // Assert instance discovered via name
    });

    test('should use devcontainer discovery as fallback', async () => {
      // Mock label and name discovery to fail
      // Mock devcontainer discovery to succeed
      // Assert instance discovered via devcontainer label
    });

    test('should combine results from all discovery methods', async () => {
      // Mock each method to return different containers
      // Assert all containers discovered
    });
  });

  describe('Verbose logging', () => {
    test('should log label discovery success when verbose', async () => {
      // Mock docker ps to return containers
      // Enable verbose mode
      // Assert console.error called with success message
    });

    test('should log label discovery failure when verbose', async () => {
      // Mock docker ps to throw error
      // Enable verbose mode
      // Assert console.error called with error message
    });
  });
});
```

**Mock Strategy**:
```typescript
// Mock Bun shell execution
import { $ } from 'bun';

// Mock docker ps with label filter
mock.module('bun', () => ({
  $: (strings: TemplateStringsArray, ...values: any[]) => {
    const command = strings.join('');
    if (command.includes('docker ps -q --filter label=aisanity.container=')) {
      return {
        text: async () => 'abc123def456\n789ghi012jkl\n'
      };
    }
    // Other command mocks...
  }
}));
```

### Integration Testing

**Test Scenarios**:

1. **Real Container Discovery**:
```typescript
test('should discover real running containers', async () => {
  // Prerequisites:
  // - Actual Docker container running
  // - Container has aisanity.container label
  // - Container has opencode process
  
  const result = await discoverOpencodeInstances({
    all: true,
    format: 'json',
    verbose: true
  });
  
  expect(result.instances.length).toBeGreaterThan(0);
  expect(result.mostRecent).toBeTruthy();
});
```

2. **VS Code Dev Container Compatibility**:
```typescript
test('should discover containers created by VS Code Dev Containers', async () => {
  // Prerequisites:
  // - Container created via VS Code Dev Containers
  // - Random container name (e.g., vibrant_cori)
  // - Has aisanity.container label
  
  const result = await discoverOpencodeInstances({
    all: false,
    format: 'text',
    verbose: false
  });
  
  expect(result.error).toBeUndefined();
  expect(result.mostRecent).toBeTruthy();
});
```

3. **Multiple Container Discovery**:
```typescript
test('should discover multiple opencode instances', async () => {
  // Prerequisites:
  // - Multiple containers with aisanity labels
  // - Each running opencode on different ports
  
  const result = await discoverOpencodeInstances({
    all: true,
    format: 'json',
    verbose: true
  });
  
  expect(result.instances.length).toBeGreaterThanOrEqual(2);
  expect(result.instances[0].port).not.toBe(result.instances[1].port);
});
```

### Regression Testing

**Existing Test Suite**:
- Run full test suite: `npm test` or `bun test`
- No existing tests specifically for discover-opencode (create new test file)
- Ensure no regressions in related tests:
  - `tests/config.test.ts` - Container name generation
  - `tests/container-utils.test.ts` - Container label validation

**Backward Compatibility Tests**:
```typescript
describe('Backward compatibility', () => {
  test('should still discover containers by name', async () => {
    // Test existing name-based discovery
  });

  test('should still discover containers by devcontainer label', async () => {
    // Test existing devcontainer discovery
  });

  test('should handle missing aisanity config', async () => {
    // Test error handling remains unchanged
  });

  test('should validate container IDs correctly', async () => {
    // Test existing validation logic
  });
});
```

### Manual Testing Checklist

**Pre-Testing Setup**:
1. Start VS Code Dev Container with aisanity configuration
2. Verify container has `aisanity.container` label: `docker inspect <container> --format '{{.Config.Labels}}'`
3. Verify opencode process running: `docker exec <container> ps aux | grep opencode`
4. Verify opencode API responding: `docker exec <container> curl http://localhost:3000/config`

**Test Cases**:
```bash
# Test 1: Basic discovery
aisanity discover-opencode

# Expected: Successfully finds running instance
# Output: Container name, port, age, host:port

# Test 2: Verbose discovery
aisanity discover-opencode --verbose

# Expected: Shows discovery method logging
# Output: "Found N container(s) via aisanity.container label"

# Test 3: All instances
aisanity discover-opencode --all

# Expected: Lists all discovered instances
# Output: Multiple instances if available

# Test 4: JSON format
aisanity discover-opencode --format json

# Expected: Valid JSON output
# Output: { "instances": [...], "mostRecent": {...} }

# Test 5: Plain format (for scripting)
aisanity discover-opencode --format plain

# Expected: Only host:port output
# Output: localhost:3000
```

**Validation Checks**:
- [ ] Container discovered successfully
- [ ] Correct container name displayed
- [ ] Valid port number returned
- [ ] API endpoint accessible at host:port
- [ ] Verbose logging shows label discovery
- [ ] No errors or warnings (except expected verbose output)

## Development Phases

### Phase 1: Core Implementation (2-4 hours)

**Objectives**:
- Add label-based discovery filter
- Maintain backward compatibility
- Ensure proper error handling

**Tasks**:
1. **Add label filter implementation** (30 minutes)
   - Locate insertion point in `src/commands/discover-opencode.ts` (after line 140)
   - Copy existing try-catch block structure
   - Modify Docker command to use label filter
   - Add verbose logging statements

2. **Test with running container** (30 minutes)
   - Start container with aisanity label
   - Run discovery command manually
   - Verify container found via label
   - Check verbose output

3. **Code review and refinement** (1 hour)
   - Ensure code style matches existing patterns
   - Verify error handling consistency
   - Check variable naming conventions
   - Validate comment quality

**Deliverables**:
- Modified `discover-opencode.ts` with label filter
- Manual test results confirming functionality
- No regressions in existing discovery methods

**Success Criteria**:
- [ ] Label filter code added at correct location
- [ ] Code follows existing patterns exactly
- [ ] Manual test successfully discovers container
- [ ] Verbose logging works as expected

### Phase 2: Testing Implementation (3-5 hours)

**Objectives**:
- Create comprehensive test suite
- Verify backward compatibility
- Ensure edge cases handled

**Tasks**:
1. **Create unit test file** (1.5 hours)
   - Create `tests/discover-opencode-label.test.ts`
   - Set up test structure and imports
   - Implement mock strategy for Docker commands
   - Write core discovery tests

2. **Implement test cases** (2 hours)
   - Test label discovery success
   - Test empty results handling
   - Test error handling and graceful failure
   - Test deduplication logic
   - Test verbose logging
   - Test multi-strategy discovery

3. **Run regression tests** (30 minutes)
   - Execute full test suite: `bun test`
   - Verify no existing tests broken
   - Check test coverage
   - Fix any failing tests

**Deliverables**:
- New test file with comprehensive coverage
- All tests passing
- No regressions in existing tests

**Success Criteria**:
- [ ] Test file created with proper structure
- [ ] All new tests passing
- [ ] Existing test suite passes without changes
- [ ] Code coverage maintained or improved

### Phase 3: Documentation and Integration Testing (2-3 hours)

**Objectives**:
- Document changes and behavior
- Perform end-to-end testing
- Validate VS Code Dev Container compatibility

**Tasks**:
1. **Add inline documentation** (30 minutes)
   - Add comments explaining label filter purpose
   - Document discovery strategy order
   - Update function docstrings if needed

2. **Integration testing** (1.5 hours)
   - Test with VS Code Dev Container
   - Test with aisanity-managed container
   - Test with multiple containers
   - Test various output formats
   - Test filter option
   - Test verbose mode

3. **Edge case testing** (1 hour)
   - Test with no running containers
   - Test with containers but no opencode process
   - Test with invalid container labels
   - Test with Docker daemon down
   - Test with permission errors

**Deliverables**:
- Documented code with clear comments
- Integration test results
- Edge case validation

**Success Criteria**:
- [ ] Code properly commented
- [ ] Works with VS Code Dev Containers
- [ ] Works with aisanity-managed containers
- [ ] All edge cases handled gracefully

### Phase 4: Final Validation and Cleanup (1-2 hours)

**Objectives**:
- Final testing pass
- Code cleanup
- Prepare for deployment

**Tasks**:
1. **Final test pass** (30 minutes)
   - Run complete test suite
   - Execute manual test checklist
   - Verify all success criteria met
   - Check for any console warnings

2. **Code cleanup** (30 minutes)
   - Remove debug statements
   - Ensure consistent formatting
   - Verify imports are used
   - Check for dead code

3. **Performance validation** (30 minutes)
   - Measure discovery time before/after
   - Ensure no significant slowdown
   - Check memory usage
   - Validate Docker CLI call count

**Deliverables**:
- Clean, production-ready code
- All tests passing
- Performance metrics

**Success Criteria**:
- [ ] All tests pass
- [ ] Code is clean and well-formatted
- [ ] No performance degradation
- [ ] Ready for deployment

### Timeline Summary

```
Phase 1: Core Implementation         [====>    ] 2-4 hours
Phase 2: Testing Implementation      [======>  ] 3-5 hours  
Phase 3: Documentation & Integration [====>    ] 2-3 hours
Phase 4: Final Validation           [==>      ] 1-2 hours
                                     ___________________
Total Estimated Time:                          8-14 hours
```

**Critical Path**:
1. Core Implementation (Phase 1) - blocking
2. Unit Testing (Phase 2) - blocking
3. Integration Testing (Phase 3) - parallel with documentation
4. Final Validation (Phase 4) - blocking

**Risk Mitigation**:
- **Risk**: Docker CLI changes behavior
  - **Mitigation**: Test with multiple Docker versions
- **Risk**: Label format inconsistency
  - **Mitigation**: Validate against container-utils.ts label definitions
- **Risk**: Test mocking complexity
  - **Mitigation**: Use simple mock patterns, focus on integration tests

**Resource Requirements**:
- Development environment with Docker installed
- Access to VS Code with Dev Containers extension
- Running aisanity project with .aisanity config
- Test container with aisanity labels

## Additional Considerations

### Performance Impact

**Measurement Strategy**:
```typescript
// Benchmark discovery time
const startTime = Date.now();
const result = await discoverOpencodeInstances(options);
const endTime = Date.now();
console.log(`Discovery took ${endTime - startTime}ms`);
```

**Expected Performance**:
- Additional Docker CLI call: ~50-100ms overhead
- Total discovery time: 200-500ms (minimal increase)
- No memory impact (reuses existing Set)
- Network: No additional network calls

**Performance Validation**:
- Baseline: Measure current discovery time
- Post-implementation: Compare with baseline
- Acceptable increase: <20% additional time
- If exceeded: Consider parallel execution of discovery methods

### Security Considerations

**Input Validation**:
- Container name already validated by `getContainerName()`
- Sanitization handled by `sanitizeBranchName()`
- Docker CLI template literals prevent injection
- No user input directly interpolated into commands

**Docker Permissions**:
- No additional Docker permissions required
- Uses same Docker daemon access as existing commands
- Label filter is read-only operation
- No container modification or creation

**Label Trust**:
- Labels set by aisanity during container creation
- VS Code Dev Containers respects aisanity labels
- No external label sources trusted
- Validation ensures required labels present

### Future Extensibility

**Additional Discovery Methods**:
```typescript
// Potential future additions:

// Method 4: Network-based discovery
try {
  const networkOutput = await $`docker ps -q --filter network=aisanity-network`.text();
  // Process network-based discovery
} catch (error) {
  // Handle failure
}

// Method 5: Image-based discovery
try {
  const imageOutput = await $`docker ps -q --filter ancestor=aisanity-base`.text();
  // Process image-based discovery
} catch (error) {
  // Handle failure
}
```

**Discovery Prioritization**:
```typescript
// Future enhancement: Priority-based discovery
const discoveryStrategies = [
  { priority: 1, method: discoverByLabel },
  { priority: 2, method: discoverByName },
  { priority: 3, method: discoverByDevcontainer }
];

// Execute in priority order, short-circuit on success
for (const strategy of discoveryStrategies.sort((a, b) => a.priority - b.priority)) {
  const result = await strategy.method();
  if (result.length > 0) {
    return result; // Short-circuit on first success
  }
}
```

**Label Evolution**:
```typescript
// Support for label versioning
const labelVersions = [
  'aisanity.container',      // Current version
  'aisanity.container.v2',   // Future version
  'aisanity.workspace.name'  // Alternative naming
];

// Try each label version
for (const labelKey of labelVersions) {
  try {
    const output = await $`docker ps -q --filter label=${labelKey}=${containerName}`.text();
    if (output.trim().length > 0) {
      // Process containers with this label version
    }
  } catch (error) {
    continue;
  }
}
```

### Monitoring and Debugging

**Debug Logging Strategy**:
```typescript
// Enhanced verbose logging for troubleshooting
if (options.verbose) {
  console.error('=== Discovery Debug Information ===');
  console.error(`Container name: ${containerName}`);
  console.error(`Current directory: ${cwd}`);
  console.error(`Discovery methods:`);
  console.error(`  1. Name-based: docker ps -q --filter name=${containerName}`);
  console.error(`  2. Devcontainer: docker ps -q --filter label=devcontainer.local_folder=${cwd}`);
  console.error(`  3. Label-based: docker ps -q --filter label=aisanity.container=${containerName}`);
  console.error(`Found ${containerIdsSet.size} unique container(s)`);
  console.error('===================================');
}
```

**Error Telemetry**:
```typescript
// Track discovery method success rates
const discoveryStats = {
  nameBasedSuccess: 0,
  devcontainerSuccess: 0,
  labelBasedSuccess: 0,
  totalAttempts: 0
};

// Increment counters based on discovery results
// Useful for understanding which methods are most reliable
```

### Deployment Checklist

**Pre-Deployment**:
- [ ] All tests passing locally
- [ ] Manual testing completed
- [ ] Code review approved
- [ ] Documentation updated
- [ ] No console warnings or errors
- [ ] Performance validated

**Deployment Steps**:
1. Merge code to main branch
2. Update CHANGELOG.md with changes
3. Bump version if needed
4. Build and test in CI/CD pipeline
5. Release to npm or distribution channel

**Post-Deployment Validation**:
- [ ] Verify deployment successful
- [ ] Test discovery in production environment
- [ ] Monitor for error reports
- [ ] Validate with user feedback
- [ ] Update documentation if needed

**Rollback Plan**:
- If issues detected, revert to previous version
- Label filter addition is non-breaking, can be disabled
- Remove try-catch block for label discovery
- No data migration or cleanup required

---

## Summary

This implementation plan provides a minimal, focused solution to fix the discover-opencode container naming issue by adding label-based discovery. The approach:

1. **Adds one try-catch block** for label-based container discovery
2. **Maintains backward compatibility** with existing discovery methods
3. **Follows existing patterns** for error handling and logging
4. **Includes comprehensive testing** strategy for validation
5. **Provides clear phases** for systematic implementation

The solution directly addresses the root cause (missing label filter) while preserving all existing functionality and following the architectural guidelines for robustness, consistency, and maintainability.
