import { expect, test, describe, spyOn } from 'bun:test';
import { isBunRuntime, getRuntimeInfo } from '../src/utils/runtime-utils';

describe('Runtime Detection (Simple)', () => {
  test('should detect current runtime correctly', () => {
    const isBun = isBunRuntime();
    const runtimeInfo = getRuntimeInfo();
    
    // Should detect Bun runtime since we're running with Bun test runner
    expect(isBun).toBe(true);
    expect(runtimeInfo.runtime).toBe('bun');
    expect(runtimeInfo.version).toBeDefined();
    expect(typeof runtimeInfo.version).toBe('string');
  });

  test('should have correct runtime features for Bun', () => {
    const runtimeInfo = getRuntimeInfo();
    
    expect(runtimeInfo.features.nativeTypeScript).toBe(true);
    expect(runtimeInfo.features.enhancedSpawn).toBe(true);
    expect(runtimeInfo.features.shellHelper).toBe(true);
  });

  test('should mock isBunRuntime correctly', () => {
    // Mock isBunRuntime to return false using module mocking
    const runtimeUtilsModule = require('../src/utils/runtime-utils');
    const mockIsBunRuntime = spyOn(runtimeUtilsModule, 'isBunRuntime').mockReturnValue(false);
    
    try {
      expect(runtimeUtilsModule.isBunRuntime()).toBe(false);
      expect(mockIsBunRuntime).toHaveBeenCalled();
    } finally {
      mockIsBunRuntime.mockRestore();
    }
  });

  test('should mock getRuntimeInfo correctly', () => {
    const mockRuntimeInfo = {
      runtime: 'node' as const,
      version: 'v18.0.0',
      features: {
        nativeTypeScript: false,
        enhancedSpawn: false,
        shellHelper: false
      }
    };
    
    // Mock getRuntimeInfo using module mocking
    const runtimeUtilsModule = require('../src/utils/runtime-utils');
    const mockGetRuntimeInfo = spyOn(runtimeUtilsModule, 'getRuntimeInfo').mockReturnValue(mockRuntimeInfo);
    
    try {
      const runtimeInfo = runtimeUtilsModule.getRuntimeInfo();
      expect(runtimeInfo).toEqual(mockRuntimeInfo);
      expect(runtimeInfo.runtime).toBe('node');
      expect(runtimeInfo.features.nativeTypeScript).toBe(false);
      expect(mockGetRuntimeInfo).toHaveBeenCalled();
    } finally {
      mockGetRuntimeInfo.mockRestore();
    }
  });

  test('should handle runtime info structure correctly', () => {
    const runtimeInfo = getRuntimeInfo();
    
    // Verify the structure
    expect(runtimeInfo).toHaveProperty('runtime');
    expect(runtimeInfo).toHaveProperty('version');
    expect(runtimeInfo).toHaveProperty('features');
    
    expect(runtimeInfo.features).toHaveProperty('nativeTypeScript');
    expect(runtimeInfo.features).toHaveProperty('enhancedSpawn');
    expect(runtimeInfo.features).toHaveProperty('shellHelper');
    
    // Verify types
    expect(typeof runtimeInfo.runtime).toBe('string');
    expect(typeof runtimeInfo.version).toBe('string');
    expect(typeof runtimeInfo.features.nativeTypeScript).toBe('boolean');
    expect(typeof runtimeInfo.features.enhancedSpawn).toBe('boolean');
    expect(typeof runtimeInfo.features.shellHelper).toBe('boolean');
  });
});