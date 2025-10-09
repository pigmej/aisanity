# Task 30: Fix Test Mocking Issues After Bun Migration

## Description
Based on user feedback about failing tests after the Bun migration, this task focuses on fixing the test mocking strategy to align with the new runtime architecture. The core functionality works correctly, but unit tests are failing because they mock old Node.js modules instead of the new Bun runtime utilities.

## Problem Statement
After completing the Bun migration, many tests are failing because the mocking strategy is misaligned. Tests mock `spawn` from `child_process` and other Node.js modules, but the actual implementation now uses `safeSpawn`, `safeExecSync`, and other utilities from `runtime-utils.ts`. This creates a disconnect between what tests mock and what the code actually calls, resulting in test failures despite the core functionality working correctly.

## Requirements
1. Update all test files to mock the correct runtime utilities instead of old Node.js modules
2. Replace `child_process.spawn` mocks with `safeSpawn` mocks from `runtime-utils.ts`
3. Replace `child_process.execSync` mocks with `safeExecSync` mocks from `runtime-utils.ts`
4. Fix `worktree-check.test.ts` to properly test the worktree check subcommand registration
5. Update `devcontainer-name-compatibility.test.ts` to use correct mocking patterns
6. Ensure all tests can run successfully with Bun test runner
7. Maintain test coverage and functionality while fixing mocking issues
8. Verify that all unit tests properly isolate the code under test

## Expected Outcome
1. All unit tests passing with correct mocking strategy
2. Tests mock the actual functions being called (runtime-utils functions)
3. Proper isolation of code under test in all test files
4. Maintained test coverage while fixing mocking issues
5. Tests that work correctly in both Bun and Node.js runtime environments
6. Clear and maintainable test mocking patterns that align with the new architecture
7. Documentation of the correct mocking patterns for future test development

## Additional Suggestions and Ideas
- Consider creating test utilities that provide common mocking patterns for runtime-utils
- Implement helper functions for setting up and tearing down runtime mocks
- Add integration tests that verify the mocking strategy works correctly
- Consider using Bun's built-in mocking capabilities more effectively
- Create a test migration guide for developers working with the new runtime architecture

## Other Important Agreements
- The core Bun migration was successful and functionality works correctly
- The issue is specifically with test mocking strategy, not with the implementation
- Tests should mock the abstraction layer (runtime-utils) not the底层 implementation
- Maintain backward compatibility in tests where possible
- Focus on fixing existing failing tests rather than adding new test functionality
- Ensure the mocking strategy is sustainable for future development