# Task 170: Fix Container Discovery Inconsistency

## Description
Based on user feedback about inconsistency between `aisanity status` and `aisanity stop --all-worktrees` commands. The status command detects 12 orphaned containers, but stop --all-worktrees finds "No aisanity containers found" and shows "Skipping invalid worktree: feature (gitdir file missing)". This creates confusion for users trying to clean up orphaned containers.

## Problem Statement

There is a fundamental inconsistency in container discovery logic between two key commands:

1. **Different discovery strategies**: `status` command uses workspace-specific discovery with cached worktrees, while `stop --all-worktrees` uses global discovery with fresh worktree validation
2. **Worktree validation timing mismatch**: The `stop` command validates worktrees before container discovery, filtering out invalid worktrees that may have associated containers
3. **Orphaned container detection divergence**: Commands use different logic to identify orphaned containers, leading to different results

Current problematic behavior:
```
$ aisanity status
⚠️  Warning: 12 orphaned containers detected
These containers may be from manually deleted worktrees.
Consider running "aisanity stop --all-worktrees" to clean them up.

$ aisanity stop --all-worktrees
Discovering all aisanity-related containers...
Skipping invalid worktree: feature (gitdir file missing)
No aisanity containers found
All worktree containers stopped successfully
```

## Requirements

1. **Unify container discovery logic**: Both `status` and `stop --all-worktrees` commands must use the same underlying container discovery mechanism
2. **Consistent worktree validation**: Ensure worktree validation doesn't interfere with orphaned container detection
3. **Reliable orphaned detection**: Both commands should identify the same set of orphaned containers
4. **Maintain existing functionality**: Preserve all current command-line options and behaviors
5. **Improve error reporting**: Provide clear feedback about what containers are found and why some might be skipped

## Expected Outcome

1. **Consistent container discovery**: Both commands report the same number of orphaned containers
2. **Reliable cleanup workflow**: Users can trust that `stop --all-worktrees` will clean up containers identified as orphaned by `status`
3. **Clear diagnostic information**: Verbose mode provides helpful information about container discovery and worktree validation
4. **Robust orphaned detection**: Orphaned containers are identified regardless of worktree validation issues

Expected consistent behavior:
```
$ aisanity status
⚠️  Warning: 12 orphaned containers detected
These containers may be from manually deleted worktrees.
Consider running "aisanity stop --all-worktrees" to clean them up.

$ aisanity stop --all-worktrees
Discovering all aisanity-related containers...
Found 12 containers (12 labeled, 0 unlabeled)
Warning: 12 orphaned containers detected
Are you sure you want to stop 12 containers? [y/N]: y
Successfully stopped 12 containers
```

## Additional Suggestions and Ideas

- Consider adding a `--dry-run` option to `stop --all-worktrees` to show what would be stopped without actually stopping
- Think about adding container age information to help users identify very old orphaned containers
- Consider improving the worktree validation to be more permissive for orphaned container detection
- Think about adding a separate `cleanup` command that specifically handles orphaned containers
- Consider adding verbose logging to help debug container discovery issues

## Other Important Agreements

- **Container discovery should be centralized**: All commands should use the same `discoverContainers()` function with consistent parameters
- **Worktree validation should not block orphaned detection**: Orphaned containers should be identified even if their associated worktrees are invalid
- **Cached worktree data is preferred**: When available, use cached worktree data to ensure consistency across operations
- **User experience over technical purity**: The commands should work consistently from user perspective, even if it means adjusting internal validation logic
- **Backward compatibility**: Existing command-line interfaces and behaviors must continue to work unchanged