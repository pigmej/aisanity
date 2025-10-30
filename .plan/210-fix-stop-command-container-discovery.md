# Implementation Plan: Fix Stop Command Container Discovery

## Implementation Overview

### Objective
Modernize the `stop` command's default behavior to use unified label-based container discovery with branch-specific filtering, removing all legacy fallback patterns and aligning with the established container discovery architecture.

### Scope
- **Primary File**: `src/commands/stop.ts` (lines 40-96)
- **Dependencies**: Existing `discoverAllAisanityContainers()` and `getCurrentBranch()` utilities
- **Impact**: Default `aisanity stop` behavior only; `--worktree` and `--all-worktrees` options preserved unchanged

### Architecture Alignment
This implementation follows the unified container discovery architecture established in `.plan/arch_170-fix-container-discovery-inconsistency.md`, specifically:
- Two-phase validation: container discovery first, worktree validation second
- Label-based primary discovery mechanism
- Branch-specific filtering using `aisanity.workspace` and `aisanity.branch` labels
- Complete removal of legacy naming patterns

### Key Changes Summary
1. Replace `getContainerName()` call with `discoverAllAisanityContainers()` 
2. Implement branch filtering using `getCurrentBranch(cwd)`
3. Remove all legacy fallback logic (devcontainer and workspace pattern discovery)
4. Add branch-specific error messaging
5. Preserve existing `--worktree` and `--all-worktrees` functionality

---

## Component Details

### 1. Discovery Integration Component

**Location**: `src/commands/stop.ts`, lines 40-58

**Current Implementation (Problematic)**:
```typescript
const containerName = getContainerName(cwd, options.verbose || false);

logger.info(`Stopping containers for workspace: ${workspaceName}`);

try {
  execSync(`docker stop ${containerName}`, { stdio: 'inherit' });
  logger.info(`Stopped container: ${containerName}`);
} catch (error) {
  logger.info(`Container ${containerName} not found or already stopped`);
}
```

**Target Implementation**:
```typescript
// Discover all aisanity containers for this workspace
const discoveryResult = await discoverAllAisanityContainers({
  mode: 'workspace',
  workspace: cwd,
  includeOrphaned: false,
  validationMode: 'strict',
  verbose: options.verbose,
  debug: options.debug
});

// Filter by current branch
const currentBranch = getCurrentBranch(cwd);
const branchContainers = discoveryResult.containers.filter(container => {
  const workspaceMatch = container.labels?.['aisanity.workspace'] === cwd;
  const branchMatch = container.labels?.['aisanity.branch'] === currentBranch;
  return workspaceMatch && branchMatch;
});
```

**Responsibilities**:
- Execute workspace-scoped container discovery
- Filter results by current branch
- Handle discovery errors gracefully
- Provide verbose/debug output when requested

**Integration Points**:
- Uses `discoverAllAisanityContainers()` from `container-utils.ts`
- Uses `getCurrentBranch()` from `config.ts`
- Integrates with logger instance created by `createLoggerFromCommandOptions()`

**Error Handling**:
- Catch discovery errors and report to user
- Handle Docker daemon unavailability
- Validate discovery results before proceeding

---

### 2. Branch Filtering Component

**Location**: New filtering logic after discovery (lines 48-65 replacement)

**Implementation Details**:

```typescript
/**
 * Filter discovered containers by branch
 * 
 * @param containers - All discovered aisanity containers
 * @param currentBranch - Branch name from getCurrentBranch()
 * @param workspace - Current workspace path (cwd)
 * @returns Containers matching both workspace and branch
 */
function filterContainersByBranch(
  containers: DockerContainer[],
  currentBranch: string,
  workspace: string
): DockerContainer[] {
  return containers.filter(container => {
    const workspaceLabel = container.labels?.['aisanity.workspace'];
    const branchLabel = container.labels?.['aisanity.branch'];
    
    // Both labels must match for a container to be targeted
    const workspaceMatch = workspaceLabel === workspace;
    const branchMatch = branchLabel === currentBranch;
    
    return workspaceMatch && branchMatch;
  });
}
```

**Filtering Criteria**:
- **Workspace Match**: `container.labels['aisanity.workspace'] === cwd`
- **Branch Match**: `container.labels['aisanity.branch'] === currentBranch`
- **Conjunction**: Both conditions must be true (AND logic)

**Edge Cases**:
- Containers without labels: Excluded automatically by filter
- Multiple containers for same branch: All included (batch stop)
- Containers with mismatched labels: Excluded from results

---

### 3. Container Stopping Component

**Location**: `src/commands/stop.ts`, lines 50-95 replacement

**Current Implementation (Legacy)**:
```typescript
// Multiple try-catch blocks:
// 1. Direct container name stop
// 2. Devcontainer label-based fallback
// 3. Workspace name pattern fallback
```

