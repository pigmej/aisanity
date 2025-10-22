/**
 * Argument Templating System
 * Provides secure template substitution with variable resolution and validation
 */

import { Logger } from '../utils/logger';
import { ExecutionContext } from './execution-context';

/**
 * Result of template processing with detailed information
 */
export interface ProcessedCommand {
  command: string;                    // Substituted command string
  args: string[];                    // Processed arguments array
  substitutions: Record<string, string>; // Applied substitutions for logging
  hasPlaceholders: boolean;          // Whether any placeholders were found
  validationErrors: string[];        // Any validation errors found
  executionReady: boolean;           // Whether command is ready for execution
}

/**
 * Template validation result with detailed feedback
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitized?: string;                // Sanitized version of input
}

/**
 * CLI parameter to variable mapping configuration
 */
export interface CLIParameterMapping {
  [cliArg: string]: {
    variable: string;                // Template variable name
    required: boolean;               // Whether parameter is required
    validator?: (value: string) => boolean; // Custom validation
    defaultValue?: string;           // Default value if not provided
  };
}

/**
 * Template variable registry with built-in and user-defined variables
 */
export interface TemplateVariableRegistry {
  // Built-in variables
  branch: string;                    // Current git branch
  workspace: string;                 // Workspace name
  worktree?: string;                 // Worktree name (if applicable)
  timestamp: string;                 // ISO timestamp
  
  // CLI-provided variables
  [key: string]: string | undefined; // User-defined variables from CLI
}

/**
 * Template validator for security and syntax validation
 */
export class TemplateValidator {
  private readonly variableNamePattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  private readonly safeValuePattern = /^[a-zA-Z0-9\s\-_.\/:\\]+$/;
  private readonly injectionPatterns = [
    /[;&|`$(){}[\]]/,               // Shell metacharacters
    /\/etc\//,                      // System file access
    /\/var\/log\//,                 // System log access
    /windows.*system32.*config/i,   // Windows system config access
    /\\.*windows.*system32.*config/i, // Windows system config access with backslashes
    /\brm\s+-rf\s+\//,              // Dangerous rm commands
    /&&.*rm/,                       // Command chaining with rm
    /\|\|.*rm/,                     // Command chaining with rm
  ];

  /**
   * Validate template syntax for security and correctness
   */
  validateTemplateSyntax(template: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check template length
    if (template.length > 1000) {
      errors.push('Template exceeds maximum length of 1000 characters');
    }

    // Check for escaped braces first
    const escapedBraces = template.match(/{{|}}/g);
    if (escapedBraces) {
      warnings.push(`Found ${escapedBraces.length} escaped braces - these will be treated as literal braces`);
    }

    // Temporarily replace escaped braces to avoid false positives
    const templateForValidation = template.replace(/{{/g, '\u0001').replace(/}}/g, '\u0002');

    // Find all placeholders (excluding escaped ones)
    const placeholderRegex = /{([^}]+)}/g;
    let match;
    const placeholders = new Set<string>();

    while ((match = placeholderRegex.exec(templateForValidation)) !== null) {
      const varName = match[1];
      placeholders.add(varName);

      // Validate variable name
      if (!this.validateVariableName(varName)) {
        errors.push(`Invalid variable name: ${varName}`);
      }
    }

    // Check for injection patterns in the template itself (excluding placeholders)
    const templateWithoutPlaceholders = templateForValidation.replace(/{[^}]+}/g, '');
    if (this.checkForInjectionPatterns(templateWithoutPlaceholders)) {
      errors.push('Template contains potentially dangerous injection patterns');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized: this.sanitizeInput(template)
    };
  }

  /**
   * Validate variable name against whitelist
   */
  validateVariableName(name: string): boolean {
    if (name.length > 50) {
      return false;
    }
    return this.variableNamePattern.test(name);
  }

  /**
   * Validate variable value for injection prevention
   */
  validateVariableValue(value: string): boolean {
    if (value.length > 255) {
      return false;
    }
    // Check for injection patterns first
    if (this.checkForInjectionPatterns(value)) {
      return false;
    }
    return this.safeValuePattern.test(value);
  }

  /**
   * Check for command injection patterns
   */
  checkForInjectionPatterns(input: string): boolean {
    return this.injectionPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Sanitize input by removing or escaping dangerous characters
   */
  sanitizeInput(input: string): string {
    // Remove null bytes and control characters
    let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Escape dangerous shell metacharacters
    sanitized = sanitized.replace(/[;&|`$(){}[\]]/g, '\\$&');
    
