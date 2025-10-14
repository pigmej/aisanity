import { expect, test, describe, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  sanitizeBranchName,
  createAisanityConfig,
  generateExpectedContainerName,
  detectProjectType
} from '../src/utils/config';

describe('Config Utils', () => {
  describe('sanitizeBranchName', () => {
    test('converts to lowercase', () => {
      const result = sanitizeBranchName('Feature-Branch');
      expect(result).toBe('feature-branch');
    });

    test('replaces special characters', () => {
      const result = sanitizeBranchName('feature/branch@name#test');
      expect(result).toBe('feature-branch-name-test');
    });

    test('handles complex names', () => {
      const result = sanitizeBranchName('feat/ADD-123_user-authentication@v2.0');
      expect(result).toBe('feat-add-123-user-authentication-v2-0');
    });
  });

  describe('createAisanityConfig', () => {
    test('creates valid config', () => {
      const result = createAisanityConfig('my-project');
      expect(result).toContain('workspace: my-project');
      expect(result).toContain('env: {}');
    });
  });

  describe('detectProjectType', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = path.join(os.tmpdir(), `config-test-${Date.now()}-${Math.random()}`);
      fs.mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('detects Python project with requirements.txt', () => {
      fs.writeFileSync(path.join(tempDir, 'requirements.txt'), '');
      expect(detectProjectType(tempDir)).toBe('python');
    });

    test('detects Python project with setup.py', () => {
      fs.writeFileSync(path.join(tempDir, 'setup.py'), '');
      expect(detectProjectType(tempDir)).toBe('python');
    });

    test('detects Python project with pyproject.toml', () => {
      fs.writeFileSync(path.join(tempDir, 'pyproject.toml'), '');
      expect(detectProjectType(tempDir)).toBe('python');
    });

    test('detects Python project with Pipfile', () => {
      fs.writeFileSync(path.join(tempDir, 'Pipfile'), '');
      expect(detectProjectType(tempDir)).toBe('python');
    });

    test('detects Bun project with bun.lockb', () => {
      fs.writeFileSync(path.join(tempDir, 'bun.lockb'), '');
      expect(detectProjectType(tempDir)).toBe('bun');
    });

    test('detects Bun project with bun.lock', () => {
      fs.writeFileSync(path.join(tempDir, 'bun.lock'), '');
      expect(detectProjectType(tempDir)).toBe('bun');
    });

    test('prioritizes Bun over Node.js when both files present', () => {
      // Critical test: Bun should be detected before Node.js to prevent misclassification
      fs.writeFileSync(path.join(tempDir, 'bun.lockb'), '');
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
      expect(detectProjectType(tempDir)).toBe('bun');
    });

    test('detects Node.js project with package.json (no Bun lockfile)', () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
      expect(detectProjectType(tempDir)).toBe('nodejs');
    });

    test('detects Go project with go.mod', () => {
      fs.writeFileSync(path.join(tempDir, 'go.mod'), '');
      expect(detectProjectType(tempDir)).toBe('go');
    });

    test('detects Rust project with Cargo.toml', () => {
      fs.writeFileSync(path.join(tempDir, 'Cargo.toml'), '');
      expect(detectProjectType(tempDir)).toBe('rust');
    });

    test('detects Java project with pom.xml', () => {
      fs.writeFileSync(path.join(tempDir, 'pom.xml'), '');
      expect(detectProjectType(tempDir)).toBe('java');
    });

    test('detects Java project with build.gradle', () => {
      fs.writeFileSync(path.join(tempDir, 'build.gradle'), '');
      expect(detectProjectType(tempDir)).toBe('java');
    });

    test('returns unknown for unrecognized project', () => {
      expect(detectProjectType(tempDir)).toBe('unknown');
    });
  });
});