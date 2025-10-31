# Implementation Plan: Fix Container Status Detection

## Implementation Overview

This implementation plan addresses the critical issues with container status detection in the `aisanity status` command. The focus is on replacing unreliable Docker command execution, enhancing container discovery, and improving error handling while maintaining backward compatibility.

### Key Implementation Goals
1. Replace Bun template literals with reliable Node.js execSync
2. Centralize Docker interactions in container-utils.ts
3. Implement multi-tier container discovery strategy
4. Add comprehensive error handling and verbose logging
5. Fix container-to-worktree mapping for all running containers

## Component Details

### 1. Enhanced Container Utilities (`src/utils/container-utils.ts`)

#### New Functions to Add:

```typescript
// Centralized Docker command execution with proper error handling
async function executeDockerCommand(command: string, options?: {
  silent?: boolean;
  timeout?: number;
}): Promise<{ stdout: string; stderr: string; success: boolean }>

// Multi-tier container discovery for current workspace
async function discoverWorkspaceContainers(workspaceId: string): Promise<Container[]>

// Reliable container status querying
async function getContainerStatus(containerId: string): Promise<{
  status: 'Running' | 'Stopped' | 'Not created';
  ports: string[];
  error?: string;
}>

// Enhanced container information retrieval
async function getContainerInfo(containerId: string): Promise<{
  id: string;
  name: string;
  status: string;
  ports: string[];
  labels: Record<string, string>;
  workspaceId?: string;
  branchName?: string;
}>
```

#### Modifications to Existing Functions:
- Update `discoverContainers` to support workspace filtering while maintaining backward compatibility
- Enhance error handling in existing Docker interactions without breaking current API
- Add verbose logging capabilities that integrate with existing logger.ts
- Ensure existing tests continue to pass by maintaining function signatures where possible

### 2. Status Command Refactoring (`src/commands/status.ts`)

#### Key Changes:
- Remove direct Docker command execution from `getContainerStatusWithPorts`
- Replace with calls to enhanced container utilities
- Add verbose mode support for debugging
- Improve error handling and user feedback

#### Function Signature Updates:
```typescript
// Before (problematic)
async function getContainerStatusWithPorts(containerName: string, verbose: boolean): Promise<string>

// After (improved)
async function getContainerStatusWithPorts(containerId: string, options?: {
  verbose?: boolean;
  includePorts?: boolean;
}): Promise<{
  status: string;
  ports: string[];
  details?: any;
}>
```

### 3. Worktree Mapping Enhancement (`src/utils/worktree-utils.ts`)

#### New Functions:
```typescript
// Enhanced container-to-worktree mapping
async function mapContainersToWorktrees(containers: Container[]): Promise<{
  mapped: Array<{ container: Container; worktree: WorktreeInfo }>;
  unmapped: Container[];
}>

// Branch name extraction from container labels/names
function extractBranchName(container: Container): string | null

// Worktree discovery with fallback strategies
async function findWorktreeForBranch(branchName: string): Promise<WorktreeInfo | null>
```

## Data Structures

### Container Interface Enhancement
```typescript
interface Container {
  id: string;
  name: string;
  status: 'Running' | 'Stopped' | 'Not created';
  ports: string[];
  labels: Record<string, string>;
  workspaceId?: string;
  branchName?: string;
  createdAt?: Date;
  lastAccessed?: Date;
}
```

### Status Display Structure
```typescript
interface StatusDisplay {
  worktree: string;
  branch: string;
  container: string;
  status: string;
  ports: string[];
  lastAccessed?: string;
  issues?: string[];
}
```

### Error Information Structure
```typescript
interface DockerCommandError {
  command: string;
  exitCode: number;
  stderr: string;
  context: string;
  timestamp: Date;
}
```

## API Design

### Container Discovery API
```typescript
class ContainerDiscovery {
  async discoverWorkspaceContainers(workspaceId: string): Promise<Container[]>
  async getContainerStatus(containerId: string): Promise<ContainerStatus>
  async getContainerInfo(containerId: string): Promise<ContainerInfo>
  async mapToWorktrees(containers: Container[]): Promise<ContainerMapping>
}
```

### Status Command API
```typescript
interface StatusCommandOptions {
  verbose?: boolean;
  includeUnmapped?: boolean;
  sortBy?: 'name' | 'status' | 'branch';
  filterBy?: 'running' | 'stopped' | 'all';
}

async function executeStatusCommand(options: StatusCommandOptions): Promise<{
  summary: StatusSummary;
  containers: StatusDisplay[];
  errors: DockerCommandError[];
}>
```

## Testing Strategy

### Unit Tests

