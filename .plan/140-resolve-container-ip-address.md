# Implementation Plan: Resolve Container IP Address for 0.0.0.0 Listeners

## Implementation Overview

This implementation adds container IP resolution to the `discover-opencode` command, addressing the issue where `0.0.0.0` listeners are incorrectly displayed as `localhost`. The solution introduces a new IP resolution function and modifies the existing host resolution logic to provide accurate, reachable IP addresses for container services.

### Key Changes
1. **New Function**: Add `getContainerIpAddress()` for Docker IP resolution
2. **Host Resolution Enhancement**: Modify line 222 logic to resolve `0.0.0.0` to actual container IP
3. **Error Handling**: Implement graceful fallback to `localhost` on resolution failure
4. **Verbose Logging**: Add debugging output for IP resolution process
5. **Backward Compatibility**: Preserve existing behavior for specific IP addresses

### Design Principles
- **Minimal Invasiveness**: Changes localized to `discover-opencode.ts`
- **Fail-Safe Behavior**: Always fallback to `localhost` on errors
- **Performance Conscious**: IP resolution only triggered when needed
- **Consistency**: Follow existing code patterns and conventions

## Component Details

### 1. Container IP Resolution Function

**Location**: `src/commands/discover-opencode.ts` (before line 107, before `discoverOpencodeInstances()`)

**Function Signature**:
```typescript
async function getContainerIpAddress(
  containerId: string, 
  verbose: boolean
): Promise<string>
```

**Responsibilities**:
- Execute Docker inspect commands to retrieve container IP
- Implement primary and fallback resolution strategies
- Handle errors with appropriate fallback behavior
- Provide verbose logging for debugging

**Implementation Strategy**:

#### Primary Resolution Method
Use Docker's standard IP address field:
```typescript
docker inspect --format '{{.NetworkSettings.IPAddress}}' <containerId>
```

This retrieves the primary IP address for containers on the default bridge network.

#### Fallback Resolution Method
For containers on custom networks or multi-network setups:
```typescript
docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' <containerId>
```

This iterates through all networks and returns the first available IP address.

#### Execution Pattern
Follow existing Bun command execution patterns:
```typescript
const result = await $`docker inspect --format '{{.NetworkSettings.IPAddress}}' ${containerId}`.text();
```

#### Error Handling Strategy
- Primary method fails → Try fallback method
- Both methods fail → Return empty string
- Empty string result → Triggers `localhost` fallback at call site
- Verbose logging at each step for debugging

#### Verbose Logging
When `verbose` is `true`:
- Log when IP resolution starts
- Log primary method result (success/failure)
- Log fallback method attempt (if needed)
- Log final resolved IP or fallback decision
- Use `console.error()` for verbose output (stderr)

#### Example Implementation Structure
```typescript
async function getContainerIpAddress(containerId: string, verbose: boolean): Promise<string> {
  // Validate container ID
  if (!containerId || !isValidContainerId(containerId)) {
    if (verbose) console.error('Invalid container ID for IP resolution');
    return '';
  }

  // Log resolution attempt
  if (verbose) console.error(`Resolving IP address for container ${containerId}...`);

  try {
    // Primary method: Default IPAddress field
    const primaryResult = await $`docker inspect --format '{{.NetworkSettings.IPAddress}}' ${containerId}`.text();
    const primaryIp = primaryResult.trim();
    
    if (primaryIp && primaryIp !== '' && primaryIp !== '<no value>') {
      if (verbose) console.error(`Primary IP resolution successful: ${primaryIp}`);
      return primaryIp;
    }
    
    if (verbose) console.error('Primary IP resolution returned empty, trying fallback method...');
    
    // Fallback method: Iterate through Networks
    const fallbackResult = await $`docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${containerId}`.text();
    const fallbackIp = fallbackResult.trim();
    
    if (fallbackIp && fallbackIp !== '' && fallbackIp !== '<no value>') {
      if (verbose) console.error(`Fallback IP resolution successful: ${fallbackIp}`);
      return fallbackIp;
    }
    
    if (verbose) console.error('Both IP resolution methods returned empty');
    return '';
    
  } catch (error) {
    if (verbose) {
      console.error('IP resolution failed with error:', error instanceof Error ? error.message : String(error));
    }
    return '';
  }
}
```

