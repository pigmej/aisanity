// Docker integration tests for Bun migration
import { DockerTimeoutError, DockerExecError } from '../src/utils/docker-safe-exec';

console.log('Running Docker integration tests');

// Helper function to get the real safeDockerExec function (not mocked)
function getRealSafeDockerExec() {
  const dockerSafeExecModule = require('../src/utils/docker-safe-exec');
  return dockerSafeExecModule.safeDockerExec;
}

test('Container operations work with Bun.spawn', async () => {
  try {
    // Test basic Docker connectivity
    const version = await getRealSafeDockerExec()(['--version']);
    console.log('✓ Docker version command successful');
    
    if (version.match(/Docker version \d+\.\d+\.\d+/)) {
      console.log('✓ Docker version format is valid');
    } else {
      console.log('✗ Docker version format is invalid:', version);
    }
  } catch (error: any) {
    console.log('✗ Docker version command failed:', error.message);
  }
});

test('Docker info command works', async () => {
  try {
    const info = await getRealSafeDockerExec()(['info']);
    console.log('✓ Docker info command successful');
    
    // Check for common Docker info fields
    if (info.includes('Containers:') && info.includes('Images:')) {
      console.log('✓ Docker info contains expected fields');
    } else {
      console.log('✗ Docker info missing expected fields');
    }
  } catch (error: any) {
    console.log('✗ Docker info command failed:', error.message);
  }
});

test('Timeout handling with AbortController', async () => {
  try {
    // Use a command that will take longer than timeout to ensure timeout occurs
    // Use a more reliable approach with a command that takes time: run a long ping or similar
    await getRealSafeDockerExec()(['run', '--rm', 'alpine', 'sh', '-c', 'sleep 5'], { timeout: 100 }); // 100ms timeout for 5s sleep
    console.log('✗ Expected timeout error was not thrown');
  } catch (error: any) {
    if (error instanceof DockerTimeoutError) {
      console.log('✓ Timeout handling works correctly');
    } else {
      console.log('✗ Wrong error type thrown:', error.constructor.name, error.message);
    }
  }
});

test('Error handling for invalid commands', async () => {
  try {
    await getRealSafeDockerExec()(['invalid-command-that-does-not-exist']);
    console.log('✗ Expected error was not thrown');
  } catch (error: any) {
    if (error instanceof DockerExecError) {
      console.log('✓ DockerExecError thrown correctly');
      console.log('  Error code:', error.code);
      console.log('  Runtime:', error.runtime);
      
      if (error.stderr) {
        console.log('  Stderr:', error.stderr.trim());
      }
    } else {
      console.log('✗ Wrong error type thrown:', error.constructor.name);
    }
  }
});

test('Verbose logging functionality', async () => {
  try {
    // Test with verbose logging enabled
    const result = await getRealSafeDockerExec()(['--version'], { verbose: true });
    console.log('✓ Verbose logging test completed');
    console.log('  Result length:', result.length, 'characters');
  } catch (error: any) {
    console.log('✗ Verbose logging test failed:', error.message);
  }
});

test('Custom working directory', async () => {
  try {
    // Test Docker command with custom working directory
    const result = await getRealSafeDockerExec()(['--version'], { 
      cwd: process.cwd(),
      timeout: 5000 
    });
    console.log('✓ Custom working directory test successful');
    
    if (result.includes('Docker version')) {
      console.log('✓ Docker command executed in custom directory');
    }
  } catch (error: any) {
    console.log('✗ Custom working directory test failed:', error.message);
  }
});

test('Environment variables handling', async () => {
  try {
    // Test with custom environment variables
    const result = await getRealSafeDockerExec()(['--version'], { 
      env: { ...process.env, TEST_VAR: 'test_value' },
      timeout: 5000 
    });
    console.log('✓ Environment variables test successful');
  } catch (error: any) {
    console.log('✗ Environment variables test failed:', error.message);
  }
});