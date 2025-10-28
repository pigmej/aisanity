import { describe, it, expect, beforeEach } from 'bun:test';
import { 
  validateAndExtractLabels,
  shouldIncludeContainer,
  ContainerLabelValidation
} from '../src/commands/status';
import { Container } from '../src/utils/container-utils';
import { WorktreeInfo } from '../src/utils/worktree-utils';

describe('Container Label Validation', () => {
  let worktreeMap: Map<string, WorktreeInfo>;

  beforeEach(() => {
    worktreeMap = new Map();
  });

  it('should validate container with all labels present', () => {
    const container: Container = {
      id: 'abc123',
      name: 'aisanity-main',
      status: 'Running',
      ports: [],
      labels: {
        'aisanity.workspace': '/project',
        'aisanity.branch': 'main'
      }
    };
    
    const validation = validateAndExtractLabels(container, worktreeMap, '/project');
    
    expect(validation.isValid).toBe(true);
    expect(validation.hasWorkspaceLabel).toBe(true);
    expect(validation.hasBranchLabel).toBe(true);
    expect(validation.detectedBranch).toBe('main');
    expect(validation.detectionMethod).toBe('label');
    expect(validation.warnings).toHaveLength(0);
  });

  it('should detect branch from container name when label missing', () => {
    const container: Container = {
      id: 'def456',
      name: 'aisanity-feature-auth',
      status: 'Running',
      ports: [],
      labels: {
        'aisanity.workspace': '/project'
        // Missing aisanity.branch
      }
    };
    
    const validation = validateAndExtractLabels(container, worktreeMap, '/project');
    
    expect(validation.isValid).toBe(false);
    expect(validation.hasBranchLabel).toBe(false);
    expect(validation.detectedBranch).toBe('feature/auth');
    expect(validation.detectionMethod).toBe('name-pattern');
    expect(validation.warnings).toContain('Container aisanity-feature-auth missing aisanity.branch label');
    expect(validation.warnings).toContain('Detected branch \'feature/auth\' from container name');
  });

  it('should detect branch from worktree cross-reference', () => {
    const container: Container = {
      id: 'ghi789',
      name: 'elegant_darwin',  // Random Docker name
      status: 'Running',
      ports: [],
      labels: {
        'aisanity.workspace': '/project'
      }
    };
    
    const worktreeMapWithContainer = new Map([
      ['feature/test', { 
        path: '/project/worktrees/feature-test',
        branch: 'feature/test',
        isActive: false,
        containerName: 'elegant_darwin',
        configPath: '/project/worktrees/feature-test/.aisanity/config.json'
      }]
    ]);
    
    const validation = validateAndExtractLabels(container, worktreeMapWithContainer, '/project');
    
    expect(validation.detectedBranch).toBe('feature/test');
    expect(validation.detectionMethod).toBe('worktree-match');
    expect(validation.warnings.length).toBeGreaterThan(0);
    expect(validation.warnings.some(w => w.includes('Matched branch'))).toBe(true);
  });

  it('should handle container with no detection method', () => {
    const container: Container = {
      id: 'jkl012',
      name: 'random_name_12345',
      status: 'Running',
      ports: [],
      labels: {
        'aisanity.workspace': '/project'
      }
    };
    
    const validation = validateAndExtractLabels(container, worktreeMap, '/project');
    
    expect(validation.isValid).toBe(false);
    expect(validation.detectedBranch).toBeNull();
    expect(validation.detectionMethod).toBe('unknown');
    expect(validation.warnings.length).toBeGreaterThan(0);
  });

  it('should handle containers with empty label values', () => {
    const container: Container = {
      id: 'mno345',
      name: 'test',
      status: 'Running',
      ports: [],
      labels: {
        'aisanity.workspace': '',  // Empty string
        'aisanity.branch': ''
      }
    };
    
    const validation = validateAndExtractLabels(container, worktreeMap, '/project');
    
    expect(validation.isValid).toBe(false);
    expect(validation.hasWorkspaceLabel).toBe(false);  // Empty treated as missing
    expect(validation.hasBranchLabel).toBe(false);
    expect(validation.warnings).toContain('Container test missing aisanity.workspace label');
    expect(validation.warnings).toContain('Container test missing aisanity.branch label');
  });

  it('should filter containers by workspace', () => {
    const container: Container = {
      id: 'pqr678',
      name: 'test',
      status: 'Running',
      ports: [],
      labels: {
        'aisanity.workspace': '/other-project',
        'aisanity.branch': 'main'
      }
    };
    
    const validation = validateAndExtractLabels(container, worktreeMap, '/other-project');
    const shouldInclude = shouldIncludeContainer(container, 'my-project', validation);
    
    expect(shouldInclude).toBe(false);
  });

  it('should include aisanity containers without workspace label', () => {
    const container: Container = {
      id: 'stu901',
      name: 'aisanity-main',
      status: 'Running',
      ports: [],
      labels: {
        'aisanity.branch': 'main'
        // Missing workspace label
      }
    };
    
    const validation = validateAndExtractLabels(container, worktreeMap, '/project');
    const shouldInclude = shouldIncludeContainer(container, 'any-project', validation);
    
    expect(shouldInclude).toBe(true);
  });

  it('should exclude non-aisanity containers without workspace label', () => {
    const container: Container = {
      id: 'vwx234',
      name: 'random-docker-container',
      status: 'Running',
      ports: [],
      labels: {
        'some.other.label': 'value'
        // Missing aisanity labels
      }
    };
    
    const validation = validateAndExtractLabels(container, worktreeMap, '/project');
    const shouldInclude = shouldIncludeContainer(container, 'any-project', validation);
    
    expect(shouldInclude).toBe(false);
  });

  it('should handle complex branch name patterns', () => {
    const container: Container = {
      id: 'yza567',
      name: 'aisanity-feature-very-long-branch-name-with-many-parts',
      status: 'Running',
      ports: [],
      labels: {
        'aisanity.workspace': '/project'
      }
    };
    
    const validation = validateAndExtractLabels(container, worktreeMap, '/project');
    
    expect(validation.detectedBranch).toBe('feature/very/long/branch/name/with/many/parts');
    expect(validation.detectionMethod).toBe('name-pattern');
  });

  it('should handle container with only workspace label', () => {
    const container: Container = {
      id: 'bcd890',
      name: 'some-container',
      status: 'Running',
      ports: [],
      labels: {
        'aisanity.workspace': '/project'
        // Missing branch label
      }
    };
    
    const validation = validateAndExtractLabels(container, worktreeMap, '/project');
    
    expect(validation.isValid).toBe(false);
    expect(validation.hasWorkspaceLabel).toBe(true);
    expect(validation.hasBranchLabel).toBe(false);
    expect(validation.detectedBranch).toBeNull();
    expect(validation.detectionMethod).toBe('unknown');
  });

  it('should handle container with only branch label', () => {
    const container: Container = {
      id: 'efg123',
      name: 'aisanity-main',
      status: 'Running',
      ports: [],
      labels: {
        'aisanity.branch': 'main'
        // Missing workspace label
      }
    };
    
    const validation = validateAndExtractLabels(container, worktreeMap, '/project');
    
    expect(validation.isValid).toBe(false);
    expect(validation.hasWorkspaceLabel).toBe(false);
    expect(validation.hasBranchLabel).toBe(true);
    expect(validation.detectedBranch).toBe('main');
    expect(validation.detectionMethod).toBe('label');
  });

  it('should handle container with no labels', () => {
    const container: Container = {
      id: 'hij456',
      name: 'no-labels-container',
      status: 'Running',
      ports: [],
      labels: {}
    };
    
    const validation = validateAndExtractLabels(container, worktreeMap, '/project');
    
    expect(validation.isValid).toBe(false);
    expect(validation.hasWorkspaceLabel).toBe(false);
    expect(validation.hasBranchLabel).toBe(false);
    expect(validation.detectedBranch).toBeNull();
    expect(validation.detectionMethod).toBe('unknown');
    expect(validation.warnings).toContain('Container no-labels-container missing aisanity.workspace label');
    expect(validation.warnings).toContain('Container no-labels-container missing aisanity.branch label');
  });

  it('should handle container with special characters in name', () => {
    const container: Container = {
      id: 'klm789',
      name: 'aisanity-feature_with_underscores-and-dashes',
      status: 'Running',
      ports: [],
      labels: {
        'aisanity.workspace': '/project'
      }
    };
    
    const validation = validateAndExtractLabels(container, worktreeMap, '/project');
    
    expect(validation.detectedBranch).toBe('feature_with_underscores/and/dashes');
    expect(validation.detectionMethod).toBe('name-pattern');
  });

  it('should handle container with numeric branch name', () => {
    const container: Container = {
      id: 'nop012',
      name: 'aisanity-123',
      status: 'Running',
      ports: [],
      labels: {
        'aisanity.workspace': '/project'
      }
    };
    
    const validation = validateAndExtractLabels(container, worktreeMap, '/project');
    
    expect(validation.detectedBranch).toBe('123');
    expect(validation.detectionMethod).toBe('name-pattern');
  });

  it('should handle container with single word branch name', () => {
    const container: Container = {
      id: 'qrs345',
      name: 'aisanity-main',
      status: 'Running',
      ports: [],
      labels: {
        'aisanity.workspace': '/project'
      }
    };
    
    const validation = validateAndExtractLabels(container, worktreeMap, '/project');
    
    expect(validation.detectedBranch).toBe('main');
    expect(validation.detectionMethod).toBe('name-pattern');
  });
});