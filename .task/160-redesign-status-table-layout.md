# Task 160: Redesign Status Table Layout

## Description
Based on user feedback about `aisanity status` table showing confusing "unmapped" entries for containers that clearly belong to the workspace. The current design incorrectly assumes every container must map to a git worktree, but containers can exist for branches without worktrees. User pointed out that "worktree" has separate subcommand and status should focus on workspace-level view.

## Problem Statement

The `aisanity status` command has a fundamental design flaw in its table layout and container mapping logic:

1. **Wrong mental model**: Assumes every container must map to a git worktree, but containers can exist for branches without worktrees
2. **Confusing "unmapped" label**: Shows containers as "unmapped" when they actually belong to the correct workspace based on `aisanity.workspace` label
3. **Incorrect table structure**: Uses "Worktree" column as primary grouping when it should be "Workspace"
4. **Missing worktree status**: Doesn't clearly show which branches have associated worktrees vs those that don't

Current problematic output:
```
│ Worktree     │ Branch              │ Container          │ Status      │
│ → main       │ main                │ aisanity-main      │ Running     │
│ (unmapped)   │ feature/100-fsm     │ priceless_goodall  │ Running     │
│ (unmapped)   │ feature/100_4_20    │ beautiful_poitras  │ Running     │
```

## Requirements

1. **Change primary grouping from Worktree to Workspace**: Replace "Worktree" column with "Workspace" as the main grouping level
2. **Add Worktree status column**: Add new column showing if branch has corresponding worktree (✅/❌ indicators)
3. **Remove "unmapped" concept**: All containers with correct `aisanity.workspace` label belong to that workspace
4. **Group by workspace then branch**: Primary grouping should be workspace, secondary grouping by branch name
5. **Maintain backward compatibility**: Keep existing command-line options and overall functionality
6. **Preserve all current information**: Don't lose any existing data, just reorganize presentation

## Expected Outcome

1. **Clear workspace-centric view**: Table shows all containers grouped by their workspace
2. **Accurate worktree status**: Clear indication of which branches have worktrees vs those that don't
3. **No confusing "unmapped" labels**: All containers properly belong to their workspace
4. **Intuitive table structure**: Users can easily understand workspace → branch → container → worktree status relationship

Expected new table format:
```
│ Workspace   │ Branch              │ Container          │ Worktree   │ Status      │ Ports    │
│ aisanity   │ main                │ aisanity-main      │ ✅ main    │ Running     │ -        │
│ aisanity   │ feature/100-fsm     │ priceless_goodall  │ ❌ none    │ Running     │ -        │
│ aisanity   │ feature/100_4_20    │ beautiful_poitras  │ ❌ none    │ Running     │ -        │
│ aisanity   │ feature/100_4_10    │ busy_bell          │ ❌ none    │ Running     │ -        │
```

## Additional Suggestions and Ideas

- Consider adding workspace summary statistics (e.g., "aisanity workspace: 4 running, 0 stopped")
- Think about color-coding worktree status (green for ✅, red for ❌)
- Consider adding option to filter by workspace if multiple workspaces exist
- Think about sorting options (by status, branch name, container name)
- Consider adding container age information to help identify old/stale containers

## Other Important Agreements

- **Workspace is primary identifier**: The `aisanity.workspace` label is the authoritative source for container ownership, not worktree existence
- **Worktree is optional**: Branches can have containers without corresponding git worktrees, which is normal and valid
- **Separation of concerns**: Status command should focus on workspace view, while worktree subcommand handles worktree-specific operations
- **User clarity over technical correctness**: Table should be intuitive for users even if it means changing internal mental models
- **Backward compatibility**: Existing command-line interface and options must continue to work unchanged