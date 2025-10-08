# Implementation Plan: Workflow Config YAML Loader

**Task ID:** 100_1_20  
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

Implement a robust WorkflowConfigLoader class that loads, validates, and provides type-safe access to user-editable workflow configuration files. This component serves as the **definition layer** for the state machine system, defining available states, transitions, commands, and rules for feature and task workflows.

### Architectural Foundation

Based on the architectural analysis, this implementation will follow these key principles:

1. **Schema Validation**: Zod-based runtime validation with TypeScript type inference
2. **Command-Duration Caching**: Simple in-memory cache for command execution lifetime
3. **Command Security**: Strict allowlist validation preventing command injection
4. **Fail-Fast Design**: Early validation with helpful error messages
5. **User-Editable Config**: YAML-based configuration that users can modify without code changes
6. **Clear Separation**: Configuration (definitions) vs. State (runtime data)

### Key Design Decisions

Following the **IMPORTANT** architectural decisions:

- **Command-Duration Caching**: Cache config for single command execution (no stale data)
- **Zod for Validation**: TypeScript-first with type inference from schemas
- **Strict Command Allowlist**: Only safe, pre-approved command prefixes allowed
- **Fail-Fast Validation**: Validate at config load time, not execution time
- **User-Editable YAML**: Flexibility without code changes, with comprehensive validation
- **Separate State Machines**: Distinct feature_states and task_states configurations
- **No File Watching**: Simple load-on-demand pattern (sufficient for CLI)
- **Example Config**: Self-documenting example file with comprehensive comments

---

## Integration Strategy

### Integration Status

**This is a foundational task with NO dependencies.**

As noted in the architectural analysis:
> "This is a foundational task with no dependencies. It provides the workflow configuration layer that will be used by the state machine engine (100_1_40)."

This task runs **in parallel** with task 100_1_10 (State File YAML Repository):
- **StateRepository** (100_1_10): Manages *runtime state* (current states, transition history)
- **WorkflowConfigLoader** (100_1_20): Manages *workflow definitions* (available states, transition rules)

### Future Integration Points

This WorkflowConfigLoader will be consumed by downstream tasks:

#### 1. State Machine Engine (Task 100_1_40)

**Integration Pattern**:
```typescript
// State Machine will inject BOTH StateRepository and WorkflowConfigLoader
class StateMachine {
  constructor(
    private stateRepo: StateRepository,        // From 100_1_10
    private configLoader: WorkflowConfigLoader // From 100_1_20
  ) {}
  
  async executeTransition(
    id: string,
    type: 'feature' | 'task',
    transitionName: string
  ): Promise<void> {
    // 1. Get current state from StateRepository
    const state = await this.stateRepo.load();
    const currentEntityState = state[type === 'feature' ? 'features' : 'tasks'][id];
    
    if (!currentEntityState) {
      throw new Error(`Entity ${id} not found`);
    }
    
    // 2. Get transition definition from WorkflowConfigLoader
    const config = await this.configLoader.load();
    const stateDef = this.configLoader.getStateDefinition(
      currentEntityState.current_state,
      type
    );
    
    if (!stateDef) {
      throw new Error(`State ${currentEntityState.current_state} not defined`);
    }
    
    const transition = stateDef.transitions[transitionName];
    if (!transition) {
      throw new Error(`Transition ${transitionName} not found`);
    }
    
    // 3. Execute command (from config definition)
    const exitCode = await this.commandExecutor.execute(
      transition.command,
      transition.requires_confirmation
    );
    
    // 4. Determine next state based on exit code
    const nextState = exitCode === 0
      ? transition.next_state_on_success
      : transition.next_state_on_failure;
    
    // 5. Update state in StateRepository
    await this.stateRepo.updateEntityState(id, type, (entity) => ({
      ...entity,
      current_state: nextState,
      transitions: [
        ...entity.transitions,
        {
          from: entity.current_state,
          to: nextState,
          command: transition.command,
          exit_code: exitCode,
          timestamp: new Date().toISOString()
        }
      ]
    }));
  }
}
```

**CRITICAL**: The state machine uses WorkflowConfigLoader for **what transitions are possible** and StateRepository for **what state entities are currently in**.

#### 2. Status Visualization Commands (Tasks 100_2_20, 100_2_30)

**Integration Pattern**:
```typescript
// Status commands read workflow definitions for display
class StatusCommand {
  constructor(
    private stateRepo: StateRepository,
    private configLoader: WorkflowConfigLoader
  ) {}
  
  async execute() {
    const config = await this.configLoader.load();
    const state = await this.stateRepo.load();
    
    // Display current states with available transitions
    for (const [id, entity] of Object.entries(state.features)) {
      const stateDef = this.configLoader.getStateDefinition(
        entity.current_state,
        'feature'
      );
      
      console.log(`Feature ${id}: ${entity.current_state}`);
      if (stateDef) {
        console.log('  Available transitions:');
        for (const [name, trans] of Object.entries(stateDef.transitions)) {
          console.log(`    - ${name}: ${trans.command}`);
        }
      }
    }
  }
}
```

#### 3. Feature Next Command (Task 100_2_40)

**Integration Pattern**:
```typescript
// Feature next command uses config to determine next transition
class FeatureNextCommand {
  constructor(
    private stateRepo: StateRepository,
    private configLoader: WorkflowConfigLoader
  ) {}
  
  async execute(featureId: string) {
    const state = await this.stateRepo.load();
    const feature = state.features[featureId];
    
    if (!feature) {
      throw new Error(`Feature ${featureId} not found`);
    }
    
    const stateDef = this.configLoader.getStateDefinition(
      feature.current_state,
      'feature'
    );
    
    if (!stateDef) {
      throw new Error(`State ${feature.current_state} not defined`);
    }
    
    // Get first available transition (or apply logic)
    const transitions = Object.entries(stateDef.transitions);
    if (transitions.length === 0) {
      console.log('No transitions available (terminal state)');
      return;
    }
    
    const [transName, trans] = transitions[0];
    console.log(`Next transition: ${transName}`);
    console.log(`Command: ${trans.command}`);
    console.log(`Requires confirmation: ${trans.requires_confirmation}`);
  }
}
```

### Export Contract

The WorkflowConfigLoader will export:

