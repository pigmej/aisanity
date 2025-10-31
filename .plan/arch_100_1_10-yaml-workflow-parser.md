# Architectural Analysis: YAML Workflow Parser

**Task ID:** 100_1_10  
**Parent Feature:** 100 - Workflow State Machine  
**Priority:** High  
**Implementation Phase:** 1  

## Context Analysis

This task is the foundational component for the workflow state machine feature. It must provide robust YAML parsing and validation capabilities that will be consumed by all subsequent components in the feature. The parser needs to handle multiple named workflows, validate complex schema structures, and provide clear error messages for invalid configurations.

The parser must integrate seamlessly with existing aisanity patterns while establishing the data structures that will drive the entire FSM engine. This is a critical path component that will impact the reliability and usability of the entire workflow system.

## Technology Recommendations

### **IMPORTANT**: Use Existing YAML Dependency
- **Technology**: `yaml` (already in package.json v2.3.0)
- **Rationale**: Consistent with existing codebase, proven reliability, no additional dependencies
- **Impact**: Maintains bundle size efficiency and reduces dependency surface

### **IMPORTANT**: Custom Schema Validation
- **Technology**: TypeScript interfaces + custom validation functions
- **Rationale**: No external validation libraries (per architectural notes), full control over error messages
- **Impact**: More code to maintain but precise error handling and line number reporting

### **IMPORTANT**: Follow Existing Configuration Patterns
- **Technology**: Pattern from `src/utils/config.ts`
- **Rationale**: Consistent error handling, file loading patterns, and integration with existing utilities
- **Impact**: Seamless integration with existing aisanity architecture

## System Architecture

### Core Components

#### WorkflowParser (Main Class)
```typescript
class WorkflowParser {
  private logger: Logger;
  
  constructor(logger?: Logger);
  loadWorkflows(workspacePath: string): WorkflowDefinitions;
  validateWorkflow(workflow: unknown, workflowName: string): Workflow;
}
```

#### Data Structure Interfaces
```typescript
interface WorkflowDefinitions {
  workflows: Record<string, Workflow>;
  metadata: WorkflowMetadata;
}

interface Workflow {
  name: string;
  description?: string;
  initialState: string;
  states: Record<string, State>;
  globalTimeout?: number;
}

interface State {
  description?: string;
  command: string;
  args?: string[];
  timeout?: number;
  confirmation?: ConfirmationConfig;
  transitions: StateTransitions;
}

interface StateTransitions {
  success?: string;
  failure?: string;
  timeout?: string;
}
```

#### Validation Engine
- **SchemaValidator**: Validates workflow structure against TypeScript interfaces
- **ErrorReporter**: Generates detailed error messages with line numbers
- **TypeGuards**: Runtime type checking for complex nested structures

### File Structure
```
src/
├── workflow/
│   ├── parser.ts           # Main WorkflowParser class
│   ├── interfaces.ts       # TypeScript interfaces
│   ├── validator.ts        # Schema validation logic
│   └── errors.ts          # Custom error classes
```

## Integration Patterns

### **IMPORTANT**: Logger Integration
- **Pattern**: Use existing `Logger` class from `src/utils/logger.ts`
- **Integration**: Inject logger instance for consistent output formatting
- **Benefits**: Silent mode support, verbose debugging, unified error reporting

### **IMPORTANT**: Error Handling Pattern
- **Pattern**: Follow existing validation patterns from `src/utils/input-validation.ts`
- **Integration**: Throw descriptive errors with context information
- **Benefits**: Consistent error experience, clear debugging information

### **IMPORTANT**: File Loading Pattern
- **Pattern**: Mirror `loadAisanityConfig()` approach from `src/utils/config.ts`
- **Integration**: Graceful handling of missing files, YAML parse errors
- **Benefits**: Consistent file handling, predictable error behavior

## Implementation Guidance

### Phase 1: Core Interface Design
1. Define TypeScript interfaces for all workflow structures
2. Create comprehensive type guards for runtime validation
3. Establish error class hierarchy for different validation failures

### Phase 2: Parser Implementation
1. Implement file loading with graceful error handling
2. Create YAML parsing with line number tracking
3. Build validation engine with detailed error reporting

### Phase 3: Integration Layer
1. Integrate with existing logger utility
2. Add workspace root detection logic
3. Implement caching for performance optimization

### Critical Implementation Details

#### Error Message Strategy
- Include line numbers for YAML syntax errors
- Provide field paths for validation failures (e.g., `workflows.my-workflow.states.build.command`)
- Suggest corrections for common mistakes
- Use consistent error formatting across all validation types

#### Performance Considerations
- Cache parsed workflows during single execution
- Lazy validation - only validate workflows being executed
- Minimal memory footprint for large workflow files
- Fast startup to meet <500ms requirement

#### Security Considerations
- Validate all command strings against injection patterns
- Restrict file system access to workspace boundaries
- Sanitize all user-provided template variables
- Validate timeout values to prevent resource exhaustion

### Schema Validation Rules

#### Workflow Level
- `name`: Required, string, valid identifier pattern
- `initialState`: Required, must exist in states
- `states`: Required, object, minimum 1 state

#### State Level
- `command`: Required, non-empty string
- `timeout`: Optional, positive integer, reasonable bounds
- `transitions`: Required, at least one valid transition

#### Transition Level
- Target states must exist in workflow
- No circular dependencies without timeout handling
- All transition paths must eventually terminate

### Testing Strategy
- Unit tests for all validation rules
- Integration tests with malformed YAML files
- Performance tests for large workflow definitions
- Error message accuracy and clarity validation

## Considerations

### Security
- Command injection prevention through strict validation
- Path traversal protection in template variables
- Timeout enforcement to prevent hanging workflows
- Input sanitization for all user-provided data

### Performance
- Sub-100ms parsing time for typical workflow files
- Memory-efficient validation for large definitions
- Minimal startup overhead to meet feature requirements
- Lazy loading of workflow components when possible

### Maintainability
- Clear separation between parsing and validation logic
- Extensible schema for future workflow features
- Comprehensive error messages for debugging
- Consistent patterns with existing aisanity utilities

### Scalability
- Support for complex multi-step workflows
- Efficient handling of multiple named workflows
- Reasonable limits on workflow complexity
- Performance that scales with workflow size

This architecture provides a solid foundation for the workflow state machine while maintaining consistency with existing aisanity patterns and meeting all specified requirements.