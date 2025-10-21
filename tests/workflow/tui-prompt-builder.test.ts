/**
 * Tests for TUIPromptBuilder component
 */

import { TUIPromptBuilder } from '../../src/workflow/tui-prompt-builder';

describe('TUIPromptBuilder', () => {
  describe('buildConfirmationPrompt', () => {
    it('should build valid bash confirmation', () => {
      const prompt = TUIPromptBuilder.buildConfirmationPrompt('Continue?');
      
      expect(prompt).toContain('bash -c');
      expect(prompt).toContain('read -p');
      expect(prompt).toContain('Continue?');
      expect(prompt).toContain('[y/N]');
    });

    it('should escape shell special characters', () => {
      const prompt = TUIPromptBuilder.buildConfirmationPrompt(
        "Don't delete?"
      );
      
      // Should handle single quotes safely
      expect(prompt).not.toContain("Don't");
      expect(prompt).toContain('Don');
    });

    it('should support default values', () => {
      const promptYes = TUIPromptBuilder.buildConfirmationPrompt(
        'Test?',
        true
      );
      const promptNo = TUIPromptBuilder.buildConfirmationPrompt(
        'Test?',
        false
      );
      
      expect(promptYes).toContain('[Y/n]');
      expect(promptNo).toContain('[y/N]');
    });
  });

  describe('buildSelectionPrompt', () => {
    it('should build valid selection menu', () => {
      const prompt = TUIPromptBuilder.buildSelectionPrompt(
        'Choose:',
        ['option1', 'option2', 'option3']
      );
      
      expect(prompt).toContain('select opt in');
      expect(prompt).toContain('option1');
      expect(prompt).toContain('option2');
      expect(prompt).toContain('option3');
    });

    it('should escape options with special characters', () => {
      const prompt = TUIPromptBuilder.buildSelectionPrompt(
        'Choose:',
        ["Option A", "Option B's", 'Option "C"']
      );
      
      // Should handle various special characters with proper escaping
      expect(prompt).toContain("'Option A'");
      expect(prompt).toContain("'Option B'\\''s'");
      expect(prompt).toContain("'Option \"C\"'");
    });
  });

  describe('buildInputPrompt', () => {
    it('should build valid input prompt', () => {
      const prompt = TUIPromptBuilder.buildInputPrompt(
        'Enter name:',
        'default'
      );
      
      expect(prompt).toContain('read -p');
      expect(prompt).toContain('Enter name:');
      expect(prompt).toContain('default');
    });

    it('should include validator when provided', () => {
      const prompt = TUIPromptBuilder.buildInputPrompt(
        'Enter email:',
        undefined,
        '^[a-z]+@[a-z]+\\.[a-z]+$'
      );
      
      expect(prompt).toContain('=~');
      expect(prompt).toContain('[a-z]+@');
    });

    it('should handle input without default', () => {
      const prompt = TUIPromptBuilder.buildInputPrompt(
        'Enter value:'
      );
      
      expect(prompt).toContain('read -p');
      expect(prompt).toContain('Enter value:');
      expect(prompt).toContain('input=${input:-}');
    });
  });

  describe('security', () => {
    it('should prevent command injection in confirmation', () => {
      const malicious = "'; rm -rf / #";
      const prompt = TUIPromptBuilder.buildConfirmationPrompt(malicious);
      
      // Should properly escape the malicious content within bash quotes
      expect(prompt).toContain("''\\''; rm -rf / #'");
      expect(prompt).toContain("'");
      // Verify it's within a bash -c context
      expect(prompt).toContain('bash -c');
    });

    it('should prevent command injection in selection', () => {
      const maliciousOptions = ["'; rm -rf / #", 'normal'];
      const prompt = TUIPromptBuilder.buildSelectionPrompt('Choose:', maliciousOptions);
      
      // Should properly escape the malicious content within bash quotes
      expect(prompt).toContain("''\\''; rm -rf / #'");
      expect(prompt).toContain("'normal'");
      // Verify it's within a bash -c context
      expect(prompt).toContain('bash -c');
    });

    it('should prevent command injection in input', () => {
      const malicious = "'; rm -rf / #";
      const prompt = TUIPromptBuilder.buildInputPrompt(malicious);
      
      // Should properly escape the malicious content within bash quotes
      expect(prompt).toContain("''\\''; rm -rf / #'");
      expect(prompt).toContain("'");
      // Verify it's within a bash -c context
      expect(prompt).toContain('bash -c');
    });
  });

  describe('edge cases', () => {
    it('should handle empty message', () => {
      const prompt = TUIPromptBuilder.buildConfirmationPrompt('');
      
      expect(prompt).toContain('bash -c');
      expect(prompt).toContain('read -p');
    });

    it('should handle empty options array', () => {
      const prompt = TUIPromptBuilder.buildSelectionPrompt('Choose:', []);
      
      expect(prompt).toContain('bash -c');
      expect(prompt).toContain('select opt in');
    });

    it('should handle long messages', () => {
      const longMessage = 'A'.repeat(1000);
      const prompt = TUIPromptBuilder.buildConfirmationPrompt(longMessage);
      
      expect(prompt).toContain(longMessage);
    });
  });
});