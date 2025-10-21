# Implementation Plan: Argument Templating System

**Task ID:** 100_2_20  
**Parent Feature:** 100 - Workflow State Machine  
**Priority:** Medium  
**Implementation Phase:** 2  

## Implementation Overview

This implementation creates a secure, lightweight argument templating system that provides dynamic variable substitution for workflow commands. The system will handle `{branch}` placeholder substitution, CLI parameter propagation, and comprehensive input validation to prevent injection attacks. Following the feature architecture's emphasis on custom implementations and security-first design, this system uses TypeScript-based regex replacement with whitelist validation patterns.

The implementation builds upon the existing `ExecutionContext.variables` structure and integrates seamlessly with the YAML workflow parser and command executor components. It provides a clean API for processing command templates while maintaining strict security validation and performance requirements.

## Component Details

### ArgumentTemplater (Main Class)
```typescript
class ArgumentTemplater {
  private logger: Logger;
  private validator: InputValidator;
  private variableResolver: VariableResolver;
  
  constructor(logger?: Logger);
  
  // Core substitution method
  substituteTemplate(template: string, variables: Record<string, string>): string;
  
  // Process complete command with arguments
  processCommandArgs(command: string, args: string[], cliParams: Record<string, string>): ProcessedCommand;
  
  // Validate individual template variables
  validateTemplateVariable(name: string, value: string): boolean;
  
  // Resolve all available variables for a context
  resolveVariables(context: ExecutionContext): Promise<Record<string, string>>;
}
```

### TemplateValidator (Security Layer)
```typescript
class TemplateValidator {
  // Validate template syntax
  validateTemplateSyntax(template: string): ValidationResult;
  
  // Validate variable names against whitelist
  validateVariableName(name: string): boolean;
  
  // Validate variable values for injection prevention
  validateVariableValue(value: string): boolean;
  
  // Check for command injection patterns
  checkForInjectionPatterns(input: string): boolean;
  
  // Sanitize input values
  sanitizeInput(input: string): string;
}
```

### VariableResolver (Built-in Variables)
```typescript
class VariableResolver {
  // Resolve built-in variables
  resolveBuiltInVariables(): Promise<Record<string, string>>;
  
  // Get current git branch
  getCurrentBranch(): Promise<string>;
  
  // Get workspace name
  getWorkspaceName(): string;
  
  // Get current worktree name
  getWorktreeName(): Promise<string | undefined>;
  
  // Get timestamp
  getTimestamp(): string;
  
  // Register custom variable resolvers
  registerResolver(name: string, resolver: () => string | Promise<string>): void;
}
```

## Data Structures

### ProcessedCommand Interface
```typescript
interface ProcessedCommand {
  command: string;                    // Substituted command string
  args: string[];                    // Processed arguments array
  substitutions: Record<string, string>; // Applied substitutions for logging
  hasPlaceholders: boolean;          // Whether any placeholders were found
  validationErrors: string[];        // Any validation errors found
  executionReady: boolean;           // Whether command is ready for execution
}
```

### TemplateVariableRegistry
```typescript
interface TemplateVariableRegistry {
  // Built-in variables
  branch: string;                    // Current git branch
  workspace: string;                 // Workspace name
  worktree?: string;                 // Worktree name (if applicable)
  timestamp: string;                 // ISO timestamp
  
  // CLI-provided variables
  [key: string]: string;             // User-defined variables from CLI
}
```

### ValidationResult
```typescript
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitized?: string;                // Sanitized version of input
}
```

### CLIParameterMapping
```typescript
interface CLIParameterMapping {
  [cliArg: string]: {
    variable: string;                // Template variable name
    required: boolean;               // Whether parameter is required
    validator?: (value: string) => boolean; // Custom validation
    defaultValue?: string;           // Default value if not provided
  };
}
```

## API Design

### Core Templating API
```typescript
// Main entry point for template processing
const templater = new ArgumentTemplater(logger);

// Process a command template with variables
const processed = await templater.processCommandArgs(
  "git checkout {branch}",
  ["--force"],
  { branch: "feature/new-ui" }
);

// Result:
// {
//   command: "git checkout feature/new-ui",
//   args: ["--force"],
//   substitutions: { branch: "feature/new-ui" },
//   hasPlaceholders: true,
//   validationErrors: [],
//   executionReady: true
// }
```

### Variable Resolution API
```typescript
// Resolve all available variables for current context
const variables = await templater.resolveVariables(executionContext);

// Manual template substitution
const substituted = templater.substituteTemplate(
  "echo 'Building {branch} in {workspace}'",
  variables
);
```

### Validation API
```typescript
// Validate template syntax
const validation = templater.validateTemplateSyntax("git checkout {branch}");

// Validate individual variables
const isValid = templater.validateTemplateVariable("branch", "feature/new-ui");
```

### Integration with ExecutionContext
```typescript
// Extend ExecutionContext with templating support
interface ExecutionContext {
  // Existing properties...
  variables: Record<string, string>;  // Populated by templating system
  templateSubstitutions: Record<string, string>; // Track applied substitutions
}
```

## Testing Strategy

### Unit Tests
- **Template Substitution**: Test all placeholder patterns and edge cases
- **Variable Resolution**: Test built-in variable generation and CLI parameter mapping
- **Security Validation**: Test injection prevention and input sanitization
- **Error Handling**: Test missing variables, invalid syntax, and validation failures
- **Performance**: Test processing speed with large templates and many variables

