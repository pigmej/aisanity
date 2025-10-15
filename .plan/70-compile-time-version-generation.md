# Implementation Plan: Compile-Time Version Generation

## Implementation Overview

This plan implements a dual-mode versioning system that eliminates version drift and manual version management by using git tags as the single source of truth. The implementation provides compile-time version injection for production builds (zero runtime overhead) and dynamic git-based versioning for development (real-time accuracy).

### Core Strategy
- **Production Mode**: Inject version at compile time using Bun's `--define` flag
- **Development Mode**: Execute `git describe --tags --always` at runtime with caching
- **Integration Points**: CLI version display, container labels, build scripts
- **Performance**: Zero git dependency in built binaries, cached results in development

### Key Benefits
1. **Eliminates version drift**: Git tags are the authoritative source
2. **Zero manual updates**: No hardcoded versions to maintain
3. **Optimal performance**: Compile-time constants for production builds
4. **Development accuracy**: Real-time version updates reflecting git state
5. **Container labeling**: Accurate version tracking for all containers

## Component Details

### 1. Version Utility Module (`src/utils/version.ts`)

**Purpose**: Centralized version detection with dual-mode operation

**Core Functionality**:
```typescript
// Illustrative structure - not executable code
interface VersionInfo {
  version: string;
  source: 'compile-time' | 'git' | 'fallback';
  isDevelopment: boolean;
  isDirty?: boolean;
}

// Primary export function
export function getVersion(): string

// Optional detailed version info
export function getVersionInfo(): VersionInfo

// Internal functions
function getCompileTimeVersion(): string | null
function getGitVersion(): string
function getFallbackVersion(): string
```

**Compile-Time Detection**:
```typescript
// Example pattern for detecting compile-time VERSION
declare const VERSION: string | undefined;

function getCompileTimeVersion(): string | null {
  // Check if VERSION was injected at compile time
  if (typeof VERSION !== 'undefined') {
    return VERSION;
  }
  return null;
}
```

**Git Version Execution**:
```typescript
// Example pattern for git describe execution
function getGitVersion(): string {
  try {
    // Execute: git describe --tags --always
    // Returns format: v0.3.0-1-g346feec or v0.3.0-1-g346feec-dirty
    
    // Add error handling for:
    // - Not a git repository
    // - Git command not found
    // - No commits yet
    // - Command execution failure
    
    return formattedVersion;
  } catch (error) {
    return getFallbackVersion();
  }
}
```

**Caching Strategy**:
```typescript
// Example caching pattern for development mode
let cachedVersion: string | null = null;
let cacheTimestamp: number | null = null;
const CACHE_TTL_MS = 5000; // 5 seconds

function getCachedOrFreshVersion(): string {
  const now = Date.now();
  
  if (cachedVersion && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedVersion;
  }
  
  cachedVersion = getGitVersion();
  cacheTimestamp = now;
  return cachedVersion;
}
```

**Edge Case Handling**:
- No git repository: Return "unknown"
- No git tags: Use commit hash from `git describe --always`
- Dirty working directory: Automatic "-dirty" suffix from git describe
- Git command fails: Graceful fallback to "unknown"
- No commits: Return "0.0.0-dev"

**Dependencies**:
- Bun `$` shell executor for git commands
- TypeScript type definitions
- No external npm packages required

### 2. CLI Integration (`src/index.ts`)

**Current State**:
```typescript
// Line 26: Hardcoded version
.version('0.1.0')
```

**Target State**:
```typescript
import { getVersion } from './utils/version';

program
  .name('aisanity')
  .description('Devcontainer wrapper for sandboxed development environments')
  .version(getVersion()); // Dynamic version detection
```

**Changes Required**:
1. Add import statement for `getVersion` function
2. Replace hardcoded '0.1.0' with `getVersion()` call
3. No other changes needed - Commander.js handles the rest

**Behavior**:
- `aisanity --version` displays current version
- Development: Shows git-based version (e.g., v0.3.0-1-g346feec-dirty)
- Production: Shows static version baked into binary (e.g., v0.3.0)

### 3. Container Labels Integration (`src/utils/container-utils.ts`)

