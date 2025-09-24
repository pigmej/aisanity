# Aisanity

A devcontainer wrapper for sandboxed development environments with git worktree support for parallel development.

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

### Git Worktree Commands

Aisanity provides comprehensive git worktree support for parallel development workflows.

#### Create a New Worktree

Create a new worktree with automatic container setup:

```bash
# Create a new worktree for a feature branch
aisanity worktree create feature-auth

# Create a worktree without switching to it
aisanity worktree create feature-ui --no-switch

# Enable verbose logging
aisanity worktree create feature-bugfix --verbose
```

This will:
- Create a git worktree in `worktrees/<branch-name>/`
- Copy `.aisanity` configuration from main workspace
- Automatically provision a development container
- Switch to the new worktree (by default)

#### List All Worktrees

View all worktrees and their container status:

```bash
aisanity worktree list
```

Example output:
```
Worktrees for this repository:

→ Main Workspace (active)
   Path: /path/to/project
   Branch: main
   Container: project-main
   Status: Running (Up 2 hours)
   Config: /path/to/project/.aisanity

Additional Worktrees:

  feature-auth
   Path: /path/to/project/worktrees/feature-auth
   Branch: feature-auth
   Container: project-feature-auth
   Status: Running (Up 1 hour)
   Config: /path/to/project/worktrees/feature-auth/.aisanity

  feature-ui
   Path: /path/to/project/worktrees/feature-ui
   Branch: feature-ui
   Container: project-feature-ui
   Status: Stopped (Exited 2 days ago)
   Config: /path/to/project/worktrees/feature-ui/.aisanity

Current worktree: feature-auth
```

#### Switch to a Worktree

Switch to a different worktree:

```bash
aisanity worktree switch feature-ui
```

#### Remove a Worktree

Remove a worktree and clean up associated containers:

```bash
aisanity worktree remove feature-auth
```

This will:
- Stop and remove the worktree's container
- Delete the worktree directory
- Clean up git worktree references

### Run Commands in Container

Run any command inside the devcontainer:

```bash
# Run a shell in current workspace/worktree
aisanity run

# Run in a specific worktree
aisanity run --worktree feature-auth

# Run specific commands
aisanity run echo "Hello from container!"
aisanity run npm install
```

### Check Status

View the status of containers for your workspace:

```bash
# Status of current workspace/worktree
aisanity status

# Status of specific worktree
aisanity status --worktree feature-auth
```

### Stop Containers

Stop all containers related to your workspace:

```bash
# Stop current workspace/worktree containers
aisanity stop

# Stop all worktree containers
aisanity stop --all-worktrees

# Stop specific worktree containers
aisanity stop --worktree feature-auth
```

## Worktree Workflows

### Parallel Development Example

```bash
# Start in main workspace
cd /path/to/project

# Create worktree for authentication feature
aisanity worktree create feature-auth

# Create worktree for UI improvements  
aisanity worktree create feature-ui

# List all worktrees to see status
aisanity worktree list

# Switch to authentication worktree
aisanity worktree switch feature-auth

# Work on authentication feature
aisanity run
# Inside container: work on auth code...

# Switch to UI worktree
aisanity worktree switch feature-ui

# Work on UI improvements
aisanity run
# Inside container: work on UI code...

# Both worktrees have isolated containers and can be developed in parallel
```

### Hotfix Workflow

```bash
# Working on a feature in a worktree
aisanity worktree create feature-new-api

# Urgent hotfix needed - create hotfix worktree
aisanity worktree create hotfix-security-patch

# Switch to hotfix
aisanity worktree switch hotfix-security-patch

# Fix the issue
aisanity run
# Inside container: implement security fix...

# Test and deploy hotfix
git commit -m "Fix security vulnerability"
git push origin hotfix-security-patch

# Switch back to feature work
aisanity worktree switch feature-new-api
```

### Code Review Workflow

```bash
# Create worktree for reviewer
aisanity worktree create review-pr-123

# Switch to review worktree
aisanity worktree switch review-pr-123

# Pull the PR branch
git fetch origin pull/123/head:pr-123
git checkout pr-123

# Review the code in isolated environment
aisanity run
# Inside container: review and test the PR...

# Remove review worktree when done
aisanity worktree remove review-pr-123
```

## Migration Notes for Existing Users

### Upgrading from Non-Worktree Workflows

If you're an existing Aisanity user, your workflows remain unchanged. The worktree integration is completely backward compatible:

1. **Your current workspace continues to work exactly as before**
2. **Container naming preserves original behavior for main workspace**
3. **All existing commands (`run`, `stop`, `status`) work without modification**

### Migrating to Worktree Workflows

To start using worktree features:

```bash
# Your existing setup continues to work
aisanity run  # Still works in main workspace

# When ready for parallel development:
aisanity worktree create feature-branch

# Worktrees automatically inherit your .aisanity configuration
# Each worktree gets its own isolated container
```

### Directory Structure Changes

When you start using worktrees, your project structure will look like:

```
project/
├── .aisanity                    # Main workspace config
├── .devcontainer/
│   └── devcontainer.json
├── aisanity/                    # Main workspace .git directory
│   └── .git/
├── worktrees/                   # Worktree directory
│   ├── feature-auth/
│   │   ├── .aisanity          # Worktree-specific config
│   │   └── aisanity/          # Linked to main .git
│   └── feature-ui/
│       ├── .aisanity          # Worktree-specific config
│       └── aisanity/          # Linked to main .git
└── your-source-code/
```

## Configuration

The `.aisanity` file contains workspace configuration:

```yaml
workspace: project_main
containerName: aisanity-project_main
```

### Worktree-Specific Configuration

Each worktree gets its own `.aisanity` file copied from the main workspace. You can customize worktree-specific settings:

```yaml
# In worktrees/feature-auth/.aisanity
workspace: project_main
env:
  FEATURE_AUTH_ENABLED: "true"
  DATABASE_URL: "postgresql://localhost:5432/auth_db"
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