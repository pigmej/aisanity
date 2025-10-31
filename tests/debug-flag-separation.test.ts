import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { discoverAllAisanityContainers } from '../src/utils/container-utils';

/**
 * Test suite for verbose/debug separation in container discovery
 * Validates that:
 * - System-level debug information appears only with --debug flag
 * - User-facing verbose information appears only with --verbose flag
 * - Both types of output appear when both flags are used
 */

describe('Debug Flag Separation', () => {
  let consoleLogSpy: Array<string>;
  let consoleWarnSpy: Array<string>;
  let originalConsoleLog: typeof console.log;
  let originalConsoleWarn: typeof console.warn;

  beforeEach(() => {
    // Capture console output
    consoleLogSpy = [];
    consoleWarnSpy = [];
    originalConsoleLog = console.log;
    originalConsoleWarn = console.warn;
    
    console.log = (...args: any[]) => {
      consoleLogSpy.push(args.join(' '));
    };
    
    console.warn = (...args: any[]) => {
      consoleWarnSpy.push(args.join(' '));
    };

    // Set up mock container data
    process.env.AISANITY_TEST_CONTAINERS = JSON.stringify([
      {
        id: 'abc123',
        name: 'test-container',
        image: 'test:latest',
        status: 'running',
        labels: {
          'aisanity.workspace': '/test/workspace',
          'aisanity.branch': 'main',
        },
        ports: '3000',
      },
      {
        id: 'def456',
        name: 'orphaned-container',
        image: 'test:latest',
        status: 'exited',
        labels: {
          'aisanity.workspace': '/nonexistent/path',
          'aisanity.branch': 'feature',
        },
        ports: '',
      },
    ]);
  });

  afterEach(() => {
    // Restore console
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    
    // Clean up test environment
    delete process.env.AISANITY_TEST_CONTAINERS;
  });

  test('verbose mode shows only user-facing information', async () => {
    const result = await discoverAllAisanityContainers({
      mode: 'global',
      includeOrphaned: true,
      validationMode: 'permissive',
      verbose: true,
      debug: false,
    });

    // Verify discovery succeeded
    expect(result.containers.length).toBeGreaterThan(0);

    // Capture all output
    const allOutput = consoleLogSpy.join('\n');

    // Debug messages should NOT appear with verbose-only
    expect(allOutput).not.toContain('[Discovery] Found');
    expect(allOutput).not.toContain('[Discovery] Completed in');
    expect(allOutput).not.toContain('[Discovery] Total:');
    expect(allOutput).not.toContain('[Validation] Validated');

    // User-facing information should NOT be in console output
    // (it should be formatted by caller using formatOrphanedContainerInfo)
  });

  test('debug mode shows only system-level information', async () => {
    const result = await discoverAllAisanityContainers({
      mode: 'global',
      includeOrphaned: true,
      validationMode: 'permissive',
      verbose: false,
      debug: true,
    });

    // Verify discovery succeeded
    expect(result.containers.length).toBeGreaterThan(0);

    // Capture all output
    const allOutput = consoleLogSpy.join('\n');

    // Debug messages SHOULD appear
    expect(allOutput).toContain('[Discovery] Found');
    expect(allOutput).toContain('[Discovery] Completed in');
    expect(allOutput).toContain('[Discovery] Total:');
    expect(allOutput).toContain('[Validation] Validated');

    // User-facing information should NOT appear (handled by caller)
  });

  test('both flags show all information', async () => {
    const result = await discoverAllAisanityContainers({
      mode: 'global',
      includeOrphaned: true,
      validationMode: 'permissive',
      verbose: true,
      debug: true,
    });

    // Verify discovery succeeded
    expect(result.containers.length).toBeGreaterThan(0);

    // Capture all output
    const allOutput = consoleLogSpy.join('\n');

    // Debug messages SHOULD appear
    expect(allOutput).toContain('[Discovery] Found');
    expect(allOutput).toContain('[Discovery] Completed in');
    expect(allOutput).toContain('[Discovery] Total:');
    expect(allOutput).toContain('[Validation] Validated');
  });

  test('no flags show minimal output', async () => {
    const result = await discoverAllAisanityContainers({
      mode: 'global',
      includeOrphaned: true,
      validationMode: 'permissive',
      verbose: false,
      debug: false,
    });

    // Verify discovery succeeded
    expect(result.containers.length).toBeGreaterThan(0);

    // Capture all output
    const allOutput = consoleLogSpy.join('\n');

    // No debug or verbose messages should appear
    expect(allOutput).not.toContain('[Discovery]');
    expect(allOutput).not.toContain('[Validation]');
  });

  test('discovery messages are properly classified as debug-level', async () => {
    await discoverAllAisanityContainers({
      mode: 'global',
      includeOrphaned: true,
      validationMode: 'permissive',
      verbose: false,
      debug: true,
    });

    const allOutput = consoleLogSpy.join('\n');

    // All discovery process messages should be prefixed with [Discovery]
    const discoveryMessages = consoleLogSpy.filter(msg => msg.includes('[Discovery]'));
    expect(discoveryMessages.length).toBeGreaterThan(0);

    // Validation messages should be prefixed with [Validation]
    const validationMessages = consoleLogSpy.filter(msg => msg.includes('[Validation]'));
    expect(validationMessages.length).toBeGreaterThan(0);

    // Verify timing information is included in debug output
    expect(allOutput).toMatch(/\[Discovery\] Completed in \d+ms/);
  });

  test('validation details appear in debug but not verbose', async () => {
    await discoverAllAisanityContainers({
      mode: 'global',
      includeOrphaned: true,
      validationMode: 'permissive',
      verbose: false,
      debug: true,
    });

    const allOutput = consoleLogSpy.join('\n');

    // Validation summary should appear in debug
    expect(allOutput).toContain('[Validation] Validated');
    expect(allOutput).toMatch(/\d+ valid, \d+ invalid/);
  });

  test('container counts appear in debug output', async () => {
    await discoverAllAisanityContainers({
      mode: 'global',
      includeOrphaned: true,
      validationMode: 'permissive',
      verbose: false,
      debug: true,
    });

    const allOutput = consoleLogSpy.join('\n');

    // Container counts should be in debug output
    expect(allOutput).toContain('Total:');
    expect(allOutput).toContain('Labeled:');
    expect(allOutput).toContain('Unlabeled:');
    expect(allOutput).toContain('Orphaned:');
  });
});