```typescript
// src/workflow/index.ts
export { WorkflowConfigLoader } from './workflow-config-loader';
export { 
  WorkflowConfigSchema, 
  StateDefinitionSchema, 
  TransitionSchema,
  SettingsSchema 
} from './schemas';
export type { 
  WorkflowConfig, 
  StateDefinition, 
  Transition, 
  Settings,
  EntityType 
} from './types';
export { 
  WorkflowConfigError, 
  ConfigNotFoundError, 
  ConfigParseError, 
  ConfigValidationError,
  CommandValidationError 
} from './errors';
export { validateCommand, ALLOWED_COMMAND_PREFIXES } from './command-validator';
```

### Integration Testing Requirements

When future tasks integrate with WorkflowConfigLoader:

1. **Unit Tests**: Mock WorkflowConfigLoader for isolated testing
2. **Integration Tests**: Test with real WorkflowConfigLoader instance and example config
3. **Combined Tests**: Test StateRepository + WorkflowConfigLoader working together
4. **Validation Tests**: Ensure invalid configs are rejected with helpful errors

### CRITICAL Integration Requirements

**IMPORTANT**: When implementing downstream tasks (especially 100_1_40):

1. **DO NOT hardcode workflow definitions** - Always use `WorkflowConfigLoader.getStateDefinition()`
2. **DO NOT hardcode state data** - Always use `StateRepository.getEntityState()` (from 100_1_10)
3. **DO NOT mix configuration and state** - Keep `.aisanity-workflow.yml` read-only
4. **DO validate transitions** - Check transition exists in config before executing
5. **DO handle both success and failure paths** - Use `next_state_on_success` and `next_state_on_failure`
6. **DO respect confirmation settings** - Check `requires_confirmation` before executing commands

---

## Component Details

### File Structure

```
src/
  workflow/
    workflow-config-loader.ts  # Main WorkflowConfigLoader class
    schemas.ts                  # Zod schemas for validation
    types.ts                    # TypeScript interfaces and types
    errors.ts                   # Custom error classes
    command-validator.ts        # Command validation logic
    index.ts                    # Public exports
    
tests/
  workflow-config-loader.test.ts              # Unit tests (mocked fs)
  workflow-config-loader.integration.test.ts  # Integration tests (real fs)
  command-validator.test.ts                   # Command validation tests

examples/
  .aisanity-workflow.yml      # Example config with comprehensive comments
```

### Component Responsibilities

#### 1. WorkflowConfigLoader Class (`workflow-config-loader.ts`)

**Primary Responsibilities**:
- Load `.aisanity-workflow.yml` file
- Parse YAML with error handling
- Validate against schema with Zod
- Cache configuration for command duration
- Provide type-safe access to state definitions and transitions
- Validate commands against allowlist

**Key Methods**:
- `load()`: Load and cache workflow configuration
- `validate()`: Validate configuration without caching
- `getStateDefinition()`: Retrieve state definition by name
- `getTransition()`: Retrieve transition definition
- `clearCache()`: Clear cache (for testing)

**Private Methods**:
- `loadFromFile()`: Read and parse YAML file
- `validateConfig()`: Validate parsed config with Zod
- `checkConfigPath()`: Validate config file path security

#### 2. Schema Definitions (`schemas.ts`)

**Responsibilities**:
- Define Zod schemas for runtime validation
- Export schemas for reuse in other modules
- Provide type inference for TypeScript types
- Embed command validation in schemas

**Schemas**:
- `SettingsSchema`: Global settings (confirmation, timeouts)
- `TransitionSchema`: Individual transition definition
- `StateDefinitionSchema`: State with transitions
- `WorkflowConfigSchema`: Complete workflow configuration

#### 3. Type Definitions (`types.ts`)

**Responsibilities**:
- Export TypeScript types inferred from Zod schemas
- Define additional helper types
- Provide type aliases for clarity

**Types**:
- `WorkflowConfig`: Root configuration structure
- `Settings`: Global settings
- `StateDefinition`: State with transitions
- `Transition`: Transition definition
- `EntityType`: Union type ('feature' | 'task')

#### 4. Error Classes (`errors.ts`)

**Responsibilities**:
- Define custom error types for specific failure scenarios
- Include contextual information in errors
- Follow existing codebase error handling patterns

**Error Types**:
- `WorkflowConfigError`: Base error class
- `ConfigNotFoundError`: Config file not found
- `ConfigParseError`: YAML parsing failures
- `ConfigValidationError`: Schema validation failures
- `CommandValidationError`: Command not in allowlist

#### 5. Command Validator (`command-validator.ts`)

**Responsibilities**:
- Define allowed command prefixes
- Validate commands against allowlist
- Prevent command injection patterns
- Validate variable placeholders

**Key Functions**:
- `validateCommand()`: Check if command is allowed
- `validateVariables()`: Validate variable placeholders
- `ALLOWED_COMMAND_PREFIXES`: Constant array of allowed prefixes

---

## Data Structures

### Workflow Config File Structure

**File**: `.aisanity-workflow.yml`

```yaml
# Aisanity Workflow Configuration
version: "1.0"

# Global settings
settings:
  confirmation:
    enabled: true
    skip_for_read_only: true  # Don't confirm for status/list commands
  
  timeout:
    default: 300000  # 5 minutes (in milliseconds)
    per_command:
      "opencode run": 600000  # 10 minutes for AI commands

# Feature workflow state machine
feature_states:
  discovered:
    description: "Feature file exists but not decomposed"
    transitions:
      decompose:
        command: "opencode run /feature_decompose --feature-id {id}"
        next_state_on_success: "decomposed"
        next_state_on_failure: "discovered"
        requires_confirmation: true
  
  decomposed:
    description: "Feature has been broken into tasks"
    transitions:
      start:
        command: "git town hack feature/{id}-phase-{phase}"
        next_state_on_success: "in_progress"
        next_state_on_failure: "decomposed"
        requires_confirmation: true
  
  in_progress:
    description: "Feature is being worked on"
    transitions:
      complete:
        command: "git town sync"
        next_state_on_success: "completed"
        next_state_on_failure: "in_progress"
        requires_confirmation: true
  
  completed:
    description: "Feature is complete"
    transitions: {}

# Task workflow state machine
task_states:
  file_exists:
    description: "Task file exists but not planned"
    transitions:
      plan:
        command: "opencode run /auto_plan --task-id {id}"
        next_state_on_success: "planned"
        next_state_on_failure: "file_exists"
        requires_confirmation: true
  
  planned:
    description: "Task has an implementation plan"
    transitions:
      start:
        command: "git town append feature/{id}-{title}"
        next_state_on_success: "in_progress"
        next_state_on_failure: "planned"
        requires_confirmation: true
  
  in_progress:
    description: "Task is being implemented"
    transitions:
      complete:
        command: "git commit -am 'Complete task {id}'"
        next_state_on_success: "completed"
        next_state_on_failure: "in_progress"
        requires_confirmation: false
  
  completed:
    description: "Task is complete"
    transitions: {}

# Variable definitions (for documentation)
variables:
  id: "Feature or task ID (e.g., 100, 100_1_10)"
  title: "Kebab-case title extracted from filename"
  feature_id: "Parent feature ID for tasks"
  phase: "Phase number extracted from task ID (e.g., 1 from 100_1_10)"
```

