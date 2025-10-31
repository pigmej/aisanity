# Implementation Plan: Separate Verbose Debug Logging

## Implementation Overview

This plan implements a two-tier logging separation to address the noisy output issue introduced in Task 170. The implementation separates user-facing verbose information (`--verbose`) from system-level debugging information (`--debug`) while maintaining full backward compatibility.

**Core Philosophy**: User experience over technical purity. The `--verbose` flag should enhance user understanding, while `--debug` should provide developer troubleshooting capabilities.

**Architectural Approach**: 
- Extend existing `Logger` class with debug mode support
- Update `ContainerDiscoveryOptions` interface with debug parameter
- Refactor all commands to support both flags consistently
- Move discovery process logging from verbose to debug tier
- Maintain backward compatibility for existing scripts

## Component Details

### 1. Logger Enhancement (`src/utils/logger.ts`)

The existing `Logger` class currently supports a two-tier system (silent → normal → verbose). We will extend it to support a four-tier system (silent → normal → verbose → debug).

**Current Structure:**
```typescript
export class Logger {
  constructor(
    private silent: boolean = false,
    private verbose: boolean = false
  ) {}
  
  info(message: string): void { /* normal output */ }
  error(message: string): void { /* errors */ }
  debug(message: string): void { /* currently tied to verbose */ }
  warn(message: string): void { /* warnings */ }
}
```

**Enhanced Structure:**
```typescript
export class Logger {
  constructor(
    private silent: boolean = false,
    private verbose: boolean = false,
    private debug: boolean = false  // NEW: separate debug mode
  ) {}
  
  /**
   * Normal informational output - suppressed in silent mode
   * Use for: standard command output, success messages
   */
  info(message: string): void {
    if (!this.silent) {
      console.log(message);
    }
  }
  
  /**
   * User-facing verbose details - requires --verbose flag
   * Use for: detailed status info, worktree listings, orphaned container details
   */
  verbose(message: string): void {
    if (this.verbose && !this.silent) {
      console.log(message);
    }
  }
  
  /**
   * System-level debug information - requires --debug flag
   * Use for: discovery process, timing info, validation metadata
   */
  debug(message: string): void {
    if (this.debug && !this.silent) {
      console.log(message);
    }
  }
  
  /**
   * Error messages - always visible (uses stderr)
   * Use for: failures, critical issues
   */
  error(message: string): void {
    console.error(message);
  }
  
  /**
   * Warning messages - always visible (uses stderr)
   * Use for: non-fatal issues, deprecation notices
   */
  warn(message: string): void {
    console.error(message);
  }
}
```

**Key Design Decisions:**
- Rename existing `debug()` method to `verbose()` for clarity
- Add new `debug()` method for system internals
- Both flags can be used together for maximum information
- Silent mode suppresses both verbose and debug output
- Errors and warnings always visible regardless of flags

**Output Channels:**
- `info()`, `verbose()`, `debug()` → stdout (for clean output piping)
- `error()`, `warn()` → stderr (for error handling)

### 2. Container Discovery Options (`src/utils/container-utils.ts`)

**Current Interface:**
```typescript
export interface ContainerDiscoveryOptions {
  mode: "global" | "workspace" | "worktree";
  includeOrphaned: boolean;
  validationMode: "strict" | "permissive";
  verbose?: boolean;
  workspace?: string;
  worktree?: string;
  cachedWorktrees?: WorktreeList;
}
```

**Enhanced Interface:**
```typescript
export interface ContainerDiscoveryOptions {
  mode: "global" | "workspace" | "worktree";
  includeOrphaned: boolean;
  validationMode: "strict" | "permissive";
  verbose?: boolean;  // User-facing details
  debug?: boolean;    // NEW: System internals
  workspace?: string;
  worktree?: string;
  cachedWorktrees?: WorktreeList;
}
```

