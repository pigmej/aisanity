# Implementation Plan: State File YAML Repository

**Task ID:** 100_1_10  
**Created:** 2025-10-03  
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

### Purpose

Implement a robust, production-ready StateRepository class that serves as the single source of truth for all feature and task state management in the Aisanity workflow system. This is a foundational component that must be "rock solid" as all state machine operations depend on it.

### Architectural Foundation

Based on the architectural analysis, this implementation will follow these key principles:

1. **Atomic Operations**: All file operations use temp file + rename pattern to prevent corruption
2. **Concurrency Control**: Simple lock file pattern with timeout and stale lock detection
3. **Schema Validation**: Zod-based runtime validation with TypeScript type inference
4. **Fail-Safe Design**: Explicit error handling with backup creation on corruption
5. **Repository Pattern**: Clean separation between business logic and persistence layer
6. **No External Dependencies**: Minimal dependencies (only zod + yaml), leveraging Node.js built-ins

### Key Design Decisions

Following the **IMPORTANT** architectural decisions:

- **Updater Function Pattern**: `updateEntityState()` uses updater functions for atomic read-modify-write operations
- **Simple Lock File**: Lock file pattern with timeout (5s default) - sufficient for single-user CLI
- **Full File Operations**: Load/save entire file (no partial updates) for simplicity and atomicity
- **Append-Only History**: Complete transition history preserved for audit trail
- **Automatic Initialization**: Missing entities automatically initialized to default states
- **Backup on Corruption**: Timestamped backups created when YAML parsing fails

---

## Integration Strategy

### Integration Status

**This is a foundational task with NO dependencies.**

As noted in the architectural analysis:
> "This task has no dependencies, but will be used by task 100_1_40 (State Machine Engine)"

### Future Integration Points

This StateRepository will be consumed by downstream tasks:

#### 1. State Machine Engine (Task 100_1_40)

**Integration Pattern**:
```typescript
// State Machine will inject StateRepository as dependency
class StateMachine {
  constructor(
    private stateRepo: StateRepository,
    private workflowConfig: WorkflowConfig
  ) {}
  
  async executeTransition(id: string, type: 'feature' | 'task', toState: string) {
    // Uses updateEntityState for atomic transitions
    await this.stateRepo.updateEntityState(id, type, (entity) => {
      const transition: Transition = {
        from: entity.current_state,
        to: toState,
        command: '...',
        exit_code: 0,
        timestamp: new Date().toISOString()
      };
      
      return {
        ...entity,
        current_state: toState,
        transitions: [...entity.transitions, transition]
      };
    });
  }
}
```

#### 2. Status Visualization Commands (Tasks 100_2_20, 100_2_30)

**Integration Pattern**:
```typescript
// Status commands will use read-only methods
class StatusCommand {
  constructor(private stateRepo: StateRepository) {}
  
  async execute() {
    const state = await this.stateRepo.load();
    // Read entity states for display
    const featureState = this.stateRepo.getEntityState('feature-123', 'feature');
    // Render status tree
  }
}
```

#### 3. Task Commands (Task 100_3_10)

**Integration Pattern**:
```typescript
// Task commands will use updateEntityState for state changes
class TaskStartCommand {
  constructor(private stateRepo: StateRepository) {}
  
  async execute(taskId: string) {
    await this.stateRepo.updateEntityState(taskId, 'task', (entity) => {
      // Atomic state transition
      return { ...entity, current_state: 'in_progress' };
    });
  }
}
```

### Export Contract

The StateRepository will export:

```typescript
// src/state/index.ts
export { StateRepository } from './state-repository';
export { StateFileSchema, EntityStateSchema, TransitionSchema } from './schemas';
export type { StateFile, EntityState, Transition, TaskState } from './types';
export { 
  StateRepositoryError, 
  StateValidationError, 
  StateCorruptionError, 
  LockTimeoutError 
} from './errors';
```

### Integration Testing Requirements

When future tasks integrate with StateRepository:

1. **Unit Tests**: Mock StateRepository for isolated testing
2. **Integration Tests**: Test with real StateRepository instance
3. **Concurrent Access Tests**: Verify lock mechanism prevents race conditions
4. **Error Recovery Tests**: Test error handling and backup restoration

---

## Component Details

### File Structure

```
src/
  state/
    state-repository.ts      # Main StateRepository class
    schemas.ts               # Zod schemas for validation
    types.ts                 # TypeScript interfaces and types
    errors.ts                # Custom error classes
    index.ts                 # Public exports
    
tests/
  state-repository.test.ts              # Unit tests (mocked fs)
  state-repository.integration.test.ts  # Integration tests (real fs)
```

### Component Responsibilities

#### 1. StateRepository Class (`state-repository.ts`)

**Primary Responsibilities**:
- Manage `.aisanity-state.yml` file lifecycle
- Provide atomic read/write operations
- Enforce schema validation on all operations
- Handle file locking for concurrent access prevention
- Automatic entity initialization
- Backup creation on corruption detection

**Key Methods**:
- `load()`: Load and validate entire state file
- `save()`: Atomically save entire state file
- `getEntityState()`: Retrieve state for specific entity
- `updateEntityState()`: Atomically update entity state using updater function
- `initialize()`: Create default state file if none exists

**Private Methods**:
- `acquireLock()`: Acquire file lock with timeout
- `releaseLock()`: Release file lock
- `checkStaleLock()`: Detect and clean stale locks
- `atomicWrite()`: Write using temp file + rename pattern
- `createBackup()`: Create timestamped backup on corruption
- `createDefaultState()`: Generate default state structure
- `validateStateFile()`: Validate file is regular file (not symlink)

#### 2. Schema Definitions (`schemas.ts`)

**Responsibilities**:
- Define Zod schemas for runtime validation
- Export schemas for reuse in other modules
- Provide type inference for TypeScript types

**Schemas**:
- `TransitionSchema`: Individual state transition record
- `EntityStateSchema`: Feature state structure
- `TaskStateSchema`: Task state structure (extends EntityState)
- `StateFileSchema`: Complete state file structure

#### 3. Type Definitions (`types.ts`)

