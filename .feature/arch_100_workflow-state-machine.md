# Workflow State Machine Architecture

## Key Architectural Decisions

### **IMPORTANT**: Custom Finite State Machine Implementation
- Decision: Build lightweight FSM engine instead of using XState v5
- Rationale: Performance requirements (<500ms startup), simplicity, and no external dependencies
- Impact: Reduced bundle size, faster execution, but requires custom state management logic

### **IMPORTANT**: YAML-First Workflow Configuration
- Decision: Use `.aisanity-workflows.yml` as single source of truth for workflow definitions
- Rationale: Human-readable, version-controllable, follows existing aisanity patterns
- Impact: Easy workflow creation and modification, but requires robust YAML parsing and validation

### **IMPORTANT**: Bash Subprocess for TUI Interactions
- Decision: Use `bash -c 'read -p "Continue? [y/N]: " -n 1 answer; echo; [[ "$answer" =~ ^[Yy]$ ]] && exit 0 || exit 1'` pattern
- Rationale: Avoids terminal pollution with readline libraries, ensures clean TUI program execution
- Impact: Reliable TUI support but limited to bash-compatible environments

### **IMPORTANT**: Exit Code-Based State Transitions
- Decision: Route state transitions based on command exit codes (0 = success, non-zero = failure paths)
- Rationale: Standard Unix convention, simple and predictable behavior
- Impact: Clear success/failure semantics but limited to binary outcomes without custom exit code mapping

### **IMPORTANT**: No State Persistence
- Decision: Design for single-run execution without state persistence or recovery
- Rationale: Simplicity requirement, future extensibility consideration
- Impact: Faster execution, simpler implementation, but no resume capability

## Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **FSM Engine** | Custom TypeScript implementation | Performance, no external dependencies, tailored to requirements |
| **YAML Parser** | `yaml` (existing dependency) | Consistent with existing codebase, reliable parsing |
| **CLI Framework** | `commander` (existing dependency) | Follows existing aisanity command patterns |
| **Terminal Colors** | `picocolors` (existing dependency) | Consistent user experience across commands |
| **Process Execution** | Bun's `$` and `Bun.spawn` | Native Bun runtime integration, optimal performance |
| **Argument Templating** | Custom string replacement | Simple `{branch}` substitution, lightweight implementation |

## System Components

### Core Components
- **WorkflowParser**: Loads and validates `.aisanity-workflows.yml` files
- **StateMachine**: Custom FSM engine handling state transitions and execution flow
- **CommandExecutor**: Executes commands with proper exit code capture and TUI support
- **ArgumentTemplater**: Handles `{branch}` substitution and CLI parameter passing
- **ConfirmationHandler**: Manages user prompts with `--yes` override capability
- **TimeoutManager**: Enforces per-state timeout configurations
- **StateCommand**: CLI command interface (`aisanity state execute <workflow> <state> [args]`)

### Integration Components
- **Logger Integration**: Uses existing aisanity logging utilities
- **Config Integration**: Leverages existing configuration loading patterns
- **Container Integration**: Integrates with existing devcontainer management

## Integration Strategy

The workflow state machine integrates seamlessly with existing aisanity systems by following established patterns. It uses the same CLI framework (commander), logging utilities, and configuration loading mechanisms as other commands. The FSM engine operates as a standalone service that can be invoked through the CLI, maintaining consistency with the existing command structure while providing powerful workflow automation capabilities.

## Critical Constraints

### Performance Requirements
- **Startup Time**: <500ms for workflow initialization and execution start
- **Memory Usage**: Minimal footprint with no heavy dependencies
- **Execution Speed**: Fast state transitions with minimal overhead

### Security Requirements
- **Command Injection Prevention**: Validate all templated arguments before execution
- **Path Traversal Protection**: Restrict file system access within workspace boundaries
- **Timeout Enforcement**: Prevent infinite loops or hanging commands

### Scalability Requirements
- **Workflow Complexity**: Support for multi-step workflows without performance degradation
- **Concurrent Execution**: Single workflow instance per execution (no parallelism required)
- **Configuration Size**: Handle reasonably sized YAML files efficiently

## Decomposition Guidance

### Logical Task Boundaries

1. **YAML Parser & Validator** (Priority: High)
   - Schema definition and validation
   - Error handling and user-friendly messages
   - Support for multiple named workflows

2. **Core FSM Engine** (Priority: High)
   - State definition and transition logic
   - Event handling and state management
   - Execution context management

3. **Command Execution Layer** (Priority: High)
   - Process spawning and monitoring
   - Exit code capture and routing
   - TUI program support via bash subprocess

4. **Argument & Template System** (Priority: Medium)
   - `{branch}` substitution engine
   - CLI parameter passing to all commands
   - Input validation and sanitization

5. **User Interaction System** (Priority: Medium)
   - Confirmation prompts with bash subprocess approach
   - `--yes` flag implementation
   - Progress indication and status reporting

6. **Timeout & Error Management** (Priority: Medium)
   - Per-state timeout enforcement
   - Graceful error handling and cleanup
   - Clear error messaging and exit codes

7. **CLI Integration** (Priority: Low)
   - Command registration and argument parsing
   - Help system and usage documentation
   - Integration with existing aisanity patterns

For detailed research and alternatives, see: arch_100_research.md