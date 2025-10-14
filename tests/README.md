# Testing Guidelines for Aisanity

This document outlines best practices for writing and maintaining tests in the Aisanity project.

## Mock Management Rules

### 1. Always Store Mocks in Variables

❌ **Wrong:**
```typescript
beforeEach(() => {
  spyOn(fs, 'existsSync').mockReturnValue(true);
  spyOn(fs, 'readFileSync').mockReturnValue('data');
});
```

✅ **Correct:**
```typescript
let mockExistsSync: any;
let mockReadFileSync: any;

beforeEach(() => {
  mockExistsSync = spyOn(fs, 'existsSync').mockReturnValue(true);
  mockReadFileSync = spyOn(fs, 'readFileSync').mockReturnValue('data');
});
```

### 2. Always Restore Mocks in afterEach

❌ **Wrong:**
```typescript
afterEach(() => {
  mockExistsSync.mockRestore();
  // Missing mockReadFileSync restoration!
});
```

✅ **Correct:**
```typescript
afterEach(() => {
  mockExistsSync?.mockRestore?.();
  mockReadFileSync?.mockRestore?.();
});
```

### 3. Use MockManager for Complex Test Suites

```typescript
import { MockManager } from './helpers/mock-helpers';

describe('Complex Test Suite', () => {
  const mockManager = new MockManager();

  beforeEach(() => {
    mockManager.add(spyOn(fs, 'existsSync').mockReturnValue(true));
    mockManager.add(spyOn(process, 'cwd').mockReturnValue('/test'));
  });

  afterEach(() => {
    mockManager.restoreAll();
  });
});
```

## Assertion Guidelines

### 1. Use Proper Assertions, Not console.log

❌ **Wrong:**
```typescript
test('should validate version', () => {
  const version = getVersion();
  if (version.includes('1.0')) {
    console.log('✓ Version is correct');
  } else {
    console.log('✗ Version is incorrect');
  }
});
```

✅ **Correct:**
```typescript
test('should validate version', () => {
  const version = getVersion();
  expect(version).toContain('1.0');
});
```

### 2. Test Error Conditions Properly

❌ **Wrong:**
```typescript
test('should handle errors', () => {
  try {
    riskyOperation();
  } catch (error) {
    console.log('Error caught');
  }
});
```

✅ **Correct:**
```typescript
test('should handle errors', () => {
  expect(() => riskyOperation()).toThrow();
});
```

## Test Isolation

### 1. Each Test Should Be Independent

- Don't rely on test execution order
- Clean up all state in afterEach
- Don't share data between tests

### 2. Mock External Dependencies

- File system operations
- Network requests
- Process methods
- Console methods

### 3. Use Deterministic Tests

- Avoid time-based assertions
- Use fixed test data
- Mock random values

## Common Patterns

### 1. Testing Process.exit Calls

```typescript
test('should exit with error code', () => {
  const mockExit = spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit called with code ${code}`);
  });

  expect(() => {
    functionThatExits();
  }).toThrow('process.exit called with code 1');

  mockExit.mockRestore();
});
```

### 2. Testing Async Operations

```typescript
test('should handle async operations', async () => {
  const result = await asyncOperation();
  expect(result).toBeDefined();
});
```

### 3. Testing Docker Integration

```typescript
test('should handle Docker timeout', async () => {
  let errorThrown = false;
  let correctErrorType = false;
  
  try {
    await dockerCommand({ timeout: 1 }); // Very short timeout
  } catch (error: any) {
    errorThrown = true;
    correctErrorType = error instanceof DockerTimeoutError;
  }
  
  expect(errorThrown).toBe(true);
  expect(correctErrorType).toBe(true);
}, 1000); // Test timeout
```

## File Organization

### 1. Test File Structure

```
tests/
├── helpers/           # Test utilities and helpers
│   ├── mock-helpers.ts
│   └── runtime-detection-mocks.ts
├── unit/              # Unit tests (if separated)
├── integration/       # Integration tests (if separated)
└── setup.ts          # Global test setup
```

### 2. Test Naming

- Use descriptive test names
- Follow the pattern: "should [expected behavior] when [condition]"
- Group related tests in describe blocks

## Performance Considerations

### 1. Fast Tests

- Keep individual tests under 100ms when possible
- Use mocks for slow operations
- Avoid real network calls in unit tests

### 2. Integration Tests

- Mark slow tests appropriately
- Use environment variables to conditionally run
- Consider separate test runs for integration tests

## Debugging Tips

### 1. When Tests Fail

- Check for mock pollution (run tests in isolation)
- Verify mock restoration
- Check test execution order dependencies

### 2. Common Issues

- **Mock Pollution**: Ensure all mocks are restored
- **Async Issues**: Use proper async/await patterns
- **Timeout Issues**: Increase test timeout or fix slow operations

## Test Structure

### Test Files by Category

#### Core Functionality Tests
- **config.test.ts** - Configuration utilities and project type detection (including Bun)
- **devcontainer-templates.test.ts** - DevContainer template generation (including Bun)
- **container-utils.test.ts** - Container utility functions
- **worktree-*.test.ts** - Git worktree management

#### Bun-Specific Tests (Task 70)
- **bun-integration.test.ts** - Integration tests for Bun project support
  - Bun project detection with complete project structure
  - DevContainer template generation for Bun projects
  - Example project validation
  - Bun vs Node.js priority verification
  
- **bun-performance.test.ts** - Performance benchmarks comparing Bun and Node.js
  - Project type detection performance
  - DevContainer template generation performance
  - File system operations performance
  - JSON parsing performance
  - Memory usage comparison
  - End-to-end performance scenarios
  - Performance regression guards

#### Integration Tests
- **stats.test.ts** - Statistics and reporting
- **devcontainer-name-compatibility.test.ts** - Container naming compatibility

#### Basic Tests
- **basic.test.ts** - Basic test runner functionality

## Running Tests

### 1. All Tests
```bash
npm test
```

### 2. Specific Test Files
```bash
npm test tests/config.test.ts
npm test tests/bun-integration.test.ts
npm test tests/bun-performance.test.ts
```

### 3. Watch Mode
```bash
npm test -- --watch
```

### 4. Coverage
```bash
npm test -- --coverage
```

### 5. Bun-Specific Test Suite
```bash
npm test tests/config.test.ts tests/devcontainer-templates.test.ts tests/bun-integration.test.ts tests/bun-performance.test.ts
```

## Review Checklist

Before submitting code with tests, verify:

- [ ] All mocks are stored in variables
- [ ] All mocks are restored in afterEach
- [ ] No console.log assertions (use expect())
- [ ] Tests are deterministic
- [ ] Tests run in isolation
- [ ] Error conditions are properly tested
- [ ] Async operations use proper patterns
- [ ] Test names are descriptive
- [ ] No test execution order dependencies

## Resources

- [Bun Testing Documentation](https://bun.sh/docs/test)
- [Jest Documentation](https://jestjs.io/docs/getting-started) (for concepts)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)