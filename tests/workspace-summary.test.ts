import { describe, it, expect } from 'bun:test';
import { generateWorkspaceSummary, WorkspaceStatusRow } from '../src/commands/status';

describe('generateWorkspaceSummary', () => {
  it('should count containers correctly', () => {
    const rows: WorkspaceStatusRow[] = [
      { 
        workspace: 'test', 
        status: 'Running', 
        worktreeStatus: '✅ main',
        branch: 'main',
        container: 'container1',
        ports: '-',
        isCurrentWorktree: false,
        hasWarning: false
      },
      { 
        workspace: 'test', 
        status: 'Running', 
        worktreeStatus: '❌ none',
        branch: 'feature1',
        container: 'container2',
        ports: '-',
        isCurrentWorktree: false,
        hasWarning: false
      },
      { 
        workspace: 'test', 
        status: 'Stopped', 
        worktreeStatus: '❌ none',
        branch: 'feature2',
        container: 'container3',
        ports: '-',
        isCurrentWorktree: false,
        hasWarning: false
      },
    ];
    
    const summary = generateWorkspaceSummary('test', rows);
    
    expect(summary.totalContainers).toBe(3);
    expect(summary.runningContainers).toBe(2);
    expect(summary.stoppedContainers).toBe(1);
    expect(summary.workspaceName).toBe('test');
  });

  it('should count worktree presence correctly', () => {
    const rows: WorkspaceStatusRow[] = [
      { 
        worktreeStatus: '✅ main',
        workspace: 'test',
        status: 'Running',
        branch: 'main',
        container: 'container1',
        ports: '-',
        isCurrentWorktree: false,
        hasWarning: false
      },
      { 
        worktreeStatus: '✅ feature-1',
        workspace: 'test',
        status: 'Running',
        branch: 'feature1',
        container: 'container2',
        ports: '-',
        isCurrentWorktree: false,
        hasWarning: false
      },
      { 
        worktreeStatus: '❌ none',
        workspace: 'test',
        status: 'Running',
        branch: 'feature2',
        container: 'container3',
        ports: '-',
        isCurrentWorktree: false,
        hasWarning: false
      },
      { 
        worktreeStatus: '❌ none',
        workspace: 'test',
        status: 'Stopped',
        branch: 'feature3',
        container: 'container4',
        ports: '-',
        isCurrentWorktree: false,
        hasWarning: false
      },
    ];
    
    const summary = generateWorkspaceSummary('test', rows);
    
    expect(summary.containersWithWorktrees).toBe(2);
    expect(summary.containersWithoutWorktrees).toBe(2);
  });

  it('should identify current worktree', () => {
    const rows: WorkspaceStatusRow[] = [
      { 
        branch: 'main', 
        isCurrentWorktree: false,
        workspace: 'test',
        status: 'Running',
        container: 'container1',
        worktreeStatus: '✅ main',
        ports: '-',
        hasWarning: false
      },
      { 
        branch: 'feature/auth', 
        isCurrentWorktree: true,
        workspace: 'test',
        status: 'Running',
        container: 'container2',
        worktreeStatus: '✅ feature-auth',
        ports: '-',
        hasWarning: false
      },
    ];
    
    const summary = generateWorkspaceSummary('test', rows);
    
    expect(summary.currentWorktree).toBe('feature/auth');
  });

  it('should handle empty rows array', () => {
    const rows: WorkspaceStatusRow[] = [];
    
    const summary = generateWorkspaceSummary('empty-workspace', rows);
    
    expect(summary.totalContainers).toBe(0);
    expect(summary.runningContainers).toBe(0);
    expect(summary.stoppedContainers).toBe(0);
    expect(summary.containersWithWorktrees).toBe(0);
    expect(summary.containersWithoutWorktrees).toBe(0);
    expect(summary.currentWorktree).toBe('none');
    expect(summary.workspaceName).toBe('empty-workspace');
  });

  it('should handle all running containers', () => {
    const rows: WorkspaceStatusRow[] = [
      { 
        status: 'Running',
        workspace: 'test',
        branch: 'main',
        container: 'container1',
        worktreeStatus: '✅ main',
        ports: '-',
        isCurrentWorktree: false,
        hasWarning: false
      },
      { 
        status: 'Running',
        workspace: 'test',
        branch: 'feature1',
        container: 'container2',
        worktreeStatus: '❌ none',
        ports: '-',
        isCurrentWorktree: false,
        hasWarning: false
      },
      { 
        status: 'Running',
        workspace: 'test',
        branch: 'feature2',
        container: 'container3',
        worktreeStatus: '✅ feature2',
        ports: '-',
        isCurrentWorktree: false,
        hasWarning: false
      },
    ];
    
    const summary = generateWorkspaceSummary('test', rows);
    
    expect(summary.runningContainers).toBe(3);
    expect(summary.stoppedContainers).toBe(0);
  });

  it('should handle all stopped containers', () => {
    const rows: WorkspaceStatusRow[] = [
      { 
        status: 'Stopped',
        workspace: 'test',
        branch: 'main',
        container: 'container1',
        worktreeStatus: '✅ main',
        ports: '-',
        isCurrentWorktree: false,
        hasWarning: false
      },
      { 
        status: 'Stopped',
        workspace: 'test',
        branch: 'feature1',
        container: 'container2',
        worktreeStatus: '❌ none',
        ports: '-',
        isCurrentWorktree: false,
        hasWarning: false
      },
    ];
    
    const summary = generateWorkspaceSummary('test', rows);
    
    expect(summary.runningContainers).toBe(0);
    expect(summary.stoppedContainers).toBe(2);
  });

  it('should handle mixed worktree statuses', () => {
    const rows: WorkspaceStatusRow[] = [
      { 
        worktreeStatus: '✅ main',
        workspace: 'test',
        status: 'Running',
        branch: 'main',
        container: 'container1',
        ports: '-',
        isCurrentWorktree: true,
        hasWarning: false
      },
      { 
        worktreeStatus: '❌ none',
        workspace: 'test',
        status: 'Running',
        branch: 'feature1',
        container: 'container2',
        ports: '-',
        isCurrentWorktree: false,
        hasWarning: false
      },
      { 
        worktreeStatus: '✅ feature-auth',
        workspace: 'test',
        status: 'Stopped',
        branch: 'feature/auth',
        container: 'container3',
        ports: '-',
        isCurrentWorktree: false,
        hasWarning: false
      },
      { 
        worktreeStatus: '❌ none',
        workspace: 'test',
        status: 'Stopped',
        branch: 'feature2',
        container: 'container4',
        ports: '-',
        isCurrentWorktree: false,
        hasWarning: false
      },
    ];
    
    const summary = generateWorkspaceSummary('test', rows);
    
    expect(summary.containersWithWorktrees).toBe(2);
    expect(summary.containersWithoutWorktrees).toBe(2);
    expect(summary.runningContainers).toBe(2);
    expect(summary.stoppedContainers).toBe(2);
    expect(summary.currentWorktree).toBe('main');
  });

  it('should handle no current worktree', () => {
    const rows: WorkspaceStatusRow[] = [
      { 
        branch: 'main', 
        isCurrentWorktree: false,
        workspace: 'test',
        status: 'Running',
        container: 'container1',
        worktreeStatus: '✅ main',
        ports: '-',
        hasWarning: false
      },
      { 
        branch: 'feature1', 
        isCurrentWorktree: false,
        workspace: 'test',
        status: 'Running',
        container: 'container2',
        worktreeStatus: '❌ none',
        ports: '-',
        hasWarning: false
      },
    ];
    
    const summary = generateWorkspaceSummary('test', rows);
    
    expect(summary.currentWorktree).toBe('none');
  });

  it('should handle unknown status values gracefully', () => {
    const rows: WorkspaceStatusRow[] = [
      { 
        status: 'Unknown' as any,
        workspace: 'test',
        branch: 'main',
        container: 'container1',
        worktreeStatus: '✅ main',
        ports: '-',
        isCurrentWorktree: false,
        hasWarning: false
      },
      { 
        status: 'Error' as any,
        workspace: 'test',
        branch: 'feature1',
        container: 'container2',
        worktreeStatus: '❌ none',
        ports: '-',
        isCurrentWorktree: false,
        hasWarning: false
      },
    ];
    
    const summary = generateWorkspaceSummary('test', rows);
    
    // Unknown statuses should not be counted as running or stopped
    expect(summary.runningContainers).toBe(0);
    expect(summary.stoppedContainers).toBe(0);
    expect(summary.totalContainers).toBe(2);
  });
});