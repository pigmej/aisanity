## Feature:  Workflow State Machine Executor

**Core Concept:** Build an workflow executor that transforms YAML workflow definitions into executable state machines with proper exit code routing.

### Key Requirements:
- **YAML Workflows:** Load from `.aisanity-workflows.yml`
- **FSM:** Build a finite state machine (FSM) from the YAML workflow definitions
- **Exit Code Routing:** Transitions based on command exit codes (0→success, 1→error, etc.)
- **TUI Support:** Handle interactive programs (vim, editors) with full terminal access
  - needs to be done without polluting the other terminal state, so the confirmation CANNOT be done with readline or others as it seriously impacts the TUI performance later: the working solution is `bash -c 'read -p "Continue? [y/N]: " -n 1 answer; echo; [[ "$answer" =~ ^[Yy]$ ]] && exit 0 || exit 1'` as a subprocess (should be configurable but it should be based on exit code basically) (it's ok to propose a different solution BUT inform me about that clearly)
- **CLI Interface:** `aisanity state execute <workflow_name> <state> [args]`
- **Argument Templating:** `{branch}` → actual values
  - need to be passed to all commands during the execution
  - arbitrary parameters passed from CLI like `--param1 value1 --param2 value2`
- **Confirmation System:** User prompts with `--yes` override
- **Modes:** Default (workflow sequence) vs `--single` (one state only)
- **Error Handling:** No retries, clear error messages
- **Timeouts:** Per-state configuration in milliseconds
  - must be possibility to disable timeout completely by setting timeout to 0
- **Simple:** No complex logic, easy to understand and maintain do not overcomplicate it.

### Critical User Experience:
- Commands actually execute and produce results
- Clear progress display and state transitions
- TUI programs work seamlessly
  - it's ok to have them set manually via `tui: true` or something.
- Fast startup time (<500ms)
- Intuitive CLI with helpful error messages

### Technical Constraints:
- TypeScript with XState v5
- No state persistence (design for future extension)
- No transition history tracking (design for future extension)
- Must integrate with existing aisanity codebase
- Configuration via single `.aisanity-workflows.yml` file
- Must support multiple named workflows per file (no cross workflow references though)

### Success Criteria:
1. Users can define workflows in YAML
2. Users can execute workflows: `aisanity state execute feature-development setup --branch feature/api`
3. Commands execute with proper exit code routing
4. TUI programs work seamlessly (vim, editors)
5. Timeouts trigger correctly
6. Clear output for all state transitions
7. `--yes` flag skips all confirmations
8. `--single` flag executes only specified state
9. Argument templating works with validation

This gives you the essential requirements stripped of the implementation complexity that accumulated in the previous attempt. Focus on making commands actually execute and workflows actually work through the complete state sequence.
