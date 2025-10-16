# Task 100: Fix Silent Mode Stdio Configuration

## Description
Based on user feedback that the `--silent` option implementation is incomplete. When running `aisanity run --silent bash`, the devcontainer CLI still outputs startup messages including timing information and container details. The user expects true silent mode where only the tool output (bash prompt and commands) is visible, with no aisanity or devcontainer infrastructure messages.

## Problem Statement
The current silent mode implementation successfully suppresses aisanity's console.log messages through the Logger class, but the devcontainer CLI output is still being displayed. The output includes:
```
[1 ms] @devcontainers/cli 0.80.1. Node.js v24.9.0. darwin 24.6.0 arm64.
{"outcome":"success","containerId":"70b6b7259fc360c031b3b445cdb24e46f6cc7338f227d78f44ff903408e2e9d2","remoteUser":"bun","remoteWorkspaceFolder":"/workspaces/aba9-when-there-is-ai"}
```

This occurs because both `devcontainer up` and `devcontainer exec` commands are spawned with `stdio: ['inherit', 'inherit', 'inherit']`, which inherits all output including infrastructure messages from the devcontainer CLI.

## Requirements
1. Modify `devcontainer up` stdio configuration to use `['inherit', 'pipe', 'pipe']` when `--silent` or `--quiet` is enabled
2. Keep `devcontainer exec` stdio configuration as `['inherit', 'inherit', 'inherit']` to preserve tool output
3. Ensure error handling still works properly when devcontainer up output is suppressed
4. Maintain existing behavior when `--silent` is not used
5. Test that devcontainer CLI startup messages are completely suppressed in silent mode
6. Verify that user tool output (bash prompt, command results) is still fully visible
7. Ensure error messages from devcontainer operations are still captured and handled
8. Update any relevant tests to cover the new stdio behavior
9. Verify the fix works with both `--silent` and `--quiet` flags
10. Test with both interactive shells and specific commands

## Expected Outcome
1. `aisanity run --silent bash` shows only the bash prompt with no devcontainer CLI messages
2. `aisanity run --quiet npm test` shows only test output with no infrastructure messages
3. Error handling still works properly - errors are still displayed to the user
4. Tool output is 100% preserved in all scenarios
5. Backward compatibility maintained - normal mode unchanged
6. Both `devcontainer up` and `devcontainer exec` processes work correctly with the new stdio configuration
7. All existing tests continue to pass
8. New tests verify the silent mode stdio behavior
9. Clean user experience for automated scripts and CI/CD scenarios
10. True silent mode as originally intended by the user

## Additional Suggestions and Ideas
- Consider adding error output buffering to capture any critical devcontainer errors even in silent mode
- Think about whether we need to handle different types of devcontainer output differently
- Consider if there are other commands that might need similar stdio treatment
- Think about whether we should provide different levels of silence (infrastructure vs tool output)
- Consider adding a debug mode that shows what's being suppressed
- Think about whether this pattern should be applied to other container operations
- Consider whether we need to handle long-running devcontainer operations differently
- Think about whether we should provide feedback about what's happening in silent mode for long operations

## Other Important Agreements
- The devcontainer CLI output is considered "infrastructure output" and should be suppressed in silent mode
- User tool output (from the actual command being run) should always be preserved
- Error messages should always be visible regardless of silent mode
- The fix should be minimal and focused only on the stdio configuration issue
- The Logger class implementation is correct and should not be modified
- The separation between aisanity output, infrastructure output, and tool output should be maintained
- The solution should work for both interactive shells and specific commands
- Backward compatibility must be maintained for existing behavior