import { AisanityConfig } from './config';

// Pattern cache for performance optimization
const patternCache = new Map<string, RegExp>();

// Default blocked system variables for security
const DEFAULT_BLOCKED_VARS = [
  'PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'LANG', 'LC_*',
  'SSH_AUTH_SOCK', 'SSH_AGENT_PID', 'GPG_AGENT_INFO'
];

export interface EnvCollection {
  cli: Record<string, string>;
  host: Record<string, string>;
  config: Record<string, string>;
  merged: Record<string, string>;
}

export interface PatternValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

export interface EnvProcessingOptions {
  dryRun?: boolean;
  verbose?: boolean;
  securityLevel?: 'strict' | 'moderate' | 'permissive';
}

/**
 * Convert wildcard pattern to regex
 */
function wildcardToRegex(pattern: string): RegExp {
  // Escape regex special characters except * and ?
  let regexPattern = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  
  // Convert wildcards to regex equivalents
  regexPattern = regexPattern.replace(/\*/g, '.*');
  regexPattern = regexPattern.replace(/\?/g, '.');
  
  // Anchor to start and end
  regexPattern = `^${regexPattern}$`;
  
  return new RegExp(regexPattern);
}

/**
 * Get compiled pattern from cache or create new one
 */
function getCompiledPattern(pattern: string): RegExp {
  if (!patternCache.has(pattern)) {
    // Limit cache size to prevent memory leaks
    if (patternCache.size > 100) {
      const firstKey = patternCache.keys().next().value;
      if (firstKey !== undefined) {
        patternCache.delete(firstKey);
      }
    }
    patternCache.set(pattern, wildcardToRegex(pattern));
  }
  return patternCache.get(pattern)!;
}

/**
 * Validate environment variable pattern
 */
export function validateEnvPattern(pattern: string): boolean {
  if (!pattern || pattern.trim() === '') {
    return false;
  }
  
  // Reject overly broad patterns
  if (pattern === '*' || pattern === '**') {
    return false;
  }
  
  // Basic pattern validation - allow alphanumeric, underscore, dash, and wildcards
  const validPattern = /^[A-Za-z0-9_*?-]+$/;
  return validPattern.test(pattern);
}

/**
 * Check if environment variable name matches a pattern
 */
export function matchEnvPattern(pattern: string, varName: string): boolean {
  if (!validateEnvPattern(pattern)) {
    return false;
  }
  
  const regex = getCompiledPattern(pattern);
  return regex.test(varName);
}

/**
 * Check if environment variable name is valid (POSIX standard)
 */
export function isValidEnvVarName(name: string): boolean {
  // POSIX environment variable names: start with letter or underscore, 
  // followed by letters, digits, or underscores
  const posixPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
  return posixPattern.test(name);
}

/**
 * Check if variable is blocked for security reasons
 */
function isBlockedVariable(varName: string): boolean {
  return DEFAULT_BLOCKED_VARS.some(blocked => {
    if (blocked.endsWith('*')) {
      return varName.startsWith(blocked.slice(0, -1));
    }
    return varName === blocked;
  });
}

/**
 * Collect host environment variables based on whitelist patterns
 */
export function collectHostEnv(whitelist: string[]): Record<string, string> {
  const collected: Record<string, string> = {};
  
  if (!whitelist || whitelist.length === 0) {
    return collected;
  }
  
  // Filter out invalid patterns
  const validPatterns = whitelist.filter(validateEnvPattern);
  
  for (const [key, value] of Object.entries(process.env)) {
    // Skip if no value or variable is blocked
    if (value === undefined || value === '' || isBlockedVariable(key)) {
      continue;
    }
    
    // Check if variable matches any whitelist pattern
    const matches = validPatterns.some(pattern => matchEnvPattern(pattern, key));
    if (matches) {
      collected[key] = value;
    }
  }
  
  return collected;
}

/**
 * Parse CLI environment variable arguments
 */
