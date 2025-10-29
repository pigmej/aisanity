# Architectural Analysis: Separate Verbose Debug Logging

## Context Analysis

### Current State
The current implementation mixes user-facing verbose information with system-level debug information under a single `--verbose` flag, creating a noisy user experience. After Task 170's container discovery implementation, `aisanity status --verbose` now outputs both user-relevant information (container status, orphaned containers) and system internals (discovery process details, validation metadata).

### Problem Identification
1. **Mixed Concerns**: User-relevant information is intermixed with system internals
2. **Poor User Experience**: Users cannot get clean verbose output without debug noise
3. **Inconsistent Expectations**: Different verbosity levels serve different user needs
4. **Developer Experience**: Debug information is not easily accessible for troubleshooting

### User Personas
- **End Users**: Want detailed status information without system internals
- **Developers**: Need access to system internals for troubleshooting
- **CI/CD Systems**: Require clean, predictable output for automation

## Technology Recommendations

### Logging Architecture Pattern
**IMPORTANT**: Adopt a tiered logging architecture with clear separation of concerns:

```
Silent Mode (default) → Normal Output → Verbose (user details) → Debug (system internals)
```

### Flag Design
Following CLI guidelines and industry standards:

- `--verbose` / `-v`: User-facing detailed information
- `--debug` / `-d`: System-level debugging information  
- `--quiet` / `-q`: Suppress non-error output (future enhancement)

### Logger Enhancement
Extend the existing `Logger` class to support debug mode:

```typescript
export class Logger {
  constructor(
    private silent: boolean = false,
    private verbose: boolean = false,
    private debug: boolean = false
  ) {}

  info(message: string): void { /* normal output */ }
  warn(message: string): void { /* warnings */ }
  error(message: string): void { /* errors */ }
  verbose(message: string): void { /* user details */ }
  debug(message: string): void { /* system internals */ }
}
```

## System Architecture

### Core Components

#### 1. Command Interface Layer
- Add `--debug` flag to all commands
- Update help documentation to clarify flag purposes
- Maintain backward compatibility for existing `--verbose` behavior

#### 2. Logger Enhancement
- Extend `Logger` class with debug mode support
- Implement proper output channel separation (stdout/stderr)
- Add contextual logging prefixes for different message types

#### 3. Discovery System Refactoring
- Update `ContainerDiscoveryOptions` interface with `debug` parameter
- Move discovery process logging from verbose to debug
- Maintain user-facing information in verbose mode

#### 4. Output Formatting
- Separate user information from system internals
- Implement consistent message formatting across commands
- Add visual distinction between verbose and debug output

### Data Flow Architecture

```
Command Execution
    ↓
Logger Configuration (silent/verbose/debug)
    ↓
Business Logic
    ↓
┌─────────────────┬─────────────────┐
│   User Output   │   Debug Output  │
│   (verbose)     │   (debug)      │
└─────────────────┴─────────────────┘
    ↓                    ↓
stdout               stderr
```

## Integration Patterns

### 1. Backward Compatibility Pattern
**IMPORTANT**: Preserve existing `--verbose` behavior for user-facing information:

```typescript
// Before: Mixed verbose output
if (options.verbose) {
  console.log('[Discovery] Found 3 containers');  // System info
  console.log('Workspace: my-project');           // User info
}

// After: Separated concerns
if (options.verbose) {
  console.log('Workspace: my-project');           // User info only
}
if (options.debug) {
  console.log('[Discovery] Found 3 containers');  // System info only
}
```

### 2. Interface Evolution Pattern
Extend interfaces without breaking existing usage:

```typescript
// Container Discovery Options
export interface ContainerDiscoveryOptions {
  mode: "global" | "workspace" | "worktree";
  includeOrphaned: boolean;
  validationMode: "strict" | "permissive";
  verbose?: boolean;        // Existing - user-facing
  debug?: boolean;         // NEW - system internals
  workspace?: string;
  worktree?: string;
  cachedWorktrees?: WorktreeList;
}
```

### 3. Consistent Command Pattern
Apply uniform flag handling across all commands:

```typescript
// Standard command setup
export const commandName = new Command('command')
  .description('Command description')
  .option('-v, --verbose', 'Show detailed user information')
  .option('-d, --debug', 'Show system debugging information')
  .action(async (options) => {
    const logger = new Logger(false, options.verbose, options.debug);
    // Command implementation
  });
```

### 4. Progressive Enhancement Pattern
Allow combined usage for maximum information:

```bash
# User information only
aisanity status --verbose

# System internals only  
aisanity status --debug

# Both user and system information
aisanity status --verbose --debug

# Clean automation output
aisanity status
```

## Implementation Guidance

### Phase 1: Core Infrastructure
1. **Logger Enhancement**: Extend `Logger` class with debug support
2. **Interface Updates**: Add `debug` parameter to `ContainerDiscoveryOptions`
3. **Command Framework**: Update all commands with `--debug` flag

### Phase 2: Discovery System Refactoring
1. **Logging Migration**: Move discovery process logs from verbose to debug
2. **Message Classification**: Categorize all log messages by user relevance
3. **Output Separation**: Ensure proper stdout/stderr channel usage

### Phase 3: User Experience Optimization
1. **Help Documentation**: Update help text for all commands
2. **Message Formatting**: Implement consistent visual distinction
3. **Testing Coverage**: Add tests for all verbosity combinations

### Critical Implementation Decisions

#### Logger Instantiation Pattern
**IMPORTANT**: Centralize logger creation to ensure consistency:

```typescript
// In each command file
function createLogger(options: CommandOptions): Logger {
  return new Logger(
    options.quiet || false,
    options.verbose || false, 
    options.debug || false
  );
}
```

#### Message Classification Guidelines
- **User Information**: Container status, workspace info, warnings
- **System Internals**: Discovery process, validation details, timing info
- **Error Information**: Always visible regardless of verbosity

#### Backward Compatibility Strategy
- Maintain existing `--verbose` behavior for user information
- Add `--debug` as additive functionality
- Ensure existing scripts continue to work unchanged

### Testing Strategy
1. **Unit Tests**: Test logger behavior with different flag combinations
2. **Integration Tests**: Verify command output matches expected patterns
3. **Regression Tests**: Ensure backward compatibility is maintained
4. **User Experience Tests**: Validate output clarity and usefulness

### Performance Considerations
- Minimal overhead when neither flag is used
- Efficient conditional logging to avoid string concatenation overhead
- Preserve existing performance characteristics

### Future Extensibility
- Architecture supports additional log levels (trace, etc.)
- Framework allows for structured logging (JSON format)
- Design enables log filtering and routing capabilities

## Success Metrics

### User Experience
- Clean verbose output without system noise
- Accessible debug information for troubleshooting
- Intuitive flag usage following CLI conventions

### Developer Experience  
- Easy access to system internals
- Consistent logging patterns across codebase
- Clear separation of concerns

### System Quality
- Maintained backward compatibility
- Improved code organization and maintainability
- Enhanced testing coverage for logging scenarios

This architectural analysis provides a comprehensive framework for implementing verbose/debug logging separation while maintaining backward compatibility and improving overall user experience.