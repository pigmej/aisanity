import { expect, test, describe } from 'bun:test';
import { validateRuntimeDetectionIntegration } from './helpers/runtime-detection-mocks';

describe('Function Duplication Resolution', () => {
  test('should use shared runtime detection between modules', () => {
    // Verify that both modules use the same isBunRuntime function
    const runtimeUtilsIsBun = require('../src/utils/runtime-utils').isBunRuntime;
    const dockerSafeExecIsBun = require('../src/utils/docker-safe-exec').isBunRuntime;
    
    expect(runtimeUtilsIsBun).toBe(dockerSafeExecIsBun);
  });

  test('should validate runtime detection integration', () => {
    const isValid = validateRuntimeDetectionIntegration();
    expect(isValid).toBe(true);
  });

  test('should have consistent runtime types across modules', () => {
    // Types are erased at runtime, but both modules should have the same type definitions
    // We can check this by checking the exports of the modules
    const runtimeUtilsModule = require('../src/utils/runtime-utils');
    const dockerSafeExecModule = require('../src/utils/docker-safe-exec');
    
    // Check if both modules export the same functions
    expect(typeof runtimeUtilsModule.isBunRuntime).toBe('function');
    expect(typeof dockerSafeExecModule.isBunRuntime).toBe('function');
    expect(typeof runtimeUtilsModule.getRuntimeInfo).toBe('function');
    expect(typeof dockerSafeExecModule.getRuntimeInfo).toBe('function');
  });

  test('should have consistent function signatures', () => {
    const runtimeUtils = require('../src/utils/runtime-utils');
    const dockerSafeExec = require('../src/utils/docker-safe-exec');
    
    // Both modules should have isBunRuntime function
    expect(typeof runtimeUtils.isBunRuntime).toBe('function');
    expect(typeof dockerSafeExec.isBunRuntime).toBe('function');
    
    // Both modules should have getRuntimeInfo function
    expect(typeof runtimeUtils.getRuntimeInfo).toBe('function');
    expect(typeof dockerSafeExec.getRuntimeInfo).toBe('function');
    
    // Functions should return the same type of results
    const runtimeUtilsResult = runtimeUtils.getRuntimeInfo();
    const dockerSafeExecResult = dockerSafeExec.getRuntimeInfo();
    
    expect(typeof runtimeUtilsResult).toBe('object');
    expect(typeof dockerSafeExecResult).toBe('object');
    expect(runtimeUtilsResult.runtime).toBe(dockerSafeExecResult.runtime);
  });
});