**Responsibilities**:
- Export TypeScript types inferred from Zod schemas
- Define additional helper types
- Provide type aliases for clarity

**Types**:
- `StateFile`: Root state file structure
- `EntityState`: Generic entity state
- `TaskState`: Task-specific state (includes feature_id, phase)
- `Transition`: State transition record
- `EntityType`: Union type ('feature' | 'task')
- `StateFileVersion`: Version string type

#### 4. Error Classes (`errors.ts`)

**Responsibilities**:
- Define custom error types for specific failure scenarios
- Include contextual information in errors
- Follow existing codebase error handling patterns

**Error Types**:
- `StateRepositoryError`: Base error class
- `StateValidationError`: Schema validation failures
- `StateCorruptionError`: YAML parse errors
- `LockTimeoutError`: Lock acquisition timeout
- `StateFileSecurityError`: Security violations (symlinks, path traversal)

---

## Data Structures

### State File Structure

**File**: `.aisanity-state.yml`

```yaml
version: "1.0"
last_updated: "2025-10-03T14:30:00.000Z"

features:
  "100":
    current_state: "in_progress"
    file_path: ".feature/100-cli-state-machine-workflow-ui.md"
    created_at: "2025-10-01T10:00:00.000Z"
    transitions:
      - from: "discovered"
        to: "in_progress"
        command: "aisanity feature start 100"
        exit_code: 0
        timestamp: "2025-10-02T09:00:00.000Z"

tasks:
  "100_1_10":
    current_state: "in_progress"
    file_path: ".task/100_1_10-state-file-yaml-repository.md"
    feature_id: "100"
    phase: "1"
    created_at: "2025-10-01T10:30:00.000Z"
    transitions:
      - from: "file_exists"
        to: "planned"
        command: "aisanity task plan 100_1_10"
        exit_code: 0
        timestamp: "2025-10-02T10:00:00.000Z"
      - from: "planned"
        to: "in_progress"
        command: "aisanity task start 100_1_10"
        exit_code: 0
        timestamp: "2025-10-03T08:00:00.000Z"
```

### Zod Schema Definitions

#### TransitionSchema

```typescript
import { z } from 'zod';

export const TransitionSchema = z.object({
  from: z.string(),
  to: z.string(),
  command: z.string(),
  exit_code: z.number(),
  timestamp: z.string().datetime()
});
```

**Purpose**: Record individual state transitions with full context for audit trail.

**Fields**:
- `from`: Source state name
- `to`: Target state name
- `command`: Full command that triggered transition
- `exit_code`: Command execution result (0 = success)
- `timestamp`: ISO 8601 datetime string

#### EntityStateSchema

```typescript
export const EntityStateSchema = z.object({
  current_state: z.string(),
  file_path: z.string(),
  created_at: z.string().datetime(),
  transitions: z.array(TransitionSchema)
});
```

**Purpose**: Base schema for features (tasks extend this).

**Fields**:
- `current_state`: Current state in workflow
- `file_path`: Relative path to entity definition file
- `created_at`: Entity creation timestamp
- `transitions`: Append-only array of all transitions

#### TaskStateSchema

```typescript
export const TaskStateSchema = EntityStateSchema.extend({
  feature_id: z.string(),
  phase: z.string().optional()
});
```

**Purpose**: Task-specific state extending EntityState.

**Additional Fields**:
- `feature_id`: Parent feature ID (for hierarchy)
- `phase`: Implementation phase (optional)

#### StateFileSchema

```typescript
export const StateFileSchema = z.object({
  version: z.string(),
  last_updated: z.string().datetime(),
  features: z.record(EntityStateSchema),
  tasks: z.record(TaskStateSchema)
});
```

**Purpose**: Root schema for entire state file.

**Fields**:
- `version`: Schema version (currently "1.0")
- `last_updated`: Last modification timestamp
- `features`: Map of feature ID → EntityState
- `tasks`: Map of task ID → TaskState

### Type Inference

```typescript
// types.ts
import type { z } from 'zod';
import type { 
  StateFileSchema, 
  EntityStateSchema, 
  TaskStateSchema, 
  TransitionSchema 
} from './schemas';

// Infer TypeScript types from Zod schemas
export type StateFile = z.infer<typeof StateFileSchema>;
export type EntityState = z.infer<typeof EntityStateSchema>;
export type TaskState = z.infer<typeof TaskStateSchema>;
export type Transition = z.infer<typeof TransitionSchema>;

// Helper types
export type EntityType = 'feature' | 'task';
export type StateFileVersion = '1.0';

// Updater function type for atomic updates
export type EntityStateUpdater = (state: EntityState) => EntityState;
```

---

## API Design

### Public API

#### Constructor

```typescript
class StateRepository {
  constructor(
    private statePath: string = '.aisanity-state.yml',
    private lockTimeout: number = 5000
  ) {}
}
```

**Parameters**:
- `statePath`: Path to state file (default: `.aisanity-state.yml`)
- `lockTimeout`: Lock acquisition timeout in milliseconds (default: 5000)

**Design Note**: Constructor accepts path and timeout for testability and flexibility.

#### initialize()

```typescript
async initialize(): Promise<void>
```

**Purpose**: Initialize state file if it doesn't exist.

**Behavior**:
- Check if state file exists
- If not, create default state file with empty features/tasks
- If exists, validate it can be loaded
- Throw error on validation failure

**Example**:
```typescript
const repo = new StateRepository();
await repo.initialize();
```

**Error Handling**:
- Throws `StateValidationError` if existing file is invalid
- Throws `StateCorruptionError` if YAML is malformed
- Throws `StateFileSecurityError` if file is symlink

#### load()

```typescript
async load(): Promise<StateFile>
```

**Purpose**: Load and validate entire state file.

**Behavior**:
1. Acquire read lock
2. Read file contents
3. Parse YAML
4. Validate against StateFileSchema
5. Release lock
6. Return validated state

**Example**:
```typescript
const state = await repo.load();
console.log(`Features: ${Object.keys(state.features).length}`);
console.log(`Tasks: ${Object.keys(state.tasks).length}`);
```

