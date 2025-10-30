<div align="center">
  <img src="logo.png" alt="Aisanity Logo" width="256">
</div>

# 🧠 Aisanity

**Sandboxed development environments for AI-powered coding**

Run AI agents in isolated containers while keeping your host OS safe. Aisanity creates secure, reproducible development environments with automatic AI integration and seamless git worktree support.

## ✨ Why Aisanity?

- **🛡️ Secure Isolation** - Run AI agents in sandboxed containers, protecting your host system
- **⚡ Instant Setup** - One-command initialization for any project type
- **🔄 Parallel Development** - Work on multiple features simultaneously with git worktrees
- **🤖 AI-Ready** - Pre-configured for OpenCode and other AI coding agents
- **🎯 IDE Agnostic** - Works with VS Code, IntelliJ, Vim, or any terminal tool

I highly recommend to use Aisanity with my [opencode workflow](https://github.com/pigmej/opencode_tools) to fully benefit from Aisanity's features.

## 🚀 Quick Start

### 1. Install Aisanity

**Option A: Download Binary (Recommended)**
```bash
# macOS (Apple Silicon)
curl -L -o aisanity https://github.com/pigmej/aisanity/releases/latest/download/aisanity-darwin-arm64
chmod +x aisanity
sudo mv aisanity /usr/local/bin/

# Linux (x64)
curl -L -o aisanity https://github.com/pigmej/aisanity/releases/latest/download/aisanity-linux-x64
chmod +x aisanity
sudo mv aisanity /usr/local/bin/

# Verify installation
aisanity --version
```

[**All Platforms →**](https://github.com/pigmej/aisanity/releases/latest)

**Option B: Build from Source**
```bash
git clone https://github.com/pigmej/aisanity.git
cd aisanity
curl -fsSL https://bun.sh/install | bash
bun install
bun run build
sudo mv dist/aisanity /usr/local/bin/
```

### 2. Initialize Your Project

```bash
cd your-project
aisanity init
```

### 3. Start Coding

```bash
# Drop into your sandboxed environment
aisanity run

# Or run commands directly
aisanity run npm install
aisanity run npm run dev
```

That's it! Your project is now running in a secure container with AI tools pre-configured.

## 🏗️ What Aisanity Does For You

When you run `aisanity init`, it automatically:

- **Detects your project type** (Node.js, Python, Go, Rust, etc.)
- **Creates the perfect devcontainer** with all the right tools
- **Installs AI coding agents** (OpenCode by default)
- **Sets up git worktree support** for parallel development
- **Configures secure environment variable handling**

## 🌳 Multi-Feature Development

Work on multiple features at the same time without conflicts:

```bash
# Create isolated environments for each feature
aisanity worktree create feature-auth
aisanity worktree create feature-ui

# See all your development environments
aisanity worktree list

# Switch between features seamlessly
cd worktrees/feature-auth
aisanity run  # Work on auth
cd ../feature-ui  
aisanity run  # Work on UI
```

Each feature gets its own container, dependencies, and AI agent session.

## 🛠️ Essential Commands

| Command | What it does |
|---------|--------------|
| `aisanity init` | Sets up your project with AI-ready container |
| `aisanity run` | Drops you into the sandboxed environment |
| `aisanity run <command>` | Runs commands in the container |
| `aisanity status` | Shows running containers and their status |
| `aisanity stop` | Stops all project containers |
| `aisanity rebuild` | Rebuilds containers from scratch |

## 🎯 Supported Project Types

Aisanity automatically detects and configures:

- **🐍 Python** - Flask, Django, FastAPI with uv, ruff, and AI tools
- **🟨 Node.js** - Express, TypeScript with modern tooling
- **⚡ Bun** - Ultra-fast TypeScript with native runtime
- **🐹 Go** - Go 1.24+ with extensions and tools  
- **🦀 Rust** - Rust toolchain with rust-analyzer
- **📦 Any Project** - Base Ubuntu environment with Node.js

## Tool Compatibility

Aisanity works with all development tools and IDEs. While opencode is the primary tool of interest and automatically integrated into all development environments, you can use any development tool you prefer:

- **VSCode** - Full devcontainer support with automatic configuration
- **IntelliJ IDEA** - Compatible with devcontainer environments
- **Vim/Neovim** - Works seamlessly with containerized development
- **Emacs** - Full integration with devcontainer workflows via TRAMP (just use /docker)
- **Any terminal-based tool** - Access containers via `aisanity run`

All devcontainer templates include automatic opencode installation and configuration, but you're not required to use it.

## 🔧 Advanced Features

### Environment Variables
Securely pass secrets and configuration:

```bash
# CLI variables (bypass whitelist)
aisanity run --env API_KEY=secret npm start

# Whitelisted host variables
export DATABASE_URL=postgres://...
aisanity run npm start
```

### AI Agent Integration
While OpenCode is the default, Aisanity works with any AI coding agent. All containers include:
- Automatic AI agent installation
- Shared configuration and session state
- Isolated AI environments per feature branch

### IDE Integration
Works seamlessly with your favorite tools:
- **VS Code** - Full devcontainer support
- **IntelliJ** - Compatible with devcontainer environments  
- **Vim/Neovim** - Terminal-based development
- **Emacs** - TRAMP integration via `/docker`

## 📦 Installation Options

### Download from GitHub Releases (Recommended)

Choose your platform from the [latest release](https://github.com/pigmej/aisanity/releases/latest):

```bash
# Example for macOS Apple Silicon
curl -L -o aisanity https://github.com/pigmej/aisanity/releases/latest/download/aisanity-darwin-arm64
chmod +x aisanity
sudo mv aisanity /usr/local/bin/aisanity
```

### Build from Source

For developers who want to latest features:

```bash
git clone https://github.com/pigmej/aisanity.git
cd aisanity
curl -fsSL https://bun.sh/install | bash
bun install
bun run build
```

## 🤝 Why Choose Aisanity?

**Traditional Development:**
- Risky AI agent execution on host
- Environment conflicts between features
- Manual container setup and maintenance
- No isolation between AI sessions

**With Aisanity:**
- ✅ Secure AI agent sandboxing
- ✅ Isolated environments per feature
- ✅ Zero-configuration container setup
- ✅ AI session isolation and state management

## 📚 Learn More

- [Examples](./examples/) - Ready-to-run sample projects
- [Installation Guide](./INSTALLATION.md) - Detailed setup instructions
- [Development Guide](./DEVELOPMENT.md) - Contributing and advanced setup

## 🐛 Need Help?

- Check out [GitHub Issues](https://github.com/pigmej/aisanity/issues) for common questions
- Open a new issue for bugs or feature requests
- Join our community discussions

---

**Ready to transform your development workflow?** 

```bash
# Download and install (macOS example)
curl -L -o aisanity https://github.com/pigmej/aisanity/releases/latest/download/aisanity-darwin-arm64
chmod +x aisanity
sudo mv aisanity /usr/local/bin/

# Initialize your project
cd your-project
aisanity init
aisanity run
```

*Your AI-powered development environment awaits.* 🚀

## Requirements

- Docker
- Devcontainers CLI (`npm install -g @devcontainers/cli`)
- **Bun >= 1.0.0** (required for source installation)

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
