/**
 * Unit tests for ConfirmationBuilder
 */

import { ConfirmationBuilder } from '../../src/workflow/confirmation-builder';

describe('ConfirmationBuilder', () => {
  describe('buildTimedConfirmation', () => {
    it('should build valid timed confirmation command', () => {
      const command = ConfirmationBuilder.buildTimedConfirmation(
        'Continue?',
        30000,
        false
      );
      
      expect(command).toContain('read -t 30');
      expect(command).toContain('Continue?');
      expect(command).toContain('[y/N]');
      expect(command).toContain('/dev/tty');
    });

    it('should handle default value true', () => {
      const command = ConfirmationBuilder.buildTimedConfirmation(
        'Accept?',
        15000,
        true
      );
      
      expect(command).toContain('[Y/n]');
      expect(command).toContain('exit 0'); // Default exit for timeout
    });

    it('should convert milliseconds to seconds', () => {
      const command = ConfirmationBuilder.buildTimedConfirmation(
        'Test?',
        45500,  // 45.5 seconds
        false
      );

      // Should round up to 46 seconds
      expect(command).toContain('read -t 46');
    });

    it('should handle zero timeout', () => {
      const command = ConfirmationBuilder.buildTimedConfirmation(
        'Test?',
        0,
        false
      );

      expect(command).toContain('read -t 0');
    });
  });

  describe('escapePromptText', () => {
    it('should escape single quotes', () => {
      const escaped = ConfirmationBuilder.escapePromptText("Don't stop");
      expect(escaped).not.toContain("Don't");
      expect(escaped).toContain('Don');
    });

    it('should escape double quotes', () => {
      const escaped = ConfirmationBuilder.escapePromptText('Say "yes"');
      expect(escaped).toContain('\\"yes\\"');
    });

    it('should escape backticks', () => {
      const escaped = ConfirmationBuilder.escapePromptText('Run `command`');
      expect(escaped).toContain('\\`command\\`');
    });

    it('should escape dollar signs', () => {
      const escaped = ConfirmationBuilder.escapePromptText('Cost is $100');
      expect(escaped).toContain('\\$100');
    });

    it('should handle complex injection attempts', () => {
      const malicious = "'; rm -rf / #";
      const escaped = ConfirmationBuilder.escapePromptText(malicious);
      
      // Should escape dangerous characters
      expect(escaped).toContain('\\; rm -rf'); // Escaped semicolon
      expect(escaped).toContain("'\\\"'\\\"'"); // Escaped single quote
      expect(escaped).not.toContain("'; rm -rf"); // Raw dangerous sequence should be escaped
    });

    it('should handle newlines and carriage returns', () => {
      const text = 'Line 1\nLine 2\rLine 3';
      const escaped = ConfirmationBuilder.escapePromptText(text);
      
      expect(escaped).toContain('\\n');
      expect(escaped).toContain('\\r');
    });

    it('should handle backslashes', () => {
      const escaped = ConfirmationBuilder.escapePromptText('Path\\to\\file');
      expect(escaped).toContain('\\\\');
    });
  });

  describe('security validation', () => {
    it('should reject empty messages', () => {
      expect(() => {
        ConfirmationBuilder.buildTimedConfirmation('', 30000, false);
      }).toThrow('cannot be empty');
    });

    it('should reject whitespace-only messages', () => {
      expect(() => {
        ConfirmationBuilder.buildTimedConfirmation('   ', 30000, false);
      }).toThrow('cannot be empty');
    });

    it('should reject overly long messages', () => {
      const longMessage = 'x'.repeat(600);
      expect(() => {
        ConfirmationBuilder.buildTimedConfirmation(longMessage, 30000, false);
      }).toThrow('too long');
    });

    it('should reject messages with control characters', () => {
      const messageWithControl = 'Test\x00Message\x1F';
      expect(() => {
        ConfirmationBuilder.buildTimedConfirmation(messageWithControl, 30000, false);
      }).toThrow('invalid control characters');
    });

    it('should accept normal messages', () => {
      expect(() => {
        ConfirmationBuilder.buildTimedConfirmation('Normal message with spaces!', 30000, false);
      }).not.toThrow();
    });

    it('should accept messages at length limit', () => {
      const maxLengthMessage = 'x'.repeat(500);
      expect(() => {
        ConfirmationBuilder.buildTimedConfirmation(maxLengthMessage, 30000, false);
      }).not.toThrow();
    });
  });

  describe('command structure', () => {
    it('should create syntactically valid bash commands', () => {
      const command = ConfirmationBuilder.buildTimedConfirmation('Test?', 10000, false);
      
      // Should be a single line after trimming
      expect(command).not.toContain('\n');
      
      // Should have proper read -t structure
      expect(command).toMatch(/^if read -t \d+ -p ".*" -n 1 answer < \/dev\/tty; then echo; \[\[ "\$answer" =~ \^\[Yy\]\$ \]\] && exit 0 \|\| \[\[ "\$answer" =~ \^\[Nn\]\$ \]\] && exit 1 \|\| exit 1; else echo; exit 1; fi$/);
    });

    it('should handle timeout exit code correctly', () => {
      const command = ConfirmationBuilder.buildTimedConfirmation('Test?', 5000, true);
      
      // Should exit with 0 (default true) on timeout
      expect(command).toContain('exit 0');
    });

    it('should handle confirmation logic correctly', () => {
      const command = ConfirmationBuilder.buildTimedConfirmation('Test?', 5000, false);
      
      // Should have proper read and conditional logic
      expect(command).toContain('read -t');
      expect(command).toContain('[[ "$answer" =~ ^[Yy]$ ]]');
      expect(command).toContain('[[ "$answer" =~ ^[Nn]$ ]]');
    });
  });
});