**Usage Pattern:**
```typescript
// User wants detailed status information
await discoverAllAisanityContainers({
  mode: 'global',
  includeOrphaned: true,
  validationMode: 'permissive',
  verbose: true,   // Show user details
  debug: false     // Hide system internals
});

// Developer troubleshooting discovery issues
await discoverAllAisanityContainers({
  mode: 'global',
  includeOrphaned: true,
  validationMode: 'permissive',
  verbose: false,  // Hide user details
  debug: true      // Show system internals
});

// Maximum information for complex debugging
await discoverAllAisanityContainers({
  mode: 'global',
  includeOrphaned: true,
  validationMode: 'permissive',
  verbose: true,   // Show user details
  debug: true      // Show system internals
});
```

### 3. Discovery System Refactoring

**Current Logging Behavior (Task 170):**
All discovery information controlled by single `verbose` flag:
```typescript
if (options.verbose) {
  console.log(`[Discovery] Found ${labeledContainers.length} labeled containers`);
  console.log(`[Discovery] Found ${newContainers.length} additional devcontainer containers`);
  console.log(`[Discovery] Completed in ${duration}ms`);
  console.log(`[Discovery] Total: ${containers.length}, Labeled: ${labeled.length}`);
}
```

**Refactored Logging Behavior:**
Separation of user-facing and system-level information:
```typescript
// User-facing verbose information
if (options.verbose) {
  console.log(`\nOrphaned containers:`);
  discoveryResult.orphaned.forEach(container => {
    const validation = discoveryResult.validationResults.get(container.id);
    console.log(`  - ${container.name} (${container.status})`);
    console.log(`    Workspace: ${validation?.workspacePath || 'unknown'}`);
    console.log(`    Reason: ${validation?.error || 'Worktree directory not found'}`);
  });
}

// System-level debug information
if (options.debug) {
  console.log(`[Discovery] Found ${labeledContainers.length} labeled containers`);
  console.log(`[Discovery] Found ${newContainers.length} additional devcontainer containers`);
  console.log(`[Discovery] Completed in ${duration}ms`);
  console.log(`[Discovery] Total: ${containers.length}, Labeled: ${labeled.length}, Unlabeled: ${unlabeled.length}, Orphaned: ${orphaned.length}`);
  console.log(`[Validation] Validated ${validationResults.size} worktrees`);
}
```

**Logging Classification Guidelines:**

**User-Facing (Verbose):**
- Orphaned container details with workspace paths
- Warning messages about container state
- Worktree resolution information
- Summary counts (running/stopped)
- Port mapping information

**System Internals (Debug):**
- Discovery process steps
- Timing and performance metrics
- Validation method details
- Strategy fallback information
- Cache hit/miss information
- Container filtering decisions

### 4. Command Framework Updates

All commands need to support both `--verbose` and `--debug` flags consistently.

**Standard Command Pattern:**
```typescript
export const commandName = new Command('name')
  .description('Command description')
  .option('-v, --verbose', 'Show detailed user information')
  .option('-d, --debug', 'Show system debugging information')
  .action(async (options) => {
    // Create logger with both flags
    const logger = new Logger(
      false,                    // silent mode off
      options.verbose || false, // verbose flag
      options.debug || false    // debug flag
    );
    
    // Command implementation with logger
    await executeCommand(logger, options);
  });
```

**Commands Requiring Updates:**
1. `status` - Most affected by noisy output
2. `stop` - Uses discovery for `--all-worktrees`
3. `discover-opencode` - Discovery-focused command
4. `cleanup` - Uses container discovery
5. `rebuild` - May use discovery for validation
6. `worktree-list` - May show verbose worktree details
7. `worktree-check` - Validation information
8. `stats` - Performance metrics

## Data Structures

### Logger State Management

```typescript
interface LoggerState {
  silent: boolean;   // Suppress all non-error output
  verbose: boolean;  // Show user-facing details
  debug: boolean;    // Show system internals
}

// Output decision matrix
const shouldOutput = {
  info:    (state: LoggerState) => !state.silent,
  verbose: (state: LoggerState) => !state.silent && state.verbose,
  debug:   (state: LoggerState) => !state.silent && state.debug,
  error:   (state: LoggerState) => true,  // Always visible
  warn:    (state: LoggerState) => true   // Always visible
};
```

### Message Classification

