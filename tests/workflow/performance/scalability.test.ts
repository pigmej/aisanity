/**
 * Scalability tests
 * Validates system behavior with large workflows and many states
 */

import { describe, test, expect } from 'bun:test';
import { StateMachine } from '../../../src/workflow/fsm';
import { WorkflowParser } from '../../../src/workflow/parser';
import { CommandExecutor } from '../../../src/workflow/executor';
import { ConfirmationHandler } from '../../../src/workflow/confirmation-handler';
import { Logger } from '../../../src/utils/logger';
import { generateLargeWorkflow } from '../helpers/test-utils';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Scalability Tests', () => {
  const logger = new Logger(true); // Silent mode

  describe('Large workflow handling', () => {
    test('should handle workflow with 50+ states', () => {
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
        name: 'scalability-test-50',
        initialState: 'state0',
        states
      };

      const fsm = new StateMachine(largeWorkflow, logger);
      expect(fsm).toBeDefined();
      
      const context = fsm.getContext();
      expect(context.workflowName).toBe('scalability-test-50');
    });

    test('should handle workflow with 100 states', () => {
      const states: Record<string, any> = {};
      
      for (let i = 0; i < 100; i++) {
        const nextState = i < 99 ? `state${i + 1}` : null;
        states[`state${i}`] = {
          command: 'echo',
          args: [`State ${i}`],
          transitions: { success: nextState }
        };
      }

      const largeWorkflow = {
        name: 'scalability-test-100',
        initialState: 'state0',
        states
      };

      const fsm = new StateMachine(largeWorkflow, logger);
      expect(fsm).toBeDefined();
    });

    test('should initialize large workflow quickly', () => {
      const states: Record<string, any> = {};
      
      for (let i = 0; i < 75; i++) {
        const nextState = i < 74 ? `state${i + 1}` : null;
        states[`state${i}`] = {
          command: 'echo',
          args: [`State ${i}`],
          transitions: { success: nextState }
        };
      }

      const largeWorkflow = {
        name: 'scalability-test-75',
        initialState: 'state0',
        states
      };

      const startTime = performance.now();
      const fsm = new StateMachine(largeWorkflow, logger);
      const duration = performance.now() - startTime;

      expect(fsm).toBeDefined();
      expect(duration).toBeLessThan(100); // Should still be fast
    });
  });

  describe('Complex branching', () => {
    test('should handle workflow with 100+ transitions', () => {
      const states: Record<string, any> = {};
      
      // Create branching structure
      for (let i = 0; i < 25; i++) {
        states[`branch${i}`] = {
          command: 'echo',
          args: [`Branch ${i}`],
          transitions: {
            success: `success${i}`,
            failure: `failure${i}`
          }
        };
        
        states[`success${i}`] = {
          command: 'echo',
          args: ['Success'],
          transitions: { success: null }
        };
        
        states[`failure${i}`] = {
          command: 'echo',
          args: ['Failure'],
          transitions: { success: null }
        };
      }

      const branchingWorkflow = {
        name: 'branching-scalability',
        initialState: 'branch0',
        states
      };

      const fsm = new StateMachine(branchingWorkflow, logger);
      expect(fsm).toBeDefined();
    });

    test('should handle deep nesting', () => {
      const states: Record<string, any> = {};
      
      for (let i = 0; i < 50; i++) {
        const nextState = i < 49 ? `state${i + 1}` : null;
        states[`state${i}`] = {
          command: 'echo',
          args: [`Level ${i}`],
          transitions: {
            success: nextState,
            failure: 'error'
          }
        };
      }
      
      states['error'] = {
        command: 'echo',
        args: ['Error'],
        transitions: {}
      };

      const deepWorkflow = {
        name: 'deep-nesting',
        initialState: 'state0',
        states
      };

      const fsm = new StateMachine(deepWorkflow, logger);
      expect(fsm).toBeDefined();
    });

    test('should handle wide branching (many parallel paths)', () => {
      const states: Record<string, any> = {};
      
      // Start state that can branch to many paths
      const transitions: Record<string, string> = {
        success: 'path0',
        failure: 'path1',
        timeout: 'path2'
      };
      
      states['start'] = {
        command: 'echo',
        args: ['Start'],
        transitions
      };
      
      // Create 20 parallel paths
      for (let i = 0; i < 20; i++) {
        states[`path${i}`] = {
          command: 'echo',
          args: [`Path ${i}`],
          transitions: { success: 'complete' }
        };
      }
      
      states['complete'] = {
        command: 'echo',
        args: ['Complete'],
        transitions: {}
      };

      const wideWorkflow = {
        name: 'wide-branching',
        initialState: 'start',
        states
      };

      const fsm = new StateMachine(wideWorkflow, logger);
      expect(fsm).toBeDefined();
    });
  });

  describe('YAML file size', () => {
    test('should parse large YAML file', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisanity-scale-'));
      const workflowFile = path.join(tempDir, '.aisanity-workflows.yml');
      
      // Generate large workflow content
      const content = generateLargeWorkflow(60);
      fs.writeFileSync(workflowFile, content, 'utf8');
      
      const parser = new WorkflowParser(logger);
      const startTime = performance.now();
      const workflows = parser.loadWorkflows(tempDir);
      const duration = performance.now() - startTime;
      
      expect(workflows).toBeDefined();
      expect(workflows.workflows['performance-test']).toBeDefined();
      expect(duration).toBeLessThan(200); // Should parse quickly
      
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('should handle multiple workflows in single file', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisanity-scale-'));
      const workflowFile = path.join(tempDir, '.aisanity-workflows.yml');
      
      // Create file with 10 workflows
      const workflowDefs: string[] = [];
      for (let i = 0; i < 10; i++) {
        workflowDefs.push(`  workflow${i}:
    name: "Workflow ${i}"
    description: "Test workflow ${i}"
    initialState: "start${i}"
    states:
      start${i}:
        command: "echo"
        args: ["Workflow ${i}"]
        transitions: {}`);
      }
      
      const content = `workflows:
${workflowDefs.join('\n')}

metadata:
  version: "1.0.0"`;
      
      fs.writeFileSync(workflowFile, content, 'utf8');
      
      const parser = new WorkflowParser(logger);
      const workflows = parser.loadWorkflows(tempDir);
      
      expect(Object.keys(workflows.workflows)).toHaveLength(10);
      
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('Execution scalability', () => {
    test('should execute workflow with many states', async () => {
      const states: Record<string, any> = {};
      
      for (let i = 0; i < 20; i++) {
        const nextState = i < 19 ? `state${i + 1}` : null;
        states[`state${i}`] = {
          command: 'echo',
          args: [`State ${i}`],
          transitions: { success: nextState }
        };
      }

      const workflow = {
        name: 'execution-scalability',
        initialState: 'state0',
        states
      };

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      expect(result.success).toBe(true);
      expect(result.stateHistory).toHaveLength(20);
    });

    test('should handle concurrent state executions', async () => {
      const concurrentWorkflow = {
        name: 'concurrent-test',
        initialState: 'start',
        states: {
          start: {
            command: 'echo',
            args: ['Test'],
            transitions: {}
          }
        }
      };

      const promises: Promise<any>[] = [];
      
      for (let i = 0; i < 5; i++) {
        const executor = new CommandExecutor(logger);
        const confirmationHandler = new ConfirmationHandler(executor, logger);
        const fsm = new StateMachine(concurrentWorkflow, logger, executor, confirmationHandler);
        promises.push(fsm.execute());
      }

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Memory scalability', () => {
    test('should handle many workflow instances', () => {
      const workflow = {
        name: 'concurrent-test',
        initialState: 'start',
        states: {
          start: {
            command: 'echo',
            args: ['Test'],
            transitions: {}
          }
        }
      };

      const instances: StateMachine[] = [];
      
      for (let i = 0; i < 200; i++) {
        instances.push(new StateMachine(workflow, logger));
      }

      expect(instances).toHaveLength(200);
      
      // Verify instances are functional
      instances.forEach(fsm => {
        const context = fsm.getContext();
        expect(context).toBeDefined();
      });
    });

    test('should handle large state history', async () => {
      const states: Record<string, any> = {};
      
      for (let i = 0; i < 40; i++) {
        const nextState = i < 39 ? `state${i + 1}` : null;
        states[`state${i}`] = {
          command: 'echo',
          args: [`State ${i}`],
          transitions: { success: nextState }
        };
      }

      const workflow = {
        name: 'history-scalability',
        initialState: 'state0',
        states
      };

      const executor = new CommandExecutor(logger);
      const confirmationHandler = new ConfirmationHandler(executor, logger);
      const fsm = new StateMachine(workflow, logger, executor, confirmationHandler);

      const result = await fsm.execute();

      expect(result.success).toBe(true);
      expect(result.stateHistory).toHaveLength(40);
      
      // Verify history entries are complete
      result.stateHistory.forEach((entry: any) => {
        expect(entry.stateName).toBeDefined();
        expect(entry.duration).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Template variable scalability', () => {
    test('should handle many template variables', () => {
      const workflow = {
        name: 'template-scalability',
        initialState: 'start',
        states: {
          start: {
            command: 'echo',
            args: ['{var0}', '{var1}', '{var2}', '{var3}', '{var4}'],
            transitions: {}
          }
        }
      };

      const fsm = new StateMachine(workflow, logger);
      
      const variables: Record<string, string> = {};
      for (let i = 0; i < 50; i++) {
        variables[`var${i}`] = `value${i}`;
      }
      
      fsm.updateContext({ variables });
      
      const context = fsm.getContext();
      expect(Object.keys(context.variables)).toHaveLength(50);
    });

    test('should handle large variable values', () => {
      const workflow = {
        name: 'large-values',
        initialState: 'start',
        states: {
          start: {
            command: 'echo',
            args: ['{large}'],
            transitions: {}
          }
        }
      };

      const fsm = new StateMachine(workflow, logger);
      
      // Create large value (1000 characters)
      const largeValue = 'a'.repeat(1000);
      
      fsm.updateContext({
        variables: { large: largeValue }
      });
      
      const context = fsm.getContext();
      expect(context.variables.large).toHaveLength(1000);
    });
  });
});
