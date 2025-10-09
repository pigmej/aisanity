/**
 * Mock management utilities for test isolation and cleanup
 */

export class MockManager {
  private mocks: any[] = [];

  /**
   * Add a mock to be tracked for cleanup
   */
  add<T>(mock: T): T {
    this.mocks.push(mock);
    return mock;
  }

  /**
   * Restore all tracked mocks
   */
  restoreAll(): void {
    this.mocks.forEach(mock => {
      if (mock && typeof mock.mockRestore === 'function') {
        mock.mockRestore();
      }
    });
    this.mocks.length = 0;
  }

  /**
   * Clear the mock list without restoring (use with caution)
   */
  clear(): void {
    this.mocks.length = 0;
  }

  /**
   * Get the number of tracked mocks
   */
  count(): number {
    return this.mocks.length;
  }
}

/**
 * Helper function to create a mock manager with common Bun test patterns
 */
export function createMockManager() {
  return new MockManager();
}

/**
 * Utility to create and track a spy with automatic cleanup
 */
export function trackSpy<T extends object, K extends keyof T>(
  mockManager: MockManager,
  obj: T,
  method: K,
  implementation?: any
) {
  const spy = spyOn(obj, method);
  if (implementation !== undefined) {
    if (typeof implementation === 'function') {
      (spy as any).mockImplementation(implementation);
    } else {
      (spy as any).mockReturnValue(implementation);
    }
  }
  return mockManager.add(spy);
}