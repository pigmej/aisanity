/**
 * Startup performance tests
 * Validates <500ms complete workflow system startup requirement
 */

import { describe, test, expect } from 'bun:test';
import { StateMachine } from '../../../src/workflow/fsm';
import { WorkflowParser } from '../../../src/workflow/parser';
import { CommandExecutor } from '../../../src/workflow/executor';
import { ConfirmationHandler } from '../../../src/workflow/confirmation-handler';
import { Logger } from '../../../src/utils/logger';
import { simpleWorkflow, complexWorkflow } from '../fixtures/test-workflows';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Startup Performance', () => {
  const logger = new Logger(true); // Silent mode

  describe('Complete workflow system startup < 500ms', () => {
    test('should start complete workflow system in under 500ms', async () => {
      const startTime = performance.now();
      
      // Create temp directory and workflow file
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisanity-perf-'));
      const workflowFile = path.join(tempDir, '.aisanity-workflows.yml');
      
      const workflowContent = `
workflows:
  deploy:
    name: "Deployment"
    description: "Test deployment workflow"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Starting"]
        transitions:
          success: "end"
      end:
        command: "echo"
        args: ["Done"]
        transitions: {}

metadata:
  version: "1.0.0"
`;
      
      fs.writeFileSync(workflowFile, workflowContent, 'utf8');
      
      // Complete startup sequence: YAML loading + parser + FSM + first state preparation
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['deploy'];
      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);
      
      // Prepare first state (validate it exists and is ready)
      const context = fsm.getContext();
      expect(context.workflowName).toBeDefined();
      
      const duration = performance.now() - startTime;
      
      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      // CRITICAL: Complete startup must be under 500ms
      expect(duration).toBeLessThan(500);
    });

    test('should start system with complex workflow in under 500ms', async () => {
      const startTime = performance.now();
      
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisanity-perf-'));
      const workflowFile = path.join(tempDir, '.aisanity-workflows.yml');
      
      const workflowContent = `
workflows:
  complex-deploy:
    name: "Complex Deployment"
    description: "Complex workflow with many states"
    initialState: "init"
    globalTimeout: 300
    states:
      init:
        command: "echo"
        args: ["Initializing"]
        confirmation:
          message: "Start deployment?"
          timeout: 30
        transitions:
          success: "build"
      build:
        command: "npm"
        args: ["run", "build"]
        timeout: 120
        transitions:
          success: "test"
          failure: "cleanup"
      test:
        command: "npm"
        args: ["test"]
        transitions:
          success: "deploy"
          failure: "cleanup"
      deploy:
        command: "npm"
        args: ["run", "deploy"]
        timeout: 180
        transitions:
          success: "verify"
          failure: "rollback"
      verify:
        command: "npm"
        args: ["run", "verify"]
        transitions:
          success: "complete"
          failure: "rollback"
      rollback:
        command: "npm"
        args: ["run", "rollback"]
        transitions:
          success: "cleanup"
      cleanup:
        command: "npm"
        args: ["run", "clean"]
        transitions:
          success: "complete"
      complete:
        command: "echo"
        args: ["Complete"]
        transitions: {}

metadata:
  version: "1.0.0"
`;
      
      fs.writeFileSync(workflowFile, workflowContent, 'utf8');
      
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['complex-deploy'];
      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);
      
      const context = fsm.getContext();
      expect(context.workflowName).toBeDefined();
      
      const duration = performance.now() - startTime;
      
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      // Even complex workflows should start quickly
      expect(duration).toBeLessThan(500);
    });

    test('should start system with large workflow file in under 500ms', async () => {
      const startTime = performance.now();
      
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisanity-perf-'));
      const workflowFile = path.join(tempDir, '.aisanity-workflows.yml');
      
      // Generate large workflow with 20 states
      const states: string[] = [];
      for (let i = 0; i < 20; i++) {
        const nextState = i < 19 ? `state${i + 1}` : 'complete';
        states.push(`      state${i}:
        description: "State ${i}"
        command: "echo"
        args: ["State ${i}"]
        timeout: 60
        transitions:
          success: "${nextState}"
          failure: "cleanup"`);
      }
      
      const workflowContent = `
workflows:
  large-workflow:
    name: "Large Workflow"
    description: "Workflow with many states"
    initialState: "state0"
    states:
${states.join('\n')}
      cleanup:
        command: "echo"
        args: ["Cleanup"]
        transitions:
          success: "complete"
      complete:
        command: "echo"
        args: ["Complete"]
        transitions: {}

metadata:
  version: "1.0.0"
`;
      
      fs.writeFileSync(workflowFile, workflowContent, 'utf8');
      
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['large-workflow'];
      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);
      
      const context = fsm.getContext();
      expect(context.workflowName).toBe('Large Workflow');
      
      const duration = performance.now() - startTime;
      
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      // Large workflows should still start quickly
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Component initialization performance', () => {
    test('should initialize FSM in under 20ms', () => {
      const startTime = performance.now();
      new StateMachine(simpleWorkflow, logger);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(20);
    });

    test('should initialize FSM with complex workflow in under 20ms', () => {
      const startTime = performance.now();
      new StateMachine(complexWorkflow, logger);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(20);
    });

    test('should initialize parser in under 10ms', () => {
      const startTime = performance.now();
      new WorkflowParser(logger);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(10);
    });

    test('should initialize executor in under 10ms', () => {
      const startTime = performance.now();
      new CommandExecutor(logger);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(10);
    });

    test('should initialize confirmation handler in under 10ms', () => {
      const executor = new CommandExecutor(logger);
      const startTime = performance.now();
      new ConfirmationHandler(executor, logger);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(10);
    });
  });

  describe('YAML parsing performance', () => {
    test('should parse simple workflow in under 50ms', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisanity-perf-'));
      const workflowFile = path.join(tempDir, '.aisanity-workflows.yml');
      
      const workflowContent = `
workflows:
  simple:
    name: "Simple"
    description: "Simple workflow"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Test"]
        transitions: {}

metadata:
  version: "1.0.0"
`;
      
      fs.writeFileSync(workflowFile, workflowContent, 'utf8');
      
      const parser = new WorkflowParser(logger);
      const startTime = performance.now();
      parser.loadWorkflows(tempDir);
      const duration = performance.now() - startTime;
      
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      expect(duration).toBeLessThan(50);
    });

    test('should parse complex workflow in under 100ms', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisanity-perf-'));
      const workflowFile = path.join(tempDir, '.aisanity-workflows.yml');
      
      const states: string[] = [];
      for (let i = 0; i < 30; i++) {
        const nextState = i < 29 ? `state${i + 1}` : 'complete';
        states.push(`      state${i}:
        description: "State ${i}"
        command: "echo"
        args: ["State ${i}"]
        confirmation:
          message: "Proceed?"
          timeout: 30
        transitions:
          success: "${nextState}"`);
      }
      
      const workflowContent = `
workflows:
  complex:
    name: "Complex"
    description: "Complex workflow"
    initialState: "state0"
    globalTimeout: 300
    states:
${states.join('\n')}
      complete:
        command: "echo"
        args: ["Complete"]
        transitions: {}

metadata:
  version: "1.0.0"
`;
      
      fs.writeFileSync(workflowFile, workflowContent, 'utf8');
      
      const parser = new WorkflowParser(logger);
      const startTime = performance.now();
      parser.loadWorkflows(tempDir);
      const duration = performance.now() - startTime;
      
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Validation performance', () => {
    test('should validate workflow in under 20ms', () => {
      const startTime = performance.now();
      const fsm = new StateMachine(complexWorkflow, logger);
      const duration = performance.now() - startTime;

      // Validation happens during construction
      expect(fsm).toBeDefined();
      expect(duration).toBeLessThan(20);
    });

    test('should validate large workflow in under 50ms', () => {
      // Create workflow with 50 states
      const states: Record<string, any> = {};
      for (let i = 0; i < 50; i++) {
        const nextState = i < 49 ? `state${i + 1}` : null;
        states[`state${i}`] = {
          command: 'echo',
          args: [`State ${i}`],
          transitions: { success: nextState }
        };
      }

      const largeWorkflow = {
        name: 'large-validation-test',
        initialState: 'state0',
        states
      };

      const startTime = performance.now();
      const fsm = new StateMachine(largeWorkflow, logger);
      const duration = performance.now() - startTime;

      expect(fsm).toBeDefined();
      expect(duration).toBeLessThan(50);
    });
  });
});
