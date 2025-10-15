# Architecture Plan: Compile-Time Version Generation

## Context Analysis

The current aisanity CLI tool has a version management problem where the version is hardcoded as '0.1.0' in `src/index.ts` while the actual git tag is v0.3.0, creating version drift. The existing implementation also uses runtime package.json reading in `src/utils/container-utils.ts` for container labeling, which adds unnecessary I/O overhead.

The task requires implementing a dual-mode versioning strategy:
- **Development mode**: Dynamic version detection from git tags for real-time feedback
- **Production mode**: Static compile-time version injection for optimal performance

This approach eliminates manual version management, provides accurate git-based versioning, and ensures zero runtime git dependency for built binaries.

## Technology Recommendations

### Core Technologies
- **Bun --define flag**: Compile-time constant injection for optimal performance
- **git describe --tags --always**: Git-based version generation as source of truth
- **TypeScript**: Type-safe version handling and dual-mode detection
- **Commander.js**: Integration with existing CLI framework

### Version Generation Strategy
- **Primary source**: `git describe --tags --always` for comprehensive version info
- **Fallback**: Commit hash when no tags exist
- **Development**: Runtime git calls with caching for performance
- **Production**: Compile-time constants with zero runtime dependency

### Integration Points
- **CLI version**: Commander.js `.version()` method
- **Container labels**: Replace package.json runtime reading
- **Build scripts**: Enhanced npm scripts with version injection
- **Cross-platform builds**: Consistent versioning across all targets

## System Architecture

### Version Utility Module (`src/utils/version.ts`)

```typescript
// Architecture: Dual-mode version detection
interface VersionInfo {
  version: string;
  isProduction: boolean;
  source: 'git' | 'compile-time' | 'fallback';
}

// Core strategy:
// 1. Check for compile-time VERSION constant (production)
// 2. Fall back to git describe (development)
// 3. Provide fallback for edge cases
```

### Build System Integration

**IMPORTANT**: The build system must be enhanced to support version injection:

```json
{
  "scripts": {
    "build": "bun build ./src/index.ts --outdir ./dist --target bun --define VERSION=\"$(git describe --tags --always)\"",
    "package": "bun build ./src/index.ts --compile --outfile ./dist/aisanity --define VERSION=\"$(git describe --tags --always)\"",
    "build:linux-x64": "bun build ./src/index.ts --compile --target bun-linux-x64 --outfile ./aisanity-linux-x64 --define VERSION=\"$(git describe --tags --always)\"",
    "build:darwin-arm64": "bun build ./src/index.ts --compile --target bun-darwin-arm64 --outfile ./aisanity-darwin-arm64 --define VERSION=\"$(git describe --tags --always)\""
  }
}
```

### Version Detection Flow

1. **Production Build Path**:
   - Build script runs `git describe --tags --always`
   - Version injected via `--define VERSION="v0.3.0-1-g346feec"`
   - Runtime uses compile-time constant directly
   - Zero git dependency in final binary

2. **Development Path**:
   - No VERSION constant defined at compile time
   - Runtime calls `git describe --tags --always` with caching
   - Dynamic version updates on each git operation
   - Performance optimized with result caching

3. **Edge Case Handling**:
   - No git repository: fallback to "unknown"
   - No git tags: fallback to commit hash
   - Git command failure: graceful degradation
   - Dirty working directory: automatic "-dirty" suffix

## Integration Patterns

### 1. CLI Integration Pattern
```typescript
// src/index.ts - Replace hardcoded version
import { getVersion } from './utils/version';

const program = new Command();
program.version(getVersion()); // Dynamic version detection
```

### 2. Container Label Integration Pattern
```typescript
// src/utils/container-utils.ts - Replace package.json reading
import { getVersion } from './version';

// Replace runtime package.json reading with version utility
'aisanity.version': getVersion()
```

### 3. Build Script Pattern
```bash
# Pattern for all build scripts
--define VERSION="$(git describe --tags --always)"
```

