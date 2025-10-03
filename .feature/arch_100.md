# Feature Architecture: CLI State Machine Workflow UI

**Feature ID:** 100  
**Created:** 2025-10-03  
**Status:** Architecture Complete

---

## Table of Contents

1. [Feature Architecture Overview](#feature-architecture-overview)
2. [Research Findings](#research-findings)
3. [Technology Stack Recommendations](#technology-stack-recommendations)
4. [System Components](#system-components)
5. [Integration Strategy](#integration-strategy)
6. [Data Architecture](#data-architecture)
7. [Scalability & Performance](#scalability--performance)
8. [Security Considerations](#security-considerations)
9. [Decomposition Guidance](#decomposition-guidance)

---

## Feature Architecture Overview

### High-Level Approach

This feature implements a **state machine-based workflow orchestration system** for managing feature development lifecycles through a CLI interface. The architecture follows a **layered design pattern** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                    CLI Interface Layer                   │
│  (Commander.js commands: status, next, manual states)   │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              Workflow Orchestration Layer                │
│   (State Machine Engine, Transition Logic, Validators)  │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                 State Management Layer                   │
│      (YAML State Store, Workflow Config Reader)         │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                  Execution Layer                         │
│  (Command Executor, Git Integration, Variable Resolver) │
└─────────────────────────────────────────────────────────┘
```

### Core Architectural Patterns

1. **State Pattern**: Encapsulates state-specific behavior and transitions
2. **Command Pattern**: Wraps shell command execution with validation and logging
3. **Strategy Pattern**: Allows pluggable state transition strategies
4. **Repository Pattern**: Abstracts state persistence (YAML files)
5. **Chain of Responsibility**: Hierarchical "next" action resolution (feature → tasks)

### **IMPORTANT**: Design Philosophy

- **Human-First Design**: YAML files must be manually editable and git-friendly
- **Fail-Safe Execution**: All state transitions are logged before command execution
- **Explicit Over Implicit**: No hidden state changes; all transitions are auditable
- **Progressive Enhancement**: Start simple (basic state machine), defer complex features (conditionals, parallel execution)

---

## Research Findings

### State Machine Implementation Patterns

**Industry Best Practices:**

1. **XState Approach** (28.8k stars): Actor-based state management with hierarchical state machines
   - **Lesson**: Separate state definition (declarative) from state execution (imperative)
   - **Application**: Use YAML for state definitions, TypeScript for execution logic

2. **Finite State Machine Libraries**:
   - Most successful implementations use **explicit state definitions** with transition tables
   - **Event-driven transitions** are more maintainable than imperative state changes
   - **Hierarchical states** reduce complexity (feature → phase → task)

3. **CLI Workflow Tools**:
   - **GitHub Actions**: YAML-based workflow definitions with exit code handling
   - **Ansible**: Idempotent state management with rollback capabilities
   - **Terraform**: Declarative state with plan/apply separation

**Key Takeaways:**
- ✅ Declarative workflow configuration (YAML) separate from state storage
- ✅ Exit code-based transitions are industry standard (CI/CD tools)
- ✅ Audit trails are critical for debugging and compliance
- ✅ Confirmation prompts prevent accidental destructive operations

### CLI Framework Analysis

**Commander.js** (already in use):
- ✅ Mature, battle-tested (used by npm, Heroku CLI, Salesforce CLI)
- ✅ Excellent TypeScript support
- ✅ Subcommand support (perfect for `feature` and `task` namespaces)
- ✅ Built-in help generation and validation
- ✅ Minimal learning curve for team

**Alternative Considered: oclif** (9.3k stars):
- ❌ Overkill for this use case (designed for large plugin ecosystems)
- ❌ Steeper learning curve
- ❌ Would require significant refactoring of existing codebase

**Decision**: Continue with Commander.js ✅

### YAML Parsing Libraries

**Research Results:**

1. **js-yaml** (6.2k stars): Most popular, but lacks TypeScript-first design
2. **yaml** (2.3k stars, already in dependencies): 
   - ✅ TypeScript-native
   - ✅ Preserves comments and formatting (critical for human editing)
   - ✅ Supports YAML 1.2 spec
   - ✅ Better error messages

**Decision**: Use existing `yaml` package ✅

### CLI Visualization Approaches

**Options Evaluated:**

1. **Ink** (React for CLIs): 
   - ❌ Too heavy for simple tree view
   - ❌ Requires full TUI (out of scope)

2. **cli-table3** (2.1k stars):
   - ✅ Simple table rendering
   - ✅ Works with existing console output

3. **chalk** (already in dependencies):
   - ✅ Color coding for state indicators
   - ✅ Lightweight, composable

4. **tree-cli** patterns:
   - ✅ ASCII tree rendering with indentation
   - ✅ Can be implemented with simple string manipulation

**Decision**: Use chalk + custom tree rendering ✅

---

## Technology Stack Recommendations

### Core Dependencies (Already Available)

```json
{
  "commander": "^11.0.0",    // CLI framework
  "yaml": "^2.3.0",          // YAML parsing/serialization
  "chalk": "^5.3.0"          // Terminal styling
}
```

### New Dependencies (Recommended)

```json
{
  "zod": "^3.22.0"           // Runtime schema validation for YAML
}
```

**Rationale for Zod:**
- ✅ TypeScript-first validation library
- ✅ Provides type inference from schemas (reduces duplication)
- ✅ Excellent error messages for invalid YAML
- ✅ Lightweight (no dependencies)
- ✅ Industry standard (used by tRPC, Astro, Next.js)

### **IMPORTANT**: No Additional CLI Frameworks Needed

The existing Commander.js + TypeScript stack is sufficient. Adding more frameworks would:
- ❌ Increase bundle size
- ❌ Add maintenance burden
- ❌ Create learning curve for contributors

---

## System Components

### 1. CLI Interface Layer

**Location**: `src/commands/feature.ts`, `src/commands/task.ts`

**Responsibilities:**
- Parse user input (feature/task IDs, options, flags)
- Validate command syntax
- Delegate to orchestration layer
- Format and display output

**Commands Structure:**
```typescript
aisanity feature <id> [action]
  - status              // Show feature state tree
  - next                // Execute next pending action
  - <state-name>        // Transition to specific state

aisanity task <id> [action]
  - status              // Show task state
  - next                // Execute next pending action
  - <state-name>        // Transition to specific state
```

**Key Design Decisions:**
- Use Commander.js subcommands (consistent with existing `worktree` command)
- ID resolution: Support both full paths (`.feature/100-name.md`) and short IDs (`100`)
- Global flags: `--yes` (skip confirmations), `--verbose` (detailed logging)

### 2. Workflow Orchestration Layer

**Location**: `src/workflow/`

**Components:**

#### a) State Machine Engine (`state-machine.ts`)
```typescript
interface StateMachine {
  getCurrentState(id: string): State;
  getNextState(id: string): State | null;
  canTransition(from: State, to: State): boolean;
  executeTransition(id: string, to: State): Promise<TransitionResult>;
}
```

**Responsibilities:**
- Load workflow configuration
- Validate state transitions
- Coordinate command execution
- Update state storage

#### b) Transition Executor (`transition-executor.ts`)
```typescript
interface TransitionExecutor {
  execute(transition: Transition, context: ExecutionContext): Promise<ExitCode>;
  resolveVariables(command: string, context: ExecutionContext): string;
  handleExitCode(exitCode: number, transition: Transition): State;
}
```

**Responsibilities:**
- Execute shell commands safely (reuse `docker-safe-exec.ts` pattern)
- Variable substitution (`{id}`, `{title}`, `{feature_id}`, `{phase}`)
- Exit code interpretation
- Timeout handling

#### c) Confirmation Handler (`confirmation.ts`)
```typescript
interface ConfirmationHandler {
  shouldConfirm(command: string, config: WorkflowConfig): boolean;
  prompt(message: string): Promise<boolean>;
}
```

**Responsibilities:**
- Check if confirmation is required
- Display command preview
- Handle user input (Y/n)
- Respect `--yes` flag

### 3. State Management Layer

**Location**: `src/state/`

**Components:**

#### a) State Repository (`state-repository.ts`)
```typescript
interface StateRepository {
  load(): Promise<StateFile>;
  save(state: StateFile): Promise<void>;
  getEntityState(id: string): EntityState | null;
  updateEntityState(id: string, state: EntityState): Promise<void>;
}
```

**Responsibilities:**
- Read/write `.aisanity-state.yml`
- Atomic file updates (write to temp, then rename)
- Concurrent access handling (file locking)
- Backup on corruption

#### b) Workflow Config Loader (`workflow-config.ts`)
```typescript
interface WorkflowConfigLoader {
  load(): Promise<WorkflowConfig>;
  validate(config: unknown): WorkflowConfig;
  getStateDefinition(stateName: string): StateDefinition;
}
```

**Responsibilities:**
- Read `.aisanity-workflow.yml`
- Validate schema with Zod
- Cache parsed configuration
- Provide type-safe access

### 4. Execution Layer

**Location**: `src/execution/`

**Components:**

#### a) Command Executor (`command-executor.ts`)
```typescript
interface CommandExecutor {
  execute(command: string, options: ExecOptions): Promise<ExitCode>;
  validateCommand(command: string): boolean;
}
```

**Responsibilities:**
- Execute shell commands safely (similar to `docker-safe-exec.ts`)
- Prevent command injection
- Capture stdout/stderr
- Handle timeouts
- Log execution details

**Security Pattern** (reuse from existing codebase):
```typescript
// Use spawn with array args, NOT shell execution
spawn(command, args, { shell: false })
```

#### b) Git Integration (`git-integration.ts`)
```typescript
interface GitIntegration {
  createHackBranch(phase: string): Promise<void>;
  appendTaskBranch(taskId: string, parentBranch: string): Promise<void>;
  getCurrentBranch(): string;
}
```

**Responsibilities:**
- Execute git-town commands
- Validate git state
- Handle branch naming conventions
- Error recovery

#### c) Variable Resolver (`variable-resolver.ts`)
```typescript
interface VariableResolver {
  resolve(template: string, context: ExecutionContext): string;
  getAvailableVariables(entityType: 'feature' | 'task'): string[];
}
```

**Responsibilities:**
- Replace `{id}`, `{title}`, `{feature_id}`, `{phase}` in commands
- Extract variables from file paths
- Validate variable availability

### 5. Visualization Layer

**Location**: `src/visualization/`

**Components:**

#### a) Tree Renderer (`tree-renderer.ts`)
```typescript
interface TreeRenderer {
  renderFeatureTree(feature: Feature, tasks: Task[]): string;
  renderTaskStatus(task: Task): string;
}
```

**Responsibilities:**
- ASCII tree generation
- State indicator symbols (✓, ⧗, ○, ✗)
- Color coding with chalk
- Phase grouping (1xx, 2xx)

**Example Output:**
```
Feature 100: CLI State Machine Workflow UI [in_progress]
├─ Phase 1 (1xx)
│  ├─ ✓ Task 100_110: State Machine Core [completed]
│  ├─ ⧗ Task 100_120: YAML Config Loader [in_progress] ← NEXT
│  └─ ○ Task 100_130: CLI Commands [pending]
└─ Phase 2 (2xx)
   └─ ○ Task 100_210: Git Integration [pending]
```

### 6. Utilities Layer

**Location**: `src/utils/`

**Components:**

#### a) ID Resolver (`id-resolver.ts`)
```typescript
interface IDResolver {
  resolve(input: string): ResolvedID;
  findFeatureFile(id: string): string | null;
  findTaskFile(id: string): string | null;
}
```

**Responsibilities:**
- Resolve short IDs (100) to full paths
- Handle ambiguous IDs
- Search `.feature/` and `.task/` directories
- Extract metadata from filenames

#### b) File Scanner (`file-scanner.ts`)
```typescript
interface FileScanner {
  scanFeatures(): Feature[];
  scanTasks(featureId?: string): Task[];
  extractMetadata(filepath: string): EntityMetadata;
}
```

**Responsibilities:**
- Discover feature/task files
- Parse filenames (ID, title)
- Detect phase from ID prefix
- Cache scan results

---

## Integration Strategy

### Integration with Existing Codebase

#### 1. Commander.js Command Structure

**Pattern**: Follow existing `worktree` command structure

```typescript
// src/commands/feature.ts
export const featureCommand = new Command('feature')
  .description('Manage feature workflows')
  .addCommand(featureStatusCommand)
  .addCommand(featureNextCommand);

// src/index.ts
program.addCommand(featureCommand);
program.addCommand(taskCommand);
```

**Benefits:**
- ✅ Consistent with existing CLI patterns
- ✅ Familiar to developers who use `aisanity worktree`
- ✅ Easy to extend with new subcommands

#### 2. Reuse Existing Utilities

**From `src/utils/config.ts`:**
- `loadAisanityConfig()`: Check for `.aisanity` config
- `getCurrentBranch()`: Get current git branch for context

**From `src/utils/docker-safe-exec.ts`:**
- **Pattern**: Spawn with array args, no shell interpretation
- **Error handling**: Custom error types with exit codes
- **Logging**: Structured JSON logs for audit trail

**New Command Executor** (similar pattern):
```typescript
// src/execution/command-executor.ts
export async function safeShellExec(
  command: string, 
  args: string[], 
  options: ExecOptions
): Promise<ExitCode> {
  // Reuse spawn pattern from docker-safe-exec.ts
  const child = spawn(command, args, { shell: false });
  // ... (similar error handling, timeout, logging)
}
```

#### 3. File Organization

**New Directories:**
```
src/
├── commands/
│   ├── feature.ts          // NEW: Feature commands
│   ├── task.ts             // NEW: Task commands
│   └── ...existing...
├── workflow/               // NEW: Workflow orchestration
│   ├── state-machine.ts
│   ├── transition-executor.ts
│   └── confirmation.ts
├── state/                  // NEW: State management
│   ├── state-repository.ts
│   ├── workflow-config.ts
│   └── schemas.ts
├── execution/              // NEW: Command execution
│   ├── command-executor.ts
│   ├── git-integration.ts
│   └── variable-resolver.ts
├── visualization/          // NEW: Output formatting
│   └── tree-renderer.ts
└── utils/
    ├── id-resolver.ts      // NEW: ID resolution
    ├── file-scanner.ts     // NEW: File discovery
    └── ...existing...
```

#### 4. Configuration Files

**Location**: Project root

```
.aisanity-state.yml         // NEW: State database
.aisanity-workflow.yml      // NEW: Workflow configuration
.aisanity                   // EXISTING: Project config
```

**Coexistence Strategy:**
- Existing `.aisanity` config remains unchanged
- New YAML files are optional (CLI works without them)
- Initialize with `aisanity feature init` command (future enhancement)

---

## Data Architecture

### 1. State File Structure (`.aisanity-state.yml`)

**Design Principles:**
- **Append-only history**: Never delete transition records
- **Human-readable**: Use descriptive keys, avoid abbreviations
- **Git-friendly**: Consistent formatting, minimal diffs

```yaml
# .aisanity-state.yml
version: "1.0"
last_updated: "2025-10-03T14:30:00Z"

features:
  "100":
    current_state: "in_progress"
    file_path: ".feature/100-cli-state-machine-workflow-ui.md"
    created_at: "2025-10-03T10:00:00Z"
    transitions:
      - from: "discovered"
        to: "decomposed"
        command: "opencode run /feature_decompose --feature-id 100"
        exit_code: 0
        timestamp: "2025-10-03T10:15:00Z"
      - from: "decomposed"
        to: "in_progress"
        command: "git town hack feature/100-phase-1"
        exit_code: 0
        timestamp: "2025-10-03T10:20:00Z"

tasks:
  "100_110":
    current_state: "completed"
    file_path: ".task/100_110-state-machine-core.md"
    feature_id: "100"
    phase: "1"
    created_at: "2025-10-03T10:30:00Z"
    transitions:
      - from: "file_exists"
        to: "planned"
        command: "opencode run /auto_plan --task-id 100_110"
        exit_code: 0
        timestamp: "2025-10-03T11:00:00Z"
      - from: "planned"
        to: "in_progress"
        command: "git town append feature/100_110-state-machine-core"
        exit_code: 0
        timestamp: "2025-10-03T11:10:00Z"
      - from: "in_progress"
        to: "completed"
        command: "git commit -am 'Complete state machine core'"
        exit_code: 0
        timestamp: "2025-10-03T14:30:00Z"
```

**Schema Validation** (Zod):
```typescript
const StateFileSchema = z.object({
  version: z.string(),
  last_updated: z.string().datetime(),
  features: z.record(z.object({
    current_state: z.string(),
    file_path: z.string(),
    created_at: z.string().datetime(),
    transitions: z.array(TransitionSchema)
  })),
  tasks: z.record(z.object({
    current_state: z.string(),
    file_path: z.string(),
    feature_id: z.string(),
    phase: z.string().optional(),
    created_at: z.string().datetime(),
    transitions: z.array(TransitionSchema)
  }))
});
```

### 2. Workflow Config Structure (`.aisanity-workflow.yml`)

**Design Principles:**
- **User-editable**: Clear comments, examples
- **Extensible**: Easy to add new states/transitions
- **Validated**: Schema prevents invalid configurations

```yaml
# .aisanity-workflow.yml
version: "1.0"

# Global settings
settings:
  confirmation:
    enabled: true
    skip_for_read_only: true  # Don't confirm for status/list commands
  
  timeout:
    default: 300000  # 5 minutes
    per_command:
      "opencode run": 600000  # 10 minutes for AI commands

# Feature workflow
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

# Task workflow
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
        requires_confirmation: false  # Commit is safe to retry
  
  completed:
    description: "Task is complete"
    transitions: {}

# Variable definitions (for documentation)
variables:
  id: "Feature or task ID (e.g., 100, 100_110)"
  title: "Kebab-case title extracted from filename"
  feature_id: "Parent feature ID for tasks"
  phase: "Phase number extracted from task ID (e.g., 1 from 100_110)"
```

**Schema Validation** (Zod):
```typescript
const WorkflowConfigSchema = z.object({
  version: z.string(),
  settings: z.object({
    confirmation: z.object({
      enabled: z.boolean(),
      skip_for_read_only: z.boolean()
    }),
    timeout: z.object({
      default: z.number(),
      per_command: z.record(z.number()).optional()
    })
  }),
  feature_states: z.record(StateDefinitionSchema),
  task_states: z.record(StateDefinitionSchema),
  variables: z.record(z.string()).optional()
});
```

### 3. Data Flow

```
User Input
    ↓
[CLI Command Parser]
    ↓
[ID Resolver] → Resolve "100" to ".feature/100-name.md"
    ↓
[State Repository] → Load current state from .aisanity-state.yml
    ↓
[Workflow Config] → Load state definitions from .aisanity-workflow.yml
    ↓
[State Machine] → Determine next state/action
    ↓
[Confirmation Handler] → Prompt user if needed
    ↓
[Variable Resolver] → Replace {id}, {title}, etc. in command
    ↓
[Command Executor] → Execute shell command safely
    ↓
[State Repository] → Append transition to history, update current state
    ↓
[Tree Renderer] → Display updated state tree
```

### **IMPORTANT**: Atomic State Updates

**Problem**: Multiple CLI instances could corrupt state file

**Solution**: File locking pattern
```typescript
async function atomicStateUpdate(updateFn: (state: StateFile) => StateFile) {
  const lockFile = '.aisanity-state.yml.lock';
  
  // Acquire lock (with timeout)
  await acquireLock(lockFile, { timeout: 5000 });
  
  try {
    // Read current state
    const state = await loadState();
    
    // Apply update
    const newState = updateFn(state);
    
    // Write to temp file
    await fs.writeFile('.aisanity-state.yml.tmp', YAML.stringify(newState));
    
    // Atomic rename
    await fs.rename('.aisanity-state.yml.tmp', '.aisanity-state.yml');
  } finally {
    // Release lock
    await releaseLock(lockFile);
  }
}
```

---

## Scalability & Performance

### Performance Requirements

**Target Metrics:**
- State lookup: < 50ms (read YAML, parse, find entity)
- State update: < 100ms (read, modify, write YAML)
- Command execution: Variable (depends on command, not our bottleneck)
- Tree rendering: < 20ms (for up to 100 tasks)

### Scalability Considerations

#### 1. File Size Limits

**Scenario**: Large projects with 100+ features, 1000+ tasks

**State File Growth:**
- Each transition: ~200 bytes (YAML)
- 1000 tasks × 5 transitions each = 5000 transitions
- 5000 × 200 bytes = 1 MB (acceptable)

**Mitigation Strategies:**
1. **Archive old transitions** (future enhancement):
   ```yaml
   # Move transitions older than 90 days to .aisanity-state-archive.yml
   ```

2. **Lazy loading** (if needed):
   ```typescript
   // Only load transitions for entities being queried
   loadEntityState(id: string): EntityState
   ```

3. **Indexing** (future enhancement):
   ```yaml
   # .aisanity-state-index.yml
   features:
     "100": { current_state: "in_progress", transition_count: 5 }
   ```

#### 2. Command Execution Performance

**Bottleneck**: OpenCode AI commands (can take 30-60 seconds)

**User Experience Improvements:**
1. **Progress indicators**:
   ```typescript
   console.log('⧗ Executing: opencode run /feature_decompose...');
   // Show spinner or progress bar
   ```

2. **Timeout configuration**:
   ```yaml
   # .aisanity-workflow.yml
   timeout:
     per_command:
       "opencode run": 600000  # 10 minutes
   ```

3. **Background execution** (future enhancement):
   ```bash
   aisanity feature 100 next --background
   # Returns immediately, polls for completion
   ```

#### 3. Concurrent Access

**Scenario**: Multiple developers working on same project

**Current Approach**: File locking (sufficient for single-user)

**Future Enhancement**: Distributed state management
- Use git as source of truth (commit state changes)
- Merge conflicts handled by git
- Each developer has local state cache

### Caching Strategy

**What to Cache:**
1. **Workflow config**: Rarely changes, cache in memory
2. **File scan results**: Cache for 5 seconds (avoid repeated fs operations)
3. **Git branch info**: Cache for current command execution

**What NOT to Cache:**
- State file (must always be fresh)
- Command execution results

```typescript
// Simple in-memory cache with TTL
class Cache<T> {
  private cache = new Map<string, { value: T; expires: number }>();
  
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry || Date.now() > entry.expires) return null;
    return entry.value;
  }
  
  set(key: string, value: T, ttlMs: number) {
    this.cache.set(key, { value, expires: Date.now() + ttlMs });
  }
}

// Usage
const workflowConfigCache = new Cache<WorkflowConfig>();
```

---

## Security Considerations

### **IMPORTANT**: Command Injection Prevention

**Threat Model:**
- Malicious workflow config with shell injection
- User-provided IDs containing shell metacharacters
- Variable substitution introducing code execution

**Mitigation Strategies:**

#### 1. No Shell Execution

**Pattern** (from `docker-safe-exec.ts`):
```typescript
// ✅ SAFE: Array-based arguments, no shell
spawn('git', ['commit', '-am', userMessage], { shell: false });

// ❌ UNSAFE: String command with shell
exec(`git commit -am "${userMessage}"`);  // NEVER DO THIS
```

**Implementation**:
```typescript
// src/execution/command-executor.ts
export async function safeShellExec(
  command: string,
  args: string[],
  options: ExecOptions
): Promise<ExitCode> {
  // Validate command is in allowlist
  const allowedCommands = ['git', 'opencode', 'npm', 'node'];
  if (!allowedCommands.includes(command)) {
    throw new SecurityError(`Command not allowed: ${command}`);
  }
  
  // Use spawn with shell: false
  const child = spawn(command, args, { shell: false });
  // ...
}
```

#### 2. Input Validation

**ID Validation**:
```typescript
// src/utils/id-resolver.ts
function validateID(id: string): boolean {
  // Only allow alphanumeric, underscore, hyphen
  return /^[a-zA-Z0-9_-]+$/.test(id);
}
```

**Variable Substitution**:
```typescript
// src/execution/variable-resolver.ts
function sanitizeVariable(value: string): string {
  // Remove shell metacharacters
  return value.replace(/[;&|`$(){}[\]<>]/g, '');
}
```

#### 3. Workflow Config Validation

**Schema Enforcement**:
```typescript
// src/state/workflow-config.ts
const CommandSchema = z.string()
  .regex(/^[a-zA-Z0-9_\-\s{}\/.]+$/, 'Invalid characters in command')
  .refine(cmd => !cmd.includes('&&'), 'Command chaining not allowed')
  .refine(cmd => !cmd.includes('||'), 'Command chaining not allowed')
  .refine(cmd => !cmd.includes(';'), 'Command chaining not allowed');
```

**Allowlist Approach**:
```typescript
// Only allow specific command prefixes
const ALLOWED_COMMAND_PREFIXES = [
  'git town',
  'git commit',
  'git push',
  'opencode run',
  'npm run',
  'node dist/'
];

function validateCommand(command: string): boolean {
  return ALLOWED_COMMAND_PREFIXES.some(prefix => 
    command.startsWith(prefix)
  );
}
```

#### 4. File System Access

**Path Traversal Prevention**:
```typescript
// src/state/state-repository.ts
function validateFilePath(filepath: string): boolean {
  const resolved = path.resolve(filepath);
  const projectRoot = process.cwd();
  
  // Ensure path is within project directory
  return resolved.startsWith(projectRoot);
}
```

### Audit Logging

**Structured Logging** (similar to `docker-safe-exec.ts`):
```typescript
// src/execution/command-executor.ts
function logExecution(command: string, args: string[], result: ExitCode) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    command,
    args,
    exit_code: result,
    user: process.env.USER,
    cwd: process.cwd()
  };
  
  // Log to stderr (doesn't interfere with stdout)
  console.error(JSON.stringify(logEntry));
  
  // Optional: Append to audit log file
  fs.appendFileSync('.aisanity-audit.log', JSON.stringify(logEntry) + '\n');
}
```

### Environment Variable Handling

**Principle**: Never log sensitive environment variables

```typescript
// src/execution/command-executor.ts
function sanitizeEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const sensitive = ['NPM_TOKEN', 'GITHUB_TOKEN', 'OPENCODE_API_KEY'];
  const sanitized = { ...env };
  
  sensitive.forEach(key => {
    if (sanitized[key]) {
      sanitized[key] = '***REDACTED***';
    }
  });
  
  return sanitized;
}
```

---

## Decomposition Guidance

### Recommended Task Breakdown

This feature should be decomposed into **3 phases** with **10-12 tasks total**.

### Phase 1: Core State Machine (Tasks 100_110 - 100_140)

**Goal**: Implement basic state machine without CLI integration

#### Task 100_110: State File Management
- **Scope**: State repository, YAML read/write, atomic updates
- **Dependencies**: None
- **Deliverable**: `StateRepository` class with tests
- **Estimated Complexity**: Medium (3-4 hours)

#### Task 100_120: Workflow Config Loader
- **Scope**: Workflow config parsing, Zod validation, schema definitions
- **Dependencies**: None (can be parallel with 100_110)
- **Deliverable**: `WorkflowConfigLoader` class with tests
- **Estimated Complexity**: Medium (3-4 hours)

#### Task 100_130: State Machine Engine
- **Scope**: State transition logic, validation, next state determination
- **Dependencies**: 100_110, 100_120
- **Deliverable**: `StateMachine` class with tests
- **Estimated Complexity**: High (5-6 hours)

#### Task 100_140: Command Executor
- **Scope**: Safe shell execution, variable substitution, exit code handling
- **Dependencies**: None (can be parallel with 100_130)
- **Deliverable**: `CommandExecutor` class with tests
- **Estimated Complexity**: Medium (4-5 hours)

**Phase 1 Milestone**: State machine can execute transitions programmatically

---

### Phase 2: CLI Integration (Tasks 100_210 - 100_240)

**Goal**: Add CLI commands and user interaction

#### Task 100_210: ID Resolution & File Scanning
- **Scope**: Resolve short IDs, scan feature/task files, extract metadata
- **Dependencies**: None
- **Deliverable**: `IDResolver` and `FileScanner` classes with tests
- **Estimated Complexity**: Medium (3-4 hours)

#### Task 100_220: Feature Status Command
- **Scope**: `aisanity feature <id> status` command, tree rendering
- **Dependencies**: 100_130, 100_210
- **Deliverable**: `feature status` command with colored output
- **Estimated Complexity**: Medium (4-5 hours)

#### Task 100_230: Feature Next Command
- **Scope**: `aisanity feature <id> next` command, confirmation prompts
- **Dependencies**: 100_130, 100_140, 100_210
- **Deliverable**: `feature next` command with full workflow
- **Estimated Complexity**: High (5-6 hours)

#### Task 100_240: Task Commands
- **Scope**: `aisanity task <id> status|next` commands
- **Dependencies**: 100_220, 100_230
- **Deliverable**: Task commands (similar to feature commands)
- **Estimated Complexity**: Medium (3-4 hours)

**Phase 2 Milestone**: CLI can execute full feature workflow

---

### Phase 3: Git Integration & Polish (Tasks 100_310 - 100_340)

**Goal**: Add git-town integration and production-ready features

#### Task 100_310: Git Town Integration
- **Scope**: Branch creation, git-town hack/append commands
- **Dependencies**: 100_140
- **Deliverable**: `GitIntegration` class with tests
- **Estimated Complexity**: Medium (4-5 hours)

#### Task 100_320: Manual State Transitions
- **Scope**: `aisanity feature <id> <state>` command for explicit transitions
- **Dependencies**: 100_230
- **Deliverable**: Manual state transition command
- **Estimated Complexity**: Low (2-3 hours)

#### Task 100_330: Error Handling & Recovery
- **Scope**: Graceful error handling, rollback on failure, helpful error messages
- **Dependencies**: All previous tasks
- **Deliverable**: Comprehensive error handling
- **Estimated Complexity**: Medium (3-4 hours)

#### Task 100_340: Documentation & Examples
- **Scope**: README updates, example workflows, troubleshooting guide
- **Dependencies**: All previous tasks
- **Deliverable**: User documentation
- **Estimated Complexity**: Low (2-3 hours)

**Phase 3 Milestone**: Production-ready CLI with full documentation

---

### Task Dependency Graph

```
Phase 1 (Core):
100_110 (State File) ──┐
                       ├──> 100_130 (State Machine)
100_120 (Config) ──────┘
100_140 (Executor) ────────────────────────┐

Phase 2 (CLI):                             │
100_210 (ID Resolution) ──┐                │
                          ├──> 100_220 (Status) ──┐
100_130 ──────────────────┘                       │
                                                  ├──> 100_230 (Next)
100_140 ──────────────────────────────────────────┘       │
                                                          │
100_230 ──────────────────────────────────────────> 100_240 (Task Cmds)

Phase 3 (Git & Polish):
100_140 ──────────────────────────────────────────> 100_310 (Git)
100_230 ──────────────────────────────────────────> 100_320 (Manual)
All ───────────────────────────────────────────────> 100_330 (Errors)
All ───────────────────────────────────────────────> 100_340 (Docs)
```

### Parallel Work Opportunities

**Can be done in parallel:**
- 100_110 + 100_120 + 100_140 (no dependencies)
- 100_220 + 100_240 (after 100_210 is done)
- 100_310 + 100_320 (after Phase 2 is complete)

**Must be sequential:**
- 100_130 requires 100_110 + 100_120
- 100_230 requires 100_130 + 100_140 + 100_210
- 100_330 requires all previous tasks

### Testing Strategy Per Phase

**Phase 1 Tests:**
- Unit tests for each class (StateRepository, WorkflowConfigLoader, StateMachine, CommandExecutor)
- Integration test: Load config → Execute transition → Verify state update
- Mock file system and command execution

**Phase 2 Tests:**
- Unit tests for ID resolution and file scanning
- Integration test: Full CLI command execution (mocked state/config)
- Snapshot tests for tree rendering output

**Phase 3 Tests:**
- Integration test: Full workflow with real git commands (in test repo)
- Error scenario tests (invalid state, failed commands, etc.)
- End-to-end test: Create feature → Decompose → Start → Complete

---

## Critical Architectural Decisions Summary

### **IMPORTANT** Decisions

1. **State Storage**: Single YAML file with append-only history
   - **Rationale**: Human-readable, git-friendly, simple to implement
   - **Trade-off**: Merge conflicts deferred to future (acceptable for MVP)

2. **Command Execution**: Spawn with array args, no shell
   - **Rationale**: Prevents command injection (security-first)
   - **Trade-off**: More verbose code, but safer

3. **Workflow Configuration**: User-editable YAML
   - **Rationale**: Flexibility without code changes
   - **Trade-off**: Requires validation, but empowers users

4. **ID Resolution**: Support both full paths and short IDs
   - **Rationale**: Better UX (less typing)
   - **Trade-off**: Ambiguity handling needed

5. **Confirmation Prompts**: Required by default, skip with `--yes`
   - **Rationale**: Prevents accidental destructive operations
   - **Trade-off**: Extra step, but safer

6. **Exit Code Mapping**: Explicit in workflow config
   - **Rationale**: Flexible, handles command-specific behavior
   - **Trade-off**: More verbose config, but clearer

7. **Hierarchical "Next"**: Feature → First pending task in ID order
   - **Rationale**: Intuitive, matches git-town stacking
   - **Trade-off**: No explicit dependencies (deferred to future)

8. **No TUI**: Stay with simple CLI output
   - **Rationale**: Simpler implementation, works in CI/CD
   - **Trade-off**: Less interactive, but more scriptable

---

## Future Enhancements (Out of Scope)

These are explicitly deferred to maintain focus on MVP:

1. **Conditional Transitions**: "Move to ready only if all tasks completed"
2. **Phase-Level State Machine**: Explicit phase tracking
3. **Multi-User State Merging**: Conflict resolution
4. **Dependency Specification**: Explicit task dependencies
5. **Auto-Sync**: Automatic git-town sync on upstream changes
6. **TUI**: Full-screen interactive interface
7. **Parallel Execution**: Run multiple tasks simultaneously
8. **State Rollback**: Revert to previous states
9. **Web UI**: Browser-based visualization
10. **Remote State**: Share state across team

---

## Conclusion

This architecture provides a **solid foundation** for building a state machine-based workflow orchestration system. The design prioritizes:

✅ **Security**: Command injection prevention, input validation  
✅ **Maintainability**: Clear separation of concerns, reusable patterns  
✅ **Extensibility**: Easy to add new states, commands, features  
✅ **User Experience**: Intuitive CLI, helpful error messages, visual feedback  
✅ **Reliability**: Atomic state updates, audit trails, error recovery

The recommended 3-phase, 12-task decomposition provides a clear path to implementation with opportunities for parallel work and incremental delivery.

**Next Steps:**
1. Review this architecture with the team
2. Create task files for Phase 1 (100_110 - 100_140)
3. Begin implementation with 100_110 (State File Management)

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-03  
**Author**: AI Architect (Claude)