#### Container Utilities Tests
```typescript
// Test Docker command execution
describe('executeDockerCommand', () => {
  it('should execute successful Docker commands')
  it('should handle Docker command failures gracefully')
  it('should timeout long-running commands')
  it('should log verbose output when requested')
})

// Test container discovery
describe('discoverWorkspaceContainers', () => {
  it('should find containers with workspace labels')
  it('should fallback to name-based discovery')
  it('should handle missing Docker daemon')
  it('should filter by workspace ID correctly')
})

// Test status querying
describe('getContainerStatus', () => {
  it('should return correct status for running containers')
  it('should return correct status for stopped containers')
  it('should handle non-existent containers')
  it('should parse port information correctly')
})
```

#### Status Command Tests
```typescript
describe('status command', () => {
  it('should display all running containers with correct status')
  it('should handle containers without worktrees')
  it('should show verbose output when requested')
  it('should provide accurate summary statistics')
})
```

### Integration Tests

#### End-to-End Scenarios
```typescript
describe('container status detection integration', () => {
  it('should detect all 5 running containers in workspace')
  it('should map containers to correct worktrees')
  it('should handle mixed container states')
  it('should provide accurate status summary')
})
```

### Mock Data for Testing
```typescript
const mockContainers = [
  {
    id: 'abc123',
    name: 'dazzling_chandrasekhar',
    status: 'Running',
    ports: ['3000:3000'],
    labels: {
      'aisanity.workspace': 'test-workspace',
      'aisanity.branch': 'main'
    },
    expectedWorktree: 'aisanity-main'
  },
  {
    id: 'def456',
    name: 'priceless_goodall',
    status: 'Running',
    ports: ['3001:3000'],
    labels: {
      'aisanity.workspace': 'test-workspace',
      'aisanity.branch': 'feature/100-fsm'
    },
    expectedWorktree: 'aisanity-feature-100-fsm'
  },
  {
    id: 'ghi789',
    name: 'beautiful_poitras',
    status: 'Running',
    ports: ['3002:3000'],
    labels: {
      'aisanity.workspace': 'test-workspace',
      'aisanity.branch': 'feature/100_4_20'
    },
    expectedWorktree: 'aisanity-feature-100-4-20'
  },
  {
    id: 'jkl012',
    name: 'busy_bell',
    status: 'Running',
    ports: ['3003:3000'],
    labels: {
      'aisanity.workspace': 'test-workspace',
      'aisanity.branch': 'feature/100_4_10'
    },
    expectedWorktree: 'aisanity-feature-100-4-10'
  },
  {
    id: 'mno345',
    name: 'fifth_container',
    status: 'Running',
    ports: ['3004:3000'],
    labels: {
      'aisanity.workspace': 'test-workspace',
      'aisanity.branch': 'another-branch'
    },
    expectedWorktree: 'aisanity-another-branch'
  }
]
```

## Development Phases

### Phase 1: Core Infrastructure (Priority: High)
**Duration: 2-3 days**

#### Tasks:
1. **Replace Bun Template Literals**
   - Update `getContainerStatusWithPorts` function
   - Implement `executeDockerCommand` with execSync
   - Add proper error handling and logging

2. **Centralize Docker Interactions**
   - Move Docker command execution to container-utils.ts
   - Update all direct Docker calls in status.ts
   - Implement consistent error handling

3. **Basic Testing**
   - Create unit tests for new functions
   - Test with mock Docker outputs
   - Verify no regressions in existing functionality

#### Deliverables:
- Working Docker command execution
- Basic error handling
- Unit test coverage for core functions

### Phase 2: Enhanced Discovery (Priority: High)
**Duration: 2-3 days**

#### Tasks:
1. **Implement Multi-tier Discovery**
   - Add `discoverWorkspaceContainers` function
   - Implement label-based discovery (primary)
   - Add name-based fallback (secondary)
   - Implement Docker API fallback (tertiary)

2. **Improve Worktree Mapping**
   - Enhance container-to-worktree mapping logic
   - Add branch name extraction from labels/names
   - Handle orphaned containers gracefully

3. **Add Verbose Logging**
   - Implement verbose mode for debugging
   - Log Docker command execution details
   - Add timing information for performance analysis

#### Deliverables:
- Complete container discovery system
- Improved worktree mapping
- Verbose logging functionality

### Phase 3: Status Display Enhancement (Priority: Medium)
**Duration: 1-2 days**

#### Tasks:
1. **Update Status Table Display**
   - Show all detected containers
   - Display correct status information
   - Add indicators for unmapped containers

2. **Improve Summary Statistics**
   - Calculate accurate running/stopped counts
   - Include unmapped containers in summary
   - Add performance metrics

3. **Error Display Enhancement**
   - Show diagnostic information for failures
   - Add suggestions for common issues
   - Implement user-friendly error messages

#### Deliverables:
- Complete status display functionality
- Accurate summary statistics
- Enhanced error reporting