### 4. Development Mode Pattern
```typescript
// src/utils/version.ts - Development mode with caching
let cachedVersion: string | null = null;

function getGitVersion(): string {
  if (cachedVersion) return cachedVersion;
  
  // Execute git describe with error handling
  // Cache result for performance
  // Return formatted version string
}
```

## Implementation Guidance

### Phase 1: Core Version Utility
1. **Create `src/utils/version.ts`** with dual-mode detection
2. **Implement compile-time constant detection** using global VERSION
3. **Add git describe execution** with proper error handling
4. **Include caching mechanism** for development performance
5. **Handle edge cases** (no git, no tags, command failures)

### Phase 2: CLI Integration
1. **Update `src/index.ts`** to use dynamic version
2. **Remove hardcoded '0.1.0'** from Commander initialization
3. **Test version display** in development mode
4. **Verify version accuracy** with different git states

### Phase 3: Build System Enhancement
1. **Update package.json scripts** with --define VERSION injection
2. **Modify all build targets** (linux, darwin, cross-platform)
3. **Test production builds** for static version injection
4. **Verify zero git dependency** in compiled binaries

### Phase 4: Container Integration
1. **Update `src/utils/container-utils.ts`** to use version utility
2. **Remove package.json runtime reading** logic
3. **Test container labeling** with new version system
4. **Verify performance improvement** from eliminating I/O

### Phase 5: Testing and Validation
1. **Test development mode** with various git states
2. **Test production builds** across all platforms
3. **Validate version format** consistency
4. **Performance testing** for both modes
5. **Edge case testing** (no git, corrupted repo, etc.)

## Critical Decisions

### IMPORTANT: Git as Source of Truth
- **Decision**: Use `git describe --tags --always` as the authoritative version source
- **Rationale**: Eliminates manual version management and provides accurate development context
- **Impact**: Requires git repository for development, but production builds are self-contained

### IMPORTANT: Compile-Time vs Runtime Strategy
- **Decision**: Dual-mode approach with compile-time injection for production
- **Rationale**: Optimal performance for CLI tool while maintaining development flexibility
- **Impact**: Build system complexity increases, but runtime performance improves significantly

### IMPORTANT: No Package.json Fallback
- **Decision**: Avoid package.json version as fallback mechanism
- **Rationale**: Prevents version drift and maintains single source of truth
- **Impact**: Requires proper error handling for edge cases

## Performance Considerations

### Development Mode Optimizations
- **Result caching**: Cache git describe results to avoid repeated calls
- **Lazy evaluation**: Only compute version when actually requested
- **Error handling**: Fast fallbacks for git command failures

### Production Mode Optimizations
- **Compile-time constants**: Zero runtime overhead for version access
- **Binary size**: No git dependency reduces final executable size
- **Startup time**: Eliminated I/O operations improve CLI responsiveness

### Memory Usage
- **Minimal footprint**: Version utility is lightweight and stateless
- **Efficient caching**: Single cached string in development mode
- **No external dependencies**: Pure TypeScript implementation

## Security Considerations

### Git Command Execution
- **Command injection prevention**: Use proper argument escaping
- **Path validation**: Ensure git commands execute in expected directory
- **Error handling**: Prevent information leakage through error messages

### Build Process Security
- **Version injection**: Validate git describe output before injection
- **Build reproducibility**: Ensure consistent version generation across environments
- **Dependency isolation**: Version utility has minimal external dependencies

## Future Extensibility

### Version Metadata
- **Build timestamps**: Potential addition of build time information
- **Environment info**: Development vs production environment indicators
- **Platform information**: Target platform details in version strings

### Version Comparison
- **Semantic versioning**: Utilities for version comparison and constraints
- **Update checking**: Framework for checking newer versions
- **Compatibility matrices**: Version compatibility with different features

### Integration Points
- **CI/CD pipelines**: Enhanced version generation for automated builds
- **Release management**: Automated version tagging and release workflows
- **Documentation generation**: Version-aware documentation systems

This architecture provides a robust, performant, and maintainable solution for compile-time version generation while addressing the current version drift issues and eliminating manual version management overhead.