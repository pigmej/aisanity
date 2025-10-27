# Implementation Plan: YAML Workflow Parser

**Task ID:** 100_1_10  
**Parent Feature:** 100 - Workflow State Machine  
**Priority:** High  
**Implementation Phase:** 1  

## Implementation Overview

This implementation creates a robust YAML parser for loading and validating workflow definitions from `.aisanity-workflows.yml` files. The parser follows existing aisanity patterns, uses the existing `yaml` dependency, and provides comprehensive schema validation without external libraries.

The implementation consists of:
- Core TypeScript interfaces defining workflow data structures
- A `WorkflowParser` class for loading and validating workflows
- Custom validation engine with detailed error reporting
- Integration with existing aisanity utilities (Logger, config patterns)

## Component Details

### 1. Core Interfaces (`src/workflow/interfaces.ts`)

Defines the complete data structure hierarchy for workflows:

```typescript
// Main workflow definitions container
interface WorkflowDefinitions {
  workflows: Record<string, Workflow>;
  metadata: WorkflowMetadata;
}

// Individual workflow definition
interface Workflow {
  name: string;
  description?: string;
  initialState: string;
  states: Record<string, State>;
  globalTimeout?: number;
}

// State definition within a workflow
interface State {
  description?: string;
  command: string;
  args?: string[];
  timeout?: number;
  confirmation?: ConfirmationConfig;
  transitions: StateTransitions;
}

// State transition mappings
interface StateTransitions {
  success?: string;
  failure?: string;
  timeout?: string;
}

// Confirmation prompt configuration
interface ConfirmationConfig {
  message?: string;
  timeout?: number;
  defaultAccept?: boolean;
}

// Workflow metadata
interface WorkflowMetadata {
  version?: string;
  created?: string;
  modified?: string;
}
```

### 2. Main Parser Class (`src/workflow/parser.ts`)

The `WorkflowParser` class provides the primary API:

```typescript
class WorkflowParser {
  private logger: Logger;
  
  constructor(logger?: Logger);
  
  // Load and parse workflows from workspace root
  loadWorkflows(workspacePath: string): WorkflowDefinitions;
  
  // Validate individual workflow
  validateWorkflow(workflow: unknown, workflowName: string): Workflow;
  
  // Get specific workflow by name
  getWorkflow(workflowName: string, workspacePath: string): Workflow;
  
  // List all available workflow names
  listWorkflows(workspacePath: string): string[];
}
```

### 3. Validation Engine (`src/workflow/validator.ts`)

Custom schema validation without external dependencies:

```typescript
class SchemaValidator {
  // Validate workflow definitions structure
  validateWorkflowDefinitions(data: unknown): WorkflowDefinitions;
  
  // Validate individual workflow
  validateWorkflow(data: unknown, workflowName: string): Workflow;
  
  // Validate state definition
  validateState(data: unknown, stateName: string, workflowName: string): State;
  
  // Validate transitions
  validateTransitions(data: unknown, stateName: string, workflowName: string, availableStates: string[]): StateTransitions;
}

// Type guard functions for runtime validation
function isWorkflowDefinitions(data: unknown): data is WorkflowDefinitions;
function isWorkflow(data: unknown): data is Workflow;
function isState(data: unknown): data is State;
function isStateTransitions(data: unknown): data is StateTransitions;
```

### 4. Error Handling (`src/workflow/errors.ts`)

Custom error classes with detailed context:

```typescript
class WorkflowParseError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly line?: number,
    public readonly column?: number
  );
}

class WorkflowValidationError extends Error {
  constructor(
    message: string,
    public readonly workflowName?: string,
    public readonly fieldPath?: string,
    public readonly line?: number
  );
}

class WorkflowFileError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly reason: 'missing' | 'permission' | 'invalid'
  );
}
```

## Data Structures

### File Structure
```
src/workflow/
├── interfaces.ts     # TypeScript interfaces and type definitions
├── parser.ts         # Main WorkflowParser class
├── validator.ts      # Schema validation logic and type guards
├── errors.ts         # Custom error classes
└── index.ts          # Public API exports
```

### YAML File Format
```yaml
# .aisanity-workflows.yml
workflows:
  deploy:
    name: "Deploy Application"
    description: "Build and deploy application to production"
    initialState: "build"
    globalTimeout: 1800
    states:
      build:
        description: "Build the application"
        command: "npm run build"
        timeout: 300
        transitions:
          success: "test"
          failure: "cleanup"
      test:
        description: "Run test suite"
        command: "npm test"
        args: ["--coverage"]
        timeout: 600
        confirmation:
          message: "Run tests before deployment?"
          timeout: 30
          defaultAccept: true
        transitions:
          success: "deploy"
          failure: "cleanup"
      deploy:
        description: "Deploy to production"
        command: "npm run deploy"
        timeout: 900
        transitions:
          success: "complete"
          failure: "rollback"
      cleanup:
        description: "Clean up build artifacts"
        command: "npm run clean"
        transitions:
          success: "complete"
      rollback:
        description: "Rollback deployment"
        command: "npm run rollback"
        transitions:
          success: "complete"
      complete:
        description: "Deployment complete"
        command: "echo 'Deployment finished'"
        transitions: {}

metadata:
  version: "1.0.0"
  created: "2025-01-20"
  modified: "2025-01-20"
```

## API Design

