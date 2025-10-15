# Task 70: Compile-Time Version Generation

## Description
Based on user feedback requesting dynamic version detection from git tags instead of hardcoded version in src/index.ts, this task focuses on implementing compile-time version generation. The user wants to eliminate manual version management and use git tags as the source of truth for versioning, with compile-time injection for optimal performance.

## Problem Statement
The current version is hardcoded as '0.1.0' in src/index.ts while the actual latest git tag is v0.3.0, creating version drift. Manual version updates are error-prone and require synchronization between multiple files. Runtime git calls add unnecessary overhead to CLI execution.

## Requirements
1. Create src/utils/version.ts with dual-mode versioning strategy
2. Implement compile-time version injection using Bun's --define flag
3. Use `git describe --tags --always` for version generation
4. Update package.json build scripts to inject version at compile time
5. Maintain dynamic versioning for development (bun run dev)
6. Ensure static versioning for production builds
7. Update src/index.ts to use the new version utility
8. Remove hardcoded version from Command initialization
9. Handle edge cases gracefully (no git, no tags)
10. Ensure zero runtime git dependency for built binaries

## Expected Outcome
1. New src/utils/version.ts with dual-mode version detection
2. Updated package.json build scripts with --define VERSION injection
3. Modified src/index.ts using dynamic version import
4. Development builds show git-based versions (e.g., v0.3.0-1-g346feec-dirty)
5. Production builds have static versions baked into binaries
6. Zero runtime git calls for built executables
7. Automatic version synchronization with git tags
8. No manual version management required
9. Consistent versioning across development and release workflows
10. Performance optimization with compile-time constants

## Additional Suggestions and Ideas
- Consider adding build metadata to version strings
- Implement version validation and formatting
- Add version comparison utilities for future features
- Consider semantic version parsing for version constraints
- Add version information to help commands and status output
- Implement version caching for repeated calls in development
- Consider adding build timestamp to development versions
- Create version testing utilities for CI/CD validation

## Other Important Agreements
- Use compile-time version injection for production builds
- Maintain dynamic versioning for development builds
- Use `git describe --tags --always` as the version source
- No package.json fallback - git is the source of truth
- Hybrid approach: dynamic in dev, static in production
- Performance optimization is key for CLI tool
- Version should be accurate and informative for developers
- Built binaries should have no git dependency
- Leverage Bun's --define flag for compile-time constants
- This approach provides better performance than runtime git calls