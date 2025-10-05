# Implementation Plan: Cross-Platform Executable Build System

**Task ID:** 10  
**Created:** 2025-10-05  
**Status:** Implementation Planning Complete

---

## Implementation Overview

This implementation plan builds upon the architectural foundation to create a cross-platform executable build system using `@yao-pkg/pkg`. The system will produce standalone executables for macOS arm64, Linux x64, and Windows x64 that bundle Node.js runtime and all dependencies, enabling users to download and run Aisanity without Node.js installation.

**Key Architectural Guidelines Followed:**
- Use `@yao-pkg/pkg` fork for active maintenance
- Maintain dual distribution (npm package + standalone executables)
- GitHub Actions matrix builds for cross-platform compilation
- Explicit asset bundling configuration
- Path compatibility for both Node.js and packaged environments
- Security-first approach with checksum verification

---

## Component Details

### 1. Build System Components

#### Package Configuration (`package.json`)
- **New devDependency**: `@yao-pkg/pkg` (pinned version)
- **pkg Configuration Section**: Defines scripts, assets, and targets
- **npm Scripts**: `package`, `package:macos`, `package:linux`, `package:windows`

#### Build Pipeline
- **Input**: TypeScript source files (`src/**/*.ts`)
- **Process**: TypeScript compilation → pkg packaging
- **Output**: Platform-specific executables in `dist/executables/`

#### GitHub Actions Workflow
- **Matrix Strategy**: Parallel builds for all platforms
- **Artifact Upload**: Executables and checksums
- **Release Automation**: Tag-based releases to GitHub Releases

### 2. File System Structure

```
dist/
├── index.js                 # Existing compiled JavaScript
├── commands/                # Existing command implementations
├── utils/                   # Existing utility modules
└── executables/             # NEW: Platform executables
    ├── aisanity-macos-arm64
    ├── aisanity-linux-x64
    └── aisanity-win-x64.exe
```

---

## Data Structures

### Package Configuration Schema

```typescript
interface PkgConfiguration {
  scripts: string[];          // JavaScript files to bundle
  assets: string[];           // Non-JS assets (YAML, templates, examples)
  targets: string[];          // Platform targets
  outputPath: string;         // Output directory
}
```

### Build Metadata

```typescript
interface BuildMetadata {
  platform: 'macos' | 'linux' | 'windows';
  architecture: 'arm64' | 'x64';
  nodeVersion: string;
  buildDate: string;
  checksum: string;
}
```

---

## API Design

### Package Scripts Interface

```json
{
  "scripts": {
    "package": "pkg . --targets node24-macos-arm64,node24-linux-x64,node24-win-x64 --out-path dist/executables",
    "package:macos": "pkg . --target node24-macos-arm64 --output dist/executables/aisanity-macos-arm64",
    "package:linux": "pkg . --target node24-linux-x64 --output dist/executables/aisanity-linux-x64",
    "package:windows": "pkg . --target node24-win-x64 --output dist/executables/aisanity-win-x64.exe"
  }
}
```

### GitHub Actions Workflow API

```yaml
jobs:
  package:
    strategy:
      matrix:
        platform: [macos-latest, ubuntu-latest, windows-latest]
        include:
          - platform: macos-latest
            target: node24-macos-arm64
            output: aisanity-macos-arm64
          - platform: ubuntu-latest
            target: node24-linux-x64
            output: aisanity-linux-x64
          - platform: windows-latest
            target: node24-win-x64
            output: aisanity-win-x64.exe
```

---

## User Interaction Flow

### Download and Installation

1. **User visits GitHub Releases page**
2. **Downloads platform-specific executable**
3. **Verifies checksum (optional but recommended)**
4. **Makes executable (Linux/macOS) or runs directly (Windows)**
5. **Runs command: `./aisanity-{platform}-{arch} --help`**

### Usage Examples

```bash
# macOS (Apple Silicon)
./aisanity-macos-arm64 init
./aisanity-macos-arm64 status

# Linux
./aisanity-linux-x64 run --workflow my-workflow

# Windows
.\aisanity-win-x64.exe worktree list
```