**Error Handling**:
- Throws `StateCorruptionError` on YAML parse error (creates backup)
- Throws `StateValidationError` on schema validation failure
- Throws `LockTimeoutError` if lock cannot be acquired
- Throws `StateFileSecurityError` if file is symlink

#### save()

```typescript
async save(state: StateFile): Promise<void>
```

**Purpose**: Atomically save entire state file.

**Behavior**:
1. Validate state against StateFileSchema
2. Update `last_updated` timestamp
3. Acquire write lock
4. Serialize to YAML
5. Write to temp file (`.aisanity-state.yml.tmp`)
6. Atomic rename to target file
7. Release lock

**Example**:
```typescript
const state = await repo.load();
state.last_updated = new Date().toISOString();
await repo.save(state);
```

**Error Handling**:
- Throws `StateValidationError` if state is invalid (before any file operations)
- Throws `LockTimeoutError` if lock cannot be acquired
- Throws `StateRepositoryError` on file system errors
- **Critical**: Original file unchanged if any step fails

#### getEntityState()

```typescript
getEntityState(id: string, type: EntityType): EntityState | null
```

**Purpose**: Retrieve state for specific entity (synchronous, assumes state is loaded).

**Behavior**:
- Look up entity in appropriate collection (features or tasks)
- Return entity state if found
- Return null if not found

**Example**:
```typescript
const state = await repo.load();
const featureState = repo.getEntityState('100', 'feature');
if (featureState) {
  console.log(`Current state: ${featureState.current_state}`);
}
```

**Design Note**: This is a synchronous helper method. State must be loaded first via `load()`.

#### updateEntityState()

```typescript
async updateEntityState(
  id: string,
  type: EntityType,
  updater: EntityStateUpdater
): Promise<void>
```

**Purpose**: Atomically update entity state using updater function pattern.

**Behavior**:
1. Acquire lock
2. Load current state
3. Get entity state (initialize if missing)
4. Apply updater function
5. Update state with new entity state
6. Save state atomically
7. Release lock

**Example**:
```typescript
// Transition task to 'in_progress' state
await repo.updateEntityState('100_1_10', 'task', (entity) => {
  const transition: Transition = {
    from: entity.current_state,
    to: 'in_progress',
    command: 'aisanity task start 100_1_10',
    exit_code: 0,
    timestamp: new Date().toISOString()
  };
  
  return {
    ...entity,
    current_state: 'in_progress',
    transitions: [...entity.transitions, transition]
  };
});
```

**Design Note**: Updater function pattern ensures atomic read-modify-write. This is **CRITICAL** for preventing race conditions.

**Error Handling**:
- Throws `StateValidationError` if updated state is invalid
- Throws `LockTimeoutError` if lock cannot be acquired
- Throws errors from updater function (propagated up)

### Private Methods

#### acquireLock()

```typescript
private async acquireLock(lockPath: string): Promise<void>
```

**Purpose**: Acquire exclusive lock using lock file pattern.

**Implementation**:
```typescript
private async acquireLock(lockPath: string): Promise<void> {
  const startTime = Date.now();
  const lockContent = JSON.stringify({
    pid: process.pid,
    timestamp: new Date().toISOString()
  });
  
  while (Date.now() - startTime < this.lockTimeout) {
    try {
      await fs.writeFile(lockPath, lockContent, {
        flag: 'wx' // Fail if file exists (atomic)
      });
      return; // Lock acquired successfully
    } catch (error) {
      if (error.code === 'EEXIST') {
        // Lock file exists, check if stale
        await this.checkStaleLock(lockPath);
        await this.sleep(100); // Wait before retry
      } else {
        throw new StateRepositoryError('Failed to acquire lock', error.code);
      }
    }
  }
  
  throw new LockTimeoutError(this.lockTimeout);
}
```

**Lock File Content**:
```json
{
  "pid": 12345,
  "timestamp": "2025-10-03T14:30:00.000Z"
}
```

#### releaseLock()

```typescript
private async releaseLock(lockPath: string): Promise<void>
```

**Purpose**: Release lock by removing lock file.

**Implementation**:
```typescript
private async releaseLock(lockPath: string): Promise<void> {
  try {
    await fs.unlink(lockPath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      // Log but don't throw - lock cleanup failure shouldn't break operation
      console.error(`Warning: Failed to release lock: ${error.message}`);
    }
  }
}
```

#### checkStaleLock()

```typescript
private async checkStaleLock(lockPath: string): Promise<void>
```

**Purpose**: Detect and remove stale locks.

**Implementation**:
```typescript
private async checkStaleLock(lockPath: string): Promise<void> {
  try {
    const lockContent = await fs.readFile(lockPath, 'utf8');
    const lockInfo = JSON.parse(lockContent);
    const lockAge = Date.now() - new Date(lockInfo.timestamp).getTime();
    
    // Lock is stale if older than timeout
    if (lockAge > this.lockTimeout) {
      console.warn(`Removing stale lock (age: ${lockAge}ms, pid: ${lockInfo.pid})`);
      await fs.unlink(lockPath);
    }
  } catch (error) {
    // If we can't read lock file, consider it stale
    console.warn(`Lock file unreadable, removing: ${error.message}`);
    await fs.unlink(lockPath).catch(() => {}); // Ignore errors
  }
}
```

#### atomicWrite()

```typescript
private async atomicWrite(state: StateFile): Promise<void>
```

**Purpose**: Write state file atomically using temp file + rename pattern.

**Implementation**:
```typescript
private async atomicWrite(state: StateFile): Promise<void> {
  const tempPath = `${this.statePath}.tmp`;
  const lockPath = `${this.statePath}.lock`;
  
  // Acquire lock
  await this.acquireLock(lockPath);
  
  try {
    // Validate before writing
    const validated = StateFileSchema.parse(state);
    
    // Serialize to YAML
    const yamlContent = YAML.stringify(validated, {
      indent: 2,
      lineWidth: 0 // Prevent line wrapping for git-friendly diffs
    });
    
    // Write to temp file
    await fs.writeFile(tempPath, yamlContent, 'utf8');
    
    // Atomic rename
    await fs.rename(tempPath, this.statePath);
    
  } catch (error) {
    // Clean up temp file on error
    await fs.unlink(tempPath).catch(() => {});
    throw error;
    
  } finally {
    // Always release lock
    await this.releaseLock(lockPath);
  }
}
```