### Zod Schema Definitions

#### SettingsSchema

```typescript
import { z } from 'zod';

export const SettingsSchema = z.object({
  confirmation: z.object({
    enabled: z.boolean(),
    skip_for_read_only: z.boolean()
  }),
  timeout: z.object({
    default: z.number().positive(),
    per_command: z.record(z.number().positive()).optional()
  })
});
```

**Purpose**: Global workflow settings for confirmation and timeout behavior.

**Fields**:
- `confirmation.enabled`: Whether to require confirmation for transitions
- `confirmation.skip_for_read_only`: Skip confirmation for read-only commands
- `timeout.default`: Default command timeout in milliseconds
- `timeout.per_command`: Per-command timeout overrides (optional)

#### TransitionSchema

```typescript
import { validateCommand } from './command-validator';

export const TransitionSchema = z.object({
  command: z.string()
    .refine(validateCommand, {
      message: 'Command not in allowlist. Must start with one of: ' +
        'git town, git commit, git push, opencode run, npm run, node dist/'
    }),
  next_state_on_success: z.string(),
  next_state_on_failure: z.string(),
  requires_confirmation: z.boolean()
});
```

**Purpose**: Define a single transition with command and target states.

**Fields**:
- `command`: Command to execute (must pass allowlist validation)
- `next_state_on_success`: Target state if command exits with code 0
- `next_state_on_failure`: Target state if command exits with non-zero code
- `requires_confirmation`: Whether to prompt user before executing

**IMPORTANT**: Command validation happens at schema validation time, ensuring only safe commands are stored in config.

#### StateDefinitionSchema

```typescript
export const StateDefinitionSchema = z.object({
  description: z.string(),
  transitions: z.record(TransitionSchema)
});
```

**Purpose**: Define a state with its available transitions.

**Fields**:
- `description`: Human-readable description of state
- `transitions`: Map of transition name → Transition definition

#### WorkflowConfigSchema

```typescript
export const WorkflowConfigSchema = z.object({
  version: z.string(),
  settings: SettingsSchema,
  feature_states: z.record(StateDefinitionSchema),
  task_states: z.record(StateDefinitionSchema),
  variables: z.record(z.string()).optional()
});
```

**Purpose**: Root schema for entire workflow configuration.

**Fields**:
- `version`: Schema version (currently "1.0")
- `settings`: Global settings
- `feature_states`: Map of state name → StateDefinition (for features)
- `task_states`: Map of state name → StateDefinition (for tasks)
- `variables`: Variable documentation (optional, not used at runtime)

### Type Inference

```typescript
// types.ts
import type { z } from 'zod';
import type { 
  WorkflowConfigSchema, 
  StateDefinitionSchema, 
  TransitionSchema,
  SettingsSchema 
} from './schemas';

// Infer TypeScript types from Zod schemas
export type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type StateDefinition = z.infer<typeof StateDefinitionSchema>;
export type Transition = z.infer<typeof TransitionSchema>;

// Helper types
export type EntityType = 'feature' | 'task';

// Config path validation result
export interface ConfigPathValidation {
  valid: boolean;
  error?: string;
}
```

**Benefits**:
- Single source of truth (schemas define both validation and types)
- Type safety throughout codebase
- Automatic type updates when schemas change

---

## API Design

### Public API

#### Constructor

```typescript
class WorkflowConfigLoader {
  constructor(
    private configPath: string = '.aisanity-workflow.yml'
  ) {}
}
```

**Parameters**:
- `configPath`: Path to workflow config file (default: `.aisanity-workflow.yml`)

**Design Note**: Constructor accepts path for testability and flexibility.

#### load()

```typescript
async load(): Promise<WorkflowConfig>
```

**Purpose**: Load, parse, validate, and cache workflow configuration.

**Behavior**:
1. Check cache - return if valid
2. Check if file exists
3. Validate file security (not symlink)
4. Read file contents
5. Parse YAML
6. Validate against schema
7. Cache result
8. Return validated config

**Example**:
```typescript
const loader = new WorkflowConfigLoader();
const config = await loader.load();

console.log(`Version: ${config.version}`);
console.log(`Feature states: ${Object.keys(config.feature_states).join(', ')}`);
console.log(`Task states: ${Object.keys(config.task_states).join(', ')}`);
```

**Error Handling**:
- Throws `ConfigNotFoundError` if file doesn't exist
- Throws `ConfigParseError` on YAML syntax error
- Throws `ConfigValidationError` on schema validation failure
- Throws `WorkflowConfigError` on other errors

**Cache Behavior**: Config cached for command duration (until process exits or `clearCache()` called).

#### validate()

```typescript
validate(config: unknown): WorkflowConfig
```

**Purpose**: Validate configuration object without loading from file or caching.

**Behavior**:
1. Parse config with WorkflowConfigSchema
2. Return validated config
3. Throw error if invalid

**Example**:
```typescript
const loader = new WorkflowConfigLoader();

// Validate programmatically created config
const config = {
  version: '1.0',
  settings: { /* ... */ },
  feature_states: { /* ... */ },
  task_states: { /* ... */ }
};

try {
  const validated = loader.validate(config);
  console.log('Config is valid');
} catch (error) {
  console.error('Config validation failed:', error.message);
}
```

**Use Case**: Testing, programmatic config generation, migration tools.

**Error Handling**:
- Throws `ConfigValidationError` if config is invalid
- Includes detailed Zod validation errors in exception

#### getStateDefinition()

```typescript
getStateDefinition(
  stateName: string,
  type: EntityType
): StateDefinition | null
```

**Purpose**: Retrieve state definition from cached configuration.

