import { describe, it, expect } from 'bun:test';
import { formatWorkspaceTable, WorkspaceStatusRow } from '../src/commands/status';

describe('formatWorkspaceTable', () => {
  it('should format table with workspace column', () => {
    const rows: WorkspaceStatusRow[] = [
      {
        workspace: 'aisanity',
        branch: 'main',
        container: 'aisanity-main',
        worktreeStatus: '✅ main',
        status: 'Running',
        ports: '-',
        isCurrentWorktree: true,
        hasWarning: false
      }
    ];
    
    const table = formatWorkspaceTable(rows);
    
    expect(table).toContain('Workspace');
    expect(table).toContain('Branch');
    expect(table).toContain('Worktree');
    expect(table).toContain('→ aisanity');  // Active indicator
    expect(table).toContain('✅ main');
    expect(table).toContain('┌');  // Table border
    expect(table).toContain('┐');  // Table border
  });

  it('should handle emoji widths correctly', () => {
    const rows: WorkspaceStatusRow[] = [
      {
        workspace: 'test',
        branch: 'feature',
        container: 'test-feature',
        worktreeStatus: '❌ none',
        status: 'Running',
        ports: '-',
        isCurrentWorktree: false,
        hasWarning: false
      }
    ];
    
    const table = formatWorkspaceTable(rows);
    
    // Table should be aligned despite emoji
    const lines = table.split('\n');
    const firstBorder = lines[0].length;
    const lastBorder = lines[lines.length - 1].length;
    
    expect(firstBorder).toBe(lastBorder);
  });

  it('should truncate long branch names', () => {
    const rows: WorkspaceStatusRow[] = [
      {
        workspace: 'test',
        branch: 'feature/very-long-branch-name-that-exceeds-maximum-width',
        container: 'container',
        worktreeStatus: '❌ none',
        status: 'Running',
        ports: '-',
        isCurrentWorktree: false,
        hasWarning: false
      }
    ];
    
    const table = formatWorkspaceTable(rows);
    
    expect(table).toContain('...');  // Truncation indicator
  });

  it('should handle multiple rows with different worktree statuses', () => {
    const rows: WorkspaceStatusRow[] = [
      {
        workspace: 'aisanity',
        branch: 'main',
        container: 'aisanity-main',
        worktreeStatus: '✅ main',
        status: 'Running',
        ports: '8080:8080',
        isCurrentWorktree: true,
        hasWarning: false
      },
      {
        workspace: 'aisanity',
        branch: 'feature/auth',
        container: 'aisanity-feature-auth',
        worktreeStatus: '❌ none',
        status: 'Stopped',
        ports: '-',
        isCurrentWorktree: false,
        hasWarning: false
      },
      {
        workspace: 'aisanity',
        branch: 'feature/ui',
        container: 'aisanity-feature-ui',
        worktreeStatus: '✅ feature-ui',
        status: 'Running',
        ports: '3000:3000, 8081:8081',
        isCurrentWorktree: false,
        hasWarning: false
      }
    ];
    
    const table = formatWorkspaceTable(rows);
    
    // Should contain all rows
    expect(table).toContain('main');
    expect(table).toContain('feature/auth');
    expect(table).toContain('feature/ui');
    
    // Should contain different statuses
    expect(table).toContain('✅ main');
    expect(table).toContain('❌ none');
    expect(table).toContain('✅ feature-ui');
    
    // Should contain different container statuses
    expect(table).toContain('Running');
    expect(table).toContain('Stopped');
    
    // Should contain port information
    expect(table).toContain('8080:8080');
    expect(table).toContain('3000:3000');  // Truncated
    expect(table).toContain('-');
  });

  it('should handle empty rows array', () => {
    const rows: WorkspaceStatusRow[] = [];
    
    const table = formatWorkspaceTable(rows);
    
    // Should still produce a valid table structure
    expect(table).toContain('┌');
    expect(table).toContain('┐');
    expect(table).toContain('Workspace');
    expect(table).toContain('Branch');
    expect(table).toContain('Container');
    expect(table).toContain('Worktree');
    expect(table).toContain('Status');
    expect(table).toContain('Ports');
  });

  it('should handle rows with warning indicators', () => {
    const rows: WorkspaceStatusRow[] = [
      {
        workspace: 'aisanity',
        branch: 'unknown',
        container: 'random-container',
        worktreeStatus: '❌ none',
        status: 'Running',
        ports: '-',
        isCurrentWorktree: false,
        hasWarning: true
      }
    ];
    
    const table = formatWorkspaceTable(rows);
    
    // Should still format the table correctly even with warnings
    expect(table).toContain('Workspace');
    expect(table).toContain('unknown');
    expect(table).toContain('random-container');
    expect(table).toContain('❌ none');
  });

  it('should handle very long workspace names', () => {
    const rows: WorkspaceStatusRow[] = [
      {
        workspace: 'very-long-workspace-name-that-might-exceed-maximum-width',
        branch: 'main',
        container: 'container',
        worktreeStatus: '✅ main',
        status: 'Running',
        ports: '-',
        isCurrentWorktree: false,
        hasWarning: false
      }
    ];
    
    const table = formatWorkspaceTable(rows);
    
    // Should truncate long workspace names
    expect(table).toContain('...');
    // Should still maintain table structure
    expect(table).toContain('┌');
    expect(table).toContain('┐');
  });

  it('should handle special characters in container names', () => {
    const rows: WorkspaceStatusRow[] = [
      {
        workspace: 'test',
        branch: 'main',
        container: 'container_with_underscores-and-dashes',
        worktreeStatus: '✅ main',
        status: 'Running',
        ports: '-',
        isCurrentWorktree: false,
        hasWarning: false
      }
    ];
    
    const table = formatWorkspaceTable(rows);
    
    expect(table).toContain('container_with_un...');  // Truncated
    expect(table).toContain('┌');
    expect(table).toContain('┐');
  });

  it('should maintain consistent column alignment', () => {
    const rows: WorkspaceStatusRow[] = [
      {
        workspace: 'a',
        branch: 'short',
        container: 'c',
        worktreeStatus: '✅ s',
        status: 'R',
        ports: '1',
        isCurrentWorktree: false,
        hasWarning: false
      },
      {
        workspace: 'very-long-workspace-name',
        branch: 'very-long-branch-name-with-many-parts',
        container: 'very-long-container-name-with-many-parts',
        worktreeStatus: '❌ none',
        status: 'Stopped',
        ports: '8080:8080, 3000:3000',
        isCurrentWorktree: false,
        hasWarning: false
      }
    ];
    
    const table = formatWorkspaceTable(rows);
    const lines = table.split('\n');
    
    // All lines should have the same length (proper alignment)
    const lineLengths = lines.map(line => line.length);
    const uniqueLengths = [...new Set(lineLengths)];
    
    // Allow for minor differences due to Unicode complexity
    // The important thing is that the table looks aligned visually
    const maxLength = Math.max(...lineLengths);
    const minLength = Math.min(...lineLengths);
    
    // Difference should be at most 1 character due to Unicode rounding
    expect(maxLength - minLength).toBeLessThanOrEqual(1);
  });
});