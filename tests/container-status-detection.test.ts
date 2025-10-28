import { describe, it, expect, beforeAll } from 'bun:test';
import { executeDockerCommand, getContainerStatus, discoverWorkspaceContainers, getContainerInfo, parseDockerOutputToContainers } from '../src/utils/container-utils';

/**
 * Container Status Detection Tests
 * 
 * These tests verify Docker container status detection functionality.
 * Docker-dependent tests are skipped if Docker is not available (e.g., on macOS GitHub Actions).
 * 
 * Tests that don't require Docker (like pure parsing functions) always run.
 */

// Helper to check if Docker is available
let dockerAvailable = false;

beforeAll(async () => {
  const result = await executeDockerCommand('docker --version', { silent: true });
  dockerAvailable = result.success;
  
  if (!dockerAvailable) {
    console.warn('⚠️  Docker is not available. Skipping Docker-dependent tests.');
  }
});

describe('Container Status Detection - Task 150', () => {
  describe('executeDockerCommand', () => {
    it('should execute successful Docker commands', async () => {
      if (!dockerAvailable) {
        console.log('Skipping test: Docker not available');
        return;
      }
      
      const result = await executeDockerCommand('docker --version', { silent: true });
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Docker');
    });

    it('should handle Docker command failures gracefully', async () => {
      if (!dockerAvailable) {
        console.log('Skipping test: Docker not available');
        return;
      }
      
      const result = await executeDockerCommand('docker nonexistent-command', { silent: true });
      expect(result.success).toBe(false);
      expect(result.stderr).toBeDefined();
    });

    it('should timeout long-running commands', async () => {
      const result = await executeDockerCommand('sleep 5', { 
        silent: true, 
        timeout: 100 
      });
      expect(result.success).toBe(false);
    });
  });

  describe('getContainerStatus', () => {
    it('should return correct status for non-existent containers', async () => {
      if (!dockerAvailable) {
        console.log('Skipping test: Docker not available');
        return;
      }
      
      const result = await getContainerStatus('nonexistent-container-id');
      expect(result.status).toBe('Not created');
      expect(result.ports).toEqual([]);
    });

    it('should handle container status queries', async () => {
      if (!dockerAvailable) {
        console.log('Skipping test: Docker not available');
        return;
      }
      
      // Test with a fake container ID
      const result = await getContainerStatus('fake-container-id');
      expect(['Not created', 'Running', 'Stopped']).toContain(result.status);
    });
  });

  describe('discoverWorkspaceContainers', () => {
    it('should handle workspace discovery gracefully', async () => {
      const containers = await discoverWorkspaceContainers('/nonexistent/workspace');
      expect(Array.isArray(containers)).toBe(true);
    });

    it('should return container objects with correct structure', async () => {
      const containers = await discoverWorkspaceContainers('/test/workspace');
      containers.forEach(container => {
        expect(container).toHaveProperty('id');
        expect(container).toHaveProperty('name');
        expect(container).toHaveProperty('status');
        expect(container).toHaveProperty('ports');
        expect(container).toHaveProperty('labels');
        expect(['Running', 'Stopped', 'Not created']).toContain(container.status);
      });
    });
  });

  describe('getContainerInfo', () => {
    it('should handle non-existent container info requests', async () => {
      if (!dockerAvailable) {
        console.log('Skipping test: Docker not available');
        return;
      }
      
      try {
        await getContainerInfo('nonexistent-container-id');
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Failed to get container info');
      }
    });
  });

  describe('parseDockerOutputToContainers', () => {
    it('should parse docker ps output correctly', () => {
      const mockOutput = 'container1\tname1\tUp 2 hours\t8080/tcp\tlabel1=value1,label2=value2\n' +
                        'container2\tname2\tExited (0) 1 hour ago\t-\tlabel3=value3';
      
      const containers = parseDockerOutputToContainers(mockOutput);
      
      expect(containers).toHaveLength(2);
      expect(containers[0]).toMatchObject({
        id: 'container1',
        name: 'name1',
        status: 'Running',
        ports: ['8080/tcp'],
        labels: { label1: 'value1', label2: 'value2' }
      });
      expect(containers[1]).toMatchObject({
        id: 'container2',
        name: 'name2',
        status: 'Stopped',
        ports: ['-'],
        labels: { label3: 'value3' }
      });
    });

    it('should handle labels with equals signs in values', () => {
      const mockOutput = 'container1\tname1\tUp 2 hours\t8080/tcp\tcomplex.label=value=with=equals';
      
      const containers = parseDockerOutputToContainers(mockOutput);
      
      expect(containers).toHaveLength(1);
      // With split('=', 2), it should preserve the rest of the equals signs in the value
      expect(containers[0].labels).toEqual({
        'complex.label': 'value=with=equals'
      });
    });

    it('should handle empty output', () => {
      const containers = parseDockerOutputToContainers('');
      expect(containers).toHaveLength(0);
    });

    it('should handle malformed lines gracefully', () => {
      const mockOutput = 'container1\tname1\tUp 2 hours\n' + // Missing fields
                        'container2\tname2\tUp 2 hours\t8080/tcp\tlabel1=value1'; // Complete line
      
      const containers = parseDockerOutputToContainers(mockOutput);
      
      expect(containers).toHaveLength(1);
      expect(containers[0].id).toBe('container2');
    });
  });

  describe('Unmapped Container Display', () => {
    it('should handle containers without worktree mapping', async () => {
      // Test the scenario where containers exist but don't map to worktrees
      const mockOutput = 'orphaned-container\torphaned-name\tUp 2 hours\t8080/tcp\taisanity.workspace=/nonexistent/path,aisanity.branch=feature-branch';
      
      const containers = parseDockerOutputToContainers(mockOutput);
      
      expect(containers).toHaveLength(1);
      expect(containers[0]).toMatchObject({
        id: 'orphaned-container',
        name: 'orphaned-name',
        status: 'Running',
        branchName: 'feature-branch',
        workspaceId: '/nonexistent/path'
      });
    });

    it('should handle containers with missing labels', async () => {
      const mockOutput = 'unlabeled-container\tunlabeled-name\tUp 2 hours\t8080/tcp\t';
      
      const containers = parseDockerOutputToContainers(mockOutput);
      
      // Empty labels string should still result in container being parsed with empty labels object
      expect(containers).toHaveLength(1);
      expect(containers[0].labels).toEqual({});
    });
  });

  describe('Integration Tests', () => {
    it('should handle Docker daemon unavailability gracefully', async () => {
      // This test works even without Docker - it just checks return types
      const result = await executeDockerCommand('docker ps', { silent: true });
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.stdout).toBe('string');
      expect(typeof result.stderr).toBe('string');
    });

    it('should maintain backward compatibility with existing interfaces', async () => {
      if (!dockerAvailable) {
        console.log('Skipping test: Docker not available');
        return;
      }
      
      // Ensure the new functions don't break existing functionality
      const containers = await discoverWorkspaceContainers('/test');
      expect(Array.isArray(containers)).toBe(true);
      
      // Test that container objects have expected properties
      containers.forEach(container => {
        expect(typeof container.id).toBe('string');
        expect(typeof container.name).toBe('string');
        expect(['Running', 'Stopped', 'Not created']).toContain(container.status);
        expect(Array.isArray(container.ports)).toBe(true);
        expect(typeof container.labels).toBe('object');
      });
    });
  });
});