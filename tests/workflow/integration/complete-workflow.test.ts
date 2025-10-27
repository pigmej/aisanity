/**
 * Complete workflow integration tests
 * End-to-end tests for entire workflow execution
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { StateMachine } from '../../../src/workflow/fsm';
import { WorkflowParser } from '../../../src/workflow/parser';
import { CommandExecutor } from '../../../src/workflow/executor';
import { ConfirmationHandler } from '../../../src/workflow/confirmation-handler';
import { Logger } from '../../../src/utils/logger';
import { createTempDir, cleanupTempDir, createWorkflowFile } from '../helpers/test-utils';
import * as fs from 'fs';
import * as path from 'path';

describe('Complete Workflow Integration', () => {
  const logger = new Logger(true); // Silent mode for tests
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('Basic Linear Workflows', () => {
    test('should execute simple two-state workflow end-to-end', async () => {
      const workflowContent = `
workflows:
  simple-test:
    name: "Simple Test"
    description: "Two state workflow"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Hello"]
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
      const workflow = workflows.workflows['simple-test'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      expect(result.success).toBe(true);
      expect(result.finalState).toBe('end');
      expect(result.stateHistory).toHaveLength(2);
      expect(result.stateHistory[0].stateName).toBe('start');
      expect(result.stateHistory[1].stateName).toBe('end');
    });

    test('should handle file creation workflow', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      const workflowContent = `
workflows:
  file-test:
    name: "File Test"
    description: "Create and verify file"
    initialState: "create"
    states:
      create:
        command: "touch"
        args: ["${testFile}"]
        transitions:
          success: "verify"
      verify:
        command: "test"
        args: ["-f", "${testFile}"]
        transitions:
          success: "complete"
      complete:
        command: "echo"
        args: ["File created successfully"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['file-test'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      expect(result.success).toBe(true);
      expect(result.finalState).toBe('complete');
      expect(fs.existsSync(testFile)).toBe(true);
    });

    test('should execute workflow with multiple sequential states', async () => {
      const workflowContent = `
workflows:
  sequential:
    name: "Sequential Workflow"
    description: "Multiple sequential states"
    initialState: "step1"
    states:
      step1:
        command: "echo"
        args: ["Step 1"]
        transitions:
          success: "step2"
      step2:
        command: "echo"
        args: ["Step 2"]
        transitions:
          success: "step3"
      step3:
        command: "echo"
        args: ["Step 3"]
        transitions:
          success: "step4"
      step4:
        command: "echo"
        args: ["Step 4"]
        transitions:
          success: "complete"
      complete:
        command: "echo"
        args: ["Complete"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['sequential'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      expect(result.success).toBe(true);
      expect(result.finalState).toBe('complete');
      expect(result.stateHistory).toHaveLength(5);
    });
  });

  describe('Complex Branching Workflows', () => {
    test('should handle success and failure branches', async () => {
      const workflowContent = `
workflows:
  branching:
    name: "Branching Workflow"
    description: "Workflow with conditional branches"
    initialState: "check"
    states:
      check:
        command: "test"
        args: ["-f", "/nonexistent-file"]
        transitions:
          success: "success-path"
          failure: "failure-path"
      success-path:
        command: "echo"
        args: ["Success path"]
        transitions:
          success: "complete"
      failure-path:
        command: "echo"
        args: ["Failure path"]
        transitions:
          success: "complete"
      complete:
        command: "echo"
        args: ["Complete"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['branching'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      expect(result.success).toBe(true);
      expect(result.finalState).toBe('complete');
      // Should take failure path
      expect(result.stateHistory[1].stateName).toBe('failure-path');
    });

    test('should handle nested branching', async () => {
      const workflowContent = `
workflows:
  nested-branching:
    name: "Nested Branching"
    description: "Multiple levels of branching"
    initialState: "check1"
    states:
      check1:
        command: "true"
        transitions:
          success: "check2"
          failure: "error"
      check2:
        command: "true"
        transitions:
          success: "check3"
          failure: "partial-failure"
      check3:
        command: "false"
        transitions:
          success: "complete"
          failure: "recovery"
      recovery:
        command: "echo"
        args: ["Recovering"]
        transitions:
          success: "complete"
      partial-failure:
        command: "echo"
        args: ["Partial failure"]
        transitions:
          success: "complete"
      error:
        command: "echo"
        args: ["Error"]
        transitions: {}
      complete:
        command: "echo"
        args: ["Complete"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['nested-branching'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      expect(result.success).toBe(true);
      expect(result.finalState).toBe('complete');
      // Should go through recovery path
      expect(result.stateHistory.map((h: any) => h.stateName)).toContain('recovery');
    });

    test('should handle error recovery workflow', async () => {
      const workflowContent = `
workflows:
  error-recovery:
    name: "Error Recovery"
    description: "Workflow with cleanup and rollback"
    initialState: "init"
    states:
      init:
        command: "echo"
        args: ["Initializing"]
        transitions:
          success: "process"
      process:
        command: "false"
        transitions:
          success: "finalize"
          failure: "cleanup"
      cleanup:
        command: "echo"
        args: ["Cleaning up"]
        transitions:
          success: "complete"
      finalize:
        command: "echo"
        args: ["Finalizing"]
        transitions:
          success: "complete"
      complete:
        command: "echo"
        args: ["Complete"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['error-recovery'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      expect(result.success).toBe(true);
      expect(result.finalState).toBe('complete');
      // Should have executed cleanup
      expect(result.stateHistory.map((h: any) => h.stateName)).toContain('cleanup');
    });
  });

  describe('Real-World Development Scenarios', () => {
    test('should execute build-test workflow', async () => {
      const workflowContent = `
workflows:
  build-test:
    name: "Build and Test"
    description: "Build project and run tests"
    initialState: "install"
    states:
      install:
        command: "echo"
        args: ["Installing dependencies"]
        transitions:
          success: "build"
      build:
        command: "echo"
        args: ["Building project"]
        transitions:
          success: "test"
      test:
        command: "echo"
        args: ["Running tests"]
        transitions:
          success: "complete"
          failure: "cleanup"
      cleanup:
        command: "echo"
        args: ["Cleaning up after failure"]
        transitions:
          success: "complete"
      complete:
        command: "echo"
        args: ["Workflow complete"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['build-test'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      expect(result.success).toBe(true);
      expect(result.finalState).toBe('complete');
      expect(result.totalDuration).toBeGreaterThan(0);
    });

    test('should handle directory operations workflow', async () => {
      const testDir = path.join(tempDir, 'test-project');
      const workflowContent = `
workflows:
  dir-ops:
    name: "Directory Operations"
    description: "Create and manage directories"
    initialState: "create"
    states:
      create:
        command: "mkdir"
        args: ["-p", "${testDir}"]
        transitions:
          success: "verify"
      verify:
        command: "test"
        args: ["-d", "${testDir}"]
        transitions:
          success: "complete"
          failure: "error"
      error:
        command: "echo"
        args: ["Directory creation failed"]
        transitions: {}
      complete:
        command: "echo"
        args: ["Directory operations complete"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['dir-ops'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      expect(result.success).toBe(true);
      expect(result.finalState).toBe('complete');
      expect(fs.existsSync(testDir)).toBe(true);
    });

    test('should handle workflow with environment variables', async () => {
      const workflowContent = `
workflows:
  env-test:
    name: "Environment Test"
    description: "Test environment variable handling"
    initialState: "check-path"
    states:
      check-path:
        command: "test"
        args: ["-n", "$PATH"]
        transitions:
          success: "check-home"
      check-home:
        command: "test"
        args: ["-n", "$HOME"]
        transitions:
          success: "complete"
          failure: "error"
      error:
        command: "echo"
        args: ["Environment check failed"]
        transitions: {}
      complete:
        command: "echo"
        args: ["Environment checks passed"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['env-test'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      expect(result.success).toBe(true);
      expect(result.finalState).toBe('complete');
    });
  });

  describe('Workflow Execution Metadata', () => {
    test('should track execution timing', async () => {
      const workflowContent = `
workflows:
  timing-test:
    name: "Timing Test"
    description: "Test execution timing"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Start"]
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
      const workflow = workflows.workflows['timing-test'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const startTime = performance.now();
      const result = await fsm.execute();
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.totalDuration).toBeLessThan(endTime - startTime + 10); // Allow 10ms margin
    });

    test('should track state history with details', async () => {
      const workflowContent = `
workflows:
  history-test:
    name: "History Test"
    description: "Test state history tracking"
    initialState: "step1"
    states:
      step1:
        command: "echo"
        args: ["Step 1"]
        transitions:
          success: "step2"
      step2:
        command: "echo"
        args: ["Step 2"]
        transitions:
          success: "step3"
      step3:
        command: "echo"
        args: ["Step 3"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['history-test'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      expect(result.success).toBe(true);
      expect(result.stateHistory).toHaveLength(3);
      
      // Verify each history entry has required fields
      result.stateHistory.forEach((entry: any) => {
        expect(entry.stateName).toBeDefined();
        expect(entry.exitCode).toBeDefined();
        expect(entry.duration).toBeGreaterThanOrEqual(0);
        expect(entry.timestamp).toBeDefined();
      });
    });

    test('should provide execution summary', async () => {
      const workflowContent = `
workflows:
  summary-test:
    name: "Summary Test"
    description: "Test execution summary"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Start"]
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
      const workflow = workflows.workflows['summary-test'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      await fsm.execute();
      const summary = fsm.getExecutionSummary();

      expect(summary).toBeDefined();
      expect(summary.workflowName).toBe('Summary Test');
      expect(summary.totalStates).toBeGreaterThan(0);
      expect(summary.executedStates).toBeGreaterThan(0);
    });
  });
});
