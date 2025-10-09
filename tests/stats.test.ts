import { expect, test, describe, beforeEach, afterEach, spyOn } from 'bun:test';
import * as fs from 'fs';

// Import the function to test
import { generateStats } from '../src/commands/stats';

// Helper function to mock empty directory
function mockEmptyDirectory() {
  const mockExistsSync = spyOn(fs, 'existsSync').mockReturnValue(true);
  const mockReaddirSync = spyOn(fs, 'readdirSync').mockReturnValue([]);
  return { mockExistsSync, mockReaddirSync };
}

// Helper function to mock missing directory
function mockMissingDirectory() {
  const mockExistsSync = spyOn(fs, 'existsSync').mockImplementation((path: fs.PathLike) => {
    if (path.toString().includes('.local/share/opencode/storage/message')) {
      return false;
    }
    return true;
  });
  return mockExistsSync;
}

describe('stats command', () => {
  beforeEach(() => {
    // Mock methods using spyOn
    spyOn(console, 'log').mockImplementation(() => {});
    spyOn(console, 'error').mockImplementation(() => {});
    spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore all mocks to prevent test interference
    if (typeof jest !== 'undefined') {
      jest.restoreAllMocks();
    }
  });

  describe('input validation', () => {
    test('should validate days parameter is a positive number', async () => {
      // Mock process.exit for this test
      const mockProcessExit = spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`process.exit called with code ${code}`);
      });
      
      // Mock directory exists but is empty (to bypass file system checks)
      const { mockExistsSync, mockReaddirSync } = mockEmptyDirectory();

      try {
        await generateStats({ days: 'invalid' });
      } catch (error) {
        expect(error.message).toContain('process.exit called with code 1');
      }
      expect(console.error).toHaveBeenCalledWith('Error: --days must be a positive number');
      
      // Clean up mocks
      mockExistsSync.mockRestore();
      mockReaddirSync.mockRestore();
      mockProcessExit.mockRestore();
    });

    test('should validate days parameter is not negative', async () => {
      // Mock process.exit for this test
      const mockProcessExit = spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`process.exit called with code ${code}`);
      });
      
      // Mock directory exists but is empty (to bypass file system checks)
      const { mockExistsSync, mockReaddirSync } = mockEmptyDirectory();

      try {
        await generateStats({ days: '-5' });
      } catch (error) {
        expect(error.message).toContain('process.exit called with code 1');
      }
      expect(console.error).toHaveBeenCalledWith('Error: --days must be a positive number');
      
      // Clean up mocks
      mockExistsSync.mockRestore();
      mockReaddirSync.mockRestore();
      mockProcessExit.mockRestore();
    });

    test('should accept valid days parameter with no files', async () => {
      // Mock process.exit for this test
      const mockProcessExit = spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`process.exit called with code ${code}`);
      });
      
      // Mock directory exists but is empty
      const { mockExistsSync, mockReaddirSync } = mockEmptyDirectory();

      try {
        await generateStats({ days: '30' });
      } catch (error) {
        // If there's an unexpected process.exit error, fail the test
        if (error.message?.includes('process.exit called with code')) {
          throw new Error(`Unexpected process.exit: ${error.message}`);
        } else {
          throw error;
        }
      }
      
      // Should complete without calling process.exit
      expect(mockProcessExit).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('No OpenCode message files found');
      
      // Clean up mocks
      mockExistsSync.mockRestore();
      mockReaddirSync.mockRestore();
      mockProcessExit.mockRestore();
    });
  });

  describe('file processing', () => {
    test('should handle missing OpenCode storage directory', async () => {
      // Mock process.exit for this test
      const mockProcessExit = spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`process.exit called with code ${code}`);
      });
      
      // Mock fs.existsSync to simulate non-existent directory
      const mockExistsSync = mockMissingDirectory();

      try {
        await generateStats({ days: '30' });
      } catch (error) {
        expect(error.message).toContain('process.exit called with code 1');
      }
      expect(console.error).toHaveBeenCalledWith('Error: OpenCode storage directory not found');
      
      // Clean up the mock
      mockExistsSync.mockRestore();
      mockProcessExit.mockRestore();
    });

    test('should handle empty message directory', async () => {
      // Mock process.exit for this test
      const mockProcessExit = spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`process.exit called with code ${code}`);
      });
      
      // Mock directory exists but is empty
      const { mockExistsSync, mockReaddirSync } = mockEmptyDirectory();

      try {
        await generateStats({ days: '30' });
        expect(console.log).toHaveBeenCalledWith('No OpenCode message files found');
      } catch (error) {
        // If there's an unexpected process.exit error, fail the test
        if (error.message?.includes('process.exit called with code')) {
          throw new Error(`Unexpected process.exit: ${error.message}`);
        }
        throw error;
      } finally {
        // Clean up mocks
        mockExistsSync.mockRestore();
        mockReaddirSync.mockRestore();
        mockProcessExit.mockRestore();
      }
    });
  });
});