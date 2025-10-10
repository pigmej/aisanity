# Feature: XState-Based Workflow State Machine Executor

**Feature ID:** 100
**Created:** 2025-10-10
**Status:** Draft

## Problem Statement
Aisanity currently lacks automated workflow execution capabilities. Users need to manually orchestrate git operations, container management, and development tasks. A state machine-based executor would enable:
- Automated, repeatable workflows
- Clear workflow visualization and debugging
- Error handling and recovery
- User-configurable workflow definitions

## Feature Description
Implement an XState-based state machine executor that allows users to define workflows in YAML and execute them via CLI. The system will:

1. Load workflow definitions from `.aisanity-workflows.yml`
2. Parse YAML into XState machine definitions
3. Execute states with shell/TUI command support
4. Route transitions based on command exit codes (0, 1, 130, etc.)
5. Support named argument templating for commands
6. Provide user confirmation prompts with `--yes` override
7. Handle timeouts and errors without retries
8. Support both single-state and multi-state execution modes
9. Work with interactive TUI programs (vim, editors, etc.)

## Requirements

### Functional Requirements
- FR1: Load workflow definitions from `.aisanity-workflows.yml`
- FR2: Support dynamic, user-defined states (no hardcoded states)
- FR3: Each state must have a unique identifier
- FR4: States transition based on command exit codes (0→success, 1→error, 130→abort, etc.)
- FR5: Support named argument templating: `{branch}` → actual value
- FR6: Execute shell commands with proper stdio handling
- FR7: Execute TUI programs (vim, git commit editor, etc.) with full terminal access
- FR8: Support user confirmation per transition (y/N prompts)
- FR9: Support `--yes` CLI flag to auto-confirm all transitions
- FR10: Support `--single` CLI flag to execute only specified state
- FR11: Default mode executes series of states (workflow sequence)
- FR12: Configure timeout per state (in milliseconds)
- FR13: Handle command errors and timeouts without retries
- FR14: Clear, concise output for all transitions and errors
- FR15: Allow triggering any state directly: `aisanity state execute <workflow> <state> [args]`
- FR16: Validate arguments against state definition
- FR17: Ignore extra arguments not defined in state
- FR18: Clear error message when no transitions available

### Non-Functional Requirements
- NFR1: TypeScript implementation for type safety
- NFR2: XState v5 for state machine management
- NFR3: YAML parser for configuration
- NFR4: Fast startup time (<500ms)
- NFR5: Minimal dependencies beyond XState
- NFR6: Extensible architecture for future state persistence
- NFR7: Comprehensive error messages with actionable guidance
- NFR8: No transition history tracking (initially, design for future extension)
- NFR9: No state persistence (initially, design for future extension)

## Expected Outcomes

### Success Criteria
1. Users can define workflows in YAML
2. Users can execute workflows: `aisanity state execute feature-development setup --branch feature/api`
3. Commands execute with proper exit code routing
4. TUI programs work seamlessly (vim, editors)
5. Timeouts trigger correctly
6. Clear output for all state transitions
7. `--yes` flag skips all confirmations
8. `--single` flag executes only specified state
9. Argument templating works with validation

### User Experience
- Clear workflow execution progress
- Understandable error messages
- Fast command execution
- No unexpected behavior

## Scope

### In Scope
- XState integration and setup
- YAML workflow configuration parser
- CLI command: `aisanity state execute <workflow> <state> [args]`
- Command executor with shell/TUI support
- Exit code-based transition routing
- Argument templating and validation
- User confirmation system
- Timeout handling
- Error handling (no retries)
- Output formatting
- CLI flags: `--yes`, `--single`

### Out of Scope
- State persistence (future iteration)
- Transition history tracking (future iteration)
- Workflow visualization UI (future iteration)
- Remote workflow execution (future iteration)
- Workflow templates/marketplace (future iteration)
- Automatic retry logic
- State rollback mechanisms (initially)

## Additional Context

### Key Agreements from User Input
1. **Exit Codes Matter**: Different transitions for exit code 0, 1, 130, etc.
2. **No Retries**: Explicit requirement - handle errors once
3. **TUI Support is Critical**: Must work with editors, interactive tools
4. **CLI Command Structure**: `aisanity state execute` (not `aisanity run`)
5. **Named Arguments Only**: Templating with `{arg}` notation
6. **Ignore Extra Args**: If command doesn't define `--bar`, ignore it
7. **Clear Output**: User experience is priority
8. **--single vs Default**: Default runs sequence, `--single` runs one state
9. **Timeout Configuration**: Per-state milliseconds
10. **No State Persistence Initially**: Design for it, but don't implement yet

### Technical Constraints
- Must work with existing aisanity TypeScript codebase
- Must not interfere with current commands (worktree, etc.)
- Configuration file: `.aisanity-workflows.yml` (single file)
- XState v5 (latest stable)

### Design Considerations
- Keep state machine definitions simple and readable
- Design for future persistence without implementing it
- Design for future history tracking without implementing it
- Extensible architecture for future workflow visualization
- Clear separation: YAML parser → XState machine → Executor

## Architecture Reference
See: `./.feature/arch_100.md` for architectural analysis