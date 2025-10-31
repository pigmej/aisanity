import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Logger } from '../src/utils/logger';

describe('Logger', () => {
  let originalConsoleLog: any;
  let originalConsoleError: any;
  let logOutput: string[] = [];
  let errorOutput: string[] = [];

  beforeEach(() => {
    // Store original console methods
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    
    // Reset output arrays
    logOutput = [];
    errorOutput = [];
    
    // Mock console methods
    console.log = (...args: any[]) => {
      logOutput.push(args.join(' '));
    };
    
    console.error = (...args: any[]) => {
      errorOutput.push(args.join(' '));
    };
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('Normal mode (default)', () => {
    test('should log info messages', () => {
      const logger = new Logger();
      logger.info('Test info message');
      
      expect(logOutput).toContain('Test info message');
      expect(errorOutput).toHaveLength(0);
    });

    test('should log error messages', () => {
      const logger = new Logger();
      logger.error('Test error message');
      
      expect(errorOutput).toContain('Test error message');
      expect(logOutput).toHaveLength(0);
    });

    test('should not log debug messages', () => {
      const logger = new Logger();
      logger.debug('Test debug message');
      
      expect(logOutput).toHaveLength(0);
      expect(errorOutput).toHaveLength(0);
    });

    test('should log warning messages', () => {
      const logger = new Logger();
      logger.warn('Test warning message');
      
      expect(errorOutput).toContain('Test warning message');
      expect(logOutput).toHaveLength(0);
    });
  });

  describe('Silent mode', () => {
    test('should suppress info messages', () => {
      const logger = new Logger(true, false, false);
      logger.info('Test info message');
      
      expect(logOutput).toHaveLength(0);
      expect(errorOutput).toHaveLength(0);
    });

    test('should still log error messages', () => {
      const logger = new Logger(true, false, false);
      logger.error('Test error message');
      
      expect(errorOutput).toContain('Test error message');
      expect(logOutput).toHaveLength(0);
    });

    test('should suppress verbose messages', () => {
      const logger = new Logger(true, true, false);
      logger.verbose('Test verbose message');
      
      expect(logOutput).toHaveLength(0);
      expect(errorOutput).toHaveLength(0);
    });

    test('should suppress debug messages even when debug is true', () => {
      const logger = new Logger(true, false, true);
      logger.debug('Test debug message');
      
      expect(logOutput).toHaveLength(0);
      expect(errorOutput).toHaveLength(0);
    });

    test('should still log warning messages', () => {
      const logger = new Logger(true, false, false);
      logger.warn('Test warning message');
      
      expect(errorOutput).toContain('Test warning message');
      expect(logOutput).toHaveLength(0);
    });
  });

  describe('Verbose mode', () => {
    test('should log info messages', () => {
      const logger = new Logger(false, true, false);
      logger.info('Test info message');
      
      expect(logOutput).toContain('Test info message');
      expect(errorOutput).toHaveLength(0);
    });

    test('should log error messages', () => {
      const logger = new Logger(false, true, false);
      logger.error('Test error message');
      
      expect(errorOutput).toContain('Test error message');
      expect(logOutput).toHaveLength(0);
    });

    test('should log verbose messages', () => {
      const logger = new Logger(false, true, false);
      logger.verbose('Test verbose message');
      
      expect(logOutput).toContain('Test verbose message');
      expect(errorOutput).toHaveLength(0);
    });

    test('should not log debug messages', () => {
      const logger = new Logger(false, true, false);
      logger.debug('Test debug message');
      
      expect(logOutput).toHaveLength(0);
      expect(errorOutput).toHaveLength(0);
    });

    test('should log warning messages', () => {
      const logger = new Logger(false, true, false);
      logger.warn('Test warning message');
      
      expect(errorOutput).toContain('Test warning message');
      expect(logOutput).toHaveLength(0);
    });
  });

  describe('Debug mode', () => {
    test('should log info messages', () => {
      const logger = new Logger(false, false, true);
      logger.info('Test info message');
      
      expect(logOutput).toContain('Test info message');
      expect(errorOutput).toHaveLength(0);
    });

    test('should not log verbose messages', () => {
      const logger = new Logger(false, false, true);
      logger.verbose('Test verbose message');
      
      expect(logOutput).toHaveLength(0);
      expect(errorOutput).toHaveLength(0);
    });

    test('should log debug messages', () => {
      const logger = new Logger(false, false, true);
      logger.debug('Test debug message');
      
      expect(logOutput).toContain('Test debug message');
      expect(errorOutput).toHaveLength(0);
    });
  });

  describe('Verbose and Debug mode combined', () => {
    test('should log verbose messages', () => {
      const logger = new Logger(false, true, true);
      logger.verbose('Test verbose message');
      
      expect(logOutput).toContain('Test verbose message');
      expect(errorOutput).toHaveLength(0);
    });

    test('should log debug messages', () => {
      const logger = new Logger(false, true, true);
      logger.debug('Test debug message');
      
      expect(logOutput).toContain('Test debug message');
      expect(errorOutput).toHaveLength(0);
    });

    test('should log both verbose and debug messages', () => {
      const logger = new Logger(false, true, true);
      logger.verbose('Test verbose message');
      logger.debug('Test debug message');
      
      expect(logOutput).toContain('Test verbose message');
      expect(logOutput).toContain('Test debug message');
      expect(errorOutput).toHaveLength(0);
    });
  });

  describe('Mode precedence', () => {
    test('silent should take precedence over verbose for info messages', () => {
      const logger = new Logger(true, true, false);
      logger.info('Test info message');
      
      expect(logOutput).toHaveLength(0);
    });

    test('silent should take precedence over verbose for verbose messages', () => {
      const logger = new Logger(true, true, false);
      logger.verbose('Test verbose message');
      
      expect(logOutput).toHaveLength(0);
    });

    test('silent should take precedence over debug for debug messages', () => {
      const logger = new Logger(true, false, true);
      logger.debug('Test debug message');
      
      expect(logOutput).toHaveLength(0);
    });

    test('errors should always be visible regardless of mode', () => {
      const silentLogger = new Logger(true, true, true);
      const verboseLogger = new Logger(false, true, false);
      const normalLogger = new Logger(false, false, false);
      
      // Reset outputs between tests
      errorOutput = [];
      silentLogger.error('Silent error');
      
      errorOutput = [];
      verboseLogger.error('Verbose error');
      
      errorOutput = [];
      normalLogger.error('Normal error');
      
      // Each test should show the error
      expect(errorOutput).toContain('Normal error');
    });

    test('warnings should always be visible regardless of mode', () => {
      const silentLogger = new Logger(true, true, true);
      const verboseLogger = new Logger(false, true, false);
      const normalLogger = new Logger(false, false, false);
      
      // Reset outputs between tests
      errorOutput = [];
      silentLogger.warn('Silent warning');
      
      errorOutput = [];
      verboseLogger.warn('Verbose warning');
      
      errorOutput = [];
      normalLogger.warn('Normal warning');
      
      // Each test should show the warning
      expect(errorOutput).toContain('Normal warning');
    });
  });

  describe('Multiple messages', () => {
    test('should handle multiple info messages correctly', () => {
      const logger = new Logger(false, false, false);
      logger.info('Message 1');
      logger.info('Message 2');
      logger.info('Message 3');
      
      expect(logOutput).toHaveLength(3);
      expect(logOutput).toContain('Message 1');
      expect(logOutput).toContain('Message 2');
      expect(logOutput).toContain('Message 3');
    });

    test('should handle mixed message types correctly in verbose mode', () => {
      const logger = new Logger(false, true, false);
      logger.info('Info message');
      logger.verbose('Verbose message');
      logger.error('Error message');
      logger.warn('Warning message');
      
      expect(logOutput).toHaveLength(2);
      expect(logOutput).toContain('Info message');
      expect(logOutput).toContain('Verbose message');
      expect(errorOutput).toHaveLength(2);
      expect(errorOutput).toContain('Error message');
      expect(errorOutput).toContain('Warning message');
    });

    test('should handle mixed message types correctly in debug mode', () => {
      const logger = new Logger(false, false, true);
      logger.info('Info message');
      logger.debug('Debug message');
      logger.error('Error message');
      logger.warn('Warning message');
      
      expect(logOutput).toHaveLength(2);
      expect(logOutput).toContain('Info message');
      expect(logOutput).toContain('Debug message');
      expect(errorOutput).toHaveLength(2);
      expect(errorOutput).toContain('Error message');
      expect(errorOutput).toContain('Warning message');
    });

    test('should handle all message types in combined mode', () => {
      const logger = new Logger(false, true, true);
      logger.info('Info message');
      logger.verbose('Verbose message');
      logger.debug('Debug message');
      logger.error('Error message');
      logger.warn('Warning message');
      
      expect(logOutput).toHaveLength(3);
      expect(logOutput).toContain('Info message');
      expect(logOutput).toContain('Verbose message');
      expect(logOutput).toContain('Debug message');
      expect(errorOutput).toHaveLength(2);
      expect(errorOutput).toContain('Error message');
      expect(errorOutput).toContain('Warning message');
    });
  });
});