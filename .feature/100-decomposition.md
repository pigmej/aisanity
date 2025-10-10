# Feature Decomposition Summary

**Feature ID:** 100
**Feature File:** `./.feature/100-xstate-workflow-executor.md`
**Architecture:** `./.feature/arch_100.md`
**Decomposed Date:** 2025-10-10
**Total Tasks:** 9

## Tasks Created

### 100_1_10: state-file-yaml-repository
- **File:** `./.task/100_1_10-state-file-yaml-repository.md`
- **Priority:** high
- **Phase:** 1
- **Dependencies:** None
- **Description:** Implement WorkflowLoader component that reads .aisanity-workflows.yml, validates structure using JSON Schema, and returns type-safe workflow definitions.

### 100_1_20: argument-template-mapper-validator
- **File:** `./.task/100_1_20-argument-template-mapper-validator.md`
- **Priority:** high
- **Phase:** 1
- **Dependencies:** None
- **Description:** Implement ArgumentMapper that performs template substitution and validation for command arguments with {placeholder} syntax.

### 100_2_10: workflow-config-yaml-loader
- **File:** `./.task/100_2_10-workflow-config-yaml-loader.md`
- **Priority:** high
- **Phase:** 2
- **Dependencies:** state-file-yaml-repository
- **Description:** Implement StateMachineBuilder that converts WorkflowDefinition objects into XState v5 machine configurations using the invoke pattern.

### 100_2_20: command-executor-shell-tui-support
- **File:** `./.task/100_2_20-command-executor-shell-tui-support.md`
- **Priority:** high
- **Phase:** 2
- **Dependencies:** None
- **Description:** Implement CommandExecutor that spawns processes using child_process.spawn() with intelligent stdio configuration for both shell and TUI programs.

### 100_2_30: exit-code-transition-router
- **File:** `./.task/100_2_30-exit-code-transition-router.md`
- **Priority:** high
- **Phase:** 2
- **Dependencies:** workflow-config-yaml-loader, command-executor-shell-tui-support
- **Description:** Implement ExitCodeRouter that translates exit codes into XState events and determines transition targets.

### 100_3_10: state-execution-orchestrator-integration
- **File:** `./.task/100_3_10-state-execution-orchestrator-integration.md`
- **Priority:** high
- **Phase:** 3
- **Dependencies:** workflow-config-yaml-loader, command-executor-shell-tui-support, argument-template-mapper-validator, exit-code-transition-router
- **Description:** Implement StateExecutionOrchestrator that coordinates all components for end-to-end workflow execution with support for single and multi-state modes.

### 100_3_20: user-confirmation-handler-yes-flag
- **File:** `./.task/100_3_20-user-confirmation-handler-yes-flag.md`
- **Priority:** medium
- **Phase:** 3
- **Dependencies:** state-execution-orchestrator-integration
- **Description:** Implement ConfirmationHandler that displays transition prompts and respects --yes flag to skip all confirmations.

### 100_3_30: cli-state-execute-command-structure
- **File:** `./.task/100_3_30-cli-state-execute-command-structure.md`
- **Priority:** high
- **Phase:** 3
- **Dependencies:** state-execution-orchestrator-integration, user-confirmation-handler-yes-flag
- **Description:** Implement state command group with execute subcommand following existing worktree command patterns.

### 100_3_40: output-formatter-error-messages
- **File:** `./.task/100_3_40-output-formatter-error-messages.md`
- **Priority:** medium
- **Phase:** 3
- **Dependencies:** cli-state-execute-command-structure
- **Description:** Implement OutputFormatter that provides clear, consistent, and actionable output for all workflow execution events and errors.

## Implementation Order

### Phase 1: Foundation (Independent Components)
- **100_1_10**: state-file-yaml-repository
- **100_1_20**: argument-template-mapper-validator

*These components have no dependencies and can be developed in parallel*

### Phase 2: Core Execution (Dependent Components)
- **100_2_10**: workflow-config-yaml-loader (depends on 100_1_10)
- **100_2_20**: command-executor-shell-tui-support (independent)
- **100_2_30**: exit-code-transition-router (depends on 100_2_10, 100_2_20)

