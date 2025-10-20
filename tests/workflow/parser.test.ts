/**
 * Tests for WorkflowParser class
 * Covers main parser functionality with various input scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { WorkflowParser } from '../../src/workflow/parser';
import { MockLogger } from './helpers/mock-logger';
import {
  createTempDir,
  cleanupTempDir,
  copyFixtureToTemp,
  createWorkflowFile,
  createReadOnlyWorkflowFile,
  generateLargeWorkflow
} from './helpers/test-utils';
import {
  WorkflowFileError,
  WorkflowParseError,
  WorkflowValidationError
} from '../../src/workflow/errors';

describe('WorkflowParser', () => {
  let parser: WorkflowParser;
  let mockLogger: MockLogger;
  let tempDir: string;

  beforeEach(() => {
    mockLogger = new MockLogger();
    parser = new WorkflowParser(mockLogger as any);
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
    parser.clearCache();
  });

  describe('loadWorkflows', () => {
    it('should load valid workflows successfully', () => {
      copyFixtureToTemp('valid-workflows.yml', tempDir);
      
      const workflows = parser.loadWorkflows(tempDir);
      
      expect(workflows).toBeDefined();
      expect(workflows.workflows).toBeDefined();
      expect(Object.keys(workflows.workflows)).toContain('deploy');
      expect(Object.keys(workflows.workflows)).toContain('simple');
      expect(workflows.metadata).toBeDefined();
      expect(workflows.metadata.version).toBe('1.0.0');
    });

    it('should cache workflows after first load', () => {
      copyFixtureToTemp('valid-workflows.yml', tempDir);
      
      const workflows1 = parser.loadWorkflows(tempDir);
      const workflows2 = parser.loadWorkflows(tempDir);
      
      expect(workflows1).toBe(workflows2); // Same object reference
      expect(mockLogger.hasDebugMessage('Using cached workflows')).toBe(true);
    });

    it('should throw WorkflowFileError for missing file', () => {
      expect(() => {
        parser.loadWorkflows(tempDir);
      }).toThrow(WorkflowFileError);
    });

    it('should throw WorkflowFileError for unreadable file', () => {
      createReadOnlyWorkflowFile(tempDir, 'workflows: {}');
      
      expect(() => {
        parser.loadWorkflows(tempDir);
      }).toThrow(WorkflowFileError);
    });

    it('should throw WorkflowParseError for invalid YAML syntax', () => {
      copyFixtureToTemp('invalid-syntax.yml', tempDir);
      
      expect(() => parser.loadWorkflows(tempDir)).toThrow(WorkflowParseError);
    });

    it('should throw WorkflowValidationError for invalid schema', () => {
      copyFixtureToTemp('invalid-schema.yml', tempDir);
      
      expect(() => parser.loadWorkflows(tempDir)).toThrow(WorkflowValidationError);
    });

    it('should handle large workflow files efficiently', () => {
      const largeWorkflowContent = generateLargeWorkflow(100);
      createWorkflowFile(tempDir, largeWorkflowContent);
      
      const startTime = Date.now();
      const workflows = parser.loadWorkflows(tempDir);
      const endTime = Date.now();
      
      expect(workflows.workflows['performance-test'].states).toBeDefined();
      expect(Object.keys(workflows.workflows['performance-test'].states).length).toBeGreaterThan(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('getWorkflow', () => {
    beforeEach(() => {
      copyFixtureToTemp('valid-workflows.yml', tempDir);
    });

    it('should return specific workflow by name', () => {
      const workflow = parser.getWorkflow('deploy', tempDir);
      
      expect(workflow).toBeDefined();
      expect(workflow.name).toBe('Deploy Application');
      expect(workflow.initialState).toBe('build');
      expect(workflow.states.build).toBeDefined();
    });

    it('should throw error for non-existent workflow', () => {
      expect(() => {
        parser.getWorkflow('nonexistent', tempDir);
      }).toThrow(WorkflowValidationError);
    });
  });

  describe('listWorkflows', () => {
    it('should return empty array when no workflow file exists', () => {
      const workflows = parser.listWorkflows(tempDir);
      expect(workflows).toEqual([]);
    });

    it('should return workflow names when file exists', () => {
      copyFixtureToTemp('valid-workflows.yml', tempDir);
      
      const workflows = parser.listWorkflows(tempDir);
      expect(workflows).toContain('deploy');
      expect(workflows).toContain('simple');
      expect(workflows.length).toBe(2);
    });
  });

  describe('validateWorkflow', () => {
    it('should validate valid workflow', () => {
      const validWorkflow = {
        name: 'Test Workflow',
        initialState: 'start',
        states: {
          start: {
            command: 'echo test',
            transitions: {}
          }
        }
      };

      const result = parser.validateWorkflow(validWorkflow, 'test');
      expect(result).toEqual(validWorkflow);
    });

    it('should throw error for invalid workflow', () => {
      const invalidWorkflow = {
        name: '',
        // Missing initialState
        states: {}
      };

      expect(() => {
        parser.validateWorkflow(invalidWorkflow, 'test');
      }).toThrow(WorkflowValidationError);
    });
  });

  describe('utility methods', () => {
    it('should clear cache', () => {
      copyFixtureToTemp('valid-workflows.yml', tempDir);
      
      parser.loadWorkflows(tempDir);
      parser.clearCache();
      
      expect(mockLogger.hasDebugMessage('Workflow cache cleared')).toBe(true);
    });

    it('should get workflow file path', () => {
      const filePath = parser.getWorkflowFilePath(tempDir);
      expect(filePath).toBe(`${tempDir}/.aisanity-workflows.yml`);
    });

    it('should check if workflow file exists', () => {
      expect(parser.workflowFileExists(tempDir)).toBe(false);
      
      createWorkflowFile(tempDir, 'workflows: {}');
      expect(parser.workflowFileExists(tempDir)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle file system errors gracefully', () => {
      const invalidPath = '/nonexistent/path';
      
      expect(() => {
        parser.loadWorkflows(invalidPath);
      }).toThrow(WorkflowFileError);
    });

    it('should provide detailed error context', () => {
      copyFixtureToTemp('invalid-schema.yml', tempDir);
      
      expect(() => parser.loadWorkflows(tempDir)).toThrow(WorkflowValidationError);
    });
  });
});