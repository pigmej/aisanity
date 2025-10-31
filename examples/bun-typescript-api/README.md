# Bun TypeScript API Example

A high-performance TypeScript REST API built with Bun runtime, demonstrating Bun's blazing-fast performance and native TypeScript support for aisanity sandboxed development.

## 🚀 Features

- **Blazing Fast**: Uses Bun's native HTTP server (`Bun.serve()`) for maximum performance
- **Zero Runtime Dependencies**: No Express or other frameworks needed
- **Native TypeScript**: Bun runs TypeScript directly without transpilation
- **Fast Package Management**: Bun's package manager is significantly faster than npm/yarn
- **Built-in Testing**: Bun includes a built-in test runner
- **Hot Reload**: Watch mode for instant development feedback

## 🏗️ Project Structure

```
bun-typescript-api/
├── src/
│   └── index.ts          # Main API server using Bun.serve()
├── package.json          # Bun-specific configuration
├── tsconfig.json         # TypeScript config with bundler resolution
├── bun.lockb             # Bun lockfile (binary format)
└── README.md             # This file
```

## 📋 Prerequisites

- Docker installed and running
- `devcontainer` CLI installed
- `aisanity` tool installed

## 🎯 Quick Start with Aisanity

### 1. Initialize the development environment

```bash
cd examples/bun-typescript-api
aisanity init
```

This will:
- Detect the Bun project via `bun.lockb`
- Create appropriate devcontainer configuration
- Set up the sandboxed environment

### 2. Run the API server

```bash
aisanity run bun run dev
```

The server will start on `http://localhost:3000` with hot reload enabled.

### 3. Test the API

In a separate terminal:

```bash
# Root endpoint
curl http://localhost:3000

# Health check
curl http://localhost:3000/health

# Get users
curl http://localhost:3000/api/users

# Create a user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Dave","email":"dave@aisanity.dev"}'
```

### 4. Check container status

```bash
aisanity status
```

### 5. Stop the container

```bash
aisanity stop
```

## 🛠️ Manual Development (Without Aisanity)

If you have Bun installed locally:

```bash
# Install dependencies
bun install

# Run in development mode with hot reload
bun run dev

# Run in production mode
bun start

# Run tests
bun test
```

## 📝 API Endpoints

| Method | Endpoint       | Description                  |
|--------|----------------|------------------------------|
| GET    | `/`            | Welcome message and info     |
| GET    | `/health`      | Health check and uptime      |
| GET    | `/api/users`   | List all users               |
| POST   | `/api/users`   | Create a new user            |

## Performance Benefits

Bun provides significant performance improvements over Node.js:

1. **Faster Startup**: Bun starts 4x faster than Node.js
2. **Native TypeScript**: No transpilation overhead
3. **Fast Package Install**: `bun install` is 20-100x faster than npm
4. **Optimized Runtime**: Built on JavaScriptCore (Safari's engine)
5. **Native APIs**: Bun.serve() is faster than Express/Fastify

## Bun-Specific Features

### Native HTTP Server

Instead of Express, we use `Bun.serve()`:

```typescript
const server = Bun.serve({
  port: 3000,
  fetch(req) {
    return Response.json({ message: "Hello from Bun!" });
  }
});
```

### TypeScript Configuration

The `tsconfig.json` uses Bun-specific settings:

- `"moduleResolution": "bundler"` - Bun's module resolution
- `"noEmit": true` - Bun runs TypeScript directly
- `"types": ["bun-types"]` - Bun's TypeScript definitions

### Hot Reload

Bun's watch mode automatically reloads on file changes:

```bash
bun run --watch src/index.ts
```

## 🧪 Testing

Bun includes a built-in test runner compatible with Jest syntax:

```typescript
// example.test.ts
import { expect, test } from "bun:test";

test("2 + 2", () => {
  expect(2 + 2).toBe(4);
});
```

Run tests with:

```bash
bun test
```

## DevContainer Configuration

The Bun template uses the official Bun Docker image:

- **Image**: `mcr.microsoft.com/devcontainers/base:ubuntu`
- **User**: `bun`
- **Ports**: 3000, 3001
- **Extensions**: TypeScript, JSON, Bun VSCode extension

## 🎓 Learn More

- [Bun Documentation](https://bun.sh/docs)
- [Bun GitHub](https://github.com/oven-sh/bun)
- [Bun API Reference](https://bun.sh/docs/api)
- [Why Bun is Fast](https://bun.sh/docs/runtime/performance)

## 🤝 Contributing

This example demonstrates idiomatic Bun usage:

- Use `Bun.serve()` instead of Express
- Leverage native TypeScript support
- Utilize Bun's built-in APIs
- Keep dependencies minimal

## 📄 License

MIT
