/**
 * Main WorkflowParser class for loading and validating workflows
 * Provides the primary API for workflow management
 */

import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import { Logger } from '../utils/logger';
import {
  WorkflowDefinitions,
  Workflow
} from './interfaces';
import { SchemaValidator } from './validator';
import {
  WorkflowParseError,
  WorkflowValidationError,
  WorkflowFileError
} from './errors';
import { WorkflowErrorHandler } from './error-handler';
import { createParserContext } from './error-context';

export class WorkflowParser {
  private logger: Logger;
  private validator: SchemaValidator;
  private cache: Map<string, WorkflowDefinitions> = new Map();
  private errorHandler?: WorkflowErrorHandler;

  constructor(logger?: Logger, errorHandler?: WorkflowErrorHandler) {
    this.logger = logger || new Logger();
    this.validator = new SchemaValidator();
    this.errorHandler = errorHandler;
  }

  /**
   * Load and parse workflows from workspace root
   */
  loadWorkflows(workspacePath: string): WorkflowDefinitions {
    try {
      const normalizedPath = path.resolve(workspacePath);
      
      // Check cache first
      if (this.cache.has(normalizedPath)) {
        this.logger.debug(`Using cached workflows for ${normalizedPath}`);
        return this.cache.get(normalizedPath)!;
      }

      const workflowFilePath = path.join(normalizedPath, '.aisanity-workflows.yml');
      
      this.logger.debug(`Loading workflows from ${workflowFilePath}`);

      // Check if file exists
      if (!fs.existsSync(workflowFilePath)) {
        const error = new WorkflowFileError(
          'Workflow file not found',
          workflowFilePath,
          'missing'
        );
        if (this.errorHandler) {
          this.errorHandler.handleFileError(error, createParserContext('loadWorkflows', {
            additionalData: { workspacePath }
          }));
        }
        // handleFileError already throws, but we need to throw if no errorHandler
        throw error;
      }

      // Check file permissions
      try {
        fs.accessSync(workflowFilePath, fs.constants.R_OK);
      } catch (error) {
        const fileError = new WorkflowFileError(
          'Cannot read workflow file (permission denied)',
          workflowFilePath,
          'permission'
        );
        if (this.errorHandler) {
          this.errorHandler.handleFileError(fileError, createParserContext('loadWorkflows', {
            additionalData: { workspacePath }
          }));
        }
        // handleFileError already throws, but we need to throw if no errorHandler
        throw fileError;
      }

      // Read and parse file
      let rawContent: string;
      try {
        rawContent = fs.readFileSync(workflowFilePath, 'utf8');
      } catch (error) {
        const fileError = new WorkflowFileError(
          'Failed to read workflow file',
          workflowFilePath,
          'invalid'
        );
        if (this.errorHandler) {
          this.errorHandler.handleFileError(fileError, createParserContext('loadWorkflows', {
            additionalData: { workspacePath }
          }));
        }
        throw fileError;
      }

      // Parse YAML with line number tracking
      let parsedData: unknown;
      try {
        parsedData = YAML.parse(rawContent);
      } catch (error) {
        const yamlError = error as YAML.YAMLError;
        const line = yamlError.linePos?.[0]?.line || undefined;
        const column = yamlError.linePos?.[0]?.col || undefined;
        
        const parseError = new WorkflowParseError(
          `YAML syntax error: ${yamlError.message}`,
          workflowFilePath,
          line,
          column
        );
        if (this.errorHandler) {
          this.errorHandler.enrichAndThrowSync(parseError, createParserContext('parseYAML', {
            additionalData: { workspacePath, line, column }
          }));
        }
        throw parseError;
      }

      // Validate structure
      let workflowDefinitions: WorkflowDefinitions;
      try {
        workflowDefinitions = this.validator.validateWorkflowDefinitions(parsedData);
      } catch (error) {
        if (error instanceof WorkflowValidationError) {
          if (this.errorHandler) {
            this.errorHandler.handleValidationError(error, createParserContext('validateWorkflowDefinitions', {
              additionalData: { workspacePath }
            }));
          }
          throw error;
        }
        const validationError = new WorkflowValidationError(
          'Unknown validation error',
          undefined,
          'root'
        );
        if (this.errorHandler) {
          this.errorHandler.handleValidationError(validationError, createParserContext('validateWorkflowDefinitions', {
            additionalData: { workspacePath }
          }));
        }
        throw validationError;
      }

      // Cache the result
      this.cache.set(normalizedPath, workflowDefinitions);
      this.logger.debug(`Successfully loaded ${Object.keys(workflowDefinitions.workflows).length} workflows`);

      return workflowDefinitions;
    } catch (error) {
      // Only handle errors that weren't already handled by explicit checks
      // WorkflowFileError means it was already handled in the explicit file checks
      if (this.errorHandler && error instanceof Error && !(error instanceof WorkflowFileError)) {
        this.errorHandler.enrichAndThrowSync(error, createParserContext('loadWorkflows', {
          additionalData: { workspacePath }
        }));
      }
      throw error;
    }
  }

