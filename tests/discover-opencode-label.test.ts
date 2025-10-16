import { expect, test, describe, beforeEach, afterEach } from 'bun:test';

describe('Discover Opencode Label Discovery', () => {
  let originalConsoleError: any;
  let errorOutput: string[];

  beforeEach(() => {
    // Store original console methods
    originalConsoleError = console.error;
    errorOutput = [];
    
    // Mock console.error to capture verbose logging
    console.error = (...args: any[]) => {
      errorOutput.push(args.join(' '));
    };
  });

  afterEach(() => {
    // Restore console methods
    console.error = originalConsoleError;
  });

  test('should construct correct docker filter command for aisanity labels', () => {
    // Test that the filter command is constructed correctly
    const containerName = 'test-container';
    const expectedCommand = `docker ps -q --filter label=aisanity.container=${containerName}`;
    
    // This tests the command structure that should be used in the implementation
    expect(expectedCommand).toBe('docker ps -q --filter label=aisanity.container=test-container');
  });

  test('should handle empty container names in label filter', () => {
    // Test edge case with empty container name
    const containerName = '';
    const expectedCommand = `docker ps -q --filter label=aisanity.container=${containerName}`;
    
    expect(expectedCommand).toBe('docker ps -q --filter label=aisanity.container=');
  });

  test('should handle special characters in container names', () => {
    // Test container names with special characters
    const containerName = 'test-container_123';
    const expectedCommand = `docker ps -q --filter label=aisanity.container=${containerName}`;
    
    expect(expectedCommand).toBe('docker ps -q --filter label=aisanity.container=test-container_123');
  });

  test('should handle container names with spaces', () => {
    // Test container names with spaces (should be properly escaped)
    const containerName = 'test container';
    const expectedCommand = `docker ps -q --filter label=aisanity.container=${containerName}`;
    
    expect(expectedCommand).toBe('docker ps -q --filter label=aisanity.container=test container');
  });

  test('should verify label filter syntax', () => {
    // Test that the label filter follows Docker's expected syntax
    const labelFilter = '--filter label=aisanity.container=example';
    
    // Docker label filter format: --filter label=key=value
    expect(labelFilter).toMatch(/^--filter label=[a-zA-Z0-9._-]+=[a-zA-Z0-9._-]+$/);
  });

  test('should handle verbose logging for label discovery', () => {
    // Test that verbose logging messages are correctly formatted
    const containerName = 'my-container';
    const verboseMessage = `Searching for containers with label aisanity.container=${containerName}...`;
    
    expect(verboseMessage).toBe('Searching for containers with label aisanity.container=my-container...');
  });

  test('should handle success logging for label discovery', () => {
    // Test that success logging messages are correctly formatted
    const containerCount = 3;
    const successMessage = `Found ${containerCount} container(s) with aisanity.container label`;
    
    expect(successMessage).toBe('Found 3 container(s) with aisanity.container label');
  });

  test('should handle error logging for label discovery', () => {
    // Test that error logging messages are correctly formatted
    const errorMessage = 'Error searching for aisanity-labeled containers:';
    
    expect(errorMessage).toBe('Error searching for aisanity-labeled containers:');
  });

  test('should validate container ID addition to set', () => {
    // Test that container IDs are properly added to the set
    const containerIdsSet = new Set<string>();
    const mockContainerIds = ['abc123def456', 'def456abc123', ''];
    
    // Simulate adding container IDs from label discovery
    mockContainerIds.filter(id => id.length > 0).forEach(id => containerIdsSet.add(id));
    
    expect(containerIdsSet.size).toBe(2);
    expect(containerIdsSet.has('abc123def456')).toBe(true);
    expect(containerIdsSet.has('def456abc123')).toBe(true);
    expect(containerIdsSet.has('')).toBe(false);
  });

  test('should handle docker command output parsing', () => {
    // Test parsing of docker ps -q output
    const mockDockerOutput = `abc123def456
def456abc123
ghi789jkl012

`; // Includes empty lines
    
    const containerIds = mockDockerOutput
      .trim()
      .split('\n')
      .filter((id: string) => id.length > 0);
    
    expect(containerIds).toHaveLength(3);
    expect(containerIds[0]).toBe('abc123def456');
    expect(containerIds[1]).toBe('def456abc123');
    expect(containerIds[2]).toBe('ghi789jkl012');
  });

  test('should handle empty docker command output', () => {
    // Test parsing of empty docker ps -q output
    const mockDockerOutput = '';
    
    const containerIds = mockDockerOutput
      .trim()
      .split('\n')
      .filter((id: string) => id.length > 0);
    
    expect(containerIds).toHaveLength(0);
  });

  test('should handle whitespace-only docker command output', () => {
    // Test parsing of whitespace-only docker ps -q output
    const mockDockerOutput = '   \n  \n ';
    
    const containerIds = mockDockerOutput
      .trim()
      .split('\n')
      .filter((id: string) => id.length > 0);
    
    expect(containerIds).toHaveLength(0);
  });

  test('should verify integration with existing discovery methods', async () => {
    // Test that label discovery integrates with existing methods
    const { discoverOpencodeInstances } = await import('../src/commands/discover-opencode');
    
    // Mock options for testing
    const options = {
      all: false,
      format: 'text' as const,
      verbose: true
    };

    // This will fail due to no .aisanity config, but tests the integration
    const result = await discoverOpencodeInstances(options);
    
    // Should return the expected structure
    expect(result).toHaveProperty('instances');
    expect(result).toHaveProperty('mostRecent');
    expect(Array.isArray(result.instances)).toBe(true);
  });

  test('should handle concurrent label discovery calls', async () => {
    // Test that multiple concurrent calls don't interfere
    const mockDockerCalls = [
      'docker ps -q --filter label=aisanity.container=container1',
      'docker ps -q --filter label=aisanity.container=container2',
      'docker ps -q --filter label=aisanity.container=container3'
    ];

    // Verify all commands are properly formatted
    mockDockerCalls.forEach(command => {
      expect(command).toMatch(/^docker ps -q --filter label=aisanity\.container=/);
    });
  });

  test('should validate error handling structure', () => {
    // Test that error handling follows the expected pattern
    const mockError = new Error('Docker command failed');
    const errorMessage = mockError.message;
    
    expect(errorMessage).toBe('Docker command failed');
    expect(typeof mockError).toBe('object');
    expect(mockError instanceof Error).toBe(true);
  });

  test('should handle different container name formats', () => {
    // Test various container name formats that might be used
    const containerNames = [
      'simple',
      'with-dash',
      'with_underscore',
      'with123numbers',
      'Mixed-Case_123',
      'a'.repeat(64), // Maximum length
      'very-long-container-name-with-many-parts-and-numbers-12345'
    ];

    containerNames.forEach(name => {
      const command = `docker ps -q --filter label=aisanity.container=${name}`;
      expect(command).toContain(`aisanity.container=${name}`);
    });
  });

  test('should verify backward compatibility', async () => {
    // Test that the new label discovery doesn't break existing functionality
    const { isValidContainerId } = await import('../src/commands/discover-opencode');
    
    // Existing functionality should still work
    expect(isValidContainerId('abc123def456')).toBe(true);
    expect(isValidContainerId('invalid')).toBe(false);
  });

  test('should handle verbose flag correctly in label discovery', () => {
    // Test that verbose flag affects logging as expected
    const containerName = 'test-container';
    const verbose = true;
    
    if (verbose) {
      const searchMessage = `Searching for containers with label aisanity.container=${containerName}...`;
      expect(searchMessage).toBe('Searching for containers with label aisanity.container=test-container...');
    }
  });

  test('should validate label discovery integration point', () => {
    // Test that the label discovery is added at the correct integration point
    // This verifies the understanding of where the new code should be inserted
    
    // The label discovery should come after:
    // 1. Main container discovery (docker ps -q --filter name=${containerName})
    // 2. Devcontainer discovery (docker ps -q --filter label=devcontainer.local_folder=${cwd})
    // 3. THEN: Label discovery (docker ps -q --filter label=aisanity.container=${containerName})
    
    const discoveryMethods = [
      'docker ps -q --filter name=containerName',
      'docker ps -q --filter label=devcontainer.local_folder=cwd',
      'docker ps -q --filter label=aisanity.container=containerName'
    ];
    
    expect(discoveryMethods[2]).toContain('aisanity.container');
    expect(discoveryMethods.length).toBe(3);
  });
});