### 2. Host Resolution Logic Enhancement

**Location**: `src/commands/discover-opencode.ts`, line 222

**Current Implementation**:
```typescript
const host = match[1] === '0.0.0.0' ? 'localhost' : match[1];
```

**Enhanced Implementation**:

#### Detection and Resolution Flow
1. Parse address from netstat output (existing regex)
2. Check if address is `0.0.0.0`
3. If yes → Call `getContainerIpAddress()`
4. Use resolved IP or fallback to `localhost`
5. If no → Use original address unchanged

#### Implementation Structure
```typescript
// Parse address from netstat (existing logic)
const match = line.match(/(\d+\.\d+\.\d+\.\d+|localhost|0\.0\.0\.0):(\d+)/);
if (match) {
  let host: string;
  
  // Check if 0.0.0.0 (listen on all interfaces)
  if (match[1] === '0.0.0.0') {
    // Resolve to actual container IP
    const containerIp = await getContainerIpAddress(containerId, options.verbose);
    
    // Use resolved IP or fallback to localhost
    host = containerIp || 'localhost';
    
    if (options.verbose) {
      console.error(`Resolved 0.0.0.0 to ${host} for container ${containerId}`);
    }
  } else {
    // Preserve existing behavior for specific IPs
    host = match[1];
  }
  
  const port = parseInt(match[2]);
  return { host, port };
}
```

#### Integration with Existing Code
- Maintain existing regex pattern for address extraction
- Preserve null check and filtering logic
- Keep compatibility with listeningAddresses array structure
- Ensure async/await consistency with surrounding code

#### Verbose Output
When `options.verbose` is `true`:
- Log when `0.0.0.0` is detected
- Log IP resolution attempt
- Log final host value (resolved IP or localhost fallback)
- Show comparison: `0.0.0.0:42327` → `192.168.215.3:42327`

### 3. Error Handling and Fallback Strategy

#### Multi-Layer Fallback Approach

**Layer 1: Primary Resolution**
- Execute primary Docker inspect command
- Return IP if valid and non-empty
- Proceed to Layer 2 if empty or invalid

**Layer 2: Fallback Resolution**
- Execute fallback Docker inspect command
- Return IP if valid and non-empty
- Proceed to Layer 3 if empty or invalid

**Layer 3: Localhost Fallback**
- Return empty string from `getContainerIpAddress()`
- Calling code uses `localhost` as final fallback
- Discovery process continues normally

#### Error Categories and Handling

**Docker Command Failures**:
- Cause: Container not found, Docker daemon issues
- Handling: Catch exception, log if verbose, return empty string
- Impact: Graceful fallback to `localhost`, no discovery interruption

**Invalid Container IDs**:
- Cause: Malformed container ID passed to function
- Handling: Early validation check, return empty string
- Impact: Prevents unnecessary Docker command execution

**Network Configuration Issues**:
- Cause: Container not connected to any network, unusual network setup
- Handling: Both methods return empty, fallback to `localhost`
- Impact: User sees `localhost` but discovery completes

**Parsing Failures**:
- Cause: Unexpected Docker output format
- Handling: Trim and validate output, check for sentinel values
- Impact: Safe degradation to `localhost`

#### Non-Breaking Guarantee
Every error path must:
- Return a valid host value (IP or `localhost`)
- Allow discovery process to continue
- Preserve existing instance collection logic
- Maintain output format consistency

## Data Structures

### Existing Structures (No Modifications)

