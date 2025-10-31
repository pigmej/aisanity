/**
 * TUI interaction integration tests
 * Tests for interactive program support and confirmation prompts
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { StateMachine } from '../../../src/workflow/fsm';
import { WorkflowParser } from '../../../src/workflow/parser';
import { CommandExecutor } from '../../../src/workflow/executor';
import { ConfirmationHandler } from '../../../src/workflow/confirmation-handler';
import { Logger } from '../../../src/utils/logger';
import { createTempDir, cleanupTempDir, createWorkflowFile } from '../helpers/test-utils';

describe('TUI Interaction Integration', () => {
  const logger = new Logger(true); // Silent mode for tests
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('Interactive Program Support', () => {
    test('should handle stdin inherit mode', async () => {
      const workflowContent = `
workflows:
  stdin-test:
    name: "Stdin Test"
    description: "Test stdin handling"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Test stdin mode"]
        stdin: "inherit"
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['stdin-test'];

      expect(workflow.states.start.stdin).toBe('inherit');

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      expect(result.success).toBe(true);
    });

    test('should handle stdin pipe mode', async () => {
      const workflowContent = `
workflows:
  pipe-test:
    name: "Pipe Test"
    description: "Test pipe mode"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Test pipe mode"]
        stdin: "pipe"
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['pipe-test'];

      expect(workflow.states.start.stdin).toBe('pipe');

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      expect(result.success).toBe(true);
    });

    test('should handle stdin null mode', async () => {
      const workflowContent = `
workflows:
  null-test:
    name: "Null Test"
    description: "Test null stdin"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Test null stdin"]
        stdin: null
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['null-test'];

      expect(workflow.states.start.stdin).toBe(null);

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      expect(result.success).toBe(true);
    });
  });

  describe('Confirmation Prompt Handling', () => {
    test('should handle confirmation with default accept', async () => {
      const workflowContent = `
workflows:
  confirm-default-accept:
    name: "Confirm Default Accept"
    description: "Test confirmation with default accept"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Confirmed"]
        confirmation:
          message: "Proceed with operation?"
          timeout: 30
          defaultAccept: true
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['confirm-default-accept'];

      expect(workflow.states.start.confirmation).toBeDefined();
      expect(workflow.states.start.confirmation?.defaultAccept).toBe(true);

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      // Execute with yes flag to bypass prompt
      const result = await fsm.execute({ yesFlag: true });

      expect(result.success).toBe(true);
    });

    test('should handle confirmation timeout configuration', async () => {
      const workflowContent = `
workflows:
  confirm-timeout:
    name: "Confirm Timeout"
    description: "Test confirmation timeout"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Test"]
        confirmation:
          message: "Proceed?"
          timeout: 60
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['confirm-timeout'];

      expect(workflow.states.start.confirmation).toBeDefined();
      expect(workflow.states.start.confirmation?.timeout).toBe(60);

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      // Execute with yes flag to bypass prompt
      const result = await fsm.execute({ yesFlag: true });

      expect(result.success).toBe(true);
    });

    test('should handle confirmation with custom message', async () => {
      const workflowContent = `
workflows:
  confirm-message:
    name: "Confirm Message"
    description: "Test confirmation message"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Test"]
        confirmation:
          message: "Are you sure you want to proceed?"
          timeout: 30
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['confirm-message'];

      expect(workflow.states.start.confirmation).toBeDefined();
      expect(workflow.states.start.confirmation?.message).toBe('Are you sure you want to proceed?');

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      // Execute with yes flag to bypass prompt
      const result = await fsm.execute({ yesFlag: true });

      expect(result.success).toBe(true);
    });

    test('should bypass confirmations with yes flag', async () => {
      const workflowContent = `
workflows:
  yes-flag-test:
    name: "Yes Flag Test"
    description: "Test yes flag bypassing confirmations"
    initialState: "step1"
    states:
      step1:
        command: "echo"
        args: ["Step 1"]
        confirmation:
          message: "Proceed to step 1?"
          timeout: 30
        transitions:
          success: "step2"
      step2:
        command: "echo"
        args: ["Step 2"]
        confirmation:
          message: "Proceed to step 2?"
          timeout: 30
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

      // Execute with yes flag to bypass all confirmations
      const result = await fsm.execute({ yesFlag: true });

      expect(result.success).toBe(true);
      expect(result.finalState).toBe('step2');
      expect(result.stateHistory).toHaveLength(2);
    });
  });

  describe('Bash Subprocess Integration', () => {
    test('should handle bash command execution', async () => {
      const workflowContent = `
workflows:
  bash-test:
    name: "Bash Test"
    description: "Test bash command execution"
    initialState: "start"
    states:
      start:
        command: "bash"
        args: ["-c", "echo 'Hello from bash'"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['bash-test'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      expect(result.success).toBe(true);
    });

    test('should handle bash script with multiple commands', async () => {
      const workflowContent = `
workflows:
  bash-script:
    name: "Bash Script"
    description: "Test bash script execution"
    initialState: "start"
    states:
      start:
        command: "bash"
        args: ["-c", "echo 'Line 1' && echo 'Line 2' && echo 'Line 3'"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['bash-script'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      expect(result.success).toBe(true);
    });

    test('should handle bash command with environment variables', async () => {
      const workflowContent = `
workflows:
  bash-env:
    name: "Bash Environment"
    description: "Test bash with env vars"
    initialState: "start"
    states:
      start:
        command: "bash"
        args: ["-c", "echo $HOME"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['bash-env'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      expect(result.success).toBe(true);
    });
  });

  describe('Mixed Interactive and Non-Interactive States', () => {
    test('should handle workflow with mixed states', async () => {
      const workflowContent = `
workflows:
  mixed-workflow:
    name: "Mixed Workflow"
    description: "Test mixed interactive and non-interactive states"
    initialState: "non-interactive"
    states:
      non-interactive:
        command: "echo"
        args: ["Non-interactive"]
        transitions:
          success: "interactive"
      interactive:
        command: "echo"
        args: ["Interactive"]
        stdin: "inherit"
        confirmation:
          message: "Continue?"
          timeout: 30
        transitions:
          success: "final"
      final:
        command: "echo"
        args: ["Final"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['mixed-workflow'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      // Execute with yes flag to bypass confirmation
      const result = await fsm.execute({ yesFlag: true });

      expect(result.success).toBe(true);
      expect(result.finalState).toBe('final');
      expect(result.stateHistory).toHaveLength(3);
    });
  });
});