```typescript
type MessageType = 
  | 'user-info'       // Normal output for --verbose
  | 'system-debug'    // System internals for --debug
  | 'error'           // Always visible errors
  | 'warning';        // Always visible warnings

interface LogMessage {
  type: MessageType;
  content: string;
  timestamp?: Date;
  context?: string;   // e.g., '[Discovery]', '[Validation]'
}
```

### Discovery Logging Context

```typescript
interface DiscoveryLoggingContext {
  userMessages: string[];      // For verbose output
  debugMessages: string[];     // For debug output
  timingInfo: Map<string, number>;  // Performance metrics
  validationDetails: Map<string, WorktreeValidationResult>;
}
```

## API Design

### Logger Factory Pattern

Centralized logger creation ensures consistency across all commands:

```typescript
// src/utils/logger.ts

/**
 * Create a logger instance from command options
 * Ensures consistent logger configuration across all commands
 */
export function createLogger(options: {
  silent?: boolean;
  verbose?: boolean;
  debug?: boolean;
}): Logger {
  return new Logger(
    options.silent || false,
    options.verbose || false,
    options.debug || false
  );
}

/**
 * Create logger from Commander options object
 * Convenience wrapper for command action handlers
 */
export function createLoggerFromCommandOptions(commandOptions: any): Logger {
  return createLogger({
    silent: commandOptions.silent || false,
    verbose: commandOptions.verbose || false,
    debug: commandOptions.debug || false
  });
}
```

### Discovery Function Signatures

**Updated Function Signatures:**

```typescript
// Primary discovery function
export async function discoverAllAisanityContainers(
  options: ContainerDiscoveryOptions
): Promise<EnhancedContainerDiscoveryResult>;

// Helper discovery functions
async function discoverContainersPhase(
  containers: DockerContainer[],
  labeled: DockerContainer[],
  unlabeled: DockerContainer[],
  options: ContainerDiscoveryOptions  // Now includes debug flag
): Promise<void>;

async function validateContainerWorktreesPhase(
  containers: DockerContainer[],
  validationResults: Map<string, WorktreeValidationResult>,
  options: ContainerDiscoveryOptions  // Now includes debug flag
): Promise<void>;

// Logging helpers
function logDiscoveryResults(
  containers: DockerContainer[],
  labeled: DockerContainer[],
  unlabeled: DockerContainer[],
  orphaned: DockerContainer[],
  duration: number,
  verbose?: boolean,  // User-facing details
  debug?: boolean     // System internals
): void;
```

### Command Helper Functions

```typescript
// src/utils/logger-helpers.ts (new file)

/**
 * Format user-facing orphaned container information
 */
export function formatOrphanedContainerInfo(
  containers: DockerContainer[],
  validationResults: Map<string, WorktreeValidationResult>
): string {
  // Returns formatted string for verbose output
}

/**
 * Format debug-level discovery statistics
 */
export function formatDiscoveryDebugInfo(
  metadata: DiscoveryMetadata,
  duration: number
): string {
  // Returns formatted string for debug output
}

/**
 * Format validation summary for debug output
 */
export function formatValidationDebugInfo(
  validationResults: Map<string, WorktreeValidationResult>
): string {
  // Returns formatted string for debug output
}
```

## Testing Strategy

### Unit Tests

**Logger Behavior Tests (`tests/logger.test.ts`):**

```typescript
describe('Logger with debug mode', () => {
  test('info() respects silent mode', () => {
    const logger = new Logger(true, false, false);
    // Assert info output is suppressed
  });
  
  test('verbose() only outputs when --verbose flag set', () => {
    const logger = new Logger(false, true, false);
    // Assert verbose output appears
  });
  
  test('debug() only outputs when --debug flag set', () => {
    const logger = new Logger(false, false, true);
    // Assert debug output appears
  });
  
  test('verbose() and debug() work together', () => {
    const logger = new Logger(false, true, true);
    // Assert both types of output appear
  });
  
  test('silent mode suppresses verbose and debug', () => {
    const logger = new Logger(true, true, true);
    // Assert all output suppressed except errors
  });
  
  test('error() always outputs regardless of flags', () => {
    const logger = new Logger(true, false, false);
    // Assert error output appears
  });
});
```

