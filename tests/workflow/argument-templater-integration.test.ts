/**
 * Integration tests for Argument Templating System
 * Tests integration with YAML parser, command executor, and execution context
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ArgumentTemplater } from '../../src/workflow/argument-templater';
import { WorkflowParser } from '../../src/workflow/parser';
import { CommandExecutor } from '../../src/workflow/executor';
import { Logger } from '../../src/utils/logger';
import { ExecutionContext } from '../../src/workflow/execution-context';

// Mock Bun.spawnSync for git operations
const mockSpawnSync = jest.fn();
(Bun.spawnSync as any) = mockSpawnSync;

// Mock Bun.spawn for async operations
const mockSpawn = jest.fn();
(Bun.spawn as any) = mockSpawn;

describe('Argument Templater Integration', () => {
  let templater: ArgumentTemplater;
  let parser: WorkflowParser;
  let executor: CommandExecutor;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn()
    } as any;

    templater = new ArgumentTemplater(mockLogger);
    parser = new WorkflowParser(mockLogger);
    executor = new CommandExecutor(mockLogger);

    jest.clearAllMocks();
    
    // Setup default git mock
    mockSpawnSync.mockReturnValue({ stdout: Buffer.from('main\n') });
  });

  describe('Template Processing with Workflow-like Structures', () => {
    it('should process workflow commands with templates', async () => {
      // Simulate a workflow state structure
      const buildState = {
        description: "Build project on {branch}",
        command: "echo",
        args: ["Building {workspace} on {branch}"],
        transitions: {
          success: "deploy"
        }
      };
      
      // Process the build state command with templates
      const cliParams = { branch: 'feature/test', environment: 'production' };
      const processed = await templater.processCommandArgs(
        buildState.command,
        buildState.args || [],
        cliParams
      );

      expect(processed.command).toBe('echo');
      expect(processed.args).toEqual(['Building aisanity on feature/test']);
      expect(processed.hasPlaceholders).toBe(true);
      expect(processed.executionReady).toBe(true);
    });

    it('should handle complex workflow with multiple template variables', async () => {
      // Simulate a complex workflow state
      const buildState = {
        command: "npm",
        args: ["run", "build", "--", "--env={environment}", "--version={version}"],
        transitions: {
          success: "test"
        }
      };
      
      const cliParams = { 
        branch: 'develop', 
        environment: 'staging', 
        version: '1.2.3' 
      };
      
      const processed = await templater.processCommandArgs(
        buildState.command,
        buildState.args || [],
        cliParams
      );

      expect(processed.command).toBe('npm');
      expect(processed.args).toEqual([
        'run', 
        'build', 
        '--', 
        '--env=staging', 
        '--version=1.2.3'
      ]);
      // Check that the expected substitutions are present (only used variables are tracked)
      expect(processed.substitutions.environment).toBe('staging');
      expect(processed.substitutions.version).toBe('1.2.3');
    });
  });

  describe('Command Executor Integration', () => {
    it('should execute processed commands with substituted arguments', async () => {
      // Mock successful command execution
      mockSpawnSync.mockReturnValue({
        exitCode: 0,
        stdout: Buffer.from('Build successful\n'),
        stderr: Buffer.from('')
      });

      const command = 'echo';
      const args = ['Building {workspace} on {branch}'];
      const cliParams = { branch: 'feature/test' };

      // Process the command with templates
      const processed = await templater.processCommandArgs(command, args, cliParams);
      
      expect(processed.executionReady).toBe(true);

      // Execute the processed command
      const result = await executor.executeCommand(
        processed.command,
        processed.args
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('Build successful\n');
    });

    it('should handle template validation errors before execution', async () => {
      const command = 'git checkout {branch}; rm -rf /';
      const args: string[] = [];
      const cliParams = { branch: 'main' };

      const processed = await templater.processCommandArgs(command, args, cliParams);
      
      expect(processed.executionReady).toBe(false);
      expect(processed.validationErrors.length).toBeGreaterThan(0);

      // Should not attempt execution with invalid templates
      await expect(executor.executeCommand(
        processed.command,
        processed.args
      )).rejects.toThrow();
    });
  });

  describe('Execution Context Integration', () => {
    it('should populate execution context with resolved variables', async () => {
      const context: ExecutionContext = {
        workflowName: 'test-workflow',
        startedAt: new Date(),
        variables: {},
        metadata: {}
      };

      // Resolve variables for the context
      const variables = await templater.resolveVariables(context);

      expect(variables).toHaveProperty('branch');
      expect(variables).toHaveProperty('workspace');
      expect(variables).toHaveProperty('timestamp');
      expect(variables.branch).toBe('main');
    });

    it('should merge context variables with built-in and CLI variables', async () => {
      const context: ExecutionContext = {
        workflowName: 'test-workflow',
        startedAt: new Date(),
        variables: { 
          custom_var: 'custom_value',
          environment: 'development'
        },
        metadata: {}
      };

      const cliParams = { branch: 'feature/test', environment: 'production' };
      const variables = await templater.resolveVariables(context);
      const allVariables = { ...variables, ...cliParams };

      // CLI parameters should override context variables
      expect(allVariables.environment).toBe('production');
      expect((allVariables as any).custom_var).toBe('custom_value');
      expect(allVariables.branch).toBe('feature/test');
    });

    it('should track template substitutions in execution context', async () => {
      const command = 'echo "Building {workspace} on {branch}"';
      const args: string[] = [];
      const cliParams = { branch: 'feature/new-ui' };

      const processed = await templater.processCommandArgs(command, args, cliParams);

      // Create enhanced execution context with substitution tracking
      const enhancedContext: ExecutionContext = {
        workflowName: 'test-workflow',
        startedAt: new Date(),
        variables: {
          ...processed.substitutions,
          templateSubstitutions: JSON.stringify(processed.substitutions)
        },
        metadata: {
          originalCommand: command,
          processedCommand: processed.command,
          hasPlaceholders: processed.hasPlaceholders
        }
      };

      expect(JSON.parse(enhancedContext.variables.templateSubstitutions as string)).toEqual({
        branch: 'feature/new-ui',
        workspace: 'aisanity'
      });
      expect(enhancedContext.metadata.originalCommand).toBe(command);
      expect(enhancedContext.metadata.processedCommand).toBe('echo "Building aisanity on feature/new-ui"');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle missing required variables gracefully', async () => {
      const command = 'echo "Branch: {branch}, Env: {environment}"';
      const args: string[] = [];
      const cliParams = {}; // No variables provided

      const processed = await templater.processCommandArgs(command, args, cliParams);

      // Should still execute but with built-in variables resolved
      expect(processed.command).toBe('echo "Branch: main, Env: {environment}"');
      expect(processed.hasPlaceholders).toBe(true); // Built-in variable substitution occurred
      expect(processed.substitutions).toEqual({ branch: 'main' });
    });

    it('should validate and reject dangerous CLI parameters', async () => {
      const command = 'echo {message}';
      const args: string[] = [];
      const cliParams = { message: 'safe; rm -rf /' };

      const processed = await templater.processCommandArgs(command, args, cliParams);

      expect(processed.executionReady).toBe(false);
      expect(processed.validationErrors.some(e => 
        e.includes('Invalid CLI parameter value')
      )).toBe(true);
    });

    it('should handle git operation failures gracefully', async () => {
      // Mock git failure
      mockSpawnSync.mockImplementation(() => {
        throw new Error('Git not found');
      });

      const command = 'echo "Branch: {branch}"';
      const args: string[] = [];
      const cliParams = {};

      const processed = await templater.processCommandArgs(command, args, cliParams);

      // Should fallback to 'unknown' for branch
      expect(processed.command).toBe('echo "Branch: unknown"');
      expect(processed.substitutions.branch).toBe('unknown');
    });
  });

  describe('Performance Integration', () => {
    it('should handle large numbers of template substitutions efficiently', async () => {
      // Create many template states for processing
      const states: Array<{command: string; args: string[]}> = [];
      for (let i = 1; i <= 50; i++) {
        states.push({
          command: "echo",
          args: [`Processing step ${i} on {branch} in {workspace}`]
        });
      }

      // Test processing multiple states
      const processStartTime = Date.now();
      const cliParams = { branch: 'performance-test' };
      
      for (let i = 0; i < 10; i++) {
        await templater.processCommandArgs(
          states[i].command,
          states[i].args,
          cliParams
        );
      }
      
      const processTime = Date.now() - processStartTime;
      expect(processTime).toBeLessThan(50); // Should process quickly

      // Test that all substitutions were applied correctly
      const processed = await templater.processCommandArgs(
        states[0].command,
        states[0].args,
        cliParams
      );
      expect(processed.args[0]).toBe('Processing step 1 on performance-test in aisanity');
    });
  });
});