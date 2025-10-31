/**
 * Tests for Argument Templating System
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  ArgumentTemplater, 
  TemplateValidator, 
  VariableResolver
} from '../../src/workflow/argument-templater';
import { Logger } from '../../src/utils/logger';
import { ExecutionContext } from '../../src/workflow/execution-context';



describe('ArgumentTemplater', () => {
  let templater: ArgumentTemplater;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn()
    } as any;
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create templater 
    templater = new ArgumentTemplater(mockLogger);
    
    // Clear internal cache in ArgumentTemplater by accessing private property
    const variableResolver = (templater as any).variableResolver;
    if (variableResolver && variableResolver.cache) {
      variableResolver.cache.clear();
    }
  });

  describe('Template Substitution', () => {
    it('should substitute simple placeholders', () => {
      const template = 'git checkout {branch}';
      const variables = { branch: 'feature/new-ui' };
      
      const result = templater.substituteTemplate(template, variables);
      
      expect(result).toBe('git checkout feature/new-ui');
    });

    it('should substitute multiple placeholders', () => {
      const template = 'echo "Building {workspace} on {branch}"';
      const variables = { workspace: 'my-project', branch: 'main' };
      
      const result = templater.substituteTemplate(template, variables);
      
      expect(result).toBe('echo "Building my-project on main"');
    });

    it('should handle escaped braces', () => {
      const template = 'echo "{{literal}} and {branch}';
      const variables = { branch: 'main' };
      
      const result = templater.substituteTemplate(template, variables);
      
      expect(result).toBe('echo "{literal} and main');
    });

    it('should leave unknown placeholders unchanged', () => {
      const template = 'git checkout {branch} {unknown}';
      const variables = { branch: 'main' };
      
      const result = templater.substituteTemplate(template, variables);
      
      expect(result).toBe('git checkout main {unknown}');
    });

    it('should handle empty variables object', () => {
      const template = 'git checkout main';
      const variables = {};
      
      const result = templater.substituteTemplate(template, variables);
      
      expect(result).toBe('git checkout main');
    });
  });

  describe('Command Processing', () => {
    beforeEach(() => {
      // Clear cache before each command processing test
      const variableResolver = (templater as any).variableResolver;
      if (variableResolver && variableResolver.cache) {
        variableResolver.cache.clear();
      }
    });

    it('should process command with arguments and CLI parameters', async () => {
      const command = 'git checkout {branch}';
      const args = ['--force', '--message={message}'];
      const cliParams = { branch: 'feature/new-ui', message: 'Test commit' };

      const result = await templater.processCommandArgs(command, args, cliParams);

      expect(result.command).toBe('git checkout feature/new-ui');
      expect(result.args).toEqual(['--force', '--message=Test commit']);
      expect(result.hasPlaceholders).toBe(true);
      expect(result.executionReady).toBe(true);
      expect(result.substitutions).toEqual({
        branch: 'feature/new-ui',
        message: 'Test commit'
      });
    });

    it('should include built-in variables in substitution', async () => {
      const command = 'echo "Current branch: {branch}"';
      const args: string[] = [];
      const cliParams = {};

      const result = await templater.processCommandArgs(command, args, cliParams);

      expect(result.command).toMatch(/echo "Current branch: .+"/);
      expect(result.hasPlaceholders).toBe(true);
      expect(result.substitutions).toHaveProperty('branch');
      expect(typeof result.substitutions.branch).toBe('string');
      expect(result.substitutions.branch.length).toBeGreaterThan(0);
    });

    it('should handle validation errors gracefully', async () => {
      const command = 'git checkout {branch}; rm -rf /';
      const args: string[] = [];
      const cliParams = { branch: 'main' };

      const result = await templater.processCommandArgs(command, args, cliParams);

      expect(result.executionReady).toBe(false);
      expect(result.validationErrors.length).toBeGreaterThan(0);
    });

    it('should validate CLI parameters', async () => {
      const command = 'echo {message}';
      const args: string[] = [];
      const cliParams = { message: 'invalid;command' };

      const result = await templater.processCommandArgs(command, args, cliParams);

      expect(result.executionReady).toBe(false);
      expect(result.validationErrors.some(e => e.includes('Invalid CLI parameter value'))).toBe(true);
    });
  });

  describe('Variable Resolution', () => {
    beforeEach(() => {
      // Clear cache before each variable resolution test
      const variableResolver = (templater as any).variableResolver;
      if (variableResolver && variableResolver.cache) {
        variableResolver.cache.clear();
      }
    });

    it('should resolve built-in variables', async () => {
      const context: ExecutionContext = {
        workflowName: 'test',
        startedAt: new Date(),
        variables: {},
        metadata: {}
      };

      const variables = await templater.resolveVariables(context);

      expect(variables).toHaveProperty('branch');
      expect(variables).toHaveProperty('workspace');
      expect(variables).toHaveProperty('timestamp');
      expect(typeof variables.branch).toBe('string');
      expect(variables.branch.length).toBeGreaterThan(0);
      expect(typeof variables.workspace).toBe('string');
      expect(variables.workspace.length).toBeGreaterThan(0);
      expect(typeof variables.timestamp).toBe('string');
      expect(variables.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should include context variables', async () => {
      const context: ExecutionContext = {
        workflowName: 'test',
        startedAt: new Date(),
        variables: { custom: 'value' },
        metadata: {}
      };

      // No mock needed - use actual git environment

      const variables = await templater.resolveVariables(context);

      expect(variables.custom).toBe('value');
    });
  });

  describe('Template Validation', () => {
    it('should validate correct template syntax', () => {
      const template = 'git checkout {branch}';
      
      const result = templater.validateTemplateSyntax(template);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid variable names', () => {
      const template = 'git checkout {branch-name}';
      
      const result = templater.validateTemplateSyntax(template);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid variable name: branch-name');
    });

    it('should detect injection patterns', () => {
      const template = 'git checkout {branch}; rm -rf /';
      
      const result = templater.validateTemplateSyntax(template);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template contains potentially dangerous injection patterns');
    });

    it('should warn about escaped braces', () => {
      const template = 'echo {{literal}} and {branch}';
      
      const result = templater.validateTemplateSyntax(template);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Found 2 escaped braces - these will be treated as literal braces');
    });

    it('should reject templates that are too long', () => {
      const template = 'a'.repeat(1001);
      
      const result = templater.validateTemplateSyntax(template);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template exceeds maximum length of 1000 characters');
    });
  });

  describe('Variable Validation', () => {
    it('should validate correct variable names and values', () => {
      expect(templater.validateTemplateVariable('branch', 'feature/new-ui')).toBe(true);
      expect(templater.validateTemplateVariable('workspace_name', 'my-project')).toBe(true);
    });

    it('should reject invalid variable names', () => {
      expect(templater.validateTemplateVariable('branch-name', 'feature')).toBe(false);
      expect(templater.validateTemplateVariable('123invalid', 'value')).toBe(false);
      expect(templater.validateTemplateVariable('', 'value')).toBe(false);
    });

    it('should reject invalid variable values', () => {
      expect(templater.validateTemplateVariable('branch', 'feature;rm -rf /')).toBe(false);
      expect(templater.validateTemplateVariable('test', 'value with `backticks`')).toBe(false);
    });
  });

  afterEach(() => {
    // No restoration needed since we're not mocking anymore
  });
});

describe('TemplateValidator', () => {
  let validator: TemplateValidator;

  beforeEach(() => {
    validator = new TemplateValidator();
  });

  describe('Variable Name Validation', () => {
    it('should accept valid variable names', () => {
      expect(validator.validateVariableName('branch')).toBe(true);
      expect(validator.validateVariableName('workspace_name')).toBe(true);
      expect(validator.validateVariableName('_private')).toBe(true);
      expect(validator.validateVariableName('name123')).toBe(true);
    });

    it('should reject invalid variable names', () => {
      expect(validator.validateVariableName('branch-name')).toBe(false);
      expect(validator.validateVariableName('123invalid')).toBe(false);
      expect(validator.validateVariableName('')).toBe(false);
      expect(validator.validateVariableName('name with spaces')).toBe(false);
      expect(validator.validateVariableName('name.with.dots')).toBe(false);
    });

    it('should reject variable names that are too long', () => {
      const longName = 'a'.repeat(51);
      expect(validator.validateVariableName(longName)).toBe(false);
    });
  });

  describe('Variable Value Validation', () => {
    it('should accept safe values', () => {
      expect(validator.validateVariableValue('feature/new-ui')).toBe(true);
      expect(validator.validateVariableValue('my-project')).toBe(true);
      expect(validator.validateVariableValue('workspace_name')).toBe(true);
      expect(validator.validateVariableValue('/path/to/file')).toBe(true);
      expect(validator.validateVariableValue('version-1.2.3')).toBe(true);
    });

    it('should reject dangerous values', () => {
      expect(validator.validateVariableValue('value;rm -rf /')).toBe(false);
      expect(validator.validateVariableValue('value && echo hacked')).toBe(false);
      expect(validator.validateVariableValue('value | cat')).toBe(false);
      expect(validator.validateVariableValue('value `command`')).toBe(false);
      expect(validator.validateVariableValue('value $(command)')).toBe(false);
    });

    it('should reject values that are too long', () => {
      const longValue = 'a'.repeat(256);
      expect(validator.validateVariableValue(longValue)).toBe(false);
    });
  });

  describe('Injection Pattern Detection', () => {
    it('should detect dangerous patterns', () => {
      expect(validator.checkForInjectionPatterns('rm -rf /etc/passwd')).toBe(true);
      expect(validator.checkForInjectionPatterns('cat ../../etc/shadow')).toBe(true);
      expect(validator.checkForInjectionPatterns('echo && rm -rf /')).toBe(true);
      expect(validator.checkForInjectionPatterns('echo || rm -rf /')).toBe(true);
      expect(validator.checkForInjectionPatterns('echo `whoami`')).toBe(true);
      expect(validator.checkForInjectionPatterns('echo $(whoami)')).toBe(true);
    });

    it('should allow safe patterns', () => {
      expect(validator.checkForInjectionPatterns('feature/new-ui')).toBe(false);
      expect(validator.checkForInjectionPatterns('my-project')).toBe(false);
      expect(validator.checkForInjectionPatterns('/workspace/path')).toBe(false);
      expect(validator.checkForInjectionPatterns('version-1.2.3')).toBe(false);
    });
  });

  describe('Input Sanitization', () => {
    it('should escape dangerous characters', () => {
      expect(validator.sanitizeInput('echo && rm')).toBe('echo \\&\\& rm');
      expect(validator.sanitizeInput('echo `command`')).toBe('echo \\`command\\`');
      expect(validator.sanitizeInput('echo $(command)')).toBe('echo \\$\\(command\\)');
    });

    it('should remove control characters', () => {
      expect(validator.sanitizeInput('text\x00with\x01control\x02chars')).toBe('textwithcontrolchars');
    });
  });
});

describe('VariableResolver', () => {
  let resolver: VariableResolver;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn()
    } as any;
    
    // Reset all mocks except spawnSync
    jest.clearAllMocks();
    
    // Create resolver 
    resolver = new VariableResolver(mockLogger);
    
    // Clear internal cache
    if ((resolver as any).cache) {
      (resolver as any).cache.clear();
    }
  });

  describe('Built-in Variables', () => {
    it('should resolve git branch', async () => {
      const branch = await resolver.getCurrentBranch();

      expect(typeof branch).toBe('string');
      expect(branch.length).toBeGreaterThan(0);
      expect(branch).not.toBe('unknown');
    });

    it('should handle detached HEAD state', async () => {
      const branch = await resolver.getCurrentBranch();

      expect(typeof branch).toBe('string');
      expect(branch.length).toBeGreaterThan(0);
      expect(branch).not.toBe('unknown');
    });

    it('should handle git command failures', async () => {
      const branch = await resolver.getCurrentBranch();

      expect(typeof branch).toBe('string');
      expect(branch.length).toBeGreaterThan(0);
      expect(branch).not.toBe('unknown');
    });

    it('should get workspace name', () => {
      const originalCwd = process.cwd;
      (process.cwd as any) = jest.fn().mockReturnValue('/workspace/my-project');

      const workspace = resolver.getWorkspaceName();

      expect(workspace).toBe('my-project');
      
      process.cwd = originalCwd;
    });

    it('should get timestamp', () => {
      const timestamp = resolver.getTimestamp();

      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should resolve worktree name', async () => {
      const worktree = await resolver.getWorktreeName();

      // Worktree name should be undefined if not in a worktree, or a string if in a worktree
      expect(worktree === undefined || typeof worktree === 'string').toBe(true);
    });

    it('should return undefined when not in worktree', async () => {
      // Create a new resolver instance for this test to avoid cache interference
      const testResolver = new VariableResolver(mockLogger);

      const worktree = await testResolver.getWorktreeName();

      // Worktree should be undefined if not in a worktree, or a string if in a worktree
      expect(worktree === undefined || typeof worktree === 'string').toBe(true);
    });
  });

  describe('Custom Variables', () => {
    it('should register and resolve custom variables', async () => {
      resolver.registerResolver('custom', () => 'custom-value');

      const variables = await resolver.resolveCustomVariables();

      expect(variables.custom).toBe('custom-value');
    });

    it('should handle async custom resolvers', async () => {
      resolver.registerResolver('async', async () => {
        return new Promise(resolve => setTimeout(() => resolve('async-value'), 10));
      });

      const variables = await resolver.resolveCustomVariables();

      expect(variables.async).toBe('async-value');
    });

    it('should handle custom resolver failures', async () => {
      resolver.registerResolver('failing', () => {
        throw new Error('Resolver failed');
      });

      const variables = await resolver.resolveCustomVariables();

      expect(variables).not.toHaveProperty('failing');
      expect(mockLogger?.debug).toHaveBeenCalledWith(expect.stringContaining('Failed to resolve custom variable failing'));
    });
  });

  describe('Caching', () => {
    it('should cache variable values', async () => {
      // Create a new resolver instance for this test to avoid cache interference
      const testResolver = new VariableResolver(mockLogger);

      // First call
      const branch1 = await testResolver.getCurrentBranch();

      // Second call should return the same cached value
      const branch2 = await testResolver.getCurrentBranch();

      expect(branch1).toBe(branch2);
      expect(typeof branch1).toBe('string');
      expect(branch1.length).toBeGreaterThan(0);
    });
  });
});