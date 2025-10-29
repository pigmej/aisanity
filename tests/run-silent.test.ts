import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Logger } from '../src/utils/logger';

// Helper functions to test the logic from run.ts
function isSilentMode(options: any): boolean {
  return options.silent || options.quiet || false;
}

type StdioConfig = ['inherit' | 'pipe' | 'ignore', 'inherit' | 'pipe' | 'ignore', 'inherit' | 'pipe' | 'ignore'];

function selectStdioConfig(isSilent: boolean): StdioConfig {
  return isSilent ? ['inherit', 'pipe', 'pipe'] : ['inherit', 'inherit', 'inherit'];
}

describe('Run Command Silent Functionality', () => {
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

  describe('Logger option parsing', () => {
    test('should create normal logger when no options provided', () => {
      const options = {
        silent: undefined,
        quiet: undefined,
        verbose: undefined
      };
      
      const logger = new Logger(
        options.silent || options.quiet || false,
        options.verbose && !options.silent && !options.quiet || false,
        false
      );
      
      logger.info('Test message');
      expect(logOutput).toContain('Test message');
    });

    test('should create silent logger when silent option is true', () => {
      const options = {
        silent: true,
        quiet: undefined,
        verbose: undefined
      };
      
      const logger = new Logger(
        options.silent || options.quiet || false,
        options.verbose && !options.silent && !options.quiet || false,
        false
      );
      
      logger.info('Test message');
      expect(logOutput).toHaveLength(0);
    });

    test('should create silent logger when quiet option is true', () => {
      const options = {
        silent: undefined,
        quiet: true,
        verbose: undefined
      };
      
      const logger = new Logger(
        options.silent || options.quiet || false,
        options.verbose && !options.silent && !options.quiet || false,
        false
      );
      
      logger.info('Test message');
      expect(logOutput).toHaveLength(0);
    });

    test('should create verbose logger when verbose option is true', () => {
      const options = {
        silent: undefined,
        quiet: undefined,
        verbose: true
      };
      
      const logger = new Logger(
        options.silent || options.quiet || false,
        options.verbose && !options.silent && !options.quiet || false,
        false
      );
      
      logger.info('Test message');
      logger.verbose('Verbose message');
      
      expect(logOutput).toHaveLength(2);
      expect(logOutput).toContain('Test message');
      expect(logOutput).toContain('Verbose message');
    });

    test('should prioritize silent over verbose when both are true', () => {
      const options = {
        silent: true,
        quiet: undefined,
        verbose: true
      };
      
      const logger = new Logger(
        options.silent || options.quiet || false,
        options.verbose && !options.silent && !options.quiet || false,
        false
      );
      
      logger.info('Test message');
      logger.verbose('Verbose message');
      
      expect(logOutput).toHaveLength(0);
    });

    test('should prioritize quiet over verbose when both are true', () => {
      const options = {
        silent: undefined,
        quiet: true,
        verbose: true
      };
      
      const logger = new Logger(
        options.silent || options.quiet || false,
        options.verbose && !options.silent && !options.quiet || false,
        false
      );
      
      logger.info('Test message');
      logger.verbose('Verbose message');
      
      expect(logOutput).toHaveLength(0);
    });
  });

  describe('Error message visibility', () => {
    test('should show error messages in silent mode', () => {
      const options = {
        silent: true,
        quiet: undefined,
        verbose: undefined
      };
      
      const logger = new Logger(
        options.silent || options.quiet || false,
        options.verbose && !options.silent && !options.quiet || false,
        false
      );
      
      logger.error('Error message');
      expect(errorOutput).toContain('Error message');
      expect(logOutput).toHaveLength(0);
    });

    test('should show error messages in quiet mode', () => {
      const options = {
        silent: undefined,
        quiet: true,
        verbose: undefined
      };
      
      const logger = new Logger(
        options.silent || options.quiet || false,
        options.verbose && !options.silent && !options.quiet || false,
        false
      );
      
      logger.error('Error message');
      expect(errorOutput).toContain('Error message');
      expect(logOutput).toHaveLength(0);
    });

    test('should show error messages in verbose mode', () => {
      const options = {
        silent: undefined,
        quiet: undefined,
        verbose: true
      };
      
      const logger = new Logger(
        options.silent || options.quiet || false,
        options.verbose && !options.silent && !options.quiet || false,
        false
      );
      
      logger.error('Error message');
      expect(errorOutput).toContain('Error message');
      expect(logOutput).toHaveLength(0);
    });

    test('should show error messages in normal mode', () => {
      const options = {
        silent: undefined,
        quiet: undefined,
        verbose: undefined
      };
      
      const logger = new Logger(
        options.silent || options.quiet || false,
        options.verbose && !options.silent && !options.quiet || false,
        false
      );
      
      logger.error('Error message');
      expect(errorOutput).toContain('Error message');
      expect(logOutput).toHaveLength(0);
    });
  });

  describe('Flag precedence scenarios', () => {
    test('should handle silent + verbose combination correctly', () => {
      const options = {
        silent: true,
        quiet: undefined,
        verbose: true
      };
      
      const logger = new Logger(
        options.silent || options.quiet || false,
        options.verbose && !options.silent && !options.quiet || false,
        false
      );
      
      // Info should be suppressed
      logger.info('Info message');
      expect(logOutput).toHaveLength(0);
      
      // Debug should be suppressed
      logger.verbose('Verbose message');
      expect(logOutput).toHaveLength(0);
      
      // Error should still show
      logger.error('Error message');
      expect(errorOutput).toContain('Error message');
    });

    test('should handle quiet + verbose combination correctly', () => {
      const options = {
        silent: undefined,
        quiet: true,
        verbose: true
      };
      
      const logger = new Logger(
        options.silent || options.quiet || false,
        options.verbose && !options.silent && !options.quiet || false,
        false
      );
      
      // Info should be suppressed
      logger.info('Info message');
      expect(logOutput).toHaveLength(0);
      
      // Debug should be suppressed
      logger.verbose('Verbose message');
      expect(logOutput).toHaveLength(0);
      
      // Error should still show
      logger.error('Error message');
      expect(errorOutput).toContain('Error message');
    });

    test('should handle all flags set correctly', () => {
      const options = {
        silent: true,
        quiet: true,
        verbose: true
      };
      
      const logger = new Logger(
        options.silent || options.quiet || false,
        options.verbose && !options.silent && !options.quiet || false,
        false
      );
      
      // Info should be suppressed
      logger.info('Info message');
      expect(logOutput).toHaveLength(0);
      
      // Debug should be suppressed
      logger.verbose('Verbose message');
      expect(logOutput).toHaveLength(0);
      
      // Error should still show
      logger.error('Error message');
      expect(errorOutput).toContain('Error message');
    });
  });

  describe('Message type behavior', () => {
    test('should handle all message types in silent mode', () => {
      const logger = new Logger(true, false, false);
      
      logger.info('Info message');
      logger.verbose('Verbose message');
      logger.error('Error message');
      logger.warn('Warning message');
      
      expect(logOutput).toHaveLength(0);
      expect(errorOutput).toHaveLength(2);
      expect(errorOutput).toContain('Error message');
      expect(errorOutput).toContain('Warning message');
    });

    test('should handle all message types in verbose mode', () => {
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

    test('should handle all message types in normal mode', () => {
      const logger = new Logger(false, false, false);
      
      logger.info('Info message');
      logger.verbose('Verbose message');
      logger.error('Error message');
      logger.warn('Warning message');
      
      expect(logOutput).toHaveLength(1);
      expect(logOutput).toContain('Info message');
      expect(errorOutput).toHaveLength(2);
      expect(errorOutput).toContain('Error message');
      expect(errorOutput).toContain('Warning message');
    });
  });

  describe('Silent Mode Flag Detection', () => {
    test('should detect silent flag', () => {
      const options = { silent: true };
      expect(isSilentMode(options)).toBe(true);
    });

    test('should detect quiet flag', () => {
      const options = { quiet: true };
      expect(isSilentMode(options)).toBe(true);
    });

    test('should prioritize silent over quiet', () => {
      const options = { silent: true, quiet: true };
      expect(isSilentMode(options)).toBe(true);
    });

    test('should return false when no flags', () => {
      const options = {};
      expect(isSilentMode(options)).toBe(false);
    });

    test('should return false when flags are falsy', () => {
      const options = { silent: false, quiet: false };
      expect(isSilentMode(options)).toBe(false);
    });

    test('should handle undefined flags', () => {
      const options = { silent: undefined, quiet: undefined };
      expect(isSilentMode(options)).toBe(false);
    });
  });

  describe('Stdio Configuration Selection', () => {
    test('should return inherit config for normal mode', () => {
      const config = selectStdioConfig(false);
      expect(config).toEqual(['inherit', 'inherit', 'inherit']);
    });

    test('should return pipe config for silent mode', () => {
      const config = selectStdioConfig(true);
      expect(config).toEqual(['inherit', 'pipe', 'pipe']);
    });

    test('should preserve stdin inherit in silent mode', () => {
      const config = selectStdioConfig(true);
      expect(config[0]).toBe('inherit');
    });

    test('should pipe stdout in silent mode', () => {
      const config = selectStdioConfig(true);
      expect(config[1]).toBe('pipe');
    });

    test('should pipe stderr in silent mode', () => {
      const config = selectStdioConfig(true);
      expect(config[2]).toBe('pipe');
    });
  });

  describe('Integration with Existing Logger Tests', () => {
    test('should maintain consistency between flag detection and logger creation', () => {
      const testCases = [
        { silent: true, quiet: false, verbose: false },
        { silent: false, quiet: true, verbose: false },
        { silent: true, quiet: true, verbose: false },
        { silent: false, quiet: false, verbose: false },
        { silent: undefined, quiet: undefined, verbose: undefined }
      ];

      testCases.forEach(options => {
        const isSilent = isSilentMode(options);
        const logger = new Logger(
        options.silent || options.quiet || false,
        options.verbose && !options.silent && !options.quiet || false,
        false
      );
        
        // Test logger behavior to verify silent mode
        logger.info('Test message');
        if (isSilent) {
          expect(logOutput).toHaveLength(0);
        } else {
          expect(logOutput).toContain('Test message');
        }
        
        // Reset log output for next test
        logOutput = [];
      });
    });

    test('should handle flag precedence scenarios correctly', () => {
      const options = { silent: true, quiet: true, verbose: true };
      
      // Silent mode should be detected
      expect(isSilentMode(options)).toBe(true);
      
      // Logger should behave as silent (info suppressed)
      const logger = new Logger(
        options.silent || options.quiet || false,
        options.verbose && !options.silent && !options.quiet || false,
        false
      );
      logger.info('Test message');
      expect(logOutput).toHaveLength(0);
      
      // Stdio should be configured for silent mode
      const config = selectStdioConfig(true);
      expect(config).toEqual(['inherit', 'pipe', 'pipe']);
    });
  });
});