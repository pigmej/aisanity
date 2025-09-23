import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the file system and console
jest.mock('fs');
jest.mock('path');
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

// Import the function to test
import { generateStats } from '../src/commands/stats';

describe('stats command', () => {
  let mockFs: any;
  let mockPath: any;

  beforeEach(() => {
    mockFs = require('fs');
    mockPath = require('path');
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default path mocks
    mockPath.join = jest.fn((...args: string[]) => args.join('/'));
  });

  describe('input validation', () => {
    it('should validate days parameter is a positive number', async () => {
      mockFs.existsSync = jest.fn(() => true);
      mockFs.readdirSync = jest.fn(() => []);
      
      await generateStats({ days: 'invalid' });
      expect(console.error).toHaveBeenCalledWith('Error: --days must be a positive number');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should validate days parameter is not negative', async () => {
      mockFs.existsSync = jest.fn(() => true);
      mockFs.readdirSync = jest.fn(() => []);
      
      await generateStats({ days: '-5' });
      expect(console.error).toHaveBeenCalledWith('Error: --days must be a positive number');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should accept valid days parameter', async () => {
      mockFs.existsSync = jest.fn(() => true);
      mockFs.readdirSync = jest.fn(() => []);
      
      await generateStats({ days: '30' });
      expect(process.exit).not.toHaveBeenCalled();
    });
  });

  describe('file processing', () => {
    it('should handle missing OpenCode storage directory', async () => {
      mockFs.existsSync = jest.fn(() => false);
      
      await generateStats({ days: '30' });
      expect(console.error).toHaveBeenCalledWith('Error: OpenCode storage directory not found');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle empty message directory', async () => {
      mockFs.existsSync = jest.fn(() => true);
      mockFs.readdirSync = jest.fn(() => []);
      
      await generateStats({ days: '30' });
      expect(console.log).toHaveBeenCalledWith('No OpenCode message files found');
    });

    it('should process valid JSON files correctly', async () => {
      const mockFiles = ['test1.json', 'test2.json'];
      const mockJsonData = {
        id: 'test-id',
        role: 'assistant',
        tokens: {
          input: '100',
          output: '50',
          reasoning: '0'
        },
        cost: '0.001',
        modelID: 'test-model',
        time: {
          created: new Date().toISOString()
        }
      };

      mockFs.existsSync = jest.fn(() => true);
      mockFs.readdirSync = jest.fn(() => mockFiles.map(f => ({ name: f, isFile: () => true, isDirectory: () => false })));
      mockFs.statSync = jest.fn(() => ({ size: 1000 }));
      mockFs.readFileSync = jest.fn(() => JSON.stringify(mockJsonData));

      await generateStats({ days: '30' });
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
    });

    it('should skip files larger than 1MB', async () => {
      const mockFiles = ['large-file.json'];
      const mockJsonData = {
        id: 'test-id',
        role: 'assistant',
        tokens: {
          input: '100',
          output: '50',
          reasoning: '0'
        },
        cost: '0.001',
        modelID: 'test-model',
        time: {
          created: new Date().toISOString()
        }
      };

      mockFs.existsSync = jest.fn(() => true);
      mockFs.readdirSync = jest.fn(() => mockFiles.map(f => ({ name: f, isFile: () => true, isDirectory: () => false })));
      mockFs.statSync = jest.fn(() => ({ size: 2 * 1024 * 1024 })); // 2MB
      mockFs.readFileSync = jest.fn(() => JSON.stringify(mockJsonData));

      await generateStats({ days: '30' });
      expect(mockFs.readFileSync).not.toHaveBeenCalled();
    });

    it('should skip non-assistant messages', async () => {
      const mockFiles = ['user-message.json'];
      const mockUserData = {
        id: 'user-id',
        role: 'user',
        time: {
          created: new Date().toISOString()
        }
      };

      mockFs.existsSync = jest.fn(() => true);
      mockFs.readdirSync = jest.fn(() => mockFiles.map(f => ({ name: f, isFile: () => true, isDirectory: () => false })));
      mockFs.statSync = jest.fn(() => ({ size: 1000 }));
      mockFs.readFileSync = jest.fn(() => JSON.stringify(mockUserData));

      await generateStats({ days: '30' });
      expect(console.log).toHaveBeenCalledWith('No messages found in the last 30 days');
    });

    it('should handle malformed JSON gracefully', async () => {
      const mockFiles = ['malformed.json'];

      mockFs.existsSync = jest.fn(() => true);
      mockFs.readdirSync = jest.fn(() => mockFiles.map(f => ({ name: f, isFile: () => true, isDirectory: () => false })));
      mockFs.statSync = jest.fn(() => ({ size: 1000 }));
      mockFs.readFileSync = jest.fn(() => 'invalid json {');

      await generateStats({ days: '30' });
      expect(console.log).toHaveBeenCalledWith('No messages found in the last 30 days');
    });

    it('should skip messages with invalid timestamps', async () => {
      const mockFiles = ['invalid-timestamp.json'];
      const mockInvalidData = {
        id: 'test-id',
        role: 'assistant',
        tokens: {
          input: '100',
          output: '50',
          reasoning: '0'
        },
        cost: '0.001',
        modelID: 'test-model',
        time: {
          created: 'invalid-date'
        }
      };

      mockFs.existsSync = jest.fn(() => true);
      mockFs.readdirSync = jest.fn(() => mockFiles.map(f => ({ name: f, isFile: () => true, isDirectory: () => false })));
      mockFs.statSync = jest.fn(() => ({ size: 1000 }));
      mockFs.readFileSync = jest.fn(() => JSON.stringify(mockInvalidData));

      await generateStats({ days: '30' });
      expect(console.log).toHaveBeenCalledWith('No messages found in the last 30 days');
    });

    it('should skip messages with negative token counts', async () => {
      const mockFiles = ['negative-tokens.json'];
      const mockInvalidData = {
        id: 'test-id',
        role: 'assistant',
        tokens: {
          input: '-100',
          output: '50',
          reasoning: '0'
        },
        cost: '0.001',
        modelID: 'test-model',
        time: {
          created: new Date().toISOString()
        }
      };

      mockFs.existsSync = jest.fn(() => true);
      mockFs.readdirSync = jest.fn(() => mockFiles.map(f => ({ name: f, isFile: () => true, isDirectory: () => false })));
      mockFs.statSync = jest.fn(() => ({ size: 1000 }));
      mockFs.readFileSync = jest.fn(() => JSON.stringify(mockInvalidData));

      await generateStats({ days: '30' });
      expect(console.log).toHaveBeenCalledWith('No messages found in the last 30 days');
    });
  });

  describe('progress indication', () => {
    it('should show progress every 10 files', async () => {
      const mockFiles = Array.from({ length: 25 }, (_, i) => `file${i}.json`);
      const mockJsonData = {
        id: 'test-id',
        role: 'assistant',
        tokens: {
          input: '100',
          output: '50',
          reasoning: '0'
        },
        cost: '0.001',
        modelID: 'test-model',
        time: {
          created: new Date().toISOString()
        }
      };

      mockFs.existsSync = jest.fn(() => true);
      mockFs.readdirSync = jest.fn(() => mockFiles.map(f => ({ name: f, isFile: () => true, isDirectory: () => false })));
      mockFs.statSync = jest.fn(() => ({ size: 1000 }));
      mockFs.readFileSync = jest.fn(() => JSON.stringify(mockJsonData));

      await generateStats({ days: '30' });
      // Should show progress at files 10, 20, and 25
      expect(console.log).toHaveBeenCalledWith('Processed 10 of 25 files');
      expect(console.log).toHaveBeenCalledWith('Processed 20 of 25 files');
      expect(console.log).toHaveBeenCalledWith('Processed 25 of 25 files');
    });
  });
});