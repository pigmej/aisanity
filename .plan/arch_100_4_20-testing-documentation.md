# Testing Documentation Architecture

## Context Analysis

This task focuses on creating comprehensive test coverage and documentation for the workflow state machine system (Feature 100). The system consists of multiple integrated components including YAML workflow parsing, FSM engine, command execution, argument templating, confirmation handling, and CLI integration. 

The testing strategy must validate:
- **Performance Requirements**: <500ms startup time for workflow initialization
- **Component Integration**: All workflow components working together seamlessly
- **Error Handling**: Robust error scenarios across all components
- **Security**: Argument templating security and command validation
- **User Experience**: TUI support, confirmation flows, and CLI interactions
- **Documentation**: Clear examples and usage patterns for end users

## Technology Recommendations

### **IMPORTANT**: Leverage Existing Test Infrastructure
- **Test Framework**: Continue using Bun's built-in test runner (consistent with existing codebase)
- **Mock Management**: Extend existing MockManager pattern from `tests/helpers/mock-helpers.ts`
- **Test Utilities**: Build upon existing test-utils in `tests/workflow/helpers/test-utils.ts`
- **Fixtures**: Expand current fixture system in `tests/workflow/fixtures/`

### **IMPORTANT**: Documentation Strategy
- **Root-Level Documentation Pattern**: Follow existing project structure (README.md, DEVELOPMENT.md, CLI_EXAMPLES.md)
- **Workflow Documentation Files**: Create WORKFLOWS.md, WORKFLOW_EXAMPLES.md, WORKFLOW_REFERENCE.md in project root
- **Examples-Based Documentation**: Use real workflow examples from `.aisanity-workflows.yml`
- **Integration Documentation**: Focus on end-to-end usage patterns
- **Performance Documentation**: Include benchmarks and optimization guidance
- **Security Documentation**: Clear guidance on safe workflow patterns

### Test Coverage Strategy
- **Unit Tests**: Individual component testing (already largely complete)
- **Integration Tests**: Cross-component workflow execution
- **Performance Tests**: Startup time and execution speed validation
- **Security Tests**: Argument templating and command validation
- **End-to-End Tests**: Complete workflow scenarios
- **Error Scenario Tests**: Failure modes and recovery paths

## System Architecture

### Test Architecture Layers

```
Testing Architecture:
├── Unit Test Layer (Existing)
│   ├── Component-specific tests
│   ├── Mock-based isolation
│   └── Fast execution (<100ms per test)
├── Integration Test Layer (To Expand)
│   ├── Cross-component workflows
│   ├── Real command execution
│   └── State transition validation
├── Performance Test Layer (To Enhance)
│   ├── Startup time benchmarks
│   ├── Memory usage validation
│   └── Scalability testing
├── Security Test Layer (To Complete)
│   ├── Argument injection prevention
│   ├── Command validation
│   └── Path traversal protection
└── Documentation Layer (New)
    ├── Usage examples
    ├── Best practices
    └── Troubleshooting guides
```

### **IMPORTANT**: Documentation Architecture

```
Documentation Structure (Root-Level Files):
├── WORKFLOWS.md (User-Facing)
│   ├── Quick Start Guide
│   ├── Basic Workflow Examples
│   ├── CLI Usage Patterns
│   └── Common Use Cases
├── WORKFLOW_EXAMPLES.md (Comprehensive Examples)
│   ├── Development Workflows
│   ├── CI/CD Workflows
│   ├── Maintenance Workflows
│   └── Error Handling Patterns
└── WORKFLOW_REFERENCE.md (Technical Reference)
    ├── YAML Schema Reference
    ├── CLI Command Reference
    ├── State Configuration Options
    ├── Argument Templating Syntax
    ├── Error Codes and Handling
    ├── Performance Optimization
    └── Security Considerations

Note: Follows existing documentation pattern (README.md, DEVELOPMENT.md, CLI_EXAMPLES.md)
```

## Integration Patterns

### **IMPORTANT**: Test Integration Patterns

#### 1. Progressive Test Complexity
```typescript
// Pattern: Simple → Complex → Real-world
describe('Workflow Integration', () => {
  describe('Basic Workflows', () => {
    // Simple linear workflows
  });
  describe('Complex Workflows', () => {
    // Branching, error handling, timeouts
  });
  describe('Real-World Scenarios', () => {
    // Actual development workflows
  });
});
```

