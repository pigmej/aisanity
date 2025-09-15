# Go Hello World Example

A simple Go web application demonstrating aisanity usage with devcontainers.

## 🚀 Quick Start with Aisanity

1. **Navigate to this example:**
   ```bash
   cd examples/go-hello-world
   ```

2. **Initialize aisanity workspace:**
   ```bash
   aisanity init
   ```

3. **Run the Go application:**
   ```bash
   aisanity run go run main.go
   ```

4. **Or run the server:**
   ```bash
   aisanity run ./main
   ```

5. **Check status:**
   ```bash
   aisanity status
   ```

6. **Stop containers when done:**
   ```bash
   aisanity stop
   ```

## 🏗️ Manual Development (without aisanity)

If you want to develop manually:

1. **Build the container:**
   ```bash
   devcontainer build
   ```

2. **Open in container:**
   ```bash
   devcontainer open
   ```

3. **Run the application:**
   ```bash
   go run main.go
   ```

## 📋 What This Example Demonstrates

- ✅ **Simple Go web server** with health check endpoint
- ✅ **Proper devcontainer setup** with Go 1.21
- ✅ **Port forwarding** (8080) for web access
- ✅ **VS Code extensions** for Go development
- ✅ **Post-create commands** for dependency management
- ✅ **Aisanity integration** for sandboxed development

## 🌐 API Endpoints

- `GET /` - Hello world message
- `GET /health` - Health check (returns "OK")

## 🛠️ Development Commands

```bash
# Run the server
go run main.go

# Build the binary
go build -o main .

# Run the binary
./main

# Test the endpoints
curl http://localhost:8080
curl http://localhost:8080/health
```

## 📁 Project Structure

```
go-hello-world/
├── main.go              # Main Go application
├── go.mod               # Go module definition
├── .devcontainer/       # Devcontainer configuration
│   ├── devcontainer.json
│   └── Dockerfile
└── README.md           # This file
```

## 🔒 Sandboxed Development

Using aisanity provides:
- **Isolated environment** - No conflicts with system Go installation
- **Consistent setup** - Same environment across different machines
- **Clean teardown** - Easy cleanup with `aisanity stop`
- **IDE integration** - Seamless VS Code integration via devcontainers