**Target Implementation**:
```typescript
// Check if any containers found
if (branchContainers.length === 0) {
  logger.info(`No containers found for branch: ${currentBranch}`);
  
  if (options.verbose) {
    logger.verbose(`Searched workspace: ${cwd}`);
    logger.verbose(`Total containers discovered: ${discoveryResult.containers.length}`);
    logger.verbose(`Branch filter: ${currentBranch}`);
  }
  
  return;
}

// Stop discovered containers
logger.info(`Stopping ${branchContainers.length} container(s) for branch: ${currentBranch}`);

if (options.verbose) {
  branchContainers.forEach(container => {
    logger.verbose(`  - ${container.name} (${container.status})`);
  });
}

// Use existing stopContainers utility
const containerIds = branchContainers.map(c => c.id);
await stopContainers(containerIds, options.verbose || false);

logger.info('All branch containers stopped successfully');
```

**Responsibilities**:
- Handle empty result set gracefully
- Provide informative verbose output
- Leverage existing `stopContainers()` batch utility
- Report success/failure clearly

**Integration Points**:
- Uses `stopContainers()` from `container-utils.ts`
- Integrates with logger for all output
- Maintains consistent messaging patterns

---

### 4. Legacy Code Removal Component

**Location**: `src/commands/stop.ts`, lines 59-94

**Code to Remove**:

```typescript
// REMOVE: Lines 59-75 - Devcontainer fallback
try {
  const output = execSync(
    `docker ps --filter "label=devcontainer.local_folder=${cwd}" --format "{{.Names}}"`,
    { encoding: 'utf8' }
  );
  const containers = output.trim().split('\n').filter(name => name.trim() !== '');
  for (const container of containers) {
    if (container) {
      execSync(`docker stop ${container}`, { stdio: 'inherit' });
      logger.info(`Stopped devcontainer: ${container}`);
    }
  }
} catch (error) {
  // No devcontainers found for this workspace, that's okay
}

// REMOVE: Lines 77-94 - Workspace name pattern fallback
try {
  const output = execSync(
    `docker ps --filter "name=aisanity-${workspaceName}" --filter "name=${workspaceName}-" --format "{{.Names}}"`,
    { encoding: 'utf8' }
  );
  const containers = output.trim().split('\n').filter(name => name.trim() !== '');
  for (const container of containers) {
    if (container) {
      execSync(`docker stop ${container}`, { stdio: 'inherit' });
      logger.info(`Stopped aisanity container: ${container}`);
    }
  }
} catch (error) {
  // No aisanity containers found for this workspace, that's okay
}
```

**Rationale for Removal**:
- User explicitly requested "no fallback for old"
- Modern discovery handles all legitimate containers
- Legacy patterns no longer supported per v2.0.0 roadmap
- Reduces code complexity and maintenance burden

---

### 5. Error Messaging Enhancement Component

**Location**: Throughout modified stop command logic

**Error Message Categories**:

**1. No Containers Found**:
```typescript
// Standard message
logger.info(`No containers found for branch: ${currentBranch}`);

// Verbose output
if (options.verbose) {
  logger.verbose(`Searched workspace: ${cwd}`);
  logger.verbose(`Total containers discovered: ${discoveryResult.containers.length}`);
  logger.verbose(`Branch filter: ${currentBranch}`);
  
  if (discoveryResult.containers.length > 0) {
    logger.verbose('\nAvailable containers in workspace:');
    discoveryResult.containers.forEach(c => {
      logger.verbose(`  - ${c.name} (branch: ${c.labels['aisanity.branch'] || 'unknown'})`);
    });
  }
}
```

**2. Discovery Errors**:
```typescript
catch (error) {
  logger.error('Failed to discover containers:', error);
  
  if (options.debug) {
    logger.debug('Discovery configuration:', {
      mode: 'workspace',
      workspace: cwd,
      includeOrphaned: false,
      validationMode: 'strict'
    });
  }
  
  throw error;
}
```

**3. Container Stop Errors**:
```typescript
// Handled by existing stopContainers() utility
// Errors reported per container with context
```

**4. Docker Daemon Errors**:
```typescript
// Handled by executeDockerCommand() in container-utils
// Graceful degradation with timeout handling
```

---

## Data Structures

### Input Data Structures

**1. Command Options**:
```typescript
interface StopCommandOptions {
  worktree?: string;      // Optional: specific worktree path
  allWorktrees?: boolean; // Optional: stop all worktrees
  verbose?: boolean;      // User-facing details
  debug?: boolean;        // System debugging info
}
```

**2. Discovery Configuration**:
```typescript
// Used for default stop behavior
const discoveryConfig: ContainerDiscoveryOptions = {
  mode: 'workspace',
  workspace: cwd,
  includeOrphaned: false,
  validationMode: 'strict',
  verbose: options.verbose,
  debug: options.debug
};
```

### Output Data Structures

