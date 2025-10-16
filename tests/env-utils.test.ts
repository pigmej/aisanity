import { describe, it, expect, beforeEach } from 'bun:test';
import {
  validateEnvPattern,
  matchEnvPattern,
  isValidEnvVarName,
  collectHostEnv,
  parseCliEnvVars,
  mergeEnvVariables,
  formatRemoteEnvArgs,
  validateWhitelistPatterns,
  processEnvironmentVariables,
  generateDevcontainerEnvFlags
} from '../src/utils/env-utils';
import { AisanityConfig } from '../src/utils/config';

// Mock process.env for testing
const originalEnv = process.env;

describe('Environment Variable Utilities', () => {
  beforeEach(() => {
    // Reset process.env to a known state
    process.env = { ...originalEnv };
  });

  describe('validateEnvPattern', () => {
    it('should accept valid patterns', () => {
      expect(validateEnvPattern('HTTP_*')).toBe(true);
      expect(validateEnvPattern('OPENCODE_*')).toBe(true);
      expect(validateEnvPattern('NODE_ENV')).toBe(true);
      expect(validateEnvPattern('DB_*_URL')).toBe(true);
      expect(validateEnvPattern('API_?')).toBe(true);
    });

    it('should reject invalid patterns', () => {
      expect(validateEnvPattern('')).toBe(false);
      expect(validateEnvPattern('*')).toBe(false);
      expect(validateEnvPattern('**')).toBe(false);
      expect(validateEnvPattern('INVALID PATTERN')).toBe(false);
      expect(validateEnvPattern('pattern@invalid')).toBe(false);
    });
  });

  describe('matchEnvPattern', () => {
    it('should correctly match wildcard patterns', () => {
      expect(matchEnvPattern('HTTP_*', 'HTTP_PROXY')).toBe(true);
      expect(matchEnvPattern('HTTP_*', 'HTTPS_PROXY')).toBe(false);
      expect(matchEnvPattern('OPENCODE_*', 'OPENCODE_HOST')).toBe(true);
      expect(matchEnvPattern('OPENCODE_*', 'OPENCODE_AUTO_SHARE')).toBe(true);
      expect(matchEnvPattern('OPENCODE_*', 'OTHER_VAR')).toBe(false);
    });

    it('should correctly match single-character wildcards', () => {
      expect(matchEnvPattern('API_?', 'API_1')).toBe(true);
      expect(matchEnvPattern('API_?', 'API_A')).toBe(true);
      expect(matchEnvPattern('API_?', 'API_12')).toBe(false);
    });

    it('should handle complex patterns', () => {
      expect(matchEnvPattern('DB_*_URL', 'DB_MAIN_URL')).toBe(true);
      expect(matchEnvPattern('DB_*_URL', 'DB_BACKUP_URL')).toBe(true);
      expect(matchEnvPattern('DB_*_URL', 'DB_URL')).toBe(false);
    });
  });

  describe('isValidEnvVarName', () => {
    it('should accept valid POSIX environment variable names', () => {
      expect(isValidEnvVarName('PATH')).toBe(true);
      expect(isValidEnvVarName('HOME')).toBe(true);
      expect(isValidEnvVarName('NODE_ENV')).toBe(true);
      expect(isValidEnvVarName('HTTP_PROXY')).toBe(true);
      expect(isValidEnvVarName('_SECRET')).toBe(true);
      expect(isValidEnvVarName('VAR123')).toBe(true);
    });

    it('should reject invalid environment variable names', () => {
      expect(isValidEnvVarName('1INVALID')).toBe(false);
      expect(isValidEnvVarName('INVALID-VAR')).toBe(false);
      expect(isValidEnvVarName('INVALID VAR')).toBe(false);
      expect(isValidEnvVarName('INVALID.VAR')).toBe(false);
      expect(isValidEnvVarName('')).toBe(false);
    });
  });

  describe('parseCliEnvVars', () => {
    it('should parse valid key=value pairs', () => {
      const result = parseCliEnvVars(['NODE_ENV=development', 'DEBUG=true']);
      expect(result).toEqual({
        NODE_ENV: 'development',
        DEBUG: 'true'
      });
    });

    it('should handle values with equals signs', () => {
      const result = parseCliEnvVars(['URL=http://example.com?foo=bar']);
      expect(result).toEqual({
        URL: 'http://example.com?foo=bar'
      });
    });

    it('should handle empty values', () => {
      const result = parseCliEnvVars(['EMPTY=', 'FOO=bar']);
      expect(result).toEqual({
        EMPTY: '',
        FOO: 'bar'
      });
    });

    it('should throw errors for invalid formats', () => {
      expect(() => parseCliEnvVars(['INVALID'])).toThrow('Invalid environment variable format');
      expect(() => parseCliEnvVars(['=VALUE'])).toThrow('Empty key name');
    });

    it('should throw errors for invalid variable names', () => {
      expect(() => parseCliEnvVars(['1INVALID=value'])).toThrow('Invalid environment variable name');
    });
  });

  describe('collectHostEnv', () => {
    beforeEach(() => {
      // Set up test environment variables
      process.env.HTTP_PROXY = 'http://proxy.example.com';
      process.env.HTTPS_PROXY = 'https://proxy.example.com';
      process.env.NODE_ENV = 'development';
      process.env.PATH = '/usr/bin:/bin';
      process.env.HOME = '/home/user';
      process.env.OPENCODE_HOST = 'localhost';
      process.env.OPENCODE_PORT = '3000';
      process.env.SECRET_VAR = 'secret';
    });

    it('should collect variables matching whitelist patterns', () => {
      const whitelist = ['HTTP_*', 'OPENCODE_*'];
      const result = collectHostEnv(whitelist);
      
      expect(result).toEqual({
        HTTP_PROXY: 'http://proxy.example.com',
        OPENCODE_HOST: 'localhost',
        OPENCODE_PORT: '3000'
      });
    });

    it('should not collect blocked system variables', () => {
      const whitelist = ['*']; // This would be rejected by validation, but let's test the collection
      const result = collectHostEnv(['PATH', 'HOME', 'USER']);
      
      // Should not include blocked variables even if they match patterns
      expect(result).not.toHaveProperty('PATH');
      expect(result).not.toHaveProperty('HOME');
    });

    it('should return empty object for empty whitelist', () => {
      const result = collectHostEnv([]);
      expect(result).toEqual({});
    });

    it('should handle undefined values', () => {
      process.env.UNDEFINED_VAR = undefined;
      const whitelist = ['UNDEFINED_VAR'];
      const result = collectHostEnv(whitelist);
      expect(result).not.toHaveProperty('UNDEFINED_VAR');
    });
  });

  describe('mergeEnvVariables', () => {
    it('should merge with correct precedence (CLI > config > host)', () => {
      const cliEnv = { NODE_ENV: 'test', CLI_VAR: 'cli_value' };
      const hostEnv = { NODE_ENV: 'development', HOST_VAR: 'host_value' };
      const configEnv = { NODE_ENV: 'production', CONFIG_VAR: 'config_value' };
      const whitelist = ['NODE_ENV', 'HOST_VAR'];

      const result = mergeEnvVariables(cliEnv, hostEnv, configEnv, whitelist);

      expect(result).toEqual({
        NODE_ENV: 'test', // CLI takes precedence
        CONFIG_VAR: 'config_value', // From config
        HOST_VAR: 'host_value', // From host
        CLI_VAR: 'cli_value' // From CLI
      });
    });

    it('should handle empty inputs', () => {
      const result = mergeEnvVariables({}, {}, {}, []);
      expect(result).toEqual({});
    });
  });

  describe('formatRemoteEnvArgs', () => {
    it('should format environment variables for devcontainer', () => {
      const env = { NODE_ENV: 'development', DEBUG: 'true' };
      const result = formatRemoteEnvArgs(env);
      
      expect(result).toEqual([
        '--remote-env=NODE_ENV=development',
        '--remote-env=DEBUG=true'
      ]);
    });

    it('should handle empty environment', () => {
      const result = formatRemoteEnvArgs({});
      expect(result).toEqual([]);
    });

    it('should handle special characters in values', () => {
      const env = { URL: 'http://example.com?foo=bar&baz=qux' };
      const result = formatRemoteEnvArgs(env);
      
      expect(result).toEqual([
        '--remote-env=URL=http://example.com?foo=bar&baz=qux'
      ]);
    });
  });

  describe('validateWhitelistPatterns', () => {
    it('should validate correct patterns', () => {
      const result = validateWhitelistPatterns(['HTTP_*', 'NODE_ENV', 'OPENCODE_*']);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    it('should reject overly broad patterns', () => {
      const result = validateWhitelistPatterns(['*']);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid whitelist pattern');
    });

    it('should warn about potentially broad patterns', () => {
      const result = validateWhitelistPatterns(['A*']);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Potentially broad whitelist pattern: "A*". Consider being more specific');
    });

    it('should warn about empty whitelist', () => {
      const result = validateWhitelistPatterns([]);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('No whitelist patterns specified - no host environment variables will be passed through');
    });
  });

  describe('processEnvironmentVariables', () => {
    beforeEach(() => {
      process.env.HTTP_PROXY = 'http://proxy.example.com';
      process.env.NODE_ENV = 'development';
    });

    it('should process environment variables correctly', () => {
      const config: AisanityConfig = {
        workspace: 'test',
        env: { CONFIG_VAR: 'config_value' },
        envWhitelist: ['HTTP_*']
      };
      const cliEnvVars = ['CLI_VAR=cli_value'];

      const result = processEnvironmentVariables(config, cliEnvVars);

      expect(result.cli).toEqual({ CLI_VAR: 'cli_value' });
      expect(result.host).toEqual({ HTTP_PROXY: 'http://proxy.example.com' });
      expect(result.config).toEqual({ CONFIG_VAR: 'config_value' });
      expect(result.merged).toEqual({
        CLI_VAR: 'cli_value',
        CONFIG_VAR: 'config_value',
        HTTP_PROXY: 'http://proxy.example.com'
      });
    });

    it('should handle missing envWhitelist', () => {
      const config: AisanityConfig = {
        workspace: 'test',
        env: { CONFIG_VAR: 'config_value' }
      };
      const cliEnvVars = [];

      const result = processEnvironmentVariables(config, cliEnvVars);

      expect(result.host).toEqual({});
      expect(result.merged).toEqual({ CONFIG_VAR: 'config_value' });
    });

    it('should throw error for invalid whitelist patterns', () => {
      const config: AisanityConfig = {
        workspace: 'test',
        envWhitelist: ['*'] // Invalid pattern
      };

      expect(() => processEnvironmentVariables(config, [])).toThrow('Environment variable whitelist validation failed');
    });
  });

  describe('generateDevcontainerEnvFlags', () => {
    it('should generate devcontainer flags', () => {
      const envVars = { NODE_ENV: 'development', DEBUG: 'true' };
      const result = generateDevcontainerEnvFlags(envVars);
      
      expect(result).toEqual([
        '--remote-env=NODE_ENV=development',
        '--remote-env=DEBUG=true'
      ]);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large numbers of environment variables efficiently', () => {
      // Set up many environment variables
      for (let i = 0; i < 1000; i++) {
        process.env[`TEST_VAR_${i}`] = `value_${i}`;
      }

      const whitelist = ['TEST_VAR_*'];
      const start = performance.now();
      const result = collectHostEnv(whitelist);
      const end = performance.now();

      expect(Object.keys(result).length).toBe(1000);
      expect(end - start).toBeLessThan(50); // Should complete in under 50ms
    });

    it('should handle many whitelist patterns efficiently', () => {
      // Set up test environment
      process.env.TEST_VAR_1 = 'value1';
      process.env.TEST_VAR_2 = 'value2';

      const whitelist = Array.from({ length: 100 }, (_, i) => `PATTERN_${i}_*`);
      const start = performance.now();
      const result = collectHostEnv(whitelist);
      const end = performance.now();

      expect(end - start).toBeLessThan(20); // Should complete in under 20ms
    });
  });
});