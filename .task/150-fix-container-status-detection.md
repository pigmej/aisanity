# Task 150: Fix Container Status Detection in Status Command

## Description
Based on user feedback about `aisanity status` showing broken output where running containers display as "Unknown" status and many existing containers are not detected. The user confirmed that containers are definitely running (e.g., main branch container) but status shows incorrect information, indicating ongoing issues with name vs label detection.

## Problem Statement
The `aisanity status` command provides incorrect container status information due to multiple issues:

1. **Bun command execution failure**: The `getContainerStatusWithPorts` function in `src/commands/status.ts:265` uses Bun's `$` template literal to execute Docker commands but fails silently, returning "Unknown" status for running containers

2. **Missing container detection**: There are actually 5 running containers for the workspace but status only shows 3 worktrees with "Unknown" or "Not created" status:
   - `dazzling_chandrasekhar` → `aisanity-main` (main branch) - shows "Unknown"
   - `priceless_goodall` → `aisanity-feature-100-fsm` (feature/100-fsm) - missing
   - `beautiful_poitras` → `aisanity-feature-100-4-20` (feature/100_4_20) - missing
   - `busy_bell` → `aisanity-feature-100-4-10` (feature/100_4_10) - missing

3. **Worktree discovery limitations**: The worktree system only finds 3 worktrees (main + 2) but there are many more containers with different branches that aren't being mapped properly

4. **Poor error handling**: Docker command failures are caught and masked as "Unknown" status instead of providing diagnostic information

## Requirements
1. Fix Docker command execution in `getContainerStatusWithPorts` function in `src/commands/status.ts:265`
2. Replace Bun `$` template literal with proper `execSync` or alternative that works reliably
3. Improve error handling to show actual Docker command errors instead of silent "Unknown" fallback
4. Enhance container discovery to find all containers with `aisanity.workspace` label for current workspace
5. Better mapping between containers and worktrees, including cases where worktrees might not exist in expected locations
6. Add verbose logging to show Docker command execution and results when `--verbose` flag is used
7. Fix container status parsing to correctly identify "Running", "Stopped", and "Not created" states
8. Ensure all running containers are displayed in the status table with correct status
9. Run existing test suite to ensure no regressions
10. Test the fix with the actual running containers to verify correct detection

## Expected Outcome
1. `aisanity status` shows all 5 running containers with correct "Running" status
2. Container names, branches, and status are accurately displayed in the table
3. Docker command errors are properly logged instead of being masked as "Unknown"
4. Verbose mode shows Docker command execution details for debugging
5. The summary shows correct counts (e.g., "5 running, 0 stopped" instead of "0 running, 0 stopped")
6. Container-to-worktree mapping works correctly even for complex branch names
7. The command handles edge cases gracefully (missing worktrees, orphaned containers, etc.)
8. Performance remains acceptable with the enhanced discovery logic

## Additional Suggestions and Ideas
- Consider using the existing `discoverContainers` function from `container-utils.ts` instead of direct Docker commands
- Think about adding a fallback mechanism that tries multiple discovery strategies if primary one fails
- Consider caching container status information to avoid repeated Docker calls in quick succession
- Think about whether we should show containers that exist but don't have corresponding worktrees
- Consider adding a "discovery mode" that shows all containers regardless of worktree mapping
- Think about whether we should add performance metrics for container discovery overhead
- Consider adding unit tests for the `getContainerStatusWithPorts` function with mock Docker output
- Think about whether we should handle containers with multiple labels or complex naming schemes

## Other Important Agreements
- The solution should maintain backward compatibility with existing status command behavior
- The fix should work with different Docker configurations and container states
- Follow existing code patterns for error handling, logging, and Docker command execution
- Ensure the fix doesn't break any existing functionality or test cases
- The performance impact should be minimal since status is a frequently used command
- The solution should handle edge cases gracefully without crashing the entire command
- Container discovery should be robust and work with various labeling schemes and naming conventions
- The fix should provide clear diagnostic information when Docker commands fail