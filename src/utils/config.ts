import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as YAML from 'yaml';
import { isWorktree as isWorktreeUtil, getWorktreeName as getWorktreeNameUtil } from './worktree-utils';

export interface AisanityConfig {
  workspace: string;
  containerName?: string;
  env?: Record<string, string>;
  envWhitelist?: string[];
  worktree?: boolean;
}

export function getWorkspaceName(cwd: string): string {
  // First check if .aisanity config exists and has a workspace defined
  const existingConfig = loadAisanityConfig(cwd);
  if (existingConfig && existingConfig.workspace) {
    // Modern workspace format is branch-agnostic
    return existingConfig.workspace;
  }

  // Otherwise, generate default workspace name from folder (branch-agnostic)
  const folderName = path.basename(cwd);

  // Sanitize name: replace non-alphanumeric characters with underscores
  const sanitizedFolder = folderName.replace(/[^a-zA-Z0-9]/g, '_');

  return sanitizedFolder;
}

export function getCurrentBranch(cwd: string): string {
  try {
    const gitBranch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd,
      encoding: 'utf8'
    }).trim();
    return gitBranch || 'main';
  } catch (error) {
    // Git not available or not a git repo, use 'main' as default
    return 'main';
  }
}

/**
 * Sanitize branch name for Docker compatibility
 * Replaces special characters with hyphens and converts to lowercase
 */
export function sanitizeBranchName(branchName: string): string {
  return branchName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-') // Replace non-alphanumeric characters with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Validate container name length for Docker compatibility
 * Docker container names must be 128 characters or less
 */
export function validateContainerNameLength(containerName: string): string {
  const maxLength = 128;
  if (containerName.length <= maxLength) {
    return containerName;
  }
  
  // Truncate and ensure it still ends cleanly
  const truncated = containerName.substring(0, maxLength);
  // Remove any trailing hyphen that might have been created by truncation
  return truncated.replace(/-$/, '');
}

/**
 * Get dynamic container name based on workspace and current branch
 * If containerName is explicitly set in config, use that
 * Otherwise, generate as {workspace}-{currentBranch} for main workspace
 * or {workspace}-{worktree-name} for worktrees
 */
export function getContainerName(cwd: string, verbose: boolean = false): string {
  const config = loadAisanityConfig(cwd);
  if (!config) {
    throw new Error('No .aisanity config found');
  }

  // If containerName is explicitly set, use it
  if (config.containerName) {
    return config.containerName;
  }

  // Check if we're in a worktree
  const isWorktreeDir = isWorktree(cwd);
  
  // Otherwise, generate dynamic container name
  const workspaceName = getWorkspaceName(cwd);
  let dynamicContainerName: string;
  
  if (isWorktreeDir) {
    // For worktrees, use worktree name instead of branch
    const worktreeName = getWorktreeName(cwd);
    const sanitizedWorktreeName = sanitizeBranchName(worktreeName);
    dynamicContainerName = `${workspaceName}-${sanitizedWorktreeName}`;
    
    if (verbose) {
      console.error(`Auto-generated container name: ${dynamicContainerName} (workspace: ${workspaceName}, worktree: ${worktreeName})`);
    }
  } else {
    // For main workspace, use branch name
    const currentBranch = getCurrentBranch(cwd);
    const sanitizedBranch = sanitizeBranchName(currentBranch);
    dynamicContainerName = `${workspaceName}-${sanitizedBranch}`;
    
    if (verbose) {
      console.error(`Auto-generated container name: ${dynamicContainerName} (workspace: ${workspaceName}, branch: ${currentBranch})`);
    }
  }

  // Validate container name length
  const validatedContainerName = validateContainerNameLength(dynamicContainerName);

  return validatedContainerName;
}

export function createAisanityConfig(workspaceName: string): string {
  const config: AisanityConfig = {
    workspace: workspaceName,
    // Don't set containerName by default - let it be dynamically generated
    env: {},
    worktree: false,
  };

  return YAML.stringify(config);
}



export function loadAisanityConfig(cwd: string): AisanityConfig | null {
  const configPath = path.join(cwd, '.aisanity');

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    let configContent: string;
    
    // Check if .aisanity is a directory (new format) or file (old format)
    if (fs.statSync(configPath).isDirectory()) {
      const configFile = path.join(configPath, 'config.json');
      if (!fs.existsSync(configFile)) {
        return null;
      }
      configContent = fs.readFileSync(configFile, 'utf8');
      // Parse as JSON for new format
      return JSON.parse(configContent) as AisanityConfig;
    } else {
      // Old format - .aisanity is a file
      configContent = fs.readFileSync(configPath, 'utf8');
      return YAML.parse(configContent) as AisanityConfig;
    }
  } catch (error) {
    console.error('Failed to parse .aisanity config:', error);
    return null;
  }
}



