# Development Guidelines

## Development Environment Setup

This document contains guidelines for setting up and using the Aisanity development environment with Bun runtime support.

## Getting Started

### Prerequisites

- **Bun >= 1.0.0** (required)
- **Docker** (for container operations)
- **Devcontainers CLI** (`npm install -g @devcontainers/cli`)

### Development Setup

1. **Install Bun runtime** (recommended):
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Clone and setup the project**:
   ```bash
   git clone <repository-url>
   cd aisanity
   bun install
   ```

3. **Verify development environment**:
   ```bash
   bun run dev --help
   bun test
   ```

### Development Commands

```bash
# Development with hot reload
bun run dev

# Run tests
bun test

# Run tests with coverage
bun run test:coverage

# Build project
bun run build

# Create single binary
bun run package

# Lint code
bun run lint
```



## Aisanity Usage

1. Initialize your workspace: `aisanity init`
2. Start development: `aisanity run`
3. Check status: `aisanity status`
4. Stop containers: `aisanity stop`

## Architecture Overview

### Process Management
- **Docker Integration**: Using Bun's native spawn and $ APIs
- **Shell Commands**: Direct Bun shell execution
- **Error Handling**: Simplified error handling

### Testing Framework
- **Bun Test Runner**: Native TypeScript support, faster execution
- **Performance Benchmarks**: Automated performance validation

### Environment Variable Processing
- **Security-First Design**: Whitelist-based filtering with wildcard pattern matching
- **Performance Optimized**: Pattern caching and efficient filtering algorithms
- **Precedence Management**: CLI > host > config environment variable resolution
- **Devcontainer Integration**: Seamless integration with `--remote-env` flags

## Best Practices

### Using Bun APIs

Always use Bun's native APIs for shell commands and process spawning:

```typescript
// Shell execution
import { $ } from 'bun';
const output = await $`git status`.text();

// Process spawning
const proc = Bun.spawn(['command', 'arg'], { stdout: 'pipe' });
```

### Error Handling

```typescript
try {
  const result = await $`command`.text();
} catch (error) {
  console.error('Command failed:', error.message);
}
```

### Development Workflow
- Use Bun for all development (4x faster startup)
- Test on both runtimes before submitting PRs
- Use `bun run dev` for hot reload during development
- Run `bun test` frequently for fast feedback

### Code Quality
- Use TypeScript strict mode (enabled)
- Follow existing code style and naming conventions
- Add runtime compatibility tests for new features
- Document any runtime-specific behavior

### Performance Optimization
- Leverage Bun's native TypeScript support
- Use Bun.spawn for Docker operations when available
- Implement AbortController for timeout handling
- Profile performance improvements regularly

### Testing Strategy
- Write tests that work on both runtimes
- Include performance benchmarks for critical paths
- Test Docker integration thoroughly
- Verify error handling consistency

### Logging Guidelines

Aisanity uses a four-tier logging system to separate user-facing information from system-level debugging. Follow these guidelines when adding logging to commands:

#### Logger Tiers

1. **`logger.info()`** - Normal command output
   - Standard command results
   - Success messages
   - Default status information
   - **Example:** `Container started successfully`

2. **`logger.verbose()`** - User-facing details (requires `--verbose`)
   - What's happening (user perspective)
   - Orphaned container information
   - Warning explanations
   - Worktree resolution details
   - **Example:** `Orphaned containers: old-feature (exited) - Worktree directory not found`

3. **`logger.debug()`** - System internals (requires `--debug`)
   - How it's working (developer perspective)
   - Discovery process steps
   - Performance metrics and timing
   - Validation process details
   - **Example:** `[Discovery] Found 3 labeled containers in 45ms`

4. **`logger.error()` and `logger.warn()`** - Always visible
   - Critical errors and non-fatal issues
   - Always shown regardless of flags
   - **Example:** `Error: Container not found`

#### Message Classification Guidelines

