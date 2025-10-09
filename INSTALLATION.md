# Installation Guide

This guide provides detailed installation instructions for Aisanity on different platforms.

## Quick Install

### Option 1: Install with Bun (Recommended)

```bash
# Install Bun runtime (takes <30 seconds)
curl -fsSL https://bun.sh/install | bash

# Install Aisanity globally
bun install -g aisanity
```

### Option 2: Standalone Executable

Choose your platform below and follow the instructions.

---

## Platform-Specific Installation

### macOS (Intel)

```bash
# Download the binary
curl -L -o aisanity-darwin-x64 https://github.com/pigmej/aisanity/releases/latest/download/aisanity-darwin-x64

# Download checksum
curl -L -o aisanity-darwin-x64.sha256 https://github.com/pigmej/aisanity/releases/latest/download/aisanity-darwin-x64.sha256

# Verify the checksum
sha256sum -c aisanity-darwin-x64.sha256

# Make executable
chmod +x aisanity-darwin-x64

# Move to PATH (optional)
sudo mv aisanity-darwin-x64 /usr/local/bin/aisanity

# Verify installation
aisanity --version
```

### macOS (Apple Silicon)

```bash
# Download the binary
curl -L -o aisanity-darwin-arm64 https://github.com/pigmej/aisanity/releases/latest/download/aisanity-darwin-arm64

# Download checksum
curl -L -o aisanity-darwin-arm64.sha256 https://github.com/pigmej/aisanity/releases/latest/download/aisanity-darwin-arm64.sha256

# Verify the checksum
sha256sum -c aisanity-darwin-arm64.sha256

# Make executable
chmod +x aisanity-darwin-arm64

# Move to PATH (optional)
sudo mv aisanity-darwin-arm64 /usr/local/bin/aisanity

# Verify installation
aisanity --version
```

### Linux (x64)

```bash
# Download the binary
curl -L -o aisanity-linux-x64 https://github.com/pigmej/aisanity/releases/latest/download/aisanity-linux-x64

# Download checksum
curl -L -o aisanity-linux-x64.sha256 https://github.com/pigmej/aisanity/releases/latest/download/aisanity-linux-x64.sha256

# Verify the checksum
sha256sum -c aisanity-linux-x64.sha256

# Make executable
chmod +x aisanity-linux-x64

# Move to PATH (optional)
sudo mv aisanity-linux-x64 /usr/local/bin/aisanity

# Verify installation
aisanity --version
```

### Linux (ARM64)

```bash
# Download the binary
curl -L -o aisanity-linux-arm64 https://github.com/pigmej/aisanity/releases/latest/download/aisanity-linux-arm64

# Download checksum
curl -L -o aisanity-linux-arm64.sha256 https://github.com/pigmej/aisanity/releases/latest/download/aisanity-linux-arm64.sha256

# Verify the checksum
sha256sum -c aisanity-linux-arm64.sha256

# Make executable
chmod +x aisanity-linux-arm64

# Move to PATH (optional)
sudo mv aisanity-linux-arm64 /usr/local/bin/aisanity

# Verify installation
aisanity --version
```

---

## Checksum Verification

### Why Verify Checksums?

Checksum verification ensures that the downloaded binary hasn't been corrupted or tampered with during transmission.

### How to Verify

Each release includes a `.sha256` file containing the expected checksum:

```bash
# View the checksum file
cat aisanity-linux-x64.sha256
# Output: a1b2c3d4e5f6789...  aisanity-linux-x64

# Verify the downloaded file
sha256sum -c aisanity-linux-x64.sha256
# Output: aisanity-linux-x64: OK

# If verification fails
# Output: aisanity-linux-x64: FAILED
```

### Manual Verification

If you want to verify manually:

```bash
# Generate checksum of downloaded file
sha256sum aisanity-linux-x64

# Compare with the expected checksum from the release page
# They should match exactly
```

---

## Development Installation

### From Source

For developers who want to contribute or run the latest development version:

```bash
# Clone repository
git clone https://github.com/pigmej/aisanity.git
cd aisanity

# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install

# Run in development mode
bun run dev

# Or build and run locally
bun run build
bun start
```

### Building Binaries

You can build platform-specific binaries locally:

```bash
# Build all platforms
bun run build:all

# Build specific platform
bun run build:linux-x64
bun run build:darwin-arm64

# Generate checksums
bun run checksum:generate
```

---

## Troubleshooting

### Permission Denied

```bash
# If you get permission denied, make the file executable
chmod +x aisanity-*
```

### Command Not Found

```bash
# If aisanity command is not found, add it to your PATH
# For temporary use (current session)
export PATH="$PATH:$(pwd)"

# For permanent use, add to your shell profile
echo 'export PATH="$PATH:/usr/local/bin"' >> ~/.bashrc  # or ~/.zshrc
```

### Checksum Verification Failed

```bash
# If checksum verification fails:
# 1. Download the files again
# 2. Ensure you're downloading from the official GitHub releases
# 3. Check if you have the correct version for your platform
```

### Bun Version Issues

```bash
# Check Bun version
bun --version

# Update Bun if needed
bun upgrade

# Minimum required version is 1.0.0
```

---

## System Requirements

### Minimum Requirements

- **Bun Runtime**: >= 1.0.0 (for source installation)
- **Operating System**: 
  - Linux (x64 or ARM64)
  - macOS (Intel or Apple Silicon)
- **Memory**: 512MB RAM minimum
- **Disk Space**: 100MB for binary installation

### Optional Dependencies

- **Docker**: Required for container functionality
- **Devcontainers CLI**: Required for devcontainer features
  ```bash
  npm install -g @devcontainers/cli
  ```

---

## Next Steps

After installation:

1. **Initialize your workspace**:
   ```bash
   aisanity init
   ```

2. **Check the status**:
   ```bash
   aisanity status
   ```

3. **Run commands in container**:
   ```bash
   aisanity run
   ```

For more usage examples, see the main [README.md](README.md).