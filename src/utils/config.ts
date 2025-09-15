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

export async function setupDevToolConfig(cwd: string, workspaceName: string): Promise<void> {
  const devToolsDir = path.join(cwd, '.devtools');
  const defaultConfigPath = path.join(devToolsDir, 'default.json');
  const workspaceConfigPath = path.join(devToolsDir, `${workspaceName}.json`);

  // Create .devtools directory if it doesn't exist
  if (!fs.existsSync(devToolsDir)) {
    fs.mkdirSync(devToolsDir, { recursive: true });
  }

  // Check if default config exists
  if (!fs.existsSync(defaultConfigPath)) {
    // Create a basic default config if it doesn't exist
    const defaultConfig = {
      version: '1.0',
      settings: {
        theme: 'dark',
        autoSave: true
      }
    };
    fs.writeFileSync(defaultConfigPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
    console.log(`Created default development tools config at ${defaultConfigPath}`);
  }

  // Copy default config to workspace config if it doesn't exist
  if (!fs.existsSync(workspaceConfigPath)) {
    fs.copyFileSync(defaultConfigPath, workspaceConfigPath);
    console.log(`Created workspace development tools config at ${workspaceConfigPath}`);
  } else {
    console.log(`Workspace development tools config already exists at ${workspaceConfigPath}`);
  }
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

export function getDevToolConfigPath(cwd: string, workspaceName: string): string {
  return path.join(cwd, '.devtools', `${workspaceName}.json`);
}

export async function setupOpencodeConfig(cwd: string, workspaceName: string): Promise<void> {
  const opencodeDir = path.join(cwd, '.opencode');
  const defaultConfigPath = path.join(opencodeDir, 'default.json');
  const workspaceConfigPath = path.join(opencodeDir, `${workspaceName}.json`);

  // Create .opencode directory if it doesn't exist
  if (!fs.existsSync(opencodeDir)) {
    fs.mkdirSync(opencodeDir, { recursive: true });
  }

  // Check if default config exists
  if (!fs.existsSync(defaultConfigPath)) {
    // Create a basic default config if it doesn't exist
    const defaultConfig = {
      version: '1.0',
      settings: {
        theme: 'dark',
        autoSave: true,
        cwd: cwd
      }
    };
    fs.writeFileSync(defaultConfigPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
    console.log(`Created default opencode config at ${defaultConfigPath}`);
  }

  // Copy default config to workspace config if it doesn't exist
  if (!fs.existsSync(workspaceConfigPath)) {
    fs.copyFileSync(defaultConfigPath, workspaceConfigPath);
    console.log(`Created workspace opencode config at ${workspaceConfigPath}`);
  } else {
    console.log(`Workspace opencode config already exists at ${workspaceConfigPath}`);
  }
}

export function getOpencodeConfigPath(cwd: string, workspaceName: string): string {
  return path.join(cwd, '.opencode', `${workspaceName}.json`);
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