**Behavior**:
1. Get cached config (throws if not loaded)
2. Look up state in appropriate collection (feature_states or task_states)
3. Return state definition or null if not found

**Example**:
```typescript
const loader = new WorkflowConfigLoader();
await loader.load();

const stateDef = loader.getStateDefinition('discovered', 'feature');
if (stateDef) {
  console.log(`Description: ${stateDef.description}`);
  console.log('Transitions:');
  for (const [name, trans] of Object.entries(stateDef.transitions)) {
    console.log(`  ${name}: ${trans.command}`);
  }
}
```

**Design Note**: This is a synchronous method that requires config to be loaded first. Throws error if called before `load()`.

**Error Handling**:
- Throws `WorkflowConfigError` if config not loaded
- Returns `null` if state not found (not an error - allows caller to handle)

#### getTransition()

```typescript
getTransition(
  fromState: string,
  transitionName: string,
  type: EntityType
): Transition | null
```

**Purpose**: Retrieve specific transition definition from cached configuration.

**Behavior**:
1. Get cached config
2. Get state definition
3. Look up transition by name
4. Return transition or null if not found

**Example**:
```typescript
const loader = new WorkflowConfigLoader();
await loader.load();

const transition = loader.getTransition('discovered', 'decompose', 'feature');
if (transition) {
  console.log(`Command: ${transition.command}`);
  console.log(`On success → ${transition.next_state_on_success}`);
  console.log(`On failure → ${transition.next_state_on_failure}`);
  console.log(`Requires confirmation: ${transition.requires_confirmation}`);
}
```

**Design Note**: Convenience method that combines state lookup + transition lookup.

**Error Handling**:
- Throws `WorkflowConfigError` if config not loaded
- Returns `null` if state or transition not found

#### clearCache()

```typescript
clearCache(): void
```

**Purpose**: Clear cached configuration (primarily for testing).

**Behavior**:
1. Set cache to null
2. Clear cache timestamp

**Example**:
```typescript
const loader = new WorkflowConfigLoader();
await loader.load(); // Loads and caches

loader.clearCache(); // Clear cache

await loader.load(); // Loads again from file
```

**Use Case**: Testing, forcing config reload, cleanup.

### Private Methods

#### loadFromFile()

```typescript
private async loadFromFile(): Promise<unknown>
```

**Purpose**: Read and parse workflow config file.

**Implementation**:
```typescript
private async loadFromFile(): Promise<unknown> {
  // Validate path security
  await this.checkConfigPath();
  
  // Check if file exists
  try {
    await fs.access(this.configPath);
  } catch (error) {
    throw new ConfigNotFoundError(this.configPath);
  }
  
  // Read file
  const content = await fs.readFile(this.configPath, 'utf8');
  
  // Parse YAML
  try {
    const parsed = YAML.parse(content);
    return parsed;
  } catch (error) {
    throw new ConfigParseError(
      `YAML syntax error in ${this.configPath}: ${error.message}`,
      error
    );
  }
}
```

#### validateConfig()

```typescript
private validateConfig(config: unknown): WorkflowConfig
```

**Purpose**: Validate parsed config against schema.

**Implementation**:
```typescript
private validateConfig(config: unknown): WorkflowConfig {
  try {
    return WorkflowConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ConfigValidationError(error);
    }
    throw error;
  }
}
```

#### checkConfigPath()

```typescript
private async checkConfigPath(): Promise<void>
```

**Purpose**: Validate config file path security (prevent symlinks, path traversal).

**Implementation**:
```typescript
private async checkConfigPath(): Promise<void> {
  const resolved = path.resolve(this.configPath);
  const projectRoot = process.cwd();
  
  // Ensure path is within project
  if (!resolved.startsWith(projectRoot)) {
    throw new WorkflowConfigError('Config path must be within project root');
  }
  
  try {
    const stats = await fs.lstat(this.configPath);
    
    if (stats.isSymbolicLink()) {
      throw new WorkflowConfigError('Config file cannot be a symlink');
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist - this is OK (will be caught later)
      return;
    }
    throw error;
  }
}
```

---

## User Interaction Flow

### Flow 1: Load Configuration (First Time)

**Scenario**: User runs first command, config loaded for first time.

**Steps**:
1. Command creates `WorkflowConfigLoader` instance
2. Command calls `loader.load()`
3. Loader checks cache → empty (first load)
4. Loader validates config path security
5. Loader reads `.aisanity-workflow.yml`
6. Loader parses YAML
7. Loader validates against schema
8. Loader validates all commands against allowlist
9. Loader caches validated config
10. Loader returns config to command
11. Command uses config data

**Result**: Configuration loaded, validated, and cached. ~4ms total.

### Flow 2: Load Configuration (Cached)

**Scenario**: User runs second command in same session.

**Steps**:
1. Command creates `WorkflowConfigLoader` instance
2. Command calls `loader.load()`
3. Loader checks cache → hit
4. Loader returns cached config immediately

**Result**: Configuration retrieved from cache. ~0.2ms total.

### Flow 3: Get State Definition

**Scenario**: State machine needs to check available transitions.

**Steps**:
1. State machine has loaded config
2. State machine calls `loader.getStateDefinition('discovered', 'feature')`
3. Loader checks cache (throws if not loaded)
4. Loader looks up 'discovered' in `config.feature_states`
5. Loader returns `StateDefinition` object
6. State machine examines transitions

**Result**: State definition retrieved with all transition definitions.

**Example Output**:
```typescript
{
  description: "Feature file exists but not decomposed",
  transitions: {
    decompose: {
      command: "opencode run /feature_decompose --feature-id {id}",
      next_state_on_success: "decomposed",
      next_state_on_failure: "discovered",
      requires_confirmation: true
    }
  }
}
```

### Flow 4: Validation Error (Invalid Command)

**Scenario**: User edits config file, adds command not in allowlist.

**Steps**:
1. User edits `.aisanity-workflow.yml`
2. User adds transition with command `"rm -rf /"`
3. User runs `aisanity feature status`
4. Command calls `loader.load()`
5. Loader reads file successfully
6. Loader parses YAML successfully
7. Loader validates against schema
8. Command validation fails (not in allowlist)
9. Zod throws `ZodError` with validation details
10. Loader catches and wraps in `ConfigValidationError`
11. User sees error message:
```
Config validation failed:
feature_states.discovered.transitions.bad_command.command: Command not in allowlist. Must start with one of: git town, git commit, git push, opencode run, npm run, node dist/
```