#### createBackup()

```typescript
private async createBackup(): Promise<string>
```

**Purpose**: Create timestamped backup of corrupted state file.

**Implementation**:
```typescript
private async createBackup(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const backupPath = `${this.statePath}.backup-${timestamp}`;
  
  try {
    await fs.copyFile(this.statePath, backupPath);
    console.warn(`Created backup of corrupted state file: ${backupPath}`);
    return backupPath;
  } catch (error) {
    console.error(`Failed to create backup: ${error.message}`);
    throw new StateRepositoryError('Backup creation failed', error.code);
  }
}
```

#### validateStateFile()

```typescript
private async validateStateFile(filepath: string): Promise<void>
```

**Purpose**: Security validation - ensure file is regular file (not symlink).

**Implementation**:
```typescript
private async validateStateFile(filepath: string): Promise<void> {
  try {
    const stats = await fs.lstat(filepath);
    
    if (stats.isSymbolicLink()) {
      throw new StateFileSecurityError('State file cannot be a symlink');
    }
    
    if (!stats.isFile()) {
      throw new StateFileSecurityError('State file must be a regular file');
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist - this is OK
      return;
    }
    throw error;
  }
}
```

#### initializeEntity()

```typescript
private initializeEntity(
  id: string, 
  type: EntityType,
  filePath: string
): EntityState
```

**Purpose**: Create default state for new entity.

**Implementation**:
```typescript
private initializeEntity(
  id: string,
  type: EntityType,
  filePath: string
): EntityState {
  const defaultState = type === 'feature' ? 'discovered' : 'file_exists';
  const timestamp = new Date().toISOString();
  
  const initialTransition: Transition = {
    from: '',
    to: defaultState,
    command: 'auto-initialized',
    exit_code: 0,
    timestamp
  };
  
  return {
    current_state: defaultState,
    file_path: filePath,
    created_at: timestamp,
    transitions: [initialTransition]
  };
}
```

---

## User Interaction Flow

### Flow 1: Initialize New Project

**Scenario**: User runs first command in new project, state file doesn't exist.

**Steps**:
1. User runs command (e.g., `aisanity feature start 100`)
2. Command creates StateRepository instance
3. Repository calls `initialize()`
4. Repository checks if `.aisanity-state.yml` exists
5. File doesn't exist → create default state file
6. Default state written atomically
7. Command proceeds with state file available

**Result**: Empty state file created with structure ready for use.

**State File Created**:
```yaml
version: "1.0"
last_updated: "2025-10-03T14:30:00.000Z"
features: {}
tasks: {}
```

### Flow 2: Load Existing State

**Scenario**: User runs command, state file exists.

**Steps**:
1. Command creates StateRepository instance
2. Command calls `repo.load()`
3. Repository acquires read lock
4. Repository reads `.aisanity-state.yml`
5. Repository parses YAML
6. Repository validates against schema
7. Repository releases lock
8. Repository returns validated state object
9. Command uses state data

**Result**: State data loaded and validated.

### Flow 3: Update Entity State

**Scenario**: User transitions task to new state.

**Steps**:
1. User runs `aisanity task start 100_1_10`
2. Command calls `repo.updateEntityState('100_1_10', 'task', updater)`
3. Repository acquires lock
4. Repository loads current state
5. Repository gets task entity (or initializes if missing)
6. Repository applies updater function
7. Updater adds transition and updates current_state
8. Repository validates updated state
9. Repository saves state atomically (temp + rename)
10. Repository releases lock
11. Command completes successfully

**Result**: Task state updated with new transition recorded.

**State File Updated**:
```yaml
tasks:
  "100_1_10":
    current_state: "in_progress"  # Changed from "planned"
    transitions:
      - from: "planned"
        to: "in_progress"
        command: "aisanity task start 100_1_10"
        exit_code: 0
        timestamp: "2025-10-03T14:30:00.000Z"
```

### Flow 4: Concurrent Access Prevention

**Scenario**: Two commands try to update state simultaneously.

**Steps**:
1. **Process A**: Calls `updateEntityState()`
2. **Process A**: Acquires lock successfully
3. **Process B**: Calls `updateEntityState()`
4. **Process B**: Tries to acquire lock → EEXIST (lock file exists)
5. **Process B**: Checks lock age → fresh lock, waits 100ms
6. **Process A**: Completes update, releases lock
7. **Process B**: Retries lock acquisition → succeeds
8. **Process B**: Completes update with fresh state

**Result**: Both updates applied sequentially, no data corruption.

### Flow 5: Corruption Recovery

**Scenario**: User manually edits state file, introduces YAML syntax error.

**Steps**:
1. User edits `.aisanity-state.yml` manually
2. User introduces syntax error (e.g., invalid indentation)
3. User runs `aisanity feature status`
4. Command calls `repo.load()`
5. Repository reads file
6. YAML parsing fails → `YAMLParseError`
7. Repository catches error
8. Repository creates backup: `.aisanity-state.yml.backup-2025-10-03T14-30-00.000Z`
9. Repository throws `StateCorruptionError` with helpful message
10. User sees error with backup file path
11. User fixes YAML or restores from backup

**Result**: Data preserved in backup, user informed of corruption.

### Flow 6: Entity Auto-Initialization

**Scenario**: New task discovered, not yet in state file.

**Steps**:
1. Command detects new task file: `.task/100_2_10-id-resolver.md`
2. Command calls `repo.updateEntityState('100_2_10', 'task', updater)`
3. Repository loads state
4. Repository checks for entity '100_2_10' → not found
5. Repository auto-initializes entity:
   - `current_state: 'file_exists'`
   - `file_path: '.task/100_2_10-id-resolver.md'`
   - Initial transition recorded
6. Repository applies updater function to initialized entity
7. Repository saves updated state

**Result**: New entity automatically tracked without explicit initialization.

---

## Testing Strategy

### Unit Tests (Mocked File System)

**File**: `tests/state-repository.test.ts`

