# Architecture Plan: Fix Docker Integration Timeouts

## Context Analysis

### Problem Statement
Docker integration tests in `tests/container-discovery-docker-integration.test.ts` are consistently timing out in GitHub Actions CI environments (ubuntu-latest) due to performance bottlenecks that exceed Bun's default 5-second test timeout. While local execution performs well (500-600ms), CI environments face resource constraints and cold image caches.

### Current Architecture Challenges

1. **Image Pull Latency**: Tests pull `alpine:latest` on every run, taking 5-10 seconds in CI with cold cache
2. **Sequential Cleanup**: `afterEach` hook stops and removes containers sequentially, adding 2-5 seconds per test
3. **Test Timeout Mismatch**: Bun's default 5-second timeout vs actual CI execution time of 11-15+ seconds
4. **Resource Constraints**: CI environments have limited Docker resources compared to local development
5. **No Environment Awareness**: Tests run identically in local and CI without optimization for CI constraints

### Current Test Flow
```
beforeEach: Setup workspace + create containers (2-3s + 1-2s per container)
Test Execution: Discovery operations (1-2s)
afterEach: Sequential cleanup (1-2s per container)
Total CI Time: 11-15+ seconds (exceeds 5s timeout)
```

## Technology Recommendations

### 1. CI Environment Detection
**IMPORTANT**: Implement environment-aware execution to optimize behavior differently for CI vs local environments.

```typescript
const CI = process.env.CI === 'true';
const TEST_TIMEOUT = CI ? 20000 : 10000; // 20s CI, 10s local
```

### 2. Docker Image Pre-pulling Strategy
**IMPORTANT**: Add GitHub Actions step to pre-pull `alpine:latest` before test execution to eliminate cold cache latency.

### 3. Parallel Container Cleanup
**IMPORTANT**: Replace sequential cleanup with parallel operations to reduce hook execution time.

### 4. Conditional Timeout Configuration
**IMPORTANT**: Use longer timeouts for CI environments while maintaining reasonable local timeouts.

### 5. Enhanced Error Handling
Add timeout guards to individual Docker commands to prevent hanging and provide better error messages.

## System Architecture

### Enhanced Test Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CI Environment Detection                 │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │   Local Mode    │    │     CI Mode     │                 │
│  │ 10s timeout     │    │ 20s timeout     │                 │
│  │ Fast cleanup    │    │ Optimized       │                 │
│  └─────────────────┘    └─────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Docker Test Execution Flow                  │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Setup     │───▶│    Test     │───▶│  Cleanup    │     │
│  │             │    │             │    │             │     │
│  │ • Workspace │    │ • Discovery │    │ • Parallel  │     │
│  │ • Git init  │    │ • Validation│    │ • Timeout   │     │
│  │ • Container │    │ • Verification│ │ • Force rm   │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### CI Pipeline Integration

```
┌─────────────────────────────────────────────────────────────┐
│                Enhanced CI Pipeline Flow                    │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Setup     │───▶│ Pre-pull    │───▶│    Tests    │     │
│  │             │    │ Images      │    │             │     │
│  │ • Checkout  │    │ • alpine    │    │ • 20s timeout│     │
│  │ • Bun setup │    │ • Cache warm │    │ • Parallel   │     │
│  │ • Install   │    │ • Verify     │    │ • Optimized  │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Integration Patterns

### 1. Environment-Aware Test Configuration
```typescript
// Centralized environment detection
const TEST_CONFIG = {
  isCI: process.env.CI === 'true',
  timeout: process.env.CI === 'true' ? 20000 : 10000,
  cleanupTimeout: process.env.CI === 'true' ? 15000 : 8000,
  parallelCleanup: true
};
```

### 2. Parallel Cleanup Pattern
```typescript
// Parallel container cleanup with timeout protection
async function parallelCleanup(containers: string[]): Promise<void> {
  const cleanupPromises = containers.map(async (containerId) => {
    try {
      await Promise.all([
        executeDockerCommand(`docker stop ${containerId}`, { 
          silent: true, 
          timeout: 5000 
        })
      ]).then(() => 
        executeDockerCommand(`docker rm -f ${containerId}`, { 
          silent: true, 
          timeout: 3000 
        })
      );
    } catch (error) {
      console.warn(`⚠️  Failed to cleanup ${containerId}`);
    }
  });
  
  await Promise.race([
    Promise.all(cleanupPromises),
    new Promise(resolve => setTimeout(resolve, TEST_CONFIG.cleanupTimeout))
  ]);
}
```

### 3. CI Pre-pull Integration
```yaml
# GitHub Actions workflow enhancement
- name: Pre-pull Docker images for tests
  if: matrix.os == 'ubuntu-latest'
  run: |
    echo "Pre-pulling alpine:latest for Docker integration tests..."
    docker pull alpine:latest || echo "Pre-pull failed, tests will pull on-demand"
    docker images alpine
  continue-on-error: true
