import { ProjectType } from './config';
import * as fs from 'fs';
import * as path from 'path';

// Custom error classes for better error handling
export class FileNotFoundError extends Error {
  constructor(filePath: string) {
    super(`File not found: ${filePath}`);
    this.name = 'FileNotFoundError';
  }
}

export class InvalidJsonError extends Error {
  constructor(filePath: string, originalError?: Error) {
    super(`Invalid JSON in file: ${filePath}${originalError ? ` - ${originalError.message}` : ''}`);
    this.name = 'InvalidJsonError';
  }
}

export class PermissionError extends Error {
  constructor(filePath: string, operation: string) {
    super(`Permission denied for ${operation}: ${filePath}`);
    this.name = 'PermissionError';
  }
}

export class DiskSpaceError extends Error {
  constructor(filePath: string) {
    super(`Insufficient disk space for writing: ${filePath}`);
    this.name = 'DiskSpaceError';
  }
}

export interface DevContainerTemplate {
  devcontainerJson: string;
  dockerfile?: string;
}

export function getDevContainerTemplate(projectType: ProjectType): DevContainerTemplate | null {
  switch (projectType) {
    case 'python':
      return getPythonDevContainer();
    case 'nodejs':
      return getNodeJsDevContainer();
    case 'go':
      return getGoDevContainer();
    case 'rust':
      return getRustDevContainer();
    case 'java':
      return getJavaDevContainer();
    case 'unknown':
      return getEmptyDevContainer();
    default:
      return null;
  }
}

function getPythonDevContainer(): DevContainerTemplate {
   const devcontainerJson = JSON.stringify({
     name: "Python Development",
     image: "mcr.microsoft.com/devcontainers/python:3.11",
     features: {
       "ghcr.io/devcontainers/features/node:1": {
         version: "lts"
       },
       "ghcr.io/gvatsal60/dev-container-features/uv:0": {},
       "ghcr.io/jsburckhardt/devcontainer-features/ruff:1": {}
     },
     customizations: {
       vscode: {
         extensions: [
           "ms-python.python",
           "ms-python.pylint",
           "ms-python.black-formatter",
           "ms-vscode.vscode-json",
           "ms-vscode.vscode-typescript-next"
         ]
       }
     },
forwardPorts: [5000, 8000],
       mounts: [
         "source=${localEnv:HOME}/.config/opencode,target=/home/vscode/.config/opencode,type=bind,consistency=cached",
         "source=${localEnv:HOME}/.local/share/opencode,target=/home/vscode/.local/share/opencode,type=bind,consistency=cached",
         "source=${localEnv:HOME}/.local/state/opencode,target=/home/vscode/.local/state/opencode,type=bind,consistency=cached"
       ],
    containerEnv: {
      "TERM": "xterm-256color",
      "COLORTERM": "truecolor"
    },
    postCreateCommand: "npm install -g opencode-ai",
    remoteUser: "vscode"
  }, null, 2);

  return { devcontainerJson };
}

function getNodeJsDevContainer(): DevContainerTemplate {
   const devcontainerJson = JSON.stringify({
     name: "Node.js Development",
     image: "mcr.microsoft.com/devcontainers/javascript-node:18",
     features: {
       "ghcr.io/devcontainers/features/node:1": {
         version: "lts"
       }
     },
     customizations: {
       vscode: {
         extensions: [
           "ms-vscode.vscode-typescript-next",
           "ms-vscode.vscode-json",
           "bradlc.vscode-tailwindcss",
           "esbenp.prettier-vscode"
         ]
       }
     },
forwardPorts: [3000, 3001],
       mounts: [
         "source=${localEnv:HOME}/.config/opencode,target=/home/node/.config/opencode,type=bind,consistency=cached",
         "source=${localEnv:HOME}/.local/share/opencode,target=/home/node/.local/share/opencode,type=bind,consistency=cached",
         "source=${localEnv:HOME}/.local/state/opencode,target=/home/node/.local/state/opencode,type=bind,consistency=cached"
       ],
    containerEnv: {
      "TERM": "xterm-256color",
      "COLORTERM": "truecolor"
    },
    postCreateCommand: "npm install -g opencode-ai",
    remoteUser: "node"  // node container really likes node user
  }, null, 2);

  return { devcontainerJson };
}

function getGoDevContainer(): DevContainerTemplate {
   const devcontainerJson = JSON.stringify({
     name: "Go Development Environment",
     image: "mcr.microsoft.com/devcontainers/go:1.21",
     features: {
       "ghcr.io/devcontainers/features/go:1": {
         version: "1.21"
       }
     },
     customizations: {
       vscode: {
          extensions: [
            "golang.Go",
            "ms-vscode.vscode-json",
            "ms-vscode.vscode-yaml"
          ]
        }
},
       forwardPorts: [8080],
       mounts: [
         "source=${localEnv:HOME}/.config/opencode,target=/home/vscode/.config/opencode,type=bind,consistency=cached",
         "source=${localEnv:HOME}/.local/share/opencode,target=/home/vscode/.local/share/opencode,type=bind,consistency=cached",
         "source=${localEnv:HOME}/.local/state/opencode,target=/home/vscode/.local/state/opencode,type=bind,consistency=cached"
       ],
    containerEnv: {
      "TERM": "xterm-256color",
      "COLORTERM": "truecolor"
    },
    postCreateCommand: "npm install -g opencode-ai",
    remoteUser: "vscode"
  }, null, 2);

  return { devcontainerJson };
}