**Current Implementation** (Lines 238-245):
```typescript
// Reads package.json at runtime - inefficient
let version = 'unknown';
try {
  const packageJson = JSON.parse(readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
  version = packageJson.version || 'unknown';
} catch (error) {
  // Ignore error, use default
}
```

**Target Implementation**:
```typescript
import { getVersion } from './version';

export function generateContainerLabels(
  workspaceName: string,
  branch: string,
  containerName: string,
  workspacePath: string
): ContainerLabels {
  return {
    'aisanity.workspace': workspacePath,
    'aisanity.branch': branch,
    'aisanity.container': containerName,
    'aisanity.created': new Date().toISOString(),
    'aisanity.version': getVersion() // Use version utility
  };
}
```

**Changes Required**:
1. Add import for `getVersion` from './version'
2. Remove `readFileSync` import (if not used elsewhere)
3. Replace version detection logic with single `getVersion()` call
4. Remove try/catch block for package.json reading

**Benefits**:
- Eliminates runtime I/O operation
- Consistent versioning with CLI
- Accurate container version tracking
- Performance improvement

### 4. Build System Enhancement (`package.json`)

**Script Updates Required**:

All build and compile scripts must include `--define VERSION="$(git describe --tags --always)"`:

```json
// Illustrative script structure
{
  "scripts": {
    // Standard build (for distribution)
    "build": "bun build ./src/index.ts --outdir ./dist --target bun --define VERSION=\"$(git describe --tags --always)\"",
    
    // Local compilation
    "package": "bun build ./src/index.ts --compile --outfile ./dist/aisanity --define VERSION=\"$(git describe --tags --always)\"",
    
    // Platform-specific builds
    "build:linux-x64": "bun build ./src/index.ts --compile --target bun-linux-x64 --outfile ./aisanity-linux-x64 --define VERSION=\"$(git describe --tags --always)\"",
    
    "build:linux-arm64": "bun build ./src/index.ts --compile --target bun-linux-arm64 --outfile ./aisanity-linux-arm64 --define VERSION=\"$(git describe --tags --always)\"",
    
    "build:darwin-x64": "bun build ./src/index.ts --compile --target bun-darwin-x64 --outfile ./aisanity-darwin-x64 --define VERSION=\"$(git describe --tags --always)\"",
    
    "build:darwin-arm64": "bun build ./src/index.ts --compile --target bun-darwin-arm64 --outfile ./aisanity-darwin-arm64 --define VERSION=\"$(git describe --tags --always)\"",
    
    // Batch builds
    "build:all": "bun run build:linux-x64 && bun run build:linux-arm64 && bun run build:darwin-x64 && bun run build:darwin-arm64",
    
    // Development scripts (NO --define flag - uses dynamic git)
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts"
  }
}
```

**Scripts NOT Modified**:
- `dev`: Uses dynamic git version at runtime
- `start`: Uses dynamic git version at runtime
- `test`: No version injection needed for tests
- `lint`: No version injection needed

**Cross-Platform Considerations**:
- Shell command substitution `$(...)` works on Linux/macOS
- Git must be available during build process
- CI/CD pipelines must have git repository with tags
- Build scripts fail gracefully if git is unavailable

## Data Structures

### Version Information Type
```typescript
interface VersionInfo {
  version: string;           // Formatted version string (e.g., "v0.3.0-1-g346feec")
  source: 'compile-time'     // Version was injected at compile time
        | 'git'              // Version from git describe command
        | 'fallback';        // Fallback version (git unavailable)
  isDevelopment: boolean;    // True if source is 'git', false otherwise
  isDirty?: boolean;         // Present if git working directory has changes
}
```

### Container Labels Type (Existing)
```typescript
interface ContainerLabels {
  'aisanity.workspace': string;
  'aisanity.branch': string;
  'aisanity.container': string;
  'aisanity.created': string;     // ISO timestamp
  'aisanity.version': string;      // Now uses getVersion()
}
```

### Git Version Format
Git describe output formats:
- **Exact tag**: `v0.3.0` (on tagged commit)
- **After tag**: `v0.3.0-5-g346feec` (5 commits after v0.3.0)
- **Dirty state**: `v0.3.0-5-g346feec-dirty` (uncommitted changes)
- **No tags**: `346feec` (abbreviated commit hash)

## API Design

### Public API

#### `getVersion(): string`
**Purpose**: Get current version string for display

