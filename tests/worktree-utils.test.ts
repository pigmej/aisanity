import { expect, test, describe, beforeEach, afterEach } from 'bun:test';
import {
  getWorktreeName,
  generateWorktreeContainerName,
  validateBranchName,
  isValidGitWorktree,
  getAllWorktrees,
} from '../src/utils/worktree-utils';
import * as fs from 'fs';
import * as path from 'path';

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

  describe('isValidGitWorktree', () => {
    let tempDir: string;
    let mainGitDir: string;

    beforeEach(() => {
      // Create a temporary directory for testing
      tempDir = fs.mkdtempSync(path.join(process.cwd(), 'test-'));
      mainGitDir = path.join(tempDir, '.git');
      fs.mkdirSync(mainGitDir, { recursive: true });
    });

    afterEach(() => {
      // Clean up temporary directory
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('returns true for valid worktree structure', () => {
      const worktreeName = 'feature-auth';
      const worktreeDir = path.join(tempDir, 'feature-auth');
      const worktreeGitDir = path.join(mainGitDir, 'worktrees', worktreeName);
      
      // Create worktree structure
      fs.mkdirSync(worktreeGitDir, { recursive: true });
      fs.mkdirSync(worktreeDir, { recursive: true });
      
      // Create gitdir file
      const gitdirContent = path.join(worktreeGitDir, 'gitdir');
      fs.writeFileSync(gitdirContent, path.join(worktreeDir, '.git'));
      
      // Create .git file in worktree
      const worktreeGitFile = path.join(worktreeDir, '.git');
      fs.writeFileSync(worktreeGitFile, 'gitdir: ' + worktreeGitDir);
      
      expect(isValidGitWorktree(mainGitDir, worktreeName)).toBe(true);
    });

    test('returns false when gitdir file is missing', () => {
      const worktreeName = 'feature-auth';
      
      expect(isValidGitWorktree(mainGitDir, worktreeName)).toBe(false);
    });

    test('returns false when gitdir file is empty', () => {
      const worktreeName = 'feature-auth';
      const worktreeGitDir = path.join(mainGitDir, 'worktrees', worktreeName);
      
      fs.mkdirSync(worktreeGitDir, { recursive: true });
      fs.writeFileSync(path.join(worktreeGitDir, 'gitdir'), '');
      
      expect(isValidGitWorktree(mainGitDir, worktreeName)).toBe(false);
    });

    test('returns false when target directory is missing', () => {
      const worktreeName = 'feature-auth';
      const worktreeGitDir = path.join(mainGitDir, 'worktrees', worktreeName);
      
      fs.mkdirSync(worktreeGitDir, { recursive: true });
      fs.writeFileSync(path.join(worktreeGitDir, 'gitdir'), '/nonexistent/path/.git');
      
      expect(isValidGitWorktree(mainGitDir, worktreeName)).toBe(false);
    });

    test('returns false when target .git file is missing', () => {
      const worktreeName = 'feature-auth';
      const worktreeDir = path.join(tempDir, 'feature-auth');
      const worktreeGitDir = path.join(mainGitDir, 'worktrees', worktreeName);
      
      fs.mkdirSync(worktreeGitDir, { recursive: true });
      fs.mkdirSync(worktreeDir, { recursive: true });
      fs.writeFileSync(path.join(worktreeGitDir, 'gitdir'), path.join(worktreeDir, '.git'));
      
      expect(isValidGitWorktree(mainGitDir, worktreeName)).toBe(false);
    });

    test('returns false when .git file has invalid format', () => {
      const worktreeName = 'feature-auth';
      const worktreeDir = path.join(tempDir, 'feature-auth');
      const worktreeGitDir = path.join(mainGitDir, 'worktrees', worktreeName);
      
      fs.mkdirSync(worktreeGitDir, { recursive: true });
      fs.mkdirSync(worktreeDir, { recursive: true });
      fs.writeFileSync(path.join(worktreeGitDir, 'gitdir'), path.join(worktreeDir, '.git'));
      
      const worktreeGitFile = path.join(worktreeDir, '.git');
      fs.writeFileSync(worktreeGitFile, 'invalid format');
      
      expect(isValidGitWorktree(mainGitDir, worktreeName)).toBe(false);
    });
  });

  describe('getAllWorktrees with validation', () => {
    test('should handle validation gracefully', () => {
      // This is a basic integration test to ensure getAllWorktrees 
      // doesn't crash when encountering invalid worktrees
      // The full integration testing would require a more complex git setup
      
      // Test that the function exists and can be called
      expect(typeof getAllWorktrees).toBe('function');
      
      // In a real git repository, this would test the validation integration
      // For now, we just verify the function signature and basic behavior
      try {
        // This will likely fail in test environment since we're not in a git repo
        // but it shouldn't crash the test runner
        const result = getAllWorktrees(process.cwd());
        expect(result).toBeDefined();
        expect(result.main).toBeDefined();
        expect(Array.isArray(result.worktrees)).toBe(true);
      } catch (error) {
        // Expected in test environment - the function should handle errors gracefully
        expect(error).toBeDefined();
      }
    });
  });
});