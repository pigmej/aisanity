import { elapsedToSeconds, isValidContainerId } from '../src/commands/discover-opencode';

// Mock chalk to avoid ES module issues
jest.mock('chalk', () => ({
  green: jest.fn((str) => str),
  blue: jest.fn((str) => str),
  yellow: jest.fn((str) => str),
  red: jest.fn((str) => str),
}));

// Import after mocking
import { formatText, formatPlain } from '../src/commands/discover-opencode';

describe('elapsedToSeconds', () => {
  test('converts HH:MM:SS format correctly', () => {
    expect(elapsedToSeconds('12:34:56')).toBe(45296);
    expect(elapsedToSeconds('01:02:03')).toBe(3723);
  });

  test('converts MM:SS format correctly', () => {
    expect(elapsedToSeconds('34:56')).toBe(2096);
    expect(elapsedToSeconds('01:30')).toBe(90);
  });

  test('converts SS format correctly', () => {
    expect(elapsedToSeconds('56')).toBe(56);
    expect(elapsedToSeconds('123')).toBe(123);
  });

  test('handles invalid format gracefully', () => {
    expect(elapsedToSeconds('invalid')).toBe(0);
    expect(elapsedToSeconds('')).toBe(0);
  });
});

describe('isValidContainerId', () => {
  test('validates correct container IDs', () => {
    expect(isValidContainerId('abc123def456')).toBe(true);
    expect(isValidContainerId('a1b2c3d4e5f67890123456789012345678901234567890123456789012')).toBe(true);
  });

  test('rejects invalid container IDs', () => {
    expect(isValidContainerId('')).toBe(false);
    expect(isValidContainerId('abc')).toBe(false);
    expect(isValidContainerId('abc123def456!')).toBe(false);
    expect(isValidContainerId('abc123def456 ')).toBe(false);
  });
});

describe('formatText', () => {
  const mockInstance = {
    containerId: 'abc123',
    containerName: 'test-container',
    port: 8080,
    processId: 123,
    elapsedTime: 120,
    isValidApi: true
  };

  test('formats successful result correctly', () => {
    const result = {
      instances: [mockInstance],
      mostRecent: mockInstance
    };

    const output = formatText(result);
    expect(output).toContain('Most recent opencode instance');
    expect(output).toContain('test-container');
    expect(output).toContain('8080');
    expect(output).toContain('localhost:8080');
  });

  test('formats error result correctly', () => {
    const result = {
      instances: [],
      mostRecent: null,
      error: 'No containers found'
    };

    const output = formatText(result);
    expect(output).toContain('Error: No containers found');
  });

  test('formats all instances correctly', () => {
    const result = {
      instances: [mockInstance, { ...mockInstance, port: 8081 }],
      mostRecent: mockInstance
    };

    const output = formatText(result, true);
    expect(output).toContain('Found 2 opencode instance');
    expect(output).toContain('8080');
    expect(output).toContain('8081');
  });
});

describe('formatPlain', () => {
  test('formats plain output correctly', () => {
    const result = {
      instances: [],
      mostRecent: {
        containerId: 'abc123',
        containerName: 'test-container',
        port: 8080,
        processId: 123,
        elapsedTime: 120,
        isValidApi: true
      }
    };

    expect(formatPlain(result)).toBe('localhost:8080');
  });

  test('returns empty string when no instance found', () => {
    const result = {
      instances: [],
      mostRecent: null
    };

    expect(formatPlain(result)).toBe('');
  });
});