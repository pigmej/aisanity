import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  getDevContainerTemplate,
  readDevContainerJson,
  createBranchSpecificDevContainer,
  getBranchSpecificDevContainerPath,
  getBaseDevContainerPath,
  FileNotFoundError,
  InvalidJsonError,
  PermissionError,
  DiskSpaceError
} from '../src/utils/devcontainer-templates';
import { ProjectType } from '../src/utils/config';

describe('Devcontainer Templates', () => {
  describe('getDevContainerTemplate', () => {
    it('should return Python devcontainer for python project type', () => {
      const template = getDevContainerTemplate('python');
      expect(template).toBeDefined();
      expect(template?.devcontainerJson).toContain('Python Development');
      expect(template?.devcontainerJson).toContain('mcr.microsoft.com/devcontainers/python:3.11');
    });

    it('should return Node.js devcontainer for nodejs project type', () => {
      const template = getDevContainerTemplate('nodejs');
      expect(template).toBeDefined();
      expect(template?.devcontainerJson).toContain('Node.js Development');
      expect(template?.devcontainerJson).toContain('mcr.microsoft.com/devcontainers/javascript-node:18');
    });

    it('should return Go devcontainer for go project type', () => {
      const template = getDevContainerTemplate('go');
      expect(template).toBeDefined();
      expect(template?.devcontainerJson).toContain('Go Development Environment');
      expect(template?.devcontainerJson).toContain('mcr.microsoft.com/devcontainers/go:1.21');
    });

    it('should return Rust devcontainer for rust project type', () => {
      const template = getDevContainerTemplate('rust');
      expect(template).toBeDefined();
      expect(template?.devcontainerJson).toContain('Rust Development Environment');
      expect(template?.devcontainerJson).toContain('mcr.microsoft.com/devcontainers/rust:1');
    });

    it('should return Java devcontainer for java project type', () => {
      const template = getDevContainerTemplate('java');
      expect(template).toBeDefined();
      expect(template?.devcontainerJson).toContain('Java Development Environment');
      expect(template?.devcontainerJson).toContain('mcr.microsoft.com/devcontainers/java:17');
    });

    it('should return empty devcontainer for unknown project type', () => {
      const template = getDevContainerTemplate('unknown');
      expect(template).toBeDefined();
      expect(template?.devcontainerJson).toContain('Empty Development Environment');
      expect(template?.devcontainerJson).toContain('mcr.microsoft.com/devcontainers/base:ubuntu');
    });

    it('should return null for invalid project type', () => {
      const template = getDevContainerTemplate('invalid' as ProjectType);
      expect(template).toBeNull();
    });
  });

  describe('readDevContainerJson', () => {
    const tempDir = path.join(os.tmpdir(), 'devcontainer-test');

    beforeEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should read and parse valid JSON file', () => {
      const filePath = path.join(tempDir, 'devcontainer.json');
      const jsonContent = { name: 'Test', image: 'test:latest' };
      fs.writeFileSync(filePath, JSON.stringify(jsonContent), 'utf8');

      const result = readDevContainerJson(filePath);
      expect(result).toEqual(jsonContent);
    });

    it('should throw FileNotFoundError for non-existent file', () => {
      const filePath = path.join(tempDir, 'nonexistent.json');
      expect(() => readDevContainerJson(filePath)).toThrow(FileNotFoundError);
      expect(() => readDevContainerJson(filePath)).toThrow(`File not found: ${filePath}`);
    });

    it('should throw InvalidJsonError for invalid JSON', () => {
      const filePath = path.join(tempDir, 'invalid.json');
      fs.writeFileSync(filePath, '{ invalid json }', 'utf8');

      expect(() => readDevContainerJson(filePath)).toThrow(InvalidJsonError);
      expect(() => readDevContainerJson(filePath)).toThrow(`Invalid JSON in file: ${filePath}`);
    });

    // Note: PermissionError test would require setting up file permissions, which is complex in a test environment
  });

  describe('createBranchSpecificDevContainer', () => {
    const tempDir = path.join(os.tmpdir(), 'devcontainer-create-test');

    beforeEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should create branch-specific file with containerName', () => {
      const basePath = path.join(tempDir, 'devcontainer.json');
      const branchPath = path.join(tempDir, 'devcontainer_branch.json');
      const baseContent = { name: 'Base', image: 'base:latest' };
      fs.writeFileSync(basePath, JSON.stringify(baseContent, null, 2), 'utf8');

      createBranchSpecificDevContainer(basePath, branchPath, 'test-container');

      expect(fs.existsSync(branchPath)).toBe(true);
      const result = JSON.parse(fs.readFileSync(branchPath, 'utf8'));
      expect(result).toEqual({
        ...baseContent,
        containerName: 'test-container'
      });
    });

    it('should create .devcontainer directory if it does not exist', () => {
      const devcontainerDir = path.join(tempDir, '.devcontainer');
      const basePath = path.join(devcontainerDir, 'devcontainer.json');
      const branchPath = path.join(devcontainerDir, 'devcontainer_branch.json');
      const baseContent = { name: 'Base', image: 'base:latest' };

      // Ensure .devcontainer doesn't exist
      if (fs.existsSync(devcontainerDir)) {
        fs.rmSync(devcontainerDir, { recursive: true });
      }

      fs.mkdirSync(devcontainerDir, { recursive: true });
      fs.writeFileSync(basePath, JSON.stringify(baseContent, null, 2), 'utf8');

      createBranchSpecificDevContainer(basePath, branchPath, 'test-container');

      expect(fs.existsSync(devcontainerDir)).toBe(true);
      expect(fs.existsSync(branchPath)).toBe(true);
    });

    it('should throw error for invalid containerName', () => {
      const basePath = path.join(tempDir, 'devcontainer.json');
      const branchPath = path.join(tempDir, 'devcontainer_branch.json');
      const baseContent = { name: 'Base', image: 'base:latest' };
      fs.writeFileSync(basePath, JSON.stringify(baseContent, null, 2), 'utf8');

      expect(() => createBranchSpecificDevContainer(basePath, branchPath, '')).toThrow('containerName must be a non-empty string');
      expect(() => createBranchSpecificDevContainer(basePath, branchPath, '   ')).toThrow('containerName must be a non-empty string');
      expect(() => createBranchSpecificDevContainer(basePath, branchPath, null as any)).toThrow('containerName must be a non-empty string');
    });

    it('should throw FileNotFoundError if base file does not exist', () => {
      const basePath = path.join(tempDir, 'nonexistent.json');
      const branchPath = path.join(tempDir, 'devcontainer_branch.json');

      expect(() => createBranchSpecificDevContainer(basePath, branchPath, 'test-container')).toThrow(FileNotFoundError);
    });

    it('should throw InvalidJsonError if base file has invalid JSON', () => {
      const basePath = path.join(tempDir, 'invalid.json');
      const branchPath = path.join(tempDir, 'devcontainer_branch.json');
      fs.writeFileSync(basePath, '{ invalid json }', 'utf8');

      expect(() => createBranchSpecificDevContainer(basePath, branchPath, 'test-container')).toThrow(InvalidJsonError);
    });
  });

  describe('getBranchSpecificDevContainerPath', () => {
    it('should return correct path for branch', () => {
      const cwd = '/home/user/project';
      const branch = 'feature-branch';
      const expected = path.join(cwd, '.devcontainer', 'devcontainer_feature_branch.json');
      expect(getBranchSpecificDevContainerPath(cwd, branch)).toBe(expected);
    });

    it('should sanitize branch name with special characters', () => {
      const cwd = '/home/user/project';
      const branch = 'feature/branch-with-dashes';
      const expected = path.join(cwd, '.devcontainer', 'devcontainer_feature_branch_with_dashes.json');
      expect(getBranchSpecificDevContainerPath(cwd, branch)).toBe(expected);
    });
  });

  describe('getBaseDevContainerPath', () => {
    it('should return correct path for base devcontainer', () => {
      const cwd = '/home/user/project';
      const expected = path.join(cwd, '.devcontainer', 'devcontainer.json');
      expect(getBaseDevContainerPath(cwd)).toBe(expected);
    });
  });
});