#### OpencodeInstance Interface
```typescript
export interface OpencodeInstance {
  containerId: string;
  containerName: string;
  host: string;            // This field will now contain actual container IP for 0.0.0.0
  port: number;
  processId: number;
  elapsedTime: number;
  isValidApi: boolean;
}
```

**Field Impact**:
- `host`: Now contains actual container IP (e.g., `192.168.215.3`) instead of `localhost` when service listens on `0.0.0.0`
- All other fields: Unchanged

#### CommandOptions Interface
```typescript
interface CommandOptions {
  all: boolean;
  format: 'text' | 'json' | 'yaml' | 'plain';
  filter?: string;
  verbose: boolean;        // Used for IP resolution logging
}
```

**Usage**:
- `verbose`: Passed to `getContainerIpAddress()` for logging control

### Internal Data Types

#### Host Resolution Context
No new type needed, but the resolution flow handles:
```typescript
{
  rawAddress: string,      // From netstat: "0.0.0.0:42327"
  parsedHost: string,      // Extracted: "0.0.0.0"
  parsedPort: number,      // Extracted: 42327
  containerId: string,     // Current container being processed
  resolvedIp: string,      // From getContainerIpAddress(): "192.168.215.3"
  finalHost: string        // Used in OpencodeInstance: "192.168.215.3" or "localhost"
}
```

#### IP Resolution Result
Function return type is simple string:
```typescript
async function getContainerIpAddress(containerId: string, verbose: boolean): Promise<string>
```

Return values:
- Non-empty string: Valid IP address (e.g., `"192.168.215.3"`)
- Empty string: Resolution failed, triggers `localhost` fallback
- Never null/undefined: Always returns string

### Data Flow Diagram

```
netstat output (line)
  ↓
regex match → rawAddress: "0.0.0.0:42327"
  ↓
split → host: "0.0.0.0", port: 42327
  ↓
if (host === "0.0.0.0") → getContainerIpAddress(containerId)
  ↓                              ↓
  |                          Primary Docker inspect
  |                              ↓
  |                          Success? → IP: "192.168.215.3"
  |                              ↓
  |                          Failure → Fallback Docker inspect
  |                              ↓
  |                          Success? → IP: "192.168.215.3"
  |                              ↓
  |                          Failure → Empty string: ""
  ↓                              ↓
finalHost = resolvedIp || "localhost"
  ↓
OpencodeInstance { host: finalHost, port: 42327, ... }
  ↓
Output to user
```

## API Design

### Public API (No Changes)

The `discover-opencode` command maintains its existing public interface:

```bash
aisanity discover-opencode [options]
```

**Options (Unchanged)**:
- `-a, --all`: Return all discovered instances
- `-f, --format <format>`: Output format (text, json, yaml, plain)
- `--filter <pattern>`: Filter containers by name or label
- `-v, --verbose`: Enable verbose logging (now includes IP resolution details)

**Output Format (Enhanced)**:

Text format example:
```
Most recent opencode instance:
  Container: aisanity-main-myproject
  Port: 42327
  Age: 45 seconds
  Host:Port: 192.168.215.3:42327    # ← Changed from localhost:42327
```

JSON format example:
```json
{
  "instances": [
    {
      "containerId": "abc123...",
      "containerName": "aisanity-main-myproject",
      "host": "192.168.215.3",         // ← Changed from "localhost"
      "port": 42327,
      "processId": 1234,
      "elapsedTime": 45,
      "isValidApi": true
    }
  ],
  "mostRecent": { /* same structure */ }
}
```

Plain format example:
```
192.168.215.3:42327                   // ← Changed from localhost:42327
```

### Internal API (New Function)

#### getContainerIpAddress()

**Signature**:
```typescript
async function getContainerIpAddress(
  containerId: string, 
  verbose: boolean
): Promise<string>
```

**Parameters**:
- `containerId` (string, required): Docker container ID (12-64 character hex string)
- `verbose` (boolean, required): Enable verbose logging to stderr