```

### 4. Timeout Guard Pattern
```typescript
// Enhanced Docker command execution with timeout awareness
export async function executeDockerCommandWithTimeout(
  command: string,
  options?: {
    silent?: boolean;
    timeout?: number;
    context?: string;
  }
): Promise<{ stdout: string; stderr: string; success: boolean }> {
  const timeout = options?.timeout || (TEST_CONFIG.isCI ? 8000 : 5000);
  const context = options?.context || 'Docker operation';
  
  return Promise.race([
    executeDockerCommand(command, { ...options, timeout }),
    new Promise<{ stdout: string; stderr: string; success: false }>((resolve) => 
      setTimeout(() => {
        resolve({
          stdout: '',
          stderr: `${context} timed out after ${timeout}ms`,
          success: false
        });
      }, timeout)
    )
  ]);
}
```

## Implementation Guidance

### Phase 1: CI Environment Optimization (Priority: HIGH)

1. **Add Pre-pull Step to CI Workflow**
   - Target: `.github/workflows/ci.yml`
   - Add conditional pre-pull for ubuntu-latest
   - Include error handling and continue-on-error
   - Expected impact: -5 to -10 seconds on first test

2. **Implement Environment Detection**
   - Add CI detection constants to test file
   - Configure conditional timeouts
   - Expected impact: Safety net for slower CI runs

### Phase 2: Test Cleanup Optimization (Priority: HIGH)

1. **Replace Sequential Cleanup with Parallel Operations**
   - Modify `afterEach` hook in test file
   - Implement parallel container stopping and removal
   - Add timeout protection for cleanup operations
   - Expected impact: -2 to -5 seconds on cleanup

2. **Enhance Error Handling**
   - Add timeout guards to Docker commands
   - Implement graceful degradation for cleanup failures
   - Add logging for debugging slow operations

### Phase 3: Monitoring and Validation (Priority: MEDIUM)

1. **Add Performance Monitoring**
   - Log timing metrics for test phases
   - Track cleanup success rates
   - Monitor CI execution patterns

2. **Implement Cleanup Verification**
   - Add CI step to remove dangling containers
   - Verify no orphaned containers remain
   - Add test validation for cleanup completeness

### Critical Implementation Decisions

**IMPORTANT**: Maintain real Docker testing approach
- Do not replace integration tests with mocks
- Preserve all existing test coverage and verification capabilities
- Focus on optimization rather than avoidance

**IMPORTANT**: Environment-specific optimization
- Accept that CI and local environments need different strategies
- Prioritize CI reliability over absolute fastest execution
- Use conditional configuration rather than one-size-fits-all

**IMPORTANT**: Backward compatibility
- Ensure changes don't break existing test functionality
- Maintain local development experience
- Preserve existing test scenarios and verification value

### Expected Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| First test (cold) | 11-15s (timeout) | 5-7s | ✅ -6 to -8s |
| Subsequent tests | 5-8s | 3-5s | ✅ -2 to -3s |
| Cleanup time | 3-5s | 1-2s | ✅ -2 to -3s |
| CI failure rate | 20-30% | <5% | ✅ -15 to -25% |
| Total suite time | Timeout | 15-20s | ✅ Reliable |

### Risk Mitigation Strategies

1. **Pre-pull Failure Handling**
   - Use `continue-on-error` in CI step
   - Graceful fallback to on-demand pulling
   - Clear logging for debugging

2. **Cleanup Timeout Protection**
   - Use `docker rm -f` for force removal
   - Add CI cleanup step for orphaned containers
   - Implement timeout race conditions

3. **Environment Detection Robustness**
   - Use multiple CI detection methods
   - Provide sensible defaults
   - Allow manual override via environment variables

### Success Criteria

1. **Reliability**: CI tests pass consistently (>95% success rate)
2. **Performance**: Test execution time reduced to 5-7 seconds in CI
3. **Coverage**: All Docker integration test scenarios continue to verify real container behavior
4. **Maintainability**: Solution is easy to understand and modify
5. **Compatibility**: Local development experience remains fast and efficient

This architectural plan provides a comprehensive solution to Docker integration timeout issues while maintaining test coverage, reliability, and development experience across both CI and local environments.