**1. Discovery Result** (from `discoverAllAisanityContainers()`):
```typescript
interface EnhancedContainerDiscoveryResult {
  containers: DockerContainer[];      // All discovered containers
  labeled: DockerContainer[];         // Containers with aisanity labels
  unlabeled: DockerContainer[];       // Containers without labels
  orphaned: DockerContainer[];        // Containers with invalid worktrees
  errors: DiscoveryError[];           // Discovery errors
  validationResults: Map<string, WorktreeValidationResult>;
  discoveryMetadata: {
    totalDiscovered: number;
    labeledCount: number;
    unlabeledCount: number;
    orphanedCount: number;
    validationMode: 'strict' | 'permissive';
    discoveryTimestamp: Date;
  };
}
```

**2. Filtered Containers**:
```typescript
// Array of containers matching branch filter
const branchContainers: DockerContainer[] = [
  {
    id: '1a2b3c4d',
    name: 'dazzling_chandrasekhar',
    image: 'mcr.microsoft.com/devcontainers/...',
    status: 'running',
    labels: {
      'aisanity.workspace': '/Users/dev/project',
      'aisanity.branch': 'main',
      'aisanity.container': 'dazzling_chandrasekhar',
      'aisanity.created': '2025-10-30T10:00:00Z',
      'aisanity.version': '1.5.0'
    },
    ports: '3000->3000'
  }
];
```

### Intermediate Data Structures

**1. Branch Filter Context**:
```typescript
interface BranchFilterContext {
  currentBranch: string;     // From getCurrentBranch(cwd)
  workspace: string;         // Current working directory
  totalDiscovered: number;   // Before filtering
  filteredCount: number;     // After filtering
}
```

**2. Verbose Output Context**:
```typescript
interface VerboseOutputContext {
  workspace: string;
  branch: string;
  discoveredCount: number;
  filteredCount: number;
  containers: Array<{
    name: string;
    branch: string;
    status: string;
  }>;
}
```

---

## API Design

### Public API (Command Interface)

**Command Signature** (unchanged):
```typescript
aisanity stop [options]

Options:
  --worktree <path>    Stop containers for specific worktree
  --all-worktrees      Stop containers for all worktrees
  -v, --verbose        Show detailed user information
  -d, --debug          Show system debugging information
  -h, --help           Display help information
```

**Behavior Modes**:

| Mode | Command | Discovery Config | Filtering |
|------|---------|-----------------|-----------|
| Default | `aisanity stop` | `mode: 'workspace'`, `validationMode: 'strict'` | Current branch only |
| Worktree | `aisanity stop --worktree <path>` | `mode: 'worktree'` | Specified worktree |
| All Worktrees | `aisanity stop --all-worktrees` | `mode: 'global'`, `validationMode: 'permissive'` | No filtering |

### Internal API Changes

**Modified Function Signature**:
```typescript
// Before: Synchronous operation with direct Docker calls
const containerName = getContainerName(cwd, options.verbose || false);
execSync(`docker stop ${containerName}`, { stdio: 'inherit' });

// After: Async operation with discovery-based approach
const discoveryResult = await discoverAllAisanityContainers({...});
const branchContainers = filterContainersByBranch(...);
await stopContainers(containerIds, options.verbose);
```

**Function Signature Must Change**:
- Command action handler: Synchronous → **Async** (add `async` keyword)
- Reason: `discoverAllAisanityContainers()` returns `Promise<EnhancedContainerDiscoveryResult>`

### Integration Contracts

**1. Container Discovery Contract**:
```typescript
// Input: Discovery options
const options: ContainerDiscoveryOptions = {
  mode: 'workspace',
  workspace: string,
  includeOrphaned: boolean,
  validationMode: 'strict' | 'permissive',
  verbose?: boolean,
  debug?: boolean
};

// Output: Enhanced discovery result
const result: Promise<EnhancedContainerDiscoveryResult>
```

**2. Branch Filtering Contract**:
```typescript
// Input: Containers and branch context
function filterContainersByBranch(
  containers: DockerContainer[],
  currentBranch: string,
  workspace: string
): DockerContainer[]

// Output: Filtered container array
```

**3. Container Stopping Contract**:
```typescript
// Input: Container IDs and verbose flag
async function stopContainers(
  containerIds: string[],
  verbose: boolean
): Promise<void>

// Output: Void (throws on error)
```

### Backward Compatibility

**Preserved Behaviors**:
- All command-line options remain unchanged
- `--worktree` option behavior unchanged
- `--all-worktrees` option behavior unchanged
- Exit codes remain consistent
- Output format structure maintained

**Changed Behaviors** (breaking changes acceptable):
- Default behavior now stops only current branch containers
- Legacy container naming patterns no longer supported
- Error messages changed for clarity

**Migration Path**:
- Users relying on legacy patterns must update to labeled containers
- No automatic migration (per v2.0.0 deprecation policy)
- Clear error messages guide users to modern approach

---

## Testing Strategy

### Unit Tests

**Test File**: `tests/stop-branch-filtering.test.ts`

**Test Cases**:

