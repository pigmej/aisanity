/**
 * Sets up Bun runtime environment for testing
 * Uses module-level mocking to avoid Bun's global property constraints
 */

import { isBunRuntime, getRuntimeInfo } from '../../src/utils/runtime-utils';
import { spyOn } from 'bun:test';

/**
 * Sets up Bun runtime environment for testing using module-level mocking
 */
export function setupBunRuntimeMock(version: string = '1.2.0') {
  const runtimeUtilsModule = require('../../src/utils/runtime-utils');
  const originalIsBunRuntime = runtimeUtilsModule.isBunRuntime;
  const originalGetRuntimeInfo = runtimeUtilsModule.getRuntimeInfo;
  
  // Mock the functions at the module level
  const mockIsBunRuntime = spyOn(runtimeUtilsModule, 'isBunRuntime').mockReturnValue(true);
  const mockGetRuntimeInfo = spyOn(runtimeUtilsModule, 'getRuntimeInfo').mockReturnValue({
    runtime: 'bun',
    version,
    features: {
      nativeTypeScript: true,
      enhancedSpawn: true,
      shellHelper: true
    }
  });
  
  return {
    restore: () => {
      mockIsBunRuntime.mockRestore?.();
      mockGetRuntimeInfo.mockRestore?.();
    }
  };
}

/**
 * Sets up Node.js runtime environment for testing using module-level mocking
 */
export function setupNodeRuntimeMock() {
  const runtimeUtilsModule = require('../../src/utils/runtime-utils');
  const originalIsBunRuntime = runtimeUtilsModule.isBunRuntime;
  const originalGetRuntimeInfo = runtimeUtilsModule.getRuntimeInfo;
  
  // Mock the functions at the module level to return Node.js values
  const mockIsBunRuntime = spyOn(runtimeUtilsModule, 'isBunRuntime').mockReturnValue(false);
  const mockGetRuntimeInfo = spyOn(runtimeUtilsModule, 'getRuntimeInfo').mockReturnValue({
    runtime: 'node',
    version: process.version,
    features: {
      nativeTypeScript: false,
      enhancedSpawn: false,
      shellHelper: false
    }
  });
  
  return {
    restore: () => {
      mockIsBunRuntime.mockRestore?.();
      mockGetRuntimeInfo.mockRestore?.();
    }
  };
}

/**
 * Creates a mock runtime info object for testing
 */
export function createMockRuntimeInfo(runtime: 'bun' | 'node', version?: string) {
  return {
    runtime,
    version: version || (runtime === 'bun' ? '1.2.0' : process.version),
    features: {
      nativeTypeScript: runtime === 'bun',
      enhancedSpawn: runtime === 'bun',
      shellHelper: runtime === 'bun'
    }
  };
}

/**
 * Validates runtime detection function integration
 */
export function validateRuntimeDetectionIntegration(): boolean {
  try {
    // Test that both modules use the same isBunRuntime function
    const runtimeUtilsIsBun = require('../../src/utils/runtime-utils').isBunRuntime;
    const dockerSafeExecIsBun = require('../../src/utils/docker-safe-exec').isBunRuntime;
    
    return runtimeUtilsIsBun === dockerSafeExecIsBun;
  } catch (error) {
    return false;
  }
}

/**
 * Test helper to verify runtime detection works correctly using module mocking
 * This approach uses spyOn on the actual module exports instead of trying to modify globalThis
 */
export function testRuntimeDetection(expectedRuntime: 'bun' | 'node') {
  // Import the functions directly for testing
  const { isBunRuntime, getRuntimeInfo } = require('../../src/utils/runtime-utils');
  
  const isBun = isBunRuntime();
  const runtimeInfo = getRuntimeInfo();
  
  return {
    isBunCorrect: isBun === (expectedRuntime === 'bun'),
    runtimeInfoCorrect: runtimeInfo.runtime === expectedRuntime,
    runtimeInfo
  };
}