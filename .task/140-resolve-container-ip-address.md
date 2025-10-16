# Task 140: Resolve Container IP Address for 0.0.0.0 Listeners

## Description
Based on user feedback about `discover-opencode` showing `localhost:42327` when opencode is actually listening on `http://0.0.0.0:42327`. The issue is that `0.0.0.0` (listen on all interfaces) gets converted to a generic `localhost` instead of the actual container IP address that users can connect to.

## Problem Statement
The `discover-opencode` command shows inaccurate host information when opencode listens on `0.0.0.0` because:

1. **Generic host conversion**: The code converts `0.0.0.0` to `localhost` which is not the actual reachable IP
2. **Missing container IP resolution**: The actual container IP (e.g., `192.168.215.3`) is not resolved and displayed
3. **User confusion**: Users see `localhost:42327` but the actual reachable address is the container's IP

The current host resolution logic in `src/commands/discover-opencode.ts` line 222:
```typescript
const host = match[1] === '0.0.0.0' ? 'localhost' : match[1]; // Convert 0.0.0.0 to localhost for external access
```

But it should resolve `0.0.0.0` to the actual container IP address for accurate connection information.

## Requirements
1. Add a new function `getContainerIpAddress(containerId: string, verbose: boolean): Promise<string>` in `src/commands/discover-opencode.ts`
2. The function should use `docker inspect --format '{{.NetworkSettings.IPAddress}}'` to get the primary container IP
3. Add fallback to `docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'` for bridge network IP
4. Modify the host resolution logic around line 222 to resolve `0.0.0.0` to the actual container IP
5. Ensure the IP resolution is only triggered when `0.0.0.0` is detected (not for specific IPs like `127.0.0.1` or `192.168.1.100`)
6. Add proper error handling with fallback to `localhost` if IP resolution fails
7. Add verbose logging to show the IP resolution process when `options.verbose` is enabled
8. Test the fix with running containers to verify accurate IP resolution
9. Run the existing test suite to ensure no regressions

## Expected Outcome
1. `discover-opencode` shows actual container IP when opencode listens on `0.0.0.0` (e.g., `192.168.215.3:42327`)
2. The command preserves existing behavior for specific IPs (`127.0.0.1`, `192.168.1.100`, etc.)
3. Container IP resolution is robust with proper fallbacks for error scenarios
4. Users get accurate, actionable connection information for their containers
5. The fix maintains backward compatibility with existing host resolution behavior
6. Verbose mode shows the IP resolution process for debugging

## Additional Suggestions and Ideas
- Consider caching container IPs to avoid repeated Docker inspect calls for the same container
- Think about whether we should show both the listening address (`0.0.0.0:42327`) and the reachable address (`192.168.215.3:42327`) in verbose mode
- Consider adding a test case for IP resolution with different network configurations
- Think about whether we need to handle containers with multiple network interfaces
- Consider documenting the IP resolution strategy and fallback mechanisms
- Think about whether we should add performance metrics for the IP resolution overhead

## Other Important Agreements
- The IP resolution should only be triggered for `0.0.0.0` listeners, not for specific IP addresses
- The solution should maintain backward compatibility for all existing host resolution scenarios
- The existing discovery logic should remain intact except for the host resolution modification
- The solution should work with different Docker network configurations (bridge, host, custom networks)
- Follow existing code patterns for error handling, logging, and Docker command execution
- Ensure the fix doesn't break any existing functionality or test cases
- The performance impact should be minimal since IP resolution only happens when `0.0.0.0` is detected