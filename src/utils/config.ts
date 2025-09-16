import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
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
    return existingConfig.workspace;
  }

  // Otherwise, generate default workspace name from folder + branch
  const folderName = path.basename(cwd);

  // Try to get git branch name
  let branchName = 'main';
  try {
    const gitBranch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd,
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim();
    branchName = gitBranch || 'main';
  } catch (error) {
    // Git not available or not a git repo, use 'main' as default
  }

  // Sanitize names: replace non-alphanumeric characters with underscores
  const sanitizedFolder = folderName.replace(/[^a-zA-Z0-9]/g, '_');
  const sanitizedBranch = branchName.replace(/[^a-zA-Z0-9]/g, '_');

  return `${sanitizedFolder}_${sanitizedBranch}`;
}

export function createAisanityConfig(workspaceName: string): string {
  const config: AisanityConfig = {
    workspace: workspaceName,
    containerName: `aisanity-${workspaceName}`,
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



export async function setupOpencodeConfig(cwd: string, workspaceName: string): Promise<void> {
  const opencodeDir = path.join(cwd, '.opencode');
  const defaultConfigPath = path.join(opencodeDir, 'opencode.jsonc');
  const workspaceConfigPath = path.join(opencodeDir, 'opencode.jsonc');

  // Create .opencode directory if it doesn't exist
  if (!fs.existsSync(opencodeDir)) {
    fs.mkdirSync(opencodeDir, { recursive: true });
  }

  // Check if config exists
  if (!fs.existsSync(workspaceConfigPath)) {
    // Create a basic config if it doesn't exist
    const config = {
      version: '1.0',
      settings: {
        theme: 'dark',
        autoSave: true,
        cwd: cwd
      }
    };
    fs.writeFileSync(workspaceConfigPath, JSON.stringify(config, null, 2), 'utf8');
    console.log(`Created opencode config at ${workspaceConfigPath}`);
  } else {
    console.log(`Opencode config already exists at ${workspaceConfigPath}`);
  }
}

export function getOpencodeConfigPath(cwd: string, workspaceName: string): string {
  return path.join(cwd, '.opencode', 'opencode.jsonc');
}

export type ProjectType = 'python' | 'nodejs' | 'go' | 'rust' | 'java' | 'unknown';

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