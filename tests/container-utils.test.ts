import {
  discoverContainers,
  discoverByLabels,
  discoverByDevcontainerMetadata,
  parseDockerOutput,
  stopContainers,
  removeContainers,
  validateContainerLabels,
  generateContainerLabels,
  isContainerOrphaned,
  ContainerLabels,
  DockerContainer
} from '../src/utils/container-utils';
import { safeDockerExec } from '../src/utils/docker-safe-exec';
import { getAllWorktrees } from '../src/utils/worktree-utils';

// Mock dependencies
jest.mock('../src/utils/docker-safe-exec');
jest.mock('../src/utils/worktree-utils');

const mockedSafeDockerExec = safeDockerExec as jest.MockedFunction<typeof safeDockerExec>;
const mockedGetAllWorktrees = getAllWorktrees as jest.MockedFunction<typeof getAllWorktrees>;

describe('container-utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('discoverContainers', () => {
    it('should discover containers using all strategies', async () => {
      const mockLabeledContainers: DockerContainer[] = [
        {
          id: 'labeled1',
          name: 'test-container',
          image: 'test-image',
          status: 'running',
          labels: { 'aisanity.workspace': '/path/to/workspace' },
          ports: '8080'
        }
      ];

      const mockDevContainers: DockerContainer[] = [
        {
          id: 'dev1',
          name: 'devcontainer',
          image: 'test-image',
          status: 'running',
          labels: { 'devcontainer.local_folder': '/path/to/folder' },
          ports: '8082'
        }
      ];

      mockedSafeDockerExec
        .mockResolvedValueOnce('labeled1\ttest-container\ttest-image\trunning\t8080\taisanity.workspace=/path/to/workspace')
        .mockResolvedValueOnce('dev1\tdevcontainer\ttest-image\trunning\t8082\tdevcontainer.local_folder=/path/to/folder');

      mockedGetAllWorktrees.mockReturnValue({
        main: { path: '/path/to/workspace', branch: 'main', containerName: 'test-main', isActive: true, configPath: '/path/to/workspace/.aisanity' },
        worktrees: []
      });

      const result = await discoverContainers();

      expect(result.containers).toHaveLength(2);
      expect(result.labeled).toHaveLength(1);
      expect(result.unlabeled).toHaveLength(1);
      expect(result.orphaned).toHaveLength(0); // All containers match existing worktrees
    });

    it('should identify orphaned containers', async () => {
      mockedSafeDockerExec
        .mockResolvedValueOnce('orphan1\torphan-container\ttest-image\trunning\t8080\taisanity.workspace=/nonexistent/path')
        .mockResolvedValueOnce('');

      mockedGetAllWorktrees.mockReturnValue({
        main: { path: '/path/to/workspace', branch: 'main', containerName: 'test-main', isActive: true, configPath: '/path/to/workspace/.aisanity' },
        worktrees: []
      });

      const result = await discoverContainers();

      expect(result.orphaned).toHaveLength(1);
      expect(result.orphaned[0].id).toBe('orphan1');
    });

    it('should handle discovery errors gracefully', async () => {
      mockedSafeDockerExec.mockRejectedValue(new Error('Docker not available'));

      const result = await discoverContainers();

      expect(result.containers).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('discoverByLabels', () => {
    it('should discover containers by aisanity labels', async () => {
      const dockerOutput = 'id1\tname1\timage1\trunning\t8080\tlabel1=value1';
      mockedSafeDockerExec.mockResolvedValue(dockerOutput);

      const result = await discoverByLabels();

      expect(mockedSafeDockerExec).toHaveBeenCalledWith([
        'ps', '-a',
        '--filter', 'label=aisanity.workspace',
        '--format', '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.Labels}}'
      ], { verbose: false, timeout: 10000 });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('id1');
    });

    it('should handle errors gracefully', async () => {
      mockedSafeDockerExec.mockRejectedValue(new Error('Command failed'));

      const result = await discoverByLabels();

      expect(result).toHaveLength(0);
    });
  });

  

  describe('discoverByDevcontainerMetadata', () => {
    it('should discover containers by devcontainer metadata', async () => {
      const dockerOutput = 'id1\tname1\timage1\trunning\t8080\t{"devcontainer.local_folder":"/path"}';
      mockedSafeDockerExec.mockResolvedValue(dockerOutput);

      const result = await discoverByDevcontainerMetadata();

      expect(mockedSafeDockerExec).toHaveBeenCalledWith([
        'ps', '-a',
        '--filter', 'label=devcontainer.local_folder',
        '--format', '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.Labels}}'
      ], { verbose: false, timeout: 10000 });

      expect(result).toHaveLength(1);
    });
  });

  describe('parseDockerOutput', () => {
    it('should parse docker ps output correctly', () => {
      const output = 'id1\tname1\timage1\trunning\t8080\tlabel1=value1,label2=value2\nid2\tname2\timage2\texited\t\t{}';

      const result = parseDockerOutput(output);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'id1',
        name: 'name1',
        image: 'image1',
        status: 'running',
        labels: { label1: 'value1', label2: 'value2' },
        ports: '8080'
      });
      expect(result[1]).toEqual({
        id: 'id2',
        name: 'name2',
        image: 'image2',
        status: 'exited',
        labels: {},
        ports: ''
      });
    });

    it('should handle empty output', () => {
      const result = parseDockerOutput('');
      expect(result).toHaveLength(0);
    });

    it('should handle malformed lines', () => {
      const output = 'id1\tname1\nincomplete';
      const result = parseDockerOutput(output);
      expect(result).toHaveLength(0);
    });
  });

  describe('stopContainers', () => {
    it('should stop containers successfully', async () => {
      mockedSafeDockerExec.mockResolvedValue('');

      await stopContainers(['id1', 'id2']);

      expect(mockedSafeDockerExec).toHaveBeenCalledTimes(2);
      expect(mockedSafeDockerExec).toHaveBeenCalledWith(['stop', 'id1'], { verbose: false, timeout: 30000 });
      expect(mockedSafeDockerExec).toHaveBeenCalledWith(['stop', 'id2'], { verbose: false, timeout: 30000 });
    });

    it('should handle stop failures gracefully', async () => {
      mockedSafeDockerExec.mockRejectedValue(new Error('Stop failed'));

      // Should not throw
      await expect(stopContainers(['id1'])).resolves.not.toThrow();
    });
  });

  describe('removeContainers', () => {
    it('should remove containers successfully', async () => {
      mockedSafeDockerExec.mockResolvedValue('');

      await removeContainers(['id1', 'id2']);

      expect(mockedSafeDockerExec).toHaveBeenCalledTimes(2);
      expect(mockedSafeDockerExec).toHaveBeenCalledWith(['rm', 'id1'], { verbose: false, timeout: 30000 });
      expect(mockedSafeDockerExec).toHaveBeenCalledWith(['rm', 'id2'], { verbose: false, timeout: 30000 });
    });

    it('should handle remove failures gracefully', async () => {
      mockedSafeDockerExec.mockRejectedValue(new Error('Remove failed'));

      await expect(removeContainers(['id1'])).resolves.not.toThrow();
    });
  });

  describe('validateContainerLabels', () => {
    it('should validate complete labels', () => {
      const labels: ContainerLabels = {
        'aisanity.workspace': '/path',
        'aisanity.branch': 'main',
        'aisanity.container': 'test',
        'aisanity.created': '2023-01-01',
        'aisanity.version': '1.0.0'
      };

      expect(validateContainerLabels(labels)).toBe(true);
    });

    it('should reject incomplete labels', () => {
      const incompleteLabels = {
        'aisanity.workspace': '/path',
        'aisanity.branch': 'main'
        // Missing required labels
      };

      expect(validateContainerLabels(incompleteLabels)).toBe(false);
    });

    it('should handle undefined labels', () => {
      expect(validateContainerLabels(undefined as any)).toBe(false);
    });
  });

  describe('generateContainerLabels', () => {
    it('should generate complete container labels', () => {
      const labels = generateContainerLabels('test-workspace', 'feature-branch', 'test-container', '/path/to/workspace');

      expect(labels).toEqual({
        'aisanity.workspace': '/path/to/workspace',
        'aisanity.branch': 'feature-branch',
        'aisanity.container': 'test-container',
        'aisanity.created': expect.any(String),
        'aisanity.version': expect.any(String)
      });

      expect(labels['aisanity.created']).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('isContainerOrphaned', () => {
    it('should identify orphaned containers', () => {
      const orphanedContainer: DockerContainer = {
        id: 'id1',
        name: 'orphan',
        image: 'test',
        status: 'running',
        labels: { 'aisanity.workspace': '/nonexistent/path' },
        ports: ''
      };

      const existingWorktrees = ['/existing/path'];

      expect(isContainerOrphaned(orphanedContainer, existingWorktrees)).toBe(true);
    });

    it('should not mark containers with existing worktrees as orphaned', () => {
      const validContainer: DockerContainer = {
        id: 'id1',
        name: 'valid',
        image: 'test',
        status: 'running',
        labels: { 'aisanity.workspace': '/existing/path' },
        ports: ''
      };

      const existingWorktrees = ['/existing/path'];

      expect(isContainerOrphaned(validContainer, existingWorktrees)).toBe(false);
    });

    it('should not mark unlabeled containers as orphaned', () => {
      const unlabeledContainer: DockerContainer = {
        id: 'id1',
        name: 'unlabeled',
        image: 'test',
        status: 'running',
        labels: {},
        ports: ''
      };

      const existingWorktrees = ['/existing/path'];

      expect(isContainerOrphaned(unlabeledContainer, existingWorktrees)).toBe(false);
    });
  });
});