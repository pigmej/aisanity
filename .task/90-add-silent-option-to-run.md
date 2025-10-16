# Task 90: Add Silent Option to Run Command

## Description
Based on user feedback requesting the addition of a `--silent` option to the `opencode run` command to suppress ALL output from aisanity while preserving 100% output from the tools that are run inside the container. This will allow users to get clean output from their commands without aisanity's informational messages cluttering the output.

## Problem Statement
The current `opencode run` command outputs various informational messages including container status, workspace information, branch details, and container management messages. When users want to run commands and get clean output from their tools, these aisanity messages interfere with the output. Users need a way to suppress aisanity's own output while still seeing the complete output from the commands running inside the container.

## Requirements
1. Add `--silent` option to the `runCommand` in `src/commands/run.ts`
2. Conditionally suppress all `console.log` statements when `--silent` is enabled
3. Keep `console.error` messages for critical errors (should still show even in silent mode)
4. Modify `Bun.spawn` stdio configuration to handle silent mode properly
5. Ensure only aisanity's own output is suppressed, not the containerized tools' output
6. Maintain existing behavior when `--silent` is not used
7. Handle both `devcontainer up` and `devcontainer exec` processes correctly in silent mode
8. Preserve tool output completely when `--silent` is enabled
9. Ensure error handling still works properly in silent mode
10. Test with both interactive and non-interactive commands

## Expected Outcome
1. New `--silent` option available in `opencode run` command
2. All aisanity informational messages suppressed when `--silent` is used
3. Complete preservation of tool output from containerized commands
4. Error messages still displayed even in silent mode
5. Proper stdio handling for child processes in silent mode
6. Backward compatibility - existing behavior unchanged without `--silent`
7. Clean output for users when running tools with `--silent` flag
8. Robust error handling maintained in silent mode
9. Support for both interactive shells and specific commands in silent mode
10. Better user experience for automated scripts and CI/CD scenarios

## Additional Suggestions and Ideas
- Consider adding a `--quiet` alias for `--silent` for better user experience
- Implement different levels of silence (e.g., `--quiet` vs `--silent`)
- Add progress indicators for long-running operations even in silent mode
- Consider adding timestamp logging option for debugging in silent mode
- Implement silent mode for other commands as well (status, rebuild, etc.)
- Add configuration option to set silent as default in `.aisanity` config
- Consider adding verbose/silent/normal mode hierarchy
- Implement conditional logging based on environment variables
- Add silent mode to worktree commands for cleaner scripting
- Consider adding output filtering capabilities beyond just silent mode

## Other Important Agreements
- Only suppress aisanity's own output, never suppress tool output
- Error messages should always be visible, even in silent mode
- Maintain full backward compatibility with existing behavior
- Follow existing option patterns like `--verbose` for consistency
- Focus on clean separation between aisanity output and tool output
- Ensure the implementation is robust and handles edge cases properly
- Test thoroughly with different types of commands and scenarios
- Keep the implementation simple and maintainable
- Follow the existing code style and patterns in the codebase