import { ProjectType } from './config';

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
    default:
      return null;
  }
}

function getPythonDevContainer(): DevContainerTemplate {
  const devcontainerJson = `{
  "name": "Python Development",
  "image": "mcr.microsoft.com/devcontainers/python:3.11",
  "features": {
    "ghcr.io/devcontainers/features/node:1": {
      "version": "lts"
    }
  },
  "customizations": {
    "vscode": {
      "extensions": [
        "ms-python.python",
        "ms-python.pylint",
        "ms-python.black-formatter",
        "ms-vscode.vscode-json",
        "ms-vscode.vscode-typescript-next"
      ]
    }
  },
  "forwardPorts": [5000, 8000],
  "mounts": [
    "source=\${localWorkspaceFolder}/../..,target=/workspaces,type=bind,consistency=cached"
  ],
  "postCreateCommand": "curl -LsSf https://astral.sh/uv/install.sh | sh && uv sync && npm install -g opencode-ai",
  "remoteUser": "vscode"
}`;

  return { devcontainerJson };
}

function getNodeJsDevContainer(): DevContainerTemplate {
  const devcontainerJson = `{
  "name": "Node.js Development",
  "image": "mcr.microsoft.com/devcontainers/javascript-node:18",
  "features": {
    "ghcr.io/devcontainers/features/node:1": {
      "version": "lts"
    }
  },
  "customizations": {
    "vscode": {
      "extensions": [
        "ms-vscode.vscode-typescript-next",
        "ms-vscode.vscode-json",
        "bradlc.vscode-tailwindcss",
        "esbenp.prettier-vscode"
      ]
    }
  },
  "forwardPorts": [3000, 3001],
  "mounts": [
    "source=\${localWorkspaceFolder}/../..,target=/workspaces,type=bind,consistency=cached"
  ],
  "postCreateCommand": "npm install && npm install -g opencode-ai",
  "remoteUser": "node"
}`;

  return { devcontainerJson };
}

function getGoDevContainer(): DevContainerTemplate {
  const devcontainerJson = `{
  "name": "Go Development Environment",
  "image": "mcr.microsoft.com/devcontainers/go:1.21",
  "features": {
    "ghcr.io/devcontainers/features/go:1": {
      "version": "1.21"
    }
  },
  "customizations": {
    "vscode": {
      "extensions": [
        "golang.Go",
        "ms-vscode.vscode-json",
        "ms-vscode.vscode-yaml"
      ]
    }
  },
  "forwardPorts": [8080],
  "mounts": [
    "source=\${localWorkspaceFolder}/../..,target=/workspaces,type=bind,consistency=cached"
  ],
  "postCreateCommand": "go mod tidy && npm install -g opencode-ai",
  "remoteUser": "vscode"
}`;

  return { devcontainerJson };
}

function getRustDevContainer(): DevContainerTemplate {
  const devcontainerJson = `{
  "name": "Rust Development Environment",
  "image": "mcr.microsoft.com/devcontainers/rust:1",
  "features": {
    "ghcr.io/devcontainers/features/node:1": {
      "version": "lts"
    }
  },
  "customizations": {
    "vscode": {
      "extensions": [
        "rust-lang.rust-analyzer",
        "ms-vscode.vscode-json",
        "ms-vscode.vscode-yaml"
      ]
    }
  },
  "forwardPorts": [8080],
  "mounts": [
    "source=\${localWorkspaceFolder}/../..,target=/workspaces,type=bind,consistency=cached"
  ],
  "postCreateCommand": "cargo build && npm install -g opencode-ai",
  "remoteUser": "vscode"
}`;

  return { devcontainerJson };
}

function getJavaDevContainer(): DevContainerTemplate {
  const devcontainerJson = `{
  "name": "Java Development Environment",
  "image": "mcr.microsoft.com/devcontainers/java:17",
  "features": {
    "ghcr.io/devcontainers/features/java:1": {
      "version": "17"
    },
    "ghcr.io/devcontainers/features/node:1": {
      "version": "lts"
    }
  },
  "customizations": {
    "vscode": {
      "extensions": [
        "vscjava.vscode-java-pack",
        "ms-vscode.vscode-json",
        "ms-vscode.vscode-yaml"
      ]
    }
  },
  "forwardPorts": [8080],
  "mounts": [
    "source=\${localWorkspaceFolder}/../..,target=/workspaces,type=bind,consistency=cached"
  ],
  "postCreateCommand": "npm install -g opencode-ai",
  "remoteUser": "vscode"
}`;

  return { devcontainerJson };
}