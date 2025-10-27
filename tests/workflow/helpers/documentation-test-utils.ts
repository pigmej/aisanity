/**
 * Documentation testing utilities
 * Utilities for automated documentation example validation
 */

import * as fs from 'fs';
import * as path from 'path';
import { WorkflowParser } from '../../../src/workflow/parser';
import { StateMachine } from '../../../src/workflow/fsm';
import { CommandExecutor } from '../../../src/workflow/executor';
import { ConfirmationHandler } from '../../../src/workflow/confirmation-handler';
import { Logger } from '../../../src/utils/logger';
import { createTempDir, cleanupTempDir, createWorkflowFile } from './test-utils';

/**
 * Documentation example metadata
 */
export interface DocumentationExample {
  id: string;
  file: string;
  section: string;
  code: string;
  expectedOutput?: string;
  testCommand?: string;
  validated: boolean;
  language: string;
}

/**
 * Validation result for documentation examples
 */
export interface DocumentationValidationResult {
  exampleId: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  executionTime?: number;
  output?: string;
}

/**
 * Extract code blocks from markdown documentation
 */
export function extractCodeBlocks(markdownContent: string, language: string = 'yaml'): DocumentationExample[] {
  const examples: DocumentationExample[] = [];
  const codeBlockRegex = new RegExp(`\`\`\`${language}([\\s\\S]*?)\`\`\``, 'g');
  
  let match: RegExpExecArray | null;
  let index = 0;
  
  while ((match = codeBlockRegex.exec(markdownContent)) !== null) {
    const code = match[1].trim();
    
    examples.push({
      id: `example-${index++}`,
      file: 'unknown',
      section: 'unknown',
      code,
      validated: false,
      language
    });
  }
  
  return examples;
}

/**
 * Extract code blocks from a documentation file
 */
export function extractExamplesFromFile(filePath: string, language: string = 'yaml'): DocumentationExample[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const examples = extractCodeBlocks(content, language);
  
  // Add file information to each example
  return examples.map(example => ({
    ...example,
    file: filePath
  }));
}

/**
 * Extract section headings from markdown
 */
export function extractSectionHeadings(markdownContent: string): string[] {
  const headings: string[] = [];
  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(markdownContent)) !== null) {
    headings.push(match[1].trim());
  }
  
  return headings;
}

/**
 * Validate a YAML workflow example
 */
export async function validateWorkflowExample(
  example: DocumentationExample
): Promise<DocumentationValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let isValid = true;
  
  if (example.language !== 'yaml' && example.language !== 'yml') {
    return {
      exampleId: example.id,
      isValid: false,
      errors: ['Example is not a YAML code block'],
      warnings: []
    };
  }
  
  // Create temporary directory for testing
  const tempDir = createTempDir();
  
  try {
    // Write example to temporary file
    createWorkflowFile(tempDir, example.code);
    
    // Try to parse the workflow
    const logger = new Logger(true); // Silent mode
    const parser = new WorkflowParser(logger);
    
    try {
      const workflows = parser.loadWorkflows(tempDir);
      
      // Check if any workflows were loaded
      if (Object.keys(workflows.workflows).length === 0) {
        errors.push('No workflows found in example');
        isValid = false;
      } else {
        // Validate each workflow can be instantiated
        for (const [name, workflow] of Object.entries(workflows.workflows)) {
          try {
            const executor = new CommandExecutor(logger);
            const confirmationHandler = new ConfirmationHandler(executor, logger);
            new StateMachine(workflow, logger, executor, confirmationHandler);
          } catch (error: any) {
            errors.push(`Failed to create FSM for workflow '${name}': ${error.message}`);
            isValid = false;
          }
        }
      }
    } catch (error: any) {
      errors.push(`Failed to parse workflow: ${error.message}`);
      isValid = false;
    }
  } catch (error: any) {
    errors.push(`Failed to validate example: ${error.message}`);
    isValid = false;
  } finally {
    // Cleanup temporary directory
    cleanupTempDir(tempDir);
  }
  
  return {
    exampleId: example.id,
    isValid,
    errors,
    warnings
  };
}

/**
 * Validate all YAML examples in a documentation file
 */
export async function validateDocumentationFile(
  filePath: string
): Promise<DocumentationValidationResult[]> {
  const examples = extractExamplesFromFile(filePath, 'yaml');
  const results: DocumentationValidationResult[] = [];
  
  for (const example of examples) {
    const result = await validateWorkflowExample(example);
    results.push(result);
  }
  
  return results;
}

