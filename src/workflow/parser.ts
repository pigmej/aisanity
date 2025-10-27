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

export class WorkflowParser {
  private logger: Logger;
  private validator: SchemaValidator;
  private cache: Map<string, WorkflowDefinitions> = new Map();

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.validator = new SchemaValidator();
  }

  /**
   * Load and parse workflows from workspace root
   */
  loadWorkflows(workspacePath: string): WorkflowDefinitions {
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
      throw new WorkflowFileError(
        'Workflow file not found',
        workflowFilePath,
        'missing'
      );
    }

    // Check file permissions
    try {
      fs.accessSync(workflowFilePath, fs.constants.R_OK);
    } catch (error) {
      throw new WorkflowFileError(
        'Cannot read workflow file (permission denied)',
        workflowFilePath,
        'permission'
      );
    }

    // Read and parse file
    let rawContent: string;
    try {
      rawContent = fs.readFileSync(workflowFilePath, 'utf8');
    } catch (error) {
      throw new WorkflowFileError(
        'Failed to read workflow file',
        workflowFilePath,
        'invalid'
      );
    }

    // Parse YAML with line number tracking
    let parsedData: unknown;
    try {
      parsedData = YAML.parse(rawContent);
    } catch (error) {
      const yamlError = error as YAML.YAMLError;
      const line = yamlError.linePos?.[0]?.line || undefined;
      const column = yamlError.linePos?.[0]?.col || undefined;
      
      throw new WorkflowParseError(
        `YAML syntax error: ${yamlError.message}`,
        workflowFilePath,
        line,
        column
      );
    }

    // Validate structure
    let workflowDefinitions: WorkflowDefinitions;
    try {
      workflowDefinitions = this.validator.validateWorkflowDefinitions(parsedData);
    } catch (error) {
      if (error instanceof WorkflowValidationError) {
        throw error;
      }
      throw new WorkflowValidationError(
        'Unknown validation error',
        undefined,
        'root'
      );
    }

    // Cache the result
    this.cache.set(normalizedPath, workflowDefinitions);
    this.logger.debug(`Successfully loaded ${Object.keys(workflowDefinitions.workflows).length} workflows`);

    return workflowDefinitions;
  }

  /**
   * Validate individual workflow
   */
  validateWorkflow(workflow: unknown, workflowName: string): Workflow {
    return this.validator.validateWorkflow(workflow, workflowName);
  }

  /**
   * Get specific workflow by name
   */
  getWorkflow(workflowName: string, workspacePath: string): Workflow {
    const workflowDefinitions = this.loadWorkflows(workspacePath);
    
    if (!workflowDefinitions.workflows[workflowName]) {
      throw new WorkflowValidationError(
        `Workflow '${workflowName}' not found`,
        workflowName,
        'workflows'
      );
    }

    return workflowDefinitions.workflows[workflowName];
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