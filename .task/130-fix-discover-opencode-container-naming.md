# Task 130: Fix Discover-Opencode Container Naming Issue

## Description
Based on user feedback about `discover-opencode` always returning "No running containers found" despite having running opencode containers. The issue is with container naming mismatches between aisanity's expected naming convention and VS Code Dev Containers' actual naming patterns.

## Problem Statement
The `discover-opencode` command fails to find running opencode instances because:

1. **Container naming mismatch**: The code expects containers to be named `aisanity-main` but VS Code Dev Containers creates containers with random names like `vibrant_cori`

2. **Incomplete label-based discovery**: While containers have the label `aisanity.container: aisanity-main`, the discovery code only looks for containers by name or by `devcontainer.local_folder` label

3. **Missing label filter**: The code should also filter by `label=aisanity.container=${containerName}` to find aisanity-managed containers created by VS Code Dev Containers

The current discovery logic in `src/commands/discover-opencode.ts` lines 128-140 only checks:
- `docker ps -q --filter name=${containerName}` (by container name)
- `docker ps -q --filter label=devcontainer.local_folder=${cwd}` (by devcontainer folder)

But it misses containers that have the `aisanity.container` label, which is how aisanity identifies its containers when created through VS Code Dev Containers.

## Requirements
1. Add a new filter in `src/commands/discover-opencode.ts` around line 140 to check for containers with `aisanity.container` label
2. The new filter should use: `docker ps -q --filter label=aisanity.container=${containerName}`
3. Add the container IDs found by this filter to the existing `containerIdsSet`
4. Ensure the new filter is wrapped in proper try-catch error handling like the existing filters
5. Test the fix with the current running container to verify it's discovered correctly
6. Run the existing test suite to ensure no regressions
7. Consider adding a test case for this discovery scenario if needed

## Expected Outcome
1. `discover-opencode` command successfully finds running opencode instances in VS Code Dev Containers
2. The command works with both aisanity-managed containers and VS Code Dev Containers
3. Container discovery is more robust and handles different naming conventions
4. Users can successfully discover opencode instances regardless of how the container was created
5. The fix maintains backward compatibility with existing container discovery methods

## Additional Suggestions and Ideas
- Consider adding verbose logging to show which discovery method found the containers
- Think about whether we should prioritize containers with aisanity labels over name-based matches
- Consider adding a test that creates a container with aisanity labels and verifies discovery
- Think about whether we need to handle other label patterns that might be used in the future
- Consider documenting the different container naming patterns and discovery methods
- Think about whether we should add a fallback mechanism to search all containers if specific filters fail

## Other Important Agreements
- The fix should be minimal and focused only on adding the missing label filter
- No changes should be made to how containers are created or named
- The existing discovery logic should remain intact to maintain backward compatibility
- The solution should work with both aisanity-managed containers and VS Code Dev Containers
- Follow existing code patterns and error handling in the discovery function
- Ensure the fix doesn't break any existing functionality or test cases