# Architectural Analysis: Task 90 - Add Silent Option to Run Command

## Context Analysis

This architectural analysis examines the implementation of a `--silent` option for the `opencode run` command to suppress aisanity's informational output while preserving complete tool output from containerized commands. The feature addresses user feedback requesting clean output for automated scripts and CI/CD scenarios.

### Current State Assessment
- **Existing Pattern**: Verbose option (`-v, --verbose`) already implemented across all commands
- **Output Management**: Console.log for informational messages, console.error for errors
- **Process Handling**: Bun.spawn with stdio inheritance for container processes
- **Target Command**: `run.ts` - most complex command with container lifecycle management

### User Experience Requirements
- **Clean Output**: Suppress aisanity messages when `--silent` flag is used
- **Tool Output Preservation**: 100% preservation of containerized command output
- **Error Visibility**: Critical errors must always be visible
- **Backward Compatibility**: Existing behavior unchanged without `--silent`

## Research Findings

### CLI Output Management Patterns

#### Industry Standard Approaches
1. **Verbosity Levels**: Silent → Normal → Verbose (3-tier hierarchy)
2. **Output Separation**: Application output vs. tool output
3. **Error Handling**: Errors bypass verbosity controls
4. **Process Stdio**: Inheritance vs. piping based on verbosity

#### Existing Aisanity Patterns
- **Verbose Implementation**: Boolean flag passed to utility functions
- **Conditional Logging**: `if (verbose) console.log(...)`
- **Error Handling**: `console.error` used consistently for errors
- **Process Management**: `stdio: options.verbose ? ['inherit', 'inherit', 'inherit'] : ['pipe', 'pipe', 'pipe']`

### Process Output Architecture

#### Bun.spawn Stdio Configuration
```typescript
// Current verbose pattern
stdio: options.verbose ? ['inherit', 'inherit', 'inherit'] : ['pipe', 'pipe', 'pipe']

// Silent mode requirements
// - Always inherit tool output (stdout/stderr from container)
// - Conditionally suppress aisanity's own console.log
// - Never suppress console.error (critical errors)
```

#### Container Process Chain
1. **devcontainer up**: Container startup and configuration
2. **devcontainer exec**: Command execution within container
3. **Output Flow**: Container → devcontainer CLI → aisanity → user terminal

### Output Classification Analysis

#### Aisanity Output Types
1. **Informational Messages**: Status updates, progress indicators
2. **Configuration Messages**: Container names, branch info, workspace details
3. **Error Messages**: Critical failures, validation errors
4. **Tool Output**: Container command stdout/stderr

#### Suppression Strategy
- **Silent Mode**: Suppress #1 and #2, preserve #3 and #4
- **Normal Mode**: Show all output types
- **Verbose Mode**: Enhanced debugging information

## Technology Recommendations

### **IMPORTANT: Output Separation Architecture**

The implementation must maintain strict separation between aisanity's application output and the containerized tool output. This requires:

1. **Conditional Logging Framework**: Centralized output management
2. **Process Stdio Strategy**: Proper inheritance for tool output
3. **Error Bypass Mechanism**: Errors always visible regardless of silent mode
4. **Backward Compatibility**: Zero impact on existing behavior

### Logging Architecture Pattern

#### Recommended Implementation
```typescript
// Centralized logging utility
class Logger {
  constructor(private silent: boolean = false) {}
  
  info(message: string): void {
    if (!this.silent) {
      console.log(message);
    }
  }
  
  error(message: string): void {
    // Errors always visible
    console.error(message);
  }
}
```

#### Process Management Strategy
```typescript
// Silent mode stdio configuration
const stdioConfig = ['inherit', 'inherit', 'inherit']; // Always inherit tool output
// Silent mode only affects aisanity's own console.log calls
```

## System Architecture

### Output Management Layer

#### **IMPORTANT: Three-Tier Verbosity Architecture**

```
Silent Mode (--silent):
├── Aisanity Info: SUPPRESSED
├── Aisanity Errors: VISIBLE
└── Tool Output: VISIBLE

Normal Mode (default):
├── Aisanity Info: VISIBLE
├── Aisanity Errors: VISIBLE
└── Tool Output: VISIBLE

Verbose Mode (--verbose):
├── Aisanity Info: VISIBLE
├── Aisanity Errors: VISIBLE
├── Tool Output: VISIBLE
└── Debug Info: VISIBLE
```

### Integration Patterns

#### Command Option Integration
- **Option Definition**: Add `--silent` flag to run command
- **Option Processing**: Create logger instance based on flags
- **Propagation**: Pass logger to utility functions as needed
- **Consistency**: Follow existing verbose option patterns

#### Process Execution Integration
- **Stdio Inheritance**: Always inherit container process output
- **Error Handling**: Maintain existing error propagation
- **Exit Codes**: Preserve exit code handling from container processes
- **Signal Handling**: Maintain existing signal forwarding

### Implementation Guidance

#### **IMPORTANT: Incremental Implementation Strategy**

1. **Phase 1**: Add `--silent` option and Logger class
2. **Phase 2**: Replace console.log calls in run.ts with logger.info
3. **Phase 3**: Update utility function calls to support silent mode
4. **Phase 4**: Add comprehensive testing for all scenarios
5. **Phase 5**: Documentation and user communication