**Use `logger.verbose()` for:**
```typescript
// User-relevant information
logger.verbose('Worktree: main');
logger.verbose('Container: my-project-main (running)');
logger.verbose('⚠️  Warning: 1 orphaned containers detected');
logger.verbose(`Orphaned containers:
  - old-feature (exited)
    Workspace: /path/to/old-feature
    Reason: Worktree directory not found`);
```

**Use `logger.debug()` for:**
```typescript
// System internals
logger.debug('[Discovery] Found 3 labeled containers');
logger.debug('[Discovery] Completed in 45ms');
logger.debug('[Validation] Validated 3 worktrees (2 valid, 1 invalid)');
logger.debug('[Performance] Container discovery: 57ms');
```

#### Creating Loggers in Commands

```typescript
import { createLogger } from '../utils/logger';

export const myCommand = new Command('my-command')
  .description('Do something')
  .option('-v, --verbose', 'Show detailed user information')
  .option('-d, --debug', 'Show system debugging information')
  .action(async (options) => {
    // Create logger with both flags
    const logger = createLogger({
      silent: false,
      verbose: options.verbose || false,
      debug: options.debug || false
    });
    
    // Use logger throughout command
    logger.info('Starting operation...');
    logger.verbose('Processing 5 items...');
    logger.debug('[Timer] Operation started at ' + Date.now());
  });
```

#### Flag Descriptions

When adding flags to commands, use descriptive text:

```typescript
// ✅ Good - Describes what information you'll see
.option('-v, --verbose', 'Show detailed container status and orphaned container information')
.option('-d, --debug', 'Show system debugging information (discovery process, timing)')

// ❌ Bad - Generic and not helpful
.option('-v, --verbose', 'Enable verbose logging')
.option('-d, --debug', 'Enable debug mode')
```

#### Testing Logging Behavior

```typescript
import { Logger } from '../src/utils/logger';

test('should separate verbose and debug output', () => {
  let output: string[] = [];
  const originalLog = console.log;
  console.log = (...args: any[]) => output.push(args.join(' '));
  
  try {
    // Verbose-only logger
    const logger = new Logger(false, true, false);
    logger.verbose('User info');
    logger.debug('System internal');
    
    expect(output).toContain('User info');
    expect(output).not.toContain('System internal');
  } finally {
    console.log = originalLog;
  }
});
```

#### Common Patterns

**Container Discovery:**
```typescript
// Verbose: Show user what was found
logger.verbose('Found 3 containers for workspace');
logger.verbose('⚠️  Warning: 1 orphaned container detected');

// Debug: Show discovery process
logger.debug('[Discovery] Starting label-based discovery');
logger.debug('[Discovery] Found 3 labeled containers');
logger.debug('[Discovery] Completed in 45ms');
```

**Worktree Operations:**
```typescript
// Verbose: Show user progress
logger.verbose('Creating worktree for branch: feature-auth');
logger.verbose('Copied .aisanity config to worktree');

// Debug: Show git operations
logger.debug('[Git] Executing: git worktree add');
logger.debug('[Git] Operation completed in 120ms');
logger.debug('[Validation] Branch exists: true');
```

**Error Scenarios:**
```typescript
// Always visible
logger.error('Failed to create container: Docker daemon not running');
logger.warn('Container may be orphaned - worktree not found');

// Verbose: Explain to user
logger.verbose('Container old-feature appears orphaned');
logger.verbose('  Reason: Worktree directory not found');

// Debug: Show investigation
logger.debug('[Validation] Checking worktree path: /path/to/worktree');
logger.debug('[Validation] Path exists: false');
logger.debug('[Validation] Marking container as orphaned');
```

## Runtime-Specific Features

### Bun Enhancements
- **Native TypeScript**: No transpilation required
- **Enhanced Spawn**: Better performance and error handling
- **Shell Helper**: Built-in shell command execution
- **Single Binary**: Compile to standalone executable

### Node.js Compatibility
- **Fallback Support**: All features work on Node.js
- **API Compatibility**: Identical function signatures
- **Error Consistency**: Same error types and messages
- **Performance Baseline**: Maintains original performance

## Troubleshooting

### Common Development Issues