1. **Branch Filtering Logic**:
```typescript
describe('filterContainersByBranch', () => {
  it('should filter containers by branch and workspace', () => {
    const containers = [
      { labels: { 'aisanity.workspace': '/proj', 'aisanity.branch': 'main' } },
      { labels: { 'aisanity.workspace': '/proj', 'aisanity.branch': 'feature' } },
      { labels: { 'aisanity.workspace': '/other', 'aisanity.branch': 'main' } }
    ];
    
    const result = filterContainersByBranch(containers, 'main', '/proj');
    
    expect(result).toHaveLength(1);
    expect(result[0].labels['aisanity.branch']).toBe('main');
  });
  
  it('should exclude containers without labels', () => {
    const containers = [
      { labels: {} },
      { labels: { 'aisanity.workspace': '/proj' } }, // Missing branch
      { labels: { 'aisanity.branch': 'main' } }       // Missing workspace
    ];
    
    const result = filterContainersByBranch(containers, 'main', '/proj');
    
    expect(result).toHaveLength(0);
  });
  
  it('should handle empty container list', () => {
    const result = filterContainersByBranch([], 'main', '/proj');
    expect(result).toHaveLength(0);
  });
});
```

2. **Discovery Integration**:
```typescript
describe('stop command discovery integration', () => {
  it('should use workspace mode discovery', async () => {
    const mockDiscovery = jest.spyOn(containerUtils, 'discoverAllAisanityContainers');
    
    await stopCommand.parseAsync(['stop'], { from: 'user' });
    
    expect(mockDiscovery).toHaveBeenCalledWith({
      mode: 'workspace',
      workspace: expect.any(String),
      includeOrphaned: false,
      validationMode: 'strict',
      verbose: undefined,
      debug: undefined
    });
  });
});
```

3. **Error Handling**:
```typescript
describe('stop command error handling', () => {
  it('should handle no containers found gracefully', async () => {
    const mockLogger = createMockLogger();
    jest.spyOn(containerUtils, 'discoverAllAisanityContainers')
      .mockResolvedValue({ containers: [], ... });
    
    await stopCommand.parseAsync(['stop'], { from: 'user' });
    
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('No containers found for branch')
    );
  });
  
  it('should handle discovery errors', async () => {
    jest.spyOn(containerUtils, 'discoverAllAisanityContainers')
      .mockRejectedValue(new Error('Docker daemon not running'));
    
    await expect(
      stopCommand.parseAsync(['stop'], { from: 'user' })
    ).rejects.toThrow('Docker daemon not running');
  });
});
```

### Integration Tests

**Test File**: `tests/stop-command-integration.test.ts`

**Test Scenarios**:

1. **Real Docker Container Lifecycle**:
```typescript
describe('stop command integration', () => {
  let testContainer: string;
  
  beforeEach(async () => {
    // Start a labeled test container
    testContainer = await startTestContainer({
      labels: {
        'aisanity.workspace': process.cwd(),
        'aisanity.branch': 'main'
      }
    });
  });
  
  afterEach(async () => {
    await cleanupTestContainer(testContainer);
  });
  
  it('should stop container for current branch', async () => {
    await stopCommand.parseAsync(['stop'], { from: 'user' });
    
    const status = await getContainerStatus(testContainer);
    expect(status).toBe('stopped');
  });
  
  it('should not stop containers from other branches', async () => {
    const otherContainer = await startTestContainer({
      labels: {
        'aisanity.workspace': process.cwd(),
        'aisanity.branch': 'feature'
      }
    });
    
    await stopCommand.parseAsync(['stop'], { from: 'user' });
    
    const status = await getContainerStatus(otherContainer);
    expect(status).toBe('running');
    
    await cleanupTestContainer(otherContainer);
  });
});
```

2. **Multi-Branch Scenarios**:
```typescript
describe('stop command branch isolation', () => {
  it('should handle multiple containers on same branch', async () => {
    const container1 = await startTestContainer({
      labels: { 'aisanity.branch': 'main', 'aisanity.workspace': process.cwd() }
    });
    const container2 = await startTestContainer({
      labels: { 'aisanity.branch': 'main', 'aisanity.workspace': process.cwd() }
    });
    
    await stopCommand.parseAsync(['stop'], { from: 'user' });
    
    expect(await getContainerStatus(container1)).toBe('stopped');
    expect(await getContainerStatus(container2)).toBe('stopped');
  });
});
```

### Regression Tests

**Test File**: `tests/stop-command-regression.test.ts`

**Regression Scenarios**:

1. **Preserve Existing Options**:
```typescript
describe('stop command backward compatibility', () => {
  it('should preserve --worktree option behavior', async () => {
    const worktreePath = '/path/to/worktree';
    
    await stopCommand.parseAsync(['stop', '--worktree', worktreePath], { from: 'user' });
    
    // Verify worktree-specific logic unchanged
  });
  
  it('should preserve --all-worktrees option behavior', async () => {
    await stopCommand.parseAsync(['stop', '--all-worktrees'], { from: 'user' });
    
    // Verify existing stopAllWorktreeContainers() called
  });
});
```

