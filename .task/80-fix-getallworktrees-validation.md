# Task 80: Fix getAllWorktrees Validation

## Description
Based on user feedback pointing out that the proper fix for git errors in `aisanity status` should be in `getAllWorktrees()` function rather than just suppressing stderr output. The user correctly identified that we should proactively validate worktree directories before attempting git operations, rather than just hiding error messages.

## Problem Statement
The current `getAllWorktrees()` function iterates through all directories in `.git/worktrees/` and attempts to call `getCurrentBranch()` on each one. When worktree directories become invalid (deleted, moved, or corrupted), git operations fail with "fatal: not a git repository" errors. The current approach catches these exceptions but still attempts the git operations, which is inefficient and generates noise.

## Requirements
1. Create `isValidGitWorktree()` function to validate worktree directories
2. Update `getAllWorktrees()` to validate worktrees before git operations
3. Remove stderr suppression from `getCurrentBranch()` (revert to clean implementation)
4. Add proper worktree validation logic that checks for valid git structure
5. Handle stale worktree references gracefully
6. Maintain existing functionality for valid worktrees
7. Improve performance by avoiding failed git operations
8. Add better logging for skipped invalid worktrees
9. Ensure backward compatibility with existing worktree structure
10. Update error handling to be more informative

## Expected Outcome
1. New `isValidGitWorktree()` utility function in `src/utils/worktree-utils.ts`
2. Updated `getAllWorktrees()` function with proactive validation
3. Clean `getCurrentBranch()` implementation without stderr suppression
4. No more "fatal: not a git repository" error messages
5. Better performance by avoiding failed git operations
6. Informative logging for invalid worktrees
7. Robust handling of stale worktree references
8. Maintained functionality for valid worktrees
9. Cleaner error handling throughout the worktree system
10. More reliable `aisanity status` command output

## Additional Suggestions and Ideas
- Consider adding worktree cleanup functionality to remove stale references
- Implement worktree health checking with detailed diagnostics
- Add option to force refresh worktree cache
- Consider adding worktree repair functionality for broken references
- Implement worktree validation as a separate command (`aisanity worktree validate`)
- Add metrics for worktree validation performance
- Consider caching validation results to improve performance
- Add detailed logging options for debugging worktree issues
- Implement worktree orphan detection and cleanup suggestions
- Consider adding worktree integrity checks

## Other Important Agreements
- Fix the root cause in `getAllWorktrees()` rather than suppressing symptoms
- Proactive validation is better than reactive error handling
- Maintain existing functionality while improving robustness
- Clean error messages and better user experience
- Performance optimization through avoiding failed operations
- Proper separation of concerns between validation and git operations
- Keep the existing worktree structure and compatibility
- Focus on making the system more resilient to edge cases