**Discovery Logging Tests (`tests/container-discovery-logging.test.ts`):**

```typescript
describe('Container discovery logging separation', () => {
  test('verbose mode shows user-facing information only', async () => {
    const result = await discoverAllAisanityContainers({
      mode: 'global',
      includeOrphaned: true,
      validationMode: 'permissive',
      verbose: true,
      debug: false
    });
    
    // Capture console output
    // Assert orphaned container details appear
    // Assert discovery process details DO NOT appear
  });
  
  test('debug mode shows system internals only', async () => {
    const result = await discoverAllAisanityContainers({
      mode: 'global',
      includeOrphaned: true,
      validationMode: 'permissive',
      verbose: false,
      debug: true
    });
    
    // Capture console output
    // Assert discovery process details appear
    // Assert orphaned container details DO NOT appear
  });
  
  test('both flags show all information', async () => {
    const result = await discoverAllAisanityContainers({
      mode: 'global',
      includeOrphaned: true,
      validationMode: 'permissive',
      verbose: true,
      debug: true
    });
    
    // Capture console output
    // Assert both types of output appear
  });
});
```

### Integration Tests

**Command Flag Tests (`tests/command-flags-integration.test.ts`):**

```typescript
describe('Command flag behavior', () => {
  test('status --verbose shows user details without debug noise', async () => {
    // Execute: aisanity status --verbose
    // Assert: orphaned container info appears
    // Assert: discovery timing does NOT appear
  });
  
  test('status --debug shows system internals without user noise', async () => {
    // Execute: aisanity status --debug
    // Assert: discovery timing appears
    // Assert: orphaned container details do NOT appear
  });
  
  test('status --verbose --debug shows both', async () => {
    // Execute: aisanity status --verbose --debug
    // Assert: both types of output appear
  });
  
  test('stop --all-worktrees respects debug flag', async () => {
    // Execute: aisanity stop --all-worktrees --debug
    // Assert: discovery process logging appears
  });
});
```

### Backward Compatibility Tests

**Regression Tests (`tests/verbose-backward-compatibility.test.ts`):**

```typescript
describe('Backward compatibility', () => {
  test('existing --verbose scripts continue to work', async () => {
    // Execute: aisanity status --verbose
    // Assert: output format matches Task 170 user-facing info
    // Assert: NO discovery process noise (key improvement)
  });
  
  test('scripts without flags produce same output', async () => {
    // Execute: aisanity status
    // Assert: output unchanged from previous versions
  });
  
  test('discovery function verbose parameter still works', async () => {
    // Call: discoverAllAisanityContainers({ verbose: true })
    // Assert: user-facing verbose info appears
    // Assert: backward compatible with existing code
  });
});
```

### Output Validation Tests

**Message Classification Tests (`tests/message-classification.test.ts`):**

```typescript
describe('Message classification', () => {
  test('user-facing messages in verbose output', () => {
    const messages = [
      'Orphaned containers:',
      '⚠️  Warning: 1 orphaned containers detected',
      'Worktree: main',
      'Container: my-project-main (running)'
    ];
    
    messages.forEach(msg => {
      // Assert: should use verbose() method
    });
  });
  
  test('system messages in debug output', () => {
    const messages = [
      '[Discovery] Found 3 labeled containers',
      '[Discovery] Completed in 45ms',
      '[Validation] Validated 3 worktrees',
      '[Performance] Container discovery completed'
    ];
    
    messages.forEach(msg => {
      // Assert: should use debug() method
    });
  });
});
```

## Development Phases

### Phase 1: Core Infrastructure (Foundation)

**Objective:** Establish logging infrastructure without breaking existing functionality

**Tasks:**
1. **Update Logger class** (`src/utils/logger.ts`)
   - Add `debug` parameter to constructor
   - Rename existing `debug()` method to `verbose()`
   - Add new `debug()` method for system internals
   - Update JSDoc comments with usage guidelines
   - **Acceptance:** All existing tests pass without modification

