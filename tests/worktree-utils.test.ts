import {
  isWorktree,
  getMainWorkspacePath,
  getWorktreeName,
  generateWorktreeContainerName,
  validateBranchName,
  getAllWorktrees,
  shouldCopyDevContainer,
  copyDevContainerToWorktree
} from '../src/utils/worktree-utils';
import { getCurrentBranch } from '../src/utils/config';
import * as fs from 'fs';
import { execSync } from 'child_process';

// Mock fs and execSync for testing
jest.mock('fs');
jest.mock('child_process');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('Worktree Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateBranchName', () => {
    it('should validate correct branch names', () => {
      expect(validateBranchName('main')).toBe(true);
      expect(validateBranchName('feature-auth')).toBe(true);
      expect(validateBranchName('feature/ui')).toBe(true);
      expect(validateBranchName('hotfix/123')).toBe(true);
      expect(validateBranchName('release/v1.0.0')).toBe(true);
    });

    it('should reject invalid branch names', () => {
      expect(validateBranchName('')).toBe(false);
      expect(validateBranchName('feature auth')).toBe(false);
      expect(validateBranchName('feature@auth')).toBe(false);
      expect(validateBranchName('feature$auth')).toBe(false);
    });
  });

  describe('getWorktreeName', () => {
    it('should extract worktree name from path', () => {
      expect(getWorktreeName('/path/to/worktrees/feature-auth')).toBe('feature-auth');
      expect(getWorktreeName('/path/to/worktrees/feature-ui')).toBe('feature-ui');
    });
  });

  describe('generateWorktreeContainerName', () => {
    it('should generate correct container names', () => {
      expect(generateWorktreeContainerName('aisanity', 'feature-auth')).toBe('aisanity-feature-auth');
      expect(generateWorktreeContainerName('my-project', 'feature-ui')).toBe('my-project-feature-ui');
      expect(generateWorktreeContainerName('test_project', 'hotfix/123')).toBe('test_project-hotfix-123');
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch from git', () => {
      mockedExecSync.mockReturnValue('feature-auth\n');
      
      const result = getCurrentBranch('/test/path');
      
      expect(result).toBe('feature-auth');
      expect(mockedExecSync).toHaveBeenCalledWith('git rev-parse --abbrev-ref HEAD', {
        cwd: '/test/path',
        encoding: 'utf8',
        stdio: 'pipe'
      });
    });

    it('should return main when git command fails', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('Git not available');
      });
      
      const result = getCurrentBranch('/test/path');
      
      expect(result).toBe('main');
    });
  });

  describe('isWorktree', () => {
    it('should return true when in a worktree', () => {
      mockedExecSync.mockReturnValue('/path/to/.git/worktrees/feature-auth\n');
      
      const result = isWorktree('/test/path');
      
      expect(result).toBe(true);
    });

    it('should return false when not in a worktree', () => {
      mockedExecSync.mockReturnValue('/path/to/.git\n');
      
      const result = isWorktree('/test/path');
      
      expect(result).toBe(false);
    });

    it('should return false when git command fails', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('Git not available');
      });
      
      const result = isWorktree('/test/path');
      
      expect(result).toBe(false);
    });
  });

  describe('getMainWorkspacePath', () => {
    it('should return main repo path from worktree when no parent structure', () => {
      // First call: git rev-parse --show-toplevel
      // Second call: git rev-parse --git-dir
      mockedExecSync
        .mockReturnValueOnce('/path/to\n')  // --show-toplevel
        .mockReturnValueOnce('/path/to/.git/worktrees/feature-auth\n');  // --git-dir
      
      // Mock no parent structure (no .aisanity or worktrees in parent)
      mockedFs.existsSync.mockReturnValue(false);
      
      const result = getMainWorkspacePath('/test/worktree/path');
      
      expect(result).toBe('/path/to');  // Main repo path when no parent structure
    });

    it('should return parent path when .aisanity exists in parent', () => {
      mockedExecSync
        .mockReturnValueOnce('/test/path/.git\n')  // --show-toplevel
        .mockReturnValueOnce('/test/path/.git\n');  // --git-dir
      
      mockedFs.existsSync.mockReturnValueOnce(true);  // parent .aisanity exists
      
      const result = getMainWorkspacePath('/test/path/.git');
      
      expect(result).toBe('/test/path');  // Parent when .aisanity found
    });

    it('should return parent path when worktrees directory exists in parent', () => {
      mockedExecSync
        .mockReturnValueOnce('/test/path\n')  // --show-toplevel
        .mockReturnValueOnce('/test/path/.git\n');  // --git-dir
      
      mockedFs.existsSync
        .mockReturnValueOnce(false)  // no .aisanity in parent
        .mockReturnValueOnce(true);  // but worktrees dir exists
      
      const result = getMainWorkspacePath('/test/path');
      
      expect(result).toBe('/test');  // Parent when worktrees found
    });

    it('should return git root when no parent structure', () => {
      mockedExecSync
        .mockReturnValueOnce('/test/path\n')  // --show-toplevel
        .mockReturnValueOnce('/test/path/.git\n');  // --git-dir
      
      mockedFs.existsSync
        .mockReturnValueOnce(false)  // no .aisanity in parent
        .mockReturnValueOnce(false);  // no worktrees dir
      
      const result = getMainWorkspacePath('/test/path');
      
      expect(result).toBe('/test/path');  // Git root itself
    });
  });

  describe('getAllWorktrees', () => {
    const mockMainConfig = {
      workspace: 'test-project',
      env: {}
    };

    beforeEach(() => {
      // Mock main workspace setup
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('show-toplevel')) return '/test/path/.git\n';
        if (cmd.includes('git-dir')) return '/test/path/.git\n';
        return 'main\n';  // getCurrentBranch
      });
      
      mockedFs.existsSync.mockImplementation((path: any) => {
        if (typeof path === 'string') {
          if (path.includes('.aisanity')) return true;
          if (path.includes('worktrees')) return true;
        }
        return false;
      });
      
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockMainConfig));
      mockedFs.readdirSync.mockReturnValue([
      { name: 'feature-auth', isDirectory: () => true },
      { name: 'feature-ui', isDirectory: () => true }
    ] as any);
      mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
    });

    it('should return worktree list with main workspace', () => {
      const result = getAllWorktrees('/test/path');
      
      expect(result.main.path).toBe('/test/path/.git');  // Now returns git root
      expect(result.main.branch).toBe('main');
      expect(result.main.containerName).toBe('test-project-main');
      expect(Array.isArray(result.worktrees)).toBe(true);
    });

    it('should handle missing worktrees directory', () => {
      mockedFs.existsSync.mockImplementation((path: any) => {
        if (typeof path === 'string') {
          if (path.includes('worktrees')) return false;
          if (path.includes('.aisanity')) return true;
        }
        return false;
      });

      const result = getAllWorktrees('/test/path');

      expect(result.worktrees).toHaveLength(0);
    });
  });

  describe('shouldCopyDevContainer', () => {
    it('should return false if .devcontainer does not exist', () => {
      mockedFs.existsSync.mockReturnValue(false);

      const result = shouldCopyDevContainer('/test/workspace');

      expect(result).toBe(false);
      expect(mockedFs.existsSync).toHaveBeenCalledWith('/test/workspace/.devcontainer');
    });

    it('should return false if .devcontainer is tracked in git', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedExecSync.mockReturnValue(Buffer.from('.devcontainer'));

      const result = shouldCopyDevContainer('/test/workspace');

      expect(result).toBe(false);
      expect(mockedExecSync).toHaveBeenCalledWith('git ls-files --error-unmatch .devcontainer', {
        cwd: '/test/workspace',
        stdio: 'pipe'
      });
    });

    it('should return true if .devcontainer exists but is not tracked in git', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedExecSync.mockImplementation(() => {
        throw new Error('not tracked');
      });

      const result = shouldCopyDevContainer('/test/workspace');

      expect(result).toBe(true);
    });
  });

  describe('copyDevContainerToWorktree', () => {
    it('should throw error if source .devcontainer does not exist', () => {
      mockedFs.existsSync.mockImplementation((path: any) => {
        if (typeof path === 'string' && path.includes('source')) return false;
        return true;
      });

      expect(() => copyDevContainerToWorktree('/source', '/worktree')).toThrow('Source .devcontainer directory does not exist');
    });

    it('should throw error if destination .devcontainer already exists', () => {
      mockedFs.existsSync.mockReturnValue(true);

      expect(() => copyDevContainerToWorktree('/source', '/worktree')).toThrow('Destination .devcontainer directory already exists');
    });

    it('should copy .devcontainer directory successfully', () => {
      mockedFs.existsSync.mockImplementation((path: any) => {
        if (typeof path === 'string' && path.includes('worktree')) return false;
        return true;
      });
      const mockCpSync = jest.spyOn(fs, 'cpSync').mockImplementation(() => {});

      copyDevContainerToWorktree('/source', '/worktree');

      expect(mockCpSync).toHaveBeenCalledWith('/source/.devcontainer', '/worktree/.devcontainer', { recursive: true });
      mockCpSync.mockRestore();
    });
  });
});