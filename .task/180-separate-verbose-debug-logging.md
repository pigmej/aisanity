# Task 180: Separate Verbose Debug Logging

## Description
Based on user feedback that `bun run aisanity status --verbose` now shows way too much information after Task 170 implementation. The current implementation mixes user-facing verbose information with system-level debug information, making the output noisy and less useful. Users need clear separation between "what's happening" (verbose) and "how it's working" (debug).

## Problem Statement

The Task 170 implementation introduced extensive logging throughout the container discovery process, but all of it is controlled by a single `--verbose` flag. This creates several issues:

1. **Mixed concerns**: User-relevant information (container status, orphaned containers) is mixed with system internals (discovery process, validation details)
2. **Noisy output**: `aisanity status --verbose` now shows discovery process details that users don't care about
3. **Poor user experience**: Users can't get clean verbose information without system debug noise
4. **Inconsistent expectations**: Different commands show different levels of detail under the same `--verbose` flag

Current problematic behavior:
```bash
$ aisanity status --verbose
[Discovery] Found 3 labeled containers
[Discovery] Found 0 additional devcontainer containers
[Discovery] Completed in 45ms
[Discovery] Total: 3, Labeled: 3, Unlabeled: 0, Orphaned: 1
Workspace: my-project
Branch: main
Container: my-project-main (running)
⚠️  Warning: 1 orphaned containers detected

Orphaned containers:
  - old-feature (exited)
    Workspace: /path/to/old-feature
    Reason: Worktree directory not found
```

Users expect verbose mode to show the workspace/container information, not the discovery process details.

## Requirements

1. **Add `--debug` flag**: Introduce a new `--debug` CLI option for system-level debugging information
2. **Separate logging concerns**: 
   - `--verbose` = User-facing detailed information (what they care about)
   - `--debug` = System-level debugging information (how it works internally)
3. **Update discovery functions**: Add `debug` parameter to `ContainerDiscoveryOptions` interface
4. **Refactor logging calls**: Move discovery process logging from `verbose` to `debug`
5. **Maintain backward compatibility**: Existing `--verbose` behavior preserved for user information
6. **Update all commands**: Apply consistent verbose/debug separation across status, stop, and other commands
7. **Update help documentation**: Clarify difference between `--verbose` and `--debug` flags

## Expected Outcome

1. **Clean verbose output**: `aisanity status --verbose` shows only user-relevant information
2. **Powerful debugging**: `aisanity status --debug` shows system internals and discovery process
3. **Combined usage**: `aisanity status --verbose --debug` shows both user and system information
4. **Consistent experience**: All commands follow the same verbose/debug separation pattern
5. **Better user experience**: Users get the right level of detail for their needs

Expected separated behavior:
```bash
$ aisanity status --verbose
Workspace: my-project
Branch: main
Container: my-project-main (running)
⚠️  Warning: 1 orphaned containers detected

Orphaned containers:
  - old-feature (exited)
    Workspace: /path/to/old-feature
    Reason: Worktree directory not found
```

```bash
$ aisanity status --debug
[Discovery] Found 3 labeled containers
[Discovery] Found 0 additional devcontainer containers
[Discovery] Completed in 45ms
[Discovery] Total: 3, Labeled: 3, Unlabeled: 0, Orphaned: 1
[Validation] Validated 3 worktrees (2 valid, 1 invalid)
```

## Additional Suggestions and Ideas

- Consider adding log levels (info, warn, error, debug) for even finer control
- Think about adding a `--quiet` flag that suppresses all non-error output
- Consider adding structured logging (JSON format) for machine consumption
- Think about adding timing information to debug output for performance analysis
- Consider adding a configuration option to set default verbosity levels
- Think about adding color coding to distinguish between verbose and debug output

## Other Important Agreements

- **User experience over technical purity**: The separation should make the CLI more user-friendly, not just technically cleaner
- **Backward compatibility**: Existing `--verbose` behavior must be preserved for user-facing information
- **Consistent patterns**: All commands should follow the same verbose/debug separation approach
- **Clear documentation**: Help text should clearly explain what each flag shows
- **Performance impact**: The separation should not impact performance when neither flag is used
- **Developer experience**: Debug output should be useful for developers troubleshooting issues