2. **Legacy Pattern Removal Verification**:
```typescript
describe('legacy pattern removal', () => {
  it('should not call getContainerName()', async () => {
    const mockGetContainerName = jest.spyOn(config, 'getContainerName');
    
    await stopCommand.parseAsync(['stop'], { from: 'user' });
    
    expect(mockGetContainerName).not.toHaveBeenCalled();
  });
  
  it('should not search for devcontainer labels', async () => {
    const mockExecSync = jest.spyOn(child_process, 'execSync');
    
    await stopCommand.parseAsync(['stop'], { from: 'user' });
    
    expect(mockExecSync).not.toHaveBeenCalledWith(
      expect.stringContaining('devcontainer.local_folder')
    );
  });
});
```

### Edge Case Tests

**Test File**: `tests/stop-command-edge-cases.test.ts`

**Edge Case Scenarios**:

1. **No Containers**:
```typescript
it('should handle workspace with no containers', async () => {
  jest.spyOn(containerUtils, 'discoverAllAisanityContainers')
    .mockResolvedValue({ containers: [], labeled: [], unlabeled: [], orphaned: [], errors: [] });
  
  const output = await captureOutput(() => 
    stopCommand.parseAsync(['stop'], { from: 'user' })
  );
  
  expect(output).toContain('No containers found for branch');
});
```

2. **Invalid Branch**:
```typescript
it('should handle invalid branch gracefully', async () => {
  jest.spyOn(config, 'getCurrentBranch').mockReturnValue('');
  
  await expect(
    stopCommand.parseAsync(['stop'], { from: 'user' })
  ).not.toThrow();
});
```

3. **Docker Daemon Down**:
```typescript
it('should handle Docker daemon unavailable', async () => {
  jest.spyOn(containerUtils, 'discoverAllAisanityContainers')
    .mockRejectedValue(new Error('Cannot connect to Docker daemon'));
  
  await expect(
    stopCommand.parseAsync(['stop'], { from: 'user' })
  ).rejects.toThrow('Cannot connect to Docker daemon');
});
```

4. **Containers Without Labels**:
```typescript
it('should ignore unlabeled containers', async () => {
  const mockResult = {
    containers: [
      { id: '1', name: 'unlabeled', labels: {} },
      { id: '2', name: 'labeled', labels: { 'aisanity.branch': 'main', 'aisanity.workspace': '/proj' } }
    ],
    labeled: [/* only labeled container */],
    unlabeled: [/* unlabeled container */],
    orphaned: [],
    errors: []
  };
  
  jest.spyOn(containerUtils, 'discoverAllAisanityContainers')
    .mockResolvedValue(mockResult);
  
  const stopped = await captureStoppedContainers();
  
  expect(stopped).toHaveLength(1);
  expect(stopped[0]).toBe('labeled');
});
```

### Performance Tests

**Test File**: `tests/stop-performance.test.ts`

**Performance Benchmarks**:

1. **Discovery Performance**:
```typescript
it('should complete discovery within acceptable timeframe', async () => {
  const startTime = Date.now();
  
  await stopCommand.parseAsync(['stop'], { from: 'user' });
  
  const duration = Date.now() - startTime;
  expect(duration).toBeLessThan(5000); // 5 seconds max
});
```

2. **Batch Stop Performance**:
```typescript
it('should efficiently stop multiple containers', async () => {
  // Start 10 test containers
  const containers = await Promise.all(
    Array(10).fill(null).map(() => startTestContainer({
      labels: { 'aisanity.branch': 'main', 'aisanity.workspace': process.cwd() }
    }))
  );
  
  const startTime = Date.now();
  await stopCommand.parseAsync(['stop'], { from: 'user' });
  const duration = Date.now() - startTime;
  
  expect(duration).toBeLessThan(10000); // 10 seconds for 10 containers
});
```

### Test Coverage Targets

- **Line Coverage**: 95%+ for modified code
- **Branch Coverage**: 90%+ for all conditional logic
- **Integration Coverage**: All command modes tested with real Docker
- **Regression Coverage**: 100% of existing functionality verified

---

## Development Phases

### Phase 1: Core Discovery Integration (2-3 hours)

**Objective**: Replace legacy container name generation with modern discovery

**Tasks**:
1. ✓ Remove `getContainerName()` call (line 47)
2. ✓ Add `discoverAllAisanityContainers()` integration
3. ✓ Configure discovery options for workspace mode
4. ✓ Update function to async
5. ✓ Add basic error handling

**Deliverables**:
- Discovery-based container identification working
- Basic integration tests passing
- No compilation errors

