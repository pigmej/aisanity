# Aisanity Development Guidelines

## Build/Lint/Test Commands

### Build
- `npm run build` - Compile TypeScript to JavaScript in dist/ directory

### Lint
- `npm run lint` - Run ESLint on source files (src/**/*.ts) - Note: ESLint configuration needed

### Test
- `npm test` - Run all tests with Jest
- `npm test -- --watch` - Run tests in watch mode
- `npm test tests/config.test.ts` - Run specific test file
- `npm test -- --coverage` - Run tests with coverage report

## Node.js Environment
- Target: Node.js 24.x (latest current)
- LTS Support: Node.js 22.x (for long-term support environments)

## Code Style Guidelines

### Imports
- Use ES module imports: `import { module } from 'package'`
- Import from relative paths: `import { util } from '../utils/config'`
- Group imports: node built-ins, dependencies, local modules

### Formatting
- Use TypeScript with strict mode enabled
- Follow existing indentation and spacing
- Use single quotes for strings unless template literals needed
- Use semicolons for statement termination

### Types
- Leverage TypeScript type system
- Use interfaces for object shapes
- Prefer async/await over callbacks
- Use strict typing (enabled in tsconfig.json)

### Naming Conventions
- PascalCase for classes and command objects
- camelCase for functions and variables
- kebab-case for branch/container names
- Suffix commands with 'Command' (e.g., initCommand)

### Error Handling
- Use try/catch blocks for async operations
- Log errors with console.error
- Exit with process.exit(1) for critical failures
- Handle git failures gracefully with fallbacks
