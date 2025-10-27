import { describe, test, expect } from '@jest/globals';
import { $ } from 'bun';

describe('State Command Integration Tests', () => {
  test('should show state command help', async () => {
    const result = await $`bun run dist/index.js state --help`.text();
    
    expect(result).toContain('Manage and execute workflow states');
    expect(result).toContain('execute');
    expect(result).toContain('help');
  });

  test('should show execute subcommand help', async () => {
    const result = await $`bun run dist/index.js state execute --help`.text();
    
    expect(result).toContain('Execute a specific workflow state');
    expect(result).toContain('workflow_name');
    expect(result).toContain('state');
    expect(result).toContain('args');
    expect(result).toContain('--yes');
    expect(result).toContain('--dry-run');
    expect(result).toContain('--verbose');
    expect(result).toContain('--silent');
  });

  test('should handle missing workflow file gracefully', async () => {
    try {
      const result = await $`bun run dist/index.js state execute nonexistent`.text();
      // If we get here, the command succeeded (unexpected)
      expect(result).toBe('Expected command to fail');
    } catch (error: any) {
      // Command failed as expected, check the error output
      const stderr = error.stderr?.toString() || '';
      expect(stderr).toContain('not found');
    }
  });

  test('should handle invalid workflow name', async () => {
    try {
      const result = await $`bun run dist/index.js state execute invalid@name`.text();
      // If we get here, the command succeeded (unexpected)
      expect(result).toBe('Expected command to fail');
    } catch (error: any) {
      // Command failed as expected, check the error output
      const stderr = error.stderr?.toString() || '';
      expect(stderr).toContain('Error:');
      expect(stderr).toContain('alphanumeric');
    }
  });

  test('should handle dry-run mode', async () => {
    // Create a temporary workflow file for testing
    const workflowContent = `
workflows:
  test:
    name: Test Workflow
    description: A simple test workflow
    initialState: start
    states:
      start:
        description: Start state
        command: echo "Hello World"
        transitions:
          success: end
      end:
        description: End state
        command: echo "Done"
        transitions: {}
metadata:
  version: "1.0.0"
`;

    await $`echo '${workflowContent}' > .aisanity-workflows.yml`.quiet();
    
    try {
      const result = await $`bun run dist/index.js state execute test --dry-run 2>&1`.text();
      
      expect(result).toContain('DRY RUN');
      expect(result).toContain('execution plan');
    } finally {
      await $`rm -f .aisanity-workflows.yml`.quiet();
    }
  });

  test('should validate template arguments', async () => {
    // Create a minimal workflow file for testing
    const workflowContent = `
workflows:
  test:
    name: "Test Workflow"
    description: "A minimal workflow for testing"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Starting"]
        transitions:
          success: "done"
      done:
        command: "echo"
        args: ["Finished"]
        transitions: {}
`;

    await $`echo '${workflowContent}' > .aisanity-workflows.yml`.quiet();
    
    try {
      const result = await $`bun run dist/index.js state execute test 'key=\`rm -rf\`'`.text();
      // If we get here, the command succeeded (unexpected)
      expect(result).toBe('Expected command to fail');
    } catch (error: any) {
      // Command failed as expected, check the error output
      const stderr = error.stderr?.toString() || '';
      expect(stderr).toContain('Error:');
      expect(stderr).toContain('potentially dangerous characters');
    } finally {
      await $`rm -f .aisanity-workflows.yml`.quiet();
    }
  });

  test('should handle template argument validation', async () => {
    // Create a minimal workflow file for testing
    const workflowContent = `
workflows:
  test:
    name: "Test Workflow"
    description: "A minimal workflow for testing"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Starting"]
        transitions:
          success: "done"
      done:
        command: "echo"
        args: ["Finished"]
        transitions: {}
`;

    await $`echo '${workflowContent}' > .aisanity-workflows.yml`.quiet();
    
    try {
      const result = await $`bun run dist/index.js state execute test start invalid-format=`.text();
      // If we get here, the command succeeded (unexpected)
      expect(result).toBe('Expected command to fail');
    } catch (error: any) {
      // Command failed as expected, check the error output
      const stderr = error.stderr?.toString() || '';
      expect(stderr).toContain('Error:');
      expect(stderr).toContain('Invalid template argument format');
    } finally {
      await $`rm -f .aisanity-workflows.yml`.quiet();
    }
  });
});