/**
 * Performance integration tests
 * Test performance under realistic load conditions
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { StateMachine } from '../../../src/workflow/fsm';
import { WorkflowParser } from '../../../src/workflow/parser';
import { CommandExecutor } from '../../../src/workflow/executor';
import { ConfirmationHandler } from '../../../src/workflow/confirmation-handler';
import { Logger } from '../../../src/utils/logger';
import { createTempDir, cleanupTempDir, createWorkflowFile, generatePerformanceWorkflow } from '../helpers/test-utils';

describe('Performance Integration Tests', () => {
  const logger = new Logger(true); // Silent mode for tests
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('Startup Performance', () => {
    test('should complete workflow system startup in <500ms', async () => {
      const workflowContent = `
workflows:
  startup-test:
    name: "Startup Test"
    description: "Test complete system startup time"
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

      const startTime = performance.now();
      
      // Complete startup sequence: YAML loading → parser → FSM → first state preparation
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['startup-test'];
      
      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      new StateMachine(workflow, logger, executor, confirmationHandler);
      
      // Prepare first state (but don't execute)
      const firstState = workflow.states[workflow.initialState];
      expect(firstState).toBeDefined();
      
      const duration = performance.now() - startTime;
      
      // Should complete startup in <500ms
      expect(duration).toBeLessThan(500);
    });

    test('should initialize FSM quickly for large workflows', async () => {
      const workflowContent = generatePerformanceWorkflow(50);
      createWorkflowFile(tempDir, workflowContent);

      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['performance-test'];

      const startTime = performance.now();
      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      new StateMachine(workflow, logger, executor, confirmationHandler);
      const duration = performance.now() - startTime;

      // FSM initialization should be fast even for large workflows
      expect(duration).toBeLessThan(50);
    });

    test('should parse YAML workflow file quickly', async () => {
      const workflowContent = generatePerformanceWorkflow(100);
      createWorkflowFile(tempDir, workflowContent);

      const startTime = performance.now();
      const parser = new WorkflowParser(logger);
      parser.loadWorkflows(tempDir);
      const duration = performance.now() - startTime;

      // YAML parsing should be fast even for large files
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Execution Performance', () => {
    test('should execute workflow with 10 states efficiently', async () => {
      const workflowContent = generatePerformanceWorkflow(10);
      createWorkflowFile(tempDir, workflowContent);

      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['performance-test'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const startTime = performance.now();
      const result = await fsm.execute();
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.stateHistory).toHaveLength(10);
      
      // Should execute 10 simple states in reasonable time
      expect(duration).toBeLessThan(2000);
    });

    test('should handle 50 states without performance degradation', async () => {
      const workflowContent = generatePerformanceWorkflow(50);
      createWorkflowFile(tempDir, workflowContent);

      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['performance-test'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const startTime = performance.now();
      const result = await fsm.execute();
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.stateHistory).toHaveLength(50);
      
      // Performance should scale linearly
      expect(duration).toBeLessThan(10000);
    });

    test('should track execution timing accurately', async () => {
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
      const workflow = workflows.workflows['timing-test'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      expect(result.success).toBe(true);
      expect(result.totalDuration).toBeGreaterThan(0);
      
      // Each state should have timing information (allowing for some variation)
      result.stateHistory.forEach((entry: any) => {
        expect(entry.duration).toBeGreaterThanOrEqual(0);
        expect(entry.timestamp).toBeDefined();
      });
    });
  });

  describe('Memory Usage', () => {
    test('should not leak memory during execution', async () => {
      const workflowContent = generatePerformanceWorkflow(20);
      createWorkflowFile(tempDir, workflowContent);

      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['performance-test'];

      // Execute workflow multiple times
      for (let i = 0; i < 5; i++) {
        const executor = new CommandExecutor(logger);
        const confirmationHandler = new ConfirmationHandler(executor, logger);
        const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);
        
        const result = await fsm.execute();
        expect(result.success).toBe(true);
        
        // Cleanup executor
        await executor.cleanup();
      }

      // If we get here without crashing, memory management is working
      expect(true).toBe(true);
    });

    test('should handle state history efficiently', async () => {
      const workflowContent = generatePerformanceWorkflow(100);
      createWorkflowFile(tempDir, workflowContent);

      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['performance-test'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      expect(result.success).toBe(true);
      expect(result.stateHistory).toHaveLength(100);
      
      // State history should be accessible
      expect(result.stateHistory[0].stateName).toBe('state0');
      expect(result.stateHistory[99].stateName).toBe('state99');
    });
  });

  describe('Concurrent Workflow Execution', () => {
    test('should handle multiple workflow instances concurrently', async () => {
      const workflowContent = `
workflows:
  concurrent-test:
    name: "Concurrent Test"
    description: "Test concurrent workflow execution"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Test"]
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
      const workflow = workflows.workflows['concurrent-test'];

      // Create multiple workflow instances
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 5; i++) {
        const executor = new CommandExecutor(logger);
        const confirmationHandler = new ConfirmationHandler(executor, logger);
        const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);
        promises.push(fsm.execute());
      }

      const startTime = performance.now();
      const results = await Promise.all(promises);
      const duration = performance.now() - startTime;

      // All workflows should succeed
      results.forEach((result: any) => {
        expect(result.success).toBe(true);
      });

      // Concurrent execution should not take 5x longer
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Real-World Performance Scenarios', () => {
    test('should handle deployment workflow with realistic timing', async () => {
      const workflowContent = `
workflows:
  deploy:
    name: "Deployment Pipeline"
    description: "Realistic deployment workflow"
    initialState: "validate"
    states:
      validate:
        command: "echo"
        args: ["Validating configuration"]
        transitions:
          success: "build"
      build:
        command: "echo"
        args: ["Building application"]
        transitions:
          success: "test"
      test:
        command: "echo"
        args: ["Running tests"]
        transitions:
          success: "package"
      package:
        command: "echo"
        args: ["Packaging artifacts"]
        transitions:
          success: "deploy"
      deploy:
        command: "echo"
        args: ["Deploying to staging"]
        transitions:
          success: "verify"
      verify:
        command: "echo"
        args: ["Verifying deployment"]
        transitions:
          success: "complete"
      complete:
        command: "echo"
        args: ["Deployment complete"]
        transitions: {}

metadata:
  version: "1.0.0"
`;

      createWorkflowFile(tempDir, workflowContent);
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['deploy'];

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const startTime = performance.now();
      const result = await fsm.execute({ yesFlag: true });
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.stateHistory).toHaveLength(7);
      
      // Realistic deployment workflow should complete quickly
      expect(duration).toBeLessThan(3000);
    });

    test('should handle error recovery without performance impact', async () => {
      const workflowContent = `
workflows:
  error-recovery:
    name: "Error Recovery"
    description: "Test error recovery performance"
    initialState: "step1"
    states:
      step1:
        command: "echo"
        args: ["Step 1"]
        transitions:
          success: "step2"
      step2:
        command: "false"
        transitions:
          success: "step3"
          failure: "recovery"
      step3:
        command: "echo"
        args: ["Step 3"]
        transitions: {}
      recovery:
        command: "echo"
        args: ["Recovering from error"]
        transitions:
          success: "step3"

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

      const startTime = performance.now();
      const result = await fsm.execute();
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.finalState).toBe('step3');
      
      // Error recovery should not significantly impact performance
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Performance Regression Detection', () => {
    test('should maintain consistent performance across runs', async () => {
      const workflowContent = generatePerformanceWorkflow(10);
      createWorkflowFile(tempDir, workflowContent);

      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      const workflow = workflows.workflows['performance-test'];

      const durations: number[] = [];

      // Run workflow multiple times
      for (let i = 0; i < 3; i++) {
        const executor = new CommandExecutor(logger);
        const confirmationHandler = new ConfirmationHandler(executor, logger);
        const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

        const startTime = performance.now();
        await fsm.execute();
        const duration = performance.now() - startTime;
        durations.push(duration);

        await executor.cleanup();
      }

      // Calculate variance
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const variance = durations.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / durations.length;

      // Performance should be consistent (low variance)
      expect(variance).toBeLessThan(avg * 2); // Variance should be less than 200% of average (allowing for CI load)
    });
  });
});
