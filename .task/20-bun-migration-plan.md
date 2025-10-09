# Task 20: BUN Migration Plan

## Description
Based on user discussion about preparing migration to BUN runtime, this task focuses on converting the Node.js TypeScript CLI project to BUN for improved performance and modern JavaScript runtime benefits.

## Problem Statement
The current aisanity project runs on Node.js with TypeScript compilation, which has slower startup times and requires transpilation steps. Migrating to BUN would provide 2-3x faster startup, native TypeScript support, and potential single-binary distribution.

## Requirements
1. Update package.json scripts and dependencies for BUN compatibility
2. Convert TypeScript configuration from CommonJS to ESNext modules
3. Replace Jest testing setup with BUN's built-in test runner
4. Migrate child_process.spawn calls to BUN's spawn API (critical for Docker integration)
5. Update execSync calls to use Bun.$ shell helper
6. Change shebang from node to bun interpreter
7. Test Docker integration thoroughly after migration
8. Ensure all file system operations remain compatible

## Expected Outcome
1. Updated package.json with BUN-specific scripts and dependencies
2. Modified tsconfig.json with ESNext modules and BUN types
3. Removed Jest configuration, converted tests to BUN format
4. Migrated src/utils/docker-safe-exec.ts to use BUN spawn API
5. Updated src/commands/run.ts and other files using child_process
6. Changed shebang in src/index.ts to #!/usr/bin/env bun
7. Fully functional CLI running on BUN with performance improvements
8. Documentation updates for BUN installation and usage

## Additional Suggestions and Ideas
- Consider using bun build for creating single binary executables
- Explore BUN's native file system API for better performance
- Leverage BUN's built-in HTTP client if any HTTP operations are added
- Test performance improvements and document benchmarks
- Consider maintaining Node.js compatibility during transition period

## Other Important Agreements
- Main challenge is Docker integration compatibility with BUN's child_process differences
- Critical files requiring migration: src/utils/docker-safe-exec.ts and src/commands/run.ts
- Target BUN version >=1.0.0 for stability
- Maintain existing functionality while improving performance
- Focus on thorough testing of Docker and git operations post-migration