**Result**: Invalid command rejected with helpful error message pointing to exact location.

### Flow 5: Validation Error (YAML Syntax)

**Scenario**: User edits config file, introduces YAML syntax error.

**Steps**:
1. User edits `.aisanity-workflow.yml`
2. User introduces syntax error (e.g., invalid indentation)
3. User runs command
4. Command calls `loader.load()`
5. Loader reads file
6. YAML parsing fails → `YAMLParseError`
7. Loader catches and wraps in `ConfigParseError`
8. User sees error message:
```
YAML syntax error in .aisanity-workflow.yml: Indentation error at line 15
```

**Result**: YAML error detected with line number for easy fixing.

### Flow 6: Get Transition Definition

**Scenario**: State machine needs specific transition details.

**Steps**:
1. State machine calls `loader.getTransition('discovered', 'decompose', 'feature')`
2. Loader gets state definition for 'discovered'
3. Loader looks up 'decompose' transition
4. Loader returns `Transition` object
5. State machine uses transition details to execute command

**Result**: Specific transition retrieved with full details.

**Example Output**:
```typescript
{
  command: "opencode run /feature_decompose --feature-id {id}",
  next_state_on_success: "decomposed",
  next_state_on_failure: "discovered",
  requires_confirmation: true
}
```

### Flow 7: Config File Not Found

**Scenario**: User runs command before creating workflow config.

**Steps**:
1. User runs `aisanity feature status`
2. Command calls `loader.load()`
3. Loader checks if `.aisanity-workflow.yml` exists
4. File doesn't exist → `ENOENT`
5. Loader throws `ConfigNotFoundError`
6. User sees error message:
```
Workflow config not found: .aisanity-workflow.yml

Please create a workflow configuration file. See examples/.aisanity-workflow.yml for a template.
```

**Result**: Clear error message with guidance on how to fix.

---

## Testing Strategy

### Unit Tests (Mocked File System)

**File**: `tests/workflow-config-loader.test.ts`

**Mocking Strategy**: Use `jest.mock('fs/promises')` to mock file system operations.

#### Test Suite 1: Loading and Caching

```typescript
describe('WorkflowConfigLoader.load()', () => {
  test('loads and validates valid config file', async () => {
    // Mock fs.readFile to return valid YAML
    // Call load()
    // Assert config object matches expected structure
  });
  
  test('caches config after first load', async () => {
    // Mock fs.readFile
    // Call load() twice
    // Assert fs.readFile only called once
  });
  
  test('throws ConfigNotFoundError when file does not exist', async () => {
    // Mock fs.access to throw ENOENT
    // Assert ConfigNotFoundError thrown
  });
  
  test('throws ConfigParseError on YAML syntax error', async () => {
    // Mock fs.readFile to return invalid YAML
    // Assert ConfigParseError thrown
    // Assert error message includes line information
  });
  
  test('throws ConfigValidationError on schema validation failure', async () => {
    // Mock fs.readFile to return invalid structure
    // Assert ConfigValidationError thrown
    // Assert error includes Zod validation details
  });
  
  test('rejects symlink config files', async () => {
    // Mock fs.lstat to return symlink
    // Assert WorkflowConfigError thrown
  });
});
```

#### Test Suite 2: Validation

```typescript
describe('WorkflowConfigLoader.validate()', () => {
  test('validates correct config object', () => {
    // Create valid config object
    // Call validate()
    // Assert no error thrown
    // Assert returned object matches input
  });
  
  test('rejects invalid config structure', () => {
    // Create config missing required fields
    // Assert ConfigValidationError thrown
  });
  
  test('rejects config with invalid command', () => {
    // Create config with command not in allowlist
    // Assert ConfigValidationError thrown
    // Assert error message mentions allowlist
  });
  
  test('rejects config with wrong data types', () => {
    // Create config with wrong types (e.g., number for string)
    // Assert ConfigValidationError thrown
  });
  
  test('accepts config with optional fields omitted', () => {
    // Create config without optional variables field
    // Assert validation succeeds
  });
});
```

#### Test Suite 3: State Definition Retrieval

```typescript
describe('WorkflowConfigLoader.getStateDefinition()', () => {
  test('returns state definition when found', async () => {
    // Load config with known states
    // Call getStateDefinition()
    // Assert correct state definition returned
  });
  
  test('returns null when state not found', async () => {
    // Load config
    // Call getStateDefinition() with non-existent state
    // Assert null returned
  });
  
  test('distinguishes between feature and task states', async () => {
    // Load config with states in both collections
    // Call getStateDefinition() for each type
    // Assert correct state returned from correct collection
  });
  
  test('throws error when called before load()', async () => {
    // Create loader (don't call load)
    // Call getStateDefinition()
    // Assert WorkflowConfigError thrown
  });
});
```

#### Test Suite 4: Transition Retrieval

```typescript
describe('WorkflowConfigLoader.getTransition()', () => {
  test('returns transition when found', async () => {
    // Load config
    // Call getTransition() with valid state and transition
    // Assert correct transition returned
  });
  
  test('returns null when state not found', async () => {
    // Load config
    // Call getTransition() with non-existent state
    // Assert null returned
  });
  
  test('returns null when transition not found', async () => {
    // Load config
    // Call getTransition() with valid state, invalid transition
    // Assert null returned
  });
  
  test('returns transition with all required fields', async () => {
    // Load config
    // Get transition
    // Assert has command, next_state_on_success, next_state_on_failure, requires_confirmation
  });
});
```

#### Test Suite 5: Cache Management

```typescript
describe('Cache management', () => {
  test('clearCache() clears cached config', async () => {
    // Load config
    // Clear cache
    // Load again
    // Assert file read twice
  });
  
  test('cache is process-scoped', async () => {
    // Load config in one instance
    // Create new instance
    // Load in new instance
    // Assert file read twice (no shared cache)
  });
});
```

#### Test Suite 6: Error Messages

```typescript
describe('Error messages', () => {
  test('validation error includes field path', () => {
    // Validate config with nested error
    // Assert error message includes full path (e.g., "feature_states.discovered.transitions.x.command")
  });
  
  test('parse error includes file name', async () => {
    // Mock invalid YAML
    // Attempt load
    // Assert error message includes config path
  });
  
  test('not found error suggests solution', async () => {
    // Mock file not found
    // Attempt load
    // Assert error message suggests creating config file
  });
});
```