**Mocking Strategy**: Use `jest.mock('fs/promises')` to mock all file system operations.

#### Test Suite 1: Initialization

```typescript
describe('StateRepository.initialize()', () => {
  test('creates default state file when none exists', async () => {
    // Mock fs.readFile to throw ENOENT
    // Mock fs.writeFile to succeed
    // Assert default state structure created
  });
  
  test('succeeds when state file already exists', async () => {
    // Mock fs.readFile to return valid state
    // Assert no write operation occurs
  });
  
  test('throws StateValidationError when existing file is invalid', async () => {
    // Mock fs.readFile to return invalid state
    // Assert StateValidationError thrown
  });
  
  test('throws StateCorruptionError when YAML is malformed', async () => {
    // Mock fs.readFile to return invalid YAML
    // Assert StateCorruptionError thrown
    // Assert backup created
  });
});
```

#### Test Suite 2: Load Operations

```typescript
describe('StateRepository.load()', () => {
  test('loads and validates valid state file', async () => {
    // Mock fs.readFile to return valid YAML
    // Assert state object matches expected structure
  });
  
  test('throws StateCorruptionError on YAML parse error', async () => {
    // Mock fs.readFile to return invalid YAML
    // Assert StateCorruptionError thrown
    // Assert backup created
  });
  
  test('throws StateValidationError on schema validation failure', async () => {
    // Mock fs.readFile to return invalid state structure
    // Assert StateValidationError thrown
    // Assert error includes Zod validation details
  });
  
  test('throws LockTimeoutError when lock cannot be acquired', async () => {
    // Mock lock file to exist and be fresh
    // Assert LockTimeoutError thrown after timeout
  });
  
  test('acquires and releases lock correctly', async () => {
    // Mock all fs operations
    // Assert lock created before read
    // Assert lock removed after read
  });
});
```

#### Test Suite 3: Save Operations

```typescript
describe('StateRepository.save()', () => {
  test('saves state atomically using temp file', async () => {
    // Mock fs.writeFile and fs.rename
    // Assert temp file written first
    // Assert atomic rename performed
  });
  
  test('updates last_updated timestamp', async () => {
    // Mock fs operations
    // Assert last_updated field updated
  });
  
  test('throws StateValidationError before writing if invalid', async () => {
    // Pass invalid state
    // Assert StateValidationError thrown
    // Assert no file operations occurred
  });
  
  test('cleans up temp file on write error', async () => {
    // Mock fs.writeFile to fail
    // Assert temp file deleted
  });
  
  test('releases lock on error', async () => {
    // Mock fs.rename to fail
    // Assert lock removed despite error
  });
  
  test('YAML output is git-friendly', async () => {
    // Mock fs.writeFile to capture content
    // Assert consistent formatting
    // Assert no line wrapping
  });
});
```

#### Test Suite 4: Get Entity State

```typescript
describe('StateRepository.getEntityState()', () => {
  test('returns entity state when found', async () => {
    // Load state with known entity
    // Assert correct entity returned
  });
  
  test('returns null when entity not found', async () => {
    // Load state without entity
    // Assert null returned
  });
  
  test('distinguishes between feature and task entities', async () => {
    // Load state with both types
    // Assert correct entity type returned
  });
});
```

#### Test Suite 5: Update Entity State

```typescript
describe('StateRepository.updateEntityState()', () => {
  test('atomically updates existing entity', async () => {
    // Mock all operations
    // Call updateEntityState with updater
    // Assert updater called with current state
    // Assert updated state saved
  });
  
  test('initializes entity when not found', async () => {
    // Mock state without entity
    // Call updateEntityState
    // Assert entity initialized with defaults
    // Assert updater applied to initialized entity
  });
  
  test('applies updater function correctly', async () => {
    // Mock operations
    // Pass updater that modifies state
    // Assert modifications applied
  });
  
  test('validates updated state before saving', async () => {
    // Pass updater that returns invalid state
    // Assert StateValidationError thrown
    // Assert no changes persisted
  });
  
  test('handles updater function errors', async () => {
    // Pass updater that throws error
    // Assert error propagated
    // Assert lock released
  });
  
  test('prevents race conditions with locking', async () => {
    // Simulate concurrent updates
    // Assert only one succeeds at a time
    // Assert both updates eventually applied
  });
});
```

#### Test Suite 6: Locking Mechanism

```typescript
describe('Lock mechanism', () => {
  test('acquires lock when none exists', async () => {
    // Mock fs.writeFile with flag 'wx' to succeed
    // Assert lock acquired
  });
  
  test('retries when lock exists', async () => {
    // Mock fs.writeFile to fail first, succeed second
    // Assert retry logic executed
  });
  
  test('detects and removes stale locks', async () => {
    // Mock lock file with old timestamp
    // Assert stale lock removed
    // Assert new lock acquired
  });
  
  test('throws LockTimeoutError after max retries', async () => {
    // Mock lock file to always exist
    // Assert LockTimeoutError thrown
  });
  
  test('releases lock in finally block', async () => {
    // Mock operation that throws error
    // Assert lock still released
  });
  
  test('lock contains process ID and timestamp', async () => {
    // Mock fs.writeFile to capture content
    // Assert lock file contains correct data
  });
});
```

#### Test Suite 7: Backup Creation

```typescript
describe('Backup creation', () => {
  test('creates backup on YAML parse error', async () => {
    // Mock fs.readFile to return invalid YAML
    // Call load()
    // Assert backup file created with timestamp
  });
  
  test('backup has timestamped filename', async () => {
    // Mock operations
    // Trigger corruption
    // Assert backup filename includes timestamp
  });
  
  test('logs backup creation', async () => {
    // Mock console.warn
    // Trigger corruption
    // Assert warning logged with backup path
  });
  
  test('throws error if backup fails', async () => {
    // Mock fs.copyFile to fail
    // Trigger corruption
    // Assert StateRepositoryError thrown
  });
});
```

#### Test Suite 8: Security Validation

