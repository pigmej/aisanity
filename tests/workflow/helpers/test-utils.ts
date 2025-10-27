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