**Returns**:
- `Promise<string>`: Resolved IP address or empty string on failure

**Behavior**:
- Validates container ID format using existing `isValidContainerId()`
- Executes primary Docker inspect command
- Falls back to secondary method if primary returns empty
- Returns empty string on all error conditions
- Logs detailed information when verbose is true

**Error Handling**:
- Never throws exceptions (all errors caught internally)
- Invalid container ID → Returns empty string
- Docker command failure → Returns empty string
- No IP address found → Returns empty string
- Calling code handles empty string with `localhost` fallback

**Logging Output** (when verbose=true):
```
Resolving IP address for container abc123...
Primary IP resolution successful: 192.168.215.3
```

Or on failure:
```
Resolving IP address for container abc123...
Primary IP resolution returned empty, trying fallback method...
Fallback IP resolution successful: 192.168.215.3
```

Or on complete failure:
```
Resolving IP address for container abc123...
Primary IP resolution returned empty, trying fallback method...
Both IP resolution methods returned empty
```

### Integration Points

#### 1. Container ID Source
IP resolution integrates with existing container discovery:
```typescript
for (const containerId of containersWithOpencode) {
  // containerId available for IP resolution
  const containerIp = await getContainerIpAddress(containerId, options.verbose);
  // ...
}
```

#### 2. Verbose Mode Integration
Uses existing `options.verbose` flag:
```typescript
if (options.verbose) console.error(`Resolved 0.0.0.0 to ${host}`);
```

#### 3. Output Format Integration
Resolved IPs flow through existing formatters:
- `formatText()`: No changes needed
- `formatPlain()`: No changes needed
- JSON/YAML output: No changes needed

All formatters consume `OpencodeInstance.host` which now contains accurate IP.

#### 4. API Validation Integration
Resolved IPs are validated by existing `isOpencodeApi()`:
```typescript
if (await isOpencodeApi(containerId, host, port, options.verbose)) {
  // host now contains actual container IP, not localhost
}
```

## Testing Strategy

### Unit Testing Approach

#### Test File Location
Add tests to: `tests/discover-opencode.test.ts` (new file)

#### Test Categories

**1. Container IP Resolution Tests**

Test `getContainerIpAddress()` function:

```typescript
describe('getContainerIpAddress', () => {
  test('resolves IP for valid container', async () => {
    // Mock docker inspect to return IP
    // Assert: Returns expected IP address
  });

  test('returns empty string for invalid container ID', async () => {
    // Pass invalid container ID
    // Assert: Returns empty string
  });

  test('falls back to secondary method when primary fails', async () => {
    // Mock primary method to return empty
    // Mock fallback method to return IP
    // Assert: Returns IP from fallback method
  });

  test('returns empty string when both methods fail', async () => {
    // Mock both methods to fail
    // Assert: Returns empty string
  });

  test('handles docker command exceptions gracefully', async () => {
    // Mock docker command to throw error
    // Assert: Returns empty string, no exception propagated
  });

  test('logs verbose output when verbose is true', async () => {
    // Mock console.error
    // Call with verbose=true
    // Assert: Verbose messages logged
  });

  test('does not log when verbose is false', async () => {
    // Mock console.error
    // Call with verbose=false
    // Assert: No verbose messages logged
  });
});
```

**2. Host Resolution Logic Tests**

Test enhanced host resolution in `discoverOpencodeInstances()`:

```typescript
describe('Host Resolution', () => {
  test('resolves 0.0.0.0 to container IP', async () => {
    // Mock container with 0.0.0.0 listener
    // Mock getContainerIpAddress to return IP
    // Assert: Instance has resolved IP as host
  });

  test('falls back to localhost when IP resolution fails', async () => {
    // Mock container with 0.0.0.0 listener
    // Mock getContainerIpAddress to return empty string
    // Assert: Instance has 'localhost' as host
  });

  test('preserves specific IPs unchanged', async () => {
    // Mock container with 127.0.0.1 listener
    // Assert: Instance has '127.0.0.1' as host
    
    // Mock container with 192.168.1.100 listener
    // Assert: Instance has '192.168.1.100' as host
  });

  test('does not call IP resolution for non-0.0.0.0 addresses', async () => {
    // Mock getContainerIpAddress as spy
    // Mock container with 127.0.0.1 listener
    // Assert: getContainerIpAddress not called
  });
});
```