#### Bun Installation
```bash
# If Bun commands fail, try:
bun pm cache rm
bun install
```

#### TypeScript Errors
```bash
# Check TypeScript configuration:
bun run build

# Verify types are installed:
bun add -d @types/bun
```

#### Test Failures
```bash
# Run specific test file:
bun test tests/docker-integration.test.ts

# Debug with verbose output:
bun test --verbose
```

### Performance Debugging

#### Measure Startup Time
```bash
# Compare runtimes:
time bun src/index.ts --help
time node dist/index.js --help
```

#### Profile Test Execution
```bash
# Bun profiling:
bun test --profile

# Jest comparison:
time npm test
```

## Contributing

### Pull Request Process
1. Fork the repository
2. Create feature branch
3. Test on both Bun and Node.js
4. Update documentation
5. Submit PR with dual runtime test results

### Code Review Checklist
- [ ] Tests pass on both runtimes
- [ ] No performance regressions
- [ ] Documentation updated
- [ ] Error handling consistent
- [ ] TypeScript strict compliance

## Release Process

### Pre-release Testing
- Dual runtime compatibility verification
- Performance benchmarking
- Integration testing with Docker
- Documentation validation

### Release Steps
1. Update version numbers
2. Build with both runtimes
3. Create release artifacts
4. Update documentation
5. Deploy to package registries

## Environment Variable Processing

### Core Utilities (src/utils/env-utils.ts)

The environment variable processing pipeline is implemented in `src/utils/env-utils.ts` with the following key components:

#### Pattern Matching
```typescript
// Convert wildcard patterns to regex for efficient matching
export function matchEnvPattern(pattern: string, varName: string): boolean

// Validate pattern syntax and security
export function validateEnvPattern(pattern: string): boolean
```

#### Environment Collection
```typescript
// Collect host environment variables based on whitelist
export function collectHostEnv(whitelist: string[]): Record<string, string>

// Parse CLI --env arguments with validation
export function parseCliEnvVars(cliEnvArgs: string[]): Record<string, string>
```

#### Merging and Precedence
```typescript
// Merge environment variables with precedence: CLI > config > host
export function mergeEnvVariables(
  cliEnv: Record<string, string>,
  hostEnv: Record<string, string>,
  configEnv: Record<string, string>,
  whitelist: string[]
): Record<string, string>
```

#### Devcontainer Integration
```typescript
// Generate --remote-env flags for devcontainer commands
export function generateDevcontainerEnvFlags(envVars: Record<string, string>): string[]
```

### Development Guidelines

#### Adding New Environment Variable Features

1. **Security First**: Always validate input and follow whitelist-only approach
2. **Pattern Caching**: Use `getCompiledPattern()` for performance with repeated patterns
3. **Error Handling**: Provide clear, actionable error messages for invalid inputs
4. **Precedence Respect**: Maintain CLI > host > config precedence order

#### Testing Environment Variable Features

```typescript
// Test pattern matching
import { matchEnvPattern, validateEnvPattern } from '../src/utils/env-utils';

test('wildcard pattern matching', () => {
  expect(matchEnvPattern('HTTP_*', 'HTTP_PROXY')).toBe(true);
  expect(matchEnvPattern('API_KEY?', 'API_KEY1')).toBe(true);
  expect(matchEnvPattern('NODE_ENV', 'NODE_ENV')).toBe(true);
});

// Test environment collection
test('host environment collection', () => {
  const whitelist = ['HTTP_*', 'NODE_ENV'];
  const collected = collectHostEnv(whitelist);
  // Verify only whitelisted variables are collected
});
```

#### Performance Considerations

- **Pattern Caching**: Compiled regex patterns are cached (max 100 entries)
- **Efficient Filtering**: Use Set operations and early termination
- **Memory Management**: Limit cache size and clean up unused patterns
- **Target Performance**: <10ms for 100 variables with 20 patterns

#### Security Guidelines

- **Input Validation**: Always validate environment variable names and patterns
- **Blocked Variables**: System variables are automatically blocked
- **Pattern Restrictions**: Reject overly broad patterns like `*`
- **Value Safety**: Devcontainer CLI handles value escaping internally

