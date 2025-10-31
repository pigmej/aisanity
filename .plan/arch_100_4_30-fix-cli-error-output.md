# Architecture Plan: Fix CLI Error Output

## Architecture Overview

This architecture plan addresses the CLI error output issue where validation errors are not being logged to stderr, causing integration tests to fail. The solution follows option 2 approach: always log workflow errors in catch block regardless of type.

### Key Architectural Decisions
- **Error Logging Strategy**: Always log all errors to stderr with "Error:" prefix
- **Backward Compatibility**: Maintain existing error handling patterns and exit codes
- **Test Compatibility**: Ensure error output matches integration test expectations
- **Minimal Changes**: Focus on specific fix without disrupting existing architecture

## Component Architecture

### 1. Error Handling Flow

#### 1.1 Current Architecture (Problematic)
```
validateInputs() 
    ↓
throws EnhancedWorkflowExecutionError
    ↓
catch block in executeWorkflowAction()
    ↓
if (!isWorkflowError) {  // ❌ Skips logging for workflow errors
    logger.error(`Unexpected error: ${error.message}`);
}
    ↓
process.exit(exitCode)  // ❌ Silent exit with no stderr output
```

#### 1.2 Target Architecture (Fixed)
```
validateInputs()
    ↓
throws EnhancedWorkflowExecutionError
    ↓
catch block in executeWorkflowAction()
    ↓
logger.error(`Error: ${error.message}`);  // ✅ Always log error message
if (!isWorkflowError) {
    logger.debug(`Stack trace: ${error.stack}`);  // ✅ Only debug for unexpected errors
}
    ↓
process.exit(exitCode)  // ✅ Exit with proper stderr output
```

### 2. Error Classification System

#### 2.1 Workflow Error Types
```typescript
const isWorkflowError = error instanceof WorkflowFileError || 
                       error instanceof WorkflowValidationError ||
                       error instanceof WorkflowExecutionError ||
                       error instanceof EnhancedWorkflowExecutionError ||
                       error instanceof StateTransitionError ||
                       error instanceof StateNotFoundError ||
                       error instanceof ConfirmationTimeoutError ||
                       error instanceof CommandExecutionError ||
                       error instanceof WorkflowParseError;
```

#### 2.2 Error Logging Strategy
- **All Errors**: Log error message with "Error:" prefix to stderr
- **Workflow Errors**: Only log message (no stack trace in production)
- **Non-Workflow Errors**: Log message + stack trace for debugging

### 3. Integration Test Compatibility

#### 3.1 Test Expectations
```typescript
// Current failing tests expect:
expect(stderr).toContain('Error:');           // ✅ Will be satisfied
expect(stderr).toContain('alphanumeric');       // ✅ Will be satisfied  
expect(stderr).toContain('not found');         // ✅ Will be satisfied
```

#### 3.2 Error Message Format
- **Prefix**: All errors prefixed with "Error:" for test compatibility
- **Content**: Preserve existing error message content exactly
- **Output**: Use `logger.error()` which writes to stderr via `console.error()`

## Data Flow Architecture

### 1. Error Processing Pipeline
```
Input Validation
    ↓
EnhancedWorkflowExecutionError (thrown)
    ↓
Catch Block (executeWorkflowAction)
    ↓
Error Classification (isWorkflowError check)
    ↓
Error Logging (always log message)
    ↓
Conditional Stack Trace (only for non-workflow errors)
    ↓
Exit Code Assignment (errorHandler.getExitCode)
    ↓
Process Exit (with proper stderr output)
```

### 2. Logger Integration
```typescript
// Logger.error() -> console.error() -> stderr
// Logger.debug() -> console.log() -> stdout (when verbose)
// Logger.info() -> console.log() -> stdout (when not silent)
```

## Implementation Architecture

### 1. Core Modification Points

#### 1.1 Primary Change Location
**File**: `src/commands/state.ts`
**Function**: `executeWorkflowAction()`
**Lines**: ~14450-14460 (in compiled code)

#### 1.2 Modification Strategy
```typescript
// BEFORE (problematic):
if (!isWorkflowError) {
  logger.error(`Unexpected error: ${error.message}`);
  logger.debug(`Stack trace: ${error.stack}`);
}

// AFTER (fixed):
logger.error(`Error: ${error.message}`);  // Always log
if (!isWorkflowError) {
  logger.debug(`Stack trace: ${error.stack}`);  // Only debug unexpected errors
}
```