2. **Add logger factory functions** (`src/utils/logger.ts`)
   - Implement `createLogger()` helper
   - Implement `createLoggerFromCommandOptions()` helper
   - Add TypeScript types for options
   - **Acceptance:** Factory functions create loggers correctly

3. **Update ContainerDiscoveryOptions interface** (`src/utils/container-utils.ts`)
   - Add optional `debug?: boolean` field
   - Update JSDoc documentation
   - No breaking changes to existing code
   - **Acceptance:** Interface compiles without errors

4. **Write core unit tests**
   - Logger behavior with all flag combinations
   - Factory function correctness
   - Interface type checking
   - **Acceptance:** 100% test coverage for logger class

**Deliverables:**
- Enhanced `Logger` class with debug support
- Factory functions for consistent logger creation
- Updated `ContainerDiscoveryOptions` interface
- Comprehensive unit tests
- Zero breaking changes to existing code

**Estimated Effort:** 2-3 hours

---

### Phase 2: Discovery System Refactoring (Message Classification)

**Objective:** Separate discovery logging into verbose (user) and debug (system) tiers

**Tasks:**
1. **Audit existing logging calls** (`src/utils/container-utils.ts`)
   - Identify all `console.log()` calls in discovery functions
   - Classify each message as user-facing or system-level
   - Document classification decisions
   - **Acceptance:** Complete audit with classification spreadsheet

2. **Refactor discovery logging**
   - Update `discoverContainersPhase()` to use debug flag
   - Update `validateContainerWorktreesPhase()` to use debug flag
   - Update `logDiscoveryResults()` with separate verbose/debug logic
   - Update helper functions (deduplicateContainers, handleDiscoveryError)
   - **Acceptance:** Discovery functions accept and respect debug flag

3. **Update discovery function signatures**
   - Pass both `verbose` and `debug` through call chain
   - Update all internal discovery helpers
   - Maintain backward compatibility for `verbose` parameter
   - **Acceptance:** Type checking passes, no breaking changes

4. **Create logging helper utilities** (new file: `src/utils/logger-helpers.ts`)
   - `formatOrphanedContainerInfo()` for verbose output
   - `formatDiscoveryDebugInfo()` for debug output
   - `formatValidationDebugInfo()` for debug output
   - **Acceptance:** Helper functions produce correctly formatted output

5. **Write discovery logging tests**
   - Test verbose-only output (user info, no debug)
   - Test debug-only output (system info, no user details)
   - Test combined output (both verbose and debug)
   - Test no flags (minimal output)
   - **Acceptance:** All discovery logging scenarios covered

**Logging Classification Reference:**

| Current Message | Classification | New Method | Reasoning |
|----------------|----------------|------------|-----------|
| `[Discovery] Found N labeled containers` | System | `debug()` | Internal process step |
| `[Discovery] Found N additional devcontainer containers` | System | `debug()` | Internal process step |
| `[Discovery] Completed in Xms` | System | `debug()` | Performance metric |
| `[Discovery] Total: X, Labeled: Y, Unlabeled: Z, Orphaned: W` | System | `debug()` | Summary statistics |
| `[Validation] Validated N worktrees` | System | `debug()` | Internal process step |
| `Orphaned containers:` | User | `verbose()` | User-relevant information |
| `- container-name (status)` | User | `verbose()` | User-relevant information |
| `Workspace: /path/to/workspace` | User | `verbose()` | User-relevant information |
| `Reason: Worktree directory not found` | User | `verbose()` | User-relevant information |
| `⚠️  Warning: N orphaned containers detected` | User | `info()` | Always relevant warning |

**Deliverables:**
- Refactored discovery system with message separation
- Logging helper utilities
- Discovery logging tests
- Classification documentation
- Backward compatible verbose parameter

**Estimated Effort:** 4-5 hours

---

### Phase 3: Command Updates (Consistent Application)

**Objective:** Apply verbose/debug separation consistently across all commands

**Tasks:**
1. **Update status command** (`src/commands/status.ts`)
   - Add `--debug` flag to command definition
   - Update `displayUnifiedWorktreeStatus()` to pass debug flag
   - Update `displaySingleWorktreeStatus()` to pass debug flag
   - Refactor verbose logging to use correct tier
   - **Acceptance:** Status command respects both flags independently