#### Security Levels

The environment variable processing system supports three security levels that control the strictness of pattern validation and variable filtering:

##### Strict Mode (Default)
```typescript
// Maximum security - recommended for production
const strictConfig = {
  securityLevel: 'strict',
  blockedPatterns: ['*'],
  maxPatternBreadth: 10,
  requireExplicitWhitelist: true,
  blockSystemVars: true
};
```

**Characteristics:**
- Rejects overly broad patterns (`*`, `**`, `A*`)
- Maximum pattern breadth limit (10 variables per pattern)
- All system variables blocked
- Requires explicit whitelist for host variables
- CLI variables still bypass whitelist (explicit user intent)

**Use Cases:**
- Production environments
- CI/CD pipelines
- Security-sensitive applications
- Multi-user systems

##### Moderate Mode
```typescript
// Balanced security - recommended for development
const moderateConfig = {
  securityLevel: 'moderate',
  blockedPatterns: ['*', '**'],
  maxPatternBreadth: 50,
  requireExplicitWhitelist: true,
  blockSystemVars: true
};
```

**Characteristics:**
- Allows reasonable wildcard patterns (`API_*`, `HTTP_*`)
- Moderate pattern breadth limit (50 variables per pattern)
- System variables blocked
- Requires explicit whitelist for host variables
- CLI variables bypass whitelist

**Use Cases:**
- Development environments
- Staging environments
- Team collaboration
- Feature testing

##### Permissive Mode
```typescript
# Configure in .aisanity for permissive mode
workspace: my-project
securityLevel: permissive
envWhitelist:
  - "*_*"  # More permissive patterns allowed
```

**Characteristics:**
- Allows broader patterns with warnings
- Higher pattern breadth limit (100+ variables per pattern)
- Critical system variables still blocked
- Whitelist still required for host variables
- CLI variables bypass whitelist

**Use Cases:**
- Local development
- Debugging environments
- Legacy application migration
- Rapid prototyping

##### Security Level Configuration

**Via Configuration File:**
```yaml
# .aisanity
workspace: my-project
securityLevel: strict  # strict | moderate | permissive
envWhitelist:
  - "API_*"
  - "DATABASE_*"
```

**Via CLI Options:**
```bash
# Override security level temporarily
aisanity run --security-level=permissive --env DEBUG=* command

# Use with caution - only for trusted environments
aisanity run --security-level=strict --dry-run command
```

**Programmatic Configuration:**
```typescript
// In custom scripts or extensions
import { processEnvironmentVariables } from './src/utils/env-utils';

const envCollection = processEnvironmentVariables(config, cliEnvVars, {
  securityLevel: 'moderate',
  verbose: true
});
```

##### Security Level Behavior Comparison

| Feature | Strict | Moderate | Permissive |
|---------|--------|----------|------------|
| Pattern `*` | ❌ Blocked | ❌ Blocked | ⚠️ Warning |
| Pattern `*_*` | ❌ Blocked | ✅ Allowed | ✅ Allowed |
| Pattern `API_*` | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| Max Pattern Breadth | 10 vars | 50 vars | 100+ vars |
| System Variables | ❌ Blocked | ❌ Blocked | ❌ Blocked |
| CLI Override | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| Default Level | ✅ Yes | ❌ No | ❌ No |

##### Security Level Migration

**Upgrading to Strict Mode:**
```bash
# Test current configuration with strict mode
aisanity run --security-level=strict --dry-run

# Fix any pattern warnings
# Update .aisanity:
#   securityLevel: strict
#   envWhitelist: ["API_*", "DATABASE_*"]  # More specific patterns
```

**Downgrading for Development:**
```bash
# Temporary permissive mode for debugging
aisanity run --security-level=permissive --env DEBUG=* command

# Or set in development .aisanity
# securityLevel: moderate
```

##### Security Level Best Practices