```typescript
describe('Security validation', () => {
  test('rejects symlink state files', async () => {
    // Mock fs.lstat to return symlink
    // Assert StateFileSecurityError thrown
  });
  
  test('accepts regular files', async () => {
    // Mock fs.lstat to return regular file
    // Assert validation passes
  });
  
  test('allows file to not exist initially', async () => {
    // Mock fs.lstat to throw ENOENT
    // Assert validation passes
  });
});
```

#### Test Suite 9: Entity Initialization

```typescript
describe('Entity initialization', () => {
  test('initializes feature with "discovered" state', async () => {
    // Mock operations
    // Update non-existent feature
    // Assert initialized with 'discovered' state
  });
  
  test('initializes task with "file_exists" state', async () => {
    // Mock operations
    // Update non-existent task
    // Assert initialized with 'file_exists' state
  });
  
  test('records initial transition', async () => {
    // Mock operations
    // Update non-existent entity
    // Assert initial transition in transitions array
  });
  
  test('sets created_at timestamp', async () => {
    // Mock operations
    // Update non-existent entity
    // Assert created_at set to current time
  });
});
```

**Coverage Target**: >90%

### Integration Tests (Real File System)

**File**: `tests/state-repository.integration.test.ts`

**Setup**: Use temp directory for real file operations.

#### Test Suite 1: Real File Operations

```typescript
describe('Integration: Real file operations', () => {
  let tempDir: string;
  let repo: StateRepository;
  
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-repo-test-'));
    const statePath = path.join(tempDir, '.aisanity-state.yml');
    repo = new StateRepository(statePath);
  });
  
  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
  
  test('creates and loads real state file', async () => {
    await repo.initialize();
    const state = await repo.load();
    expect(state.version).toBe('1.0');
  });
  
  test('atomic write prevents partial updates', async () => {
    // Create initial state
    // Start update that fails mid-way
    // Assert original file intact
  });
  
  test('handles concurrent access from multiple instances', async () => {
    // Create two repository instances
    // Perform concurrent updates
    // Assert both updates applied sequentially
  });
});
```

#### Test Suite 2: Concurrent Access Scenarios

```typescript
describe('Integration: Concurrent access', () => {
  test('prevents race conditions with real locks', async () => {
    // Spawn multiple concurrent updates
    // Assert all updates applied correctly
    // Assert no data corruption
  });
  
  test('handles lock timeout in real scenario', async () => {
    // Hold lock in one process
    // Try to acquire in another
    // Assert timeout error after configured duration
  });
});
```

#### Test Suite 3: Manual File Editing

```typescript
describe('Integration: Manual file editing', () => {
  test('detects and recovers from manual YAML errors', async () => {
    // Create valid state
    // Manually corrupt YAML
    // Attempt to load
    // Assert backup created
    // Assert error message helpful
  });
  
  test('accepts valid manual edits', async () => {
    // Create initial state
    // Manually edit with valid changes
    // Load state
    // Assert changes loaded correctly
  });
});
```

#### Test Suite 4: Large State Files

```typescript
describe('Integration: Performance', () => {
  test('handles large state files efficiently', async () => {
    // Create state with 100 features, 1000 tasks
    // Measure load time
    // Assert acceptable performance (<100ms)
  });
  
  test('handles many transitions efficiently', async () => {
    // Create entity with 100 transitions
    // Load and update
    // Assert acceptable performance
  });
});
```

---

## Development Phases

### Phase 1: Core Repository Foundation (Priority: Critical)

**Duration**: 1-2 days

**Deliverables**:
1. Project structure setup
2. Zod schemas defined
3. Type definitions exported
4. Error classes implemented
5. Basic StateRepository class skeleton

**Implementation Steps**:
1. Create directory structure: `src/state/`
2. Add `zod` dependency to package.json
3. Implement `schemas.ts`:
   - TransitionSchema
   - EntityStateSchema
   - TaskStateSchema
   - StateFileSchema
4. Implement `types.ts`:
   - Export inferred types from schemas
   - Define helper types (EntityType, EntityStateUpdater)
5. Implement `errors.ts`:
   - StateRepositoryError (base class)
   - StateValidationError
   - StateCorruptionError
   - LockTimeoutError
   - StateFileSecurityError
6. Create `state-repository.ts` skeleton:
   - Constructor
   - Method signatures (no implementation yet)

**Acceptance Criteria**:
- [ ] Directory structure created
- [ ] All schemas compile without errors
- [ ] All types exported correctly
- [ ] Error classes follow existing patterns
- [ ] Repository class structure defined

### Phase 2: Atomic File Operations (Priority: Critical)

**Duration**: 2-3 days

**Deliverables**:
1. File reading with validation
2. Atomic writing with temp file pattern
3. Security validation (symlink detection)
4. Backup creation on corruption

**Implementation Steps**:
1. Implement `load()` method:
   - Read file with `fs.readFile()`
   - Parse YAML with error handling
   - Validate against schema
   - Return validated state
2. Implement `atomicWrite()` private method:
   - Serialize to YAML with consistent formatting
   - Write to temp file
   - Atomic rename to target
   - Cleanup on error
3. Implement `save()` method:
   - Update last_updated timestamp
   - Validate before writing
   - Call atomicWrite()
4. Implement `validateStateFile()` private method:
   - Check if symlink
   - Check if regular file
   - Handle ENOENT gracefully
5. Implement `createBackup()` private method:
   - Generate timestamped filename
   - Copy corrupted file
   - Log backup creation
6. Implement `initialize()` method:
   - Check if file exists
   - Create default state if not
   - Validate if exists

**Acceptance Criteria**:
- [ ] Load() reads and validates state file
- [ ] Save() writes atomically using temp file
- [ ] Symlinks rejected with security error
- [ ] Backup created on YAML parse errors
- [ ] Initialize() creates default state
- [ ] Unit tests passing (mocked fs)

### Phase 3: Concurrency Control (Priority: High)

**Duration**: 2-3 days

**Deliverables**:
1. Lock acquisition with retry
2. Lock release with cleanup
3. Stale lock detection
4. Timeout handling

**Implementation Steps**:
1. Implement `acquireLock()` private method:
   - Create lock file with 'wx' flag (atomic)
   - Write lock content (PID + timestamp)
   - Retry loop with sleep
   - Check stale locks
   - Throw timeout error