**Code Changes**:
```typescript
// src/commands/stop.ts, lines 40-58

// OLD:
const containerName = getContainerName(cwd, options.verbose || false);
logger.info(`Stopping containers for workspace: ${workspaceName}`);
try {
  execSync(`docker stop ${containerName}`, { stdio: 'inherit' });
  logger.info(`Stopped container: ${containerName}`);
} catch (error) {
  logger.info(`Container ${containerName} not found or already stopped`);
}

// NEW:
logger.info(`Stopping containers for workspace: ${workspaceName}`);

try {
  const discoveryResult = await discoverAllAisanityContainers({
    mode: 'workspace',
    workspace: cwd,
    includeOrphaned: false,
    validationMode: 'strict',
    verbose: options.verbose,
    debug: options.debug
  });
  
  // TODO: Add branch filtering (Phase 2)
  // TODO: Add container stopping (Phase 2)
  
} catch (error) {
  logger.error('Failed to discover containers:', error);
  throw error;
}
```

**Validation**:
- Run `npm test tests/stop-*.test.ts`
- Verify no regressions in `--all-worktrees` behavior
- Manual test: `aisanity stop --verbose`

---

### Phase 2: Branch Filtering Implementation (2-3 hours)

**Objective**: Add branch-specific container filtering

**Tasks**:
1. ✓ Import `getCurrentBranch()` from config.ts
2. ✓ Implement branch filtering logic
3. ✓ Add verbose output for filtered results
4. ✓ Handle empty result set
5. ✓ Add unit tests for filtering

**Deliverables**:
- Branch filtering working correctly
- Verbose output shows filtering details
- Unit tests covering edge cases

**Code Changes**:
```typescript
// src/commands/stop.ts, after discovery

const currentBranch = getCurrentBranch(cwd);

// Filter by current branch
const branchContainers = discoveryResult.containers.filter(container => {
  const workspaceMatch = container.labels?.['aisanity.workspace'] === cwd;
  const branchMatch = container.labels?.['aisanity.branch'] === currentBranch;
  return workspaceMatch && branchMatch;
});

// Handle no containers found
if (branchContainers.length === 0) {
  logger.info(`No containers found for branch: ${currentBranch}`);
  
  if (options.verbose) {
    logger.verbose(`Searched workspace: ${cwd}`);
    logger.verbose(`Total containers discovered: ${discoveryResult.containers.length}`);
    logger.verbose(`Branch filter: ${currentBranch}`);
    
    if (discoveryResult.containers.length > 0) {
      logger.verbose('\nAvailable containers in workspace:');
      discoveryResult.containers.forEach(c => {
        logger.verbose(`  - ${c.name} (branch: ${c.labels['aisanity.branch'] || 'unknown'})`);
      });
    }
  }
  
  return;
}

logger.info(`Found ${branchContainers.length} container(s) for branch: ${currentBranch}`);

if (options.verbose) {
  branchContainers.forEach(container => {
    logger.verbose(`  - ${container.name} (${container.status})`);
  });
}
```

**Validation**:
- Run branch filtering unit tests
- Test with multiple branches manually
- Verify verbose output completeness

---

### Phase 3: Container Stopping Integration (1-2 hours)

**Objective**: Use existing `stopContainers()` utility for batch stopping

**Tasks**:
1. ✓ Extract container IDs from filtered results
2. ✓ Call `stopContainers()` with batch IDs
3. ✓ Add success logging
4. ✓ Verify error handling from stopContainers()

**Deliverables**:
- Containers successfully stopped
- Error handling for stop failures
- Success messages displayed

**Code Changes**:
```typescript
// src/commands/stop.ts, after filtering

// Stop discovered containers
logger.info(`Stopping ${branchContainers.length} container(s) for branch: ${currentBranch}`);

const containerIds = branchContainers.map(c => c.id);
await stopContainers(containerIds, options.verbose || false);

logger.info('All branch containers stopped successfully');
```

**Validation**:
- Run integration tests with real containers
- Verify batch stopping efficiency
- Test error scenarios (container already stopped, permission denied)

---

### Phase 4: Legacy Code Removal (1 hour)

**Objective**: Remove all fallback patterns and deprecated code

**Tasks**:
1. ✓ Delete devcontainer fallback logic (lines 59-75)
2. ✓ Delete workspace pattern fallback logic (lines 77-94)
3. ✓ Remove unused imports if any
4. ✓ Update code comments
5. ✓ Run regression tests

**Deliverables**:
- All legacy code removed
- Code cleaner and more maintainable
- No functional regressions

