// Test setup for Bun test runner
// This file is loaded before each test run

// Set up test environment
global.console = console;

// Store original functions that might be mocked
const originalBun = {
  spawn: Bun.spawn,
  spawnSync: Bun.spawnSync
};

// Note: Individual test files should handle their own mock restoration
// Global cleanup removed to prevent interference with test-specific mocks

// Mock any global setup if needed
export {};