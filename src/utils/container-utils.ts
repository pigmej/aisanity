import { $ } from 'bun';
import { execSync } from 'child_process';
import { getAllWorktrees, WorktreeList } from './worktree-utils';
import { getVersionAsync } from './version';

// Constants for Docker command execution
const DEFAULT_DOCKER_TIMEOUT = 10000; // 10 seconds

// Simple cache for container status queries
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const statusCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 5000; // 5 seconds

// Cache helper functions
function getFromCache<T>(key: string): T | null {
  const entry = statusCache.get(key);
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    statusCache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  statusCache.set(key, {
    data,
    timestamp: Date.now()
  });
}

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

export interface Container {
  id: string;
  name: string;
  status: 'Running' | 'Stopped' | 'Not created';
  ports: string[];
  labels: Record<string, string>;
  workspaceId?: string;
  branchName?: string;
  createdAt?: Date;
  lastAccessed?: Date;
}

export interface DockerCommandError {
  command: string;
  exitCode: number;
  stderr: string;
  context: string;
  timestamp: Date;
}

/**
 * Centralized Docker command execution with proper error handling
 */
export async function executeDockerCommand(command: string, options?: {
  silent?: boolean;
  timeout?: number;
  verbose?: boolean;
}): Promise<{ stdout: string; stderr: string; success: boolean }> {
  const startTime = Date.now();
  try {
    const timeout = options?.timeout || DEFAULT_DOCKER_TIMEOUT;
    
    if (options?.verbose) {
      console.log(`[Docker] Executing: ${command}`);
    }
    
    const result = execSync(command, {
      encoding: 'utf8',
      timeout,
      stdio: options?.silent ? ['pipe', 'pipe', 'pipe'] : 'inherit'
    });
    
    if (options?.verbose) {
      const duration = Date.now() - startTime;
      console.log(`[Docker] Success (${duration}ms): ${result.trim().split('\n')[0]}`);
    }
    
    return {
      stdout: result,
      stderr: '',
      success: true
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStderr = (error as any).stderr || errorMessage;
    
    // Add actionable suggestions for common Docker issues
    let actionableError = errorStderr;
    if (errorMessage.includes('Cannot connect to the Docker daemon')) {
      actionableError = `${errorStderr}\n\nSuggestion: Is Docker running? Try: docker ps`;
    } else if (errorMessage.includes('permission denied')) {
      actionableError = `${errorStderr}\n\nSuggestion: Try running with sudo or add your user to the docker group`;
    } else if (errorMessage.includes('command not found')) {
      actionableError = `${errorStderr}\n\nSuggestion: Docker is not installed or not in PATH. Please install Docker`;
    }
    
    if (options?.verbose) {
      const duration = Date.now() - startTime;
      console.log(`[Docker] Error (${duration}ms): ${actionableError}`);
    }
    
    return {
      stdout: '',
      stderr: actionableError,
      success: false
    };
  }
}

/**
 * Multi-tier container discovery for current workspace
 */
export async function discoverWorkspaceContainers(workspaceId: string, options?: {
  verbose?: boolean;
}): Promise<Container[]> {
  const startTime = Date.now();
  const containers: Container[] = [];
  const verbose = options?.verbose || false;
  
  // Test environment: use mock containers if provided
  if (process.env.AISANITY_TEST_CONTAINERS) {
    try {
      const mockContainers = JSON.parse(process.env.AISANITY_TEST_CONTAINERS);
      return mockContainers.map((container: any) => ({
        id: container.id,
        name: container.name,
        status: container.status,
        ports: container.ports,
        labels: container.labels || {}
      }));
    } catch (error) {
      if (verbose) {
        console.log('Failed to parse test containers:', error);
      }
    }
  }
  
  // Strategy 1: Discover by workspace label (primary)
  try {
    const result = await executeDockerCommand(
      `docker ps -a --filter label=aisanity.workspace="${workspaceId}" --format "{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Labels}}"`,
      { silent: true, verbose }
    );
    
    if (result.success) {
      const parsedContainers = parseDockerOutputToContainers(result.stdout, workspaceId);
      containers.push(...parsedContainers);
    }
  } catch (error: unknown) {
    if (verbose) {
      console.log(`Strategy 1 (workspace label) failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    // Continue to next strategy
  }
  
  // Strategy 2: Discover by container name pattern (fallback)
  if (containers.length === 0) {
    try {
      const result = await executeDockerCommand(
        `docker ps -a --format "{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Labels}}"`,
        { silent: true, verbose }
      );
      
      if (result.success) {
        const allContainers = parseDockerOutputToContainers(result.stdout, workspaceId);
        // Filter by name pattern that suggests workspace containers
        const workspaceContainers = allContainers.filter(container => 
          container.name.includes(workspaceId) || 
          container.labels['aisanity.workspace'] === workspaceId
        );
        containers.push(...workspaceContainers);
      }
  } catch (error: unknown) {
    if (verbose) {
      console.log(`Strategy 2 (name pattern) failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    // Continue to next strategy
  }
  }
  
  if (verbose) {
    const duration = Date.now() - startTime;
    console.log(`[Performance] Container discovery completed in ${duration}ms, found ${containers.length} containers`);
  }
  
  return containers;
}

/**
 * Enhanced container discovery with multiple fallback strategies
 * @param workspaceId - The workspace identifier to search for
 * @param options - Configuration options for discovery
 * @returns Promise resolving to an array of discovered containers
 */
export async function discoverWorkspaceContainersEnhanced(workspaceId: string, options?: {
  verbose?: boolean;
  includeStopped?: boolean;
  timeout?: number;
}): Promise<Container[]> {
  const verbose = options?.verbose || false;
  const includeStopped = options?.includeStopped ?? true;
  const timeout = options?.timeout || DEFAULT_DOCKER_TIMEOUT;
  
  const containers = await discoverWorkspaceContainers(workspaceId, { verbose });
  
  // Filter by stopped status if requested
  const filteredContainers = includeStopped 
    ? containers 
    : containers.filter(c => c.status === 'Running');
    
  if (verbose) {
    console.log(`Found ${containers.length} containers, ${filteredContainers.length} after filtering`);
  }
  
  return filteredContainers;
}

/**
 * Parse docker ps output into Container objects
 * @param output - The raw output from docker ps command
 * @param workspaceId - Optional workspace ID to assign to containers if not found in labels
 * @returns Array of parsed Container objects
 */
export function parseDockerOutputToContainers(output: string, workspaceId?: string): Container[] {
  const lines = output.split('\n').filter(line => line.trim() !== '');
  const containers: Container[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    const parts = trimmedLine.split('\t');
    // Check if original line ended with a tab (indicating empty labels) but trim removed it
    const hasEmptyLabels = line.endsWith('\t') && parts.length === 4;
    
    // Only process lines that have at least 5 parts or have exactly 4 parts with trailing tab
    if (parts.length < 5 && !hasEmptyLabels) {
      continue; // Skip malformed lines
    }
    
    // Handle case where line ends with tab but trim() removed it, creating only 4 parts
    const [id, name, status, ports, labelsStr] = parts.length === 5 ? parts : [...parts, ''];
    const labels: Record<string, string> = {};

    if (labelsStr && labelsStr.trim() !== '') {
      labelsStr.split(',').forEach(label => {
        const parts = label.split('=');
        const key = parts[0];
        const value = parts.slice(1).join('=');
        if (key) {
          labels[key] = value || '';
        }
      });
    }

    // Determine container status
    let containerStatus: 'Running' | 'Stopped' | 'Not created';
    if (status.includes('Up')) {
      containerStatus = 'Running';
    } else if (status.includes('Exited') || status.includes('Created')) {
      containerStatus = 'Stopped';
    } else {
      containerStatus = 'Not created';
    }

    const portsArray = ports && ports.trim() ? ports.trim().split(',').map(p => p.trim()) : [];

    containers.push({
      id,
      name,
      status: containerStatus,
      ports: portsArray,
      labels,
      workspaceId: labels['aisanity.workspace'] || workspaceId,
      branchName: labels['aisanity.branch']
    });
  }

  return containers;
}

/**
 * Reliable container status querying
 */
export async function getContainerStatus(containerId: string): Promise<{
  status: 'Running' | 'Stopped' | 'Not created';
  ports: string[];
  error?: string;
}> {
  const cacheKey = `status:${containerId}`;
  
  // Check cache first
  const cached = getFromCache<{ status: 'Running' | 'Stopped' | 'Not created'; ports: string[]; error?: string }>(cacheKey);
  if (cached) {
    return cached;
  }
  
  try {
    const dockerResult = await executeDockerCommand(
      `docker ps -a --filter id=${containerId} --format "{{.Status}}\t{{.Ports}}"`,
      { silent: true }
    );
    
    if (!dockerResult.success) {
      const errorResult = {
        status: 'Not created' as const,
        ports: [] as string[],
        error: dockerResult.stderr
      };
      setCache(cacheKey, errorResult);
      return errorResult;
    }
    
    const lines = dockerResult.stdout.trim().split('\n').filter((line: string) => line.trim() !== '');
    
    if (lines.length === 0) {
      const emptyResult = { status: 'Not created' as const, ports: [] as string[] };
      setCache(cacheKey, emptyResult);
      return emptyResult;
    }
    
    const [status, ports] = lines[0].split('\t');
    
    let containerStatus: 'Running' | 'Stopped' | 'Not created';
    if (status.includes('Up')) {
      containerStatus = 'Running';
    } else if (status.includes('Exited') || status.includes('Created')) {
      containerStatus = 'Stopped';
    } else {
      containerStatus = 'Not created';
    }
    
    const portsArray = ports && ports.trim() ? ports.trim().split(',').map((p: string) => p.trim()) : [];
    
    const statusResult = {
      status: containerStatus,
      ports: portsArray
    };
    
    // Cache the result
    setCache(cacheKey, statusResult);
    
    return statusResult;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    let actionableError = errorMessage;
    
    if (errorMessage.includes('Cannot connect to the Docker daemon')) {
      actionableError = `${errorMessage}\n\nSuggestion: Is Docker running? Try: docker ps`;
    } else if (errorMessage.includes('permission denied')) {
      actionableError = `${errorMessage}\n\nSuggestion: Try running with sudo or add your user to the docker group`;
    }
    
    const errorResult = {
      status: 'Not created' as const,
      ports: [] as string[],
      error: actionableError
    };
    
    setCache(cacheKey, errorResult);
    return errorResult;
  }
}

/**
 * Enhanced container information retrieval
 */
export async function getContainerInfo(containerId: string): Promise<{
  id: string;
  name: string;
  status: string;
  ports: string[];
  labels: Record<string, string>;
  workspaceId?: string;
  branchName?: string;
}> {
  try {
    const result = await executeDockerCommand(
      `docker ps -a --filter id=${containerId} --format "{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Labels}}"`,
      { silent: true }
    );
    
    if (!result.success) {
      throw new Error(`Failed to get container info: ${result.stderr}`);
    }
    
    const lines = result.stdout.trim().split('\n').filter(line => line.trim() !== '');
    
    if (lines.length === 0) {
      throw new Error(`Container ${containerId} not found`);
    }
    
    const [id, name, status, ports, labelsStr] = lines[0].split('\t');
    const labels: Record<string, string> = {};

      if (labelsStr && labelsStr.trim() !== '') {
        labelsStr.split(',').forEach(label => {
          const parts = label.split('=');
          const key = parts[0];
          const value = parts.slice(1).join('=');
          if (key) {
            labels[key] = value || '';
          }
        });
      }

    const portsArray = ports && ports.trim() ? ports.trim().split(',').map(p => p.trim()) : [];
    
    return {
      id,
      name,
      status,
      ports: portsArray,
      labels,
      workspaceId: labels['aisanity.workspace'],
      branchName: labels['aisanity.branch']
    };
  } catch (error: unknown) {
    throw new Error(`Failed to get container info for ${containerId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Discover all containers using multiple strategies
 */
export async function discoverContainers(verbose: boolean = false, cachedWorktrees?: WorktreeList): Promise<ContainerDiscoveryResult> {
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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
    errors.push({
      container: 'devcontainer',
      error: error instanceof Error ? error.message : 'Unknown discovery error'
    });
  }

  // Identify orphaned containers
  const worktreeData = cachedWorktrees || getAllWorktrees(process.cwd());
  const existingWorktreePaths = new Set([
    worktreeData.main.path,
    ...worktreeData.worktrees.map(wt => wt.path)
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
    const result = await executeDockerCommand(
      'docker ps -a --filter label=aisanity.workspace --format "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.Labels}}"',
      { silent: true }
    );

    if (result.success) {
      return parseDockerOutput(result.stdout);
    }
    return [];
  } catch (error: unknown) {
    if (verbose) {
      console.warn('Label-based discovery failed:', error instanceof Error ? error.message : 'Unknown error');
    }
    return [];
  }
}



/**
 * Discover containers by devcontainer metadata
 */
export async function discoverByDevcontainerMetadata(verbose: boolean = false): Promise<DockerContainer[]> {
  try {
    const result = await executeDockerCommand(
      'docker ps -a --filter label=devcontainer.local_folder --format "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.Labels}}"',
      { silent: true }
    );

    if (result.success) {
      return parseDockerOutput(result.stdout);
    }
    return [];
  } catch (error: unknown) {
    if (verbose) {
      console.warn('Devcontainer metadata discovery failed:', error instanceof Error ? error.message : 'Unknown error');
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

      if (labelsStr && labelsStr.trim() !== '') {
        labelsStr.split(',').forEach(label => {
          const parts = label.split('=');
          const key = parts[0];
          const value = parts.slice(1).join('=');
          if (key) {
            labels[key] = value || '';
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
      const result = await executeDockerCommand(`docker stop ${id}`, { silent: true });
      if (result.success) {
        if (verbose) {
          console.log(`Stopped container: ${id}`);
        }
      } else {
        console.warn(`Failed to stop container ${id}:`, result.stderr);
      }
    } catch (error: unknown) {
      console.warn(`Failed to stop container ${id}:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }
}

/**
 * Remove containers by IDs
 */
export async function removeContainers(containerIds: string[], verbose: boolean = false): Promise<void> {
  for (const id of containerIds) {
    try {
      const result = await executeDockerCommand(`docker rm ${id}`, { silent: true });
      if (result.success) {
        if (verbose) {
          console.log(`Removed container: ${id}`);
        }
      } else {
        console.warn(`Failed to remove container ${id}:`, result.stderr);
      }
    } catch (error: unknown) {
      console.warn(`Failed to remove container ${id}:`, error instanceof Error ? error.message : 'Unknown error');
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
export async function generateContainerLabels(
  _workspaceName: string,
  branch: string,
  containerName: string,
  workspacePath: string
): Promise<ContainerLabels> {
  // Get version from version utility
  const version = await getVersionAsync();

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