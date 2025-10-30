# Task 200: Remove Deprecated Methods and Fallback Mechanisms

## Description
Based on user request to cleanup the codebase by removing all deprecated methods, fallback mechanisms that were meant to work on older versions of aisanity, and legacy code that is no longer needed. The analysis identified approximately 200-300 lines of deprecated code across 5 files that can be safely removed to improve code maintainability and reduce complexity.

## Problem Statement

The codebase contains accumulated technical debt from previous versions including:

1. **Deprecated functions and interfaces** - Marked with @deprecated annotations and scheduled for removal in v2.0.0
2. **Disabled fallback strategies** - Completely commented out but still present in the codebase
3. **Legacy configuration handling** - Code for one-time migration from older config formats
4. **Backward compatibility wrappers** - Functions maintained solely for older version compatibility
5. **Test code for deprecated functionality** - Tests that verify deprecated functions still exist

This deprecated code increases maintenance burden, confuses new developers, and makes the codebase harder to understand and modify.

## Requirements

1. **Remove all @deprecated functions and interfaces** in status.ts (WorktreeStatusRow, mapContainersToWorktrees, getContainerStatusWithPorts, formatWorktreeTable, generateWorktreeSummary)
2. **Remove disabled fallback strategies** in container-utils.ts (lines 248-271 and 756-773)
3. **Remove legacy configuration handling** in config.ts (old workspace_branch format)
4. **Remove deprecated wrapper functions** like discoverContainers() in container-utils.ts
5. **Remove test code for deprecated functionality** in status-regression.test.ts
6. **Update imports and references** to remove any calls to deprecated functions
7. **Run tests to ensure no regressions** after cleanup
8. **Update documentation** if any references to deprecated functionality exist

## Expected Outcome

1. **Cleaner codebase**: ~200-300 lines of deprecated code removed across 5 files
2. **Reduced complexity**: Elimination of unused code paths and legacy compatibility layers
3. **Improved maintainability**: New developers won't encounter deprecated/confusing code
4. **Preserved functionality**: All current features continue to work with modern implementations
5. **Passing tests**: All existing tests continue to pass after deprecated code removal
6. **Updated documentation**: Any references to deprecated methods are removed or updated

Expected cleanup impact:
| Category | Files affected | Lines removed | Risk level |
|----------|----------------|---------------|------------|
| High priority (safe now) | 3 files | ~50 lines | Low |
| Medium priority (v2.0.0) | 2 files | ~200 lines | Medium |
| Test cleanup | 1 file | ~15 lines | Low |

## Additional Suggestions and Ideas

- Consider creating a migration guide for users who might be using deprecated APIs directly
- Think about adding automated checks to prevent future accumulation of deprecated code
- Consider implementing a deprecation policy with clear timelines for future versions
- Think about adding linting rules to detect deprecated function usage
- Consider documenting the removal in release notes for transparency
- Think about running a broader code analysis to identify other potential cleanup opportunities
- Consider updating any external documentation or README files that might reference deprecated functionality

## Other Important Agreements

- **Safety first**: Prioritize removing only code that is explicitly marked as deprecated or disabled
- **Maintain functionality**: Ensure all current features continue to work after cleanup
- **Test coverage**: Preserve test coverage for active functionality while removing tests for deprecated code
- **Version alignment**: Target this cleanup for v2.0.0 since most deprecated items are marked for removal in that version
- **Incremental approach**: Start with high-priority safe removals, then proceed to medium-priority items
- **Documentation updates**: Ensure any user-facing documentation reflects the changes
- **Backward compatibility consideration**: Since this targets v2.0.0, breaking changes are acceptable but should be communicated clearly