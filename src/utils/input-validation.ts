/**
 * Input validation utilities for aisanity
 */

/**
 * Validates a container ID
 * @param containerId The container ID to validate
 * @returns The validated container ID
 * @throws Error if invalid
 */
export function validateContainerId(containerId: string): string {
  if (!containerId || typeof containerId !== 'string') {
    throw new Error('Invalid container ID');
  }

  const trimmed = containerId.trim();
  if (trimmed.length === 0) {
    throw new Error('Invalid container ID');
  }

  // Docker container IDs are 64-character hexadecimal strings
  // But short IDs (first 12 chars) are also valid
  if (!/^[a-f0-9]{12,64}$/i.test(trimmed)) {
    throw new Error('Invalid container ID');
  }

  return trimmed;
}

/**
 * Validates a container name
 * @param containerName The container name to validate
 * @returns The validated container name
 * @throws Error if invalid
 */
export function validateContainerName(containerName: string): string {
  if (!containerName || typeof containerName !== 'string') {
    throw new Error('Invalid container name');
  }

  const trimmed = containerName.trim();
  if (trimmed.length === 0) {
    throw new Error('Invalid container name');
  }

  // Container names can contain letters, numbers, hyphens, and underscores
  // Must not be empty and not contain spaces
  if (trimmed.length === 0 || trimmed.includes(' ')) {
    throw new Error('Invalid container name');
  }

  // Must start with alphanumeric
  if (!/^[a-zA-Z0-9]/.test(trimmed)) {
    throw new Error('Invalid container name');
  }

  return trimmed;
}

/**
 * Validates a host
 * @param host The host to validate
 * @returns The validated host
 * @throws Error if invalid
 */
export function validateHost(host: string): string {
  if (!host || typeof host !== 'string') {
    throw new Error('Invalid host');
  }

  const trimmed = host.trim();
  if (trimmed.length === 0) {
    throw new Error('Invalid host');
  }

  // Allow localhost, IP addresses, and domain names
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (trimmed === 'localhost' || ipRegex.test(trimmed) || domainRegex.test(trimmed)) {
    // Additional validation for IP addresses
    if (ipRegex.test(trimmed)) {
      const parts = trimmed.split('.').map(Number);
      if (parts.some(part => part < 0 || part > 255)) {
        throw new Error('Invalid host');
      }
    }
    return trimmed;
  }

  throw new Error('Invalid host');
}

/**
 * Validates a port number
 * @param port The port to validate
 * @returns The validated port
 * @throws Error if invalid
 */
export function validatePort(port: number): number {
  if (typeof port !== 'number' || isNaN(port) || !Number.isInteger(port)) {
    throw new Error('Invalid port');
  }

  if (port < 1 || port > 65535) {
    throw new Error('Invalid port');
  }

  return port;
}

/**
 * Validates a workspace path
 * @param workspacePath The workspace path to validate
 * @returns The validated workspace path
 * @throws Error if invalid
 */
export function validateWorkspacePath(workspacePath: string): string {
  if (!workspacePath || typeof workspacePath !== 'string') {
    throw new Error('Invalid workspace path');
  }

  const trimmed = workspacePath.trim();
  if (trimmed.length === 0) {
    throw new Error('Invalid workspace path');
  }

  // Basic path validation - should be absolute path
  if (!trimmed.startsWith('/')) {
    throw new Error('Invalid workspace path');
  }

  // Check for path traversal attempts
  if (trimmed.includes('../') || trimmed.includes('..\\')) {
    throw new Error('Invalid workspace path');
  }

  return trimmed;
}