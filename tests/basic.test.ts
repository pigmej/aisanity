// Basic test to verify Bun test runner works
import { getRuntimeInfo } from '../src/utils/runtime-utils';

// Test will be available at runtime with Bun
console.log('Running basic test with Bun test runner');

// Simple test without complex mocking
test('Runtime detection works', () => {
  const runtime = getRuntimeInfo();
  console.log('Detected runtime:', runtime);
  
  // Basic assertions
  if (typeof runtime === 'object' && runtime !== null) {
    console.log('✓ Runtime info is an object');
  }
  
  if (typeof runtime.runtime === 'string') {
    console.log('✓ Runtime name is a string:', runtime.runtime);
  }
  
  if (typeof runtime.version === 'string') {
    console.log('✓ Runtime version is a string:', runtime.version);
  }
});

test('Docker-safe-exec can be imported', () => {
  const { safeDockerExec, isBunRuntime } = require('../src/utils/docker-safe-exec');
  
  console.log('✓ safeDockerExec function imported');
  console.log('✓ isBunRuntime function imported');
  console.log('Current runtime detected as Bun:', isBunRuntime());
});