**3. Backward Compatibility Tests**

```typescript
describe('Backward Compatibility', () => {
  test('maintains existing output format', async () => {
    // Mock container with specific IP
    // Assert: Output structure unchanged
  });

  test('handles containers with no 0.0.0.0 listeners', async () => {
    // Mock container with only specific IPs
    // Assert: Behavior identical to before
  });

  test('continues discovery on IP resolution failure', async () => {
    // Mock multiple containers, one with failing IP resolution
    // Assert: Other containers still discovered
  });
});
```

**4. Integration Tests**

```typescript
describe('End-to-End Discovery', () => {
  test('discovers container listening on 0.0.0.0 with resolved IP', async () => {
    // Requires running Docker container
    // Start container with service on 0.0.0.0
    // Run discover-opencode
    // Assert: Shows actual container IP, not localhost
  });

  test('handles multiple containers with mixed addresses', async () => {
    // Container 1: 0.0.0.0 listener
    // Container 2: 127.0.0.1 listener
    // Assert: Container 1 shows resolved IP, Container 2 shows 127.0.0.1
  });
});
```

### Manual Testing Scenarios

#### Scenario 1: Standard Bridge Network
**Setup**:
- Start container on default Docker bridge
- Run opencode listening on `0.0.0.0:42327`

**Test**:
```bash
aisanity discover-opencode
```

**Expected**:
- Shows container IP like `172.17.0.2:42327`
- NOT `localhost:42327`

#### Scenario 2: Custom Docker Network
**Setup**:
- Create custom network: `docker network create test-net --subnet 192.168.100.0/24`
- Start container on custom network
- Run opencode listening on `0.0.0.0:42327`

**Test**:
```bash
aisanity discover-opencode -v
```

**Expected**:
- Shows container IP like `192.168.100.2:42327`
- Verbose output shows fallback method used

#### Scenario 3: Multiple Network Interfaces
**Setup**:
- Connect container to multiple networks
- Run opencode listening on `0.0.0.0:42327`

**Test**:
```bash
aisanity discover-opencode
```

**Expected**:
- Shows one of the available IPs (first found)
- Discovery completes successfully

#### Scenario 4: Host Network Mode
**Setup**:
- Start container with `--network host`
- Run opencode listening on `0.0.0.0:42327`

**Test**:
```bash
aisanity discover-opencode
```

**Expected**:
- Shows `localhost:42327` (fallback behavior)
- No errors or crashes

#### Scenario 5: Specific IP Listener
**Setup**:
- Run opencode listening on `127.0.0.1:42327`

**Test**:
```bash
aisanity discover-opencode
```

**Expected**:
- Shows `127.0.0.1:42327` (unchanged behavior)
- IP resolution not triggered

#### Scenario 6: Verbose Mode
**Setup**:
- Start container with opencode on `0.0.0.0:42327`

**Test**:
```bash
aisanity discover-opencode -v
```

**Expected**:
- Shows resolved IP in output
- Stderr includes IP resolution logs:
  - "Resolving IP address for container..."
  - "Primary IP resolution successful: X.X.X.X"
  - "Resolved 0.0.0.0 to X.X.X.X for container..."

#### Scenario 7: IP Resolution Failure
**Setup**:
- Mock or force Docker inspect to fail
- Container with `0.0.0.0` listener

**Test**:
```bash
aisanity discover-opencode -v
```

**Expected**:
- Shows `localhost:42327` (fallback)
- Verbose logs show resolution failure
- Discovery completes, other containers unaffected