/**
 * Test a bash command example
 */
export async function testBashExample(
  command: string,
  expectedExitCode: number = 0
): Promise<DocumentationValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let isValid = true;
  
  try {
    const { execSync } = require('child_process');
    const startTime = Date.now();
    
    try {
      const output = execSync(command, {
        encoding: 'utf8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const executionTime = Date.now() - startTime;
      
      return {
        exampleId: command,
        isValid: true,
        errors: [],
        warnings: [],
        executionTime,
        output
      };
    } catch (error: any) {
      if (error.status !== expectedExitCode) {
        errors.push(`Command exited with code ${error.status}, expected ${expectedExitCode}`);
        isValid = false;
      }
    }
  } catch (error: any) {
    errors.push(`Failed to execute command: ${error.message}`);
    isValid = false;
  }
  
  return {
    exampleId: command,
    isValid,
    errors,
    warnings
  };
}

/**
 * Generate a validation report for documentation
 */
export function generateValidationReport(
  results: DocumentationValidationResult[]
): string {
  const totalExamples = results.length;
  const validExamples = results.filter(r => r.isValid).length;
  const invalidExamples = results.filter(r => !r.isValid);
  
  let report = '# Documentation Validation Report\n\n';
  report += `Total Examples: ${totalExamples}\n`;
  report += `Valid Examples: ${validExamples}\n`;
  report += `Invalid Examples: ${invalidExamples.length}\n\n`;
  
  if (invalidExamples.length > 0) {
    report += '## Invalid Examples\n\n';
    
    for (const result of invalidExamples) {
      report += `### ${result.exampleId}\n\n`;
      
      if (result.errors.length > 0) {
        report += '**Errors:**\n';
        result.errors.forEach(error => {
          report += `- ${error}\n`;
        });
        report += '\n';
      }
      
      if (result.warnings.length > 0) {
        report += '**Warnings:**\n';
        result.warnings.forEach(warning => {
          report += `- ${warning}\n`;
        });
        report += '\n';
      }
    }
  }
  
  return report;
}

/**
 * Check for broken links in documentation
 */
export function checkDocumentationLinks(
  markdownContent: string,
  baseDir: string
): { broken: string[], valid: string[] } {
  const broken: string[] = [];
  const valid: string[] = [];
  
  // Extract markdown links
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  
  while ((match = linkRegex.exec(markdownContent)) !== null) {
    const linkUrl = match[2];
    
    // Check if it's a relative file link
    if (!linkUrl.startsWith('http://') && !linkUrl.startsWith('https://') && !linkUrl.startsWith('#')) {
      const fullPath = path.resolve(baseDir, linkUrl);
      
      if (fs.existsSync(fullPath)) {
        valid.push(linkUrl);
      } else {
        broken.push(linkUrl);
      }
    }
  }
  
  return { broken, valid };
}

/**
 * Validate cross-references between documentation files
 */
export function validateCrossReferences(
  files: string[]
): { missing: string[], valid: string[] } {
  const missing: string[] = [];
  const valid: string[] = [];
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const { broken, valid: validLinks } = checkDocumentationLinks(
      content,
      path.dirname(file)
    );
    
    broken.forEach(link => {
      if (!missing.includes(link)) {
        missing.push(link);
      }
    });
    
    validLinks.forEach(link => {
      if (!valid.includes(link)) {
        valid.push(link);
      }
    });
  }
  
  return { missing, valid };
}

/**
 * Check if documentation examples follow best practices
 */
export function checkBestPractices(
  example: DocumentationExample
): string[] {
  const warnings: string[] = [];
  
  // Check for TODO comments
  if (example.code.includes('TODO') || example.code.includes('FIXME')) {
    warnings.push('Example contains TODO or FIXME comments');
  }
  
  // Check for placeholder values
  if (example.code.includes('your-') || example.code.includes('example-')) {
    warnings.push('Example may contain placeholder values that need to be replaced');
  }
  
  // Check for hardcoded paths
  if (example.code.includes('/home/') || example.code.includes('C:\\')) {
    warnings.push('Example contains hardcoded system paths');
  }
  
  // Check for overly long examples
  const lines = example.code.split('\n');
  if (lines.length > 100) {
    warnings.push('Example is very long (>100 lines) - consider breaking it up');
  }
  
  // Check for missing metadata
  if (example.language === 'yaml' && !example.code.includes('metadata:')) {
    warnings.push('YAML example missing metadata section');
  }
  
  return warnings;
}
