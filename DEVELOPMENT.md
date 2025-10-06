# Development Guidelines

## Development Environment Setup

This document contains guidelines for setting up and using the Aisanity development environment with Bun runtime support.

## Getting Started

### Prerequisites

- **Bun >= 1.0.0** (recommended for optimal performance)
- **Node.js >= 22.x** (for compatibility testing)
- **Docker** (for container operations)
- **Devcontainers CLI** (`npm install -g @devcontainers/cli`)

### Development Setup

1. **Install Bun runtime** (recommended):
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Clone and setup the project**:
   ```bash
   git clone <repository-url>
   cd aisanity
   bun install
   ```

3. **Verify development environment**:
   ```bash
   bun run dev --help
   bun test
   ```

### Development Commands

```bash
# Development with hot reload
bun run dev

# Run tests
bun test

# Run tests with coverage
bun run test:coverage

# Build project
bun run build

# Create single binary
bun run package

# Lint code
bun run lint
```

### Dual Runtime Testing

Test compatibility with both runtimes:

```bash
# Test with Bun (primary)
bun test

# Test with Node.js (compatibility)
npm test

# Runtime-specific tests
bun test tests/runtime-compatibility.test.ts
```

## Aisanity Usage

1. Initialize your workspace: `aisanity init`
2. Start development: `aisanity run`
3. Check status: `aisanity status`
4. Stop containers: `aisanity stop`

## Architecture Overview

### Runtime Layer
- **Runtime Detection**: Automatic detection of Bun vs Node.js
- **API Selection**: Optimal API selection based on available runtime
- **Fallback Support**: Graceful degradation to Node.js when needed

### Process Management
- **Docker Integration**: Enhanced with Bun.spawn and AbortController
- **Shell Commands**: Cross-platform execution with Bun.$ fallback
- **Error Handling**: Runtime context in error messages

### Testing Framework
- **Bun Test Runner**: Native TypeScript support, faster execution
- **Dual Runtime Testing**: CI/CD matrix testing on both runtimes
- **Performance Benchmarks**: Automated performance validation

## Best Practices

### Development Workflow
- Use Bun for primary development (4x faster startup)
- Test on both runtimes before submitting PRs
- Use `bun run dev` for hot reload during development
- Run `bun test` frequently for fast feedback

### Code Quality
- Use TypeScript strict mode (enabled)
- Follow existing code style and naming conventions
- Add runtime compatibility tests for new features
- Document any runtime-specific behavior

### Performance Optimization
- Leverage Bun's native TypeScript support
- Use Bun.spawn for Docker operations when available
- Implement AbortController for timeout handling
- Profile performance improvements regularly

### Testing Strategy
- Write tests that work on both runtimes
- Include performance benchmarks for critical paths
- Test Docker integration thoroughly
- Verify error handling consistency

## Runtime-Specific Features

### Bun Enhancements
- **Native TypeScript**: No transpilation required
- **Enhanced Spawn**: Better performance and error handling
- **Shell Helper**: Built-in shell command execution
- **Single Binary**: Compile to standalone executable

### Node.js Compatibility
- **Fallback Support**: All features work on Node.js
- **API Compatibility**: Identical function signatures
- **Error Consistency**: Same error types and messages
- **Performance Baseline**: Maintains original performance

## Troubleshooting

### Common Development Issues

#### Bun Installation
```bash
# If Bun commands fail, try:
bun pm cache rm
bun install
```

#### TypeScript Errors
```bash
# Check TypeScript configuration:
bun run build

# Verify types are installed:
bun add -d @types/bun
```

#### Test Failures
```bash
# Run specific test file:
bun test tests/docker-integration.test.ts

# Debug with verbose output:
bun test --verbose
```

### Performance Debugging

#### Measure Startup Time
```bash
# Compare runtimes:
time bun src/index.ts --help
time node dist/index.js --help
```

#### Profile Test Execution
```bash
# Bun profiling:
bun test --profile

# Jest comparison:
time npm test
```

## Contributing

### Pull Request Process
1. Fork the repository
2. Create feature branch
3. Test on both Bun and Node.js
4. Update documentation
5. Submit PR with dual runtime test results

### Code Review Checklist
- [ ] Tests pass on both runtimes
- [ ] No performance regressions
- [ ] Documentation updated
- [ ] Error handling consistent
- [ ] TypeScript strict compliance

## Release Process

### Pre-release Testing
- Dual runtime compatibility verification
- Performance benchmarking
- Integration testing with Docker
- Documentation validation

### Release Steps
1. Update version numbers
2. Build with both runtimes
3. Create release artifacts
4. Update documentation
5. Deploy to package registries

## Additional Resources

- [Bun Documentation](https://bun.sh/docs)
- [Migration Guide](./MIGRATION.md)
- [API Reference](./README.md)
- [GitHub Issues](https://github.com/your-username/aisanity/issues)
