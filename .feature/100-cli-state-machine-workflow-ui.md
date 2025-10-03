# Feature: CLI State Machine Workflow UI

**Feature ID:** 100
**Created:** 2025-10-03
**Status:** Draft

## Problem Statement

Managing complex feature workflows manually is error-prone and tedious. The current workflow (feature → decomposition → tasks → planning → implementation) requires developers to:
- Manually track the state of each feature, phase, and task
- Remember which commands to run at each stage
- Keep mental context of what's complete and what's next
- Manually execute state transitions without guidance
- Lack visibility into the overall progress of multi-task features

This creates friction in the development process and increases cognitive load, especially when working on features with many tasks across multiple phases.

## Feature Description

Create a CLI-based workflow management system that implements a state machine for features and tasks. The system should:

1. **State Management**: Track the current state of features, phases, and tasks using a human-readable YAML state file (`.aisanity-state.yml`) that serves as both current state storage and full transition history audit log

2. **Workflow Configuration**: Define state machines via user-editable YAML configuration (`.aisanity-workflow.yml`) that specifies:
   - States for features and tasks
   - Commands to execute for each state transition
   - Exit code mappings to determine next state
   - Confirmation requirements per command

3. **Smart "Next" Command**: Implement `aisanity feature {id} next` and `aisanity task {id} next` that:
   - Finds the next pending action based on current state
   - Executes the configured command
   - Records transition with timestamp, exit code, and command in state file
   - Handles hierarchical navigation (feature → tasks in ID order)

4. **Manual State Control**: Allow explicit state transitions via `aisanity task {id} {state}` that runs the command transitioning to that state

5. **Status Visualization**: Pretty CLI output showing:
   - Feature/phase/task hierarchy with current states
   - Visual indicators for completed, in-progress, and pending items
   - Clear identification of next action
   - Phase grouping (1xx, 2xx tasks grouped together)

6. **Git Town Integration**: Automate branch creation using git town's stacked changes workflow:
   - Create hack branch per phase (not per feature)
   - Append task branches in ID order (stacked: 100_110 → 100_120 → 100_130)
   - Tasks without phase prefix branch from main

7. **Confirmation Flow**: Interactive prompts before executing commands with:
   - Display of command to be run
   - Y/n confirmation
   - Global and per-command configuration
   - CLI flag (`--yes`) to skip confirmation

8. **Audit Trail**: All state transitions logged in `.aisanity-state.yml` with full context (from/to states, commands, exit codes, timestamps)

## Requirements

### Functional Requirements
1. Parse and maintain `.aisanity-state.yml` (state database) and `.aisanity-workflow.yml` (workflow config)
2. Execute shell commands with variable substitution: `{id}`, `{title}`, `{feature_id}`, `{phase}`
3. Capture command exit codes and transition to appropriate next state
4. Support ID resolution: full names (`.feature/100-user-auth.md`) or short IDs (100) if unambiguous
5. Handle hierarchical "next" logic: feature → first pending task in ID order
6. Display clear error messages when no next action available or ID is ambiguous
7. Initialize new files to default state (`discovered` / `file_exists`) on first access
8. Support both manual state transitions and "goto" (future: jump without running command)

### Non-Functional Requirements
1. Human-readable YAML files (not JSON) for easy manual editing
2. Fast command execution (< 100ms for state lookup/update, excluding command execution time)
3. Clear, pretty CLI output with visual hierarchy
4. Shell command compatibility (must work with opencode, git, git-town commands)
5. Environment variable inheritance from caller process
6. Extensible design for future conditional transitions

### Technical Constraints
1. Node.js 24.x / TypeScript
2. Single `.aisanity-state.yml` file (merge conflict handling deferred)
3. Must integrate with existing aisanity CLI structure (src/commands/)
4. Follow existing code conventions (Commander.js, TypeScript strict mode)

## Expected Outcomes

1. **Developer Experience**: Developers can run `aisanity feature 100 next` repeatedly to step through entire feature workflow without remembering commands
2. **State Visibility**: Running `aisanity feature 100 status` shows clear picture of all tasks and their states
3. **Audit Trail**: Complete history of all state transitions in human-readable format
4. **Git Integration**: Branches automatically created in correct git-town stacked order
5. **Flexibility**: Workflow can be customized by editing `.aisanity-workflow.yml` without code changes
6. **Reduced Errors**: State machine ensures commands run in correct order, prevents invalid transitions

## Scope

### In Scope
- State machine implementation for features and tasks
- YAML-based state storage and workflow configuration
- CLI commands: `status`, `next`, manual state transitions
- Variable substitution in commands
- Exit code-based state transitions
- Confirmation prompts with skip option
- Git town integration (hack per phase, append for tasks)
- Basic visualization (tree view with state indicators)
- ID resolution (full names and short IDs)
- Transition history logging

### Out of Scope (Deferred to Future)
1. **Conditional transitions**: State transitions based on child object states (e.g., "move to ready only if all tasks completed")
2. **Phase-level state machine**: Explicit phase tracking and state (currently phases are ID prefixes only)
3. **Multi-user state file merging**: Conflict resolution when multiple developers modify state
4. **Dependency specification**: Explicit task dependencies beyond ID ordering
5. **Auto-sync on state changes**: Automatic git-town sync when upstream tasks change
6. **TUI (Terminal UI)**: Full-screen interactive interface (staying with simple CLI for now)
7. **Parallel task execution**: Running multiple tasks simultaneously
8. **State rollback/undo**: Reverting to previous states
9. **Web UI**: Browser-based visualization
10. **Remote state synchronization**: Sharing state across team

## Additional Context

### Design Decisions
- **Single state file**: Simplifies implementation, merge conflicts addressed later
- **ID ordering**: Earlier IDs must complete before later ones (enforced by git-town stacking)
- **Shell commands**: Provides maximum flexibility, all commands are shell-executable strings
- **YAML over JSON**: Human readability prioritized for state and config files
- **Phase = ID prefix**: 100_110, 100_120 are phase 1; 100_210, 100_220 are phase 2

### Workflow Integration
This feature integrates with the existing feature workflow documented in `opencode_config/FEATURE_WORKFLOW.md`:
- `/auto_feature` → creates feature file
- `/feature_decompose` → creates task files  
- `/auto_plan` → creates task plans
- This CLI UI orchestrates execution of these commands via state machine

### Git Town Stacking Example
```bash
# Feature 100, Phase 1
git town hack feature/100-phase-1
git town append feature/100_110-jwt
git town append feature/100_120-oauth  # stacked on 100_110

# Feature 100, Phase 2  
git town hack feature/100-phase-2
git town append feature/100_210-websocket
```

## Architecture Reference
See: `./.feature/arch_100.md` for architectural analysis