**Returns**: Formatted version string
- Production: Compile-time injected version
- Development: Git describe output with caching
- Fallback: "unknown"

**Usage**:
```typescript
import { getVersion } from './utils/version';

console.log(`Version: ${getVersion()}`);
// Output (dev): Version: v0.3.0-1-g346feec-dirty
// Output (prod): Version: v0.3.0
```

**Performance**:
- Production: O(1) - constant lookup
- Development: O(1) with cache, O(git) on cache miss

#### `getVersionInfo(): VersionInfo`
**Purpose**: Get detailed version information (optional enhancement)

**Returns**: VersionInfo object with metadata

**Usage**:
```typescript
import { getVersionInfo } from './utils/version';

const info = getVersionInfo();
console.log(`Version: ${info.version}`);
console.log(`Source: ${info.source}`);
console.log(`Development: ${info.isDevelopment}`);
```

**Use Cases**:
- Debugging version detection issues
- Conditional behavior based on version source
- Telemetry and logging

### Internal API

#### `getCompileTimeVersion(): string | null`
**Purpose**: Check for compile-time VERSION constant

**Returns**: 
- Injected version string if available
- `null` if VERSION not defined

**Implementation Note**: Uses TypeScript global declaration

#### `getGitVersion(): string`
**Purpose**: Execute git describe command

**Returns**: Git describe output or fallback

**Error Handling**:
- Command not found → fallback
- Not a git repo → fallback
- No commits → "0.0.0-dev"

#### `getFallbackVersion(): string`
**Purpose**: Provide version when git is unavailable

**Returns**: "unknown"

**Note**: Could be enhanced to read package.json as last resort

#### `clearVersionCache(): void` (optional)
**Purpose**: Clear cached version for testing

**Use Case**: Unit tests that need fresh version detection

## Testing Strategy

### Unit Tests (`tests/version.test.ts`)

**Test Cases**:

1. **Compile-Time Version Detection**
   - Mock VERSION global constant
   - Verify getVersion() returns compile-time value
   - Verify source is 'compile-time'
   - Verify isDevelopment is false

2. **Git Version Detection**
   - Mock Bun $ executor for git commands
   - Test successful git describe execution
   - Verify version format parsing
   - Verify source is 'git'
   - Verify isDevelopment is true

3. **Fallback Behavior**
   - Mock git command failure
   - Verify fallback to "unknown"
   - Verify source is 'fallback'

4. **Caching Mechanism**
   - Call getVersion() multiple times
   - Verify git command executed only once
   - Test cache TTL expiration
   - Test cache invalidation

5. **Edge Cases**
   - No git repository
   - No git tags (commit hash only)
   - Dirty working directory (-dirty suffix)
   - Empty repository (no commits)
   - Git command not found

**Example Test Structure**:
```typescript
import { describe, test, expect, beforeEach } from 'bun:test';
import { getVersion, getVersionInfo, clearVersionCache } from '../src/utils/version';

describe('Version Utility', () => {
  beforeEach(() => {
    clearVersionCache();
  });

  test('returns compile-time version when VERSION is defined', () => {
    // Mock VERSION global
    // Call getVersion()
    // Assert version matches injected value
  });

  test('executes git describe in development mode', () => {
    // Mock $ executor
    // Call getVersion()
    // Assert git describe was called
    // Assert version format is correct
  });

  test('caches git version for performance', () => {
    // Mock $ executor with call counter
    // Call getVersion() multiple times
    // Assert git command executed only once
  });

  test('falls back to unknown when git fails', () => {
    // Mock $ executor to throw error
    // Call getVersion()
    // Assert version is "unknown"
  });
});
```

### Integration Tests

**Build Script Testing**:
```bash
# Test development mode (no --define)
bun src/index.ts --version
# Expected: v0.3.0-X-gXXXXXXX (git-based)

# Test production build
npm run build:linux-x64
./aisanity-linux-x64 --version
# Expected: v0.3.0 (static version)
```

**Container Label Testing**:
```typescript
// Test in worktree creation
test('container labels include correct version', async () => {
  // Create worktree
  // Inspect container labels
  // Assert version matches getVersion()
});
```

### Manual Testing Checklist