#### 2. **IMPORTANT**: Performance-First Testing
```typescript
// Pattern: Validate complete workflow system startup (<500ms requirement)
describe('Performance Requirements', () => {
  test('complete workflow system startup < 500ms', async () => {
    const startTime = performance.now();
    // 1. Load .aisanity-workflows.yml file
    const workflows = await loadWorkflows();
    // 2. Initialize parser and validate workflow
    const workflow = workflows.deploy;
    // 3. Create FSM instance
    const fsm = new StateMachine(workflow, logger);
    // 4. Prepare first state for execution
    await fsm.prepareInitialState();
    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(500);
  });
  
  test('FSM initialization < 20ms', async () => {
    // Component-level performance test
    const startTime = performance.now();
    const fsm = new StateMachine(mockWorkflow, logger);
    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(20);
  });
});
```

#### 3. Security Validation Integration
```typescript
// Pattern: Security tests integrated with functional tests
describe('Secure Argument Templating', () => {
  test('prevents injection while allowing valid patterns', async () => {
    // Test both security and functionality
  });
});
```

### Documentation Integration Patterns

#### 1. Example-Driven Documentation
- Use real workflow files as documentation examples
- Include both success and failure scenarios
- Provide copy-paste ready configurations

#### 2. Progressive Learning Path
- Start with simple workflows
- Build up to complex scenarios
- Include troubleshooting sections

#### 3. Performance Guidance
- Document performance characteristics
- Provide optimization tips
- Include benchmarking examples

## Implementation Guidance

### Phase 1: Test Coverage Completion

#### 1.1 Integration Test Expansion
**Priority**: High
**Files to Create/Enhance**:
- `tests/workflow/integration/complete-workflow.test.ts`
- `tests/workflow/integration/error-scenarios.test.ts`
- `tests/workflow/integration/tui-interaction.test.ts`
- `tests/workflow/integration/cli-integration.test.ts` (new - test state execute command)
- `tests/workflow/integration/workflow-discovery.test.ts` (new - test workflow listing)

**Key Test Scenarios**:
```typescript
// Complete workflow execution with real commands
test('executes full deployment workflow', async () => {
  // Use real npm commands or mocks that simulate real behavior
});

// Error handling and recovery
test('handles build failure and routes to cleanup', async () => {
  // Simulate build failure and verify cleanup execution
});

// TUI program interaction
test('handles interactive programs correctly', async () => {
  // Test with mock TUI programs using bash subprocess
});

// CLI command integration (state execute)
test('state execute command integrates correctly', async () => {
  // Test: aisanity state execute <workflow> <state> [args]
  // Verify CLI parsing, workflow loading, and execution
});

// --yes flag behavior across workflows
test('--yes flag bypasses all confirmations', async () => {
  // Test confirmation prompts are skipped with --yes
  // Verify workflow executes without user interaction
});

// Global vs per-state timeout interaction
test('per-state timeout overrides globalTimeout', async () => {
  // Verify state-specific timeout takes precedence
  // Verify globalTimeout applies when state timeout not set
});

// Multiple CLI argument templating
test('templates multiple CLI arguments', async () => {
  // Test: aisanity state execute deploy start --branch=main --env=prod
  // Verify {branch} and {environment} substitution
});
```

#### 1.2 **IMPORTANT**: Performance Test Enhancement
**Priority**: High
**Files to Enhance**:
- `tests/workflow/fsm-performance.test.ts` (expand existing)
- `tests/workflow/integration/performance-integration.test.ts` (new)

**Performance Validations**:
```typescript
// CRITICAL: End-to-end startup time validation (architecture requirement)
test('complete workflow system startup < 500ms', async () => {
  const startTime = performance.now();
  
  // 1. Load YAML workflow file
  const workflows = await loadWorkflows('.aisanity-workflows.yml');
  
  // 2. Parse and validate workflow structure
  const workflow = workflows.deploy;
  
  // 3. Initialize FSM with workflow definition
  const fsm = new StateMachine(workflow, logger);
  
  // 4. Prepare initial state for execution
  await fsm.prepareInitialState();
  
  const duration = performance.now() - startTime;
  expect(duration).toBeLessThan(500);
});

// Component-level FSM initialization
test('FSM initialization < 20ms', async () => {
  const startTime = performance.now();
  const fsm = new StateMachine(mockWorkflow, logger);
  const duration = performance.now() - startTime;
  expect(duration).toBeLessThan(20);
});

// YAML parser performance
test('workflow file parsing < 100ms', async () => {
  const startTime = performance.now();
  const workflows = await loadWorkflows('.aisanity-workflows.yml');
  const duration = performance.now() - startTime;
  expect(duration).toBeLessThan(100);
});

// Memory efficiency
test('maintains reasonable memory usage', async () => {
  const initialMemory = process.memoryUsage().heapUsed;
  await executeMultipleWorkflows(10);
  const finalMemory = process.memoryUsage().heapUsed;
  const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
  expect(memoryIncrease).toBeLessThan(50); // < 50MB increase
});
```

