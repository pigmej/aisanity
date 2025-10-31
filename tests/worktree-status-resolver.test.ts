import { describe, it, expect, beforeEach } from 'bun:test';
import { resolveWorktreeStatus } from '../src/commands/status';
import { WorktreeInfo } from '../src/utils/worktree-utils';

describe('resolveWorktreeStatus', () => {
  let worktreeMap: Map<string, WorktreeInfo>;

  beforeEach(() => {
    worktreeMap = new Map();
  });

  it('should resolve existing worktree', () => {
    worktreeMap.set('feature/auth', { 
      path: '/project/worktrees/feature-auth', 
      branch: 'feature/auth',
      isActive: false,
      containerName: 'aisanity-feature-auth',
      configPath: '/project/worktrees/feature-auth/.aisanity/config.json'
    });
    
    const status = resolveWorktreeStatus('feature/auth', worktreeMap);
    
    expect(status.exists).toBe(true);
    expect(status.name).toBe('feature-auth');
    expect(status.isActive).toBe(false);
  });

  it('should handle non-existent worktree', () => {
    const status = resolveWorktreeStatus('feature/nonexistent', worktreeMap);
    
    expect(status.exists).toBe(false);
    expect(status.name).toBe('none');
    expect(status.isActive).toBe(false);
  });

  it('should identify active worktree', () => {
    worktreeMap.set('main', { 
      path: '/project', 
      branch: 'main',
      isActive: true,
      containerName: 'aisanity-main',
      configPath: '/project/.aisanity/config.json'
    });
    
    const status = resolveWorktreeStatus('main', worktreeMap);
    
    expect(status.isActive).toBe(true);
  });

  it('should handle main branch specially', () => {
    worktreeMap.set('main', { 
      path: '/project/aisanity', 
      branch: 'main',
      isActive: true,
      containerName: 'aisanity-main',
      configPath: '/project/aisanity/.aisanity/config.json'
    });
    
    const status = resolveWorktreeStatus('main', worktreeMap);
    
    expect(status.exists).toBe(true);
    expect(status.name).toBe('main');  // Should use 'main' as display name
    expect(status.isActive).toBe(true);
  });

  it('should handle worktree with same path as main', () => {
    const mainWorktree = { 
      path: '/project', 
      branch: 'main',
      isActive: true,
      containerName: 'aisanity-main',
      configPath: '/project/.aisanity/config.json'
    };
    
    worktreeMap.set('main', mainWorktree);
    
    const status = resolveWorktreeStatus('main', worktreeMap);
    
    expect(status.exists).toBe(true);
    expect(status.name).toBe('main');
  });

  it('should handle worktree with complex branch name', () => {
    worktreeMap.set('feature/very-long-branch-name-with-many-parts', { 
      path: '/project/worktrees/feature-very-long-branch-name-with-many-parts', 
      branch: 'feature/very-long-branch-name-with-many-parts',
      isActive: false,
      containerName: 'aisanity-feature-very-long-branch-name-with-many-parts',
      configPath: '/project/worktrees/feature-very-long-branch-name-with-many-parts/.aisanity/config.json'
    });
    
    const status = resolveWorktreeStatus('feature/very-long-branch-name-with-many-parts', worktreeMap);
    
    expect(status.exists).toBe(true);
    expect(status.name).toBe('feature-very-long-branch-name-with-many-parts');
    expect(status.isActive).toBe(false);
  });

  it('should handle empty worktree map', () => {
    const emptyMap = new Map<string, WorktreeInfo>();
    
    const status = resolveWorktreeStatus('any-branch', emptyMap);
    
    expect(status.exists).toBe(false);
    expect(status.name).toBe('none');
    expect(status.isActive).toBe(false);
  });

  it('should handle multiple worktrees', () => {
    worktreeMap.set('main', { 
      path: '/project', 
      branch: 'main',
      isActive: false,
      containerName: 'aisanity-main',
      configPath: '/project/.aisanity/config.json'
    });
    
    worktreeMap.set('feature/auth', { 
      path: '/project/worktrees/feature-auth', 
      branch: 'feature/auth',
      isActive: true,
      containerName: 'aisanity-feature-auth',
      configPath: '/project/worktrees/feature-auth/.aisanity/config.json'
    });
    
    worktreeMap.set('feature/ui', { 
      path: '/project/worktrees/feature-ui', 
      branch: 'feature/ui',
      isActive: false,
      containerName: 'aisanity-feature-ui',
      configPath: '/project/worktrees/feature-ui/.aisanity/config.json'
    });
    
    const mainStatus = resolveWorktreeStatus('main', worktreeMap);
    const authStatus = resolveWorktreeStatus('feature/auth', worktreeMap);
    const uiStatus = resolveWorktreeStatus('feature/ui', worktreeMap);
    const missingStatus = resolveWorktreeStatus('feature/missing', worktreeMap);
    
    expect(mainStatus.exists).toBe(true);
    expect(mainStatus.name).toBe('main');
    expect(mainStatus.isActive).toBe(false);
    
    expect(authStatus.exists).toBe(true);
    expect(authStatus.name).toBe('feature-auth');
    expect(authStatus.isActive).toBe(true);
    
    expect(uiStatus.exists).toBe(true);
    expect(uiStatus.name).toBe('feature-ui');
    expect(uiStatus.isActive).toBe(false);
    
    expect(missingStatus.exists).toBe(false);
    expect(missingStatus.name).toBe('none');
    expect(missingStatus.isActive).toBe(false);
  });
});