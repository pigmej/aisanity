# Task: Fix Dry-Run Functionality for CLI Commands

**Task ID:** 100_3_30
**Parent Feature:** 100 - See `./.feature/100-workflow-state-machine.md`
**Feature Architecture:** `./.feature/arch_100_workflow-state-machine.md`
**Created:** 2025-01-20
**Priority:** high
**Implementation Phase:** 3

## Problem Statement

The dry-run functionality in the CLI command integration (Task 100_3_20) is not working correctly. Users see incomplete output with "undefined" values instead of a meaningful execution preview.

## Description

Fix the `--dry-run` functionality in `aisanity state execute` command to provide users with a comprehensive preview of what would be executed, including state execution details, timing information, and template variables. Currently returns "undefined" values and lacks execution details.

## Requirements

- Fix dry-run result structure to include proper finalState and totalDuration
- Show execution plan with state-by-state breakdown
- Display processed template variables and context
- Provide meaningful execution preview without running actual commands
- Maintain consistency with the dry-run concept described in the original plan
- Ensure dry-run output is useful for user decision-making

## Expected Outcome

Users can run `aisanity state execute <workflow> --dry-run` and get a comprehensive preview showing:
- Which states would execute in order
- Estimated timing information
- Template variables that would be used
- Final state that would be reached
- Clear indication of what commands would run

## Dependencies

- StateMachine integration for execution plan retrieval
- Template variable context access
- State execution timing simulation

## Integration Requirements

This task builds upon the CLI command integration and needs to integrate with StateMachine to provide execution previews.

**Prior Tasks This Builds Upon:**
100_1_20 - fsm-core-engine
100_3_20 - cli-command-integration

**Expected Integrations:**
- StateMachine execution plan methods
- Template variable context access
- CLI result reporting system

## Additional Suggestions

Consider adding:
- Color-coded output for better readability
- Progress indication for multi-state workflows
- Warning messages for potentially dangerous operations
- Summary statistics (total states, estimated time)

## Other Important Agreements

The dry-run functionality was acknowledged in the original plan as requiring StateMachine integration that wasn't fully implemented. This task addresses that gap to provide the complete user experience users expect for safely previewing workflow execution.

The implementation should prioritize user experience and provide enough detail for users to make informed decisions about whether to proceed with actual execution.