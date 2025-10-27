# Architectural Analysis: CLI Command Integration

## Context Analysis

This task involves creating the user interface for the workflow state machine system by implementing a CLI command that integrates with the existing aisanity command structure. The command `aisanity state execute <workflow_name> <state> [args]` serves as the primary interface for users to interact with workflow execution, orchestrating all previously implemented components including the FSM engine, argument templating, confirmation system, and command executor.

The CLI command integration is critical because it provides the user-facing entry point for the entire workflow system, requiring seamless integration with existing aisanity patterns while exposing the full functionality of the underlying workflow components.

## Technology Recommendations

Based on the feature architecture and existing aisanity patterns, the following technology stack is recommended:

### Core Framework
- **Commander.js**: Already used throughout aisanity for CLI command structure
- **TypeScript**: For type safety and consistency with existing codebase
- **Bun Runtime**: For optimal performance and native process execution

### Integration Components
- **StateMachine**: Custom FSM engine from task 100_1_20
- **ArgumentTemplater**: Template substitution system from task 100_2_20
- **ConfirmationHandler**: User interaction system from task 100_3_10
- **CommandExecutor**: Process execution engine from task 100_2_10
- **WorkflowParser**: YAML parsing and validation from task 100_1_10

### Supporting Infrastructure
- **Logger**: Existing aisanity logging utilities
- **picocolors**: Consistent terminal output formatting
- **Error Handling**: Custom workflow error classes

## System Architecture

### Command Structure
```
aisanity state execute <workflow_name> <state> [args]
├── Command Registration (commander.js)
├── Argument Parsing & Validation
├── Workflow Loading (WorkflowParser)
├── State Machine Initialization (StateMachine)
├── Argument Templating (ArgumentTemplater)
├── State Execution (StateMachine.executeState)
├── Confirmation Handling (ConfirmationHandler)
├── Command Execution (CommandExecutor)
└── Result Reporting
```

### Component Integration Flow
1. **Command Entry Point**: Parse CLI arguments and options
2. **Workflow Resolution**: Load and validate workflow definition
3. **State Validation**: Ensure requested state exists in workflow
4. **Template Processing**: Apply argument templating with CLI parameters
5. **Execution Setup**: Initialize StateMachine with all dependencies
6. **State Execution**: Execute single state or full workflow based on context
7. **Result Handling**: Format and display execution results

### Data Flow Architecture
```
CLI Parameters → Template Variables → Command Substitution → State Execution → Result Output
     ↓                    ↓                    ↓                    ↓
Argument Validation → Variable Resolution → Security Validation → Process Execution → Error Handling
```

## Integration Patterns

### 1. Command Registration Pattern
Follow existing aisanity pattern of creating command objects in `src/commands/`:
- Export named command object (e.g., `stateCommand`)
- Use commander.js for argument parsing and option handling
- Integrate with main CLI in `src/index.ts`

### 2. Dependency Injection Pattern
Inject all workflow components into StateMachine:
- Pass executor, confirmation handler, and logger to constructor
- Use factory methods for component creation
- Maintain loose coupling between CLI and workflow components

### 3. Error Handling Pattern
Implement comprehensive error handling with actionable messages:
- Validate inputs before execution
- Catch and format workflow-specific errors
- Provide clear next steps for common failure scenarios

### 4. Option Handling Pattern
Follow aisanity conventions for CLI options:
- `--yes`: Bypass confirmation prompts
- `--verbose`: Enable detailed logging
- `--dry-run`: Show what would be executed without running
- `--help`: Display usage information

## Implementation Guidance

### Phase 1: Command Structure Setup
1. Create `src/commands/state.ts` with command definition
2. Implement basic argument parsing for workflow_name and state
3. Add standard aisanity options (--verbose, --help)
4. Register command in main CLI

### Phase 2: Core Integration
1. Integrate WorkflowParser for loading workflow definitions
2. Initialize StateMachine with proper dependencies
3. Implement argument templating with CLI parameter mapping
4. Add basic state execution functionality

### Phase 3: Advanced Features
1. Integrate ConfirmationHandler with --yes flag support
2. Add comprehensive error handling and validation
3. Implement help system and usage documentation
4. Add dry-run functionality for preview mode

### Phase 4: Polish and Testing
1. Add detailed logging and progress indication
2. Implement result formatting and reporting
3. Add integration tests for complete workflow
4. Performance optimization and error recovery

### Critical Implementation Details

#### IMPORTANT: Command Structure
The command must follow the exact pattern: `aisanity state execute <workflow_name> <state> [args]`
- `state`: Main command group for workflow operations
- `execute`: Subcommand for state execution
- `workflow_name`: Name of workflow from YAML definition
- `state`: Specific state to execute (optional - defaults to initial state)
- `args`: Additional arguments for template substitution

#### IMPORTANT: Error Handling Strategy
Implement layered error handling:
1. **Input Validation**: Validate workflow and state names before loading
2. **Workflow Validation**: Use existing WorkflowParser validation
3. **Execution Errors**: Catch and format StateMachine execution errors
4. **User-Friendly Messages**: Convert technical errors to actionable guidance

#### IMPORTANT: Integration Points
Ensure seamless integration with existing components:
- Use `StateMachine.fromWorkflowName()` factory method
- Pass CLI arguments through `ArgumentTemplater.processCommandArgs()`
- Handle `--yes` flag in `ConfirmationHandler` configuration
- Use existing `Logger` instance for consistent output formatting

#### IMPORTANT: Security Considerations
- Validate all CLI parameters before template substitution
- Use existing `TemplateValidator` for injection prevention
- Sanitize file paths and workspace references
- Implement proper error message sanitization

### File Structure
```
src/commands/
├── state.ts                 # Main state command implementation
└── state-execute.ts         # Execute subcommand (optional separation)

src/workflow/ (existing)
├── fsm.ts                   # StateMachine integration
├── argument-templater.ts    # CLI parameter processing
├── confirmation-handler.ts  # User interaction handling
└── executor.ts              # Command execution integration
```

### Testing Strategy
- Unit tests for command parsing and validation
- Integration tests with mock workflow definitions
- End-to-end tests for complete execution flows
- Error scenario testing for robustness

This architecture ensures the CLI command serves as an intuitive, secure, and performant interface to the workflow system while maintaining consistency with existing aisanity patterns and leveraging all previously implemented components.