#### Code Modification Strategy

##### Option Addition
```typescript
.option('--silent', 'Suppress aisanity output, show only tool output')
```

##### Logger Integration
```typescript
const logger = new Logger(options.silent || false);
```

##### Output Replacement Pattern
```typescript
// Before
console.log(`Starting container for workspace: ${workspaceName}`);

// After
logger.info(`Starting container for workspace: ${workspaceName}`);

// Errors remain unchanged
console.error('Failed to run container:', error);
```

#### Process Management Considerations

##### Bun.spawn Configuration
```typescript
// Tool output always inherited, regardless of silent mode
const child = Bun.spawn(['devcontainer', ...execArgs], {
  stdio: ['inherit', 'inherit', 'inherit'], // Never pipe tool output
  cwd
});
```

##### Container Lifecycle Management
- **Startup Messages**: Suppress in silent mode
- **Progress Indicators**: Suppress in silent mode
- **Error Messages**: Always visible
- **Container Output**: Always visible

## Security Considerations

### Output Security
- **Error Information**: Ensure error messages don't expose sensitive data
- **Container Output**: No filtering of container command output
- **Logging**: No sensitive information in aisanity logs
- **Process Isolation**: Maintain existing container security boundaries

### Process Security
- **Stdio Handling**: Secure inheritance of container streams
- **Signal Propagation**: Maintain secure signal handling
- **Exit Code Preservation**: Ensure accurate exit code reporting
- **Resource Cleanup**: Proper process cleanup in all modes

## Performance Impact Analysis

### Runtime Performance
- **Conditional Logging**: Minimal overhead from boolean checks
- **Process Management**: No impact on container process performance
- **Memory Usage**: Negligible increase from Logger instance
- **Startup Time**: No measurable impact on command initialization

### User Experience Impact
- **Clean Output**: Significant improvement for automated scenarios
- **Script Integration**: Better CI/CD pipeline integration
- **Debugging**: Enhanced debugging with verbose mode
- **Error Visibility**: Maintained error visibility in all modes

## Testing Strategy

### Functional Testing
1. **Silent Mode**: Verify aisanity output suppression
2. **Tool Output**: Confirm complete tool output preservation
3. **Error Handling**: Validate error visibility in silent mode
4. **Backward Compatibility**: Ensure unchanged behavior without --silent
5. **Interactive Commands**: Test with interactive shell sessions

### Integration Testing
1. **Container Lifecycle**: Test both up and exec processes
2. **Worktree Support**: Verify silent mode with worktree operations
3. **Error Scenarios**: Test error handling in silent mode
4. **Exit Codes**: Ensure proper exit code propagation
5. **Signal Handling**: Verify signal forwarding in all modes

### Edge Cases
1. **Mixed Output**: Commands with mixed stdout/stderr
2. **Long-running Processes**: Silent mode with long operations
3. **Container Failures**: Error handling when container fails to start
4. **Network Issues**: Silent mode with connectivity problems
5. **Resource Constraints**: Behavior under resource limitations

## Future Considerations

### Extensibility
- **Other Commands**: Potential to extend silent mode to other commands
- **Configuration**: Global silent mode configuration option
- **Output Filtering**: Advanced output filtering capabilities
- **Logging Levels**: More granular logging control

### Technology Evolution
- **CLI Standards**: Alignment with modern CLI verbosity patterns
- **Container Tools**: Evolution of devcontainer CLI output handling
- **Process Management**: Advances in Node.js/Bun process management
- **User Expectations**: Changing user expectations for CLI tools

### Architectural Flexibility
- **Logger Interface**: Extensible logging framework
- **Output Plugins**: Potential for output format plugins
- **Configuration System**: Integration with global configuration
- **Monitoring**: Potential for structured logging integration

## Conclusion

The implementation of a `--silent` option for the `opencode run` command represents a significant user experience improvement with minimal architectural complexity. The solution leverages existing patterns in the codebase while maintaining strict separation between application and tool output.

### Key Architectural Benefits
1. **Clean Output**: Eliminates aisanity noise for automated scenarios
2. **Tool Output Preservation**: 100% preservation of container command output
3. **Error Visibility**: Maintained error visibility across all modes
4. **Backward Compatibility**: Zero impact on existing user workflows
5. **Consistent Patterns**: Aligns with existing verbose option implementation

### Implementation Risk Assessment
- **Technical Risk**: LOW - Simple conditional logging implementation
- **Compatibility Risk**: LOW - No breaking changes to existing behavior
- **Performance Risk**: LOW - Minimal runtime overhead
- **Maintenance Risk**: LOW - Simple, maintainable code pattern

### **IMPORTANT: Architectural Decision**

The recommended approach implements a three-tier verbosity architecture (Silent → Normal → Verbose) with strict output separation. This provides maximum user flexibility while maintaining code simplicity and backward compatibility.

**Recommendation**: Proceed with the incremental implementation strategy, starting with Logger class introduction and systematic replacement of console.log calls in the run command. The architectural approach is sound, low-risk, and delivers significant user experience benefits.

---

**Architectural Decision Record**:
- **Decision**: Implement --silent option with conditional logging framework
- **Date**: Current analysis
- **Status**: Recommended for implementation
- **Review Date**: After user feedback and adoption metrics