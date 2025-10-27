# Architectural Analysis: Argument Templating System

**Task ID:** 100_2_20  
**Parent Feature:** 100 - Workflow State Machine  
**Priority:** Medium  
**Implementation Phase:** 2  

## Context Analysis

This task implements the dynamic argument handling layer for the workflow state machine. It builds upon the YAML workflow parser foundation to provide secure variable substitution and parameter passing to workflow commands. The system must handle `{branch}` placeholder substitution and CLI parameter propagation while maintaining strict security validation to prevent injection attacks.

The templating system operates as a critical bridge between static workflow definitions and dynamic command execution. It must integrate seamlessly with the existing ExecutionContext's variables system and provide a clean API for the CommandExecutor to consume processed arguments.

## Technology Recommendations

### **IMPORTANT**: Custom String Replacement Implementation
- **Technology**: TypeScript-based regex replacement with validation
- **Rationale**: Aligns with feature architecture decision for lightweight approach, no external dependencies
- **Impact**: Full control over security validation, predictable performance, minimal bundle size

### **IMPORTANT**: Leverage Existing ExecutionContext Variables
- **Technology**: Extend `ExecutionContext.variables` Record<string, string> structure
- **Rationale**: Already designed for future templating, maintains consistency with existing architecture
- **Impact**: Seamless integration with execution context, no structural changes required

### **IMPORTANT**: Security-First Validation Pattern
- **Technology**: Whitelist-based input sanitization following existing `validateBranchName()` patterns
- **Rationale**: Prevents command injection, follows existing aisanity security patterns
- **Impact**: Robust security protection, consistent with existing codebase validation approach

## System Architecture

### Core Components

#### ArgumentTemplater (Main Class)
```typescript
class ArgumentTemplater {
  private logger: Logger;
  private validator: InputValidator;
  
  constructor(logger?: Logger);
  substituteTemplate(template: string, variables: Record<string, string>): string;
  processCommandArgs(command: string, args: string[], cliParams: Record<string, string>): ProcessedCommand;
  validateTemplateVariable(name: string, value: string): boolean;
}
```

#### ProcessedCommand Interface
```typescript
interface ProcessedCommand {
  command: string;           // Substituted command string
  args: string[];           // Processed arguments array
  substitutions: Record<string, string>; // Applied substitutions for logging
  hasPlaceholders: boolean; // Whether any placeholders were found
}
```

#### TemplateVariableRegistry
```typescript
interface TemplateVariableRegistry {
  // Built-in variables
  branch: string;           // Current git branch
  workspace: string;        // Workspace name
  worktree?: string;        // Worktree name (if applicable)
  
  // CLI-provided variables
  [key: string]: string;    // User-defined variables from CLI
}
```

### File Structure
```
src/
├── workflow/
│   ├── argument-templater.ts    # Main ArgumentTemplater class
│   ├── template-validator.ts    # Input validation and sanitization
│   └── variable-resolver.ts     # Variable resolution logic
```

## Integration Patterns

### **IMPORTANT**: ExecutionContext Integration
- **Pattern**: Extend existing `ExecutionContext.variables` for template variable storage
- **Integration**: Populate variables during workflow initialization, use during command execution
- **Benefits**: Leverages existing architecture, maintains execution context immutability

### **IMPORTANT**: CommandExecutor Integration
- **Pattern**: Provide processed arguments to CommandExecutor through existing interface
- **Integration**: Call templating before command execution, pass ProcessedCommand to executor
- **Benefits**: Clean separation of concerns, maintains existing executor contract

### **IMPORTANT**: CLI Parameter Integration
- **Pattern**: Follow existing commander.js patterns for parameter handling
- **Integration**: Capture CLI arguments in state command, pass to templating system
- **Benefits**: Consistent user experience, leverages existing CLI framework

## Implementation Guidance

### Phase 1: Core Templating Engine
1. Implement basic `{variable}` substitution using regex patterns
2. Create variable registry with built-in variables (branch, workspace)
3. Add validation for variable names and values
4. Build error handling for missing variables

### Phase 2: Security Validation Layer
1. Implement whitelist-based input sanitization
2. Add command injection prevention patterns
3. Create validation for special characters and shell metacharacters
4. Build comprehensive error reporting for invalid inputs

### Phase 3: CLI Integration
1. Integrate with state command for parameter capture
2. Add CLI parameter to variable mapping
3. Implement variable precedence (CLI > built-in > defaults)
4. Add debugging and logging for template processing

### Critical Implementation Details

#### Template Substitution Strategy
- Use `/{(\w+)}/g` regex pattern for placeholder detection
- Support nested substitution (variables in variables)
- Provide escape mechanism for literal `{}` characters
- Maintain original template for error reporting

#### Variable Resolution Order
1. CLI-provided parameters (highest priority)
2. Built-in variables (branch, workspace, worktree)
3. Environment variables (optional, future extensibility)
4. Default values (if specified)

#### Security Validation Rules
- Variable names: alphanumeric + underscore, max 50 characters
- Variable values: whitelist of safe characters, no shell metacharacters
- Command templates: validate against injection patterns
- Length limits: prevent buffer overflow attacks

#### Error Handling Strategy
- Clear error messages for missing variables
- Line/column reference for template errors
- Security violation warnings with suggestions
- Graceful degradation for optional variables

### Template Variable Definitions

#### Built-in Variables
```typescript
const BUILT_IN_VARIABLES = {
  branch: () => getCurrentBranch(process.cwd()),
  workspace: () => path.basename(process.cwd()),
  worktree: () => getCurrentWorktreeName(process.cwd()),
  timestamp: () => new Date().toISOString(),
};
```

#### CLI Parameter Mapping
```typescript
interface CLIParameterMapping {
  // Map CLI arguments to template variables
  [cliArg: string]: {
    variable: string;     // Template variable name
    required: boolean;    // Whether parameter is required
    validator?: (value: string) => boolean; // Custom validation
  };
}
```

### Testing Strategy
- Unit tests for all substitution scenarios
- Security tests for injection prevention
- Integration tests with CommandExecutor
- Performance tests for large templates
- Error handling validation tests

## Considerations

### Security
- **Command Injection Prevention**: Strict validation of all substituted values
- **Path Traversal Protection**: Validate file system paths in variables
- **Shell Escape Prevention**: Sanitize shell metacharacters in all inputs
- **Length Validation**: Prevent buffer overflow attacks

### Performance
- **Sub-10ms Processing**: Fast template substitution for real-time execution
- **Memory Efficiency**: Minimal object allocation during processing
- **Caching Strategy**: Cache resolved variables for repeated use
- **Regex Optimization**: Use compiled regex patterns for performance

### Maintainability
- **Clear Error Messages**: Detailed validation errors with context
- **Extensible Variable System**: Easy addition of new built-in variables
- **Comprehensive Logging**: Debug information for template processing
- **Consistent Patterns**: Follow existing aisanity validation patterns

### Scalability
- **Complex Template Support**: Handle nested substitutions and conditionals
- **Multiple Workflow Support**: Efficient variable resolution across workflows
- **Large Argument Arrays**: Process command arguments efficiently
- **Future Extensibility**: Support for custom variable resolvers

This architecture provides a secure, performant, and maintainable argument templating system that integrates seamlessly with the existing workflow state machine while following all established architectural decisions and security requirements.