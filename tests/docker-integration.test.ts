// Docker integration tests for Bun migration
import { DockerTimeoutError, DockerExecError } from '../src/utils/docker-safe-exec';

console.log('Running Docker integration tests');

// Helper function to get the real safeDockerExec function (not mocked)
function getRealSafeDockerExec() {
  const dockerSafeExecModule = require('../src/utils/docker-safe-exec');
  return dockerSafeExecModule.safeDockerExec;
}

test('Container operations work with Bun.spawn', async () => {
  const version = await getRealSafeDockerExec()(['--version']);
  
  expect(version).toBeDefined();
  expect(version).toMatch(/Docker version \d+\.\d+\.\d+/);
});

test('Docker info command works', async () => {
  const info = await getRealSafeDockerExec()(['info']);
  
  expect(info).toBeDefined();
  expect(info).toContain('Containers:');
  expect(info).toContain('Images:');
});

test('Timeout handling with AbortController', async () => {
  let errorThrown = false;
  let correctErrorType = false;
  
  try {
    // Use a command that will definitely timeout
    await getRealSafeDockerExec()(['info'], { timeout: 1 });
  } catch (error: any) {
    errorThrown = true;
    correctErrorType = error instanceof DockerTimeoutError;
  }
  
  expect(errorThrown).toBe(true);
  expect(correctErrorType).toBe(true);
}, 1000);

test('Verbose logging functionality', async () => {
  const result = await getRealSafeDockerExec()(['--version'], { verbose: true });
  
  expect(result).toBeDefined();
  expect(result.length).toBeGreaterThan(0);
  expect(result).toContain('Docker version');
});

test('Custom working directory', async () => {
  const result = await getRealSafeDockerExec()(['--version'], { 
    cwd: process.cwd(),
    timeout: 5000 
  });
  
  expect(result).toBeDefined();
  expect(result).toContain('Docker version');
});

test('Environment variables handling', async () => {
  const result = await getRealSafeDockerExec()(['--version'], { 
    env: { ...process.env, TEST_VAR: 'test_value' },
    timeout: 5000 
  });
  
  expect(result).toBeDefined();
  expect(result).toContain('Docker version');
});