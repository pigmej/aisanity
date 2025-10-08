# Architectural Analysis: Workflow Config YAML Loader

**Task ID:** 100_1_20  
**Created:** 2025-10-03  
**Status:** Architecture Analysis Complete

---

## Table of Contents

1. [Context Analysis](#context-analysis)
2. [Research Findings](#research-findings)
3. [Technology Recommendations](#technology-recommendations)
4. [System Architecture](#system-architecture)
5. [Scalability Considerations](#scalability-considerations)
6. [Security Architecture](#security-architecture)
7. [Integration Patterns](#integration-patterns)
8. [Performance Implications](#performance-implications)
9. [Implementation Guidance](#implementation-guidance)
10. [Integration with Prior Tasks](#integration-with-prior-tasks)

---

## Context Analysis

### Architectural Challenge

This task implements the **workflow configuration layer** for the state machine system. The WorkflowConfigLoader must provide:

1. **User-Editable Configuration**: YAML-based workflow definitions that can be manually edited without code changes
2. **Schema Validation**: Runtime validation using Zod to catch configuration errors early
3. **In-Memory Caching**: Cache parsed configuration for command duration to avoid repeated file I/O
4. **Type Safety**: Provide type-safe access to state definitions and transitions
5. **Command Validation**: Ensure only safe, allowlisted commands can be executed
6. **Helpful Error Messages**: Guide users when configuration is invalid

### Critical Requirements

**IMPORTANT**: This task can be developed in parallel with task 100_1_10 (State File YAML Repository) as they have no dependencies on each other. However, both will be consumed by task 100_1_40 (State Machine Engine).

The WorkflowConfigLoader serves as the **definition layer** for:
- Feature state machine definitions
- Task state machine definitions
- Transition rules and commands
- Exit code mappings
- Confirmation requirements
- Timeout configurations

**Key Distinction from StateRepository**:
- **StateRepository** (100_1_10): Manages *runtime state* (current states, transition history)
- **WorkflowConfigLoader** (100_1_20): Manages *workflow definitions* (available states, transition rules)

---

## Research Findings

### Industry Best Practices for Configuration Management

#### 1. Configuration File Patterns

**Research Source**: Industry standards for CLI tools (GitHub Actions, Ansible, Terraform)

**Common Patterns**:
- **Declarative YAML**: GitHub Actions, CircleCI, GitLab CI
- **Validation on Load**: Fail fast with clear error messages
- **Schema-First Design**: Define schema, then validate against it
- **Sensible Defaults**: Minimize required configuration

**Key Takeaways**:
- ✅ User-editable YAML is industry standard for workflow configuration
- ✅ Validation should happen at load time, not execution time
- ✅ Error messages should point to exact location in YAML file
- ✅ Configuration should be cached to avoid repeated parsing

#### 2. YAML Library Best Practices

**Research Source**: `yaml` package documentation (eemeli.org/yaml)

**Key Features of `yaml` Package**:
- ✅ TypeScript-native with excellent type support
- ✅ Preserves comments and formatting (critical for user editing)
- ✅ YAML 1.2 spec compliant
- ✅ Better error messages than alternatives (js-yaml)
- ✅ Already in project dependencies
- ✅ Zero external dependencies
- ✅ Works in Node.js and browsers

**Parsing Best Practices**:
```typescript
import { parse } from 'yaml'

// Good: Parse with error handling
try {
  const config = parse(yamlContent)
  // Validate with Zod
} catch (error) {
  // YAML syntax error - provide helpful message
}

// Bad: Silent failure
const config = parse(yamlContent) || {}
```

**Stringification Best Practices**:
```typescript
import { stringify } from 'yaml'

// Consistent formatting for git-friendly diffs
const yaml = stringify(config, {
  indent: 2,
  lineWidth: 80,
  minContentWidth: 20
})
```

#### 3. Zod Validation Patterns

**Research Source**: Zod documentation (github.com/colinhacks/zod)

**Why Zod is Ideal for This Use Case**:
- ✅ TypeScript-first with type inference (single source of truth)
- ✅ Runtime validation catches errors early
- ✅ Excellent error messages for debugging
- ✅ Lightweight (2kb gzipped, zero dependencies)
- ✅ Industry standard (used by tRPC, Astro, Next.js)
- ✅ Already specified in feature architecture

**Validation Strategy**:
```typescript
import { z } from 'zod'

// Define schema once
const TransitionSchema = z.object({
  command: z.string(),
  next_state_on_success: z.string(),
  next_state_on_failure: z.string(),
  requires_confirmation: z.boolean()
})

// Infer TypeScript type from schema
type Transition = z.infer<typeof TransitionSchema>

// Validate and get typed result
const transition = TransitionSchema.parse(data)
```

**Error Handling Pattern**:
```typescript
try {
  const config = WorkflowConfigSchema.parse(data)
} catch (error) {
  if (error instanceof z.ZodError) {
    // Format user-friendly error message
    const messages = error.issues.map(issue => 
      `${issue.path.join('.')}: ${issue.message}`
    )
    throw new ConfigValidationError(messages.join('\n'))
  }
}
```

#### 4. Caching Strategies for Configuration

**Research Source**: Node.js performance best practices

**Caching Approaches Evaluated**:

**Option A: No Caching**
- ❌ Repeated file I/O and parsing overhead
- ❌ Slower command execution
- ✅ Always fresh data
- ✅ Simple implementation

**Option B: In-Memory Cache with TTL**
- ✅ Fast access after first load
- ✅ Configurable expiration
- ❌ Complexity of cache invalidation
- ❌ Stale data risk

**Option C: Command-Duration Cache** (RECOMMENDED)
- ✅ Fast access within single command
- ✅ No stale data between commands
- ✅ Simple implementation
- ✅ Sufficient for CLI use case

**Decision**: Use command-duration caching (Option C). Each command execution loads config once and caches it for that command's lifetime. This is simple, fast enough, and avoids stale data issues.

#### 5. Command Validation and Security

**Research Source**: OWASP command injection prevention, existing codebase patterns

**Security Principles**:
1. **Allowlist, Never Blocklist**: Only permit known-safe commands
2. **No Shell Execution**: Use spawn with array args, not shell strings
3. **Validate Early**: Check commands at config load time, not execution time
4. **Clear Error Messages**: Tell users exactly what's wrong

**Allowlist Pattern**:
```typescript
const ALLOWED_COMMAND_PREFIXES = [
  'git town',
  'git commit',
  'git push',
  'opencode run',
  'npm run',
  'node dist/'
]

function validateCommand(command: string): boolean {
  return ALLOWED_COMMAND_PREFIXES.some(prefix => 
    command.startsWith(prefix)
  )
}
```

**IMPORTANT**: Command validation happens at config load time, not execution time. This provides immediate feedback to users editing the workflow config.

---

## Technology Recommendations

### Core Technologies

#### 1. YAML Parsing
- **Technology**: `yaml` package (v2.3.0+)
- **Rationale**:
  - Already in dependencies
  - Specified in feature architecture
  - TypeScript-native
  - Preserves formatting for human editing
  - Better error messages than alternatives
  - Zero external dependencies

#### 2. Schema Validation
- **Technology**: `zod` (v3.22.0+)
- **Rationale**:
  - Specified in feature architecture
  - TypeScript-first design
  - Runtime validation
  - Type inference reduces duplication
  - Excellent error messages
  - Industry standard

#### 3. File System Operations
- **Technology**: Node.js `fs/promises` API
- **Rationale**:
  - Native, no dependencies
  - Promise-based API aligns with async/await
  - Well-documented and stable
  - Sufficient for reading config file

#### 4. Caching
- **Technology**: Simple in-memory Map
- **Rationale**:
  - No dependencies
  - Sufficient for command-duration caching
  - Simple implementation
  - Easy to test

### No Additional Dependencies Required

All required technologies are either:
- Already in project dependencies (`yaml`, `commander`)
- To be added as part of feature (`zod`)
- Built into Node.js (`fs/promises`, `path`)

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                WorkflowConfigLoader                      │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Public API                                       │  │
│  │  - load()                                         │  │
│  │  - validate()                                     │  │
│  │  - getStateDefinition()                           │  │
│  │  - getTransition()                                │  │
│  └───────────────────────────────────────────────────┘  │
│                         ↓                                │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Cache Layer                                      │  │
│  │  - In-memory cache (command duration)            │  │
│  │  - Cache hit/miss tracking                       │  │
│  └───────────────────────────────────────────────────┘  │
│                         ↓                                │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Validation Layer (Zod)                           │  │
│  │  - Schema validation                              │  │
│  │  - Command allowlist checking                    │  │
│  │  - Type inference                                 │  │
│  └───────────────────────────────────────────────────┘  │
│                         ↓                                │
│  ┌───────────────────────────────────────────────────┐  │
│  │  File Operations                                  │  │
│  │  - Read .aisanity-workflow.yml                    │  │
│  │  - Parse YAML                                     │  │
│  │  - Error handling                                 │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↓
               .aisanity-workflow.yml
```

### Component Design

#### WorkflowConfigLoader Class

**Responsibilities**:
- Load and parse workflow configuration file
- Validate configuration against schema
- Cache parsed configuration in memory
- Provide type-safe access to state definitions
- Validate commands against allowlist
- Provide helpful error messages

**Key Methods**:

```typescript
class WorkflowConfigLoader {
  // Load and cache workflow configuration
  async load(): Promise<WorkflowConfig>
  
  // Validate configuration without caching
  validate(config: unknown): WorkflowConfig
  
  // Get state definition for a specific state
  getStateDefinition(
    stateName: string, 
    type: 'feature' | 'task'
  ): StateDefinition | null
  
  // Get transition definition
  getTransition(
    fromState: string,
    transitionName: string,
    type: 'feature' | 'task'
  ): Transition | null
  
  // Clear cache (for testing)
  clearCache(): void
}
```

**IMPORTANT**: The loader uses a singleton pattern with command-duration caching. Each command execution gets a fresh instance, which caches the config for that command's lifetime.

#### Schema Definitions

**Workflow Config Schema**:
```typescript
const SettingsSchema = z.object({
  confirmation: z.object({
    enabled: z.boolean(),
    skip_for_read_only: z.boolean()
  }),
  timeout: z.object({
    default: z.number().positive(),
    per_command: z.record(z.number().positive()).optional()
  })
})

const TransitionSchema = z.object({
  command: z.string()
    .refine(validateCommand, 'Command not in allowlist'),
  next_state_on_success: z.string(),
  next_state_on_failure: z.string(),
  requires_confirmation: z.boolean()
})

const StateDefinitionSchema = z.object({
  description: z.string(),
  transitions: z.record(TransitionSchema)
})

const WorkflowConfigSchema = z.object({
  version: z.string(),
  settings: SettingsSchema,
  feature_states: z.record(StateDefinitionSchema),
  task_states: z.record(StateDefinitionSchema),
  variables: z.record(z.string()).optional()
})

// Infer TypeScript types
type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>
type StateDefinition = z.infer<typeof StateDefinitionSchema>
type Transition = z.infer<typeof TransitionSchema>
```

**Benefits**:
- Single source of truth for types and validation
- Type safety throughout codebase
- Runtime validation catches errors early
- Clear error messages for invalid configs

#### Command Validation

**Allowlist Pattern**:
```typescript
const ALLOWED_COMMAND_PREFIXES = [
  'git town hack',
  'git town append',
  'git town sync',
  'git commit',
  'git push',
  'opencode run',
  'npm run',
  'node dist/'
] as const

function validateCommand(command: string): boolean {
  // Check against allowlist
  const isAllowed = ALLOWED_COMMAND_PREFIXES.some(prefix => 
    command.startsWith(prefix)
  )
  
  // Additional checks
  if (!isAllowed) return false
  
  // Prevent command chaining
  if (command.includes('&&') || 
      command.includes('||') || 
      command.includes(';')) {
    return false
  }
  
  // Prevent shell metacharacters in variable placeholders
  const variablePattern = /\{[^}]+\}/g
  const variables = command.match(variablePattern) || []
  for (const variable of variables) {
    if (/[;&|`$(){}[\]<>]/.test(variable)) {
      return false
    }
  }
  
  return true
}
```

**IMPORTANT**: Command validation is strict and fails early. This prevents security issues and provides clear feedback to users.

#### Caching Strategy

**Command-Duration Cache**:
```typescript
class WorkflowConfigLoader {
  private cache: WorkflowConfig | null = null
  private cacheTimestamp: number | null = null
  
  async load(): Promise<WorkflowConfig> {
    // Check cache
    if (this.cache !== null) {
      return this.cache
    }
    
    // Load from file
    const content = await fs.readFile(this.configPath, 'utf8')
    const parsed = YAML.parse(content)
    const validated = this.validate(parsed)
    
    // Cache for command duration
    this.cache = validated
    this.cacheTimestamp = Date.now()
    
    return validated
  }
  
  clearCache(): void {
    this.cache = null
    this.cacheTimestamp = null
  }
}
```

**Benefits**:
- Fast access after first load
- No stale data between commands
- Simple implementation
- Easy to test

---

## Scalability Considerations

### Configuration File Size

**Expected Size**:
- Feature states: ~10-20 states × ~200 bytes = 2-4 KB
- Task states: ~10-20 states × ~200 bytes = 2-4 KB
- Settings and metadata: ~1 KB
- **Total**: ~5-10 KB

**Conclusion**: File size is negligible. No optimization needed.

### Parse Performance

**Performance Analysis**:
- Read file: ~1ms (10 KB file)
- Parse YAML: ~2ms
- Validate with Zod: ~1ms
- **Total**: ~4ms

**Conclusion**: Performance is excellent for CLI operations. Caching provides additional speedup for repeated access within a command.

### Memory Footprint

**Memory Usage**:
- Parsed config object: ~20 KB in memory
- Zod schemas: ~10 KB (shared across instances)
- **Total**: ~30 KB per instance

**Conclusion**: Memory usage is negligible for Node.js process.

### Concurrent Access

**Current Scope**: Single user, single process

**Approach**: Each command execution creates a new loader instance with its own cache. No shared state between commands.

**Future Enhancement**: If multi-user scenarios emerge, consider:
- File watching for automatic reload
- Shared cache with invalidation
- Lock-free reads (config is read-only)

---

## Security Architecture

### Threat Model

**Threats**:
1. **Malicious Commands**: User edits config to include dangerous commands
2. **Command Injection**: Variable substitution introduces shell metacharacters
3. **Path Traversal**: Config file path manipulation
4. **YAML Bombs**: Crafted YAML that causes parser to hang or crash
5. **Schema Bypass**: Invalid config that passes validation

### Security Measures

#### 1. Command Allowlist

**Mitigation**:
- Strict allowlist of command prefixes
- Validation at config load time
- No shell execution (enforced by executor)
- Command chaining prevention

**Code Pattern**:
```typescript
const CommandSchema = z.string()
  .refine(validateCommand, {
    message: 'Command not allowed. Must start with one of: ' +
      ALLOWED_COMMAND_PREFIXES.join(', ')
  })
```

**IMPORTANT**: This is the primary security control. All commands must pass this check before being stored in the config.

#### 2. Variable Validation

**Mitigation**:
- Validate variable names in commands
- Prevent shell metacharacters in variable placeholders
- Document allowed variables

**Code Pattern**:
```typescript
const ALLOWED_VARIABLES = [
  'id', 'title', 'feature_id', 'phase'
] as const

function validateVariables(command: string): boolean {
  const variablePattern = /\{([^}]+)\}/g
  const matches = command.matchAll(variablePattern)
  
  for (const match of matches) {
    const varName = match[1]
    if (!ALLOWED_VARIABLES.includes(varName as any)) {
      return false
    }
  }
  
  return true
}
```

#### 3. Path Validation

**Mitigation**:
- Validate config file path is within project
- Reject absolute paths outside project
- Reject paths with `..` traversal

**Code Pattern**:
```typescript
function validateConfigPath(configPath: string): boolean {
  const resolved = path.resolve(configPath)
  const projectRoot = process.cwd()
  
  // Ensure path is within project
  return resolved.startsWith(projectRoot)
}
```

#### 4. YAML Parser Security

**Mitigation**:
- Use `yaml` package (actively maintained, security updates)
- Catch and handle parse errors gracefully
- Validate parsed data with Zod before use
- Set reasonable limits (max file size)

**Code Pattern**:
```typescript
const MAX_CONFIG_SIZE = 1024 * 1024 // 1 MB

async function loadConfig(configPath: string): Promise<unknown> {
  // Check file size
  const stats = await fs.stat(configPath)
  if (stats.size > MAX_CONFIG_SIZE) {
    throw new ConfigError('Config file too large')
  }
  
  // Read and parse
  const content = await fs.readFile(configPath, 'utf8')
  
  try {
    return YAML.parse(content)
  } catch (error) {
    throw new ConfigParseError('Invalid YAML syntax', error)
  }
}
```

#### 5. Schema Validation

**Mitigation**:
- Comprehensive Zod schemas
- Fail fast on validation errors
- Clear error messages
- No silent failures

**IMPORTANT**: All config data must pass Zod validation before being used. No exceptions.

### Audit Logging

**Strategy**: Log config load operations

**Log Format**:
```typescript
interface ConfigLoadLog {
  timestamp: string
  operation: 'load' | 'validate'
  config_path: string
  success: boolean
  error?: string
  cache_hit?: boolean
}
```

**Implementation**:
```typescript
function logConfigLoad(entry: ConfigLoadLog): void {
  // Log to stderr (doesn't interfere with stdout)
  console.error(JSON.stringify(entry))
}
```

---

## Integration Patterns

### Integration with State Machine Engine

**Dependency**: This task has no dependencies, but will be used by task 100_1_40 (State Machine Engine)

**Integration Pattern**:
```typescript
// State Machine Engine uses WorkflowConfigLoader
class StateMachine {
  constructor(
    private stateRepo: StateRepository,
    private configLoader: WorkflowConfigLoader
  ) {}
  
  async canTransition(
    id: string,
    type: 'feature' | 'task',
    fromState: string,
    toState: string
  ): Promise<boolean> {
    const config = await this.configLoader.load()
    const stateDef = this.configLoader.getStateDefinition(fromState, type)
    
    if (!stateDef) return false
    
    // Check if transition exists
    return Object.values(stateDef.transitions).some(
      t => t.next_state_on_success === toState || 
           t.next_state_on_failure === toState
    )
  }
  
  async getNextTransition(
    id: string,
    type: 'feature' | 'task'
  ): Promise<Transition | null> {
    const currentState = await this.stateRepo.getEntityState(id, type)
    if (!currentState) return null
    
    const stateDef = this.configLoader.getStateDefinition(
      currentState.current_state, 
      type
    )
    
    if (!stateDef) return null
    
    // Return first transition (or apply logic to choose)
    const transitions = Object.values(stateDef.transitions)
    return transitions[0] || null
  }
}
```

**IMPORTANT**: The config loader provides read-only access to workflow definitions. It does not modify state.

### Integration with File System

**Config File Location**: `.aisanity-workflow.yml` in project root

**Initialization**:
```typescript
class WorkflowConfigLoader {
  constructor(
    private configPath: string = '.aisanity-workflow.yml'
  ) {}
  
  async load(): Promise<WorkflowConfig> {
    // Check if file exists
    try {
      await fs.access(this.configPath)
    } catch (error) {
      throw new ConfigNotFoundError(
        `Workflow config not found at ${this.configPath}`
      )
    }
    
    // Load and validate
    const content = await fs.readFile(this.configPath, 'utf8')
    const parsed = YAML.parse(content)
    return this.validate(parsed)
  }
}
```

### Integration with Existing Codebase

**Pattern Consistency**: Follow existing patterns from `docker-safe-exec.ts`

**Error Handling**:
```typescript
// Custom error types (similar to DockerExecError)
export class WorkflowConfigError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'WorkflowConfigError'
  }
}

export class ConfigNotFoundError extends WorkflowConfigError {
  constructor(path: string) {
    super(`Workflow config not found: ${path}`)
    this.name = 'ConfigNotFoundError'
  }
}

export class ConfigParseError extends WorkflowConfigError {
  constructor(message: string, public originalError?: Error) {
    super(`YAML parse error: ${message}`)
    this.name = 'ConfigParseError'
  }
}

export class ConfigValidationError extends WorkflowConfigError {
  constructor(public zodError: z.ZodError) {
    const messages = zodError.issues.map(issue => 
      `${issue.path.join('.')}: ${issue.message}`
    )
    super(`Config validation failed:\n${messages.join('\n')}`)
    this.name = 'ConfigValidationError'
  }
}
```

---

## Performance Implications

### Critical Path Analysis

**Load Operation** (First Call):
1. Check cache: ~0.1ms (cache miss)
2. Read file: ~1ms (10 KB file)
3. Parse YAML: ~2ms
4. Validate schema: ~1ms
5. Cache result: ~0.1ms
**Total**: ~4ms

**Load Operation** (Cached):
1. Check cache: ~0.1ms (cache hit)
2. Return cached config: ~0.1ms
**Total**: ~0.2ms

**Conclusion**: Performance is excellent for CLI operations. Caching provides 20x speedup for repeated access.

### Optimization Opportunities

#### 1. Lazy Loading

**Trade-off**:
- ✅ Faster startup if config not needed
- ❌ Complexity of deferred loading
- ❌ Harder to test

**Decision**: Not needed. Config loading is fast enough (~4ms) that lazy loading adds unnecessary complexity.

#### 2. Partial Validation

**Trade-off**:
- ✅ Faster validation if only part of config needed
- ❌ Complex validation logic
- ❌ Risk of missing errors

**Decision**: Not needed. Full validation is fast (~1ms) and ensures config integrity.

#### 3. Pre-Compilation

**Trade-off**:
- ✅ Faster loading (no parsing)
- ❌ Loss of human editability
- ❌ Build step required

**Decision**: Not appropriate. Human editability is a core requirement.

### Memory Footprint

**Config in Memory**:
- Parsed object: ~20 KB
- Zod schemas: ~10 KB (shared)
- Cache overhead: ~1 KB

**Conclusion**: Memory usage is negligible for Node.js process.

---

## Implementation Guidance

### High-Level Implementation Steps

#### Phase 1: Core Loader (Priority 1)

1. **Create WorkflowConfigLoader class**
   - Constructor with configurable config file path
   - Private methods for file operations
   - Public API methods (load, validate, getStateDefinition, getTransition)

2. **Implement Zod schemas**
   - Define SettingsSchema
   - Define TransitionSchema
   - Define StateDefinitionSchema
   - Define WorkflowConfigSchema
   - Export inferred TypeScript types

3. **Implement file loading**
   - Read config file with error handling
   - Parse YAML with error handling
   - Validate with Zod
   - Return typed config object

#### Phase 2: Validation (Priority 2)

4. **Implement command validation**
   - Define ALLOWED_COMMAND_PREFIXES
   - Implement validateCommand function
   - Integrate with Zod schema
   - Add variable validation

5. **Add detailed error messages**
   - Custom error classes
   - Format Zod errors for users
   - Include file location in errors
   - Provide suggestions for fixes

#### Phase 3: Caching (Priority 3)

6. **Implement in-memory caching**
   - Add cache property to class
   - Check cache before loading
   - Store validated config in cache
   - Provide clearCache method for testing

7. **Add accessor methods**
   - getStateDefinition(stateName, type)
   - getTransition(fromState, transitionName, type)
   - Helper methods for common queries

#### Phase 4: Testing (Priority 1)

8. **Write comprehensive unit tests**
   - Test valid config loading
   - Test invalid YAML syntax
   - Test schema validation errors
   - Test command validation
   - Test caching behavior
   - Test error messages
   - Aim for >90% coverage

9. **Create example config file**
   - Include all features
   - Add comprehensive comments
   - Provide examples for each state type
   - Document variable usage

### Architectural Guidelines

#### 1. Single Responsibility

Each method should have one clear purpose:
- `load()`: Load, parse, validate, and cache
- `validate()`: Only validate (no file I/O or caching)
- `getStateDefinition()`: Only retrieve state definition
- `getTransition()`: Only retrieve transition

#### 2. Fail-Fast Validation

**IMPORTANT**: Prefer failing loudly over silent errors

```typescript
// Good: Fail loudly on validation error
const config = WorkflowConfigSchema.parse(data)

// Bad: Silent failure
const result = WorkflowConfigSchema.safeParse(data)
if (!result.success) {
  return null // Silent failure!
}
```

#### 3. Type Safety

**IMPORTANT**: Use Zod type inference for type safety

```typescript
// Good: Single source of truth
const ConfigSchema = z.object({ ... })
type Config = z.infer<typeof ConfigSchema>

// Bad: Duplicate definitions
const ConfigSchema = z.object({ ... })
interface Config { ... } // Duplication!
```

#### 4. Error Handling

Follow existing codebase patterns:
- Custom error types
- Descriptive error messages
- Include context in errors
- Log errors to stderr

#### 5. Testability

Design for testability:
- Inject dependencies (config path)
- Provide clearCache for testing
- Mock file system in tests
- Test error paths

### Testing Strategy

#### Unit Tests

**File**: `tests/workflow-config-loader.test.ts`

**Test Categories**:

1. **Basic Operations**
   - Load valid config file
   - Validate config object
   - Get state definition
   - Get transition

2. **Validation**
   - Valid schema passes
   - Invalid schema fails
   - Missing required fields
   - Wrong data types
   - Invalid commands

3. **Caching**
   - First load reads file
   - Second load uses cache
   - Cache cleared properly
   - Cache hit/miss tracking

4. **Command Validation**
   - Allowed commands pass
   - Disallowed commands fail
   - Command chaining rejected
   - Variable validation

5. **Error Handling**
   - File not found
   - YAML parse error
   - Schema validation error
   - Helpful error messages

6. **Accessor Methods**
   - Get existing state definition
   - Get non-existent state definition
   - Get existing transition
   - Get non-existent transition

**Coverage Target**: >90%

#### Integration Tests

**File**: `tests/workflow-config-loader.integration.test.ts`

**Test Scenarios**:
- Load real config file
- Validate against real schema
- Test with example config
- Test error messages with real YAML

### Code Organization

**File Structure**:
```
src/workflow/
├── workflow-config-loader.ts  # Main WorkflowConfigLoader class
├── schemas.ts                  # Zod schemas and types
├── command-validator.ts        # Command validation logic
├── errors.ts                   # Custom error classes
└── types.ts                    # TypeScript interfaces

tests/
├── workflow-config-loader.test.ts  # Unit tests
└── workflow-config-loader.integration.test.ts  # Integration tests

examples/
└── .aisanity-workflow.yml      # Example config with comments
```

### Dependencies

**Required**:
- `zod`: Schema validation (add to package.json)
- `yaml`: YAML parsing (already in dependencies)
- `fs/promises`: File operations (Node.js built-in)
- `path`: Path manipulation (Node.js built-in)

**Dev Dependencies**:
- `@types/node`: TypeScript types (already in devDependencies)
- `jest`: Testing framework (already in devDependencies)

### Example Workflow Config

**File**: `.aisanity-workflow.yml`

```yaml
# Aisanity Workflow Configuration
# This file defines the state machines for features and tasks

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
  # Initial state when feature file is discovered
  discovered:
    description: "Feature file exists but not decomposed"
    transitions:
      decompose:
        command: "opencode run /feature_decompose --feature-id {id}"
        next_state_on_success: "decomposed"
        next_state_on_failure: "discovered"
        requires_confirmation: true
  
  # Feature has been broken into tasks
  decomposed:
    description: "Feature has been broken into tasks"
    transitions:
      start:
        command: "git town hack feature/{id}-phase-{phase}"
        next_state_on_success: "in_progress"
        next_state_on_failure: "decomposed"
        requires_confirmation: true
  
  # Feature is being worked on
  in_progress:
    description: "Feature is being worked on"
    transitions:
      complete:
        command: "git town sync"
        next_state_on_success: "completed"
        next_state_on_failure: "in_progress"
        requires_confirmation: true
  
  # Feature is complete
  completed:
    description: "Feature is complete"
    transitions: {}

# Task workflow state machine
task_states:
  # Initial state when task file exists
  file_exists:
    description: "Task file exists but not planned"
    transitions:
      plan:
        command: "opencode run /auto_plan --task-id {id}"
        next_state_on_success: "planned"
        next_state_on_failure: "file_exists"
        requires_confirmation: true
  
  # Task has an implementation plan
  planned:
    description: "Task has an implementation plan"
    transitions:
      start:
        command: "git town append feature/{id}-{title}"
        next_state_on_success: "in_progress"
        next_state_on_failure: "planned"
        requires_confirmation: true
  
  # Task is being implemented
  in_progress:
    description: "Task is being implemented"
    transitions:
      complete:
        command: "git commit -am 'Complete task {id}'"
        next_state_on_success: "completed"
        next_state_on_failure: "in_progress"
        requires_confirmation: false  # Commit is safe to retry
  
  # Task is complete
  completed:
    description: "Task is complete"
    transitions: {}

# Variable definitions (for documentation)
# These variables can be used in commands with {variable_name} syntax
variables:
  id: "Feature or task ID (e.g., 100, 100_110)"
  title: "Kebab-case title extracted from filename"
  feature_id: "Parent feature ID for tasks"
  phase: "Phase number extracted from task ID (e.g., 1 from 100_110)"
```

---

## Critical Architectural Decisions Summary

### IMPORTANT Decisions

1. **Command-Duration Caching**
   - **Rationale**: Simple, fast enough, no stale data
   - **Trade-off**: No cross-command caching, but acceptable for CLI

2. **Zod for Schema Validation**
   - **Rationale**: TypeScript-first, type inference, excellent errors
   - **Trade-off**: Runtime overhead (negligible for CLI)

3. **Strict Command Allowlist**
   - **Rationale**: Security-first, prevents command injection
   - **Trade-off**: Less flexible, but safer

4. **Fail-Fast Validation**
   - **Rationale**: Catch errors early, provide clear feedback
   - **Trade-off**: No partial validation, but ensures integrity

5. **User-Editable YAML**
   - **Rationale**: Flexibility without code changes
   - **Trade-off**: Requires validation, but empowers users

6. **Separate Feature and Task States**
   - **Rationale**: Different workflows, different rules
   - **Trade-off**: More config, but clearer separation

7. **No File Watching**
   - **Rationale**: Simple implementation, sufficient for CLI
   - **Trade-off**: No automatic reload, but acceptable

8. **Example Config with Comments**
   - **Rationale**: Self-documenting, helps users
   - **Trade-off**: Maintenance burden, but worth it

---

## Future Enhancements (Out of Scope for MVP)

These are explicitly deferred to maintain focus on core functionality:

1. **File Watching**: Automatic reload on config changes
2. **Config Validation CLI**: Standalone command to validate config
3. **Config Migration**: Automatic migration between versions
4. **Config Merging**: Support for multiple config files
5. **Conditional Transitions**: "Move to ready only if all tasks completed"
6. **Dynamic Command Generation**: Generate commands based on context
7. **Config Templates**: Pre-defined workflow templates
8. **Config Inheritance**: Base configs with overrides
9. **Config Linting**: Style and best practice checks
10. **Config Documentation**: Auto-generate docs from config

---

## Integration with Prior Tasks

### Dependent Tasks

**NONE** - This task has no dependencies on prior tasks.

As stated in the task requirements:
> "This is a foundational task with no dependencies. It provides the workflow configuration layer that will be used by the state machine engine (100_1_40)."

However, this task is part of the same feature as task **100_1_10 (State File YAML Repository)**, and both will be consumed by downstream tasks.

### Parallel Development Context

**Task 100_1_10 (State File YAML Repository)**:
- **Purpose**: Manages *runtime state* (current states, transition history)
- **File**: `.aisanity-state.yml`
- **Responsibilities**: Persist and retrieve entity states, track transitions
- **Key APIs**: `load()`, `save()`, `getEntityState()`, `updateEntityState()`

**Task 100_1_20 (Workflow Config YAML Loader)** - THIS TASK:
- **Purpose**: Manages *workflow definitions* (available states, transition rules)
- **File**: `.aisanity-workflow.yml`
- **Responsibilities**: Load and validate workflow configuration
- **Key APIs**: `load()`, `validate()`, `getStateDefinition()`, `getTransition()`

**CRITICAL DISTINCTION**: These two tasks manage **different concerns**:
- **StateRepository**: "What is the current state?" (runtime data)
- **WorkflowConfigLoader**: "What states are possible?" (configuration)

### Integration Points

**IMPORTANT**: While this task has no dependencies on prior tasks, it will integrate with task 100_1_10 through the **State Machine Engine (100_1_40)**.

#### Future Integration Pattern (Task 100_1_40)

```typescript
// State Machine Engine will use BOTH components
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
    const currentState = await this.stateRepo.getEntityState(id, type)
    if (!currentState) {
      throw new Error(`Entity ${id} not found`)
    }
    
    // 2. Get transition definition from WorkflowConfigLoader
    const stateDef = this.configLoader.getStateDefinition(
      currentState.current_state,
      type
    )
    if (!stateDef) {
      throw new Error(`State ${currentState.current_state} not defined`)
    }
    
    const transition = stateDef.transitions[transitionName]
    if (!transition) {
      throw new Error(`Transition ${transitionName} not found`)
    }
    
    // 3. Execute command (from config)
    const exitCode = await this.executeCommand(transition.command)
    
    // 4. Determine next state based on exit code
    const nextState = exitCode === 0
      ? transition.next_state_on_success
      : transition.next_state_on_failure
    
    // 5. Update state in StateRepository
    await this.stateRepo.updateEntityState(id, type, (entity) => {
      const transitionRecord: Transition = {
        from: entity.current_state,
        to: nextState,
        command: transition.command,
        exit_code: exitCode,
        timestamp: new Date().toISOString()
      }
      
      return {
        ...entity,
        current_state: nextState,
        transitions: [...entity.transitions, transitionRecord]
      }
    })
  }
}
```

### Data Flow

**Configuration Flow** (Read-Only):
```
.aisanity-workflow.yml
         ↓
  WorkflowConfigLoader.load()
         ↓
  Validated WorkflowConfig
         ↓
  State Machine Engine
```

**State Flow** (Read-Write):
```
.aisanity-state.yml
         ↓
  StateRepository.load()
         ↓
  Current EntityState
         ↓
  State Machine Engine
         ↓
  StateRepository.updateEntityState()
         ↓
  .aisanity-state.yml (updated)
```

**Combined Flow in State Machine**:
```
User Command
     ↓
State Machine Engine
     ├─→ WorkflowConfigLoader.getStateDefinition() → Transition rules
     └─→ StateRepository.getEntityState() → Current state
     ↓
Execute transition command
     ↓
StateRepository.updateEntityState() → Record transition
```

### Data Structures and Interfaces Shared

**IMPORTANT**: While both tasks use similar concepts, they manage **different data**:

#### Shared Concepts (Different Implementations)

**Transition** (Different meanings in each task):

**In StateRepository (100_1_10)** - Historical record:
```typescript
interface Transition {
  from: string              // Actual state transitioned from
  to: string                // Actual state transitioned to
  command: string           // Command that was executed
  exit_code: number         // Actual exit code
  timestamp: string         // When transition occurred
}
```

**In WorkflowConfigLoader (100_1_20)** - Definition/rule:
```typescript
interface Transition {
  command: string                    // Command to execute
  next_state_on_success: string      // Target state if success
  next_state_on_failure: string      // Target state if failure
  requires_confirmation: boolean     // Whether to confirm
}
```

**State Names** (Shared vocabulary):
- Both tasks reference the same state names (e.g., "discovered", "planned", "in_progress")
- StateRepository stores which state an entity is in
- WorkflowConfigLoader defines what those states mean and how to transition

**Entity Types** (Shared enum):
```typescript
type EntityType = 'feature' | 'task'
```

### Anti-Patterns to Avoid

#### DO NOT Hardcode Workflow Definitions

**❌ BAD - Hardcoding state definitions**:
```typescript
// DO NOT DO THIS
class StateMachine {
  async canTransition(fromState: string, toState: string): Promise<boolean> {
    // Hardcoded workflow logic
    if (fromState === 'discovered' && toState === 'decomposed') {
      return true
    }
    if (fromState === 'decomposed' && toState === 'in_progress') {
      return true
    }
    // ... more hardcoded rules
  }
}
```

**✅ GOOD - Use WorkflowConfigLoader**:
```typescript
class StateMachine {
  async canTransition(fromState: string, toState: string): Promise<boolean> {
    const stateDef = this.configLoader.getStateDefinition(fromState, type)
    if (!stateDef) return false
    
    return Object.values(stateDef.transitions).some(
      t => t.next_state_on_success === toState || 
           t.next_state_on_failure === toState
    )
  }
}
```

#### DO NOT Duplicate State Management

**❌ BAD - Storing state in config loader**:
```typescript
// DO NOT DO THIS
class WorkflowConfigLoader {
  private currentStates: Map<string, string> = new Map()
  
  setCurrentState(id: string, state: string) {
    this.currentStates.set(id, state) // WRONG!
  }
}
```

**✅ GOOD - Config loader is read-only**:
```typescript
class WorkflowConfigLoader {
  // Only provides workflow definitions
  getStateDefinition(stateName: string, type: EntityType): StateDefinition | null {
    // Read-only access to configuration
  }
}
```

#### DO NOT Create Temporary Implementations

**❌ BAD - Temporary in-memory state**:
```typescript
// DO NOT DO THIS
class StateMachine {
  private tempStates: Map<string, string> = new Map()
  
  async executeTransition(id: string, toState: string) {
    // Storing state temporarily instead of using StateRepository
    this.tempStates.set(id, toState) // WRONG!
  }
}
```

**✅ GOOD - Use StateRepository from 100_1_10**:
```typescript
class StateMachine {
  async executeTransition(id: string, toState: string) {
    // Use proper state persistence
    await this.stateRepo.updateEntityState(id, type, (entity) => ({
      ...entity,
      current_state: toState
    }))
  }
}
```

#### DO NOT Mix Configuration and State

**❌ BAD - Storing runtime state in workflow config**:
```typescript
// DO NOT modify .aisanity-workflow.yml with runtime data
const config = await configLoader.load()
config.feature_states['100'].current_state = 'in_progress' // WRONG!
```

**✅ GOOD - Keep concerns separated**:
```typescript
// Workflow config is read-only
const config = await configLoader.load()
const stateDef = config.feature_states['discovered']

// Runtime state goes to StateRepository
await stateRepo.updateEntityState('100', 'feature', (entity) => ({
  ...entity,
  current_state: 'in_progress'
}))
```

### Integration Testing

When implementing the State Machine Engine (100_1_40), verify integration:

#### Test: Config and State Work Together

```typescript
describe('Integration: WorkflowConfigLoader + StateRepository', () => {
  test('state machine uses both components correctly', async () => {
    // Setup
    const stateRepo = new StateRepository()
    const configLoader = new WorkflowConfigLoader()
    const stateMachine = new StateMachine(stateRepo, configLoader)
    
    // Initialize state
    await stateRepo.initialize()
    
    // Execute transition
    await stateMachine.executeTransition('100', 'feature', 'decompose')
    
    // Verify state was updated
    const state = await stateRepo.load()
    const featureState = state.features['100']
    expect(featureState.current_state).toBe('decomposed')
    
    // Verify transition was recorded
    expect(featureState.transitions).toHaveLength(1)
    expect(featureState.transitions[0].to).toBe('decomposed')
  })
  
  test('invalid transition is rejected', async () => {
    const stateRepo = new StateRepository()
    const configLoader = new WorkflowConfigLoader()
    const stateMachine = new StateMachine(stateRepo, configLoader)
    
    // Try invalid transition
    await expect(
      stateMachine.executeTransition('100', 'feature', 'invalid_transition')
    ).rejects.toThrow('Transition invalid_transition not found')
  })
})
```

### CRITICAL INTEGRATION REQUIREMENTS

**IMPORTANT**: When implementing downstream tasks (especially 100_1_40):

1. **DO NOT hardcode workflow definitions** - Always use `WorkflowConfigLoader.getStateDefinition()`
2. **DO NOT hardcode state data** - Always use `StateRepository.getEntityState()` and `updateEntityState()`
3. **DO NOT mix configuration and state** - Keep `.aisanity-workflow.yml` read-only
4. **DO NOT create temporary state storage** - Use StateRepository as single source of truth
5. **DO validate transitions** - Check transition exists in config before executing
6. **DO record all transitions** - Use StateRepository to append to transition history
7. **DO handle both success and failure paths** - Use `next_state_on_success` and `next_state_on_failure`

### Integration Checklist for Downstream Tasks

When implementing tasks that depend on this:

- [ ] Inject both `StateRepository` and `WorkflowConfigLoader` as dependencies
- [ ] Use `configLoader.load()` to get workflow definitions
- [ ] Use `stateRepo.load()` to get current state
- [ ] Use `configLoader.getStateDefinition()` to get transition rules
- [ ] Use `stateRepo.updateEntityState()` to record transitions
- [ ] Never modify workflow config at runtime
- [ ] Never store state outside StateRepository
- [ ] Test integration between both components
- [ ] Verify transition history is recorded correctly

---

## Conclusion

This architectural analysis provides a comprehensive blueprint for implementing the WorkflowConfigLoader class. The design prioritizes:

✅ **Security**: Command allowlist, validation, no shell execution  
✅ **Usability**: Clear error messages, example config, documentation  
✅ **Maintainability**: Type safety, single source of truth, testability  
✅ **Performance**: Fast loading, efficient caching, minimal overhead  
✅ **Flexibility**: User-editable YAML, extensible schema

The WorkflowConfigLoader will serve as the **definition layer** for the state machine system, providing type-safe access to workflow configurations.

**Integration Context**: This task works in parallel with task 100_1_10 (StateRepository). Both are foundational components that will be integrated by task 100_1_40 (State Machine Engine). The clear separation of concerns (configuration vs. state) ensures clean architecture and maintainability.

**Next Steps**:
1. Add `zod` to package.json dependencies
2. Create `src/workflow/` directory structure
3. Implement WorkflowConfigLoader class following this architecture
4. Write comprehensive unit tests (>90% coverage)
5. Create example `.aisanity-workflow.yml` with comments
6. Document public API with JSDoc comments

---

**Document Version**: 1.1  
**Last Updated**: 2025-10-03  
**Architect**: AI Architect (Claude)