**Coverage Target**: >90%

### Integration Tests (Real File System)

**File**: `tests/workflow-config-loader.integration.test.ts`

**Setup**: Use temp directory for real file operations.

#### Test Suite 1: Real File Operations

```typescript
describe('Integration: Real file operations', () => {
  let tempDir: string;
  let loader: WorkflowConfigLoader;
  
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-loader-test-'));
    const configPath = path.join(tempDir, '.aisanity-workflow.yml');
    loader = new WorkflowConfigLoader(configPath);
  });
  
  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
  
  test('loads real example config file', async () => {
    // Copy examples/.aisanity-workflow.yml to temp dir
    // Load with real loader
    // Assert all states and transitions loaded correctly
  });
  
  test('detects real YAML syntax errors', async () => {
    // Write invalid YAML to file
    // Attempt to load
    // Assert ConfigParseError thrown with helpful message
  });
  
  test('validates real command strings', async () => {
    // Write config with various commands
    // Load and validate
    // Assert allowed commands pass, disallowed fail
  });
});
```

#### Test Suite 2: Example Config Validation

```typescript
describe('Integration: Example config', () => {
  test('example config is valid', async () => {
    // Load examples/.aisanity-workflow.yml
    // Assert loads without errors
    // Assert has expected states
  });
  
  test('all example commands are in allowlist', async () => {
    // Load example config
    // Extract all commands
    // Assert all pass validation
  });
});
```

### Command Validator Tests

**File**: `tests/command-validator.test.ts`

#### Test Suite: Command Validation

```typescript
describe('validateCommand()', () => {
  test('allows git town commands', () => {
    expect(validateCommand('git town hack feature/100')).toBe(true);
    expect(validateCommand('git town append task-123')).toBe(true);
    expect(validateCommand('git town sync')).toBe(true);
  });
  
  test('allows git commit commands', () => {
    expect(validateCommand('git commit -am "message"')).toBe(true);
  });
  
  test('allows git push commands', () => {
    expect(validateCommand('git push')).toBe(true);
  });
  
  test('allows opencode run commands', () => {
    expect(validateCommand('opencode run /feature_decompose --feature-id 100')).toBe(true);
  });
  
  test('allows npm run commands', () => {
    expect(validateCommand('npm run test')).toBe(true);
  });
  
  test('allows node dist commands', () => {
    expect(validateCommand('node dist/index.js')).toBe(true);
  });
  
  test('rejects disallowed commands', () => {
    expect(validateCommand('rm -rf /')).toBe(false);
    expect(validateCommand('curl http://evil.com')).toBe(false);
    expect(validateCommand('bash script.sh')).toBe(false);
  });
  
  test('rejects command chaining', () => {
    expect(validateCommand('git commit && rm -rf /')).toBe(false);
    expect(validateCommand('git commit || echo "fail"')).toBe(false);
    expect(validateCommand('git commit; rm file')).toBe(false);
  });
  
  test('allows valid variable placeholders', () => {
    expect(validateCommand('git town hack feature/{id}')).toBe(true);
    expect(validateCommand('opencode run /plan --task-id {id} --title {title}')).toBe(true);
  });
  
  test('rejects shell metacharacters in variables', () => {
    expect(validateCommand('git commit -m "{message;rm -rf}"')).toBe(false);
    expect(validateCommand('node dist/{file`whoami`}.js')).toBe(false);
  });
});
```

---

## Development Phases

### Phase 1: Core Schemas and Types (Priority: Critical)

**Duration**: 1 day

**Deliverables**:
1. Project structure setup
2. Zod schemas defined
3. Type definitions exported
4. Error classes implemented

**Implementation Steps**:
1. Create directory structure: `src/workflow/`
2. Add `zod` dependency to package.json (already added for 100_1_10)
3. Implement `schemas.ts`:
   - SettingsSchema
   - TransitionSchema (with command validation placeholder)
   - StateDefinitionSchema
   - WorkflowConfigSchema
4. Implement `types.ts`:
   - Export inferred types from schemas
   - Define helper types (EntityType)
5. Implement `errors.ts`:
   - WorkflowConfigError (base class)
   - ConfigNotFoundError
   - ConfigParseError
   - ConfigValidationError
   - CommandValidationError
6. Create `workflow-config-loader.ts` skeleton:
   - Constructor
   - Method signatures (no implementation yet)

**Acceptance Criteria**:
- [ ] Directory structure created
- [ ] All schemas compile without errors
- [ ] All types exported correctly
- [ ] Error classes follow existing patterns (similar to state repository)
- [ ] Loader class structure defined

### Phase 2: Command Validation (Priority: Critical)

**Duration**: 1-2 days

**Deliverables**:
1. Command allowlist defined
2. Command validation logic implemented
3. Variable validation logic implemented
4. Command validation integrated with schema

**Implementation Steps**:
1. Create `command-validator.ts`
2. Define `ALLOWED_COMMAND_PREFIXES` constant array:
   - 'git town hack'
   - 'git town append'
   - 'git town sync'
   - 'git commit'
   - 'git push'
   - 'opencode run'
   - 'npm run'
   - 'node dist/'
3. Implement `validateCommand()` function:
   - Check against allowlist
   - Prevent command chaining (&&, ||, ;)
   - Validate variable placeholders
4. Implement `validateVariables()` helper:
   - Extract variables from command ({var})
   - Check for shell metacharacters
   - Validate variable names against allowed list
5. Integrate validation with TransitionSchema
6. Write comprehensive tests for command validation

**Acceptance Criteria**:
- [ ] Allowlist defined with all necessary commands
- [ ] validateCommand() rejects disallowed commands
- [ ] validateCommand() rejects command chaining
- [ ] validateCommand() validates variable placeholders
- [ ] Integration with Zod schema working
- [ ] Unit tests passing (>90% coverage of validator)

### Phase 3: File Loading and Parsing (Priority: High)

**Duration**: 1-2 days

**Deliverables**:
1. File reading with security validation
2. YAML parsing with error handling
3. Schema validation integration
4. Configuration caching

**Implementation Steps**:
1. Implement `checkConfigPath()` private method:
   - Validate path is within project
   - Check if symlink (reject if so)
   - Handle ENOENT gracefully
2. Implement `loadFromFile()` private method:
   - Call checkConfigPath()
   - Check file exists (fs.access)
   - Read file contents
   - Parse YAML with try/catch
   - Throw ConfigParseError on failure
