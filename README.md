<div align="center">
  <img src="logo.png" alt="Aisanity Logo" width="256">
</div>

Aisanity is a secure, hassle-free tool for running AI agents in isolated environments, protecting your host OS from risks while enabling seamless development workflows. It provides sandboxed containers with automatic AI integration, git worktree support for parallel development, and compatibility with any IDE or terminal tool.

## Tool Compatibility

Aisanity works with all development tools and IDEs. While opencode is the primary tool of interest and automatically integrated into all development environments, you can use any development tool you prefer:

- **VSCode** - Full devcontainer support with automatic configuration
- **IntelliJ IDEA** - Compatible with devcontainer environments
- **Vim/Neovim** - Works seamlessly with containerized development
- **Emacs** - Full integration with devcontainer workflows via TRAMP (just use /docker)
- **Any terminal-based tool** - Access containers via `aisanity run`

All devcontainer templates include automatic opencode installation and configuration, but you're not required to use it.

## Installation

### Prerequisites

**Bun Runtime Required**: Aisanity requires Bun (>=1.0.0) runtime. Installation is quick and simple:

```bash
# Install Bun runtime (takes <30 seconds)
curl -fsSL https://bun.sh/install | bash

# Verify installation
bun --version
```

### Option 1: Install with Bun (Recommended)

```bash
# Install Aisanity globally
bun install -g aisanity
```

### Option 2: Standalone Executable

