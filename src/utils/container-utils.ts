import { $ } from "bun";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { getAllWorktrees, WorktreeList } from "./worktree-utils";
import { getVersionAsync } from "./version";

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
    timestamp: Date.now(),
  });
}

export interface ContainerLabels {
  "aisanity.workspace": string;
  "aisanity.branch": string;
  "aisanity.container": string;
  "aisanity.created": string;
  "aisanity.version": string;
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
  status: "running" | "stopped" | "orphaned" | "unknown";
  lastActivity: Date;
  worktreeExists: boolean;
}

export interface Container {
  id: string;
  name: string;
  status: "Running" | "Stopped" | "Not created";
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

// NEW: Container Discovery Configuration
export interface ContainerDiscoveryOptions {
  mode: "global" | "workspace" | "worktree";
  includeOrphaned: boolean;
  validationMode: "strict" | "permissive";
  verbose?: boolean;  // User-facing details
  debug?: boolean;    // System internals
  workspace?: string;
  worktree?: string;
  cachedWorktrees?: WorktreeList;
}

// NEW: Enhanced Discovery Result
export interface EnhancedContainerDiscoveryResult extends ContainerDiscoveryResult {
  validationResults: Map<string, WorktreeValidationResult>;
  discoveryMetadata: {
    totalDiscovered: number;
    labeledCount: number;
    unlabeledCount: number;
    orphanedCount: number;
    validationMode: "strict" | "permissive";
    discoveryTimestamp: Date;
  };
}

// NEW: Worktree validation result
export interface WorktreeValidationResult {
  workspacePath: string;
  exists: boolean;
  isValid: boolean;
  error?: string;
  validationMethod: "filesystem" | "git" | "cache";
}

/**
 * Centralized Docker command execution with proper error handling
 */
export async function executeDockerCommand(
  command: string,
  options?: {
    silent?: boolean;
    timeout?: number;
    verbose?: boolean;
    debug?: boolean;
  },
): Promise<{ stdout: string; stderr: string; success: boolean }> {
  const startTime = Date.now();
  try {
    const timeout = options?.timeout || DEFAULT_DOCKER_TIMEOUT;

    if (options?.debug) {
      console.log(`[Docker] Executing: ${command}`);
    }

    const result = execSync(command, {
      encoding: "utf8",
      timeout,
      stdio: options?.silent ? ["pipe", "pipe", "pipe"] : "inherit",
    });

    if (options?.debug) {
      const duration = Date.now() - startTime;
      console.log(`[Docker] Success (${duration}ms): ${result.trim().split("\n")[0]}`);
    }

    return {
      stdout: result,
      stderr: "",
      success: true,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStderr = (error as any).stderr || errorMessage;

    // Add actionable suggestions for common Docker issues
    let actionableError = errorStderr;
    if (errorMessage.includes("Cannot connect to the Docker daemon")) {
      actionableError = `${errorStderr}\n\nSuggestion: Is Docker running? Try: docker ps`;
    } else if (errorMessage.includes("permission denied")) {
      actionableError = `${errorStderr}\n\nSuggestion: Try running with sudo or add your user to the docker group`;
    } else if (errorMessage.includes("command not found")) {
      actionableError = `${errorStderr}\n\nSuggestion: Docker is not installed or not in PATH. Please install Docker`;
    }

    if (options?.debug) {
      const duration = Date.now() - startTime;
      console.log(`[Docker] Error (${duration}ms): ${actionableError}`);
    }

    return {
      stdout: "",
      stderr: actionableError,
      success: false,
    };
  }
}

/**
 * Multi-tier container discovery for current workspace
 */
export async function discoverWorkspaceContainers(
  workspaceId: string,
  options?: {
    verbose?: boolean;
    debug?: boolean;
  },
): Promise<Container[]> {
  const startTime = Date.now();
  const containers: Container[] = [];
  const debug = options?.debug || false;

  // Test environment: use mock containers if provided
  if (process.env.AISANITY_TEST_CONTAINERS) {
    try {
      const mockContainers = JSON.parse(process.env.AISANITY_TEST_CONTAINERS);
      return mockContainers.map((container: any) => ({
        id: container.id,
        name: container.name,
        status: container.status,
        ports: container.ports,
        labels: container.labels || {},
      }));
    } catch (error) {
      if (debug) {
        console.log("Failed to parse test containers:", error);
      }
    }
  }

  // Strategy 1: Discover by workspace label (primary)
  try {
    const result = await executeDockerCommand(
      `docker ps -a --filter label=aisanity.workspace="${workspaceId}" --format "{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Labels}}"`,
      { silent: true, debug },
    );

    if (result.success) {
      const parsedContainers = parseDockerOutputToContainers(result.stdout, workspaceId);
      containers.push(...parsedContainers);
    }
  } catch (error: unknown) {
    if (debug) {
      console.log(`Strategy 1 (workspace label) failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
    // Continue to next strategy
  }

  // Strategy 2: Discover by container name pattern (fallback) - DISABLED
  // This fallback is too broad and includes non-aisanity containers
  // We only want to manage containers that have explicit aisanity.workspace labels
  /*
  if (containers.length === 0) {
    try {
      const result = await executeDockerCommand(
        `docker ps -a --format "{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Labels}}"`,
        { silent: true, debug },
      );

      if (result.success) {
        const allContainers = parseDockerOutputToContainers(result.stdout, workspaceId);
        // Filter by name pattern that suggests workspace containers
        const workspaceContainers = allContainers.filter(
          (container) => container.name.includes(workspaceId) || container.labels["aisanity.workspace"] === workspaceId,
        );
        containers.push(...workspaceContainers);
      }
    } catch (error: unknown) {
      if (debug) {
        console.log(`Strategy 2 (name pattern) failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
      // Continue to next strategy
    }
  }
  */

  if (debug) {
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
export async function discoverWorkspaceContainersEnhanced(
  workspaceId: string,
  options?: {
    verbose?: boolean;
    debug?: boolean;
    includeStopped?: boolean;
    timeout?: number;
  },
): Promise<Container[]> {
  const debug = options?.debug || false;
  const includeStopped = options?.includeStopped ?? true;
  const timeout = options?.timeout || DEFAULT_DOCKER_TIMEOUT;

  const containers = await discoverWorkspaceContainers(workspaceId, { debug });

  // Filter by stopped status if requested
  const filteredContainers = includeStopped ? containers : containers.filter((c) => c.status === "Running");

  if (debug) {
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
  const lines = output.split("\n").filter((line) => line.trim() !== "");
  const containers: Container[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    const parts = trimmedLine.split("\t");
    // Check if original line ended with a tab (indicating empty labels) but trim removed it
    const hasEmptyLabels = line.endsWith("\t") && parts.length === 4;

    // Only process lines that have at least 5 parts or have exactly 4 parts with trailing tab
    if (parts.length < 5 && !hasEmptyLabels) {
      continue; // Skip malformed lines
    }

    // Handle case where line ends with tab but trim() removed it, creating only 4 parts
    const [id, name, status, ports, labelsStr] = parts.length === 5 ? parts : [...parts, ""];
    const labels: Record<string, string> = {};

    if (labelsStr && labelsStr.trim() !== "") {
      labelsStr.split(",").forEach((label) => {
        const parts = label.split("=");
        const key = parts[0];
        const value = parts.slice(1).join("=");
        if (key) {
          labels[key] = value || "";
        }
      });
    }

    // Determine container status
    let containerStatus: "Running" | "Stopped" | "Not created";
    if (status.includes("Up")) {
      containerStatus = "Running";
    } else if (status.includes("Exited") || status.includes("Created")) {
      containerStatus = "Stopped";
    } else {
      containerStatus = "Not created";
    }

    const portsArray =
      ports && ports.trim()
        ? ports
            .trim()
            .split(",")
            .map((p) => p.trim())
        : [];

    containers.push({
      id,
      name,
      status: containerStatus,
      ports: portsArray,
      labels,
      workspaceId: labels["aisanity.workspace"] || workspaceId,
      branchName: labels["aisanity.branch"],
    });
  }

  return containers;
}

/**
 * Reliable container status querying
 */
export async function getContainerStatus(containerId: string): Promise<{
  status: "Running" | "Stopped" | "Not created";
  ports: string[];
  error?: string;
}> {
  const cacheKey = `status:${containerId}`;

  // Check cache first
  const cached = getFromCache<{ status: "Running" | "Stopped" | "Not created"; ports: string[]; error?: string }>(
    cacheKey,
  );
  if (cached) {
    return cached;
  }

  try {
    const dockerResult = await executeDockerCommand(
      `docker ps -a --filter id=${containerId} --format "{{.Status}}\t{{.Ports}}"`,
      { silent: true },
    );

    if (!dockerResult.success) {
      const errorResult = {
        status: "Not created" as const,
        ports: [] as string[],
        error: dockerResult.stderr,
      };
      setCache(cacheKey, errorResult);
      return errorResult;
    }

    const lines = dockerResult.stdout
      .trim()
      .split("\n")
      .filter((line: string) => line.trim() !== "");

    if (lines.length === 0) {
      const emptyResult = { status: "Not created" as const, ports: [] as string[] };
      setCache(cacheKey, emptyResult);
      return emptyResult;
    }

    const [status, ports] = lines[0].split("\t");

    let containerStatus: "Running" | "Stopped" | "Not created";
    if (status.includes("Up")) {
      containerStatus = "Running";
    } else if (status.includes("Exited") || status.includes("Created")) {
      containerStatus = "Stopped";
    } else {
      containerStatus = "Not created";
    }

    const portsArray =
      ports && ports.trim()
        ? ports
            .trim()
            .split(",")
            .map((p: string) => p.trim())
        : [];

    const statusResult = {
      status: containerStatus,
      ports: portsArray,
    };

    // Cache the result
    setCache(cacheKey, statusResult);

    return statusResult;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    let actionableError = errorMessage;

    if (errorMessage.includes("Cannot connect to the Docker daemon")) {
      actionableError = `${errorMessage}\n\nSuggestion: Is Docker running? Try: docker ps`;
    } else if (errorMessage.includes("permission denied")) {
      actionableError = `${errorMessage}\n\nSuggestion: Try running with sudo or add your user to the docker group`;
    }

    const errorResult = {
      status: "Not created" as const,
      ports: [] as string[],
      error: actionableError,
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
      { silent: true },
    );

    if (!result.success) {
      throw new Error(`Failed to get container info: ${result.stderr}`);
    }

    const lines = result.stdout
      .trim()
      .split("\n")
      .filter((line) => line.trim() !== "");

    if (lines.length === 0) {
      throw new Error(`Container ${containerId} not found`);
    }

    const [id, name, status, ports, labelsStr] = lines[0].split("\t");
    const labels: Record<string, string> = {};

    if (labelsStr && labelsStr.trim() !== "") {
      labelsStr.split(",").forEach((label) => {
        const parts = label.split("=");
        const key = parts[0];
        const value = parts.slice(1).join("=");
        if (key) {
          labels[key] = value || "";
        }
      });
    }

    const portsArray =
      ports && ports.trim()
        ? ports
            .trim()
            .split(",")
            .map((p) => p.trim())
        : [];

    return {
      id,
      name,
      status,
      ports: portsArray,
      labels,
      workspaceId: labels["aisanity.workspace"],
      branchName: labels["aisanity.branch"],
    };
  } catch (error: unknown) {
    throw new Error(
      `Failed to get container info for ${containerId}: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Validate worktree existence without throwing errors or filtering.
 * This allows orphaned container detection even when worktrees are invalid.
 *
 * Use this function when:
 * - You need to validate worktree paths without throwing exceptions
 * - You want to distinguish between "path doesn't exist" and "path exists but invalid"
 * - You're implementing container discovery that needs to handle orphaned containers
 * - You need detailed validation information for error reporting
 *
 * Validation modes:
 * - 'permissive': Only checks if path exists, suitable for orphaned detection
 * - 'strict': Validates both path existence and git directory structure
 *
 * @param workspacePath - Path to worktree directory to validate
 * @param mode - Validation strictness: 'permissive' or 'strict'
 * @param verbose - Enable verbose logging of validation process
 * @returns Validation result with existence status, validity, and error details
 *
 * @example
 * // Permissive validation for orphaned container detection
 * const result = await validateWorktreePermissive('/path/to/worktree', 'permissive', false);
 * if (!result.exists) {
 *   // Container is orphaned - worktree directory doesn't exist
 * }
 *
 * @example
 * // Strict validation for worktree operations
 * const result = await validateWorktreePermissive('/path/to/worktree', 'strict', true);
 * if (!result.isValid) {
 *   console.log(`Worktree invalid: ${result.error}`);
 * }
 */
export async function validateWorktreePermissive(
  workspacePath: string,
  mode: "strict" | "permissive",
  debug: boolean,
): Promise<WorktreeValidationResult> {
  try {
    // Check filesystem existence first (fastest)
    const exists = fs.existsSync(workspacePath);

    if (!exists) {
      return {
        workspacePath,
        exists: false,
        isValid: false,
        validationMethod: "filesystem",
      };
    }

    // If permissive mode, existence is enough
    if (mode === "permissive") {
      return {
        workspacePath,
        exists: true,
        isValid: true,
        validationMethod: "filesystem",
      };
    }

    // Strict mode: also validate git directory
    const gitPath = path.join(workspacePath, ".git");
    const gitExists = fs.existsSync(gitPath);

    if (!gitExists) {
      return {
        workspacePath,
        exists: true,
        isValid: false,
        error: ".git directory missing",
        validationMethod: "git",
      };
    }

    // Check if .git is file (worktree) or directory (main repo)
    const gitStats = fs.statSync(gitPath);
    const isGitFile = gitStats.isFile();

    if (isGitFile) {
      // Validate gitdir reference
      const gitContent = fs.readFileSync(gitPath, "utf8").trim();
      if (!gitContent.startsWith("gitdir:")) {
        return {
          workspacePath,
          exists: true,
          isValid: false,
          error: "Invalid .git file format",
          validationMethod: "git",
        };
      }
    }

    return {
      workspacePath,
      exists: true,
      isValid: true,
      validationMethod: "git",
    };
  } catch (error) {
    if (debug) {
      console.warn(`[Validation] Error validating ${workspacePath}:`, error);
    }

    return {
      workspacePath,
      exists: false,
      isValid: false,
      error: error instanceof Error ? error.message : "Unknown error",
      validationMethod: "filesystem",
    };
  }
}

/**
 * Discover all aisanity containers without filtering by worktree validation.
 * This is the PRIMARY discovery method for consistency across commands.
 *
 * Use this function when:
 * - You need consistent container discovery across different commands
 * - You want to include orphaned containers (containers whose worktrees have been deleted)
 * - You need detailed validation results for each container
 * - You're implementing commands like `status`, `stop --all-worktrees`, or `cleanup`
 *
 * @param options - Discovery configuration including validation mode and verbosity
 * @returns Enhanced discovery result with validation metadata and orphaned container detection
 *
 * @example
 * // For status command - include orphaned containers with permissive validation
 * const result = await discoverAllAisanityContainers({
 *   mode: 'global',
 *   includeOrphaned: true,
 *   validationMode: 'permissive',
 *   verbose: false
 * });
 *
 * @example
 * // For stop --all-worktrees command - same configuration as status
 * const result = await discoverAllAisanityContainers({
 *   mode: 'global',
 *   includeOrphaned: true,
 *   validationMode: 'permissive',
 *   verbose: true
 * });
 */
export async function discoverAllAisanityContainers(
  options: ContainerDiscoveryOptions,
): Promise<EnhancedContainerDiscoveryResult> {
  const startTime = Date.now();
  const containers: DockerContainer[] = [];
  const labeled: DockerContainer[] = [];
  const unlabeled: DockerContainer[] = [];
  const validationResults = new Map<string, WorktreeValidationResult>();

  // PHASE 1: Container Discovery (No worktree filtering)
  await discoverContainersPhase(containers, labeled, unlabeled, options);

  // PHASE 2: Worktree Validation (Non-blocking)
  if (options.includeOrphaned) {
    await validateContainerWorktreesPhase(containers, validationResults, options);
  }

  // PHASE 3: Orphaned Identification (Based on validation results)
  const orphaned = identifyOrphanedContainers(containers, validationResults, options.validationMode);

  const duration = Date.now() - startTime;
  logDiscoveryResults(containers, labeled, unlabeled, orphaned, duration, options.verbose || false, options.debug || false);

  return {
    containers,
    labeled,
    unlabeled,
    orphaned,
    errors: [],
    validationResults,
    discoveryMetadata: {
      totalDiscovered: containers.length,
      labeledCount: labeled.length,
      unlabeledCount: unlabeled.length,
      orphanedCount: orphaned.length,
      validationMode: options.validationMode,
      discoveryTimestamp: new Date(),
    },
  };
}

/**
 * Phase 1: Container Discovery (No worktree filtering)
 */
async function discoverContainersPhase(
  containers: DockerContainer[],
  labeled: DockerContainer[],
  unlabeled: DockerContainer[],
  options: ContainerDiscoveryOptions,
): Promise<void> {
  const debug = options.debug || false;
  
  // Strategy 1: Label-based discovery (primary)
  try {
    const labeledContainers = await discoverByLabels(debug);
    containers.push(...labeledContainers);
    labeled.push(...labeledContainers);

    if (debug) {
      console.log(`[Discovery] Found ${labeledContainers.length} labeled containers`);
    }
  } catch (error) {
    handleDiscoveryError(error, "Label-based discovery", debug);
  }

  // Strategy 2: Devcontainer metadata discovery (fallback) - DISABLED
  // This fallback was too broad and included non-aisanity containers as orphaned
  // Only containers with aisanity.workspace label should be managed by aisanity
  // Keeping this commented for reference in case we need a more targeted fallback later
  /*
  try {
    const devcontainerContainers = await discoverByDevcontainerMetadata(debug);
    const newContainers = deduplicateContainers(devcontainerContainers, containers);
    containers.push(...newContainers);
    unlabeled.push(...newContainers);

    if (debug) {
      console.log(`[Discovery] Found ${newContainers.length} additional devcontainer containers`);
    }
  } catch (error) {
    handleDiscoveryError(error, "Devcontainer discovery", debug);
  }
  */
}

/**
 * Phase 2: Worktree Validation (Non-blocking)
 */
async function validateContainerWorktreesPhase(
  containers: DockerContainer[],
  validationResults: Map<string, WorktreeValidationResult>,
  options: ContainerDiscoveryOptions,
): Promise<void> {
  const debug = options.debug || false;
  
  for (const container of containers) {
    const workspacePath = container.labels["aisanity.workspace"];

    // Only validate containers that have aisanity.workspace label
    // This ensures we only manage containers that aisanity created
    if (workspacePath) {
      const validationResult = await validateWorktreePermissive(
        workspacePath,
        options.validationMode,
        debug,
      );
      validationResults.set(container.id, validationResult);
    }
    // Skip containers without aisanity.workspace label entirely
    // They are not managed by aisanity and should not be considered for orphaned status
  }
  
  if (debug) {
    const validCount = Array.from(validationResults.values()).filter(v => v.isValid).length;
    console.log(`[Validation] Validated ${validationResults.size} worktrees (${validCount} valid, ${validationResults.size - validCount} invalid)`);
  }
}

/**
 * Phase 3: Orphaned Identification
 * Only containers with aisanity.workspace label are considered for orphaned detection
 */
function identifyOrphanedContainers(
  containers: DockerContainer[],
  validationResults: Map<string, WorktreeValidationResult>,
  validationMode: "strict" | "permissive",
): DockerContainer[] {
  const orphaned: DockerContainer[] = [];

  for (const container of containers) {
    // Only process containers that have aisanity.workspace label
    // This ensures we only manage containers that aisanity created
    if (!container.labels["aisanity.workspace"]) {
      continue;
    }

    const validation = validationResults.get(container.id);

    if (validation) {
      const isOrphaned = validationMode === "strict" ? !validation.exists || !validation.isValid : !validation.exists;

      if (isOrphaned) {
        orphaned.push(container);
      }
    }
  }

  return orphaned;
}

/**
 * Helper Functions
 */
function deduplicateContainers(
  newContainers: DockerContainer[],
  existingContainers: DockerContainer[],
): DockerContainer[] {
  return newContainers.filter((dc) => !existingContainers.some((c) => c.id === dc.id));
}

function handleDiscoveryError(error: unknown, context: string, debug: boolean): void {
  if (debug) {
    console.warn(`[Discovery] ${context} failed:`, error);
  }
  // Continue - don't fail on discovery errors
}

function logDiscoveryResults(
  containers: DockerContainer[],
  labeled: DockerContainer[],
  unlabeled: DockerContainer[],
  orphaned: DockerContainer[],
  duration: number,
  verbose: boolean,
  debug: boolean,
): void {
  // System-level debug information
  if (debug) {
    console.log(`[Discovery] Completed in ${duration}ms`);
    console.log(
      `[Discovery] Total: ${containers.length}, Labeled: ${labeled.length}, Unlabeled: ${unlabeled.length}, Orphaned: ${orphaned.length}`,
    );
  }
  
  // User-facing verbose information - intentionally empty here
  // Orphaned container details should be displayed by caller using formatOrphanedContainerInfo()
}

/**
 * Legacy wrapper for backward compatibility.
 * Now delegates to new unified discovery system.
 *
 * Use this function when:
 * - You're maintaining existing code that uses the old API
 * - You need backward compatibility with existing function signatures
 * - You're working with code that hasn't been migrated to the new API yet
 *
 * For new code, prefer using `discoverAllAisanityContainers()` instead.
 *
 * Key differences from `discoverAllAisanityContainers()`:
 * - Uses fixed 'global' mode with permissive validation
 * - Returns legacy `ContainerDiscoveryResult` format instead of enhanced format
 * - Does not provide access to validation metadata or discovery timestamps
 * - Maintains backward compatibility for existing callers
 *
 * @param verbose - Enable verbose logging (passed through to new discovery system)
 * @param cachedWorktrees - Optional cached worktree data (passed through to new discovery system)
 * @returns Legacy discovery result format for backward compatibility
 *
 * @deprecated Use `discoverAllAisanityContainers()` for new code. This function exists for backward compatibility.
 *
 * @example
 * // Legacy usage (existing code)
 * const result = await discoverContainers(true);
 * console.log(`Found ${result.containers.length} containers`);
 *
 * @example
 * // New approach (recommended for new code)
 * const result = await discoverAllAisanityContainers({
 *   mode: 'global',
 *   includeOrphaned: true,
 *   validationMode: 'permissive',
 *   verbose: true
 * });
 * console.log(`Found ${result.containers.length} containers`);
 * console.log(`Discovery metadata:`, result.discoveryMetadata);
 */
export async function discoverContainers(
  verbose: boolean = false,
  cachedWorktrees?: WorktreeList,
): Promise<ContainerDiscoveryResult> {
  // Use new unified discovery with permissive validation
  const result = await discoverAllAisanityContainers({
    mode: "global",
    includeOrphaned: true,
    validationMode: "permissive",
    verbose,
    cachedWorktrees,
  });

  // Return in legacy format for backward compatibility
  return {
    containers: result.containers,
    labeled: result.labeled,
    unlabeled: result.unlabeled,
    orphaned: result.orphaned,
    errors: result.errors,
  };
}

/**
 * Discover containers by aisanity labels
 */
export async function discoverByLabels(debug: boolean = false): Promise<DockerContainer[]> {
  // Test environment: use mock containers if provided
  if (process.env.AISANITY_TEST_CONTAINERS) {
    try {
      const mockContainers = JSON.parse(process.env.AISANITY_TEST_CONTAINERS);
      // Only return containers that have aisanity.workspace label
      // This ensures consistency with production behavior
      const aisanityContainers = mockContainers.filter((container: any) => 
        container.labels && container.labels["aisanity.workspace"]
      );
      return aisanityContainers.map((container: any) => ({
        id: container.id,
        name: container.name,
        image: container.image,
        status: container.status,
        labels: container.labels || {},
        ports: container.ports || "",
      }));
    } catch (error) {
      if (debug) {
        console.log("Failed to parse test containers:", error);
      }
    }
  }

  try {
    const result = await executeDockerCommand(
      'docker ps -a --filter label=aisanity.workspace --format "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.Labels}}"',
      { silent: true, debug },
    );

    if (result.success) {
      return parseDockerOutput(result.stdout);
    }
    return [];
  } catch (error: unknown) {
    if (debug) {
      console.warn("Label-based discovery failed:", error instanceof Error ? error.message : "Unknown error");
    }
    return [];
  }
}

/**
 * Discover containers by devcontainer metadata
 */
export async function discoverByDevcontainerMetadata(debug: boolean = false): Promise<DockerContainer[]> {
  // Test environment: use mock containers if provided (but only those with devcontainer labels)
  if (process.env.AISANITY_TEST_CONTAINERS) {
    try {
      const mockContainers = JSON.parse(process.env.AISANITY_TEST_CONTAINERS);
      const devcontainerContainers = mockContainers.filter(
        (container: any) => container.labels && container.labels["devcontainer.local_folder"],
      );
      return devcontainerContainers.map((container: any) => ({
        id: container.id,
        name: container.name,
        image: container.image,
        status: container.status,
        labels: container.labels || {},
        ports: container.ports || "",
      }));
    } catch (error) {
      if (debug) {
        console.log("Failed to parse test containers:", error);
      }
    }
  }

  try {
    const result = await executeDockerCommand(
      'docker ps -a --filter label=devcontainer.local_folder --format "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.Labels}}"',
      { silent: true, debug },
    );

    if (result.success) {
      return parseDockerOutput(result.stdout);
    }
    return [];
  } catch (error: unknown) {
    if (debug) {
      console.warn("Devcontainer metadata discovery failed:", error instanceof Error ? error.message : "Unknown error");
    }
    return [];
  }
}

/**
 * Parse docker ps output into DockerContainer objects
 */
export function parseDockerOutput(output: string): DockerContainer[] {
  const lines = output
    .trim()
    .split("\n")
    .filter((line) => line.trim() !== "");
  const containers: DockerContainer[] = [];

  for (const line of lines) {
    const parts = line.split("\t");
    if (parts.length >= 6) {
      const [id, name, image, status, ports, labelsStr] = parts;
      const labels: Record<string, string> = {};

      if (labelsStr && labelsStr.trim() !== "") {
        labelsStr.split(",").forEach((label) => {
          const parts = label.split("=");
          const key = parts[0];
          const value = parts.slice(1).join("=");
          if (key) {
            labels[key] = value || "";
          }
        });
      }

      containers.push({
        id,
        name,
        image,
        status,
        labels,
        ports: ports || "",
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
      console.warn(`Failed to stop container ${id}:`, error instanceof Error ? error.message : "Unknown error");
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
      console.warn(`Failed to remove container ${id}:`, error instanceof Error ? error.message : "Unknown error");
    }
  }
}

/**
 * Validate container labels
 */
export function validateContainerLabels(labels: ContainerLabels | Record<string, string> | undefined): boolean {
  if (!labels) return false;

  const requiredLabels: (keyof ContainerLabels)[] = ["aisanity.workspace", "aisanity.branch", "aisanity.container"];

  return requiredLabels.every((label) => labels[label] !== undefined);
}

/**
 * Generate container labels for a workspace
 */
export async function generateContainerLabels(
  _workspaceName: string,
  branch: string,
  containerName: string,
  workspacePath: string,
): Promise<ContainerLabels> {
  // Get version from version utility
  const version = await getVersionAsync();

  return {
    "aisanity.workspace": workspacePath,
    "aisanity.branch": branch,
    "aisanity.container": containerName,
    "aisanity.created": new Date().toISOString(),
    "aisanity.version": version,
  };
}

/**
 * Check if container is orphaned
 */
export function isContainerOrphaned(container: DockerContainer, existingWorktrees: string[]): boolean {
  const workspacePath = container.labels["aisanity.workspace"];
  if (!workspacePath) {
    return false; // Can't determine if unlabeled containers are orphaned
  }
  return !existingWorktrees.includes(workspacePath);
}
