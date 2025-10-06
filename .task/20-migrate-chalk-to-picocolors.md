# Task 20: Migrate Chalk to Picocolors

## Description
Based on user feedback requesting migration from chalk to picocolors, this task focuses on replacing the chalk color library with picocolors throughout the codebase. The user wants to migrate to picocolors for better performance and smaller bundle size.

## Problem Statement
The current codebase uses chalk for terminal color output, which adds unnecessary bundle size and has performance overhead. Picocolors offers a smaller, faster alternative with compatible API that will improve the tool's performance and reduce dependencies.

## Requirements
1. Replace chalk dependency with picocolors in package.json
2. Update import statements in source code:
   - src/commands/discover-opencode.ts: Replace `import chalk from 'chalk'` with `import pc from 'picocolors'`
3. Update all color method calls:
   - `chalk.red()` → `pc.red()`
   - `chalk.yellow()` → `pc.yellow()`
   - `chalk.green()` → `pc.green()`
   - `chalk.blue()` → `pc.blue()`
4. Update test mocks in tests/discover-opencode.test.ts to mock picocolors instead of chalk
5. Update Jest configuration in jest.config.js to exclude picocolors from transforms
6. Ensure all existing functionality remains intact
7. Run tests to verify migration success

## Expected Outcome
1. Updated package.json with picocolors dependency and chalk removed
2. All source code files updated to use picocolors API
3. Updated test mocks for picocolors
4. Updated Jest configuration
5. All tests passing with new color library
6. Successful build process
7. No functional changes to color output - users should see identical colored terminal output

## Additional Suggestions and Ideas
- Consider adding a comment in package.json about why picocolors was chosen over chalk
- Verify that the color output looks identical in different terminal environments
- Check if any other files in the codebase might be using chalk that weren't caught in the initial search
- Consider running a performance comparison if possible

## Other Important Agreements
- Picocolors has a compatible API with chalk, making this a straightforward migration
- The migration should maintain all existing color functionality without breaking changes
- Focus on the files identified: src/commands/discover-opencode.ts, tests/discover-opencode.test.ts, and jest.config.js
- Ensure the migration is complete by running the full test suite and build process