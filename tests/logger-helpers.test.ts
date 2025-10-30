import { describe, test, expect } from 'bun:test';
import {
  formatOrphanedContainerInfo,
  formatDiscoveryDebugInfo,
  formatValidationDebugInfo,
} from '../src/utils/logger-helpers';
import { DockerContainer, WorktreeValidationResult } from '../src/utils/container-utils';

describe('Logger Helpers', () => {
  describe('formatOrphanedContainerInfo', () => {
    test('formats orphaned containers with validation results', () => {
      const containers: DockerContainer[] = [
        {
          id: 'abc123',
          name: 'orphaned-container-1',
          image: 'test:latest',
          status: 'exited',
          labels: { 'aisanity.workspace': '/path/to/deleted' },
          ports: '',
        },
        {
          id: 'def456',
          name: 'orphaned-container-2',
          image: 'test:latest',
          status: 'exited',
          labels: { 'aisanity.workspace': '/another/deleted/path' },
          ports: '',
        },
      ];

      const validationResults = new Map<string, WorktreeValidationResult>([
        [
          'abc123',
          {
            workspacePath: '/path/to/deleted',
            exists: false,
            isValid: false,
            error: 'Worktree directory not found',
            validationMethod: 'filesystem',
          },
        ],
        [
          'def456',
          {
            workspacePath: '/another/deleted/path',
            exists: false,
            isValid: false,
            error: 'Path does not exist',
            validationMethod: 'filesystem',
          },
        ],
      ]);

      const output = formatOrphanedContainerInfo(containers, validationResults);

      // Check that output contains container names
      expect(output).toContain('orphaned-container-1');
      expect(output).toContain('orphaned-container-2');

      // Check that output contains workspace paths
      expect(output).toContain('/path/to/deleted');
      expect(output).toContain('/another/deleted/path');

      // Check that output contains error reasons
      expect(output).toContain('Worktree directory not found');
      expect(output).toContain('Path does not exist');

      // Check that output has proper formatting
      expect(output).toContain('Orphaned containers:');
      expect(output).toContain('Workspace:');
      expect(output).toContain('Reason:');
    });

    test('returns empty string for no orphaned containers', () => {
      const containers: DockerContainer[] = [];
      const validationResults = new Map<string, WorktreeValidationResult>();

      const output = formatOrphanedContainerInfo(containers, validationResults);
      expect(output).toBe('');
    });

    test('handles container without validation result', () => {
      const containers: DockerContainer[] = [
        {
          id: 'abc123',
          name: 'orphaned-container',
          image: 'test:latest',
          status: 'exited',
          labels: {},
          ports: '',
        },
      ];

      const validationResults = new Map<string, WorktreeValidationResult>();

      const output = formatOrphanedContainerInfo(containers, validationResults);

      // Should show container but with 'unknown' workspace
      expect(output).toContain('orphaned-container');
      expect(output).toContain('unknown');
    });
  });

  describe('formatDiscoveryDebugInfo', () => {
    test('formats discovery metadata with counts', () => {
      const metadata = {
        totalDiscovered: 5,
        labeledCount: 3,
        unlabeledCount: 2,
        orphanedCount: 1,
      };

      const output = formatDiscoveryDebugInfo(metadata, 45);

      // Check that output contains all counts
      expect(output).toContain('Total: 5');
      expect(output).toContain('Labeled: 3');
      expect(output).toContain('Unlabeled: 2');
      expect(output).toContain('Orphaned: 1');

      // Check that output contains duration
      expect(output).toContain('45ms');

      // Check that output has debug prefix
      expect(output).toContain('[Discovery]');
    });

    test('formats zero counts correctly', () => {
      const metadata = {
        totalDiscovered: 0,
        labeledCount: 0,
        unlabeledCount: 0,
        orphanedCount: 0,
      };

      const output = formatDiscoveryDebugInfo(metadata, 12);

      expect(output).toContain('Total: 0');
      expect(output).toContain('12ms');
    });
  });

  describe('formatValidationDebugInfo', () => {
    test('formats validation results with counts', () => {
      const validationResults = new Map<string, WorktreeValidationResult>([
        [
          'abc123',
          {
            workspacePath: '/valid/path',
            exists: true,
            isValid: true,
            validationMethod: 'filesystem',
          },
        ],
        [
          'def456',
          {
            workspacePath: '/invalid/path',
            exists: false,
            isValid: false,
            error: 'Path does not exist',
            validationMethod: 'filesystem',
          },
        ],
        [
          'ghi789',
          {
            workspacePath: '/another/valid',
            exists: true,
            isValid: true,
            validationMethod: 'git',
          },
        ],
      ]);

      const output = formatValidationDebugInfo(validationResults);

      // Check that output contains counts
      expect(output).toContain('3 worktrees');
      expect(output).toContain('2 valid');
      expect(output).toContain('1 invalid');

      // Check that output has validation prefix
      expect(output).toContain('[Validation]');
    });

    test('handles empty validation results', () => {
      const validationResults = new Map<string, WorktreeValidationResult>();

      const output = formatValidationDebugInfo(validationResults);

      expect(output).toContain('0 worktrees');
      expect(output).toContain('0 valid');
      expect(output).toContain('0 invalid');
    });

    test('handles all valid results', () => {
      const validationResults = new Map<string, WorktreeValidationResult>([
        [
          'abc123',
          {
            workspacePath: '/valid/path1',
            exists: true,
            isValid: true,
            validationMethod: 'filesystem',
          },
        ],
        [
          'def456',
          {
            workspacePath: '/valid/path2',
            exists: true,
            isValid: true,
            validationMethod: 'git',
          },
        ],
      ]);

      const output = formatValidationDebugInfo(validationResults);

      expect(output).toContain('2 worktrees');
      expect(output).toContain('2 valid');
      expect(output).toContain('0 invalid');
    });

    test('handles all invalid results', () => {
      const validationResults = new Map<string, WorktreeValidationResult>([
        [
          'abc123',
          {
            workspacePath: '/invalid/path1',
            exists: false,
            isValid: false,
            error: 'Not found',
            validationMethod: 'filesystem',
          },
        ],
        [
          'def456',
          {
            workspacePath: '/invalid/path2',
            exists: false,
            isValid: false,
            error: 'Not found',
            validationMethod: 'filesystem',
          },
        ],
      ]);

      const output = formatValidationDebugInfo(validationResults);

      expect(output).toContain('2 worktrees');
      expect(output).toContain('0 valid');
      expect(output).toContain('2 invalid');
    });
  });
});