2. Implement `releaseLock()` private method:
   - Delete lock file
   - Handle ENOENT gracefully
   - Log warnings on failure
3. Implement `checkStaleLock()` private method:
   - Read lock file content
   - Parse timestamp
   - Calculate age
   - Remove if stale
4. Add lock guards to load() and save():
   - Acquire lock before operation
   - Use try/finally to ensure release
5. Implement `sleep()` helper method

**Acceptance Criteria**:
- [ ] Lock acquired before all operations
- [ ] Lock released in finally block
- [ ] Stale locks detected and removed
- [ ] Timeout throws LockTimeoutError
- [ ] Concurrent access tests passing

### Phase 4: Entity Management (Priority: High)

**Duration**: 1-2 days

**Deliverables**:
1. Entity state retrieval
2. Entity state updates with updater pattern
3. Automatic entity initialization

**Implementation Steps**:
1. Implement `getEntityState()` method:
   - Look up entity in appropriate collection
   - Return entity state or null
2. Implement `initializeEntity()` private method:
   - Determine default state (feature vs task)
   - Create initial transition
   - Set created_at timestamp
3. Implement `updateEntityState()` method:
   - Acquire lock
   - Load current state
   - Get or initialize entity
   - Apply updater function
   - Validate updated state
   - Save atomically
   - Release lock

**Acceptance Criteria**:
- [ ] getEntityState() retrieves correct entity
- [ ] updateEntityState() applies updater atomically
- [ ] Missing entities auto-initialized
- [ ] Features default to 'discovered'
- [ ] Tasks default to 'file_exists'
- [ ] Unit tests passing

### Phase 5: Comprehensive Testing (Priority: Critical)

**Duration**: 2-3 days

**Deliverables**:
1. Full unit test suite (>90% coverage)
2. Integration tests with real file system
3. Concurrent access tests
4. Performance benchmarks

**Implementation Steps**:
1. Complete unit tests (all test suites listed above)
2. Complete integration tests
3. Add concurrent access tests:
   - Simulate multiple processes
   - Verify lock mechanism works
   - Ensure no data corruption
4. Add performance tests:
   - Measure load/save times
   - Test with large state files
   - Verify acceptable performance (<100ms for 1MB file)
5. Add edge case tests:
   - Empty state files
   - Missing fields
   - Corrupted transitions
   - Invalid timestamps
6. Review coverage report:
   - Ensure >90% coverage
   - Add tests for uncovered branches

**Acceptance Criteria**:
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Coverage >90%
- [ ] Concurrent access tests passing
- [ ] Performance tests passing
- [ ] No flaky tests

### Phase 6: Documentation & Polish (Priority: Medium)

**Duration**: 1 day

**Deliverables**:
1. JSDoc comments for all public methods
2. Usage examples in comments
3. Error message improvements
4. Code cleanup and refactoring

**Implementation Steps**:
1. Add JSDoc comments to all public methods:
   - Method purpose
   - Parameter descriptions
   - Return value description
   - Error conditions
   - Usage examples
2. Review error messages:
   - Ensure clarity
   - Include context
   - Suggest solutions
3. Code review and cleanup:
   - Remove debug code
   - Consistent naming
   - Extract magic numbers to constants
   - Improve readability
4. Create `index.ts` with public exports

**Acceptance Criteria**:
- [ ] All public APIs documented
- [ ] Error messages helpful and clear
- [ ] Code follows style guidelines
- [ ] No lint errors
- [ ] Public exports defined

---

## Dependencies

### Runtime Dependencies

#### 1. zod (NEW DEPENDENCY)

**Package**: `zod`  
**Version**: `^3.22.0`  
**Purpose**: Runtime schema validation with TypeScript type inference

**Installation**:
```bash
npm install zod
```

**Usage**:
```typescript
import { z } from 'zod';

const schema = z.object({ name: z.string() });
const validated = schema.parse({ name: 'test' });
```

**Why**: Specified in feature architecture, industry standard for TypeScript validation.

#### 2. yaml (EXISTING)

**Package**: `yaml`  
**Version**: `^2.3.0` (already in dependencies)  
**Purpose**: YAML parsing and serialization

**Usage**:
```typescript
import { YAML } from 'yaml';

const obj = YAML.parse(yamlString);
const yaml = YAML.stringify(obj, { indent: 2 });
```

**Why**: TypeScript-native, preserves formatting, specified in architecture.

#### 3. Node.js Built-ins

**Modules**:
- `fs/promises`: File system operations
- `path`: Path manipulation
- `os`: Operating system utilities (for temp directory)

**Why**: No dependencies, built into Node.js, well-documented.

### Development Dependencies (EXISTING)

#### 1. TypeScript

**Package**: `typescript`  
**Purpose**: TypeScript compilation

**Already in**: `devDependencies`

#### 2. Jest

**Package**: `jest`, `@types/jest`, `ts-jest`  
**Purpose**: Testing framework

**Already in**: `devDependencies`

#### 3. Node.js Types

**Package**: `@types/node`  
**Purpose**: TypeScript types for Node.js APIs

**Already in**: `devDependencies`

### package.json Changes

**Add to dependencies**:
```json
{
  "dependencies": {
    "zod": "^3.22.0"
  }
}
```

**No other changes needed** - all other dependencies already present.

### System Requirements

- **Node.js**: 22.x LTS or 24.x current
- **Operating System**: macOS, Linux, Windows (cross-platform)
- **File System**: POSIX-compliant (for atomic rename)

---

## Implementation Checklist

### Pre-Implementation

- [ ] Review feature architecture (`.feature/arch_100.md`)
- [ ] Review task requirements (`.task/100_1_10-state-file-yaml-repository.md`)
- [ ] Review this implementation plan
- [ ] Add `zod` to package.json dependencies
- [ ] Run `npm install`

### Phase 1: Core Foundation

- [ ] Create `src/state/` directory
- [ ] Implement `schemas.ts` with all Zod schemas
- [ ] Implement `types.ts` with inferred types
- [ ] Implement `errors.ts` with custom error classes
- [ ] Create `state-repository.ts` skeleton
- [ ] Verify all files compile without errors