### Public Interface
```typescript
// Import the parser
import { WorkflowParser } from './workflow';

// Create parser instance
const parser = new WorkflowParser(logger);

// Load all workflows
const workflows = parser.loadWorkflows('/workspace/path');

// Get specific workflow
const deployWorkflow = parser.getWorkflow('deploy', '/workspace/path');

// List available workflows
const workflowNames = parser.listWorkflows('/workspace/path');
```

### Error Handling Pattern
```typescript
try {
  const workflows = parser.loadWorkflows(workspacePath);
  // Use workflows...
} catch (error) {
  if (error instanceof WorkflowFileError) {
    logger.error(`Workflow file error: ${error.message}`);
    process.exit(1);
  } else if (error instanceof WorkflowParseError) {
    logger.error(`Parse error at line ${error.line}: ${error.message}`);
    process.exit(1);
  } else if (error instanceof WorkflowValidationError) {
    logger.error(`Validation error in ${error.workflowName}: ${error.message}`);
    if (error.fieldPath) {
      logger.error(`  Field path: ${error.fieldPath}`);
    }
    process.exit(1);
  }
}
```

## Testing Strategy

### Unit Tests
- **Interface Validation**: Test all type guard functions with valid/invalid data
- **Schema Validation**: Test validation rules for each schema level
- **Error Generation**: Verify error messages include correct context and line numbers
- **Parser Methods**: Test each public method with various input scenarios

### Integration Tests
- **File Loading**: Test loading from existing, missing, and malformed files
- **YAML Parsing**: Test with valid YAML, syntax errors, and edge cases
- **Workspace Integration**: Test with different workspace paths and configurations
- **Logger Integration**: Verify proper logging in different verbosity modes

### Performance Tests
- **Large Files**: Test parsing performance with complex workflow definitions
- **Memory Usage**: Verify efficient memory usage for large workflow sets
- **Startup Time**: Ensure <100ms parsing time for typical workflow files

### Test File Structure
```
tests/workflow/
├── parser.test.ts           # Main parser functionality
├── validator.test.ts        # Schema validation tests
├── errors.test.ts          # Error handling tests
├── fixtures/               # Test YAML files
│   ├── valid-workflows.yml
│   ├── invalid-syntax.yml
│   ├── invalid-schema.yml
│   └── large-workflows.yml
└── helpers/               # Test utilities
    ├── mock-logger.ts
    └── test-utils.ts
```

## Development Phases

### Phase 1: Core Interface Design (Days 1-2)
1. **Define TypeScript Interfaces**
   - Create complete interface hierarchy in `interfaces.ts`
   - Add comprehensive JSDoc documentation
   - Ensure type safety for all workflow structures

2. **Create Type Guards**
   - Implement runtime type checking functions
   - Add comprehensive test coverage for type guards
   - Validate edge cases and malformed data

3. **Establish Error Classes**
   - Create custom error hierarchy
   - Add context information (line numbers, field paths)
   - Test error message formatting and clarity

### Phase 2: Parser Implementation (Days 3-4)
1. **File Loading Logic**
   - Implement workspace root detection
   - Add graceful handling of missing files
   - Follow existing `loadAisanityConfig()` patterns

2. **YAML Parsing**
   - Use existing `yaml` dependency
   - Capture line numbers for error reporting
   - Handle YAML syntax errors gracefully

3. **Basic Validation**
   - Implement core schema validation
   - Add field path tracking for errors
   - Create comprehensive test suite

### Phase 3: Advanced Validation (Days 5-6)
1. **Cross-Reference Validation**
   - Validate state references in transitions
   - Check for circular dependencies
   - Verify initial state exists

2. **Security Validation**
   - Validate command strings against injection patterns
   - Check timeout values for reasonable bounds
   - Sanitize all user-provided data

3. **Performance Optimization**
   - Add caching for parsed workflows
   - Implement lazy validation where appropriate
   - Optimize memory usage for large files

### Phase 4: Integration & Polish (Days 7-8)
1. **Logger Integration**
   - Integrate with existing `Logger` class
   - Add appropriate debug/verbose logging
   - Ensure silent mode compatibility

2. **Error Message Refinement**
   - Improve error message clarity and helpfulness
   - Add suggestions for common mistakes
   - Test error messages with real-world scenarios

3. **Documentation & Examples**
   - Create comprehensive API documentation
   - Add example workflow configurations
   - Document integration patterns for other components

## Critical Implementation Details

### Error Message Strategy
- Include line numbers for YAML syntax errors
- Provide field paths for validation failures (e.g., `workflows.my-workflow.states.build.command`)
- Suggest corrections for common mistakes
- Use consistent error formatting across all validation types

### Performance Considerations
- Cache parsed workflows during single execution
- Lazy validation - only validate workflows being executed
- Minimal memory footprint for large workflow files
- Fast startup to meet <500ms requirement

### Security Considerations
- Validate all command strings against injection patterns
- Restrict file system access to workspace boundaries
- Sanitize all user-provided template variables
- Validate timeout values to prevent resource exhaustion

### Integration Patterns
- Follow existing `loadAisanityConfig()` approach for file loading
- Use existing `Logger` class for consistent output
- Mirror error handling patterns from `input-validation.ts`
- Maintain consistency with existing aisanity CLI patterns

This implementation plan provides a solid foundation for the workflow state machine while maintaining consistency with existing aisanity patterns and meeting all specified requirements.