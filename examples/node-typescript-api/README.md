# Node.js TypeScript API Example

A TypeScript REST API demonstrating aisanity usage with devcontainers.

## 🚀 Quick Start with Aisanity

1. **Navigate to this example:**
   ```bash
   cd examples/node-typescript-api
   ```

2. **Initialize aisanity workspace:**
   ```bash
   aisanity init
   ```

3. **Install dependencies and run in development mode:**
   ```bash
   aisanity run npm run dev
   ```

4. **Or build and run the production version:**
   ```bash
   aisanity run npm run build
   aisanity run npm start
   ```

5. **Test the API:**
   ```bash
   # In another terminal
   aisanity run curl http://localhost:3000
   aisanity run curl http://localhost:3000/health
   aisanity run curl http://localhost:3000/api/users
   ```

6. **Stop containers:**
   ```bash
   aisanity stop
   ```

## 🏗️ Manual Development

1. **Build the container:**
   ```bash
   devcontainer build
   ```

2. **Open in container:**
   ```bash
   devcontainer open
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Run in development:**
   ```bash
   npm run dev
   ```

## 📋 API Endpoints

- `GET /` - Welcome message with timestamp
- `GET /health` - Health check with uptime
- `GET /api/users` - List all users
- `POST /api/users` - Create a new user

### Example API Usage

```bash
# Get welcome message
curl http://localhost:3000

# Health check
curl http://localhost:3000/health

# Get users
curl http://localhost:3000/api/users

# Create a user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}'
```

## 🛠️ Development Commands

```bash
# Development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Run tests
npm test
```

## 📁 Project Structure

```
node-typescript-api/
├── src/
│   └── index.ts           # Main TypeScript application
├── .devcontainer/         # Devcontainer configuration
│   ├── devcontainer.json
│   └── Dockerfile
├── package.json           # Node.js dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── README.md             # This file
```

## 🔧 Technologies Used

- **Node.js** - Runtime environment
- **TypeScript** - Type-safe JavaScript
- **Express.js** - Web framework
- **Jest** - Testing framework
- **Devcontainers** - Development environment

## 🔒 Sandboxed Development Benefits

Using aisanity provides:
- **Type Safety** - Full TypeScript support in isolated environment
- **Dependency Isolation** - No conflicts with system Node.js
- **Consistent Setup** - Same environment across team members
- **Easy Cleanup** - Clean teardown with `aisanity stop`
- **IDE Integration** - Full VS Code TypeScript support via devcontainers