import { expect, test, describe } from 'bun:test';
import {
  getWorktreeName,
  generateWorktreeContainerName,
  validateBranchName,
} from '../src/utils/worktree-utils';

describe('Worktree Utils', () => {
  describe('validateBranchName', () => {
    test('should validate correct branch names', () => {
      expect(validateBranchName('main')).toBe(true);
      expect(validateBranchName('feature-auth')).toBe(true);
      expect(validateBranchName('feature/ui')).toBe(true);
      expect(validateBranchName('hotfix/123')).toBe(true);
      expect(validateBranchName('release/v1.0.0')).toBe(true);
    });

    test('should reject invalid branch names', () => {
      expect(validateBranchName('')).toBe(false);
      expect(validateBranchName('feature auth')).toBe(false);
      expect(validateBranchName('feature@auth')).toBe(false);
      expect(validateBranchName('feature$auth')).toBe(false);
    });
  });

  describe('getWorktreeName', () => {
    test('should extract worktree name from path', () => {
      expect(getWorktreeName('/path/to/worktrees/feature-auth')).toBe('feature-auth');
      expect(getWorktreeName('/path/to/worktrees/feature-ui')).toBe('feature-ui');
    });
  });

  describe('generateWorktreeContainerName', () => {
    test('should generate correct container names', () => {
      expect(generateWorktreeContainerName('aisanity', 'feature-auth')).toBe('aisanity-feature-auth');
      expect(generateWorktreeContainerName('my-project', 'feature-ui')).toBe('my-project-feature-ui');
      expect(generateWorktreeContainerName('test_project', 'hotfix/123')).toBe('test_project-hotfix-123');
    });
  });
});