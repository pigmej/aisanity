# Aisanity

A devcontainer wrapper for sandboxed development environments.

## Installation

```bash
npm install -g .
```

## Usage

### Initialize Workspace

First, initialize your workspace:

```bash
aisanity init
```

This creates:
- `.aisanity` configuration file with workspace settings
- Workspace-specific configuration files

### Run Commands in Container

Run any command inside the devcontainer:

```bash
# Run a shell
aisanity run

# Run specific commands
aisanity run echo "Hello from container!"
aisanity run npm install
```

### Check Status

View the status of containers for your workspace:

```bash
aisanity status
```

### Stop Containers

Stop all containers related to your workspace:

```bash
aisanity stop
```

## Configuration

The `.aisanity` file contains workspace configuration:

```yaml
workspace: project_main
containerName: aisanity-project_main
env: {}
```

## Requirements

- Docker
- Devcontainers CLI (`npm install -g @devcontainers/cli`)
- Node.js (for the CLI tool itself)

## Devcontainer Integration

Aisanity uses devcontainers for seamless IDE integration. Make sure you have a `.devcontainer/devcontainer.json` file in your workspace:

```json
{
  "name": "Development Environment",
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
  "features": {
    "ghcr.io/devcontainers/features/node:1": {
      "version": "lts"
    }
  }
}
```

## Architecture

- **Workspace Naming**: `{folder_name}_{branch_name}` (sanitized)
- **Mounting**: Current directory → `/workspace` in container
- **Configuration**: Local tool configurations mounted to containers
- **Container Management**: Uses devcontainers CLI for lifecycle management