2. **Update stop command** (`src/commands/stop.ts`)
   - Add `--debug` flag to command definition
   - Update `stopAllWorktreeContainers()` to pass debug flag
   - Refactor discovery logging
   - **Acceptance:** Stop command respects both flags

3. **Update discover-opencode command** (`src/commands/discover-opencode.ts`)
   - Add `--debug` flag to command definition
   - Update discovery calls with debug parameter
   - Separate user info from system internals
   - **Acceptance:** Discovery command output correctly separated

4. **Update cleanup command** (`src/commands/cleanup.ts`)
   - Add `--debug` flag to command definition
   - Update container discovery with debug parameter
   - **Acceptance:** Cleanup command respects both flags

5. **Update worktree commands** (worktree-list, worktree-check)
   - Add `--debug` flags where applicable
   - Update verbose logging to use correct tier
   - **Acceptance:** Worktree commands respect both flags

6. **Update help documentation**
   - Update flag descriptions across all commands
   - Add examples to command help text
   - Document flag combinations
   - **Acceptance:** Help text clearly explains verbose vs debug

7. **Write command integration tests**
   - Test each command with verbose-only
   - Test each command with debug-only
   - Test each command with both flags
   - Test backward compatibility (existing scripts)
   - **Acceptance:** All commands behave consistently

**Help Text Template:**
```
Options:
  -v, --verbose    Show detailed user information (container status, orphaned containers)
  -d, --debug      Show system debugging information (discovery process, timing)
  
Examples:
  $ aisanity status --verbose           # User-friendly detailed output
  $ aisanity status --debug             # Developer troubleshooting output
  $ aisanity status --verbose --debug   # Maximum information
```

**Deliverables:**
- Updated commands with consistent flag support
- Enhanced help documentation
- Command integration tests
- Usage examples
- Backward compatibility validation

**Estimated Effort:** 6-8 hours

---

### Phase 4: Testing & Documentation (Quality Assurance)

**Objective:** Comprehensive testing and documentation for production readiness

**Tasks:**
1. **Write comprehensive test suite**
   - Unit tests for logger (✓ from Phase 1)
   - Unit tests for discovery logging (✓ from Phase 2)
   - Integration tests for commands (✓ from Phase 3)
   - Regression tests for backward compatibility
   - Output validation tests
   - **Acceptance:** >90% code coverage, all tests pass

2. **Backward compatibility validation**
   - Test existing scripts without modification
   - Verify verbose parameter still works in code
   - Ensure no breaking API changes
   - Test with various Docker environments
   - **Acceptance:** Zero breaking changes confirmed

3. **Performance validation**
   - Measure overhead of logging checks
   - Verify minimal impact when flags not used
   - Compare performance to Task 170 baseline
   - **Acceptance:** <5% performance difference

4. **Documentation updates**
   - Update README with flag usage examples
   - Add troubleshooting guide (when to use debug)
   - Document message classification guidelines
   - Add migration guide for developers
   - **Acceptance:** Complete documentation coverage

5. **User acceptance testing**
   - Test with real-world scenarios
   - Validate output clarity and usefulness
   - Gather feedback on verbosity levels
   - Ensure intuitive flag usage
   - **Acceptance:** Positive user feedback

6. **Create usage examples**
   - Common use cases for verbose flag
   - Common use cases for debug flag
   - Troubleshooting scenarios
   - CI/CD integration examples
   - **Acceptance:** Examples work as documented

**Documentation Sections to Update:**

**README.md additions:**
```markdown
### Verbose and Debug Output

Aisanity supports two levels of detailed output:

- `--verbose` - Shows detailed user-facing information:
  - Orphaned container details
  - Worktree status information
  - Warning explanations
  
- `--debug` - Shows system-level debugging information:
  - Container discovery process
  - Performance timing metrics
  - Validation details

You can use both flags together for maximum information.

**Examples:**
```bash
# Clean detailed output for users
aisanity status --verbose

