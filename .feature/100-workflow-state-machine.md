# Feature: Workflow State Machine Executor

**Feature ID:** 100
**Created:** 2025-01-20
**Status:** Draft

## Problem Statement
Users need to automate complex development workflows within aisanity containers, including multi-step processes like feature development, testing, and deployment sequences. Currently, users must manually execute each command and track state transitions, leading to errors and inconsistent processes.

## Feature Description
Build a workflow executor that transforms YAML workflow definitions into executable state machines with proper exit code routing. The system will handle interactive TUI programs without terminal pollution, support argument templating, and provide both sequential workflow execution and single-state execution modes.

Key components include:
- YAML workflow configuration via `.aisanity-workflows.yml`
- Custom finite state machine (FSM) engine (no XState dependency)
- Command executor with TUI support using bash subprocess approach
- Exit code-based state transitions
- Argument templating system with `{branch}` substitution
- Confirmation system with `--yes` override
- Per-state timeout configuration (0 to disable)
- CLI interface: `aisanity state execute <workflow_name> <state> [args]`

## Requirements

### Functional Requirements
1. **YAML Workflow Definition**: Load and parse workflows from `.aisanity-workflows.yml`
2. **FSM Engine**: Custom finite state machine implementation without XState
3. **Command Execution**: Execute commands with proper exit code capture and routing
4. **TUI Support**: Handle interactive programs (vim, editors) without terminal pollution using bash subprocess: `bash -c 'read -p "Continue? [y/N]: " -n 1 answer; echo; [[ "$answer" =~ ^[Yy]$ ]] && exit 0 || exit 1'`
5. **State Transitions**: Route between states based on command exit codes
6. **Argument Templating**: Substitute `{branch}` and pass CLI parameters to all commands
7. **Confirmation System**: User prompts with configurable bypass via `--yes` flag
8. **Timeout Management**: Per-state configurable timeouts in milliseconds (0 = disabled)
9. **Execution Modes**: Default sequential workflow vs `--single` state-only execution
10. **Multiple Workflows**: Support multiple named workflows in single YAML file

### Non-Functional Requirements
1. **Performance**: Startup time <500ms
2. **Simplicity**: No complex logic, easy to understand and maintain
3. **Integration**: Seamless integration with existing aisanity codebase
4. **No Persistence**: No state persistence or transition history tracking (design for future extension)
5. **Error Handling**: Clear error messages, no retries
6. **CLI Experience**: Intuitive interface with helpful error messages

### Technical Requirements
1. **TypeScript**: Implementation in TypeScript following existing patterns
2. **Dependencies**: Use existing dependencies (yaml, commander, picocolors)
3. **Architecture**: Follow existing aisanity command structure and patterns
4. **Configuration**: Single `.aisanity-workflows.yml` file for workflow definitions
5. **No Cross-Workflow References**: Workflows are self-contained

## Expected Outcomes
1. Users can define complex development workflows in YAML format
2. Workflows execute reliably with proper state transitions based on command results
3. TUI programs (vim, editors) work seamlessly without terminal state pollution
4. Fast startup and execution with clear progress indication
5. Flexible execution modes for both complete workflows and individual states
6. Robust error handling with actionable error messages
7. Seamless integration with existing aisanity container management

## Scope

### In Scope
- YAML workflow parser and validator
- Custom FSM engine implementation
- Command executor with TUI support
- Argument templating system
- Confirmation system with bash subprocess approach
- Timeout management
- CLI command integration
- Error handling and logging
- Basic workflow examples

### Out of Scope
- State persistence and recovery
- Transition history tracking
- Cross-workflow references or dependencies
- Complex parallel execution
- Web-based workflow management
- Visual workflow editors
- Advanced retry mechanisms
- Workflow scheduling or triggers

## Additional Context
- **TUI Handling**: Must use bash subprocess approach for confirmations to avoid terminal pollution with readline or similar libraries
- **Custom FSM**: Decision to avoid XState v5 for performance and simplicity reasons
- **Existing Integration**: Must leverage existing aisanity utilities (Logger, config loading, etc.)
- **File Structure**: Follow existing patterns in `src/commands/` and `src/utils/`
- **Testing**: Comprehensive test coverage following existing test patterns
- **Documentation**: Clear examples and usage documentation

## Architecture Reference
See: `./.feature/arch_100_workflow-state-machine.md` for architectural analysis