1. **Use Strict Mode** for production and CI/CD
2. **Use Moderate Mode** for team development
3. **Use Permissive Mode** only for local debugging
4. **Always Test** configuration changes with `--dry-run`
5. **Monitor Pattern Breadth** to avoid accidental data exposure
6. **Document Security Level** in team guidelines

##### Security Level Validation

The system automatically validates security level configurations:

```typescript
// Invalid security level
aisanity run --security-level=invalid  # Error: Invalid security level

// Conflicting configuration
# .aisanity with both strict and broad patterns
securityLevel: strict
envWhitelist: ["*"]  # Warning: Pattern too broad for strict mode
```

### Integration Points

#### CLI Integration (src/commands/run.ts)
```typescript
// Parse --env options
.option('--env <key=value>', 'Set environment variable', 
        (value, previous) => [...(previous || []), value])

// Process environment variables
const envCollection = processEnvironmentVariables(config, cliEnvVars, options);

// Generate devcontainer flags
const remoteEnvFlags = generateDevcontainerEnvFlags(envCollection.merged);
```

#### Configuration Integration (src/utils/config.ts)
```typescript
interface AisanityConfig {
  workspace: string;
  containerName?: string;
  env?: Record<string, string;           // Static environment variables
  envWhitelist?: string[];               // Whitelist patterns for host env
  worktree?: boolean;
}
```

## Additional Resources

- [Bun Documentation](https://bun.sh/docs)
- [Migration Guide](./MIGRATION.md)
- [API Reference](./README.md)
- [GitHub Issues](https://github.com/your-username/aisanity/issues)

## Workflow System Architecture

The aisanity workflow system provides a state machine-based approach to defining and executing multi-step development processes.

### Core Components

#### 1. WorkflowParser (`src/workflow/parser.ts`)
- Loads and parses `.aisanity-workflows.yml` files
- Validates workflow structure and state definitions
- Converts YAML into typed workflow objects
- Provides workflow discovery and listing

#### 2. StateMachine (FSM) (`src/workflow/fsm.ts`)
- Manages workflow state transitions
- Tracks execution history and context
- Validates state graph for cycles and reachability
- Provides dry-run simulation capabilities
- Performance target: <20ms initialization

#### 3. CommandExecutor (`src/workflow/executor.ts`)
- Executes state commands in subprocesses
- Manages stdin/stdout/stderr handling
- Enforces timeout limits
- Provides real-time output streaming

#### 4. ArgumentTemplater (`src/workflow/argument-templater.ts`)
- Substitutes template variables in commands and arguments
- Validates inputs for security (injection prevention)
- Resolves built-in variables (branch, workspace, timestamp)
- Supports CLI parameter mapping

#### 5. ConfirmationHandler (`src/workflow/confirmation-handler.ts`)
- Manages interactive confirmation prompts
- Handles timeout with default behaviors
- Integrates with TUI progress indicators
- Supports --yes flag for automation

#### 6. WorkflowErrorHandler (`src/workflow/error-handler.ts`)
- Centralizes error handling across components
- Provides context-rich error messages
- Maps errors to appropriate exit codes
- Manages resource cleanup

### Integration Architecture

```
CLI (state.ts)
    ↓
WorkflowParser → Load YAML
    ↓
StateMachine → Initialize FSM
    ↓
    ├─→ CommandExecutor → Execute commands
    ├─→ ArgumentTemplater → Substitute variables
    └─→ ConfirmationHandler → Handle prompts
    ↓
WorkflowErrorHandler → Handle errors
    ↓
Exit with appropriate code
```

### Performance Requirements

- **Complete system startup**: <500ms (YAML load + parse + FSM init)
- **FSM initialization**: <20ms per workflow
- **State transitions**: <1ms per transition
- **YAML parsing**: <100ms for complex workflows
- **Template substitution**: <1ms per variable

### Development Patterns

#### Adding New State Features

1. **Update Interfaces** (`src/workflow/interfaces.ts`)
   - Define new state configuration options
   - Update State interface

2. **Update Parser** (`src/workflow/parser.ts`)
   - Add validation for new options
   - Parse new configuration

3. **Update Executor** (`src/workflow/executor.ts`)
   - Implement new execution behavior
   - Add tests for new functionality

4. **Update Documentation**
   - Add to WORKFLOW_REFERENCE.md
   - Add examples to WORKFLOW_EXAMPLES.md

#### Testing Workflow Components

```typescript
// Unit test pattern
import { StateMachine } from '../../../src/workflow/fsm';
import { simpleWorkflow } from '../fixtures/test-workflows';

test('should transition states correctly', () => {
  const fsm = new StateMachine(simpleWorkflow, logger);
  fsm.transition(0); // success
  expect(fsm.getCurrentState()).toBe('expected-state');
});

// Integration test pattern
import { WorkflowParser } from '../../../src/workflow/parser';

test('should execute complete workflow', async () => {
  const parser = new WorkflowParser(logger);
  const workflow = parser.getWorkflow('test-workflow');
  const fsm = new StateMachine(workflow, logger, executor);
  const result = await fsm.execute();
  expect(result.success).toBe(true);
});
```

#### Error Handling Pattern

```typescript
import { WorkflowErrorHandler } from '../../../src/workflow/error-handler';
import { createExecutorContext } from '../../../src/workflow/error-context';

try {
  // Workflow operation
} catch (error) {
  if (error instanceof Error) {
    await errorHandler.enrichAndThrow(
      error,
      createExecutorContext('operationName', {
        additionalData: { /* context */ }
      })
    );
  }
  throw error;
}
```

### Security Considerations

#### Template Variable Validation

All template variables are validated to prevent command injection:

```typescript
// Blocked patterns
const dangerousPatterns = [
  /[;&|`$(){}[\]]/,  // Shell metacharacters
  /\/etc\//,          // System files
  /\brm\s+-rf\s+\//,  // Dangerous commands
];

