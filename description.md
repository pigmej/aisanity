# Aisanity - Devcontainer Wrapper

Aisanity is a wrapper around containers (preferably devcontainers) that provides sandboxed development environments. It manages workspace configurations and container lifecycle for consistent development setups.

## Core Features

1. **Workspace Management**: Automatic workspace naming and configuration
2. **Container Lifecycle**: Easy container creation, management, and cleanup
3. **Configuration Persistence**: Local configuration files per workspace
4. **Devcontainer Integration**: Seamless IDE integration with devcontainers
5. **Tool Support**: Pre-configured environments for various development tools

## Architecture

- **Workspace Naming**: `{folder_name}_{branch_name}` (sanitized)
- **Configuration**: Local `.aisanity` YAML file with workspace settings
- **Mounting**: Current directory mounted as `/workspace` in container
- **Tool Configs**: Local tool configurations mounted to containers
- **Container Management**: Uses devcontainers CLI for lifecycle management

## Usage

### Basic Commands

- `aisanity init`: Initialize workspace configuration
- `aisanity run [command]`: Run commands in container (interactive shell if no command)
- `aisanity status`: Display workspace container status
- `aisanity stop`: Stop all workspace containers

### Configuration

The `.aisanity` file contains workspace configuration:

```yaml
workspace: project_main
containerName: aisanity-project_main
```

## Requirements

- Docker
- Devcontainers CLI (`npm install -g @devcontainers/cli`)
- Node.js (for the CLI tool)