### 2. Error Message Architecture

#### 2.1 Message Format Standard
- **Prefix**: "Error:" for all error types
- **Content**: Original error message preserved
- **Consistency**: Same format across all error scenarios

#### 2.2 Test Compatibility Matrix
| Error Type | Current Output | Target Output | Test Status |
|-------------|---------------|---------------|-------------|
| Invalid workflow name | (none) | "Error: Workflow name must contain only alphanumeric..." | ✅ Fixed |
| Invalid template args | (none) | "Error: Invalid template argument format..." | ✅ Fixed |
| Workflow not found | "Workflow file error: Workflow file not found" | "Error: Workflow file not found" | ✅ Compatible |

## Quality Assurance Architecture

### 1. Testing Strategy

#### 1.1 Unit Test Coverage
- Error logging function behavior
- Error message format validation
- Exit code preservation

#### 1.2 Integration Test Coverage
- All failing `state-command-integration.test.ts` tests
- CLI error output capture
- Error message content validation

#### 1.3 Manual Test Coverage
- Invalid workflow name scenarios
- Template argument validation
- Various error type combinations

### 2. Backward Compatibility

#### 2.1 Preservation Requirements
- **Exit Codes**: Maintain existing `errorHandler.getExitCode()` logic
- **Error Types**: No changes to error classification
- **Logger Integration**: Preserve existing `WorkflowErrorHandler` usage
- **API Compatibility**: No breaking changes to public interfaces

#### 2.2 Migration Strategy
- **Incremental**: Single file change with minimal impact
- **Reversible**: Easy rollback if issues arise
- **Testable**: Immediate verification possible

## Performance Considerations

### 1. Error Handling Performance
- **Overhead**: Minimal (one additional `logger.error()` call)
- **Path**: No impact on success path performance
- **Memory**: No additional memory allocation

### 2. Logging Performance
- **I/O**: Same stderr output mechanism as existing errors
- **Formatting**: Simple string concatenation
- **Buffering**: No additional buffering requirements

## Security Considerations

### 1. Error Information Disclosure
- **Content**: No additional sensitive information exposed
- **Format**: Consistent with existing error patterns
- **Sanitization**: Existing error message sanitization preserved

### 2. Error Injection Prevention
- **Validation**: Existing input validation unchanged
- **Logging**: No new injection vectors introduced
- **Output**: Same stderr channel as existing errors

## Integration Architecture

### 1. Component Dependencies

#### 1.1 Upstream Dependencies
- **Logger**: Uses existing `Logger.error()` method
- **Error Classes**: Uses existing error type hierarchy
- **Exit Codes**: Uses existing `WorkflowErrorHandler.getExitCode()`

#### 1.2 Downstream Dependencies
- **Integration Tests**: Will capture stderr output properly
- **CLI Users**: Will see clear error messages
- **Error Monitoring**: Will receive consistent error format

### 2. System Integration Points

#### 2.1 Error Handler Integration
```typescript
// Existing pattern maintained:
const errorHandler = new WorkflowErrorHandler(logger);
const exitCode = errorHandler.getExitCode(error);
process.exit(exitCode);
```

#### 2.2 Logger Integration
```typescript
// Existing pattern enhanced:
logger.error(`Error: ${error.message}`);  // New: always log
logger.debug(`Stack trace: ${error.stack}`);  // Existing: conditional debug
```

## Deployment Architecture

### 1. Rollout Strategy
- **Single Change**: Modify only `src/commands/state.ts`
- **Immediate Effect**: Fix available after next compilation
- **Test Validation**: Integration tests will verify fix immediately

### 2. Monitoring Requirements
- **Test Results**: Integration test pass rate improvement
- **Error Output**: Stderr capture verification
- **User Feedback**: Error message clarity assessment

## Success Metrics

### 1. Primary Success Indicators
- **Integration Tests**: All `state-command-integration.test.ts` tests pass
- **Error Output**: All validation errors produce stderr output
- **Test Coverage**: No regression in existing test coverage

### 2. Secondary Success Indicators
- **User Experience**: Clear error messages for validation failures
- **Debugging**: Stack traces available for unexpected errors
- **Consistency**: Uniform error format across all scenarios

This architecture plan provides a comprehensive solution for fixing CLI error output while maintaining system stability and backward compatibility.