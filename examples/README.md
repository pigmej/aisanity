# Aisanity Examples

This directory contains example projects demonstrating how to use aisanity with different programming languages and frameworks. Each example includes proper devcontainer configuration for seamless sandboxed development.

## 📁 Available Examples

### 🚀 [Go Hello World](./go-hello-world/)
A simple Go web application with health check endpoints.

**Features:**
- Go 1.21 with proper module setup
- HTTP server with multiple endpoints
- Devcontainer with Go tools and VS Code extensions
- Pre-configured development environment

**Quick Start:**
```bash
cd go-hello-world
aisanity init
aisanity run go run main.go
```

### 🐍 [Python Flask API](./python-flask-api/)
A simple Flask REST API with Python 3.11.

**Features:**
- Flask web framework
- RESTful API endpoints
- Python virtual environment
- Devcontainer with Python tools
- Pre-configured development environment

**Quick Start:**
```bash
cd python-flask-api
aisanity init
aisanity run python app.py
```

### 🟨 [Node.js TypeScript API](./node-typescript-api/)
A TypeScript REST API with Express.js framework.

**Features:**
- TypeScript with strict type checking
- Express.js web framework
- RESTful API endpoints
- Jest testing framework setup
- Pre-configured development environment

**Quick Start:**
```bash
cd node-typescript-api
aisanity init
aisanity run npm run dev
```

## 🛠️ General Usage Pattern

For any example project:

1. **Navigate to the example:**
   ```bash
   cd examples/<project-name>
   ```

2. **Initialize aisanity:**
   ```bash
   aisanity init
   ```

3. **Run the application:**
   ```bash
   aisanity run <command>
   ```

4. **Check status:**
   ```bash
   aisanity status
   ```

5. **Stop containers:**
   ```bash
   aisanity stop
   ```

## 🏗️ Devcontainer Features

Each example includes:

- **Proper devcontainer.json** - Configured for the specific language/framework
- **Dockerfile** - Optimized container setup
- **VS Code extensions** - Language-specific development tools
- **Port forwarding** - Automatic port exposure for web applications
- **Post-create commands** - Automatic dependency installation

## 🔧 Adding New Examples

To add a new example:

1. Create a new directory under `examples/`
2. Add a `.devcontainer/` folder with:
   - `devcontainer.json`
   - `Dockerfile` (optional, can use pre-built images)
3. Include language-specific configuration files
4. Add a comprehensive README.md
5. Update this main README.md

## 🎯 Best Practices

- **Keep examples simple** - Focus on demonstrating core concepts
- **Include proper documentation** - Clear setup and usage instructions
- **Test with aisanity** - Ensure examples work with the tool
- **Use latest stable versions** - Keep dependencies up to date
- **Include health checks** - Make it easy to verify the application is running

## 🤝 Contributing

When adding new examples:

1. Follow the established directory structure
2. Include both aisanity and manual development instructions
3. Test thoroughly with `aisanity run`, `aisanity status`, and `aisanity stop`
4. Update this README with the new example

## 📞 Support

If you encounter issues with any example:

1. Check that devcontainers CLI is installed
2. Verify Docker is running
3. Try `aisanity status` to check container state
4. Use `aisanity stop` to clean up and retry