---

## Testing Strategy

### Unit Tests

**File**: `tests/executable-build.test.ts`

```typescript
describe('Executable Build System', () => {
  test('pkg configuration validation', () => {
    // Verify pkg config in package.json
  });
  
  test('asset bundling configuration', () => {
    // Verify all necessary assets are configured
  });
  
  test('path compatibility', () => {
    // Test __dirname and path.join patterns
  });
});
```

### Integration Tests

**Manual Testing Checklist**:
- [ ] macOS executable runs on Apple Silicon
- [ ] Linux executable runs on x64 Linux  
- [ ] Windows executable runs on x64 Windows
- [ ] All commands work in packaged environment
- [ ] Configuration files are accessible
- [ ] Asset files are bundled correctly
- [ ] Checksum verification works

### Platform Testing Matrix

| Platform | Architecture | Node.js | Status |
|----------|--------------|---------|--------|
| macOS | arm64 | 24 | ✅ Target |
| Linux | x64 | 24 | ✅ Target |
| Windows | x64 | 24 | ✅ Target |

---

## Development Phases

### Phase 1: Package Configuration (Priority 1)

1. **Add pkg dependency**
   ```bash
   npm install --save-dev @yao-pkg/pkg@5.8.1
   ```

2. **Configure package.json**
   - Add pkg configuration section
   - Define npm package scripts
   - Configure asset bundling

3. **Test local packaging**
   ```bash
   npm run build
   npm run package:macos
   ./dist/executables/aisanity-macos-arm64 --help
   ```

### Phase 2: Build Scripts (Priority 2)

4. **Implement all package scripts**
   - `package`: Build all platforms
   - Platform-specific scripts

5. **Path compatibility verification**
   - Test `__dirname` usage in packaged environment
   - Verify asset loading
   - Fix any path-related issues

### Phase 3: CI/CD Integration (Priority 3)

6. **Create GitHub Actions workflow**
   - Matrix build for all platforms
   - Artifact upload
   - Checksum generation

7. **Release automation**
   - Tag-based releases
   - GitHub Releases upload
   - Documentation updates

### Phase 4: Documentation (Priority 4)

8. **Installation instructions**
   - Platform-specific download guides
   - Checksum verification steps
   - Troubleshooting guide

---

## Dependencies

### Required Dependencies

```json
{
  "devDependencies": {
    "@yao-pkg/pkg": "5.8.1"
  }
}
```

### Existing Dependencies Used

- `typescript`: Source compilation
- `commander`: CLI framework
- `yaml`: Configuration processing
- All other existing project dependencies

### External Services

- **GitHub Actions**: CI/CD automation
- **GitHub Releases**: Distribution platform
- **npm Registry**: Dependency management

---

## Security Considerations

### Build Process Security

- **Dependency Pinning**: Fixed version for `@yao-pkg/pkg`
- **Checksum Verification**: SHA256 for all executables
- **Isolated Builds**: GitHub Actions isolated environments
- **Reproducible Builds**: Consistent configuration

### Distribution Security

- **GitHub Releases**: Trusted distribution platform
- **Checksum Files**: Users can verify download integrity
- **Clear Instructions**: Security best practices documentation

---

## Implementation Details

### Package.json Configuration

```json
{
  "scripts": {
    "package": "pkg . --targets node24-macos-arm64,node24-linux-x64,node24-win-x64 --out-path dist/executables",
    "package:macos": "pkg . --target node24-macos-arm64 --output dist/executables/aisanity-macos-arm64",
    "package:linux": "pkg . --target node24-linux-x64 --output dist/executables/aisanity-linux-x64",
    "package:windows": "pkg . --target node24-win-x64 --output dist/executables/aisanity-win-x64.exe"
  },
  "pkg": {
    "scripts": "dist/**/*.js",
    "assets": [
      "src/**/*.yaml",
      "src/**/*.yml",
      "examples/**/*",
      "templates/**/*"
    ],
    "targets": ["node24-macos-arm64", "node24-linux-x64", "node24-win-x64"],
    "outputPath": "dist/executables"
  }
}
```