export async function setupOpencodeConfig(cwd: string): Promise<void> {
  const oldConfigPath = path.join(cwd, '.opencode', 'opencode.jsonc');
  const newConfigPath = path.join(cwd, 'opencode.jsonc');

  // Check if old config exists
  if (fs.existsSync(oldConfigPath)) {
    // Move old config to new location
    fs.renameSync(oldConfigPath, newConfigPath);
    // Remove .opencode directory
    fs.rmSync(path.join(cwd, '.opencode'), { recursive: true, force: true });
    console.log(`Migrated opencode config to ${newConfigPath}`);
  } else if (!fs.existsSync(newConfigPath)) {
    // Create a basic config if it doesn't exist
    const config = {};
    fs.writeFileSync(newConfigPath, JSON.stringify(config, null, 2), 'utf8');
    console.log(`Created opencode config at ${newConfigPath}`);
  } else {
    console.log(`Opencode config already exists at ${newConfigPath}`);
  }
}

export function getOpencodeConfigPath(cwd: string): string {
  return path.join(cwd, 'opencode.jsonc');
}

export type ProjectType = 'python' | 'nodejs' | 'go' | 'rust' | 'java' | 'bun' | 'unknown';

/**
 * Generates the expected container name based on the project directory and current branch.
 * Format: {projectName}-{currentBranch}
 */
export function generateExpectedContainerName(cwd: string): string {
  const projectName = path.basename(cwd);
  const currentBranch = getCurrentBranch(cwd);
  const sanitizedBranch = sanitizeBranchName(currentBranch);
  return `${projectName}-${sanitizedBranch}`;
}

export function detectProjectType(cwd: string): ProjectType {
  // Check for Python indicators
  if (fs.existsSync(path.join(cwd, 'requirements.txt')) ||
      fs.existsSync(path.join(cwd, 'setup.py')) ||
      fs.existsSync(path.join(cwd, 'pyproject.toml')) ||
      fs.existsSync(path.join(cwd, 'Pipfile'))) {
    return 'python';
  }

  // Check for Bun indicators (BEFORE Node.js to prevent misclassification)
  if (fs.existsSync(path.join(cwd, 'bun.lockb')) ||
      fs.existsSync(path.join(cwd, 'bun.lock'))) {
    return 'bun';
  }

  // Check for Node.js indicators
  if (fs.existsSync(path.join(cwd, 'package.json'))) {
    return 'nodejs';
  }

  // Check for Go indicators
  if (fs.existsSync(path.join(cwd, 'go.mod'))) {
    return 'go';
  }

  // Check for Rust indicators
  if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) {
    return 'rust';
  }

  // Check for Java indicators
  if (fs.existsSync(path.join(cwd, 'pom.xml')) ||
      fs.existsSync(path.join(cwd, 'build.gradle'))) {
    return 'java';
  }

  return 'unknown';
}

/**
 * Check if current directory is a worktree
 */
export function isWorktree(cwd: string): boolean {
  return isWorktreeUtil(cwd);
}

/**
 * Get worktree name from path
 */
export function getWorktreeName(cwd: string): string {
  return getWorktreeNameUtil(cwd);
}

/**
 * Check if worktree functionality is enabled in config
 * If worktree is explicitly set to false, display message and exit
 */
export function checkWorktreeEnabled(cwd: string): boolean {
  const config = loadAisanityConfig(cwd);
  
  // If config doesn't exist or worktree is not set, default to enabled (true)
  if (!config || config.worktree === undefined) {
    return true;
  }
  
  // If worktree is explicitly set to false, show message and exit
  if (config.worktree === false) {
    console.log("Worktree functionality is disabled. To enable worktree functionality, set 'worktree: true' in your .aisanity config, and make sure you understand the recommended workspace layout first.");
    process.exit(0);
  }
  
  // Otherwise, worktree is enabled
  return true;
}