*Core execution components build on Phase 1 foundations*

### Phase 3: Integration (Orchestration)
- **100_3_10**: state-execution-orchestrator-integration (depends on all Phase 1 & 2)
- **100_3_20**: user-confirmation-handler-yes-flag (depends on 100_3_10)
- **100_3_30**: cli-state-execute-command-structure (depends on 100_3_10, 100_3_20)
- **100_3_40**: output-formatter-error-messages (depends on 100_3_30)

*Integration components coordinate all prior work into cohesive user experience*

## Architectural Consistency

This decomposition maintains all key architectural decisions from `./.feature/arch_100.md`:

### Critical Architectural Decisions Preserved
- **XState v5 invoke pattern** for command execution (100_2_10, 100_3_10)
- **child_process.spawn()** with intelligent stdio handling (100_2_20)
  - `stdio: 'inherit'` for TUI programs
  - `stdio: 'pipe'` for shell commands
- **JSON Schema validation** for YAML structure (100_1_10)
- **Commander.js** CLI framework following existing patterns (100_3_30)
- **picocolors** for output formatting (100_3_40)

### Technology Stack Alignment
- XState v5 for state machine management
- js-yaml for YAML parsing
- Node child_process for process spawning
- Commander.js for CLI framework
- JSON Schema + TypeScript for validation
- picocolors for output formatting

### Constraints Respected
- **No retries**: Single execution only (100_2_20)
- **TUI support mandatory**: Full stdio inheritance (100_2_20)
- **Performance**: <500ms startup (100_3_30), <50ms overhead (100_3_10)
- **Security**: Command injection prevention (100_1_20)
- **Future-proofing**: Design for persistence without implementing (100_1_10, 100_2_10)

### Component Boundaries
Each task follows single responsibility principle:
- **Data Layer**: Workflow loading and validation (100_1_10)
- **Transform Layer**: YAML to XState conversion (100_2_10)
- **Execution Layer**: Command spawning and routing (100_2_20, 100_2_30)
- **Orchestration Layer**: Component coordination (100_3_10)
- **User Interface Layer**: CLI, confirmations, output (100_3_20, 100_3_30, 100_3_40)
- **Utility Layer**: Argument templating (100_1_20)

### Dependency Structure
The decomposition follows clear dependency phases:
- **Phase 1 (2 tasks)**: Zero dependencies - parallel development
- **Phase 2 (3 tasks)**: Minimal dependencies - workflow-config-yaml-loader depends on state-file-yaml-repository
- **Phase 3 (4 tasks)**: Full integration - sequential development with clear integration points

Each task is independently testable, maintains architectural consistency, and builds toward the complete feature while enabling incremental delivery.

## Next Steps

1. Review all generated tasks
2. Run auto_plan on each task to create detailed implementation plans:
   - `/auto_plan ./.task/100_1_10-state-file-yaml-repository.md @architect @sonnet`
   - `/auto_plan ./.task/100_1_20-argument-template-mapper-validator.md @architect @sonnet`
   - `/auto_plan ./.task/100_2_10-workflow-config-yaml-loader.md @architect @sonnet`
   - `/auto_plan ./.task/100_2_20-command-executor-shell-tui-support.md @architect @sonnet`
   - `/auto_plan ./.task/100_2_30-exit-code-transition-router.md @architect @sonnet`
   - `/auto_plan ./.task/100_3_10-state-execution-orchestrator-integration.md @architect @sonnet`
   - `/auto_plan ./.task/100_3_20-user-confirmation-handler-yes-flag.md @architect @sonnet`
   - `/auto_plan ./.task/100_3_30-cli-state-execute-command-structure.md @architect @sonnet`
   - `/auto_plan ./.task/100_3_40-output-formatter-error-messages.md @architect @sonnet`
3. Follow the implementation order specified above
4. Ensure each task maintains the feature architecture

## Notes
- All tasks reference the parent feature architecture
- Each task's plan will build upon the feature-level architecture
- Maintain architectural consistency across all implementations
- Phase 1 tasks can be implemented in parallel
- Phase 2 and 3 tasks should follow dependency order
- Integration testing should validate component interactions
- Performance constraints must be validated in each phase