function getRustDevContainer(): DevContainerTemplate {
   const devcontainerJson = JSON.stringify({
     name: "Rust Development Environment",
     image: "mcr.microsoft.com/devcontainers/rust:1",
     features: {
       "ghcr.io/devcontainers/features/node:1": {
         version: "lts"
       }
     },
     customizations: {
       vscode: {
          extensions: [
"rust-lang.rust-analyzer",
             "ms-vscode.vscode-json",
             "ms-vscode.vscode-yaml"
           ]
         }
       },
       forwardPorts: [8080],
       mounts: [
         "source=${localEnv:HOME}/.config/opencode,target=/home/vscode/.config/opencode,type=bind,consistency=cached",
         "source=${localEnv:HOME}/.local/share/opencode,target=/home/vscode/.local/share/opencode,type=bind,consistency=cached",
         "source=${localEnv:HOME}/.local/state/opencode,target=/home/vscode/.local/state/opencode,type=bind,consistency=cached"
       ],
    containerEnv: {
      "TERM": "xterm-256color",
      "COLORTERM": "truecolor"
    },
    postCreateCommand: "curl -fsSL https://opencode.ai/install | bash",
    remoteUser: "vscode"
  }, null, 2);

  return { devcontainerJson };
}

function getJavaDevContainer(): DevContainerTemplate {
   const devcontainerJson = JSON.stringify({
     name: "Java Development Environment",
     image: "mcr.microsoft.com/devcontainers/java:17",
     features: {
       "ghcr.io/devcontainers/features/java:1": {
         version: "17"
       },
       "ghcr.io/devcontainers/features/node:1": {
         version: "lts"
       }
     },
     customizations: {
       vscode: {
          extensions: [
"vscjava.vscode-java-pack",
             "ms-vscode.vscode-json",
             "ms-vscode.vscode-yaml"
           ]
         }
       },
       forwardPorts: [8080],
       mounts: [
         "source=${localEnv:HOME}/.config/opencode,target=/home/vscode/.config/opencode,type=bind,consistency=cached",
         "source=${localEnv:HOME}/.local/share/opencode,target=/home/vscode/.local/share/opencode,type=bind,consistency=cached",
         "source=${localEnv:HOME}/.local/state/opencode,target=/home/vscode/.local/state/opencode,type=bind,consistency=cached"
       ],
    containerEnv: {
      "TERM": "xterm-256color",
      "COLORTERM": "truecolor"
    },
    postCreateCommand: "curl -fsSL https://opencode.ai/install | bash",
    remoteUser: "vscode"
  }, null, 2);

  return { devcontainerJson };
}

function getEmptyDevContainer(): DevContainerTemplate {
   const devcontainerJson = JSON.stringify({
     name: "Empty Development Environment",
     image: "mcr.microsoft.com/devcontainers/base:ubuntu",
     features: {
       "ghcr.io/devcontainers/features/node:1": {
         version: "lts"
       }
     },
     customizations: {
       vscode: {
         extensions: [
           "ms-vscode.vscode-json",
           "ms-vscode.vscode-yaml"
         ]
       }
     },
forwardPorts: [],
       mounts: [
         "source=${localEnv:HOME}/.config/opencode,target=/home/vscode/.config/opencode,type=bind,consistency=cached",
         "source=${localEnv:HOME}/.local/share/opencode,target=/home/vscode/.local/share/opencode,type=bind,consistency=cached",
         "source=${localEnv:HOME}/.local/state/opencode,target=/home/vscode/.local/state/opencode,type=bind,consistency=cached"
       ],
    containerEnv: {
      "TERM": "xterm-256color",
      "COLORTERM": "truecolor"
    },
    postCreateCommand: "curl -fsSL https://opencode.ai/install | bash",
    remoteUser: "vscode"
  }, null, 2);

  return { devcontainerJson };
}

/**
 * Reads a devcontainer.json file and returns its parsed content.
 */
export function readDevContainerJson(filePath: string): any {
  if (!fs.existsSync(filePath)) {
    throw new FileNotFoundError(filePath);
  }
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (error: any) {
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      throw new PermissionError(filePath, 'reading');
    }
    throw error;
  }
  try {
    return JSON.parse(content);
  } catch (error: any) {
    throw new InvalidJsonError(filePath, error);
  }
}

/**
 * Creates a branch-specific devcontainer.json file by copying from the base file and adding containerName.
 * 
 * NOTE: This function is no longer used by the main aisanity run command, which now uses 
 * --id-label for container identification. Kept for backward compatibility and testing.
 */
export function createBranchSpecificDevContainer(basePath: string, branchPath: string, containerName: string): void {
  // Input validation
  if (typeof containerName !== 'string' || containerName.trim() === '') {
    throw new Error('containerName must be a non-empty string');
  }

  const baseContent = readDevContainerJson(basePath);
  const modifiedContent = {
    ...baseContent,
    containerName
  };
  const jsonString = JSON.stringify(modifiedContent, null, 2);
  
  // Determine target path: use branchPath if provided, otherwise basePath
  const targetPath = branchPath || basePath;
  const dir = path.dirname(targetPath);
  
  try {
    // Create directory if it doesn't exist (for branch-specific files)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(targetPath, jsonString, 'utf8');
  } catch (error: any) {
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      throw new PermissionError(targetPath, 'writing');
    } else if (error.code === 'ENOSPC') {
      throw new DiskSpaceError(targetPath);
    }
    throw error;
  }
}

/**
 * Gets the path to the branch-specific devcontainer file.
 */
export function getBranchSpecificDevContainerPath(cwd: string, branch: string): string {
  const sanitizedBranch = branch.replace(/[^a-zA-Z0-9]/g, '_');
  return path.join(cwd, '.devcontainer', `devcontainer_${sanitizedBranch}.json`);
}

/**
 * Gets the path to the base devcontainer.json file.
 */
export function getBaseDevContainerPath(cwd: string): string {
  return path.join(cwd, '.devcontainer', 'devcontainer.json');
}
