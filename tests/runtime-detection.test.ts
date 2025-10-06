import { expect, test, describe } from 'bun:test';
import { isBunRuntime, getRuntimeInfo } from '../src/utils/runtime-utils';
import { setupBunRuntimeMock, setupNodeRuntimeMock, testRuntimeDetection } from './helpers/runtime-detection-mocks';

describe('Runtime Detection', () => {
  describe('isBunRuntime function', () => {
    test('should detect Bun runtime correctly', () => {
      const runtimeMock = setupBunRuntimeMock('1.2.0');
      
      try {
        expect(isBunRuntime()).toBe(true);
      } finally {
        runtimeMock.restore();
      }
    });

    test('should detect Node.js runtime correctly', () => {
      const runtimeMock = setupNodeRuntimeMock();
      
      try {
        expect(isBunRuntime()).toBe(false);
      } finally {
        runtimeMock.restore();
      }
    });
  });

  describe('getRuntimeInfo function', () => {
    test('should return correct runtime info for Bun', () => {
      const runtimeMock = setupBunRuntimeMock('1.2.0');
      
      try {
        const runtimeInfo = getRuntimeInfo();
        expect(runtimeInfo.runtime).toBe('bun');
        expect(runtimeInfo.version).toBe('1.2.0');
        expect(runtimeInfo.features.nativeTypeScript).toBe(true);
        expect(runtimeInfo.features.enhancedSpawn).toBe(true);
        expect(runtimeInfo.features.shellHelper).toBe(true);
      } finally {
        runtimeMock.restore();
      }
    });

    test('should return correct runtime info for Node.js', () => {
      const runtimeMock = setupNodeRuntimeMock();
      
      try {
        const runtimeInfo = getRuntimeInfo();
        expect(runtimeInfo.runtime).toBe('node');
        expect(runtimeInfo.version).toBe(process.version);
        expect(runtimeInfo.features.nativeTypeScript).toBe(false);
        expect(runtimeInfo.features.enhancedSpawn).toBe(false);
        expect(runtimeInfo.features.shellHelper).toBe(false);
      } finally {
        runtimeMock.restore();
      }
    });
  });

  describe('Runtime detection integration', () => {
    test('should work correctly in Bun runtime', () => {
      const runtimeMock = setupBunRuntimeMock('1.2.0');
      
      try {
        const result = testRuntimeDetection('bun');
        
        expect(result.isBunCorrect).toBe(true);
        expect(result.runtimeInfoCorrect).toBe(true);
        expect(result.runtimeInfo.runtime).toBe('bun');
      } finally {
        runtimeMock.restore();
      }
    });

    test('should work correctly in Node.js runtime', () => {
      const runtimeMock = setupNodeRuntimeMock();
      
      try {
        const result = testRuntimeDetection('node');
        
        expect(result.isBunCorrect).toBe(true);
        expect(result.runtimeInfoCorrect).toBe(true);
        expect(result.runtimeInfo.runtime).toBe('node');
      } finally {
        runtimeMock.restore();
      }
    });
  });

  describe('Runtime feature detection', () => {
    test('should detect Bun features correctly', () => {
      const runtimeMock = setupBunRuntimeMock('1.2.0');
      
      try {
        const runtimeInfo = getRuntimeInfo();
        
        expect(runtimeInfo.features.nativeTypeScript).toBe(true);
        expect(runtimeInfo.features.enhancedSpawn).toBe(true);
        expect(runtimeInfo.features.shellHelper).toBe(true);
      } finally {
        runtimeMock.restore();
      }
    });

    test('should detect Node.js limitations correctly', () => {
      const runtimeMock = setupNodeRuntimeMock();
      
      try {
        const runtimeInfo = getRuntimeInfo();
        
        expect(runtimeInfo.features.nativeTypeScript).toBe(false);
        expect(runtimeInfo.features.enhancedSpawn).toBe(false);
        expect(runtimeInfo.features.shellHelper).toBe(false);
      } finally {
        runtimeMock.restore();
      }
    });
  });

  describe('Runtime version handling', () => {
    test('should handle different Bun versions', () => {
      const versions = ['1.0.0', '1.1.0', '1.2.0', '2.0.0'];
      
      versions.forEach(version => {
        const runtimeMock = setupBunRuntimeMock(version);
        
        try {
          const runtimeInfo = getRuntimeInfo();
          expect(runtimeInfo.version).toBe(version);
          expect(runtimeInfo.runtime).toBe('bun');
        } finally {
          runtimeMock.restore();
        }
      });
    });

    test('should handle Node.js version correctly', () => {
      const runtimeMock = setupNodeRuntimeMock();
      
      try {
        const runtimeInfo = getRuntimeInfo();
        expect(runtimeInfo.version).toBe(process.version);
        expect(runtimeInfo.runtime).toBe('node');
      } finally {
        runtimeMock.restore();
      }
    });
  });
});