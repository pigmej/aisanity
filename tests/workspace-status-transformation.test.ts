import { describe, it, expect, beforeEach } from 'bun:test';
import { 
  validateAndExtractLabels,
  shouldIncludeContainer,
  resolveWorktreeStatus,
  groupContainersByWorkspace,
  WorkspaceStatusRow,
  ContainerLabelValidation,
  ContainerError,
  ContainerWarning
} from '../src/commands/status';
import { WorktreeInfo } from '../src/utils/worktree-utils';
import { Container } from '../src/utils/container-utils';

// Mock the dependencies
const mockWorktreeInfo = (branch: string, path: string, isActive: boolean = false, containerName?: string): WorktreeInfo => ({
  path,
  branch,
  isActive,
  containerName: containerName || `aisanity-${branch.replace('/', '-')}`,
  configPath: `${path}/.aisanity/config.json`
});

const mockContainer = (name: string, labels: Record<string, string>, status: 'Running' | 'Stopped' | 'Not created' = 'Running', ports: string[] = []): Container => ({
  id: 'abc123',
  name,
  status,
  ports,
  labels
});

describe('WorkspaceStatusRow transformation', () => {
  let worktreeMap: Map<string, WorktreeInfo>;

  beforeEach(() => {
    worktreeMap = new Map([
      ['main', mockWorktreeInfo('main', '/project/aisanity', true)],
      ['feature/auth', mockWorktreeInfo('feature/auth', '/project/worktrees/feature-auth', false)],
    ]);
  });

  it('should validate container with all labels present', () => {
    const container = mockContainer('aisanity-main', {
      'aisanity.workspace': '/project',
      'aisanity.branch': 'main'
    });

    const validation = validateAndExtractLabels(container, worktreeMap, '/project');

    expect(validation.isValid).toBe(true);
    expect(validation.hasWorkspaceLabel).toBe(true);
    expect(validation.hasBranchLabel).toBe(true);
    expect(validation.detectedBranch).toBe('main');
    expect(validation.detectionMethod).toBe('label');
    expect(validation.warnings).toHaveLength(0);
  });

  it('should detect branch from container name when label missing', () => {
    const container = mockContainer('aisanity-feature-auth', {
      'aisanity.workspace': '/project'
      // Missing aisanity.branch
    });

    const validation = validateAndExtractLabels(container, worktreeMap, '/project');

    expect(validation.isValid).toBe(false);
    expect(validation.hasBranchLabel).toBe(false);
    expect(validation.detectedBranch).toBe('feature/auth');
    expect(validation.detectionMethod).toBe('name-pattern');
    expect(validation.warnings).toContain('Container aisanity-feature-auth missing aisanity.branch label');
    expect(validation.warnings).toContain('Detected branch \'feature/auth\' from container name');
  });

  it('should detect branch from worktree cross-reference', () => {
    const container = mockContainer('elegant_darwin', {
      'aisanity.workspace': '/project'
    });

    const worktreeMapWithContainer = new Map([
      ['feature/test', mockWorktreeInfo('feature/test', '/project/worktrees/feature-test', false, 'elegant_darwin')]
    ]);

    const validation = validateAndExtractLabels(container, worktreeMapWithContainer, '/project');

    expect(validation.detectedBranch).toBe('feature/test');
    expect(validation.detectionMethod).toBe('worktree-match');
    expect(validation.warnings.length).toBeGreaterThan(0);
  });

  it('should handle container with no detection method', () => {
    const container = mockContainer('random_name_12345', {
      'aisanity.workspace': '/project'
    });

    const validation = validateAndExtractLabels(container, new Map(), '/project');

    expect(validation.isValid).toBe(false);
    expect(validation.detectedBranch).toBeNull();
    expect(validation.detectionMethod).toBe('unknown');
    expect(validation.warnings.length).toBeGreaterThan(0);
  });

  it('should handle containers with empty label values', () => {
    const container = mockContainer('test', {
      'aisanity.workspace': '',  // Empty string
      'aisanity.branch': ''
    });

    const validation = validateAndExtractLabels(container, new Map(), '/project');

    expect(validation.isValid).toBe(false);
    expect(validation.hasWorkspaceLabel).toBe(false);  // Empty treated as missing
    expect(validation.hasBranchLabel).toBe(false);
  });

  it('should filter containers by workspace correctly', () => {
    const container = mockContainer('test', {
      'aisanity.workspace': '/other-project',
      'aisanity.branch': 'main'
    });

    const validation = validateAndExtractLabels(container, new Map(), '/other-project');
    const shouldInclude = shouldIncludeContainer(container, 'my-project', validation);

    expect(shouldInclude).toBe(false);
  });

  it('should include aisanity containers without workspace label', () => {
    const container = mockContainer('aisanity-main', {
      'aisanity.branch': 'main'
      // Missing workspace label
    });

    const validation = validateAndExtractLabels(container, new Map(), '/project');
    const shouldInclude = shouldIncludeContainer(container, 'any-project', validation);

    expect(shouldInclude).toBe(true);
  });

  it('should resolve worktree status for existing worktree', () => {
    const status = resolveWorktreeStatus('feature/auth', worktreeMap);

    expect(status.exists).toBe(true);
    expect(status.name).toBe('feature-auth');
    expect(status.isActive).toBe(false);
  });

  it('should resolve worktree status for non-existent worktree', () => {
    const status = resolveWorktreeStatus('feature/nonexistent', worktreeMap);

    expect(status.exists).toBe(false);
    expect(status.name).toBe('none');
    expect(status.isActive).toBe(false);
  });

  it('should identify active worktree', () => {
    const status = resolveWorktreeStatus('main', worktreeMap);

    expect(status.isActive).toBe(true);
  });

  it('should handle main branch specially in worktree resolution', () => {
    const mainWorktreeMap = new Map([
      ['main', mockWorktreeInfo('main', '/project/aisanity', true)]
    ]);

    const status = resolveWorktreeStatus('main', mainWorktreeMap);

    expect(status.exists).toBe(true);
    expect(status.name).toBe('main');  // Should use 'main' as display name
    expect(status.isActive).toBe(true);
  });
});