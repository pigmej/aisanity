# Implementation Plan: Fix Test Mocking Issues After Bun Migration

**Task ID:** 30  
**Parent Feature ID:** 20 (bun-migration-plan)  
**Created:** 2025-10-06  
**Status:** Implementation Planning Complete

---

## Table of Contents

1. [Implementation Overview](#implementation-overview)
2. [Integration Strategy](#integration-strategy)
3. [Component Details](#component-details)
4. [Data Structures](#data-structures)
5. [API Design](#api-design)
6. [User Interaction Flow](#user-interaction-flow)
7. [Testing Strategy](#testing-strategy)
8. [Development Phases](#development-phases)
9. [Dependencies](#dependencies)

---

## Implementation Overview

This implementation plan addresses the critical misalignment between test mocking strategies and the actual runtime architecture established in Task 20. The core issue is that tests mock Node.js `child_process` modules while the implementation uses the runtime abstraction layer from `runtime-utils.ts`.

### Core Problem
- **Tests mock**: `child_process.spawn`, `child_process.execSync` (Node.js native modules)
- **Code calls**: `safeSpawn`, `safeExecSyncSync`, `safeExecSync` (runtime-utils abstraction layer)

### Solution Approach
1. **Mock the Abstraction Layer**: All tests must mock `runtime-utils.ts` functions, not the underlying implementation
2. **Create Test Utilities**: Establish reusable mocking patterns for consistent test development
3. **Systematic Migration**: Update all test files to use correct mocking strategy
4. **Validation Framework**: Ensure tests work in both Bun and Node.js environments

### Key Principles
- **IMPORTANT**: Mock the abstraction layer, not implementation details
- **IMPORTANT**: Maintain runtime-agnostic testing patterns
- **IMPORTANT**: Preserve existing test coverage and functionality
- **IMPORTANT**: Leverage Task 20's runtime abstraction layer investment

---

## Integration Strategy

### Integration with Task 20 (Bun Migration)

#### Critical Runtime Abstraction Layer Integration
The implementation must integrate directly with the runtime abstraction layer established in Task 20:

**Core Integration Points:**
- **`src/utils/runtime-utils.ts`**: Central abstraction layer that ALL tests must mock
- **`safeSpawn` function**: Replaces `child_process.spawn` across all source code
- **`safeExecSyncSync` function**: Replaces `child_process.execSync` across all source code  
- **`safeExecSync` function**: Async version for shell command execution
- **`isBunRuntime()` function**: Runtime detection utility

#### Docker Integration Architecture Integration
- **`src/utils/docker-safe-exec.ts`**: Enhanced Docker execution with Bun.spawn
- **`safeDockerExec` function**: Docker-specific abstraction that tests must mock directly
- **Error handling patterns**: `DockerExecError`, `DockerTimeoutError` with runtime context

#### Commander.js CLI Framework Integration
- **CLI command structure**: Unchanged, fully compatible with Bun
- **Command registration patterns**: Worktree commands, status commands, etc.
- **Process exit handling**: Consistent across all commands

### Data Flow Integration

#### Runtime Detection Flow
```
Source Code → runtime-utils.ts → isBunRuntime() → Bun.spawn OR child_process.spawn
     ↓
Tests Should Mock → runtime-utils.ts functions (NOT the underlying implementation)
```

#### Process Execution Flow
```
Command Implementation → safeSpawn/safeExecSyncSync → Runtime Abstraction → Actual Execution
     ↓
Tests Should Mock → safeSpawn/safeExecSyncSync (NOT child_process)
```

### Integration Testing Requirements

#### Verify Runtime Abstraction Integration
- Test that `safeSpawn` mocks work correctly for both Bun and Node.js paths
- Verify `safeExecSyncSync` mocks handle synchronous execution properly
- Ensure `isBunRuntime()` mocking works for runtime detection tests

#### Verify Docker Integration
- Test `safeDockerExec` mocking works with enhanced error handling
- Verify timeout handling with `AbortController` patterns
- Ensure runtime context is preserved in error objects

#### Verify CLI Command Integration
- Test command registration works with proper mocking
- Verify process exit handling works with mocked runtime utilities
- Ensure worktree commands properly integrate with runtime abstraction

---

## Component Details

### 1. Test Utilities Framework

#### Component: `tests/helpers/runtime-mocks.ts`
**Purpose**: Centralized mocking utilities for runtime abstraction layer
**Responsibilities**:
- Provide standardized mock setup/teardown
- Create consistent mock return value patterns
- Handle runtime-agnostic testing scenarios

**Key Functions:**
```typescript
export interface RuntimeMocks {
  safeSpawn: any;
  safeExecSyncSync: any;
  safeExecSync: any;
  isBunRuntime: any;
}

export function createRuntimeMocks(): RuntimeMocks
export function setupDefaultRuntimeMocks(): RuntimeMocks
export function createMockSpawnResult(exitCode?: number): any
export function createMockExecOutput(command: string): string
```

### 2. Test File Migration Components

#### Component: `tests/devcontainer-name-compatibility.test.ts`
**Changes Required:**
- Remove `import { spawn } from 'child_process'`
- Add `import { safeSpawn } from '../src/utils/runtime-utils'`
- Replace `mockSpawn = spyOn({ spawn }, 'spawn')` with `mockSpawn = spyOn({ safeSpawn }, 'safeSpawn')`
- Update all spawn-related test expectations

**Before/After Code Example:**
```typescript
// BEFORE (WRONG)
import { spawn } from 'child_process';
// ...
mockSpawn = spyOn({ spawn }, 'spawn').mockReturnValue({} as any);

// AFTER (CORRECT)
import { safeSpawn } from '../src/utils/runtime-utils';
// ...
mockSafeSpawn = spyOn({ safeSpawn }, 'safeSpawn').mockReturnValue({
  on: (event: string, callback: Function) => {
    if (event === 'close') callback(0);
  },
  stdout: { on: () => {} },
  stderr: { on: () => {} }
} as any);
```

#### Component: `tests/status.test.ts`
**Changes Required:**
- Remove `import { execSync } from 'child_process'`
- Add `import { safeExecSyncSync } from '../src/utils/runtime-utils'`
- Replace `mockExecSync = spyOn({ execSync }, 'execSync')` with `mockSafeExecSyncSync = spyOn({ safeExecSyncSync }, 'safeExecSyncSync')`
- Update all execSync-related test expectations

**Before/After Code Example:**
```typescript
// BEFORE (WRONG)
import { execSync } from 'child_process';
// ...
mockExecSync = spyOn({ execSync }, 'execSync').mockReturnValue('' as any);

// AFTER (CORRECT)
import { safeExecSyncSync } from '../src/utils/runtime-utils';
// ...
mockSafeExecSyncSync = spyOn({ safeExecSyncSync }, 'safeExecSyncSync').mockReturnValue('git status output');
```

#### Component: `tests/worktree-remove.test.ts`
**Changes Required:**
- Remove `import { spawn, execSync } from 'child_process'`
- Add `import { safeSpawn, safeExecSyncSync } from '../src/utils/runtime-utils'`
- Replace both mock patterns with runtime-utils equivalents
- Update all related test expectations

**Before/After Code Example:**
```typescript
// BEFORE (WRONG)
import { spawn, execSync } from 'child_process';
// ...
mockSpawn = spyOn({ spawn }, 'spawn').mockReturnValue({
  on: (event: string, callback: (code: number) => void) => {
    if (event === 'close') callback(0);
  },
  stdout: { on: () => {} },
  stderr: { on: () => {} }
} as any);
mockExecSync = spyOn({ execSync }, 'execSync').mockReturnValue('' as any);

// AFTER (CORRECT)
import { safeSpawn, safeExecSyncSync } from '../src/utils/runtime-utils';
// ...
mockSafeSpawn = spyOn({ safeSpawn }, 'safeSpawn').mockReturnValue({
  on: (event: string, callback: Function) => {
    if (event === 'close') callback(0);
  },
  stdout: { on: () => {} },
  stderr: { on: () => {} }
} as any);
mockSafeExecSyncSync = spyOn({ safeExecSyncSync }, 'safeExecSyncSync').mockReturnValue('git worktree list output');
```

#### Component: `tests/worktree-check.test.ts`
**Enhancement Required:**
- Fix worktree check subcommand registration testing
- Ensure proper CLI command structure validation
- Add runtime-utils mocking for any process operations

**Before/After Code Example:**
```typescript
// BEFORE (MISSING RUNTIME MOCKS)
// Only tests command registration, no runtime mocking

// AFTER (CORRECT)
import { safeSpawn, safeExecSyncSync } from '../src/utils/runtime-utils';
// ...
beforeEach(() => {
  // Add runtime mocks for any git operations
  mockSafeSpawn = spyOn({ safeSpawn }, 'safeSpawn').mockReturnValue({
    on: (event: string, callback: Function) => {
      if (event === 'close') callback(0);
    },
    stdout: { on: () => {} },
    stderr: { on: () => {} }
  } as any);
  mockSafeExecSyncSync = spyOn({ safeExecSyncSync }, 'safeExecSyncSync').mockReturnValue('git worktree list');
});
```

### 3. Mock Pattern Components

#### Component: Mock Return Value Patterns
**Purpose**: Standardized mock return values that match runtime behavior

**SafeSpawn Mock Pattern:**
```typescript
const mockSpawnResult = {
  on: (event: string, callback: (code: number) => void) => {
    if (event === 'close') callback(0); // Success exit code
    if (event === 'error') callback(1); // Error exit code
  },
  stdout: { 
    on: (event: string, callback: (data: any) => void) => {
      if (event === 'data') callback('mocked stdout');
    }
  },
  stderr: { 
    on: (event: string, callback: (data: any) => void) => {
      if (event === 'data') callback('mocked stderr');
    }
  }
};
```

**SafeExecSyncSync Mock Pattern:**
```typescript
const mockExecOutput = 'git branch output\n* main\n  feature-branch';
// For success cases
mockSafeExecSyncSync.mockReturnValue(mockExecOutput);
// For error cases
mockSafeExecSyncSync.mockImplementation(() => {
  throw new Error('Command failed');
});
```

**SafeDockerExec Mock Pattern:**
```typescript
// For success cases
mockSafeDockerExec = spyOn({ safeDockerExec }, 'safeDockerExec').mockResolvedValue('container-id-123');

// For error cases
mockSafeDockerExec.mockRejectedValue(new DockerExecError('Docker not available', 1, 'docker: command not found', 'bun'));

// For timeout cases
mockSafeDockerExec.mockRejectedValue(new DockerTimeoutError(10000));

// For multiple container results
mockSafeDockerExec.mockResolvedValue('container-id-123\ncontainer-id-456\ncontainer-id-789');
```

#### Component: Docker Error Type Mocking
**Purpose**: Proper mocking patterns for DockerExecError and DockerTimeoutError from docker-safe-exec.ts

**Docker Error Mock Patterns:**
```typescript
import { DockerExecError, DockerTimeoutError } from '../src/utils/docker-safe-exec';

// Mock DockerExecError with full context
const createMockDockerExecError = (message: string, code: number, stderr: string, runtime: 'bun' | 'node') => {
  return new DockerExecError(message, code, stderr, runtime);
};

// Mock DockerTimeoutError with timeout context
const createMockDockerTimeoutError = (timeout: number) => {
  return new DockerTimeoutError(timeout);
};

// Usage in tests
mockSafeDockerExec.mockRejectedValue(
  createMockDockerExecError('Docker command failed', 127, 'docker: command not found', 'bun')
);

mockSafeDockerExec.mockRejectedValue(createMockDockerTimeoutError(5000));
```

**Docker Error Test Scenarios:**
```typescript
// Test Docker not available scenario
test('should handle Docker not available', async () => {
  mockSafeDockerExec.mockRejectedValue(
    new DockerExecError('Docker command failed', 127, 'docker: command not found', 'bun')
  );
  
  await expect(someDockerFunction()).rejects.toThrow(DockerExecError);
  expect(mockSafeDockerExec).toHaveBeenCalled();
});

// Test Docker timeout scenario
test('should handle Docker timeout', async () => {
  mockSafeDockerExec.mockRejectedValue(new DockerTimeoutError(10000));
  
  await expect(someDockerFunction()).rejects.toThrow(DockerTimeoutError);
});

// Test Docker permission denied scenario
test('should handle Docker permission denied', async () => {
  mockSafeDockerExec.mockRejectedValue(
    new DockerExecError('Permission denied', 1, 'permission denied while trying to connect', 'node')
  );
  
  await expect(someDockerFunction()).rejects.toThrow(DockerExecError);
});
```

#### Component: Runtime Detection Testing
**Purpose**: Strategy for testing the isBunRuntime() function itself

**Runtime Detection Mock Patterns:**
```typescript
import { isBunRuntime, getRuntimeInfo } from '../src/utils/runtime-utils';

// Test isBunRuntime function directly
test('should detect Bun runtime correctly', () => {
  // Mock globalThis to simulate Bun environment
  const originalGlobalThis = globalThis;
  (globalThis as any).Bun = { version: '1.2.0' };
  
  expect(isBunRuntime()).toBe(true);
  
  // Restore original globalThis
  globalThis = originalGlobalThis;
});

test('should detect Node.js runtime correctly', () => {
  // Mock globalThis to simulate Node.js environment
  const originalGlobalThis = globalThis;
  const { Bun, ...rest } = globalThis as any;
  globalThis = rest;
  
  expect(isBunRuntime()).toBe(false);
  
  // Restore original globalThis
  globalThis = originalGlobalThis;
});

// Test getRuntimeInfo function
test('should return correct runtime info for Bun', () => {
  const mockBun = { version: '1.2.0' };
  const originalGlobalThis = globalThis;
  (globalThis as any).Bun = mockBun;
  
  const runtimeInfo = getRuntimeInfo();
  expect(runtimeInfo.runtime).toBe('bun');
  expect(runtimeInfo.version).toBe('1.2.0');
  expect(runtimeInfo.features.nativeTypeScript).toBe(true);
  expect(runtimeInfo.features.enhancedSpawn).toBe(true);
  expect(runtimeInfo.features.shellHelper).toBe(true);
  
  globalThis = originalGlobalThis;
});

test('should return correct runtime info for Node.js', () => {
  const originalGlobalThis = globalThis;
  const { Bun, ...rest } = globalThis as any;
  globalThis = rest;
  
  const runtimeInfo = getRuntimeInfo();
  expect(runtimeInfo.runtime).toBe('node');
  expect(runtimeInfo.version).toBe(process.version);
  expect(runtimeInfo.features.nativeTypeScript).toBe(false);
  expect(runtimeInfo.features.enhancedSpawn).toBe(false);
  expect(runtimeInfo.features.shellHelper).toBe(false);
  
  globalThis = originalGlobalThis;
});
```

**Runtime Detection Test Utilities:**
```typescript
// tests/helpers/runtime-detection-mocks.ts
export function setupBunRuntimeMock(version: string = '1.2.0') {
  const originalGlobalThis = globalThis;
  (globalThis as any).Bun = { version };
  
  return {
    restore: () => {
      globalThis = originalGlobalThis;
    }
  };
}

export function setupNodeRuntimeMock() {
  const originalGlobalThis = globalThis;
  const { Bun, ...rest } = globalThis as any;
  globalThis = rest;
  
  return {
    restore: () => {
      globalThis = originalGlobalThis;
    }
  };
}

// Usage in tests
test('should work in Bun runtime', () => {
  const runtimeMock = setupBunRuntimeMock('1.2.0');
  
  expect(isBunRuntime()).toBe(true);
  
  runtimeMock.restore();
});
```

#### Component: Function Duplication Resolution
**Purpose**: Address docker-safe-exec.ts having its own isBunRuntime() function that duplicates runtime-utils.ts

**Duplication Issue Analysis:**
- `docker-safe-exec.ts` has its own `isBunRuntime()` function (lines 6-8)
- `runtime-utils.ts` also has `isBunRuntime()` function (lines 5-7)
- Both functions have identical implementations
- This creates maintenance overhead and potential inconsistency

**Resolution Strategy:**
```typescript
// In docker-safe-exec.ts, replace the local isBunRuntime function with:
import { isBunRuntime, RuntimeEnvironment, RuntimeInfo, getRuntimeInfo } from './runtime-utils';

// Remove lines 6-34 (duplicate functions) from docker-safe-exec.ts
// Keep only Docker-specific functionality
```

**Updated docker-safe-exec.ts Structure:**
```typescript
import { spawn } from 'child_process';
import { isBunRuntime, RuntimeEnvironment, RuntimeInfo, getRuntimeInfo } from './runtime-utils';

// Remove duplicate isBunRuntime, RuntimeEnvironment, RuntimeInfo, getRuntimeInfo functions
// Keep only Docker-specific functionality starting from line 37
```

**Migration Steps:**
1. Update docker-safe-exec.ts imports to include runtime-utils functions
2. Remove duplicate function definitions from docker-safe-exec.ts
3. Update any references to use the imported functions
4. Add tests to verify the integration works correctly
5. Ensure no breaking changes in the public API

**Test Verification:**
```typescript
test('should use shared runtime detection', () => {
  // Verify that both modules use the same isBunRuntime function
  const runtimeUtilsIsBun = require('../src/utils/runtime-utils').isBunRuntime;
  const dockerSafeExecIsBun = require('../src/utils/docker-safe-exec').isBunRuntime;
  
  expect(runtimeUtilsIsBun).toBe(dockerSafeExecIsBun);
});
```

---

## Data Structures

### RuntimeMocks Interface
```typescript
export interface RuntimeMocks {
  safeSpawn: any;           // Mock for safeSpawn function
  safeExecSyncSync: any;    // Mock for safeExecSyncSync function
  safeExecSync: any;        // Mock for safeExecSync function
  isBunRuntime: any;        // Mock for isBunRuntime function
  safeDockerExec: any;      // Mock for safeDockerExec function
  DockerExecError: any;     // Mock for DockerExecError constructor
  DockerTimeoutError: any;  // Mock for DockerTimeoutError constructor
}
```

### MockConfiguration Interface
```typescript
export interface MockConfiguration {
  defaultExitCode?: number;
  defaultStdout?: string;
  defaultStderr?: string;
  runtimeType?: 'bun' | 'node';
  enableErrorSimulation?: boolean;
}
```

### TestContext Interface
```typescript
export interface TestContext {
  mocks: RuntimeMocks;
  configuration: MockConfiguration;
  originalEnvironment: any;
  testDirectory: string;
}
```

### MockSpawnResult Interface
```typescript
export interface MockSpawnResult {
  on: (event: string, callback: Function) => void;
  stdout: { on: (event: string, callback: Function) => void };
  stderr: { on: (event: string, callback: Function) => void };
  pid?: number;
  killed?: boolean;
}
```

---

## API Design

### Test Helper API

#### Primary Functions
```typescript
/**
 * Creates runtime mocks with default configuration
 */
export function setupDefaultRuntimeMocks(): RuntimeMocks

/**
 * Creates runtime mocks with custom configuration
 */
export function createRuntimeMocks(config?: MockConfiguration): RuntimeMocks

/**
 * Creates a mock spawn result that mimics real process behavior
 */
export function createMockSpawnResult(options?: {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
}): MockSpawnResult

/**
 * Creates mock exec output for common git commands
 */
export function createMockGitOutput(command: string, args: string[]): string

/**
 * Sets up runtime detection mocking
 */
export function setupRuntimeDetection(isBun: boolean): any

/**
 * Creates mock Docker execution errors
 */
export function createMockDockerExecError(message: string, code: number, stderr: string, runtime: 'bun' | 'node'): Error

/**
 * Creates mock Docker timeout errors
 */
export function createMockDockerTimeoutError(timeout: number): Error

/**
 * Sets up Bun runtime environment for testing
 */
export function setupBunRuntimeMock(version?: string): { restore: () => void }

/**
 * Sets up Node.js runtime environment for testing
 */
export function setupNodeRuntimeMock(): { restore: () => void }
```

#### Utility Functions
```typescript
/**
 * Restores all runtime mocks to original state
 */
export function restoreRuntimeMocks(mocks: RuntimeMocks): void

/**
 * Validates that mocks are properly configured
 */
export function validateMockConfiguration(mocks: RuntimeMocks): boolean

/**
 * Creates mock error objects that match runtime error patterns
 */
export function createMockRuntimeError(message: string, code?: number): Error

/**
 * Validates runtime detection function integration
 */
export function validateRuntimeDetectionIntegration(): boolean

/**
 * Resolves function duplication between modules
 */
export function resolveFunctionDuplication(): void
```

### Integration API

#### Test Setup API
```typescript
/**
 * Sets up complete test environment with runtime mocks
 */
export function setupTestEnvironment(config?: TestConfiguration): TestContext

/**
 * Cleans up test environment and restores original state
 */
export function cleanupTestEnvironment(context: TestContext): void
```

---

## User Interaction Flow

### Developer Workflow

#### 1. Test Development Flow
```
Developer writes test → Imports runtime-mocks helper → Sets up mocks → Writes test logic → Validates mock behavior → Cleans up mocks
```

#### 2. Test Execution Flow
```
Test runner starts → Test environment setup → Runtime mocks applied → Test logic executes → Mock behavior validated → Environment cleanup → Test result reported
```

#### 3. Debugging Flow
```
Test fails → Developer examines mock configuration → Validates mock return values → Checks integration with source code → Fixes mock setup → Re-runs test
```

### Mock Configuration Flow

#### 1. Default Mock Setup
```
Test starts → setupDefaultRuntimeMocks() called → Default mocks configured → Test executes with mocked runtime
```

#### 2. Custom Mock Setup
```
Test starts → createRuntimeMocks(customConfig) called → Custom mocks configured → Test executes with specific mock behavior
```

#### 3. Mock Cleanup Flow
```
Test completes → restoreRuntimeMocks() called → Original functions restored → Environment cleaned up
```

---

## Testing Strategy

### Multi-Layer Validation

#### 1. Unit Test Validation
- **Scope**: Individual function behavior with mocked runtime-utils
- **Focus**: Business logic correctness, not runtime implementation
- **Verification**: All source code paths tested with proper mocking

#### 2. Mock Integration Validation  
- **Scope**: Verify mocks correctly simulate runtime behavior
- **Focus**: Mock return values match expected runtime behavior
- **Verification**: Tests fail when source code behavior changes

#### 3. Cross-Runtime Compatibility
- **Scope**: Tests work in both Bun and Node.js environments
- **Focus**: Mocking strategy is runtime-agnostic
- **Verification**: Test suite passes in both runtimes

#### 4. Integration Test Validation
- **Scope**: End-to-end functionality with real runtime
- **Focus**: Actual runtime behavior matches mocked behavior
- **Verification**: Integration tests validate unit test assumptions

### Test Coverage Requirements

#### Must Cover
- All `safeSpawn` usage patterns (success, error, timeout)
- All `safeExecSyncSync` usage patterns (output, errors)
- All `safeExecSync` async patterns
- Runtime detection (`isBunRuntime`) scenarios
- Docker integration (`safeDockerExec`) patterns

#### Should Cover
- Error handling with runtime context
- Timeout scenarios with AbortController
- Different runtime environments
- Edge cases and error conditions

### Comprehensive Error Scenario Coverage

#### Runtime Utils Error Patterns
```typescript
// SafeSpawn error scenarios
mockSafeSpawn.mockReturnValue({
  on: (event: string, callback: Function) => {
    if (event === 'error') callback(new Error('Process spawn failed'));
    if (event === 'close') callback(1); // Non-zero exit code
  },
  stdout: { on: () => {} },
  stderr: { on: (event: string, cb: Function) => cb('Error output') }
});

// SafeExecSyncSync error scenarios
mockSafeExecSyncSync.mockImplementation(() => {
  throw new Error('Command failed: git status\nfatal: not a git repository');
});

// Runtime detection scenarios
mockIsBunRuntime.mockReturnValue(false); // Test Node.js fallback
```

#### Docker Integration Error Patterns
```typescript
// Docker not available
mockSafeDockerExec.mockRejectedValue(
  new DockerExecError('Docker command failed', 127, 'docker: command not found', 'node')
);

// Docker timeout
mockSafeDockerExec.mockRejectedValue(new DockerTimeoutError(5000));

// Docker permission denied
mockSafeDockerExec.mockRejectedValue(
  new DockerExecError('Permission denied', 1, 'permission denied while trying to connect', 'bun')
);

// Container not found
mockSafeDockerExec.mockResolvedValue(''); // Empty response means no containers
```

#### Cross-Platform Error Scenarios
```typescript
// Windows path handling
mockSafeExecSyncSync.mockImplementation((cmd: string) => {
  if (cmd.includes('git')) {
    throw new Error('Command failed: git\n\'git\' is not recognized as an internal or external command');
  }
  return '';
});

// macOS/Linux permission scenarios
mockSafeSpawn.mockImplementation((cmd: string, args: string[]) => {
  if (cmd === 'docker' && !process.env.DOCKER_HOST) {
    throw new Error('Cannot connect to Docker daemon');
  }
  return createMockSpawnResult(1); // Error exit code
});
```

### Cross-Platform Considerations

#### Windows-Specific Mocking Patterns
```typescript
// Windows path handling in mocks
mockSafeExecSyncSync.mockImplementation((command: string) => {
  if (command.includes('git') && process.platform === 'win32') {
    return 'On branch main\nnothing to commit, working tree clean';
  }
  return '';
});

// Windows executable detection
mockSafeSpawn.mockImplementation((cmd: string, args: string[], options: any) => {
  if (process.platform === 'win32') {
    // Windows uses .exe extensions and different path separators
    const windowsCmd = cmd.endsWith('.exe') ? cmd : `${cmd}.exe`;
    return createMockSpawnResult(0);
  }
  return createMockSpawnResult(0);
});

// Windows Docker Desktop integration
mockSafeDockerExec.mockImplementation((args: string[]) => {
  if (process.platform === 'win32' && args.includes('ps')) {
    return 'container-id-123\r\ncontainer-id-456'; // Windows line endings
  }
  return 'container-id-123';
});
```

#### macOS/Linux-Specific Mocking Patterns
```typescript
// Unix-like path handling
mockSafeExecSyncSync.mockImplementation((command: string) => {
  if (command.includes('pwd') && (process.platform === 'darwin' || process.platform === 'linux')) {
    return '/Users/developer/workspace';
  }
  return '';
});

// Unix permissions and Docker socket
mockSafeDockerExec.mockImplementation((args: string[]) => {
  if (args.includes('info') && process.platform !== 'win32') {
    return 'Server Version: 20.10.12\nDocker Root Dir: /var/lib/docker';
  }
  return 'Server info';
});
```

#### Platform-Agnostic Mock Utilities
```typescript
// Helper for platform-specific mock responses
export function createPlatformMock(windowsResponse: string, unixResponse: string): string {
  return process.platform === 'win32' ? windowsResponse : unixResponse;
}

// Usage in tests
mockSafeExecSyncSync.mockReturnValue(
  createPlatformMock(
    'C:\\Users\\developer\\workspace', // Windows
    '/home/developer/workspace'        // Unix
  )
);

// Cross-platform executable detection
mockSafeSpawn.mockImplementation((cmd: string) => {
  const platformCmd = process.platform === 'win32' && !cmd.endsWith('.exe') ? `${cmd}.exe` : cmd;
  return createMockSpawnResult(0);
});
```

#### Runtime Detection Testing
```typescript
// Test both Bun and Node.js runtime scenarios
test('should work in Bun runtime', () => {
  mockIsBunRuntime.mockReturnValue(true);
  
  const result = someFunctionUsingRuntime();
  expect(result).toBeDefined();
  expect(mockIsBunRuntime).toHaveBeenCalled();
});

test('should work in Node.js runtime', () => {
  mockIsBunRuntime.mockReturnValue(false);
  
  const result = someFunctionUsingRuntime();
  expect(result).toBeDefined();
  expect(mockIsBunRuntime).toHaveBeenCalled();
});

// Test runtime feature detection
test('should detect runtime features correctly', () => {
  mockIsBunRuntime.mockReturnValue(true);
  
  const runtimeInfo = getRuntimeInfo();
  expect(runtimeInfo.runtime).toBe('bun');
  expect(runtimeInfo.features.nativeTypeScript).toBe(true);
  expect(runtimeInfo.features.enhancedSpawn).toBe(true);
});
```

### Validation Checklist

#### Pre-Migration
- [ ] Identify all test files with `child_process` imports
- [ ] Document current mocking patterns
- [ ] Verify source code uses runtime-utils correctly
- [ ] Identify function duplication between `docker-safe-exec.ts` and `runtime-utils.ts`
- [ ] Document Docker error types requiring mock support

#### During Migration
- [ ] Update imports one file at a time
- [ ] Replace mocks with runtime-utils equivalents
- [ ] Run tests after each file migration
- [ ] Verify test behavior unchanged
- [ ] Resolve function duplication issues
- [ ] Implement Docker error type mocking
- [ ] Add runtime detection testing
- [ ] Verify Docker error scenarios work correctly

#### Post-Migration
- [ ] Run full test suite in Bun environment
- [ ] Run full test suite in Node.js environment
- [ ] Verify test coverage maintained
- [ ] Update documentation with correct patterns
- [ ] Verify no function duplication remains
- [ ] Validate Docker error handling in tests
- [ ] Confirm runtime detection tests pass
- [ ] Test cross-platform compatibility

---

## Development Phases

### Phase 1: Foundation Setup (Priority 1)

#### Step 1.1: Create Test Utilities
**Duration**: 2-3 hours
**Tasks**:
- Create `tests/helpers/runtime-mocks.ts`
- Implement `RuntimeMocks` interface (including Docker error mocks)
- Implement `setupDefaultRuntimeMocks()` function
- Implement `createMockSpawnResult()` function
- Implement `createMockDockerExecError()` and `createMockDockerTimeoutError()` functions
- Create `tests/helpers/runtime-detection-mocks.ts`
- Implement `setupBunRuntimeMock()` and `setupNodeRuntimeMock()` functions
- Implement mock cleanup utilities

**Deliverables**:
- Complete runtime-mocks helper module with Docker error support
- Runtime detection testing utilities
- Documentation for mock usage patterns
- Example test file showing correct patterns

#### Step 1.2: Resolve Function Duplication
**Duration**: 1 hour
**Tasks**:
- Update `docker-safe-exec.ts` to import `isBunRuntime` from `runtime-utils.ts`
- Remove duplicate `isBunRuntime`, `RuntimeEnvironment`, `RuntimeInfo`, and `getRuntimeInfo` functions from `docker-safe-exec.ts`
- Verify all references use the imported functions
- Add tests to verify integration works correctly
- Ensure no breaking changes in the public API

**Deliverables**:
- Consolidated runtime detection functionality
- No duplicate function definitions
- Tests verifying shared runtime detection

#### Step 1.3: Update Import Patterns
**Duration**: 1 hour
**Tasks**:
- Remove all `child_process` imports from test files
- Add `runtime-utils` imports where needed
- Update require() statements to use ES imports
- Verify import paths are correct

**Deliverables**:
- All test files with correct imports
- No remaining `child_process` dependencies

### Phase 2: Test-by-Test Migration (Priority 2)

#### Step 2.1: Migrate High-Impact Tests
**Duration**: 2-3 hours
**Files**: `tests/worktree-remove.test.ts` (most complex)
**Tasks**:
- Replace `spawn` and `execSync` mocks with `safeSpawn` and `safeExecSyncSync`
- Update all mock return value patterns
- Verify test behavior unchanged
- Run tests individually to ensure correctness

#### Step 2.2: Migrate Medium-Impact Tests
**Duration**: 2-3 hours
**Files**: `tests/status.test.ts`, `tests/devcontainer-name-compatibility.test.ts`
**Tasks**:
- Replace `execSync` mocks with `safeExecSyncSync`
- Replace `spawn` mocks with `safeSpawn`
- Update test expectations
- Validate test functionality

#### Step 2.3: Implement Docker Error Type Mocking
**Duration**: 1-2 hours
**Tasks**:
- Add DockerExecError and DockerTimeoutError imports to relevant test files
- Implement comprehensive Docker error scenarios (not available, timeout, permission denied)
- Update `safeDockerExec` mocks to use proper error types
- Add tests for Docker error handling with runtime context
- Verify error objects contain correct runtime information

#### Step 2.4: Implement Runtime Detection Testing
**Duration**: 1-2 hours
**Tasks**:
- Add tests for `isBunRuntime()` function with globalThis mocking
- Add tests for `getRuntimeInfo()` function for both Bun and Node.js scenarios
- Implement runtime environment simulation utilities
- Test runtime feature detection (nativeTypeScript, enhancedSpawn, shellHelper)
- Verify runtime detection works correctly in both environments

#### Step 2.5: Fix Worktree Check Test
**Duration**: 1-2 hours
**File**: `tests/worktree-check.test.ts`
**Tasks**:
- Fix worktree check subcommand registration testing
- Ensure proper CLI command structure validation
- Add runtime-utils mocking for any process operations
- Verify command discovery works correctly

### Phase 3: Validation and Cleanup (Priority 3)

#### Step 3.1: Full Test Suite Validation
**Duration**: 1-2 hours
**Tasks**:
- Run complete test suite in Bun environment
- Run complete test suite in Node.js environment
- Verify all tests pass with new mocking strategy
- Check test coverage is maintained

#### Step 3.2: Documentation Updates
**Duration**: 1 hour
**Tasks**:
- Update test development documentation
- Document correct mocking patterns
- Create migration guide for future developers
- Add examples to codebase

#### Step 3.3: Final Cleanup
**Duration**: 1 hour
**Tasks**:
- Remove any remaining old mocking patterns
- Ensure no `child_process` mocking remains
- Verify code quality and consistency
- Final validation of all changes

### Phase 4: Integration Testing (Priority 4)

#### Step 4.1: Cross-Runtime Testing
**Duration**: 1-2 hours
**Tasks**:
- Test in Bun environment
- Test in Node.js environment
- Verify runtime-agnostic behavior
- Validate performance improvements

#### Step 4.2: Integration Validation
**Duration**: 1-2 hours
**Tasks**:
- Test with real Docker integration
- Verify CLI command functionality
- Validate error handling patterns
- Ensure end-to-end functionality works

---

## Dependencies

### Required Libraries and Frameworks

#### Core Dependencies
- **Bun Runtime**: v1.2.x or later (for test execution)
- **TypeScript**: v5.0.0 or later (for type safety)
- **Commander.js**: v11.0.0 or later (CLI framework - unchanged)

#### Development Dependencies
- **bun-types**: Latest version (for Bun API type definitions)
- **@types/node**: v20.0.0 or later (for Node.js compatibility testing)

#### Testing Dependencies
- **Bun Test Runner**: Built-in with Bun runtime
- **No Jest dependencies**: Removed as part of Task 20 migration

### External Services and Tools

#### Required Tools
- **Docker**: For integration testing with `safeDockerExec`
- **Git**: For worktree functionality testing
- **Node.js**: For cross-runtime compatibility testing

#### Optional Tools
- **IDE with TypeScript support**: For development experience
- **Code coverage tools**: Bun built-in coverage reporting

### System Requirements

#### Development Environment
- **Operating System**: macOS, Linux, or Windows with WSL2
- **Memory**: 4GB RAM minimum
- **Storage**: 1GB free space for dependencies and test artifacts

#### Testing Environment
- **Bun Runtime**: v1.0.0 or later
- **Node.js Runtime**: v22.x or later (for compatibility testing)
- **Docker Engine**: Latest stable version

### Integration Dependencies

#### Task 20 Dependencies
- **Runtime Abstraction Layer**: Must be fully implemented and functional
- **Docker Integration**: Enhanced `safeDockerExec` with Bun.spawn
- **CLI Framework**: Commander.js integration must be preserved

#### Task 10 Dependencies
- **Build System**: Cross-platform executable build system compatibility
- **Testing Infrastructure**: Integration with existing test patterns

---

## Success Criteria

### Functional Requirements
- [ ] All unit tests pass with correct mocking strategy
- [ ] Tests mock runtime-utils functions, not implementation details
- [ ] Test coverage maintained at >80%
- [ ] Tests work in both Bun and Node.js environments
- [ ] Docker error types properly mocked and tested
- [ ] Runtime detection functions thoroughly tested
- [ ] Function duplication resolved between modules

### Quality Requirements  
- [ ] No `child_process` imports remain in test files
- [ ] No implementation detail mocking present
- [ ] Clear, maintainable mocking patterns established
- [ ] Documentation updated with correct patterns
- [ ] No duplicate function definitions in codebase
- [ ] Docker error scenarios comprehensively tested
- [ ] Runtime detection testing covers all scenarios

### Integration Requirements
- [ ] Proper integration with Task 20 runtime abstraction layer
- [ ] Docker integration testing works correctly
- [ ] CLI command testing maintains functionality
- [ ] Cross-platform compatibility preserved
- [ ] Shared runtime detection functions work across modules
- [ ] Docker error handling maintains runtime context
- [ ] Runtime detection mocking works in test environments

### Performance Requirements
- [ ] Test execution time improved (leveraging Bun test runner)
- [ ] Mock setup/teardown is efficient
- [ ] No memory leaks in test execution
- [ ] Fast feedback loop for developers

### Performance Considerations

#### Test Execution Time Expectations
- **Single Test File**: < 500ms with proper mocking
- **Full Test Suite**: < 10 seconds in Bun environment
- **Mock Setup**: < 10ms per test case
- **Mock Cleanup**: < 5ms per test case

#### Performance Validation Patterns
```typescript
// Performance benchmark test
test('mock setup performance', () => {
  const startTime = performance.now();
  
  const mocks = setupDefaultRuntimeMocks();
  
  const setupTime = performance.now() - startTime;
  expect(setupTime).toBeLessThan(10); // < 10ms setup time
  
  const cleanupStart = performance.now();
  restoreRuntimeMocks(mocks);
  const cleanupTime = performance.now() - cleanupStart;
  expect(cleanupTime).toBeLessThan(5); // < 5ms cleanup time
});
```

#### Memory Management Patterns
```typescript
// Ensure no memory leaks in mock objects
afterEach(() => {
  // Clear all mock references
  Object.values(mocks).forEach(mock => {
    mock?.mockRestore?.();
    mock = null;
  });
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});
```

#### Efficient Mock Configuration
```typescript
// Pre-create common mock results to avoid recreation
const COMMON_MOCK_RESULTS = {
  successSpawn: createMockSpawnResult(0),
  errorSpawn: createMockSpawnResult(1),
  gitStatus: 'On branch main\nnothing to commit',
  dockerRunning: 'container-id-123',
  dockerStopped: ''
};

// Use pre-created mocks in tests
mockSafeSpawn.mockReturnValue(COMMON_MOCK_RESULTS.successSpawn);
mockSafeExecSyncSync.mockReturnValue(COMMON_MOCK_RESULTS.gitStatus);
```

---

## Risk Mitigation

### Primary Risks
1. **Test Coverage Regression**: Mitigated by comprehensive validation
2. **Mocking Strategy Errors**: Mitigated by systematic approach and validation
3. **Runtime Compatibility Issues**: Mitigated by cross-runtime testing
4. **Integration Breakage**: Mitigated by careful integration with Task 20 components

### Contingency Plans
- **Rollback Strategy**: Maintain backup of original test files
- **Gradual Migration**: Migrate one test file at a time
- **Validation Gates**: Test after each migration step
- **Documentation**: Clear documentation of correct patterns

---

## Conclusion

This implementation plan provides a comprehensive roadmap for fixing the test mocking issues after the Bun migration. The key insight is that tests must mock the **abstraction layer** (`runtime-utils.ts`) rather than the **implementation details** (`child_process`, `Bun.spawn`).

The integration with Task 20 is critical - this task builds directly on the runtime abstraction layer established during the Bun migration. By following the patterns and avoiding the anti-patterns outlined in the architectural analysis, we can ensure that:

1. Tests properly isolate the code under test
2. Mocking strategy aligns with the actual implementation
3. Tests remain runtime-agnostic and maintainable
4. The investment in Task 20's runtime abstraction layer is fully leveraged

The phased implementation approach ensures minimal risk while maximizing the effectiveness of the test suite and maintaining the architectural integrity established in the Bun migration.

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-06  
**Implementation Lead**: AI Implementation Engineer (Claude)