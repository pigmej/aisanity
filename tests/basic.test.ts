// Basic test to verify Bun test runner works
import { test, expect } from 'bun:test';

// Simple test without complex mocking
test('Bun test runner works', () => {
  expect(typeof Bun).toBe('object');
  expect(Bun.version).toBeDefined();
  console.log('✓ Running on Bun version:', Bun.version);
});

test('Container utils module can be imported', () => {
  const containerModule = require('../src/utils/container-utils');
  
  expect(containerModule.discoverAllAisanityContainers).toBeDefined();
  expect(typeof containerModule.discoverAllAisanityContainers).toBe('function');
  console.log('✓ discoverAllAisanityContainers function imported');
});

test('Basic assertions work', () => {
  expect(1 + 1).toBe(2);
  expect('test').toBe('test');
  expect([1, 2, 3]).toHaveLength(3);
  console.log('✓ Basic assertions pass');
});