3. Implement `validateConfig()` private method:
   - Call WorkflowConfigSchema.parse()
   - Catch ZodError and wrap in ConfigValidationError
4. Implement `load()` method:
   - Check cache, return if valid
   - Call loadFromFile()
   - Call validateConfig()
   - Cache result
   - Return validated config
5. Implement `clearCache()` method

**Acceptance Criteria**:
- [ ] load() reads and parses YAML successfully
- [ ] load() validates against schema
- [ ] load() caches config for reuse
- [ ] Symlinks rejected with security error
- [ ] YAML errors include helpful messages
- [ ] Unit tests passing (mocked fs)

### Phase 4: Accessor Methods (Priority: High)

**Duration**: 1 day

**Deliverables**:
1. State definition retrieval
2. Transition retrieval
3. Programmatic validation

**Implementation Steps**:
1. Implement `validate()` method:
   - Call validateConfig() directly
   - Return validated config
   - No caching or file operations
2. Implement `getStateDefinition()` method:
   - Check cache exists (throw if not loaded)
   - Determine collection (feature_states or task_states)
   - Look up state by name
   - Return StateDefinition or null
3. Implement `getTransition()` method:
   - Call getStateDefinition()
   - Look up transition by name
   - Return Transition or null

**Acceptance Criteria**:
- [ ] validate() works without file operations
- [ ] getStateDefinition() retrieves correct states
- [ ] getStateDefinition() distinguishes feature vs task
- [ ] getTransition() retrieves correct transitions
- [ ] Methods throw helpful errors when misused
- [ ] Unit tests passing

### Phase 5: Example Configuration (Priority: High)

**Duration**: 1 day

**Deliverables**:
1. Comprehensive example workflow config
2. Extensive comments and documentation
3. All features demonstrated

**Implementation Steps**:
1. Create `examples/.aisanity-workflow.yml`
2. Add complete feature workflow:
   - discovered → decomposed → in_progress → completed
   - All transitions with realistic commands
3. Add complete task workflow:
   - file_exists → planned → in_progress → completed
   - All transitions with realistic commands
4. Add comprehensive comments:
   - Explain each section
   - Document variable usage
   - Provide examples
   - Include tips and best practices
5. Add settings examples:
   - Confirmation settings
   - Timeout configurations
6. Add variables documentation section
7. Validate example config loads without errors

**Acceptance Criteria**:
- [ ] Example config includes all workflow states
- [ ] Example config has comprehensive comments
- [ ] Example config loads without validation errors
- [ ] Example config demonstrates all features
- [ ] Comments are helpful and clear

### Phase 6: Comprehensive Testing (Priority: Critical)

**Duration**: 2-3 days

**Deliverables**:
1. Full unit test suite (>90% coverage)
2. Integration tests with real file system
3. Example config validation tests

**Implementation Steps**:
1. Complete unit tests (all test suites listed above):
   - Loading and caching tests
   - Validation tests
   - State definition retrieval tests
   - Transition retrieval tests
   - Cache management tests
   - Error message tests
2. Complete integration tests:
   - Real file operations
   - Example config validation
3. Complete command validator tests
4. Add edge case tests:
   - Empty configs
   - Missing optional fields
   - Boundary conditions
5. Review coverage report:
   - Ensure >90% coverage
   - Add tests for uncovered branches
6. Test with real example config

**Acceptance Criteria**:
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Command validator tests passing
- [ ] Coverage >90%
- [ ] Example config loads successfully
- [ ] No flaky tests

### Phase 7: Documentation and Polish (Priority: Medium)

**Duration**: 1 day

**Deliverables**:
1. JSDoc comments for all public methods
2. Usage examples in comments
3. Error message improvements
4. Code cleanup

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
4. Create `src/workflow/index.ts` with public exports
5. Run linter and fix issues

**Acceptance Criteria**:
- [ ] All public APIs documented
- [ ] Error messages helpful and clear
- [ ] Code follows style guidelines
- [ ] No lint errors
- [ ] Public exports defined
- [ ] README updated (if needed)

---

## Dependencies

### Runtime Dependencies

#### 1. zod (DEPENDENCY - Already added for 100_1_10)

**Package**: `zod`  
**Version**: `^3.22.0`  
**Purpose**: Runtime schema validation with TypeScript type inference

**Installation**: Already installed as part of task 100_1_10.

**Usage**:
```typescript
import { z } from 'zod';

const schema = z.object({ 
  version: z.string(),
  settings: z.object({ /* ... */ })
});
const validated = schema.parse(config);
```

**Why**: Specified in feature architecture, industry standard, type inference.

#### 2. yaml (EXISTING)

**Package**: `yaml`  
**Version**: `^2.3.0` (already in dependencies)  
**Purpose**: YAML parsing and serialization

**Usage**:
```typescript
import { parse } from 'yaml';

const config = parse(yamlString);
```

**Why**: TypeScript-native, preserves formatting, specified in architecture.

#### 3. Node.js Built-ins

**Modules**:
- `fs/promises`: File system operations
- `path`: Path manipulation

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

**NO CHANGES NEEDED** - All dependencies already present from previous tasks or existing setup.

### System Requirements

- **Node.js**: 22.x LTS or 24.x current
- **Operating System**: macOS, Linux, Windows (cross-platform)
- **File System**: Standard POSIX-compliant file system

---

## Implementation Checklist

### Pre-Implementation

- [ ] Review feature architecture (`.feature/arch_100.md`)
- [ ] Review task requirements (`.task/100_1_20-workflow-config-yaml-loader.md`)
- [ ] Review architectural analysis (`.plan/arch_100_1_20-workflow-config-yaml-loader.md`)
- [ ] Review this implementation plan
- [ ] Verify `zod` is installed (should be from 100_1_10)
- [ ] Review task 100_1_10 implementation plan (understand StateRepository integration)

### Phase 1: Schemas and Types

- [ ] Create `src/workflow/` directory
- [ ] Implement `schemas.ts` with all Zod schemas
- [ ] Implement `types.ts` with inferred types
- [ ] Implement `errors.ts` with custom error classes
- [ ] Create `workflow-config-loader.ts` skeleton
- [ ] Verify all files compile without errors

### Phase 2: Command Validation

