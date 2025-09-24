import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as YAML from 'yaml';

export interface AisanityConfig {
  workspace: string;
  containerName?: string;
  env?: Record<string, string>;
}

export function getWorkspaceName(cwd: string): string {
  // First check if .aisanity config exists and has a workspace defined
  const existingConfig = loadAisanityConfig(cwd);
  if (existingConfig && existingConfig.workspace) {
    // Check if this is a legacy config (workspace includes branch separator)
    if (existingConfig.workspace.includes('_')) {
      // Legacy mode: extract project name from workspace_branch format
      const parts = existingConfig.workspace.split('_');
      if (parts.length > 1) {
        // Return just the project name part (everything before the last underscore)
        return parts.slice(0, -1).join('_');
      }
    }
    // New mode: workspace is already branch-agnostic
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
      encoding: 'utf8',
      stdio: 'pipe'
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
 * Otherwise, generate as {workspace}-{currentBranch}
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

  // Otherwise, generate dynamic container name
  const workspaceName = getWorkspaceName(cwd);
  const currentBranch = getCurrentBranch(cwd);
  const sanitizedBranch = sanitizeBranchName(currentBranch);

  const dynamicContainerName = `${workspaceName}-${sanitizedBranch}`;

  // Validate container name length
  const validatedContainerName = validateContainerNameLength(dynamicContainerName);

  // Log the auto-generation for user awareness (using stderr) only if verbose
  if (verbose) {
    console.error(`Auto-generated container name: ${validatedContainerName} (workspace: ${workspaceName}, branch: ${currentBranch})`);
  }

  return validatedContainerName;
}

export function createAisanityConfig(workspaceName: string): string {
  const config: AisanityConfig = {
    workspace: workspaceName,
    // Don't set containerName by default - let it be dynamically generated
    env: {}
  };

  return YAML.stringify(config);
}



export function loadAisanityConfig(cwd: string): AisanityConfig | null {
  const configPath = path.join(cwd, '.aisanity');

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    return YAML.parse(configContent) as AisanityConfig;
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

export type ProjectType = 'python' | 'nodejs' | 'go' | 'rust' | 'java' | 'unknown';

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