export function parseCliEnvVars(cliEnvArgs: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  
  for (const arg of cliEnvArgs) {
    // Split on first = only
    const equalIndex = arg.indexOf('=');
    
    if (equalIndex === -1) {
      throw new Error(`Invalid environment variable format: "${arg}". Expected key=value`);
    }
    
    const key = arg.substring(0, equalIndex);
    const value = arg.substring(equalIndex + 1);
    
    if (!key) {
      throw new Error(`Invalid environment variable format: "${arg}". Empty key name`);
    }
    
    if (!isValidEnvVarName(key)) {
      throw new Error(`Invalid environment variable name: "${key}". Must follow POSIX naming rules`);
    }
    
    // Empty values are allowed (e.g., FOO=)
    parsed[key] = value;
  }
  
  return parsed;
}

/**
 * Merge environment variables with precedence: CLI > config > host
 */
export function mergeEnvVariables(
  cliEnv: Record<string, string>,
  hostEnv: Record<string, string>,
  configEnv: Record<string, string>,
  _whitelist: string[]
): Record<string, string> {
  const merged: Record<string, string> = {};
  
  // Start with config environment variables (lowest precedence)
  Object.assign(merged, configEnv);
  
  // Add host environment variables (middle precedence)
  // Only add if not already present from config
  for (const [key, value] of Object.entries(hostEnv)) {
    if (!(key in merged)) {
      merged[key] = value;
    }
  }
  
  // Add CLI environment variables (highest precedence)
  // CLI vars bypass whitelist filtering as they are explicitly set by user
  Object.assign(merged, cliEnv);
  
  return merged;
}

/**
 * Format environment variables for devcontainer --remote-env flags
 */
export function formatRemoteEnvArgs(env: Record<string, string>): string[] {
  return Object.entries(env).map(([key, value]) => `--remote-env=${key}=${value}`);
}

/**
 * Validate whitelist patterns
 */
export function validateWhitelistPatterns(patterns: string[]): PatternValidationResult {
  const warnings: string[] = [];
  
  if (!patterns || patterns.length === 0) {
    return { isValid: true, warnings: ['No whitelist patterns specified - no host environment variables will be passed through'] };
  }
  
  for (const pattern of patterns) {
    if (!validateEnvPattern(pattern)) {
      return { 
        isValid: false, 
        error: `Invalid whitelist pattern: "${pattern}". Patterns may contain letters, numbers, underscores, hyphens, and wildcards (*, ?)` 
      };
    }
    
    // Check for overly broad patterns
    if (pattern === '*' || pattern === '**') {
      return { 
        isValid: false, 
        error: `Overly broad whitelist pattern: "${pattern}". This would allow all environment variables` 
      };
    }
    
    // Warn about potentially broad patterns
    if (pattern.length < 3) {
      warnings.push(`Potentially broad whitelist pattern: "${pattern}". Consider being more specific`);
    }
  }
  
  return { isValid: true, warnings };
}

/**
 * Process environment variables according to configuration and CLI options
 */
export function processEnvironmentVariables(
  config: AisanityConfig,
  cliEnvVars: string[],
  _options: EnvProcessingOptions = {}
): EnvCollection {
  // Parse CLI environment variables
  const cliEnv = parseCliEnvVars(cliEnvVars);
  
  // Get whitelist from config
  const whitelist = (config as any).envWhitelist || [];
  
  // Validate whitelist patterns
  const validation = validateWhitelistPatterns(whitelist);
  if (!validation.isValid) {
    throw new Error(`Environment variable whitelist validation failed: ${validation.error}`);
  }
  
  // Collect host environment variables
  const hostEnv = collectHostEnv(whitelist);
  
  // Get config environment variables
  const configEnv = config.env || {};
  
  // Merge with precedence
  const merged = mergeEnvVariables(cliEnv, hostEnv, configEnv, whitelist);
  
  return {
    cli: cliEnv,
    host: hostEnv,
    config: configEnv,
    merged
  };
}

/**
 * Generate devcontainer remote environment flags
 */
export function generateDevcontainerEnvFlags(envVars: Record<string, string>): string[] {
  return formatRemoteEnvArgs(envVars);
}