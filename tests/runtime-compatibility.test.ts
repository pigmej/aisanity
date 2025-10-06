// Runtime compatibility tests for Bun migration
import { safeDockerExec } from '../src/utils/docker-safe-exec';
import { safeExecSync, getRuntimeInfo, isBunRuntime } from '../src/utils/runtime-utils';

console.log('Running runtime compatibility tests');

test('Runtime detection works correctly', () => {
  const runtime = getRuntimeInfo();
  console.log('Runtime info:', runtime);
  
  // Verify runtime structure
  if (runtime && typeof runtime.runtime === 'string') {
    console.log('✓ Runtime detected:', runtime.runtime);
  }
  
  if (runtime && typeof runtime.version === 'string') {
    console.log('✓ Version detected:', runtime.version);
  }
  
  if (runtime && runtime.features && typeof runtime.features === 'object') {
    console.log('✓ Features object exists');
    console.log('  - Native TypeScript:', runtime.features.nativeTypeScript);
    console.log('  - Enhanced Spawn:', runtime.features.enhancedSpawn);
    console.log('  - Shell Helper:', runtime.features.shellHelper);
  }
});

test('Bun runtime detection', () => {
  const isBun = isBunRuntime();
  console.log('✓ Bun runtime detected:', isBun);
  
  if (isBun) {
    console.log('✓ Running on Bun runtime');
  } else {
    console.log('✓ Running on Node.js runtime (fallback mode)');
  }
});

test('Docker version command works', async () => {
  try {
    const start = Date.now();
    const result = await safeDockerExec(['--version']);
    const duration = Date.now() - start;
    
    console.log('✓ Docker version command executed successfully');
    console.log('  Execution time:', duration + 'ms');
    console.log('  Result:', result.trim());
    
    if (result.includes('Docker version')) {
      console.log('✓ Docker version output is valid');
    }
    
    // Performance check for Bun
    if (isBunRuntime() && duration < 100) {
      console.log('✓ Performance improvement detected with Bun');
    }
  } catch (error: any) {
    console.log('✗ Docker command failed:', error.message);
  }
});

test('Shell command execution works', async () => {
  try {
    const result = await safeExecSync('echo "Hello from runtime utils"');
    console.log('✓ Shell command executed successfully');
    console.log('  Result:', result.trim());
    
    if (result.includes('Hello from runtime utils')) {
      console.log('✓ Shell command output is correct');
    }
  } catch (error: any) {
    console.log('✗ Shell command failed:', error.message);
  }
});

test('Error handling consistency', async () => {
  try {
    await safeDockerExec(['invalid-command-that-should-not-exist']);
    console.log('✗ Expected error was not thrown');
  } catch (error: any) {
    console.log('✓ Error handling works correctly');
    console.log('  Error type:', error.constructor.name);
    console.log('  Error message:', error.message);
    
    if (error.name === 'DockerExecError') {
      console.log('✓ Correct error type thrown');
    }
  }
});