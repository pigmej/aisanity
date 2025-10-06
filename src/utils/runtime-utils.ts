/**
 * Runtime utilities for cross-platform compatibility between Node.js and Bun
 */

export function isBunRuntime(): boolean {
  return typeof globalThis !== 'undefined' && 'Bun' in globalThis;
}

/**
 * Enhanced execSync with Bun.$ fallback for shell commands
 */
export async function safeExecSync(command: string, options: {
  encoding?: BufferEncoding;
  timeout?: number;
  cwd?: string;
  stdio?: any;
} = {}): Promise<string> {
  const { encoding = 'utf8', timeout = 10000, cwd, stdio } = options;

  if (isBunRuntime()) {
    const bunGlobal = globalThis as any;
    try {
      if (stdio === 'inherit') {
        // For inherit stdio, we need to use Bun.spawn with inherited streams
        const result = await bunGlobal.Bun.$`bash -c ${command}`;
        return result.text() || '';
      } else {
        // For regular execution, use Bun.$ with text output
        return await bunGlobal.Bun.$`bash -c ${command}`.text();
      }
    } catch (error: any) {
      // Re-throw with similar structure to execSync errors
      throw new Error(`Command failed: ${command}\n${error.message}`);
    }
  } else {
    // Node.js fallback
    const { execSync } = require('child_process');
    return execSync(command, { encoding, timeout, cwd, stdio });
  }
}

/**
 * Safe spawn with Bun.spawn fallback for child_process.spawn
 */
export function safeSpawn(command: string, args: string[], options: any = {}) {
  if (isBunRuntime()) {
    const bunGlobal = globalThis as any;
    return bunGlobal.Bun.spawn([command, ...args], options);
  } else {
    const { spawn } = require('child_process');
    return spawn(command, args, options);
  }
}

/**
 * Synchronous version of safeExecSync for backward compatibility
 */
export function safeExecSyncSync(command: string, options: {
  encoding?: BufferEncoding;
  timeout?: number;
  cwd?: string;
  stdio?: any;
} = {}): string {
  const { encoding = 'utf8', timeout = 10000, cwd, stdio } = options;

  // For synchronous execution, always use Node.js fallback for consistency
  // Bun doesn't provide a good synchronous shell execution method
  const { execSync } = require('child_process');
  return execSync(command, { encoding, timeout, cwd, stdio });
}

/**
 * Runtime information utility
 */
export type RuntimeEnvironment = 'node' | 'bun';

export interface RuntimeInfo {
  runtime: RuntimeEnvironment;
  version: string;
  features: {
    nativeTypeScript: boolean;
    enhancedSpawn: boolean;
    shellHelper: boolean;
  };
}

// Also export as a const for better runtime compatibility
export const RuntimeInfoType = {} as RuntimeInfo;

export function getRuntimeInfo(): RuntimeInfo {
  const isBun = isBunRuntime();
  const bunGlobal = globalThis as any;
  return {
    runtime: isBun ? 'bun' : 'node',
    version: isBun ? bunGlobal.Bun?.version || 'unknown' : process.version,
    features: {
      nativeTypeScript: isBun,
      enhancedSpawn: isBun,
      shellHelper: isBun
    }
  };
}