# Implementation Plan: Fix CLI Error Output

## Implementation Overview

This implementation plan focuses on fixing the CLI error output issue where validation errors are not being logged to stderr, causing integration tests to fail. The plan follows option 2 approach as specified by the user: always log workflow errors in catch block regardless of type.

### Key Objectives
- Ensure all CLI validation errors are logged to stderr
- Fix failing integration tests in `state-command-integration.test.ts`
- Maintain existing error handling patterns and exit codes
- Remove conditional check that prevents logging workflow errors

### Implementation Strategy
- **Phase 1**: Modify error handling in `src/commands/state.ts`
- **Phase 2**: Test with failing integration tests to verify fix
- **Phase 3**: Ensure backward compatibility and proper error formatting

## Component Details

### 1. Error Handling Fix

#### 1.1 Main Catch Block Modification
**Location**: `src/commands/state.ts` - `executeWorkflowAction()` function

**Current Issue**:
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

if (!isWorkflowError) {
  // Unexpected error - log it
  logger.error(`Unexpected error: ${error.message}`);
  logger.debug(`Stack trace: ${error.stack}`);
}
```

**Fix Required**:
```typescript
// Always log error message for all error types
logger.error(`Error: ${error.message}`);

// Only log stack trace for unexpected errors
const isWorkflowError = error instanceof WorkflowFileError || 
                       error instanceof WorkflowValidationError ||
                       error instanceof WorkflowExecutionError ||
                       error instanceof EnhancedWorkflowExecutionError ||
                       error instanceof StateTransitionError ||
                       error instanceof StateNotFoundError ||
                       error instanceof ConfirmationTimeoutError ||
                       error instanceof CommandExecutionError ||
                       error instanceof WorkflowParseError;

if (!isWorkflowError) {
  // Unexpected error - log stack trace
  logger.debug(`Stack trace: ${error.stack}`);
}
```

#### 1.2 Error Message Format
**Requirements**:
- All error messages should be prefixed with "Error:" for test compatibility
- Maintain existing error message content
- Ensure proper formatting for different error types

**Implementation Pattern**:
```typescript
// For all errors
logger.error(`Error: ${error.message}`);

// For workflow errors, this provides the "Error:" prefix expected by tests
// For non-workflow errors, this provides consistent error formatting
```

### 2. Test Validation

#### 2.1 Integration Test Verification
**Location**: `tests/state-command-integration.test.ts`

**Tests to Verify**:
- `should handle invalid workflow name` - expects "Error:" and "alphanumeric" in stderr
- `should validate template arguments` - expects "Error:" and "alphanumeric" in stderr  
- `should handle template argument validation` - expects "Error:" and "not found" in stderr

**Validation Approach**:
```bash
npm test tests/state-command-integration.test.ts
```

#### 2.2 Error Output Testing
**Manual Verification**:
```bash
# Test invalid workflow name
bun run dist/index.js state execute invalid@name 2>&1

# Should output: "Error: Workflow name must contain only alphanumeric characters, hyphens, and underscores"
```

### 3. Backward Compatibility

#### 3.1 Exit Code Preservation
**Requirements**:
- Maintain existing exit code logic via `errorHandler.getExitCode(error)`
- Ensure no changes to error classification
- Preserve existing error handling flow

#### 3.2 Error Handler Integration
**Requirements**:
- Maintain compatibility with existing `WorkflowErrorHandler`
- Ensure error handler continues to work for other error paths
- No breaking changes to error handling API

## Data Structures

### 1. Error Logging Flow
```typescript
// Current flow (broken):
validateInputs() -> throws EnhancedWorkflowExecutionError -> catch block -> skips logging -> exit(1)

// Fixed flow:
validateInputs() -> throws EnhancedWorkflowExecutionError -> catch block -> logs error -> exit(1)
```

### 2. Test Expectation Mapping
```typescript
// Test expectations:
expect(stderr).toContain('Error:');           // ✅ Will now pass
expect(stderr).toContain('alphanumeric');       // ✅ Will now pass  
expect(stderr).toContain('not found');         // ✅ Will now pass
```

## API Design

### 1. Error Logging API
```typescript
// Enhanced error logging in catch block
function logError(error: Error, logger: Logger): void {
  // Always log error message with "Error:" prefix
  logger.error(`Error: ${error.message}`);
  
  // Only log stack trace for unexpected errors
  if (!isWorkflowError(error)) {
    logger.debug(`Stack trace: ${error.stack}`);
  }
}
```

### 2. Error Classification API
```typescript
// Helper function for error type checking
function isWorkflowError(error: Error): boolean {
  return error instanceof WorkflowFileError || 
         error instanceof WorkflowValidationError ||
         error instanceof WorkflowExecutionError ||
         error instanceof EnhancedWorkflowExecutionError ||
         error instanceof StateTransitionError ||
         error instanceof StateNotFoundError ||
         error instanceof ConfirmationTimeoutError ||
         error instanceof CommandExecutionError ||
         error instanceof WorkflowParseError;
}
```

## Testing Strategy

### 1. Unit Testing
- Test error logging function directly
- Verify error message formatting
- Ensure exit codes are preserved

### 2. Integration Testing
- Run failing integration tests to verify fix
- Test all validation error scenarios
- Verify error output contains expected content

### 3. Manual Testing
- Test CLI commands with invalid inputs
- Verify error output format
- Ensure proper exit codes

## Development Phases

### Phase 1: Core Fix Implementation (Day 1)
- **Step 1**: Modify catch block in `executeWorkflowAction()`
- **Step 2**: Ensure all errors are logged with "Error:" prefix
- **Step 3**: Preserve stack trace logging for unexpected errors only

### Phase 2: Testing and Validation (Day 1)
- **Step 1**: Run integration tests to verify fix
- **Step 2**: Manual testing of CLI error scenarios
- **Step 3**: Verify error message content and formatting

### Phase 3: Quality Assurance (Day 1)
- **Step 1**: Ensure backward compatibility
- **Step 2**: Verify no regression in other error handling paths
- **Step 3**: Final integration test validation

### Critical Implementation Considerations

#### **IMPORTANT**: Error Message Format
- All error messages must be prefixed with "Error:" for test compatibility
- Maintain existing error message content exactly
- Ensure consistent formatting across all error types

#### **IMPORTANT**: Backward Compatibility
- Do not change exit code logic
- Maintain existing error handler integration
- Preserve all existing error handling patterns

#### **IMPORTANT**: Test Coverage
- Ensure all failing integration tests now pass
- Verify error output contains expected test assertions
- Test all validation error scenarios

### Success Criteria

1. **Error Output**: All CLI validation errors are logged to stderr with "Error:" prefix
2. **Test Success**: All integration tests in `state-command-integration.test.ts` pass
3. **Backward Compatibility**: No breaking changes to existing error handling
4. **User Experience**: Clear error messages for all validation failures
5. **Exit Codes**: Proper exit codes maintained for all error types

This implementation plan ensures that all CLI validation errors are properly logged to stderr, fixing the failing integration tests while maintaining backward compatibility and existing error handling patterns.