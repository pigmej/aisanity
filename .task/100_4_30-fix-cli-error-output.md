# Task: Fix CLI Error Output

**Task ID:** 100_4_30
**Parent Feature:** 100 - See `./.feature/100-workflow-state-machine.md`
**Feature Architecture:** `./.feature/arch_100_workflow-state-machine.md`
**Created:** 2025-01-24
**Priority:** high
**Implementation Phase:** 4

## Problem Statement
CLI validation errors are not being logged to stderr, causing integration tests to fail. The `state execute` command exits with code 1 but produces no error output when validation fails.

## Description
During testing documentation implementation, we discovered that validation errors thrown from `validateInputs()` function are not being logged to stderr. The error handling flow assumes that workflow errors are already logged by `WorkflowErrorHandler`, but validation errors are thrown directly without going through the error handler. This creates a gap where `EnhancedWorkflowExecutionError` instances are never logged to stderr.

This task is part of a larger feature. Please review the feature architecture before implementation.

## Requirements
- Ensure all CLI validation errors are logged to stderr
- Fix failing integration tests in `state-command-integration.test.ts`
- Maintain existing error handling patterns and exit codes
- Follow option 2 approach: always log workflow errors in catch block regardless of type
- Remove the `if (!isWorkflowError)` condition that prevents logging workflow errors
- Ensure error messages contain expected content for test assertions

## Expected Outcome
All CLI validation errors are properly logged to stderr, integration tests pass, and users receive clear error messages when validation fails.

## Dependencies
testing-documentation

## Integration Requirements
This task fixes the error output gap that was discovered during testing documentation implementation.

**Prior Tasks This Builds Upon:**
100_4_10 - error-handling-logging
100_4_20 - testing-documentation

**Expected Integrations:**
- Fixes CLI error output for validation failures
- Ensures integration tests can capture error output properly
- Maintains consistency with existing error handling patterns

**Integration Points:**
- Modify error handling in `src/commands/state.ts`
- Ensure compatibility with existing `WorkflowErrorHandler`
- Maintain proper exit codes for different error types

## Architectural Notes
Follow existing error handling patterns, ensure all errors are logged to stderr, maintain backward compatibility

**IMPORTANT:** This task must align with the feature architecture at `./.feature/arch_100_workflow-state-machine.md`

## Implementation Guidance
When implementing this task:
1. Review the parent feature architecture first
2. Focus on option 2 approach as specified by user: always log workflow errors in catch block
3. Remove the conditional check that prevents logging workflow errors
4. Ensure all error messages are properly formatted and contain expected content
5. Test with the failing integration tests to verify the fix
6. Follow the technology stack and patterns defined in the feature architecture

## Other Important Agreements
User specifically requested to focus on option 2: "Always log all workflow errors in catch block regardless of type (remove the `if (!isWorkflowError)` condition)". This approach ensures that all errors, including `EnhancedWorkflowExecutionError` instances from validation, are properly logged to stderr before the program exits.