# Troubleshooting discovery issues
aisanity status --debug

# Maximum information for complex debugging
aisanity status --verbose --debug
```

**DEVELOPMENT.md additions:**
```markdown
### Logging Guidelines

When adding logging to commands, follow these classification rules:

**Use `logger.info()`:**
- Standard command output
- Success messages
- Normal status information

**Use `logger.verbose()`:**
- User-relevant details (what's happening)
- Orphaned container information
- Warning explanations
- Worktree resolution details

**Use `logger.debug()`:**
- System internals (how it's working)
- Discovery process steps
- Performance metrics
- Validation process details
- Timing information

**Use `logger.error()` and `logger.warn()`:**
- Always visible regardless of flags
- Critical errors and non-fatal issues
```

**Deliverables:**
- Comprehensive test suite with >90% coverage
- Backward compatibility validation report
- Performance benchmark results
- Updated documentation (README, DEVELOPMENT)
- Usage examples and troubleshooting guide
- Migration guide for developers

**Estimated Effort:** 4-5 hours

---

### Phase 5: Rollout & Validation (Production Deployment)

**Objective:** Deploy changes and validate in real-world usage

**Tasks:**
1. **Pre-deployment checklist**
   - All tests passing
   - Documentation complete
   - Performance validated
   - Backward compatibility confirmed
   - **Acceptance:** Checklist 100% complete

2. **Staged rollout**
   - Deploy to test environments
   - Validate with existing automation scripts
   - Test with CI/CD pipelines
   - Gather initial feedback
   - **Acceptance:** No issues in test environments

3. **Monitor usage patterns**
   - Track flag usage frequency
   - Identify common use cases
   - Collect user feedback
   - Monitor for issues
   - **Acceptance:** Positive adoption metrics

4. **Address feedback**
   - Fix any reported issues
   - Adjust output formatting if needed
   - Update documentation based on feedback
   - **Acceptance:** All critical feedback addressed

5. **Production deployment**
   - Tag release version
   - Update changelog
   - Announce new feature
   - Provide migration guidance
   - **Acceptance:** Successful production deployment

**Rollout Checklist:**
- [ ] All tests passing (unit, integration, regression)
- [ ] Documentation complete (README, DEVELOPMENT, help text)
- [ ] Performance validated (<5% overhead)
- [ ] Backward compatibility confirmed (existing scripts work)
- [ ] Code review complete
- [ ] Security review complete
- [ ] Test environment validation successful
- [ ] CI/CD pipeline tests passing
- [ ] User acceptance testing complete
- [ ] Migration guide published
- [ ] Changelog updated
- [ ] Release notes prepared

**Deliverables:**
- Production-ready code
- Release notes and changelog
- Migration guide
- User feedback collection mechanism
- Monitoring dashboard
- Post-deployment validation report

**Estimated Effort:** 2-3 hours

---

## Total Implementation Effort

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1: Core Infrastructure | 2-3 hours | None |
| Phase 2: Discovery System Refactoring | 4-5 hours | Phase 1 |
| Phase 3: Command Updates | 6-8 hours | Phase 2 |
| Phase 4: Testing & Documentation | 4-5 hours | Phase 3 |
| Phase 5: Rollout & Validation | 2-3 hours | Phase 4 |
| **Total** | **18-24 hours** | Sequential |

## Success Metrics

### User Experience Metrics
- ✓ Clean verbose output without discovery noise
- ✓ Accessible debug information for troubleshooting
- ✓ Intuitive flag usage following CLI conventions
- ✓ Positive user feedback on output clarity

### Developer Experience Metrics
- ✓ Easy access to system internals for debugging
- ✓ Consistent logging patterns across codebase
- ✓ Clear separation of concerns
- ✓ Comprehensive documentation and examples

### System Quality Metrics
- ✓ Maintained 100% backward compatibility
- ✓ Zero breaking API changes
- ✓ >90% test coverage
- ✓ <5% performance overhead
- ✓ Improved code organization and maintainability

### Adoption Metrics
- ✓ Existing scripts work without modification
- ✓ New users understand flag purposes
- ✓ Debug flag used for troubleshooting
- ✓ Verbose flag used for detailed status

## Risk Mitigation

### Technical Risks

**Risk:** Breaking existing scripts that depend on verbose output
- **Mitigation:** Comprehensive backward compatibility testing
- **Detection:** Regression test suite
- **Recovery:** Quick rollback capability

**Risk:** Performance degradation from additional logging checks
- **Mitigation:** Efficient conditional checking, benchmark testing
- **Detection:** Performance test suite
- **Recovery:** Optimize logging conditions

**Risk:** Inconsistent message classification across commands
- **Mitigation:** Clear classification guidelines, code review
- **Detection:** Output validation tests
- **Recovery:** Refactor inconsistent commands

### User Experience Risks

**Risk:** Confusion about when to use verbose vs debug
- **Mitigation:** Clear help documentation, usage examples
- **Detection:** User feedback, support requests
- **Recovery:** Improve documentation, add examples

**Risk:** Important information hidden behind flags
- **Mitigation:** Careful classification, warning messages always visible
- **Detection:** User feedback, usability testing
- **Recovery:** Reclassify messages to appropriate tier

### Dependency Risks

**Risk:** Changes to Logger class break existing code
- **Mitigation:** Maintain backward compatible signatures
- **Detection:** Comprehensive test suite
- **Recovery:** Maintain old method signatures as deprecated

## Future Enhancements

### Structured Logging (v2.0)
- JSON output format for machine consumption
- Structured log fields (timestamp, level, context, message)
- Log aggregation and filtering capabilities

### Additional Log Levels (v2.1)
- `--quiet` flag to suppress all non-error output
- `--trace` flag for extremely detailed debugging
- Configurable log level via config file

### Log Output Formatting (v2.2)
- Color coding for different message types
- Configurable output format (plain, colored, JSON)
- Log file output with rotation

### Performance Optimization (v2.3)
- Lazy evaluation for expensive log messages
- Conditional string interpolation
- Log message caching

## Appendix: Message Classification Examples

### User-Facing (Verbose) Examples

```bash
$ aisanity status --verbose

┌──────────────┬──────────┬────────────────┬──────────┬────────┬───────┐
│ Workspace    │ Branch   │ Container      │ Worktree │ Status │ Ports │
├──────────────┼──────────┼────────────────┼──────────┼────────┼───────┤
│ → my-project │ main     │ my-project-... │ ✅ main  │ Running│ 3000  │
│   my-project │ feature  │ my-project-... │ ✅ feat  │ Stopped│ -     │
└──────────────┴──────────┴────────────────┴──────────┴────────┴───────┘

Workspace: my-project
Current: main
Total: 2 containers (1 running, 1 stopped)
Worktrees: 2 with worktree, 0 without worktree

⚠️  Warning: 1 orphaned containers detected

Orphaned containers:
  - old-feature-abc123 (exited)
    Workspace: /Users/dev/old-feature
    Reason: Worktree directory not found
```

### System-Level (Debug) Examples

```bash
$ aisanity status --debug

[Discovery] Starting container discovery in global mode
[Discovery] Strategy 1: Label-based discovery
[Discovery] Found 3 labeled containers
[Discovery] Strategy 2: Devcontainer metadata discovery
[Discovery] Found 0 additional devcontainer containers
[Discovery] Container discovery completed in 45ms
[Discovery] Total: 3, Labeled: 3, Unlabeled: 0

[Validation] Starting worktree validation (permissive mode)
[Validation] Validating 3 container worktrees
[Validation] Valid: 2, Invalid: 1, Missing: 1
[Validation] Validation completed in 12ms

[Discovery] Orphaned identification
[Discovery] Orphaned: 1 (validation mode: permissive)

[Discovery] Discovery summary:
[Discovery] - Total discovered: 3
[Discovery] - Labeled containers: 3
[Discovery] - Unlabeled containers: 0
[Discovery] - Orphaned containers: 1
[Discovery] - Total duration: 57ms
```

### Combined Output (Both Flags)

Shows both user-facing information and system internals for comprehensive debugging.