#### 1.3 Security Test Completion
**Priority**: Medium
**Files to Create**:
- `tests/workflow/security/command-injection.test.ts`
- `tests/workflow/security/path-traversal.test.ts`
- `tests/workflow/security/template-validation.test.ts`

#### 1.4 **IMPORTANT**: Workflow Parser Edge Cases
**Priority**: High
**Files to Enhance**:
- `tests/workflow/workflow-parser.test.ts` (expand existing)

**Additional Test Scenarios**:
```typescript
// Malformed YAML handling
test('handles invalid YAML syntax gracefully', async () => {
  // Test malformed YAML with helpful error messages
});

// Workflow metadata validation
test('validates workflow metadata fields', async () => {
  // Verify name, description, version fields validated
  // Test missing required fields
  // Test invalid metadata values
});

// Circular state reference detection
test('detects circular state transitions', async () => {
  // Verify A → B → A cycles are detected
});

// Missing state reference detection
test('detects references to non-existent states', async () => {
  // Verify transitions to undefined states are caught
});

// Workflow discovery and listing
test('discovers all workflows in .aisanity-workflows.yml', async () => {
  // Test workflow enumeration
  // Verify workflow names and metadata accessible
});
```

**Security Scenarios**:
```typescript
// Command injection prevention
test('blocks command injection attempts', async () => {
  const maliciousInputs = ['; rm -rf /', '&& cat /etc/passwd', '`whoami`'];
  // Verify all are blocked
});

// Allow legitimate development patterns
test('allows valid development workflows', async () => {
  const devPatterns = ['../../shared/config', '../node_modules/.bin'];
  // Verify these work correctly
});

// Path traversal protection
test('prevents path traversal attacks', async () => {
  const maliciousPaths = ['../../../../etc/passwd', '../../../.ssh/id_rsa'];
  // Verify paths outside workspace are blocked
});

// Template security with multiple parameters
test('validates all templated arguments for security', async () => {
  // Test {branch}, {environment}, etc. all get validated
  // Ensure injection attempts in any parameter are blocked
});
```

### Phase 2: Documentation Creation

#### 2.1 **IMPORTANT**: User-Facing Documentation
**Priority**: High
**Files to Create** (Root-Level, following existing pattern):
- `WORKFLOWS.md` - Main workflow guide with quick start
- `WORKFLOW_EXAMPLES.md` - Comprehensive real-world examples

**WORKFLOWS.md Structure**:
```markdown
# Aisanity Workflow System

## Quick Start

### Basic Workflow
```yaml
workflows:
  simple:
    name: "My First Workflow"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Hello World"]
        transitions:
          success: "end"
      end:
        command: "echo"
        args: ["Done"]
        transitions: {}
```

### Running Your Workflow
```bash
aisanity state execute simple start
```

## Common Patterns
- Linear workflows
- Branching workflows
- Error handling workflows
- Workflows with confirmations
- Argument templating patterns

See WORKFLOW_EXAMPLES.md for comprehensive examples.
See WORKFLOW_REFERENCE.md for complete technical reference.
```

**Note**: This follows the existing documentation pattern seen in README.md, DEVELOPMENT.md, CLI_EXAMPLES.md, INSTALLATION.md

**Documentation Integration**:
- Update README.md to reference new WORKFLOWS.md
- Update DEVELOPMENT.md to mention workflow testing patterns
- Update AGENTS.md to include workflow documentation files
- Ensure consistent style and formatting with existing docs

#### 2.2 **IMPORTANT**: Comprehensive Examples Documentation
**Priority**: High
**Files to Create** (Root-Level):
- `WORKFLOW_EXAMPLES.md` - Real-world workflow examples

**WORKFLOW_EXAMPLES.md Structure**:
```markdown
# Workflow Examples

## Development Workflows
- Local development setup
- Testing workflows
- Build and deployment

## CI/CD Workflows
- Continuous integration
- Automated deployment
- Release workflows

## Maintenance Workflows
- Cleanup operations
- Backup and restore
- Health checks

## Error Handling Patterns
- Build failure recovery
- Timeout handling
- Cleanup on failure
```