### Integration Tests
- **YAML Parser Integration**: Test processing of command templates from workflow definitions
- **Command Executor Integration**: Test passing processed arguments to executor
- **CLI Integration**: Test parameter capture from state command and variable mapping
- **ExecutionContext Integration**: Test variable population and substitution tracking

### Security Tests
- **Command Injection**: Test various injection attempts are blocked
- **Path Traversal**: Test file system path validation
- **Shell Escape**: Test shell metacharacter sanitization
- **Buffer Overflow**: Test length limits and input validation

### Performance Tests
- **Substitution Speed**: Ensure <10ms processing for typical templates
- **Memory Usage**: Verify minimal object allocation during processing
- **Large Templates**: Test performance with complex nested substitutions
- **Concurrent Processing**: Test multiple workflow executions

### Test Fixtures
```typescript
// Valid templates
const validTemplates = [
  "git checkout {branch}",
  "echo 'Building {workspace} on {branch}'",
  "docker build -t {workspace}:{branch} .",
  "npm run build -- --env={environment}"
];

// Invalid templates (security risks)
const invalidTemplates = [
  "git checkout {branch}; rm -rf /",
  "echo 'User input: {user_input}'",
  "curl {url} | sh",
  "eval '{command}'"
];

// Test variables
const testVariables = {
  branch: "feature/new-ui",
  workspace: "my-project",
  environment: "production"
};
```

## Development Phases

### Phase 1: Core Templating Engine (Week 1)
**Objective**: Implement basic template substitution functionality

**Tasks**:
1. Create `ArgumentTemplater` class with basic structure
2. Implement regex-based placeholder detection (`/{(\w+)}/g`)
3. Create simple variable substitution logic
4. Add basic error handling for missing variables
5. Implement `ProcessedCommand` interface and data structures

**Deliverables**:
- Working template substitution for `{branch}` placeholder
- Basic variable registry with built-in variables
- Error handling for missing variables
- Unit tests for core substitution logic

### Phase 2: Security Validation Layer (Week 2)
**Objective**: Implement comprehensive security validation and input sanitization

**Tasks**:
1. Create `TemplateValidator` class with security rules
2. Implement whitelist-based input sanitization
3. Add command injection prevention patterns
4. Create validation for shell metacharacters and special characters
5. Implement length limits and buffer overflow protection
6. Add comprehensive error reporting for security violations

**Deliverables**:
- Complete security validation system
- Input sanitization for all variable values
- Security test suite with injection attempts
- Detailed error messages for validation failures

### Phase 3: Variable Resolution System (Week 3)
**Objective**: Implement built-in variable resolution and CLI parameter mapping

**Tasks**:
1. Create `VariableResolver` class with built-in variables
2. Implement git branch detection and workspace name resolution
3. Add worktree name detection (if applicable)
4. Create CLI parameter to variable mapping system
5. Implement variable precedence (CLI > built-in > defaults)
6. Add timestamp and other utility variables

**Deliverables**:
- Complete built-in variable system
- CLI parameter integration
- Variable resolution with proper precedence
- Integration tests with git operations

### Phase 4: Integration and Testing (Week 4)
**Objective**: Complete integration with existing components and comprehensive testing

**Tasks**:
1. Integrate with YAML workflow parser for template processing
2. Connect with CommandExecutor for argument passing
3. Integrate with ExecutionContext for variable storage
4. Add CLI command integration for parameter capture
5. Complete comprehensive test suite
6. Performance optimization and benchmarking

**Deliverables**:
- Full integration with workflow state machine
- Comprehensive test coverage
- Performance benchmarks
- Documentation and usage examples

### Phase 5: Documentation and Polish (Week 5)
**Objective**: Complete documentation, error handling, and final polish

**Tasks**:
1. Add comprehensive inline documentation
2. Create usage examples and best practices
3. Implement advanced error handling and recovery
4. Add debugging and logging capabilities
5. Final performance optimization
6. Code review and quality assurance

**Deliverables**:
- Complete documentation
- Production-ready implementation
- Performance optimization
- Quality assurance approval

## Critical Implementation Details

### Template Substitution Strategy
- Use compiled regex pattern `/{(\w+)}/g` for performance
- Support nested substitution (variables containing other variables)
- Provide escape mechanism using `{{` and `}}` for literal braces
- Maintain original template for error reporting and debugging
- Track all substitutions for audit logging

### Variable Resolution Order
1. CLI-provided parameters (highest priority)
2. Built-in variables (branch, workspace, worktree, timestamp)
3. Environment variables (optional, future extensibility)
4. Default values (if specified in template)

### Security Validation Rules
- **Variable Names**: alphanumeric + underscore, max 50 characters
- **Variable Values**: whitelist of safe characters (alphanumeric, spaces, hyphens, underscores, dots)
- **Command Templates**: validate against injection patterns (`;`, `&&`, `||`, `|`, `>`, `<`, `$`, `` ` ``)
- **Length Limits**: variable names (50 chars), values (255 chars), templates (1000 chars)

### Error Handling Strategy
- Clear error messages with line/column reference for template errors
- Security violation warnings with specific pattern detected
- Graceful degradation for optional variables with defaults
- Detailed logging for debugging template processing issues
- Validation error aggregation for batch processing

### Performance Considerations
- Cache compiled regex patterns for repeated use
- Minimize object allocation during substitution
- Use efficient string operations (avoid unnecessary concatenation)
- Implement variable caching for expensive operations (git branch detection)
- Benchmark with realistic workflow templates

This implementation plan provides a secure, performant, and maintainable argument templating system that seamlessly integrates with the existing workflow state machine while following all established architectural decisions and security requirements.