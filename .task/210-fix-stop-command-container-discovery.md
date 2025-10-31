# Task 210: Fix Stop Command Container Discovery

## Description
Based on user feedback that `aisanity stop` command is still using wrong container names (trying to stop `aisanity-cleanup` instead of using label-based discovery). The stop command should only stop containers for the current branch, not all containers in the workspace, and should use the modern label-based discovery system without any fallback to old naming patterns.

## Problem Statement

The `stop` command in `src/commands/stop.ts` is using outdated container name generation instead of the modern label-based discovery system:

1. **Wrong container name generation**: Line 47 uses `getContainerName()` which generates `aisanity-cleanup` instead of finding actual containers
2. **Missing branch filtering**: Command should only stop containers for the current branch, not all workspace containers  
3. **Legacy fallback logic**: Lines 59-94 contain old fallback logic for devcontainers and workspace name patterns
4. **Inconsistent with --all-worktrees**: The `--all-worktrees` option works correctly (uses discovery), but default behavior doesn't

Current failing behavior:
```
Error response from daemon: No such container: aisanity-cleanup
Container aisanity-cleanup not found or already stopped
```

## Requirements

1. **Replace container name generation**: Remove `getContainerName(cwd, options.verbose || false)` usage at line 47
2. **Use label-based discovery**: Implement `discoverAllAisanityContainers` with workspace mode to find containers
3. **Add branch filtering**: Filter discovered containers by current branch using `getCurrentBranch(cwd)`
4. **Stop only current branch containers**: Filter containers where `aisanity.workspace` matches cwd AND `aisanity.branch` matches current branch
5. **Remove all fallback logic**: Delete lines 59-94 (old devcontainer and workspace name pattern fallbacks)
6. **Clean error handling**: Show "No containers found for branch: {branch}" when appropriate
7. **Maintain existing options**: Preserve `--worktree` and `--all-worktrees` functionality

## Expected Outcome

1. **Correct container stopping**: Only containers for the current branch are stopped (e.g., `dazzling_chandrasekhar` for `main` branch)
2. **Label-based discovery**: Uses modern `aisanity.workspace` and `aisanity.branch` labels for container identification
3. **No legacy fallback**: Completely removes old naming pattern compatibility
4. **Consistent behavior**: Default stop behavior works like `--all-worktrees` but filtered by branch
5. **Clean error messages**: Clear feedback when no containers exist for the current branch

Expected behavior change:
| Scenario | Before | After |
|----------|--------|-------|
| Stop on main branch | Tries to stop `aisanity-cleanup` (fails) | Stops `dazzling_chandrasekhar` (success) |
| Stop on feature branch | Tries to stop `aisanity-feature` (fails) | Stops correct container for that branch |
| No containers for branch | Shows "not found or already stopped" | Shows "No containers found for branch: {branch}" |

## Additional Suggestions and Ideas

- Consider adding verbose output showing which containers were discovered and filtered
- Think about adding a `--force` option to stop containers even if they're not labeled correctly
- Consider adding branch validation to warn if the current branch has no containers
- Think about adding container status display before stopping (like `--all-worktrees` does)
- Consider implementing dry-run mode to show what would be stopped without actually stopping
- Think about adding better error messages for Docker daemon issues
- Consider adding timing information for container discovery and stopping operations

## Other Important Agreements

- **No fallback behavior**: User explicitly requested "no fallback for old" - completely remove legacy naming pattern support
- **Branch-specific stopping**: Only stop containers for the current branch, not the entire workspace
- **Use existing discovery system**: Leverage the already-implemented `discoverAllAisanityContainers` function
- **Maintain existing options**: Preserve `--worktree` and `--all-worktrees` functionality without changes
- **Clean error messages**: Provide clear, actionable feedback when containers are not found
- **Label-based only**: Use only the modern label system (`aisanity.workspace` and `aisanity.branch`) for container identification
- **Consistent with other commands**: Follow the same discovery patterns used by the `--all-worktrees` option