    return sanitized;
  }
}

/**
 * Variable resolver for built-in and dynamic variables
 */
export class VariableResolver {
  private customResolvers = new Map<string, () => string | Promise<string>>();
  private cache = new Map<string, { value: string; timestamp: number }>();
  private readonly cacheTimeout = 30000; // 30 seconds

  constructor(private logger?: Logger) {}

  /**
   * Resolve all built-in variables
   */
  async resolveBuiltInVariables(): Promise<Record<string, string>> {
    const variables: Record<string, string> = {};

    variables.branch = await this.getCurrentBranch();
    variables.workspace = this.getWorkspaceName();
    const worktreeName = await this.getWorktreeName();
    if (worktreeName) {
      variables.worktree = worktreeName;
    }
    variables.timestamp = this.getTimestamp();

    return variables;
  }

  /**
   * Get current git branch name
   */
  async getCurrentBranch(): Promise<string> {
    const cacheKey = 'branch';
    const cached = this.getCachedValue(cacheKey);
    if (cached) return cached;

    try {
      const result = Bun.spawnSync(['git', 'rev-parse', '--abbrev-ref', 'HEAD']);
      const branch = result.stdout?.toString().trim() || 'unknown';
      
      if (branch === 'HEAD') {
        // Detached HEAD state - get commit hash
        const commitResult = Bun.spawnSync(['git', 'rev-parse', '--short', 'HEAD']);
        const commit = commitResult.stdout?.toString().trim() || 'unknown';
        this.setCachedValue(cacheKey, commit);
        return commit;
      }
      
      this.setCachedValue(cacheKey, branch);
      return branch;
    } catch (error) {
      this.logger?.debug(`Failed to get git branch: ${error}`);
      return 'unknown';
    }
  }

  /**
   * Get workspace name from current directory
   */
  getWorkspaceName(): string {
    const cacheKey = 'workspace';
    const cached = this.getCachedValue(cacheKey);
    if (cached) return cached;

    try {
      const workspace = require('path').basename(process.cwd());
      this.setCachedValue(cacheKey, workspace);
      return workspace;
    } catch (error) {
      this.logger?.debug(`Failed to get workspace name: ${error}`);
      return 'unknown';
    }
  }

  /**
   * Get current worktree name if applicable
   */
  async getWorktreeName(): Promise<string | undefined> {
    const cacheKey = 'worktree';
    const cached = this.getCachedValue(cacheKey);
    if (cached) return cached;

    try {
      // Check if we're in a worktree
      const result = Bun.spawnSync(['git', 'rev-parse', '--is-inside-work-tree']);
      if (result.stdout?.toString().trim() !== 'true') {
        return undefined;
      }

      // Get worktree path
      const worktreeResult = Bun.spawnSync(['git', 'rev-parse', '--show-toplevel']);
      const worktreePath = worktreeResult.stdout?.toString().trim();
      
      if (worktreePath && worktreePath !== process.cwd()) {
        const worktreeName = require('path').basename(worktreePath);
        this.setCachedValue(cacheKey, worktreeName);
        return worktreeName;
      }
      
      return undefined;
    } catch (error) {
      this.logger?.debug(`Failed to get worktree name: ${error}`);
      return undefined;
    }
  }

  /**
   * Get current ISO timestamp
   */
  getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Register custom variable resolver
   */
  registerResolver(name: string, resolver: () => string | Promise<string>): void {
    this.customResolvers.set(name, resolver);
  }

  /**
   * Resolve custom variables
   */
  async resolveCustomVariables(): Promise<Record<string, string>> {
    const variables: Record<string, string> = {};

    for (const [name, resolver] of this.customResolvers) {
      try {
        const value = await resolver();
        variables[name] = value;
      } catch (error) {
        this.logger?.debug(`Failed to resolve custom variable ${name}: ${error}`);
      }
    }

    return variables;
  }

  /**
   * Get cached value if still valid
   */
  private getCachedValue(key: string): string | undefined {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.value;
    }
    return undefined;
  }

  /**
   * Set cached value with timestamp
   */
  private setCachedValue(key: string, value: string): void {
    this.cache.set(key, { value, timestamp: Date.now() });
  }
}

