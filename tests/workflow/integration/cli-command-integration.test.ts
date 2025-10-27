/**
 * CLI command integration tests
 * Tests for state execute command integration
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { executeStateOrWorkflow } from '../../../src/commands/state';
import { StateMachine } from '../../../src/workflow/fsm';
import { WorkflowParser } from '../../../src/workflow/parser';
import { CommandExecutor } from '../../../src/workflow/executor';
import { ConfirmationHandler } from '../../../src/workflow/confirmation-handler';
import { Logger } from '../../../src/utils/logger';
import { createTempDir, cleanupTempDir, createWorkflowFile } from '../helpers/test-utils';

describe('CLI Command Integration', () => {
  const logger = new Logger(true); // Silent mode for tests
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('state execute command', () => {
    test('should execute workflow from initial state', async () => {
      const workflowContent = `
workflows:
  cli-test:
    name: "CLI Test"
    description: "Test CLI execution"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Hello from CLI"]
        transitions:
          success: "end"
      end:
        command: "echo"
        args: ["Done"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['cli-test'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await executeStateOrWorkflow(fsm, undefined, {}, logger);

      expect(result.success).toBe(true);
      expect(result.finalState).toBe('end');
    });

    test('should execute specific state', async () => {
      const workflowContent = `
workflows:
  state-test:
    name: "State Test"
    description: "Test specific state execution"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Start"]
        transitions:
          success: "middle"
      middle:
        command: "echo"
        args: ["Middle"]
        transitions:
          success: "end"
      end:
        command: "echo"
        args: ["End"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['state-test'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await executeStateOrWorkflow(fsm, 'middle', {}, logger);

      expect(result.success).toBe(true);
      expect(result.currentState).toBe('middle');
    });

    test('should handle --yes flag to bypass confirmations', async () => {
      const workflowContent = `
workflows:
  yes-flag-test:
    name: "Yes Flag Test"
    description: "Test --yes flag behavior"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Start"]
        confirmation:
          message: "Proceed with start?"
          timeout: 5
        transitions:
          success: "end"
      end:
        command: "echo"
        args: ["End"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['yes-flag-test'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await executeStateOrWorkflow(fsm, undefined, { yes: true }, logger);

      expect(result.success).toBe(true);
      expect(result.finalState).toBe('end');
    });

    test('should handle dry-run mode', async () => {
      const workflowContent = `
workflows:
  dry-run-test:
    name: "Dry Run Test"
    description: "Test dry-run mode"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Start"]
        transitions:
          success: "end"
      end:
        command: "rm"
        args: ["-rf", "/"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['dry-run-test'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      // Dry run should not execute dangerous command
      const result = await executeStateOrWorkflow(fsm, undefined, { dryRun: true }, logger);

      // Dry run should succeed without executing commands
      expect(result).toBeDefined();
      expect(result.executionPlan).toBeDefined();
    });

    test('should handle verbose mode', async () => {
      const workflowContent = `
workflows:
  verbose-test:
    name: "Verbose Test"
    description: "Test verbose mode"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Verbose output"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['verbose-test'];

      const verboseLogger = new Logger(false, true); // Verbose mode
      const executor = new CommandExecutor(verboseLogger);
      const confirmationHandler = new ConfirmationHandler(executor, verboseLogger);
      const fsm = new StateMachine(workflow, verboseLogger, executor, confirmationHandler);

      const result = await executeStateOrWorkflow(fsm, undefined, { verbose: true }, verboseLogger);

      expect(result.success).toBe(true);
    });
  });

  describe('CLI parameter passing and validation', () => {
    test('should pass template variables through CLI', async () => {
      const workflowContent = `
workflows:
  template-test:
    name: "Template Test"
    description: "Test template variables"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Value: {value}"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['template-test'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      // Set template variables
      fsm.updateContext({ variables: { value: 'test123' } });

      const result = await executeStateOrWorkflow(fsm, undefined, {}, logger);

      expect(result.success).toBe(true);
    });

    test('should validate workflow name format', async () => {
      const workflowContent = `
workflows:
  valid-name:
    name: "Valid Name"
    description: "Test name validation"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Test"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);

      // Valid names should work
      expect(workflows.workflows['valid-name']).toBeDefined();
    });

    test('should validate state name format', async () => {
      const workflowContent = `
workflows:
  state-name-test:
    name: "State Name Test"
    description: "Test state name validation"
    initialState: "valid_state-1"
    states:
      valid_state-1:
        command: "echo"
        args: ["Valid state name"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['state-name-test'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await executeStateOrWorkflow(fsm, 'valid_state-1', {}, logger);

      expect(result.success).toBe(true);
    });
  });

  describe('Global timeout vs per-state timeout', () => {
    test('should respect global timeout', async () => {
      const workflowContent = `
workflows:
  global-timeout:
    name: "Global Timeout"
    description: "Test global timeout"
    initialState: "start"
    globalTimeout: 60
    states:
      start:
        command: "echo"
        args: ["Quick command"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['global-timeout'];

      expect(workflow.globalTimeout).toBe(60);

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await executeStateOrWorkflow(fsm, undefined, {}, logger);

      expect(result.success).toBe(true);
    });

    test('should respect per-state timeout over global', async () => {
      const workflowContent = `
workflows:
  per-state-timeout:
    name: "Per State Timeout"
    description: "Test per-state timeout"
    initialState: "start"
    globalTimeout: 30
    states:
      start:
        command: "echo"
        args: ["Custom timeout"]
        timeout: 60
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['per-state-timeout'];

      expect(workflow.globalTimeout).toBe(30);
      expect(workflow.states.start.timeout).toBe(60);

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await executeStateOrWorkflow(fsm, undefined, {}, logger);

      expect(result.success).toBe(true);
    });

    test('should use global timeout when per-state not specified', async () => {
      const workflowContent = `
workflows:
  default-timeout:
    name: "Default Timeout"
    description: "Test default timeout behavior"
    initialState: "start"
    globalTimeout: 45
    states:
      start:
        command: "echo"
        args: ["Using global timeout"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['default-timeout'];

      expect(workflow.globalTimeout).toBe(45);
      expect(workflow.states.start.timeout).toBeUndefined();

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await executeStateOrWorkflow(fsm, undefined, {}, logger);

      expect(result.success).toBe(true);
    });
  });
});