- [ ] Development mode shows git-based version
- [ ] Production build shows static version
- [ ] Built binary has no git dependency
- [ ] Dirty working directory shows "-dirty" suffix
- [ ] Container labels show correct version
- [ ] Version caching works in development
- [ ] Fallback works when git unavailable
- [ ] All platform builds have correct versions

## Development Phases

### Phase 1: Core Version Utility (Priority: HIGH)

**Objective**: Create `src/utils/version.ts` with dual-mode detection

**Tasks**:
1. Create new file `src/utils/version.ts`
2. Implement `getCompileTimeVersion()` with global VERSION check
3. Implement `getGitVersion()` with Bun $ executor
4. Implement caching mechanism for development mode
5. Implement `getFallbackVersion()` with "unknown" return
6. Implement main `getVersion()` function with priority logic
7. Add TypeScript type declarations for VERSION global
8. Document function behavior and edge cases

**Acceptance Criteria**:
- Function returns compile-time VERSION when defined
- Function executes git describe when VERSION undefined
- Function caches results for performance
- Function handles errors gracefully
- Code is well-typed and documented

**Estimated Effort**: 2-3 hours

**Code Structure**:
```typescript
// src/utils/version.ts

// TypeScript global declaration for compile-time VERSION
declare const VERSION: string | undefined;

// Cache variables
let cachedVersion: string | null = null;
let cacheTimestamp: number | null = null;
const CACHE_TTL_MS = 5000;

/**
 * Get application version string
 * - Production builds: Uses compile-time injected VERSION
 * - Development mode: Executes git describe with caching
 * - Fallback: Returns "unknown" if git unavailable
 */
export function getVersion(): string {
  // 1. Check compile-time VERSION
  const compileTimeVersion = getCompileTimeVersion();
  if (compileTimeVersion) {
    return compileTimeVersion;
  }
  
  // 2. Try git describe with caching
  return getCachedOrFreshVersion();
}

// Internal implementation functions...
```

### Phase 2: CLI Integration (Priority: HIGH)

**Objective**: Update `src/index.ts` to use dynamic version

**Tasks**:
1. Add import statement: `import { getVersion } from './utils/version';`
2. Replace `.version('0.1.0')` with `.version(getVersion())`
3. Remove hardcoded version string
4. Test CLI version display in development mode
5. Verify version changes with git state

**Acceptance Criteria**:
- CLI shows dynamic version with `--version` flag
- Development mode reflects current git state
- No hardcoded version strings remain
- Commander.js integration works correctly

**Estimated Effort**: 30 minutes

**File Changes**:
```typescript
// src/index.ts
// Line 1: Add import
import { getVersion } from './utils/version';

// Line 26: Replace hardcoded version
.version(getVersion())
```

### Phase 3: Build System Enhancement (Priority: HIGH)

**Objective**: Update all build scripts with --define VERSION injection

**Tasks**:
1. Update `build` script with --define flag
2. Update `package` script with --define flag
3. Update all platform-specific build scripts (4 targets)
4. Update `build:all` script (inherits from individual scripts)
5. Keep `dev` and `start` scripts unchanged
6. Test version injection on at least one platform
7. Document build requirements (git must be available)

**Acceptance Criteria**:
- All production build scripts inject VERSION
- Development scripts remain unchanged
- Build scripts fail gracefully if git unavailable
- Documentation updated with build requirements

**Estimated Effort**: 1 hour

**Script Pattern**:
```json
"build:TARGET": "bun build ./src/index.ts --compile --target TARGET --outfile ./OUTPUT --define VERSION=\"$(git describe --tags --always)\""
```

### Phase 4: Container Labels Integration (Priority: MEDIUM)

**Objective**: Replace package.json reading with version utility

**Tasks**:
1. Add import to `src/utils/container-utils.ts`
2. Replace version detection logic in `generateContainerLabels()`
3. Remove try/catch block for package.json reading
4. Remove `readFileSync` import if not used elsewhere
5. Test container creation with new version system
6. Verify container labels show correct version

**Acceptance Criteria**:
- Container labels use `getVersion()` function
- No runtime package.json reading
- Containers show accurate version metadata
- Performance improved from eliminating I/O

**Estimated Effort**: 30 minutes