### Performance Testing

#### Metrics to Measure
- Discovery time with IP resolution vs. without
- Time per IP resolution call
- Impact of fallback method usage

#### Performance Test Cases

```typescript
describe('Performance', () => {
  test('IP resolution completes within acceptable time', async () => {
    // Measure getContainerIpAddress() execution time
    // Assert: < 500ms per call
  });

  test('discovery with 10 containers completes within acceptable time', async () => {
    // Mock 10 containers with 0.0.0.0 listeners
    // Measure total discovery time
    // Assert: Minimal overhead compared to baseline
  });

  test('conditional IP resolution prevents unnecessary calls', async () => {
    // Mock 10 containers with specific IPs (no 0.0.0.0)
    // Assert: getContainerIpAddress never called
    // Assert: Discovery time unchanged
  });
});
```

#### Performance Acceptance Criteria
- Single IP resolution: < 500ms
- 10 containers with IP resolution: < 5 seconds overhead
- Containers without 0.0.0.0: Zero overhead

### Regression Testing

**Test Suite Execution**:
```bash
npm test
```

**Critical Test Files**:
- `tests/basic.test.ts`: Ensure basic functionality unchanged
- `tests/container-utils.test.ts`: Verify container utilities intact
- `tests/config.test.ts`: Configuration loading unaffected

**Regression Criteria**:
- All existing tests pass without modification
- No new console warnings or errors
- Output format consistency maintained

## Development Phases

### Phase 1: Function Implementation (Estimated: 2-3 hours)

#### Tasks
1. **Add getContainerIpAddress() function**
   - Location: `src/commands/discover-opencode.ts` (before line 107)
   - Implement primary Docker inspect method
   - Implement fallback Docker inspect method
   - Add container ID validation
   - Implement error handling with try-catch
   - Add verbose logging at each step

2. **Verify function isolation**
   - Ensure no side effects on existing code
   - Confirm proper async/await usage
   - Validate return type consistency

#### Deliverables
- New function implementation
- JSDoc documentation for the function
- Code follows existing style conventions

#### Verification
- Function compiles without TypeScript errors
- Manual testing with sample container ID
- Verbose logging outputs correctly

### Phase 2: Host Resolution Integration (Estimated: 2-3 hours)

#### Tasks
1. **Modify line 222 logic**
   - Add conditional check for `0.0.0.0`
   - Call `getContainerIpAddress()` when detected
   - Implement fallback to `localhost`
   - Preserve existing behavior for other addresses

2. **Add verbose logging**
   - Log when `0.0.0.0` is detected
   - Log resolved IP or fallback decision
   - Follow existing verbose logging patterns

3. **Ensure async context**
   - Verify surrounding code supports async/await
   - Adjust if needed (should already be async)

#### Deliverables
- Modified host resolution logic
- Verbose logging integration
- Backward compatibility maintained

#### Verification
- Code compiles without errors
- Discovery logic still functions for non-0.0.0.0
- Verbose mode shows new logging

### Phase 3: Testing Implementation (Estimated: 4-5 hours)

#### Tasks
1. **Create test file**
   - New file: `tests/discover-opencode.test.ts`
   - Set up test environment with Bun test framework
   - Import necessary mocking utilities

2. **Write unit tests**
   - Test `getContainerIpAddress()` function
   - Test host resolution logic
   - Test error handling paths
   - Test verbose logging output

3. **Write integration tests**
   - Test with mock Docker containers
   - Test different network configurations
   - Test mixed address scenarios

4. **Run existing test suite**
   - Verify no regressions: `npm test`
   - Fix any breaking changes
   - Ensure all tests pass

#### Deliverables
- Comprehensive test suite
- All new tests passing
- All existing tests passing
- Test coverage report

#### Verification
- `npm test` passes 100%
- Test coverage for new function > 80%
- No console errors during test run

### Phase 4: Manual Verification (Estimated: 2-3 hours)

