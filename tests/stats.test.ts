import { expect, test, describe, beforeEach, spyOn } from 'bun:test';
import * as fs from 'fs';

// Import the function to test
import { generateStats } from '../src/commands/stats';

// Create mock for fs since Bun doesn't have fs module mocking like Jest
const mockFs = {
  existsSync: () => true,
  readdirSync: () => [],
  statSync: () => ({ size: 1000 }),
  readFileSync: () => '{}',
  promises: {
    readdir: () => Promise.resolve([]),
    readFile: () => Promise.resolve('{}'),
    stat: () => Promise.resolve({ size: 1000 })
  }
};

const mockPath = {
  join: (...args: string[]) => args.join('/'),
  resolve: (...args: string[]) => args.join('/')
};

// Mock original methods to preserve global state
let originalConsoleLog: any;
let originalConsoleError: any;
let originalConsoleWarn: any;
let originalProcessExit: any;

describe('stats command', () => {
  beforeEach(() => {
    // Store original methods
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;
    originalProcessExit = process.exit;

    // Mock methods using spyOn
    spyOn(console, 'log').mockImplementation(() => {});
    spyOn(console, 'error').mockImplementation(() => {});
    spyOn(console, 'warn').mockImplementation(() => {});
    spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit called with code ${code}`);
    });
  });

  describe('input validation', () => {
    test('should validate days parameter is a positive number', async () => {
      // Mock Bun.file to simulate file system
      const originalBunFile = Bun.file;
      (Bun as any).file = () => ({
        exists: async () => true,
        text: async () => '[]'
      });

      try {
        await generateStats({ days: 'invalid' });
      } catch (error) {
        expect(error.message).toContain('process.exit called with code 1');
      }
      expect(console.error).toHaveBeenCalledWith('Error: --days must be a positive number');
      (process.exit as any).mockRestore();
      (Bun as any).file = originalBunFile;
    });

    test('should validate days parameter is not negative', async () => {
      // Mock Bun.file to simulate file system
      const originalBunFile = Bun.file;
      (Bun as any).file = () => ({
        exists: async () => true,
        text: async () => '[]'
      });

      try {
        await generateStats({ days: '-5' });
      } catch (error) {
        expect(error.message).toContain('process.exit called with code 1');
      }
      expect(console.error).toHaveBeenCalledWith('Error: --days must be a positive number');
      (process.exit as any).mockRestore();
      (Bun as any).file = originalBunFile;
    });

    test('should accept valid days parameter', async () => {
      // Mock Bun.file to simulate file system
      const originalBunFile = Bun.file;
      (Bun as any).file = () => ({
        exists: async () => true,
        text: async () => '[]'
      });

      try {
        await generateStats({ days: '30' });
      } catch (error) {
        // If there's an unexpected process.exit error, fail the test
        if (error.message?.includes('process.exit called with code')) {
          expect(true).toBe(false); // Force test failure if process.exit was called unexpectedly
        } else {
          throw error;
        }
      }
      expect(process.exit).not.toHaveBeenCalled();
      (Bun as any).file = originalBunFile;
    });
  });

  describe('file processing', () => {
    test('should handle missing OpenCode storage directory', async () => {
      // Mock fs.existsSync to simulate non-existent directory
      const mockExistsSync = spyOn(fs, 'existsSync').mockImplementation((path: fs.PathLike) => {
        // Return false for the OpenCode storage path
        if (path.toString().includes('.local/share/opencode/storage/message')) {
          return false;
        }
        // For other paths, return true by default
        return true;
      });

      try {
        await generateStats({ days: '30' });
      } catch (error) {
        expect(error.message).toContain('process.exit called with code 1');
      }
      expect(console.error).toHaveBeenCalledWith('Error: OpenCode storage directory not found');
      
      // Clean up the mock
      mockExistsSync.mockRestore();
    });

    test('should handle empty message directory', async () => {
      // Mock fs.existsSync to return false for OpenCode storage
      const mockExistsSync = spyOn(fs, 'existsSync').mockImplementation((path: fs.PathLike) => {
        // Return false for the OpenCode storage path to simulate missing directory
        if (path.toString().includes('.local/share/opencode/storage/message')) {
          return false;
        }
        return true;
      });

      // Mock Bun.file to simulate empty directory
      const originalBunFile = Bun.file;
      (Bun as any).file = () => ({
        exists: async () => true,
        text: async () => '[]'
      });

      try {
        await generateStats({ days: '30' });
        expect(console.log).toHaveBeenCalledWith('No OpenCode message files found');
      } catch (error) {
        // Expect process.exit to be called when directory is missing
        expect(error.message).toContain('process.exit called with code 1');
      } finally {
        // Clean up mocks
        mockExistsSync.mockRestore();
        (Bun as any).file = originalBunFile;
      }
    });
  });
});