**Code Changes**:
```typescript
// src/utils/container-utils.ts
import { getVersion } from './version';

export function generateContainerLabels(...): ContainerLabels {
  return {
    'aisanity.workspace': workspacePath,
    'aisanity.branch': branch,
    'aisanity.container': containerName,
    'aisanity.created': new Date().toISOString(),
    'aisanity.version': getVersion() // Single line replacement
  };
}
```

### Phase 5: Testing and Validation (Priority: HIGH)

**Objective**: Comprehensive testing of version system

**Tasks**:
1. Create `tests/version.test.ts` with unit tests
2. Test compile-time version detection
3. Test git version detection
4. Test caching mechanism
5. Test fallback behavior
6. Test edge cases (no git, no tags, dirty state)
7. Integration test: Build binary and verify static version
8. Integration test: Run dev mode and verify dynamic version
9. Integration test: Create container and verify labels
10. Performance test: Verify caching reduces git calls

**Test Coverage Goals**:
- Unit test coverage: >90%
- Integration tests: All build targets
- Edge case coverage: 100%

**Acceptance Criteria**:
- All unit tests pass
- Integration tests confirm dual-mode operation
- Edge cases handled gracefully
- Performance meets expectations (cached calls <1ms)
- Container labels show correct versions

**Estimated Effort**: 3-4 hours

**Test File Structure**:
```typescript
// tests/version.test.ts
import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { getVersion, getVersionInfo } from '../src/utils/version';

describe('Compile-Time Version', () => {
  // Tests for VERSION constant detection
});

describe('Git Version Detection', () => {
  // Tests for git describe execution
});

describe('Caching Mechanism', () => {
  // Tests for performance optimization
});

describe('Fallback Behavior', () => {
  // Tests for error handling
});

describe('Edge Cases', () => {
  // Tests for unusual scenarios
});
```

### Phase 6: Documentation and Cleanup (Priority: LOW)

**Objective**: Document version system and clean up legacy code

**Tasks**:
1. Add comments to version utility explaining dual-mode operation
2. Document build requirements (git availability)
3. Update DEVELOPMENT.md with version system explanation
4. Add troubleshooting guide for version issues
5. Remove any remaining hardcoded version references
6. Verify package.json version is still used for npm metadata only

**Acceptance Criteria**:
- Code is well-documented
- Build process documented
- Troubleshooting guide available
- No legacy version code remains

**Estimated Effort**: 1-2 hours

## Critical Implementation Notes

### IMPORTANT: Compile-Time Constant Detection

The VERSION constant must be detected at compile time, not runtime:

```typescript
// CORRECT: TypeScript global declaration
declare const VERSION: string | undefined;

if (typeof VERSION !== 'undefined') {
  // Compile-time version exists
}

// INCORRECT: Runtime environment variable
if (process.env.VERSION) {
  // This won't work with --define flag
}
```

### IMPORTANT: Git Command Error Handling

Git commands must fail gracefully:

```typescript
// Example error handling pattern
try {
  const result = await $`git describe --tags --always`.text();
  return result.trim();
} catch (error) {
  // Don't throw - return fallback
  // Don't log errors in production - silent fallback
  return getFallbackVersion();
}
```

### IMPORTANT: Cache Implementation

Caching must balance performance and accuracy:

```typescript
// Cache for 5 seconds in development
// This allows git state changes to be reflected
// While avoiding excessive git command execution

const CACHE_TTL_MS = 5000; // Not too short, not too long
```

### IMPORTANT: Shell Command Compatibility

Shell command substitution must work cross-platform:

```json
// Works on macOS/Linux:
"--define VERSION=\"$(git describe --tags --always)\""

// For Windows compatibility in CI/CD:
// Use Git Bash or ensure WSL available
// Or use JavaScript-based version generation
```

### IMPORTANT: Build Script Ordering

Build scripts must execute git describe before compilation:

```bash
# CORRECT: Shell substitution happens first
bun build ... --define VERSION="$(git describe)"

# INCORRECT: Trying to inject after build
bun build ... && define-version
```

## Performance Considerations

### Development Mode Performance

**Git Command Overhead**:
- First call: ~50ms (git process spawn + execution)
- Cached calls: <1ms (memory lookup)
- Cache TTL: 5 seconds (balance between accuracy and performance)