Download the platform-specific executable from the [GitHub Releases](https://github.com/pigmej/aisanity/releases) page:

#### macOS (Intel)
```bash
# Download and verify
curl -L -o aisanity-darwin-x64 https://github.com/pigmej/aisanity/releases/latest/download/aisanity-darwin-x64
curl -L -o aisanity-darwin-x64.sha256 https://github.com/pigmej/aisanity/releases/latest/download/aisanity-darwin-x64.sha256

# Verify checksum
sha256sum -c aisanity-darwin-x64.sha256

# Make executable and run
chmod +x aisanity-darwin-x64
./aisanity-darwin-x64 --help
```

#### macOS (Apple Silicon)
```bash
# Download and verify
curl -L -o aisanity-darwin-arm64 https://github.com/pigmej/aisanity/releases/latest/download/aisanity-darwin-arm64
curl -L -o aisanity-darwin-arm64.sha256 https://github.com/pigmej/aisanity/releases/latest/download/aisanity-darwin-arm64.sha256

# Verify checksum
sha256sum -c aisanity-darwin-arm64.sha256

# Make executable and run
chmod +x aisanity-darwin-arm64
./aisanity-darwin-arm64 --help
```

#### Linux (x64)
```bash
# Download and verify
curl -L -o aisanity-linux-x64 https://github.com/pigmej/aisanity/releases/latest/download/aisanity-linux-x64
curl -L -o aisanity-linux-x64.sha256 https://github.com/pigmej/aisanity/releases/latest/download/aisanity-linux-x64.sha256

# Verify checksum
sha256sum -c aisanity-linux-x64.sha256

# Make executable and run
chmod +x aisanity-linux-x64
./aisanity-linux-x64 --help
```

#### Linux (ARM64)
```bash
# Download and verify
curl -L -o aisanity-linux-arm64 https://github.com/pigmej/aisanity/releases/latest/download/aisanity-linux-arm64
curl -L -o aisanity-linux-arm64.sha256 https://github.com/pigmej/aisanity/releases/latest/download/aisanity-linux-arm64.sha256

# Verify checksum
sha256sum -c aisanity-linux-arm64.sha256

# Make executable and run
chmod +x aisanity-linux-arm64
./aisanity-linux-arm64 --help
```

#### Checksum Verification

All releases include SHA256 checksum files for security verification. Always verify the checksum before running the binary:

```bash
# The checksum file contains the expected hash
cat aisanity-linux-x64.sha256
# Output: a1b2c3d4e5f6...  aisanity-linux-x64

# Verify the downloaded file matches the checksum
sha256sum -c aisanity-linux-x64.sha256
# Output: aisanity-linux-x64: OK
```

**Note**: Standalone executables bundle the Bun runtime, so no separate Bun installation is needed.

### Why Bun?

Aisanity requires Bun for optimal performance and modern development experience:
- **4x faster** startup times (~70ms vs ~300ms)
- **100x faster** test execution (~50ms vs ~5s)
- **Native TypeScript** execution without compilation
- **Modern APIs** for shell commands and process spawning
- **25-40% less** memory usage

### Development Setup

For developers contributing to Aisanity:
```bash
# Clone repository
git clone <repository-url>
cd aisanity

# Install dependencies with Bun (recommended)
bun install

# Run development
bun run dev

# Run tests
bun test

# Build for distribution
bun run build
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

Worktree support is *disabled* by default, to enable you need to modify the .aisanity setting. Set `worktree: true` and you're good to go.

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
- Copy `.devcontainer` configuration from main workspace (even if not in .git)
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

#### Check a Worktree

Check worktree status and display information:

```bash
aisanity worktree check feature-ui
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

# Check authentication worktree status
aisanity worktree check feature-auth

# Work on authentication feature
aisanity run
# Inside container: work on auth code...

# Check UI worktree status
aisanity worktree check feature-ui

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

# Check hotfix worktree status
aisanity worktree check hotfix-security-patch

# Fix the issue
aisanity run
# Inside container: implement security fix...

# Test and deploy hotfix
git commit -m "Fix security vulnerability"
git push origin hotfix-security-patch

# Check feature worktree status
aisanity worktree check feature-new-api
```

### Code Review Workflow

```bash
# Create worktree for reviewer
aisanity worktree create review-pr-123

# Check review worktree status
aisanity worktree check review-pr-123

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

### Recommended Directory Structure Changes

When you start using worktrees, your project structure will look like:

```
a_project/
├── a_project/                 # Main workspace .git directory
│   ├── .git/
│   ├── .aisanity              # Main workspace config
│   └── .devcontainer/         # Main workspace devcontainer
│       └── devcontainer.json
├── worktrees/                 # Worktree directory
│   ├── feature-auth/
│   │   ├── .aisanity          # Worktree-specific config
│   │   ├── .devcontainer/     # Worktree-specific devcontainer
│   │   │   └── devcontainer.json
│   │   └── a_project/         # Linked to main .git
│   └── feature-ui/
│       ├── .aisanity          # Worktree-specific config
│       ├── .devcontainer/     # Worktree-specific devcontainer
│       │   └── devcontainer.json
│       └── a_project/         # Linked to main .git
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

## Environment Variables

Aisanity supports secure environment variable pass-through from host to container using a whitelist-based approach with wildcard pattern matching.

### Configuration

Add an `envWhitelist` section to your `.aisanity` file to specify which host environment variables can pass through:

```yaml
workspace: my-project
envWhitelist:
  - "HTTP_*"
  - "NODE_ENV"
  - "OPENCODE_*"
  - "DATABASE_*"
```

#### Whitelist Pattern Syntax

- `*` matches any sequence of characters (e.g., `HTTP_*` matches `HTTP_PROXY`, `HTTP_PORT`)
- `?` matches any single character (e.g., `API_KEY?` matches `API_KEY1`, `API_KEY2`)
- Use specific variable names for exact matches (e.g., `NODE_ENV`)
- Patterns are case-sensitive

#### Static Environment Variables

You can also define static environment variables that always pass through:

```yaml
workspace: my-project
env:
  NODE_ENV: development
  DEBUG: "aisanity:*"
envWhitelist:
  - "HTTP_*"
  - "DATABASE_*"
```

### CLI Usage

#### Set Environment Variables via CLI

Override or add environment variables using the `--env` option:

```bash
# Set specific environment variables
aisanity run --env API_KEY=secret --env DEBUG=true bash

# Multiple environment variables
aisanity run --env HTTP_PROXY=proxy.com --env HTTPS_PROXY=proxy.com npm start

# Environment variables with complex values
aisanity run --env DATABASE_URL="postgresql://user:pass@localhost:5432/db" node app.js
```

#### Host Environment Variables

Set environment variables in your shell and they'll pass through if whitelisted:

```bash
# Set in shell
export HTTP_PROXY=http://proxy.company.com
export NODE_ENV=production

# Run with whitelist matching
aisanity run npm start
```

#### Dry-run Preview

Use `--dry-run` to preview which environment variables would be passed without executing:

```bash
# Preview environment variables
aisanity run --dry-run --env EXTRA_VAR=value command

# Output shows:
# Environment variables that would be passed to container:
#   HTTP_PROXY=http://proxy.company.com
#   NODE_ENV=production
#   EXTRA_VAR=value
```

### Security Considerations

#### Whitelist-Only Approach
- Only variables explicitly allowed in `envWhitelist` pass through from host environment
- CLI `--env` variables bypass whitelist (explicit user intent)
- Static `env` variables always pass through (explicitly configured)

#### Blocked System Variables
For security, these system variables are always blocked:
- `PATH`, `HOME`, `USER`, `SHELL`, `TERM`, `LANG`, `LC_*`
- `SSH_AUTH_SOCK`, `SSH_AGENT_PID`, `GPG_AGENT_INFO`

#### Pattern Restrictions
- Overly broad patterns like `*` or `**` are rejected
- Patterns must contain at least 3 characters for specificity
- Only alphanumeric characters, underscores, hyphens, and wildcards allowed

### Precedence Order

Environment variables are merged with the following precedence (highest to lowest):

1. **CLI variables** (`--env` flag) - highest precedence
2. **Host environment variables** (from `process.env`, filtered by whitelist)
3. **Config variables** (static `env` in `.aisanity`) - lowest precedence

### Examples

#### Development Environment
```yaml
# .aisanity
workspace: my-app
env:
  NODE_ENV: development
  DEBUG: "myapp:*"
envWhitelist:
  - "HTTP_*"
  - "API_*"
  - "DATABASE_*"
```

```bash
# Run with additional debug flag
aisanity run --env DEBUG="myapp:*:verbose" npm start
```

#### Production Deployment
```yaml
# .aisanity
workspace: my-app
env:
  NODE_ENV: production
envWhitelist:
  - "DATABASE_*"
  - "REDIS_*"
  - "API_KEY_*"
```

```bash
# Deploy with production secrets
export DATABASE_URL="postgresql://prod:secret@db.prod.com/prod"
export API_KEY_PRODUCTION="sk-1234567890"
aisanity run npm run deploy
```

## Troubleshooting

### Variable Not Passing Through

#### Check envWhitelist Configuration
```bash
# Verify your .aisanity configuration
cat .aisanity

# Test with dry-run to see what would pass
aisanity run --dry-run echo "test"
```

**Common Issues:**
- Missing `envWhitelist` section in `.aisanity` file
- Typos in pattern names (e.g., `HTTP_*` vs `HTTP_*`)
- Patterns are case-sensitive

#### Verify Pattern Matching
```bash
# Test specific patterns with dry-run
export HTTP_PROXY=http://proxy.example.com
export NODE_ENV=production

# With whitelist that should match HTTP_* but not NODE_ENV
aisanity run --dry-run --env TEST_VAR=test env | grep -E "(HTTP_PROXY|NODE_ENV|TEST_VAR)"
```

#### Check for Blocked System Variables
System variables are always blocked for security:
```bash
# These will NEVER pass through, even if whitelisted:
# PATH, HOME, USER, SHELL, TERM, LANG, LC_*
# SSH_AUTH_SOCK, SSH_AGENT_PID, GPG_AGENT_INFO
```

### Pattern Not Matching

#### Case Sensitivity Issues
```yaml
# This will NOT match "http_proxy" (lowercase)
envWhitelist:
  - "HTTP_*"  # Only matches uppercase

# Use both cases if needed:
envWhitelist:
  - "HTTP_*"
  - "http_*"
```

#### Pattern Syntax Verification
```bash
# Valid patterns:
HTTP_*          # Matches HTTP_PROXY, HTTP_PORT
API_KEY?        # Matches API_KEY1, API_KEY2
NODE_ENV        # Matches exactly NODE_ENV

# Invalid patterns (will be rejected):
*               # Too broad
**              # Too broad
A*B*C           # Too many wildcards
```

#### Test Patterns Step by Step
```bash
# Start with a specific variable
export TEST_VAR=hello
aisanity run --dry-run --env TEST_VAR=hello env | grep TEST_VAR

# Then test with pattern
export TEST_PATTERN_VAR=world
aisanity run --dry-run env | grep TEST_PATTERN
```

### Common Error Messages

#### "Invalid environment variable pattern"
**Cause**: Pattern contains invalid characters or is too broad
```yaml
# Invalid examples:
envWhitelist:
  - "*"              # Too broad
  - "A*B*C"          # Too many wildcards
  - "VAR$"           # Invalid character

# Valid examples:
envWhitelist:
  - "HTTP_*"
  - "API_KEY?"
  - "NODE_ENV"
```

#### "Environment variable name must match POSIX standards"
**Cause**: Variable name contains invalid characters
```bash
# Invalid variable names:
--env "123_INVALID=value"    # Starts with number
--env "INVALID-NAME=value"   # Contains hyphen
--env "INVALID.NAME=value"   # Contains period

# Valid variable names:
--env "VALID_NAME=value"
--env "API_KEY_123=value"
--env "_PRIVATE_VAR=value"
```

#### "Pattern too broad"
**Cause**: Pattern would match too many variables
```yaml
# Too broad (rejected):
envWhitelist:
  - "*"
  - "*_*"
  - "A*"

# More specific (accepted):
envWhitelist:
  - "HTTP_*"
  - "API_*"
  - "OPENCODE_*"
```

### Debug Techniques

#### Using --dry-run Effectively
```bash
# Preview all environment variables that would pass
aisanity run --dry-run

# Test with additional CLI variables
aisanity run --dry-run --env DEBUG=true --env VERBOSE=1

# Combine with grep to filter results
aisanity run --dry-run env | grep -E "(HTTP|API|DEBUG)"
```

#### Using --verbose for Detailed Output
```bash
# Get detailed information about pattern matching
aisanity run --verbose --dry-run

# Output shows:
# - Which patterns matched which variables
# - Why certain variables were blocked
# - Precedence resolution details
```

#### Test Configuration Incrementally
```bash
# 1. Start with empty whitelist
echo "envWhitelist: []" >> .aisanity
aisanity run --dry-run

# 2. Add one pattern at a time
echo "envWhitelist: ['HTTP_*']" > .aisanity
aisanity run --dry-run

# 3. Test with multiple patterns
echo "envWhitelist: ['HTTP_*', 'NODE_ENV']" > .aisanity
aisanity run --dry-run
```

#### Verify Configuration Loading
```bash
# Check that your configuration is being read correctly
aisanity run --dry-run 2>&1 | grep -i "whitelist\|pattern"

# Or check the configuration directly
cat .aisanity
```

### FAQ

#### Why isn't my variable passing through?
1. **Check whitelist**: Is the variable name or pattern in `envWhitelist`?
2. **Check case sensitivity**: Patterns are case-sensitive
3. **Check system variables**: Some variables are always blocked
4. **Use --dry-run**: See exactly what would pass through

```bash
# Debug step by step
export MY_VAR=test
aisanity run --dry-run env | grep MY_VAR
```

#### Can I pass all environment variables?
No, for security reasons. Use specific patterns:
```yaml
# Instead of "*"
envWhitelist:
  - "HTTP_*"
  - "API_*"
  - "NODE_ENV"
  - "DATABASE_*"
```

#### Do CLI variables require whitelist?
No, CLI `--env` variables bypass the whitelist:
```bash
# This works even with empty whitelist
aisanity run --env CUSTOM_VAR=value env | grep CUSTOM_VAR
```

#### Why can't I pass PATH or HOME?
These are system variables that are always blocked for security:
```bash
# These will never work, even if whitelisted:
aisanity run --env PATH=/custom/path echo $PATH
aisanity run --env HOME=/custom/home echo $HOME
```

#### How do I debug precedence issues?
Use `--dry-run` to see the final result:
```bash
# Set up conflicting variables
export NODE_ENV=production
aisanity run --dry-run --env NODE_ENV=development env | grep NODE_ENV
# Output will show NODE_ENV=development (CLI takes precedence)
```

#### My pattern matches too many variables. How do I fix it?
Be more specific with your patterns:
```yaml
# Too broad:
envWhitelist:
  - "*_*"

# More specific:
envWhitelist:
  - "API_*"
  - "DATABASE_*"
  - "HTTP_*"
```

#### How do I test if my regex-like patterns work?
Use the `--dry-run` option with test variables:
```bash
# Set up test variables
export API_TEST=123
export API_PROD=456
export OTHER_VAR=789

# Test pattern matching
aisanity run --dry-run env | grep -E "(API_TEST|API_PROD|OTHER_VAR)"
```

#### What if I need to pass a variable with special characters?
CLI variables handle escaping automatically:
```bash
# Variables with special characters in values
aisanity run --env URL="https://example.com?param=value&other=test" env | grep URL

# Variables with spaces (use quotes)
aisanity run --env MESSAGE="Hello world" env | grep MESSAGE
```

## Requirements

- Docker
- Devcontainers CLI (`npm install -g @devcontainers/cli`)
- **Bun >= 1.0.0** (required)


## Opencode integration

By default, Aisanity uses OpenCode as the preferred AI coding agent. It mounts OpenCode-specific paths to share session logs, state, configuration, and other data. Additionally, OpenCode is installed by default in all containers. There's nothing magical about this integration - it's simply automated setup. If you don't want to use OpenCode, you can modify the generated template (which you'll likely need to customize anyway).

## Devcontainer Integration

Aisanity automatically creates devcontainer configurations during `aisanity init` based on your project type. No manual setup is required.

If you have already .devcontainer based setup then most likely you want to add opencode specific paths in the mounts (or other AI coding agent).

### Automatic Project Detection

When you run `aisanity init`, Aisanity detects your project type and generates an appropriate devcontainer configuration:

- **Python projects** - Python 3.13 with uv, ruff, and opencode integration
- **Node.js projects** - Node.js 22 with TypeScript and Tailwind support
- **Bun projects** - Most recent (at the build time) Bun with Bun extensions and tools
- **Go projects** - Go 1.24 with Go extensions and tools
- **Rust projects** - Rust toolchain with rust-analyzer
- **Unknown projects** - Base Ubuntu environment with Node.js



### Cross-Platform Compatibility

Devcontainers provide consistent development environments across all tools and platforms:

- **Tool Agnostic**: Works with any IDE or development tool
- **Environment Consistency**: Same dependencies and configurations everywhere
- **Opencode Integration**: Automatic installation and configuration in all templates
- **Configuration Mounting**: Your local opencode settings are automatically available in containers

All templates include automatic opencode installation and proper directory mounting for seamless integration with your existing opencode configuration.

## Architecture

- **Workspace Naming**: `{folder_name}_{branch_name}` (sanitized)
- **Mounting**: Current directory → `/workspace` in container
- **Configuration**: Local tool configurations mounted to containers
- **Container Management**: Uses devcontainers CLI for lifecycle management




## Release Process

Aisanity uses automated releases triggered by semantic version tags. When a tag matching `v*.*.*` is pushed to the repository:

1. **Automatic Build**: Cross-compilation builds binaries for all supported platforms
2. **Checksum Generation**: SHA256 checksums are generated for each binary
3. **GitHub Release**: A new release is created with all assets and generated notes
4. **Asset Upload**: All binaries and checksum files are uploaded as release assets

### Supported Platforms

- **Linux x64** (`aisanity-linux-x64`)
- **Linux ARM64** (`aisanity-linux-arm64`)
- **macOS Intel** (`aisanity-darwin-x64`)
- **macOS Apple Silicon** (`aisanity-darwin-arm64`)

### Creating a Release

To create a new release:

```bash
# Create and push a semantic version tag
git tag v1.0.0
git push origin v1.0.0

# The GitHub Actions workflow will automatically:
# - Build all platform binaries
# - Generate checksums
# - Create the GitHub release
# - Upload all assets
```

### Development Builds

For development and testing, you can build binaries locally:

```bash
# Build all platforms
bun run build:all

# Build specific platform
bun run build:linux-x64
bun run build:darwin-arm64

# Generate checksums
bun run checksum:generate

# Prepare complete release locally
bun run release:prepare
```

## FAQ

### Container Names

In the .aisanity file, there are two options for naming containers:

1. **Default Naming**: `{workspace}_{branch_name}` (sanitized)
2. **Custom Naming**: You can specify a custom name using the `containerName` property in the .aisanity file.

What's a workspace? It's literally the directory where you run the command. It can also be set to anything you want. Sharing that name with other workspaces will *reuse* the containers BUT also destroy them if you delete the workspace.

Why would you want to set `containerName`? By default, each branch gets a completely isolated environment to fully isolate the environments. Setting the `containerName` to something static will remove that functionality.

### Worktrees

You don't need to use worktrees. Aisanity works perfectly with standard branching workflows, but this approach limits your ability to run multiple development sessions simultaneously.

### Rebuild the Container

To rebuild the container, run the following command:

```bash
aisanity rebuild
```

If you want to rebuild the container from scratch, pass the `--clean` flag to the command:

```bash
aisanity rebuild --clean
```

You might want to rebuild the container if something goes wrong inside the container and you need to start fresh.