### Phase 2: Atomic Operations

- [ ] Implement `load()` method
- [ ] Implement `atomicWrite()` private method
- [ ] Implement `save()` method
- [ ] Implement `validateStateFile()` private method
- [ ] Implement `createBackup()` private method
- [ ] Implement `initialize()` method
- [ ] Write unit tests for load/save operations
- [ ] Verify tests passing

### Phase 3: Concurrency Control

- [ ] Implement `acquireLock()` private method
- [ ] Implement `releaseLock()` private method
- [ ] Implement `checkStaleLock()` private method
- [ ] Implement `sleep()` helper method
- [ ] Add lock guards to load() and save()
- [ ] Write unit tests for locking mechanism
- [ ] Verify concurrent access tests passing

### Phase 4: Entity Management

- [ ] Implement `getEntityState()` method
- [ ] Implement `initializeEntity()` private method
- [ ] Implement `updateEntityState()` method
- [ ] Write unit tests for entity operations
- [ ] Verify entity initialization tests passing

### Phase 5: Testing

- [ ] Complete all unit tests (9 test suites)
- [ ] Complete integration tests (4 test suites)
- [ ] Run coverage report
- [ ] Add tests for uncovered code
- [ ] Verify >90% coverage achieved
- [ ] Test concurrent access scenarios
- [ ] Run performance benchmarks

### Phase 6: Documentation

- [ ] Add JSDoc comments to all public methods
- [ ] Review and improve error messages
- [ ] Code cleanup and refactoring
- [ ] Create `src/state/index.ts` with exports
- [ ] Run linter and fix issues
- [ ] Final code review

### Completion Criteria

- [ ] All tests passing (unit + integration)
- [ ] Coverage >90%
- [ ] No lint errors
- [ ] All public APIs documented
- [ ] Performance acceptable (<100ms for typical operations)
- [ ] Concurrent access protection verified
- [ ] Security validations implemented
- [ ] Error handling comprehensive

---

## Risk Analysis

### Risk 1: Lock File Race Conditions

**Probability**: Medium  
**Impact**: High (data corruption)

**Mitigation**:
- Use atomic file creation with 'wx' flag
- Implement stale lock detection
- Comprehensive concurrent access tests
- Use try/finally for lock cleanup

**Contingency**: If simple lock pattern insufficient, upgrade to `proper-lockfile` package.

### Risk 2: YAML Parsing Vulnerabilities

**Probability**: Low  
**Impact**: Medium (security issue)

**Mitigation**:
- Use actively maintained `yaml` package
- Validate parsed data with Zod
- Keep dependencies updated
- Monitor security advisories

**Contingency**: Can switch to alternative YAML parser if needed.

### Risk 3: File System Atomicity

**Probability**: Low  
**Impact**: High (data corruption)

**Mitigation**:
- Use temp file + rename pattern (POSIX atomic)
- Validate before writing
- Clean up temp files on error
- Integration tests with real file system

**Contingency**: On platforms without atomic rename, implement two-phase commit pattern.

### Risk 4: Performance Degradation

**Probability**: Low  
**Impact**: Medium (slow operations)

**Mitigation**:
- Performance benchmarks in tests
- Profile with realistic data sizes
- Set performance targets (<100ms)

**Contingency**: Implement in-memory caching if needed (clear upgrade path).

### Risk 5: Schema Evolution

**Probability**: High  
**Impact**: Low (breaking changes)

**Mitigation**:
- Version field in state file
- Clear schema versioning strategy
- Backward compatibility consideration

**Contingency**: Implement schema migration system in future (out of scope for MVP).

---

## Success Metrics

### Code Quality Metrics

- **Test Coverage**: >90% (requirement)
- **Lint Errors**: 0
- **TypeScript Errors**: 0
- **Documentation Coverage**: 100% of public APIs

### Performance Metrics

- **Load Operation**: <50ms for 1MB file
- **Save Operation**: <100ms for 1MB file
- **Lock Acquisition**: <10ms (no contention)
- **Lock Timeout**: Configurable (5s default)

### Reliability Metrics

- **Atomic Operations**: 100% (no partial writes)
- **Lock Protection**: 100% (no race conditions)
- **Validation**: 100% (all operations validated)
- **Error Recovery**: Backup created on 100% of corruption events

### Integration Metrics

- **API Stability**: All public methods stable
- **Type Safety**: 100% (full TypeScript typing)
- **Error Clarity**: All errors include helpful context
- **Upgrade Path**: Clear migration to enhanced features

---

## Future Enhancements (Out of Scope)

These are explicitly deferred to maintain focus on core functionality:

1. **In-Memory Caching**: Cache state file with file watching for faster reads
2. **Proper File Locking**: Upgrade to `proper-lockfile` for multi-user scenarios
3. **Partial Updates**: Update specific entities without full file rewrite
4. **State Archival**: Move old transitions to separate archive file
5. **State Migration**: Automatic schema version migration
6. **Optimistic Locking**: Version numbers for conflict detection
7. **Distributed State**: Share state across multiple machines
8. **State Compression**: Compress large state files
9. **State Snapshots**: Point-in-time snapshots for rollback
10. **Streaming Parser**: Handle very large state files efficiently

---

## Conclusion

This implementation plan provides a comprehensive roadmap for building a production-ready StateRepository class. The plan follows the architectural analysis closely and ensures:

✅ **Reliability**: Atomic operations, validation, comprehensive error handling  
✅ **Simplicity**: Clean API, minimal dependencies, clear upgrade paths  
✅ **Maintainability**: Well-structured code, extensive tests, clear documentation  
✅ **Security**: Input validation, symlink protection, lock security  
✅ **Performance**: Fast enough for CLI, optimizable if needed  
✅ **Integration**: Clear contracts for downstream tasks

The phased approach ensures incremental progress with testable milestones. Each phase builds upon the previous one, with testing integrated throughout.

**Ready for Implementation**: This plan is ready to execute. All design decisions are made, all interfaces defined, and all tests specified.

---

**Plan Version**: 1.0  
**Last Updated**: 2025-10-03  
**Planner**: AI Implementation Planner (Claude)
