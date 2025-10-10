# Architecture: XState-Based Workflow State Machine Executor

**Feature ID:** 100
**Created:** 2025-10-10
**Status:** Draft

## Key Architectural Decisions

### **IMPORTANT: XState Machine Structure**
Use XState `invoke` with services for command execution rather than pure state transitions. This provides:
- Proper async handling for long-running processes
- Built-in timeout support
- Clean error boundaries
- Event-driven exit code handling

### **IMPORTANT: Command Execution Strategy**
Use Node.js `child_process.spawn()` with `stdio: 'inherit'` for TUI programs and `stdio: 'pipe'` for shell commands. This ensures:
- Full terminal access for interactive programs (vim, git commit)
- Capturable output for non-interactive commands
- Proper signal handling and exit code capture

### **IMPORTANT: TUI Process Handling**
Implement TUI detection via command patterns and explicit configuration. Use `stdio: 'inherit'` with `detached: false` to:
- Pass through all terminal control sequences
- Maintain terminal state during execution
- Handle Ctrl+C and other signals properly

### **IMPORTANT: Exit Code Routing Mechanism**
Map exit codes to XState events using a configurable routing table. This provides:
- Flexible exit code handling (0, 1, 130, etc.)
- User-configurable transitions per state
- Clear separation between command execution and state transitions

### **IMPORTANT: Configuration Validation Approach**
Use JSON Schema for YAML validation combined with TypeScript interfaces. This ensures:
- Early error detection in workflow definitions
- Type safety throughout the system
- Clear error messages for configuration issues

## Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| State Machine | XState v5 | Industry standard, TypeScript support, visual tools |
| YAML Parser | js-yaml | Stable, widely used, good error handling |
| Process Spawning | Node child_process | Native, no dependencies, full control |
| CLI Framework | Commander.js | Already in use, consistent with existing commands |
| Validation | JSON Schema + TypeScript | Early error detection, type safety |
| Output Formatting | picocolors | Already in use, consistent styling |

## System Components

### Core Components
- **WorkflowLoader** - Parse and validate YAML workflow definitions
- **StateMachineBuilder** - Convert YAML to XState machine definitions
- **CommandExecutor** - Spawn and manage shell/TUI processes
- **ExitCodeRouter** - Map exit codes to state transitions
- **ArgumentMapper** - Template and validate command arguments
- **StateExecutionOrchestrator** - Coordinate workflow execution
- **OutputFormatter** - Provide clear, concise user feedback

### CLI Components
- **StateCommand** - Main CLI command handler
- **ArgumentParser** - Parse and validate CLI arguments
- **ConfirmationHandler** - Manage user confirmations

## Integration Strategy

The state machine executor integrates as a new command group under `src/commands/state-*.ts`. It reuses existing configuration utilities from `src/commands/utils/config.ts` and maintains independence from worktree commands. The system loads workflows from `.aisanity-workflows.yml` in the project root, following the existing configuration pattern.

## Critical Constraints

### Performance Constraints
- Startup time < 500ms for workflow loading
- Command execution overhead < 50ms
- Memory usage < 50MB for typical workflows

### Security Constraints
- No command injection vulnerabilities in argument templating
- Proper argument sanitization for shell commands
- Safe handling of user input in confirmations

### Usability Constraints
- Clear error messages with actionable guidance
- No retries - single execution only
- TUI support mandatory - full stdio inheritance
- Synchronous execution - no parallel states

### Future-Proofing Constraints
- Design for state persistence without implementing it
- Design for transition history tracking without implementing it
- Extensible architecture for future workflow visualization

## Decomposition Guidance

### Phase 1: Foundation (Independent Components)
1. **YAML Parser + Validation** - Independent, testable component
2. **Argument Templating System** - Pure functions, easy to test
3. **CLI Command Structure** - Basic command setup without execution

### Phase 2: Core Execution (Dependent Components)
4. **Command Executor** - Independent but needs TUI testing
5. **XState Machine Builder** - Depends on YAML parser
6. **Exit Code Router** - Depends on machine builder and executor

### Phase 3: Integration (Orchestration)
7. **State Execution Orchestrator** - Depends on all core components
8. **Confirmation Handler** - Integration with orchestrator
9. **Output Formatting** - Final integration layer

### Phase 4: Testing & Polish
10. **Integration Tests** - End-to-end workflow testing
11. **Error Handling** - Comprehensive error scenarios
12. **Documentation** - User guides and examples

### Implementation Priority
1. Start with simple shell commands (no TUI)
2. Add exit code routing
3. Implement argument templating
4. Add TUI support
5. Add confirmation system
6. Add timeout handling
7. Polish error messages and output

---

For detailed research and alternatives, see: `arch_100_research.md`