- [ ] Create `command-validator.ts`
- [ ] Define ALLOWED_COMMAND_PREFIXES constant
- [ ] Implement validateCommand() function
- [ ] Implement validateVariables() helper
- [ ] Integrate with TransitionSchema
- [ ] Write command validator tests
- [ ] Verify command validation tests passing

### Phase 3: File Loading

- [ ] Implement checkConfigPath() private method
- [ ] Implement loadFromFile() private method
- [ ] Implement validateConfig() private method
- [ ] Implement load() method with caching
- [ ] Implement clearCache() method
- [ ] Write unit tests for loading
- [ ] Verify loading tests passing

### Phase 4: Accessor Methods

- [ ] Implement validate() method
- [ ] Implement getStateDefinition() method
- [ ] Implement getTransition() method
- [ ] Write unit tests for accessors
- [ ] Verify accessor tests passing

### Phase 5: Example Config

- [ ] Create examples/.aisanity-workflow.yml
- [ ] Add complete feature workflow states
- [ ] Add complete task workflow states
- [ ] Add comprehensive comments
- [ ] Add settings examples
- [ ] Add variables documentation
- [ ] Verify example config loads successfully

### Phase 6: Testing

- [ ] Complete all unit tests (6 test suites)
- [ ] Complete integration tests (2 test suites)
- [ ] Complete command validator tests
- [ ] Run coverage report
- [ ] Add tests for uncovered code
- [ ] Verify >90% coverage achieved
- [ ] Test with real example config

### Phase 7: Documentation

- [ ] Add JSDoc comments to all public methods
- [ ] Review and improve error messages
- [ ] Code cleanup and refactoring
- [ ] Create `src/workflow/index.ts` with exports
- [ ] Run linter and fix issues
- [ ] Final code review

### Completion Criteria

- [ ] All tests passing (unit + integration)
- [ ] Coverage >90%
- [ ] No lint errors
- [ ] All public APIs documented
- [ ] Example config loads without errors
- [ ] Security validations implemented
- [ ] Error handling comprehensive
- [ ] Command validation working correctly

---

## Risk Analysis

### Risk 1: Command Injection Vulnerabilities

**Probability**: Medium  
**Impact**: Critical (security issue)

**Mitigation**:
- Strict allowlist of command prefixes
- Validation at config load time (fail early)
- No shell execution in command executor
- Prevent command chaining patterns
- Validate variable placeholders

**Contingency**: If allowlist too restrictive, provide escape hatch with explicit user confirmation.

### Risk 2: YAML Parsing Vulnerabilities

**Probability**: Low  
**Impact**: Medium (security/stability)

**Mitigation**:
- Use actively maintained `yaml` package
- Validate parsed data with Zod before use
- Set reasonable file size limits
- Keep dependencies updated
- Monitor security advisories

**Contingency**: Can switch to alternative YAML parser if needed.

### Risk 3: Schema Evolution

**Probability**: High  
**Impact**: Medium (breaking changes)

**Mitigation**:
- Version field in config file
- Clear schema versioning strategy
- Document breaking changes
- Provide migration guidance

**Contingency**: Implement schema migration system in future (out of scope for MVP).

### Risk 4: Configuration Errors

**Probability**: High  
**Impact**: Low (user frustration)

**Mitigation**:
- Comprehensive validation with Zod
- Detailed error messages with field paths
- Example config with extensive comments
- Validation errors point to exact location

**Contingency**: Add config validation CLI command in future.

### Risk 5: Cache Staleness

**Probability**: Low  
**Impact**: Low (confusion)

**Mitigation**:
- Command-duration caching (fresh per command)
- No cross-command caching
- Clear cache on process exit
- Documented cache behavior

**Contingency**: If needed, add file watching in future for automatic reload.

---

## Success Metrics

### Code Quality Metrics

- **Test Coverage**: >90% (requirement)
- **Lint Errors**: 0
- **TypeScript Errors**: 0
- **Documentation Coverage**: 100% of public APIs

### Security Metrics

- **Command Validation**: 100% (all commands validated)
- **Path Validation**: 100% (all paths validated)
- **Security Tests**: All passing
- **Known Vulnerabilities**: 0

### Usability Metrics

- **Error Clarity**: All errors include helpful context
- **Example Config**: Comprehensive with comments
- **Documentation**: Complete and clear
- **Integration**: Clean API for downstream tasks

### Performance Metrics

- **Load Operation**: <50ms for typical config (~10KB)
- **Cache Hit**: <1ms
- **Validation**: <5ms for typical config
- **Memory Usage**: <100KB per instance

---

## Future Enhancements (Out of Scope)

These are explicitly deferred to maintain focus on core functionality:

1. **File Watching**: Automatic reload on config changes
2. **Config Validation CLI**: Standalone command to validate config
3. **Config Migration**: Automatic migration between schema versions
4. **Config Merging**: Support for multiple config files (base + overrides)
5. **Conditional Transitions**: "Move to ready only if all tasks completed"
6. **Dynamic Command Generation**: Generate commands based on runtime context
7. **Config Templates**: Pre-defined workflow templates for common patterns
8. **Config Inheritance**: Base configs with per-project overrides
9. **Config Linting**: Style and best practice checks
10. **Config Documentation**: Auto-generate docs from config structure

---

## Conclusion

This implementation plan provides a comprehensive roadmap for building a production-ready WorkflowConfigLoader class. The plan follows the architectural analysis closely and ensures:

✅ **Security**: Command allowlist, path validation, no shell execution  
✅ **Usability**: Clear error messages, example config, comprehensive documentation  
✅ **Maintainability**: Type safety, single source of truth, extensive tests  
✅ **Performance**: Fast loading, efficient caching, minimal overhead  
✅ **Flexibility**: User-editable YAML, extensible schema, clear upgrade paths  
✅ **Integration**: Clean separation from StateRepository, clear contracts for state machine

The phased approach ensures incremental progress with testable milestones. Each phase builds upon the previous one, with testing integrated throughout.

**Key Integration Points**:
- Works in **parallel** with task 100_1_10 (StateRepository)
- Provides **workflow definitions** (what states/transitions are possible)
- StateRepository provides **runtime state** (what state entities are in)
- Both integrated by task 100_1_40 (State Machine Engine)

**Ready for Implementation**: This plan is ready to execute. All design decisions are made, all interfaces defined, and all tests specified.

---

**Plan Version**: 1.0  
**Last Updated**: 2025-10-03  
**Planner**: AI Implementation Planner (Claude)