#### 2.3 **IMPORTANT**: Technical Reference Documentation
**Priority**: Medium
**Files to Create** (Root-Level):
- `WORKFLOW_REFERENCE.md` - Complete technical reference

**WORKFLOW_REFERENCE.md Structure**:
```markdown
# Workflow System Reference

## YAML Schema Reference
- State configuration options
- Transition definitions
- Timeout settings

## CLI Command Reference
- aisanity state execute
- Command options and flags
- --yes flag behavior

## Argument Templating Syntax
- {branch} substitution
- CLI parameter passing
- Security considerations

## Error Codes and Handling
- Exit code meanings
- Error routing patterns
- Timeout behavior

## Performance Optimization
- <500ms startup requirement
- Best practices for fast workflows
- Memory efficiency tips

## Security Considerations
- Command injection prevention
- Path traversal protection
- Safe templating patterns
```

### Phase 3: Integration and Validation

#### 3.1 End-to-End Test Scenarios
**Priority**: High
**Test Categories**:
- **Development Workflows**: Local development scenarios
- **CI/CD Workflows**: Build, test, deploy pipelines
- **Maintenance Workflows**: Cleanup, backup, restore operations
- **Error Recovery**: Failure handling and rollback scenarios

#### 3.2 Documentation Validation
**Priority**: Medium
**Validation Approach**:
- Test all documentation examples
- Verify copy-paste functionality
- Include troubleshooting scenarios
- Add performance benchmarks to documentation

### **IMPORTANT**: Prior Task Integration Testing

This task validates implementations from all prior workflow tasks:

#### Testing 100_1_10 (YAML Workflow Parser)
- Test `loadWorkflows()` from workflow parser implementation
- Validate schema validation and error handling
- Test workflow discovery and metadata extraction
- Verify malformed YAML handling

#### Testing 100_1_20 (FSM Core Engine)
- Test `StateMachine` class from FSM implementation
- Validate state transitions and exit code routing
- Test execution context management
- Verify FSM initialization performance (<20ms)

#### Testing 100_2_10 (Command Executor TUI)
- Test command execution with bash subprocess pattern
- Validate TUI program handling
- Test exit code capture
- Verify stdout/stderr handling

#### Testing 100_2_20 (Argument Templating System)
- Test `ArgumentTemplater` security validations
- Validate {branch} and multi-parameter substitution
- Test injection prevention patterns
- Verify CLI parameter passing

#### Testing 100_3_10 (Confirmation Timeout System)
- Test confirmation prompts with bash subprocess
- Validate --yes flag bypass behavior
- Test timeout enforcement
- Verify globalTimeout vs state timeout interaction

#### Testing 100_3_20 (CLI Command Integration)
- Test `aisanity state execute` command integration
- Validate argument parsing and workflow invocation
- Test error reporting to CLI
- Verify help system integration

#### Testing 100_4_10 (Error Handling Logging)
- Test all error types from error-handler.ts
- Validate WorkflowError, TimeoutError, ValidationError handling
- Test error context and logging integration
- Verify graceful error recovery

### Critical Implementation Considerations

#### **IMPORTANT**: Performance Requirements
- All tests must validate <500ms complete system startup time
- Test end-to-end: YAML load → parse → FSM init → first state prep
- Performance tests should run in CI/CD pipeline
- Include regression tests for performance degradation

#### **IMPORTANT**: Security Validation
- Test both security blocking and legitimate use cases
- Validate development workflow flexibility
- Ensure core system protections remain intact
- Test all argument templating parameters for security

#### **IMPORTANT**: Documentation Accuracy
- All examples must be tested and functional
- Include both success and failure scenarios
- Provide clear troubleshooting guidance
- Document performance characteristics

#### **IMPORTANT**: Test Maintainability
- Follow existing test patterns and mock management
- Use descriptive test names and clear assertions
- Ensure tests run independently and deterministically
- Leverage existing MockManager and test-utils patterns

### Success Criteria

1. **Test Coverage**: 95%+ coverage for all workflow components
2. **Performance Validation**: All performance requirements met and documented
3. **Security Validation**: All security scenarios tested and documented
4. **Documentation Quality**: Complete, accurate, and example-driven documentation
5. **Integration Validation**: All component interactions tested and documented
6. **User Experience**: Clear guidance for workflow creation and usage

This architecture ensures comprehensive testing and documentation while maintaining alignment with the existing codebase patterns and performance requirements.