import { expect, test, describe } from 'bun:test';
import { validateBranchName } from '../src/utils/worktree-utils';

describe('worktree-create command', () => {
  describe('branch validation', () => {
    test('should validate correct branch names for worktree creation', () => {
      expect(validateBranchName('feature-auth')).toBe(true);
      expect(validateBranchName('feature/ui')).toBe(true);
      expect(validateBranchName('hotfix/123')).toBe(true);
      expect(validateBranchName('release/v1.0.0')).toBe(true);
    });

    test('should reject invalid branch names for worktree creation', () => {
      expect(validateBranchName('')).toBe(false);
      expect(validateBranchName('feature auth')).toBe(false);
      expect(validateBranchName('feature@auth')).toBe(false);
      expect(validateBranchName('feature$auth')).toBe(false);
    });
  });
});