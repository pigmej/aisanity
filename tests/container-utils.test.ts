import { expect, test, describe } from 'bun:test';
import {
  validateContainerLabels,
  generateContainerLabels,
  ContainerLabels
} from '../src/utils/container-utils';

describe('container-utils', () => {
  describe('validateContainerLabels', () => {
    test('should validate correct container labels', () => {
      const labels: ContainerLabels = {
        'aisanity.workspace': '/test/workspace',
        'aisanity.branch': 'main',
        'aisanity.container': 'test-container',
        'aisanity.created': new Date().toISOString(),
        'aisanity.version': '1.0.0'
      };
      
      expect(validateContainerLabels(labels)).toBe(true);
    });

    test('should reject incomplete labels', () => {
      const labels = {
        'aisanity.workspace': '/test/workspace',
        'aisanity.branch': 'main'
        // missing required fields
      } as any;
      
      expect(validateContainerLabels(labels)).toBe(false);
    });
  });

  describe('generateContainerLabels', () => {
    test('should generate correct labels', async () => {
      const labels = await generateContainerLabels('test-project', 'main', 'test-container', '/test/workspace');
      
      expect(labels['aisanity.workspace']).toBe('/test/workspace');
      expect(labels['aisanity.branch']).toBe('main');
      expect(labels['aisanity.container']).toBe('test-container');
    });
  });
});