### Phase 4: Performance and Polish (Priority: Low)
**Duration: 1-2 days**

#### Tasks:
1. **Performance Optimization**
   - Implement container status caching
   - Batch Docker operations where possible
   - Optimize discovery algorithms

2. **Edge Case Handling**
   - Handle Docker daemon unavailability
   - Manage network connectivity issues
   - Deal with corrupted container metadata

3. **Documentation and Testing**
   - Add comprehensive integration tests
   - Update documentation for new features
   - Performance benchmarking

#### Deliverables:
- Optimized performance
- Comprehensive edge case handling
- Complete test coverage

## Risk Mitigation

### Technical Risks
1. **Docker API Compatibility**: Test with multiple Docker versions
2. **Performance Impact**: Implement caching and batch operations
3. **Backward Compatibility**: Maintain existing output format

### Implementation Risks
1. **Complex Container Discovery**: Start with simple approach, enhance iteratively
2. **Worktree Mapping Complexity**: Implement fallback strategies
3. **Error Handling Overhead**: Balance detail with usability

### Testing Risks
1. **Mock Data Accuracy**: Use real container data for test validation
2. **Integration Test Coverage**: Test with actual Docker environment
3. **Performance Regression**: Benchmark against current implementation

## Specific Container Handling Requirements

### Target Containers (from Problem Statement)
The implementation must specifically handle these 5 containers:
1. **dazzling_chandrasekhar** → `aisanity-main` (main branch) - currently shows "Unknown"
2. **priceless_goodall** → `aisanity-feature-100-fsm` (feature/100-fsm) - currently missing
3. **beautiful_poitras** → `aisanity-feature-100-4-20` (feature/100_4_20) - currently missing  
4. **busy_bell** → `aisanity-feature-100-4-10` (feature/100_4_10) - currently missing
5. **fifth_container** → additional running container (if exists)

### Integration with Existing Codebase

#### Backward Compatibility Strategy
- Maintain existing status command output format exactly
- Preserve all current command-line options and flags
- Ensure existing configuration files continue to work
- Keep current error message formats where possible

#### Existing Function Integration
```typescript
// Integration with existing discoverContainers function
async function discoverContainers(options?: {
  workspaceId?: string;
  includeStopped?: boolean;
}): Promise<Container[]> {
  // Enhanced implementation that maintains backward compatibility
  // New workspace filtering is optional, defaults to current behavior
}

// Enhanced getContainerStatusWithPorts maintains existing signature
async function getContainerStatusWithPorts(
  containerName: string, 
  verbose: boolean = false
): Promise<string> {
  // New implementation using centralized Docker utilities
  // Returns same string format as before for compatibility
}
```

#### Test Compatibility
- All existing tests in `tests/container-utils.test.ts` must continue to pass
- Existing status command tests should work without modification
- New tests should be additive, not replacing existing ones

## Performance Benchmarking Criteria

### Performance Targets
- **Status Command Completion**: < 3 seconds for up to 10 containers
- **Container Discovery**: < 1 second for workspace filtering
- **Status Query**: < 500ms per container
- **Memory Usage**: < 50MB increase over current implementation

### Benchmarking Approach
```typescript
// Performance measurement functions
async function benchmarkContainerDiscovery(containerCount: number): Promise<{
  totalTime: number;
  averageTimePerContainer: number;
  memoryUsage: number;
}>

async function benchmarkStatusCommand(): Promise<{
  executionTime: number;
  dockerCallsCount: number;
  cacheHitRate: number;
}>
```

## Success Criteria

### Functional Requirements
- [ ] All 5 specific running containers are detected and displayed with correct status
- [ ] Container status shows "Running" instead of "Unknown" for all containers
- [ ] Docker command errors are properly logged with diagnostic information
- [ ] Verbose mode shows Docker command execution details and timing
- [ ] Summary statistics show accurate counts (e.g., "5 running, 0 stopped")
- [ ] Container-to-worktree mapping works for complex branch names like "feature/100_4_20"

### Integration Requirements
- [ ] All existing tests pass without modification
- [ ] Backward compatibility maintained for status output format
- [ ] Existing configuration and logging systems work unchanged
- [ ] No breaking changes to public APIs

### Non-Functional Requirements
- [ ] Status command completes within 3 seconds for 5+ containers
- [ ] No regressions in existing functionality
- [ ] Error messages are clear and actionable with suggestions
- [ ] Code follows existing patterns and conventions from codebase

### Quality Requirements
- [ ] Unit test coverage > 90% for new functions
- [ ] Integration tests pass consistently with real Docker environment
- [ ] No performance degradation compared to current implementation
- [ ] Code review approval from team following existing patterns

This implementation plan provides a structured approach to fixing the container status detection issues while ensuring reliability, performance, and maintainability.