  /**
   * Validate individual workflow
   */
  validateWorkflow(workflow: unknown, workflowName: string): Workflow {
    try {
      return this.validator.validateWorkflow(workflow, workflowName);
    } catch (error) {
      if (this.errorHandler && error instanceof WorkflowValidationError) {
        this.errorHandler.handleValidationError(error, createParserContext('validateWorkflow', {
          workflowName,
          additionalData: { workflowName }
        }));
      }
      throw error;
    }
  }

  /**
   * Get specific workflow by name
   */
  getWorkflow(workflowName: string, workspacePath: string): Workflow {
    try {
      const workflowDefinitions = this.loadWorkflows(workspacePath);
      
      if (!workflowDefinitions.workflows[workflowName]) {
        const error = new WorkflowValidationError(
          `Workflow '${workflowName}' not found`,
          workflowName,
          'workflows'
        );
        if (this.errorHandler) {
          this.errorHandler.handleValidationError(error, createParserContext('getWorkflow', {
            workflowName,
            additionalData: { workspacePath, workflowName }
          }));
        }
        throw error;
      }

      return workflowDefinitions.workflows[workflowName];
    } catch (error) {
      // Only handle errors that weren't already handled by explicit checks
      // WorkflowFileError and WorkflowValidationError mean they were already handled
      if (this.errorHandler && error instanceof Error && 
          !(error instanceof WorkflowFileError) && 
          !(error instanceof WorkflowValidationError)) {
        this.errorHandler.enrichAndThrowSync(error, createParserContext('getWorkflow', {
          workflowName,
          additionalData: { workspacePath, workflowName }
        }));
      }
      throw error;
    }
  }

  /**
   * List all available workflow names
   */
  listWorkflows(workspacePath: string): string[] {
    try {
      const workflowDefinitions = this.loadWorkflows(workspacePath);
      return Object.keys(workflowDefinitions.workflows);
    } catch (error) {
      if (error instanceof WorkflowFileError && error.reason === 'missing') {
        // No workflow file is not an error for listing
        return [];
      }
      if (this.errorHandler && error instanceof Error) {
        this.errorHandler.enrichAndThrowSync(error, createParserContext('listWorkflows', {
          additionalData: { workspacePath }
        }));
      }
      throw error;
    }
  }

  /**
   * Clear the cache (useful for testing or force reload)
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.debug('Workflow cache cleared');
  }

  /**
   * Get workflow file path for a workspace
   */
  getWorkflowFilePath(workspacePath: string): string {
    return path.join(path.resolve(workspacePath), '.aisanity-workflows.yml');
  }

  /**
   * Check if workflow file exists in workspace
   */
  workflowFileExists(workspacePath: string): boolean {
    const workflowFilePath = this.getWorkflowFilePath(workspacePath);
    return fs.existsSync(workflowFilePath);
  }
}