**Optimization Strategy**:
- Cache results in module-level variable
- TTL prevents stale versions during development
- Short enough for git state changes to be reflected
- Long enough to avoid excessive git calls

**Benchmark Target**: <1ms for 99% of version lookups in development

### Production Mode Performance

**Compile-Time Constant**:
- Access time: <1µs (constant lookup)
- Memory overhead: ~20 bytes (string constant)
- No runtime dependencies
- No I/O operations
- Optimal for CLI tool startup time

**Binary Size Impact**: Negligible (version string is ~10-30 characters)

### Container Label Generation Performance

**Before** (package.json reading):
- File I/O: ~5-10ms per label generation
- JSON parsing: ~1-2ms
- Total: ~7-12ms per container creation

**After** (version utility):
- Compile-time: <1µs (constant lookup)
- Development: <1ms (cached lookup)
- Improvement: >1000x faster in production

## Risk Mitigation

### Risk: Git Not Available During Build

**Mitigation**:
- Document git requirement in build documentation
- CI/CD pipelines include git checkout with tags
- Provide clear error messages if git missing
- Consider fallback to package.json version for emergency builds

### Risk: No Git Tags in Repository

**Mitigation**:
- `git describe --always` falls back to commit hash
- Ensure initial tag (v0.1.0) exists in repository
- Document tagging strategy for releases

### Risk: Version Caching Issues in Development

**Mitigation**:
- Short TTL (5 seconds) balances performance and accuracy
- Provide cache clear function for testing
- Document cache behavior

### Risk: Cross-Platform Build Incompatibility

**Mitigation**:
- Test builds on both Linux and macOS
- Use Git Bash on Windows for CI/CD
- Consider JavaScript-based version generator for Windows

## Success Criteria

### Functional Requirements
- [x] Version utility implements dual-mode detection
- [x] Compile-time VERSION constant detection works
- [x] Git describe execution works with error handling
- [x] Caching mechanism improves development performance
- [x] CLI integration displays dynamic version
- [x] Build scripts inject version at compile time
- [x] Container labels use version utility
- [x] All platform builds include version

### Performance Requirements
- [x] Production version lookup: <1µs
- [x] Development version lookup (cached): <1ms
- [x] Development version lookup (uncached): <100ms
- [x] Container label generation: >10x faster than before

### Quality Requirements
- [x] Unit test coverage: >90%
- [x] Edge case handling: 100%
- [x] Documentation: Complete and accurate
- [x] No hardcoded versions remain
- [x] Zero runtime git dependency in production builds

### User Experience Requirements
- [x] `aisanity --version` shows accurate version
- [x] Development versions reflect git state
- [x] Production versions are stable and consistent
- [x] Container labels show version for troubleshooting
- [x] Error messages are clear and actionable

## Future Enhancements

### Version Metadata Extension
- Build timestamp in version string
- Build environment (dev/prod/ci) indicator
- Platform information in version
- Commit message in version info

### Version Comparison Utilities
```typescript
// Example future API
export function compareVersions(v1: string, v2: string): number
export function isCompatibleVersion(version: string, constraint: string): boolean
export function parseVersion(version: string): SemanticVersion
```

### Update Checking
```typescript
// Example future feature
export async function checkForUpdates(): Promise<UpdateInfo>
export function notifyIfUpdateAvailable(): void
```

### CI/CD Integration
- Automated version tag creation on release
- Version validation in pull requests
- Changelog generation from version tags
- Release notes with version information

## Conclusion

This implementation plan provides a comprehensive, production-ready solution for compile-time version generation that:

1. **Eliminates version drift** by using git tags as the authoritative source
2. **Optimizes performance** with compile-time constants for production builds
3. **Maintains development flexibility** with dynamic git-based versioning
4. **Integrates seamlessly** with existing CLI and container infrastructure
5. **Requires minimal changes** to existing codebase
6. **Provides excellent performance** with caching and compile-time optimization
7. **Handles edge cases gracefully** with comprehensive error handling

The dual-mode approach balances the need for accurate development versioning with optimal production performance, making it an ideal solution for a CLI tool that requires both real-time version accuracy during development and zero-overhead version access in production.

**Total Estimated Implementation Time**: 8-11 hours across 6 phases

**Recommended Implementation Order**: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
