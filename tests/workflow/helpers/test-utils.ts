/**
 * Test utilities for workflow testing
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Create a temporary directory for testing
 */
export function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aisanity-test-'));
}

/**
 * Clean up temporary directory
 */
export function cleanupTempDir(tempDir: string): void {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Copy fixture file to temporary directory
 */
export function copyFixtureToTemp(fixtureName: string, tempDir: string): string {
  const fixturePath = path.join(__dirname, '..', 'fixtures', fixtureName);
  const targetPath = path.join(tempDir, '.aisanity-workflows.yml');
  
  fs.copyFileSync(fixturePath, targetPath);
  return targetPath;
}

/**
 * Create a custom workflow file in temp directory
 */
export function createWorkflowFile(tempDir: string, content: string): string {
  const workflowPath = path.join(tempDir, '.aisanity-workflows.yml');
  fs.writeFileSync(workflowPath, content, 'utf8');
  return workflowPath;
}

/**
 * Create a workflow file with invalid permissions (read-only)
 */
export function createReadOnlyWorkflowFile(tempDir: string, content: string): string {
  const workflowPath = createWorkflowFile(tempDir, content);
  fs.chmodSync(workflowPath, 0o000); // No permissions
  return workflowPath;
}

/**
 * Wait for async operations (useful for testing race conditions)
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a large workflow for performance testing
 */
export function generateLargeWorkflow(stateCount: number): string {
  const states: string[] = [];
  
  for (let i = 0; i < stateCount; i++) {
    const nextState = i < stateCount - 1 ? `state${i + 1}` : 'complete';
    states.push(`      state${i}:
        description: "State ${i} for performance testing"
        command: "echo 'State ${i}'"
        timeout: 60
        transitions:
          success: "${nextState}"
          failure: "cleanup"`);
  }

  return `workflows:
  performance-test:
    name: "Performance Test Workflow"
    description: "Large workflow for performance testing"
    initialState: "state0"
    states:
${states.join('\n')}
      cleanup:
        description: "Clean up on failure"
        command: "echo 'Cleanup'"
        transitions:
          success: "complete"
      complete:
        description: "Workflow complete"
        command: "echo 'Complete'"
        transitions: {}

metadata:
  version: "1.0.0"
  created: "2025-01-20"`;
}
/**
 * Generate a performance test workflow with specified number of states
 */
export function generatePerformanceWorkflow(stateCount: number): string {
  const states: string[] = [];
  
  for (let i = 0; i < stateCount; i++) {
    const nextState = i < stateCount - 1 ? `state${i + 1}` : null;
    if (nextState) {
      states.push(`      state${i}:
        description: "Performance test state ${i}"
        command: "echo"
        args: ["State ${i}"]
        transitions:
          success: "${nextState}"`);
    } else {
      // Last state - use empty transitions object
      states.push(`      state${i}:
        description: "Performance test state ${i}"
        command: "echo"
        args: ["State ${i}"]
        transitions: {}`);
    }
  }

  return `workflows:
  performance-test:
    name: "Performance Test"
    description: "Large workflow for performance testing"
    initialState: "state0"
    states:
${states.join('\n')}

metadata:
  version: "1.0.0"`;
}

/**
 * Generate a branching workflow for complexity testing
 */
export function generateBranchingWorkflow(branchCount: number): string {
  const states: string[] = [];
  
  for (let i = 0; i < branchCount; i++) {
    states.push(`      branch${i}:
        description: "Branch ${i}"
        command: "test"
        args: ["-n", "test"]
        transitions:
          success: "success${i}"
          failure: "failure${i}"`);
    
    states.push(`      success${i}:
        command: "echo"
        args: ["Success ${i}"]
        transitions:
          success: null`);
    
    states.push(`      failure${i}:
        command: "echo"
        args: ["Failure ${i}"]
        transitions:
          success: null`);
  }

  return `workflows:
  branching-test:
    name: "Branching Test"
    description: "Complex branching workflow"
    initialState: "branch0"
    states:
${states.join('\n')}

metadata:
  version: "1.0.0"`;
}

/**
 * Create a workflow with timeout configuration
 */
export function createTimeoutWorkflow(tempDir: string, globalTimeout: number, stateTimeout?: number): string {
  const timeoutLine = stateTimeout !== undefined ? `        timeout: ${stateTimeout}` : '';
  const content = `workflows:
  timeout-test:
    name: "Timeout Test"
    description: "Workflow with timeout configuration"
    initialState: "start"
    globalTimeout: ${globalTimeout}
    states:
      start:
        command: "sleep"
        args: ["1"]
${timeoutLine}
        transitions:
          success: null
          timeout: "timeout-handler"
      timeout-handler:
        command: "echo"
        args: ["Timeout handled"]
        transitions: {}

metadata:
  version: "1.0.0"`;
  
  return createWorkflowFile(tempDir, content);
}

/**
 * Create a workflow with confirmation prompts
 */
export function createConfirmationWorkflow(tempDir: string, defaultAccept: boolean = false): string {
  const content = `workflows:
  confirmation-test:
    name: "Confirmation Test"
    description: "Workflow with confirmation prompts"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Test"]
        confirmation:
          message: "Proceed with operation?"
          timeout: 30
          defaultAccept: ${defaultAccept}
        transitions:
          success: null

metadata:
  version: "1.0.0"`;
  
  return createWorkflowFile(tempDir, content);
}

/**
 * Create a workflow with template variables
 */
export function createTemplateWorkflow(tempDir: string): string {
  const content = `workflows:
  template-test:
    name: "Template Test"
    description: "Workflow with template variables"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Hello {name}, env: {environment}"]
        transitions:
          success: null

metadata:
  version: "1.0.0"`;
  
  return createWorkflowFile(tempDir, content);
}

/**
 * Create a real-world deployment workflow
 */
export function createDeploymentWorkflow(tempDir: string): string {
  const content = `workflows:
  deploy:
    name: "Deployment Pipeline"
    description: "Complete deployment workflow"
    initialState: "build"
    globalTimeout: 300
    states:
      build:
        command: "echo"
        args: ["Building application"]
        transitions:
          success: "test"
          failure: "cleanup"
      test:
        command: "echo"
        args: ["Running tests"]
        transitions:
          success: "deploy"
          failure: "cleanup"
      deploy:
        command: "echo"
        args: ["Deploying to {environment}"]
        confirmation:
          message: "Deploy to {environment}?"
          timeout: 30
        transitions:
          success: "verify"
          failure: "rollback"
      verify:
        command: "echo"
        args: ["Verifying deployment"]
        transitions:
          success: "complete"
          failure: "rollback"
      rollback:
        command: "echo"
        args: ["Rolling back deployment"]
        transitions:
          success: "cleanup"
      cleanup:
        command: "echo"
        args: ["Cleaning up resources"]
        transitions:
          success: "complete"
      complete:
        command: "echo"
        args: ["Deployment complete"]
        transitions: {}

metadata:
  version: "1.0.0"`;
  
  return createWorkflowFile(tempDir, content);
}