/**
 * Main argument templater class
 */
export class ArgumentTemplater {
  private validator: TemplateValidator;
  private variableResolver: VariableResolver;

  constructor(private logger?: Logger) {
    this.validator = new TemplateValidator();
    this.variableResolver = new VariableResolver(logger);
  }

  /**
   * Substitute template placeholders with variable values
   */
  substituteTemplate(template: string, variables: Record<string, string>): string {
    let result = template;
    const substitutions: Record<string, string> = {};

    // Handle escaped braces first
    result = result.replace(/{{/g, '\u0001').replace(/}}/g, '\u0002');

    // Find and substitute placeholders
    const placeholderRegex = /{(\w+)}/g;
    let match;

    while ((match = placeholderRegex.exec(result)) !== null) {
      const varName = match[1];
      const value = variables[varName];

      if (value !== undefined) {
        substitutions[varName] = value;
        result = result.replace(match[0], value);
      }
    }

    // Restore escaped braces
    result = result.replace(/\u0001/g, '{').replace(/\u0002/g, '}');

    this.logger?.debug(`Template substitution: ${JSON.stringify(substitutions)}`);
    return result;
  }

  /**
   * Process complete command with arguments and CLI parameters
   */
  async processCommandArgs(
    command: string,
    args: string[],
    cliParams: Record<string, string>
  ): Promise<ProcessedCommand> {
    const validationErrors: string[] = [];
    const substitutions: Record<string, string> = {};

    // Validate command template
    const commandValidation = this.validator.validateTemplateSyntax(command);
    if (!commandValidation.isValid) {
      validationErrors.push(...commandValidation.errors);
    }

    // Validate arguments
    for (const arg of args) {
      const argValidation = this.validator.validateTemplateSyntax(arg);
      if (!argValidation.isValid) {
        validationErrors.push(...argValidation.errors);
      }
    }

    // Resolve all variables
    const builtInVars = await this.variableResolver.resolveBuiltInVariables();
    const customVars = await this.variableResolver.resolveCustomVariables();
    const allVariables = { ...builtInVars, ...customVars, ...cliParams };

    // Validate CLI parameters
    for (const [key, value] of Object.entries(cliParams)) {
      if (!this.validator.validateVariableName(key)) {
        validationErrors.push(`Invalid CLI parameter name: ${key}`);
      }
      if (!this.validator.validateVariableValue(value)) {
        validationErrors.push(`Invalid CLI parameter value for ${key}: ${value}`);
      }
    }

    // Substitute command
    const processedCommand = this.substituteTemplate(command, allVariables);
    const hasCommandPlaceholders = command !== processedCommand;

    // Substitute arguments
    const processedArgs: string[] = [];
    let hasArgPlaceholders = false;

    for (const arg of args) {
      const processedArg = this.substituteTemplate(arg, allVariables);
      processedArgs.push(processedArg);
      if (arg !== processedArg) {
        hasArgPlaceholders = true;
      }
    }

    // Track substitutions
    for (const [key, value] of Object.entries(allVariables)) {
      if (command.includes(`{${key}}`) || args.some(arg => arg.includes(`{${key}}`))) {
        substitutions[key] = value;
      }
    }

    return {
      command: processedCommand,
      args: processedArgs,
      substitutions,
      hasPlaceholders: hasCommandPlaceholders || hasArgPlaceholders,
      validationErrors,
      executionReady: validationErrors.length === 0
    };
  }

  /**
   * Validate individual template variable
   */
  validateTemplateVariable(name: string, value: string): boolean {
    return this.validator.validateVariableName(name) &&
           this.validator.validateVariableValue(value);
  }

  /**
   * Resolve all available variables for a context
   */
  async resolveVariables(context: ExecutionContext): Promise<Record<string, string>> {
    const builtInVars = await this.variableResolver.resolveBuiltInVariables();
    const customVars = await this.variableResolver.resolveCustomVariables();
    
    return {
      ...builtInVars,
      ...customVars,
      ...context.variables
    };
  }

  /**
   * Validate template syntax
   */
  validateTemplateSyntax(template: string): ValidationResult {
    return this.validator.validateTemplateSyntax(template);
  }
}