#### Tasks
1. **Set up test environments**
   - Default bridge network container
   - Custom network container
   - Container with multiple networks
   - Host network mode container

2. **Execute manual test scenarios**
   - Run each scenario from Testing Strategy section
   - Verify output correctness
   - Test verbose mode functionality
   - Test error handling with forced failures

3. **Document results**
   - Record actual vs. expected outputs
   - Note any edge cases discovered
   - Document workarounds if needed

#### Deliverables
- Manual test execution report
- Screenshots/logs of key scenarios
- Edge case documentation

#### Verification
- All manual tests pass
- Output matches expectations
- No unexpected errors or warnings

### Phase 5: Documentation and Cleanup (Estimated: 1-2 hours)

#### Tasks
1. **Add code comments**
   - JSDoc for `getContainerIpAddress()`
   - Inline comments for complex logic
   - Explain fallback strategy

2. **Update DEVELOPMENT.md (if needed)**
   - Note new IP resolution behavior
   - Document verbose logging additions

3. **Code review checklist**
   - Verify naming conventions
   - Check error handling completeness
   - Validate TypeScript types
   - Ensure no console.log (use console.error for verbose)

4. **Performance validation**
   - Measure IP resolution time
   - Verify no significant discovery slowdown
   - Document performance characteristics

#### Deliverables
- Well-commented code
- Updated documentation (if needed)
- Performance validation report

#### Verification
- Code passes linter: `npm run lint`
- All comments accurate and helpful
- Performance meets acceptance criteria

### Phase 6: Final Integration and Testing (Estimated: 1-2 hours)

#### Tasks
1. **Full build verification**
   - Run `npm run build`
   - Verify dist output
   - Test compiled version

2. **End-to-end testing**
   - Test with real aisanity project
   - Verify with real containers
   - Test all output formats (text, json, yaml, plain)

3. **Edge case verification**
   - Test with no containers
   - Test with stopped containers
   - Test with invalid container states

4. **Prepare for code review**
   - Self-review all changes
   - Prepare change summary
   - Note any assumptions or limitations

#### Deliverables
- Fully integrated and tested implementation
- Build artifacts verified
- Code review preparation complete

#### Verification
- All output formats work correctly
- Real-world usage successful
- Ready for merge/deployment

## Summary

### Implementation Scope
- **Single file modification**: `src/commands/discover-opencode.ts`
- **New function**: `getContainerIpAddress()` (~50 lines)
- **Modified logic**: Host resolution at line 222 (~15 lines)
- **Test file**: New `tests/discover-opencode.test.ts` (~200 lines)

### Key Design Decisions
1. **Conditional Resolution**: Only resolve IPs for `0.0.0.0`, preserving existing behavior
2. **Dual Method Approach**: Primary and fallback Docker inspect commands for robustness
3. **Fail-Safe Design**: Always fallback to `localhost`, never break discovery
4. **Verbose Logging**: Detailed debugging without cluttering normal output
5. **Zero Breaking Changes**: Complete backward compatibility

### Success Metrics
- ✅ `discover-opencode` shows actual container IP for `0.0.0.0` listeners
- ✅ Existing behavior preserved for specific IP addresses
- ✅ Robust error handling with graceful fallbacks
- ✅ Verbose mode provides debugging insights
- ✅ All tests pass (existing + new)
- ✅ No performance degradation

### Estimated Total Effort
**14-18 hours** across 6 development phases

### Risk Mitigation
- Extensive error handling prevents discovery failures
- Fallback behavior maintains existing user experience
- Comprehensive testing catches regressions early
- Manual verification ensures real-world compatibility
- Verbose logging aids troubleshooting

### Future Enhancements (Out of Scope)
- Container IP caching for repeated inspections
- Display both listening address and reachable address in verbose mode
- Performance metrics for IP resolution overhead
- Support for IPv6 addresses
- Configuration option to disable IP resolution
