import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import {
  getWorkspaceName,
  getCurrentBranch,
  sanitizeBranchName,
  getContainerName,
  createAisanityConfig,
  loadAisanityConfig,
  generateExpectedContainerName
} from '../src/utils/config';

// Mock fs and execSync
jest.mock('fs');
jest.mock('child_process');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('Config Utils', () => {
  const tempDir = path.join(os.tmpdir(), 'aisanity-config-test');

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mocks
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue('');
    mockFs.writeFileSync.mockReturnValue(undefined);
    mockExecSync.mockReturnValue('main');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getWorkspaceName', () => {
    it('should return workspace from config if it exists (new format)', () => {
      const mockConfig = { workspace: 'my-project' };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const result = getWorkspaceName('/test/path');
      expect(result).toBe('my-project');
    });

    it('should extract project name from legacy config format', () => {
      const mockConfig = { workspace: 'my-project_feature-branch' };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const result = getWorkspaceName('/test/path');
      expect(result).toBe('my-project');
    });

    it('should handle complex legacy config with multiple underscores', () => {
      const mockConfig = { workspace: 'my_complex_project_feature-branch' };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const result = getWorkspaceName('/test/path');
      expect(result).toBe('my_complex_project');
    });

    it('should generate workspace name from folder if no config exists', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = getWorkspaceName('/test/path/my_project');
      expect(result).toBe('my_project');
    });

    it('should sanitize folder name when generating workspace', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = getWorkspaceName('/test/path/my project@123');
      expect(result).toBe('my_project_123');
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch from git', () => {
      mockExecSync.mockReturnValue('feature-branch');

      const result = getCurrentBranch('/test/path');
      expect(result).toBe('feature-branch');
      expect(mockExecSync).toHaveBeenCalledWith('git rev-parse --abbrev-ref HEAD', {
        cwd: '/test/path',
        encoding: 'utf8',
        stdio: 'pipe'
      });
    });

    it('should return main when git command fails', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Git not available');
      });

      const result = getCurrentBranch('/test/path');
      expect(result).toBe('main');
    });

    it('should return main when git command returns empty string', () => {
      mockExecSync.mockReturnValue('');

      const result = getCurrentBranch('/test/path');
      expect(result).toBe('main');
    });
  });

  describe('sanitizeBranchName', () => {
    it('should convert to lowercase', () => {
      const result = sanitizeBranchName('Feature-Branch');
      expect(result).toBe('feature-branch');
    });

    it('should replace special characters with hyphens', () => {
      const result = sanitizeBranchName('feature/branch@name#test');
      expect(result).toBe('feature-branch-name-test');
    });

    it('should replace multiple hyphens with single hyphen', () => {
      const result = sanitizeBranchName('feature--branch---name');
      expect(result).toBe('feature-branch-name');
    });

    it('should remove leading and trailing hyphens', () => {
      const result = sanitizeBranchName('-feature-branch-');
      expect(result).toBe('feature-branch');
    });

    it('should handle complex branch names', () => {
      const result = sanitizeBranchName('feat/ADD-123_user-authentication@v2.0');
      expect(result).toBe('feat-add-123-user-authentication-v2-0');
    });
  });

  describe('getContainerName', () => {
    it('should return explicit containerName from config', () => {
      const mockConfig = { 
        workspace: 'my-project', 
        containerName: 'custom-container-name' 
      };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const result = getContainerName('/test/path');
      expect(result).toBe('custom-container-name');
    });

    it('should generate dynamic container name when not explicitly set', () => {
      const mockConfig = { workspace: 'my-project' };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
      mockExecSync.mockReturnValue('feature-branch');

      // Mock console.error to capture the auto-generation message
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = getContainerName('/test/path');
      expect(result).toBe('my-project-feature-branch');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Auto-generated container name: my-project-feature-branch (workspace: my-project, branch: feature-branch)'
      );

      consoleSpy.mockRestore();
    });

    it('should throw error when no config found', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => getContainerName('/test/path')).toThrow('No .aisanity config found');
    });
  });

  describe('createAisanityConfig', () => {
    it('should create config with branch-agnostic workspace name', () => {
      const result = createAisanityConfig('my-project');
      
      expect(result).toContain('workspace: my-project');
      expect(result).not.toContain('containerName');
      expect(result).toContain('env: {}');
    });
  });

  describe('generateExpectedContainerName', () => {
    it('should generate container name with sanitized branch', () => {
      mockExecSync.mockReturnValue('feature/branch-test');

      const result = generateExpectedContainerName('/test/path/my-project');
      expect(result).toBe('my-project-feature-branch-test');
    });

    it('should handle main branch', () => {
      mockExecSync.mockReturnValue('main');

      const result = generateExpectedContainerName('/test/path/my-project');
      expect(result).toBe('my-project-main');
    });
  });
});