### GitHub Actions Workflow

**File**: `.github/workflows/package.yml`

```yaml
name: Package Executables

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  test:
    uses: ./.github/workflows/ci.yml
    
  package:
    needs: test
    strategy:
      matrix:
        platform: [macos-latest, ubuntu-latest, windows-latest]
        include:
          - platform: macos-latest
            target: node24-macos-arm64
            output: aisanity-macos-arm64
          - platform: ubuntu-latest
            target: node24-linux-x64
            output: aisanity-linux-x64
          - platform: windows-latest
            target: node24-win-x64
            output: aisanity-win-x64.exe
    
    runs-on: ${{ matrix.platform }}
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: 'npm'
      
      - run: npm ci
      - run: npm run build
      - run: npm run pkg -- --target ${{ matrix.target }} --output dist/executables/${{ matrix.output }}
      
      - name: Generate checksum
        run: |
          cd dist/executables
          if [ "${{ matrix.platform }}" = "windows-latest" ]; then
            certutil -hashfile ${{ matrix.output }} SHA256 > ${{ matrix.output }}.sha256
          else
            shasum -a 256 ${{ matrix.output }} > ${{ matrix.output }}.sha256
          fi
      
      - uses: actions/upload-artifact@v4
        with:
          name: executable-${{ matrix.platform }}
          path: |
            dist/executables/${{ matrix.output }}
            dist/executables/${{ matrix.output }}.sha256

  release:
    needs: package
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/download-artifact@v4
        with:
          path: artifacts
      
      - name: Create release
        uses: softprops/action-gh-release@v1
        with:
          files: artifacts/**/*
```

---

## Success Criteria

### Functional Requirements

- [ ] macOS arm64 executable builds successfully
- [ ] Linux x64 executable builds successfully  
- [ ] Windows x64 executable builds successfully
- [ ] All executables run without Node.js installed
- [ ] All CLI commands work in packaged environment
- [ ] Asset files are accessible in packaged environment
- [ ] GitHub Actions workflow builds all platforms
- [ ] Releases include checksum verification

### Non-Functional Requirements

- [ ] Executable size < 50MB per platform
- [ ] Startup time < 500ms
- [ ] Build time < 5 minutes for all platforms
- [ ] No breaking changes to existing npm package
- [ ] Clear installation documentation

---

## Risk Mitigation

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| pkg fork becomes unmaintained | High | Medium | Monitor fork activity, have alternative tools ready |
| Platform compatibility issues | Medium | Low | Comprehensive testing on all target platforms |
| Asset bundling failures | Medium | Medium | Explicit configuration, thorough testing |
| Build performance issues | Low | Low | Parallel builds, caching strategies |

### Contingency Plans

- **Alternative Packaging Tools**: nexe, Node.js SEA if pkg becomes unavailable
- **Fallback Distribution**: Maintain npm package as primary if executables have issues
- **Manual Build Process**: Script-based manual builds if CI automation fails

---

## Future Enhancements

### Post-MVP Features

1. **Code Signing**: Digital signatures for macOS/Windows executables
2. **Auto-Updater**: Automatic update mechanism
3. **Additional Platforms**: ARM32, Linux ARM64 support
4. **Package Managers**: Homebrew, Chocolatey integration
5. **Performance Optimization**: Advanced compression techniques
6. **Security Scanning**: Automated malware scanning

---

## Conclusion

This implementation plan provides a comprehensive roadmap for creating a cross-platform executable build system that transforms Aisanity from a Node.js-dependent tool to a standalone application. The plan follows architectural guidelines while maintaining compatibility with existing functionality and ensuring a smooth user experience across all target platforms.

**Next Implementation Steps:**
1. Add `@yao-pkg/pkg` dependency to package.json
2. Configure pkg section with scripts and assets
3. Implement npm package scripts
4. Create GitHub Actions workflow
5. Test executables on all platforms
6. Document installation instructions

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-05  
**Implementation Planner**: AI Assistant (Claude)