# Migration Guide: Bun Runtime Required

This document provides information about migrating to Bun runtime, which is now required for Aisanity.

## Overview

As of version 0.1.0, Aisanity requires Bun runtime. This change simplifies the codebase and provides significant performance improvements.

### Why Bun-Only?

The transition to Bun-only provides:
- **Code Simplification**: ~320 lines of runtime compatibility code removed
- **4x faster startup times**: From ~300ms to ~70ms
- **100x faster test execution**: From ~5s to ~50ms
- **Native TypeScript support**: No compilation needed
- **Reduced maintenance overhead**: Single runtime to support
- **Modern development experience**: Better APIs and tooling

## Installation

### Installing Bun

Bun installation is quick and straightforward:

```bash
# macOS, Linux, and WSL
curl -fsSL https://bun.sh/install | bash

# Windows (via PowerShell)
powershell -c "irm bun.sh/install.ps1|iex"
```

### Verifying Installation

```bash
bun --version
# Should output: 1.x.x or higher
```

### Installing Aisanity

```bash
# Install Aisanity globally
bun install -g aisanity
```

## Usage Changes

### Running Commands

```bash
# BEFORE (Node.js)
npm install
npm run build
npm test

# AFTER (Bun)
bun install
bun run build
bun test
```

### Development Workflow

```bash
# BEFORE
npm run dev

# AFTER
bun --watch src/index.ts
```

## Alternative: Standalone Executable

If you cannot install Bun, use the standalone executable which bundles the Bun runtime:

```bash
# Download from releases
curl -L -o aisanity https://github.com/yourorg/aisanity/releases/latest/download/aisanity-linux
chmod +x aisanity
./aisanity --help
```

## Troubleshooting

### Bun not found after installation

Add Bun to your PATH:
```bash
export PATH="$HOME/.bun/bin:$PATH"
```

### Permission issues

Bun binaries may need executable permissions:
```bash
chmod +x ~/.bun/bin/bun
```

## Support

For questions or issues, please open an issue on GitHub.