**Code to Delete**:
```typescript
// DELETE ENTIRELY: Lines 59-94

// Also try to stop any devcontainer-related containers for this workspace
try {
  const output = execSync(`docker ps --filter "label=devcontainer.local_folder=${cwd}" --format "{{.Names}}"`, {
    encoding: 'utf8'
  });
  const containers = output.trim().split('\n').filter(name => name.trim() !== '');
  for (const container of containers) {
    if (container) {
      execSync(`docker stop ${container}`, { stdio: 'inherit' });
      logger.info(`Stopped devcontainer: ${container}`);
    }
  }
} catch (error) {
  // No devcontainers found for this workspace, that's okay
}

// Also stop any containers with the specific workspace name pattern
try {
  const output = execSync(`docker ps --filter "name=aisanity-${workspaceName}" --filter "name=${workspaceName}-" --format "{{.Names}}"`, {
    encoding: 'utf8'
  });
  const containers = output.trim().split('\n').filter(name => name.trim() !== '');
  for (const container of containers) {
    if (container) {
      execSync(`docker stop ${container}`, { stdio: 'inherit' });
      logger.info(`Stopped aisanity container: ${container}`);
    }
  }
} catch (error) {
  // No aisanity containers found for this workspace, that's okay
}
```

**Validation**:
- Run full test suite
- Verify regression tests pass
- Manual testing of all command modes

---

### Phase 5: Enhanced Error Messaging (1-2 hours)

**Objective**: Improve user feedback for all scenarios

**Tasks**:
1. ✓ Add branch-specific "no containers" message
2. ✓ Enhance verbose output for discovery results
3. ✓ Add debug output for filtering process
4. ✓ Improve Docker daemon error messages
5. ✓ Add discovery timing information

**Deliverables**:
- Clear, actionable error messages
- Comprehensive verbose output
- Debug information for troubleshooting

**Code Changes**:
```typescript
// Enhanced no containers message (already shown in Phase 2)

// Enhanced discovery error handling
catch (error) {
  logger.error('Failed to discover containers');
  
  if (error.message.includes('Cannot connect')) {
    logger.error('Docker daemon is not running. Please start Docker and try again.');
  } else if (error.message.includes('permission denied')) {
    logger.error('Permission denied accessing Docker. Try running with sudo or check Docker permissions.');
  } else {
    logger.error('Error:', error.message);
  }
  
  if (options.debug) {
    logger.debug('Discovery configuration:', {
      mode: 'workspace',
      workspace: cwd,
      includeOrphaned: false,
      validationMode: 'strict'
    });
    logger.debug('Full error:', error);
  }
  
  throw error;
}
```

**Validation**:
- Test all error scenarios
- Verify message clarity with users
- Check verbose/debug output completeness

---

### Phase 6: Testing and Documentation (2-3 hours)

**Objective**: Comprehensive testing and documentation updates

**Tasks**:
1. ✓ Write unit tests for all new functions
2. ✓ Write integration tests for Docker scenarios
3. ✓ Write regression tests for existing functionality
4. ✓ Update command documentation
5. ✓ Add inline code comments
6. ✓ Update CHANGELOG.md

**Deliverables**:
- 95%+ test coverage
- All tests passing
- Documentation complete
- Ready for PR review

**Test Files to Create/Update**:
- `tests/stop-branch-filtering.test.ts` (new)
- `tests/stop-command-integration.test.ts` (update)
- `tests/stop-command-regression.test.ts` (new)
- `tests/stop-command-edge-cases.test.ts` (new)

**Documentation Updates**:
```markdown
# CHANGELOG.md

## [Unreleased]

### Changed
- **BREAKING**: `aisanity stop` now only stops containers for the current branch
- Default stop behavior uses label-based discovery instead of container name generation

### Removed
- **BREAKING**: Legacy fallback patterns for devcontainer and workspace name discovery
- Support for unlabeled containers created before v1.0.0

### Fixed
- Stop command no longer shows "No such container" errors for valid scenarios
- Container discovery now consistent across all commands
```

**Validation**:
- Run full test suite: `npm test`
- Run specific stop tests: `npm test tests/stop-*.test.ts`
- Manual testing of all scenarios
- Code review checklist complete

---

## Implementation Checklist

### Pre-Implementation
- [ ] Review architectural guidelines in `.plan/arch_210-fix-stop-command-container-discovery.md`
- [ ] Review unified discovery architecture in `.plan/arch_170-fix-container-discovery-inconsistency.md`
- [ ] Understand existing `discoverAllAisanityContainers()` function
- [ ] Review existing test patterns for reference

### Phase 1: Core Discovery Integration
- [ ] Remove `getContainerName()` call
- [ ] Add `discoverAllAisanityContainers()` integration
- [ ] Configure workspace mode discovery options
- [ ] Update function to async
- [ ] Add basic error handling
- [ ] Verify compilation succeeds

### Phase 2: Branch Filtering Implementation
- [ ] Import `getCurrentBranch()` from config.ts
- [ ] Implement `filterContainersByBranch()` logic
- [ ] Add empty result handling
- [ ] Add verbose output for filtering
- [ ] Write unit tests for filtering
- [ ] Verify filter accuracy

### Phase 3: Container Stopping Integration
- [ ] Extract container IDs from filtered results
- [ ] Call `stopContainers()` utility
- [ ] Add success logging
- [ ] Verify error handling
- [ ] Test with real containers

### Phase 4: Legacy Code Removal
- [ ] Delete devcontainer fallback (lines 59-75)
- [ ] Delete workspace pattern fallback (lines 77-94)
- [ ] Remove unused imports
- [ ] Update comments
- [ ] Run regression tests