// Validation before substitution
if (validator.checkForInjectionPatterns(value)) {
  throw new SecurityError('Invalid template value');
}
```

#### Command Execution Safety

- Commands execute with user's permissions (no privilege escalation)
- Timeout enforcement prevents hanging processes
- stdin/stdout/stderr properly managed
- Process cleanup on errors and timeouts

### Extending the Workflow System

#### Custom Variable Resolvers

```typescript
import { VariableResolver } from '../src/workflow/argument-templater';

const resolver = new VariableResolver(logger);
resolver.registerCustomResolver('custom_var', async () => {
  // Custom resolution logic
  return 'resolved-value';
});
```

#### Custom State Validators

```typescript
import { StateValidator } from '../src/workflow/state-validator';

class CustomValidator extends StateValidator {
  validateState(state: State): ValidationResult {
    // Custom validation logic
    return { isValid: true, errors: [] };
  }
}
```

#### Error Handler Extensions

```typescript
const errorHandler = new WorkflowErrorHandler(logger);

// Register cleanup handler
errorHandler.registerCleanupHandler(async () => {
  // Custom cleanup logic
});
```

### Troubleshooting Development Issues

#### Workflow Not Loading

Check parser logs with verbose mode:
```bash
aisanity state execute my-workflow --verbose
```

Common issues:
- YAML syntax errors
- Missing required fields
- Invalid state references

#### FSM Validation Failures

Enable debug logging:
```typescript
const logger = new Logger(false, true); // verbose mode
const fsm = new StateMachine(workflow, logger);
```

Common issues:
- Circular state references
- Unreachable states
- Invalid transition targets

#### Performance Issues

Run performance benchmarks:
```bash
bun test tests/workflow/performance/
```

Check for:
- Large workflow files (>50 states)
- Complex template substitutions
- Excessive timeout values

### Related Documentation

- [WORKFLOWS.md](./WORKFLOWS.md) - Getting started guide
- [WORKFLOW_EXAMPLES.md](./WORKFLOW_EXAMPLES.md) - Real-world examples
- [WORKFLOW_REFERENCE.md](./WORKFLOW_REFERENCE.md) - Complete reference
- [CLI_EXAMPLES.md](./CLI_EXAMPLES.md) - Command-line examples
