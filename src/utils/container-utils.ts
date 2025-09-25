import { execSync } from 'child_process';
import * as path from 'path';
import { safeDockerExec } from './docker-safe-exec';
import { getAllWorktrees } from './worktree-utils';
import { readFileSync } from 'fs';

export interface ContainerLabels {
  'aisanity.workspace': string;
  'aisanity.branch': string;
  'aisanity.container': string;
  'aisanity.created': string;
  'aisanity.version': string;
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  labels: Record<string, string>;
  ports: string;
}

export interface ContainerDiscoveryResult {
  containers: DockerContainer[];
  labeled: DockerContainer[];
  unlabeled: DockerContainer[];
  orphaned: DockerContainer[];
  errors: DiscoveryError[];
}

export interface DiscoveryError {
  container: string;
  error: string;
}

export interface ContainerLifecycleState {
  id: string;
  name: string;
  labels: ContainerLabels;
  workspacePath: string;
  branch: string;
  status: 'running' | 'stopped' | 'orphaned' | 'unknown';
  lastActivity: Date;
  worktreeExists: boolean;
}

/**
 * Discover all containers using multiple strategies
 */
export async function discoverContainers(verbose: boolean = false): Promise<ContainerDiscoveryResult> {
  const containers: DockerContainer[] = [];
  const labeled: DockerContainer[] = [];
  const unlabeled: DockerContainer[] = [];
  const orphaned: DockerContainer[] = [];
  const errors: DiscoveryError[] = [];

  // Strategy 1: Discover by aisanity labels
  try {
    const labeledContainers = await discoverByLabels(verbose);
    containers.push(...labeledContainers);
    labeled.push(...labeledContainers);
  } catch (error) {
    errors.push({
      container: 'labels',
      error: error instanceof Error ? error.message : 'Unknown discovery error'
    });
  }

  

  // Strategy 3: Discover by devcontainer metadata
  try {
    const devcontainerContainers = await discoverByDevcontainerMetadata(verbose);
    // Filter out already discovered containers
    const newDevContainers = devcontainerContainers.filter(dc =>
      !containers.some(c => c.id === dc.id)
    );
    containers.push(...newDevContainers);
    unlabeled.push(...newDevContainers);
  } catch (error) {
    errors.push({
      container: 'devcontainer',
      error: error instanceof Error ? error.message : 'Unknown discovery error'
    });
  }

  // Identify orphaned containers
  const worktrees = getAllWorktrees(process.cwd());
  const existingWorktreePaths = new Set([
    worktrees.main.path,
    ...worktrees.worktrees.map(wt => wt.path)
  ]);

  for (const container of containers) {
    const workspacePath = container.labels['aisanity.workspace'];
    if (workspacePath && !existingWorktreePaths.has(workspacePath)) {
      orphaned.push(container);
    }
  }

  return {
    containers,
    labeled,
    unlabeled,
    orphaned,
    errors
  };
}

/**
 * Discover containers by aisanity labels
 */
export async function discoverByLabels(verbose: boolean = false): Promise<DockerContainer[]> {
  try {
    const result = await safeDockerExec([
      'ps', '-a',
      '--filter', 'label=aisanity.workspace',
      '--format', '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.Labels}}'
    ], { verbose, timeout: 10000 });

    return parseDockerOutput(result);
  } catch (error) {
    if (verbose) {
      console.warn('Label-based discovery failed:', error);
    }
    return [];
  }
}



/**
 * Discover containers by devcontainer metadata
 */
export async function discoverByDevcontainerMetadata(verbose: boolean = false): Promise<DockerContainer[]> {
  try {
    const result = await safeDockerExec([
      'ps', '-a',
      '--filter', 'label=devcontainer.local_folder',
      '--format', '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.Labels}}'
    ], { verbose, timeout: 10000 });

    return parseDockerOutput(result);
  } catch (error) {
    if (verbose) {
      console.warn('Devcontainer metadata discovery failed:', error);
    }
    return [];
  }
}

/**
 * Parse docker ps output into DockerContainer objects
 */
export function parseDockerOutput(output: string): DockerContainer[] {
  const lines = output.trim().split('\n').filter(line => line.trim() !== '');
  const containers: DockerContainer[] = [];

  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length >= 6) {
      const [id, name, image, status, ports, labelsStr] = parts;
      const labels: Record<string, string> = {};

      if (labelsStr) {
        labelsStr.split(',').forEach(label => {
          const [key, value] = label.split('=');
          if (key && value) {
            labels[key] = value;
          }
        });
      }

      containers.push({
        id,
        name,
        image,
        status,
        labels,
        ports: ports || ''
      });
    }
  }

  return containers;
}



/**
 * Stop containers by IDs
 */
export async function stopContainers(containerIds: string[], verbose: boolean = false): Promise<void> {
  for (const id of containerIds) {
    try {
      await safeDockerExec(['stop', id], { verbose, timeout: 30000 });
      if (verbose) {
        console.log(`Stopped container: ${id}`);
      }
    } catch (error) {
      console.warn(`Failed to stop container ${id}:`, error);
    }
  }
}

/**
 * Remove containers by IDs
 */
export async function removeContainers(containerIds: string[], verbose: boolean = false): Promise<void> {
  for (const id of containerIds) {
    try {
      await safeDockerExec(['rm', id], { verbose, timeout: 30000 });
      if (verbose) {
        console.log(`Removed container: ${id}`);
      }
    } catch (error) {
      console.warn(`Failed to remove container ${id}:`, error);
    }
  }
}

/**
 * Validate container labels
 */
export function validateContainerLabels(labels: ContainerLabels | Record<string, string> | undefined): boolean {
  if (!labels) return false;

  const requiredLabels: (keyof ContainerLabels)[] = [
    'aisanity.workspace',
    'aisanity.branch',
    'aisanity.container'
  ];

  return requiredLabels.every(label => labels[label] !== undefined);
}

/**
 * Generate container labels for a workspace
 */
export function generateContainerLabels(
  workspaceName: string,
  branch: string,
  containerName: string,
  workspacePath: string
): ContainerLabels {
  // Get version from package.json
  let version = 'unknown';
  try {
    const packageJson = JSON.parse(readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
    version = packageJson.version || 'unknown';
  } catch (error) {
    // Ignore error, use default
  }

  return {
    'aisanity.workspace': workspacePath,
    'aisanity.branch': branch,
    'aisanity.container': containerName,
    'aisanity.created': new Date().toISOString(),
    'aisanity.version': version
  };
}

/**
 * Check if container is orphaned
 */
export function isContainerOrphaned(container: DockerContainer, existingWorktrees: string[]): boolean {
  const workspacePath = container.labels['aisanity.workspace'];
  if (!workspacePath) {
    return false; // Can't determine if unlabeled containers are orphaned
  }
  return !existingWorktrees.includes(workspacePath);
}