### Phase 5: Enhanced Error Messaging
- [ ] Add "No containers found for branch" message
- [ ] Enhance verbose discovery output
- [ ] Add debug filtering output
- [ ] Improve Docker daemon errors
- [ ] Add timing information (optional)

### Phase 6: Testing and Documentation
- [ ] Write unit tests (95%+ coverage)
- [ ] Write integration tests
- [ ] Write regression tests
- [ ] Write edge case tests
- [ ] Update CHANGELOG.md
- [ ] Add inline comments
- [ ] Review all tests pass

### Post-Implementation
- [ ] Manual testing: default stop
- [ ] Manual testing: --worktree option
- [ ] Manual testing: --all-worktrees option
- [ ] Manual testing: --verbose output
- [ ] Manual testing: --debug output
- [ ] Code review preparation
- [ ] PR submission

---

## Risk Mitigation

### High-Risk Areas

**1. Breaking Changes to Default Behavior**
- **Risk**: Users expect old behavior, may be surprised by branch-specific stopping
- **Mitigation**: 
  - Clear error messages explaining what changed
  - Comprehensive CHANGELOG entry
  - Version bump to indicate breaking change
  - Consider adding temporary warning message

**2. Async Function Conversion**
- **Risk**: Changing sync to async may affect error handling
- **Mitigation**:
  - Thorough testing of error scenarios
  - Ensure Promise rejections are caught
  - Verify error messages still displayed
  - Test exit codes remain correct

**3. Discovery Performance**
- **Risk**: Label-based discovery may be slower than direct name lookup
- **Mitigation**:
  - Leverage existing discovery caching
  - Monitor performance benchmarks
  - Optimize if needed (parallel operations)
  - Set performance regression tests

**4. Edge Case Coverage**
- **Risk**: Missing edge cases may cause production issues
- **Mitigation**:
  - Comprehensive edge case testing
  - Manual testing of failure scenarios
  - Validation with real multi-branch workflows
  - Beta testing period if possible

### Rollback Plan

**If Issues Arise**:
1. Revert commit restoring old implementation
2. Create hotfix branch from previous stable version
3. Document issues encountered
4. Plan alternative approach
5. Re-implement with additional safeguards

**Rollback Criteria**:
- Discovery failures > 5% of operations
- Performance degradation > 2x slower
- Critical bugs in production
- User feedback indicates major workflow disruption

---

## Success Criteria

### Functional Requirements Met
- ✓ Default stop uses `discoverAllAisanityContainers()`
- ✓ Branch filtering implemented correctly
- ✓ Legacy fallback code removed
- ✓ Clear error messages for all scenarios
- ✓ `--worktree` and `--all-worktrees` options preserved

### Quality Metrics Achieved
- ✓ Test coverage ≥ 95% for modified code
- ✓ All unit tests passing
- ✓ All integration tests passing
- ✓ All regression tests passing
- ✓ Performance within acceptable bounds (<5s for discovery)

### User Experience Improvements
- ✓ No more "No such container" errors for valid scenarios
- ✓ Clear feedback when no containers exist for branch
- ✓ Informative verbose output showing discovery details
- ✓ Consistent behavior across all commands

### Architectural Alignment
- ✓ Follows unified container discovery architecture
- ✓ Uses label-based discovery exclusively
- ✓ No legacy naming pattern compatibility
- ✓ Consistent with other command implementations

### Documentation Complete
- ✓ CHANGELOG.md updated with breaking changes
- ✓ Inline code comments added
- ✓ Test files documented
- ✓ Implementation plan completed

---

## References

### Related Documentation
- `.plan/arch_210-fix-stop-command-container-discovery.md` - Architectural analysis
- `.plan/arch_170-fix-container-discovery-inconsistency.md` - Unified discovery architecture
- `.plan/arch_200-remove-deprecated-methods-fallbacks.md` - Deprecation context
- `.task/210-fix-stop-command-container-discovery.md` - Original task specification

### Key Functions
- `discoverAllAisanityContainers()` - `src/utils/container-utils.ts:663`
- `getCurrentBranch()` - `src/utils/config.ts:32`
- `stopContainers()` - `src/utils/container-utils.ts` (existing utility)
- `createLoggerFromCommandOptions()` - `src/utils/logger.ts`

### Test References
- `tests/status-workspace-display.integration.test.ts` - Discovery integration patterns
- `tests/container-discovery-unified.test.ts` - Discovery testing patterns
- `tests/command-discovery-consistency.test.ts` - Cross-command consistency tests

### Container Label Schema
```typescript
{
  'aisanity.workspace': string,  // Absolute path to workspace
  'aisanity.branch': string,     // Git branch name
  'aisanity.container': string,  // Container name
  'aisanity.created': string,    // ISO timestamp
  'aisanity.version': string     // Aisanity version
}
```
