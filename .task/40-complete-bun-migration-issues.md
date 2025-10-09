# Task 40: Complete Bun Migration Issues

## Description
Based on user feedback about remaining test failures after the initial Bun migration and test mocking fixes, this task addresses the outstanding issues that prevent the Bun migration from being fully complete. While the core mocking strategy was fixed in Task 30, several critical issues remain that are part of the Bun migration scope.

## Problem Statement
After completing the test mocking fixes in Task 30, the test suite still has 15 failures that are directly related to the Bun migration. These include verbose flag handling issues in discover-opencode, runtime detection mocking problems due to Bun's global object behavior, missing test imports, command structure issues, and process exit mocking problems. These failures indicate incomplete migration work that needs to be addressed for the Bun migration to be truly complete.

## Requirements
1. Fix discover-opencode verbose flag implementation to properly handle and pass verbose parameter to safeDockerExec calls
2. Resolve runtime detection mocking issues caused by Bun's non-configurable globalThis.Bun property
3. Fix missing test imports (afterEach) in devcontainer-templates.test.ts
4. Fix worktree-list command registration structure to ensure list subcommand exists
5. Resolve process exit mocking issues in stats.test.ts that cause test failures
6. Ensure all remaining test failures are addressed to achieve full test suite passing
7. Verify that all CLI functionality works correctly with Bun runtime
8. Ensure cross-platform compatibility is maintained throughout the fixes

## Expected Outcome
1. All tests passing (0 failures) with Bun test runner
2. discover-opencode command properly handles verbose flag with correct logging and parameter passing
3. Runtime detection tests work correctly with Bun's global object constraints
4. All test files have proper imports and structure for Bun test framework
5. CLI command structure is complete and functional
6. Process exit mocking works correctly in test environment
7. Full Bun migration completion with no remaining migration-related issues
8. Documentation of any Bun-specific patterns or considerations for future development

## Additional Suggestions and Ideas
- Consider using alternative mocking strategies for runtime detection that work with Bun's constraints
- Implement comprehensive CLI testing to ensure all commands work correctly after migration
- Add Bun-specific test utilities that handle global object mocking safely
- Consider creating a migration completion checklist to verify all aspects are working
- Document any Bun-specific limitations or workarounds for future reference

## Other Important Agreements
- The core Bun migration functionality is working but test issues remain
- These failures are directly related to the Bun migration and must be addressed for completion
- The focus should be on fixing remaining migration issues, not adding new functionality
- Maintain compatibility with existing functionality while fixing Bun-specific issues
- All fixes should align with Bun's runtime characteristics and test framework requirements
- The migration is not complete until all tests pass with Bun runner