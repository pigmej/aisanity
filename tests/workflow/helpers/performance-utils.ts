/**
 * Performance testing utilities
 * Helper functions for measuring and validating performance metrics
 */

import { StateMachine } from '../../../src/workflow/fsm';
import { WorkflowParser } from '../../../src/workflow/parser';
import { Logger } from '../../../src/utils/logger';
import { Workflow } from '../../../src/workflow/interfaces';

/**
 * Measure FSM initialization time
 */
export function measureFSMInit(workflow: Workflow, logger: Logger): number {
  const startTime = performance.now();
  new StateMachine(workflow, logger);
  return performance.now() - startTime;
}

/**
 * Measure complete workflow system startup time
 * Includes: YAML loading + parsing + FSM initialization
 */
export async function measureCompleteStartup(
  workflowPath: string,
  workflowName: string,
  logger: Logger
): Promise<number> {
  const startTime = performance.now();
  
  const parser = new WorkflowParser(logger);
  const workflows = parser.loadWorkflows(workflowPath);
  const workflow = workflows.workflows[workflowName];
  new StateMachine(workflow, logger);
  
  return performance.now() - startTime;
}

/**
 * Measure state transition time
 */
export function measureStateTransition(fsm: StateMachine, exitCode: number): number {
  const startTime = performance.now();
  fsm.transition(exitCode);
  return performance.now() - startTime;
}

/**
 * Measure workflow execution time
 */
export async function measureWorkflowExecution(fsm: StateMachine): Promise<number> {
  const startTime = performance.now();
  await fsm.execute();
  return performance.now() - startTime;
}

/**
 * Measure YAML parsing time
 */
export function measureYAMLParsing(workflowPath: string, logger: Logger): number {
  const startTime = performance.now();
  const parser = new WorkflowParser(logger);
  parser.loadWorkflows(workflowPath);
  return performance.now() - startTime;
}

/**
 * Measure context update time
 */
export function measureContextUpdate(
  fsm: StateMachine,
  updates: Partial<{ variables: Record<string, string>; metadata: Record<string, unknown> }>
): number {
  const startTime = performance.now();
  fsm.updateContext(updates);
  return performance.now() - startTime;
}

/**
 * Performance benchmark result
 */
export interface PerformanceBenchmark {
  operation: string;
  duration: number;
  timestamp: Date;
  passed: boolean;
  threshold: number;
}

/**
 * Run performance benchmark with threshold validation
 */
export function runBenchmark(
  operation: string,
  threshold: number,
  measure: () => number | Promise<number>
): Promise<PerformanceBenchmark> {
  return Promise.resolve(measure()).then(duration => ({
    operation,
    duration,
    timestamp: new Date(),
    passed: duration < threshold,
    threshold
  }));
}

/**
 * Calculate average performance over multiple runs
 */
export async function averagePerformance(
  runs: number,
  measure: () => number | Promise<number>
): Promise<{ average: number; min: number; max: number; runs: number[] }> {
  const results: number[] = [];
  
  for (let i = 0; i < runs; i++) {
    const duration = await Promise.resolve(measure());
    results.push(duration);
  }
  
  return {
    average: results.reduce((a, b) => a + b, 0) / results.length,
    min: Math.min(...results),
    max: Math.max(...results),
    runs: results
  };
}

/**
 * Validate performance requirement
 */
export function validatePerformance(
  operation: string,
  actualDuration: number,
  threshold: number
): { passed: boolean; message: string } {
  const passed = actualDuration < threshold;
  const message = passed
    ? `✓ ${operation}: ${actualDuration.toFixed(2)}ms (< ${threshold}ms)`
    : `✗ ${operation}: ${actualDuration.toFixed(2)}ms (>= ${threshold}ms)`;
  
  return { passed, message };
}
