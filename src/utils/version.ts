import { $ } from 'bun';

// TypeScript global declaration for compile-time VERSION
declare const VERSION: string | undefined;

// Cache variables for development mode
let cachedVersion: string | null = null;
let cacheTimestamp: number | null = null;
const CACHE_TTL_MS = 5000; // 5 seconds

export interface VersionInfo {
  version: string;
  source: 'compile-time' | 'git' | 'fallback';
  isDevelopment: boolean;
  isDirty?: boolean;
}

/**
 * Get compile-time injected VERSION constant
 */
function getCompileTimeVersion(): string | null {
  if (typeof VERSION !== 'undefined') {
    return VERSION;
  }
  return null;
}

/**
 * Get version from git describe command
 */
async function getGitVersion(): Promise<string> {
  try {
    const result = await $`git describe --tags --always`.text();
    return result.trim();
  } catch (error) {
    return getFallbackVersion();
  }
}

/**
 * Get fallback version when git is unavailable
 */
function getFallbackVersion(): string {
  return 'unknown';
}

/**
 * Get cached version or fetch fresh version from git
 */
async function getCachedOrFreshVersion(): Promise<string> {
  const now = Date.now();
  
  if (cachedVersion && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedVersion;
  }
  
  cachedVersion = await getGitVersion();
  cacheTimestamp = now;
  return cachedVersion;
}

/**
 * Clear version cache (useful for testing)
 */
export function clearVersionCache(): void {
  cachedVersion = null;
  cacheTimestamp = null;
}

/**
 * Get application version string (synchronous for CLI compatibility)
 * - Production builds: Uses compile-time injected VERSION
 * - Development mode: Executes git describe synchronously
 * - Fallback: Returns "unknown" if git unavailable
 */
export function getVersion(): string {
  // 1. Check compile-time VERSION
  const compileTimeVersion = getCompileTimeVersion();
  if (compileTimeVersion) {
    return compileTimeVersion;
  }
  
  // 2. Try git describe synchronously for development
  try {
    const result = Bun.spawnSync(['git', 'describe', '--tags', '--always']);
    if (result.success) {
      return new TextDecoder().decode(result.stdout).trim();
    }
  } catch (error) {
    // Fall through to fallback
  }
  
  // 3. Return fallback
  return getFallbackVersion();
}

/**
 * Get application version string (async version for internal use)
 * - Production builds: Uses compile-time injected VERSION
 * - Development mode: Executes git describe with caching
 * - Fallback: Returns "unknown" if git unavailable
 */
export async function getVersionAsync(): Promise<string> {
  // 1. Check compile-time VERSION
  const compileTimeVersion = getCompileTimeVersion();
  if (compileTimeVersion) {
    return compileTimeVersion;
  }
  
  // 2. Try git describe with caching
  return getCachedOrFreshVersion();
}

/**
 * Get detailed version information
 */
export async function getVersionInfo(): Promise<VersionInfo> {
  const compileTimeVersion = getCompileTimeVersion();
  
  if (compileTimeVersion) {
    return {
      version: compileTimeVersion,
      source: 'compile-time',
      isDevelopment: false
    };
  }
  
  // Development mode - get git version
  const version = await getCachedOrFreshVersion();
  const isDirty = version.includes('-dirty');
  
  return {
    version,
    source: version === 'unknown' ? 'fallback' : 'git',
    isDevelopment: true,
    isDirty
  };
}