# Task 190: Fix Docker Integration Timeouts

## Description
Based on CI failures showing Docker integration tests timing out on GitHub Actions ubuntu-latest. Tests are failing with "beforeEach/afterEach hook timed out for this test" after pulling alpine:latest image and taking 11+ seconds total, which exceeds Bun's default 5-second test timeout. Local execution works fine (500-600ms) but CI environments have resource constraints and cold image caches.

## Problem Statement

Docker integration tests are consistently timing out in CI environments due to several performance bottlenecks:

1. **Image pull latency**: Tests pull `alpine:latest` on every run, taking 5-10 seconds in CI with cold cache
2. **Sequential cleanup**: `afterEach` hook stops and removes containers sequentially, adding 2-5 seconds
3. **Test timeout mismatch**: Bun's default 5-second timeout vs actual CI execution time of 11-15+ seconds
4. **Resource constraints**: CI environments have limited Docker resources compared to local development

Current failing behavior:
```
Unable to find image 'alpine:latest' locally
latest: Pulling from library/alpine
2d35ebdb57d9: Pulling fs layer
2d35ebdb57d9: Verifying Checksum
2d35ebdb57d9: Download complete
Status: Downloaded newer image for alpine:latest
(fail) Container Discovery Docker Integration > should discover containers from deleted worktrees [11759.06ms]
  ^ a beforeEach/afterEach hook timed out for this test.
```

## Requirements

1. **Pre-pull Docker images in CI**: Add GitHub Actions step to pull `alpine:latest` before test execution
2. **Optimize cleanup operations**: Implement parallel container cleanup to reduce sequential overhead
3. **Add conditional timeouts**: Use longer timeouts for CI environments while keeping reasonable local timeouts
4. **Maintain test functionality**: Preserve all existing test coverage and verification capabilities
5. **Environment-aware execution**: Optimize behavior differently for CI vs local environments
6. **Improve error handling**: Add timeouts to individual Docker commands to prevent hanging

## Expected Outcome

1. **Reliable CI execution**: Docker integration tests complete successfully on ubuntu-latest without timeouts
2. **Optimized performance**: Test execution time reduced from 11-15+ seconds to 5-7 seconds in CI
3. **Maintained coverage**: All Docker integration test scenarios continue to verify real container behavior
4. **Environment awareness**: Tests run efficiently both locally (fast) and in CI (reliable)
5. **Better cleanup**: Container cleanup completes quickly without hanging test hooks

Expected CI performance:
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| First test | 11-15s (timeout) | 5-7s | ✅ -6 to -8s |
| Subsequent | 5-8s | 3-5s | ✅ -2 to -3s |
| Cleanup | 3-5s | 1-2s | ✅ -2 to -3s |
| CI failure rate | 20-30% | <5% | ✅ -15 to -25% |

## Additional Suggestions and Ideas

- Consider using a lighter Docker image than alpine for faster pulls (like `scratch` or `busybox`)
- Think about implementing Docker image caching strategy in CI workflow
- Consider adding test isolation to prevent container name conflicts in parallel execution
- Think about adding performance monitoring to track test execution times across environments
- Consider implementing a Docker-in-Docker setup for more consistent CI behavior
- Think about adding retry logic for Docker operations that may fail due to resource constraints
- Consider adding test data collection to identify performance bottlenecks
- Think about implementing test parallelization where possible to reduce overall execution time

## Other Important Agreements

- **Maintain real Docker testing**: Do not replace integration tests with mocks - they provide value for verifying actual Docker behavior
- **CI reliability over speed**: Prioritize tests passing consistently in CI over absolute fastest execution
- **Environment optimization**: Accept that CI and local environments may need different optimization strategies
- **Backward compatibility**: Ensure changes don't break existing test functionality or local development experience
- **Minimal CI complexity**: Prefer simple, reliable solutions over complex CI infrastructure changes
- **Test coverage preservation**: All existing test scenarios must continue to work and provide the same verification value
- **Performance monitoring**: Add visibility into test execution times to help identify future performance issues