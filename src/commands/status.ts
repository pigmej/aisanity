import { Command } from 'commander';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { loadAisanityConfig, getContainerName, getCurrentBranch } from '../utils/config';
import { getAllWorktrees, getWorktreeName, WorktreeInfo, WorktreeList } from '../utils/worktree-utils';
import { executeDockerCommand, discoverWorkspaceContainers, Container, discoverAllAisanityContainers } from '../utils/container-utils';
import { createLoggerFromCommandOptions } from '../utils/logger';
import { formatOrphanedContainerInfo } from '../utils/logger-helpers';

// Internal interfaces for status display

// Workspace-centric data structure
export interface WorkspaceStatusRow {
  workspace: string;      // Workspace name (from config.workspace)
  branch: string;         // Branch name (from aisanity.branch label or detected)
  container: string;      // Container name
  worktreeStatus: string; // "✅ worktree-name" | "❌ none"
  status: string;         // Container status (Running/Stopped/Not created)
  ports: string;          // Port information
  isCurrentWorktree: boolean;  // Whether branch matches current active worktree
  validation?: ContainerLabelValidation;  // Label validation metadata (optional)
  hasWarning: boolean;    // Indicates if container has label issues
}

// Container label validation interface
export interface ContainerLabelValidation {
  isValid: boolean;
  hasWorkspaceLabel: boolean;
  hasBranchLabel: boolean;
  detectedBranch: string | null;
  detectionMethod: 'label' | 'name-pattern' | 'worktree-match' | 'unknown';
  warnings: string[];
}

// Error and warning interfaces
export interface ContainerError {
  type: 'docker_communication' | 'git_operation' | 'container_processing' | 'config_load';
  message: string;
  error: any;
  recovery: string;
}

export interface ContainerWarning {
  type: 'invalid_labels' | 'worktree_resolution' | 'missing_branch' | 'orphaned_container' | 'missing_config';
  container: string;
  details: string[];
  suggestion: string;
}

// Workspace summary interface
interface WorkspaceSummary {
  workspaceName: string;
  totalContainers: number;
  runningContainers: number;
  stoppedContainers: number;
  containersWithWorktrees: number;
  containersWithoutWorktrees: number;
  currentWorktree: string;
}

/**
 * Validate and extract container labels with fallback detection
 */
export function validateAndExtractLabels(
  container: Container,
  worktreeMap: Map<string, WorktreeInfo>,
  workspacePath: string
): ContainerLabelValidation {
  const warnings: string[] = [];
  let detectedBranch: string | null = null;
  let detectionMethod: ContainerLabelValidation['detectionMethod'] = 'unknown';
  
  // Check workspace label
  const hasWorkspaceLabel = !!container.labels['aisanity.workspace'];
  if (!hasWorkspaceLabel) {
    warnings.push(`Container ${container.name} missing aisanity.workspace label`);
  }
  
  // Check branch label (preferred method)
  const hasBranchLabel = !!container.labels['aisanity.branch'];
  if (hasBranchLabel) {
    detectedBranch = container.labels['aisanity.branch'];
    detectionMethod = 'label';
  } else {
    warnings.push(`Container ${container.name} missing aisanity.branch label`);
    
    // Fallback 1: Parse from container name pattern
    const nameMatch = container.name.match(/^aisanity-(.+)$/);
    if (nameMatch) {
      // Convert hyphens to slashes, but be more conservative
      // Replace common patterns first, then remaining hyphens
      let branchName = nameMatch[1];
      
      // Check if this is a complex pattern that should have all hyphens converted
      // Complex patterns have 4+ parts OR have underscores with multiple hyphens
      const parts = branchName.split('-');
      const isComplexPattern = parts.length >= 4 || (parts.length >= 3 && branchName.includes('_'));
      
      if (isComplexPattern) {
        // For complex patterns, convert all hyphens to slashes
        branchName = branchName.replace(/-/g, '/');
      } else {
        // For simple patterns, handle common prefixes and version tags
        branchName = branchName.replace(/^(feature|bugfix|hotfix|release)-(.+)$/, '$1/$2');
        branchName = branchName.replace(/^(v\d+\.\d+\.\d+)-(.+)$/, '$1/$2');
        
        // Convert any remaining first hyphen to slash
        if (branchName.includes('-') && !branchName.includes('/')) {
          branchName = branchName.replace('-', '/');
        }
      }
      
      detectedBranch = branchName;
      detectionMethod = 'name-pattern';
      warnings.push(`Detected branch '${detectedBranch}' from container name`);
    } else {
      // Fallback 2: Cross-reference with worktrees by container name
      worktreeMap.forEach((worktree, branch) => {
        if (worktree.containerName === container.name) {
          detectedBranch = branch;
          detectionMethod = 'worktree-match';
          warnings.push(`Matched branch '${detectedBranch}' via worktree cross-reference`);
        }
      });
    }
  }
  
  return {
    isValid: hasWorkspaceLabel && hasBranchLabel,
    hasWorkspaceLabel,
    hasBranchLabel,
    detectedBranch,
    detectionMethod,
    warnings
  };
}

/**
 * Check if container should be included in workspace display
 */
export function shouldIncludeContainer(
  container: Container,
  expectedWorkspace: string,
  validation: ContainerLabelValidation
): boolean {
  // Normalize workspace paths for comparison
  const normalizePath = (p: string): string => {
    return path.resolve(p).replace(/\/$/, '');
  };
  
  const normalizedExpected = normalizePath(expectedWorkspace);
  const containerWorkspace = container.labels['aisanity.workspace'];
  
  // Include if workspace label matches (after normalization)
  if (containerWorkspace && normalizePath(containerWorkspace) === normalizedExpected) {
    return true;
  }
  
  // Include if no workspace label but name suggests it's an aisanity container
  if (!validation.hasWorkspaceLabel && container.name.startsWith('aisanity-')) {
    return true;
  }
  
  // Exclude containers from different workspaces
  return false;
}

/**
 * Resolve worktree status for a branch
 */
export function resolveWorktreeStatus(
  branchName: string,
  worktreeMap: Map<string, WorktreeInfo>
): { exists: boolean; name: string; isActive: boolean } {
  const worktree = worktreeMap.get(branchName);
  
  if (worktree) {
    const worktreeName = worktree.path === worktreeMap.get('main')?.path ? 'main' : getWorktreeName(worktree.path);
    return {
      exists: true,
      name: worktreeName,
      isActive: worktree.isActive
    };
  }
  
  return {
    exists: false,
    name: 'none',
    isActive: false
  };
}

/**
 * Group containers by workspace with validation
 */
export async function groupContainersByWorkspace(
  workspacePath: string,
  options: { verbose?: boolean; debug?: boolean }
): Promise<{
  workspaceName: string;
  rows: WorkspaceStatusRow[];
  worktreeMap: Map<string, WorktreeInfo>;
  errors: ContainerError[];
  warnings: ContainerWarning[];
}> {
  const errors: ContainerError[] = [];
  const warnings: ContainerWarning[] = [];
  
  try {
    // Load workspace configuration
    const config = loadAisanityConfig(workspacePath);
    let workspaceName: string;
    
    if (!config) {
      // For testing environments, provide a default workspace name
      workspaceName = process.env.AISANITY_TEST_WORKSPACE || path.basename(workspacePath);
      warnings.push({
        type: 'missing_config',
        container: workspaceName,
        details: ['No .aisanity config found'],
        suggestion: 'Run `aisanity init` to create configuration'
      });
    } else {
      workspaceName = config.workspace;
    }
    
    // Discover containers with error handling
    let containers: Container[];
    try {
      containers = await discoverWorkspaceContainers(workspacePath, { debug: options.debug || false });
    } catch (error) {
      errors.push({
        type: 'docker_communication',
        message: 'Failed to discover containers',
        error: error instanceof Error ? error.message : String(error),
        recovery: 'Displaying status with available information'
      });
      containers = [];  // Continue with empty list
    }
    
    // Get worktrees with error handling
    let worktreeMap: Map<string, WorktreeInfo>;
    try {
      const worktrees = getAllWorktrees(workspacePath);
      worktreeMap = new Map();
      
      // Add main worktree
      worktreeMap.set(worktrees.main.branch, worktrees.main);
      
      // Add additional worktrees
      for (const worktree of worktrees.worktrees) {
        worktreeMap.set(worktree.branch, worktree);
      }
    } catch (error) {
      errors.push({
        type: 'git_operation',
        message: 'Failed to get worktrees',
        error: error instanceof Error ? error.message : String(error),
        recovery: 'Containers will show without worktree status'
      });
      worktreeMap = new Map();  // Continue with empty map
    }
    
    // Transform containers with validation
    const rows: WorkspaceStatusRow[] = [];
    
    for (const container of containers) {
      try {
        // Validate labels
        const validation = validateAndExtractLabels(container, worktreeMap, workspacePath);
        
        // Collect warnings for invalid labels
        if (!validation.isValid) {
          warnings.push({
            type: 'invalid_labels',
            container: container.name,
            details: validation.warnings,
            suggestion: 'Run aisanity rebuild to update labels'
          });
        }
        
        // Check workspace membership
        if (!shouldIncludeContainer(container, workspacePath, validation)) {
          if (options.verbose) {
            console.log(`[SKIP] ${container.name}: belongs to different workspace`);
          }
          continue;  // Skip containers from other workspaces
        }
        
        // Extract branch with fallback
        const branch = validation.detectedBranch || 'unknown';
        
        // Resolve worktree status
        let worktreeStatus: string;
        let isCurrentWorktree: boolean;
        try {
          const status = resolveWorktreeStatus(branch, worktreeMap);
          worktreeStatus = status.exists ? `✅ ${status.name}` : '❌ none';
          isCurrentWorktree = status.isActive;
        } catch (error) {
          worktreeStatus = '❓ error';
          isCurrentWorktree = false;
          warnings.push({
            type: 'worktree_resolution',
            container: container.name,
            details: [`Failed to resolve worktree status: ${error instanceof Error ? error.message : String(error)}`],
            suggestion: 'Check worktree configuration'
          });
        }
        
        // Create row
        const row: WorkspaceStatusRow = {
          workspace: workspaceName,
          branch: branch,
          container: container.name,
          worktreeStatus: worktreeStatus,
          status: container.status || 'Unknown',
          ports: container.ports?.join(', ') || '-',
          isCurrentWorktree: isCurrentWorktree,
          validation: validation,
          hasWarning: !validation.isValid || branch === 'unknown'
        };
        
        rows.push(row);
        
      } catch (error) {
        // Unexpected error processing container
        errors.push({
          type: 'container_processing',
          message: `Failed to process container ${container.name}`,
          error: error instanceof Error ? error.message : String(error),
          recovery: 'Container excluded from status display'
        });
        
        if (options.verbose) {
          console.error(`[ERROR] Processing container ${container.name}:`, error);
        }
      }
    }
    
    // Sort rows
    rows.sort((a, b) => {
      if (a.workspace !== b.workspace) return a.workspace.localeCompare(b.workspace);
      return a.branch.localeCompare(b.branch);
    });
    
    return { workspaceName, rows, worktreeMap, errors, warnings };
    
  } catch (error) {
    // Critical error - cannot proceed
    throw new Error(`Failed to group containers by workspace: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export const statusCommand = new Command('status')
  .description('Display the status of all containers used for the current workspace')
  .option('--worktree <path>', 'Show status for specific worktree')
  .option('-v, --verbose', 'Show detailed user information (container status, orphaned containers)')
  .option('-d, --debug', 'Show system debugging information (discovery process, timing)')
  .action(async (options) => {
    const logger = createLoggerFromCommandOptions(options);
    let cwd = process.cwd();
    let worktrees: WorktreeList | null = null;
    
    // Handle worktree option - maintain existing behavior
    if (options.worktree) {
      const worktreePath = path.resolve(options.worktree);
      if (!fs.existsSync(worktreePath)) {
        throw new Error(`Worktree path does not exist: ${worktreePath}`);
      }
      logger.info(`Showing status for worktree: ${worktreePath}`);
      cwd = worktreePath;
      await displaySingleWorktreeStatus(cwd, options.verbose || false, options.debug || false);
      return;
    }
    
    try {
      // Get all worktrees to determine display format (cache result to avoid duplicate calls)
      worktrees = getAllWorktrees(cwd);
      const totalWorktrees = 1 + worktrees.worktrees.length;
      
      // Decision logic: use unified table for multiple worktrees, detailed for single
      if (totalWorktrees > 1) {
        await displayUnifiedWorktreeStatus(worktrees, options.verbose || false, options.debug || false);
      } else {
        await displaySingleWorktreeStatus(cwd, options.verbose || false, options.debug || false);
      }

    } catch (error) {
      console.error('Failed to check status:', error);
      // Don't exit for Docker errors - allow the command to continue with fallback status
      if (error instanceof Error && (error.message.includes('Docker') || error.message.includes('safeDockerExec'))) {
        console.log('Warning: Docker not available, some status information may be incomplete');
        // For Docker errors in unified display, show a basic table with Unknown status
        try {
          // Use cached worktrees if available, otherwise get them once
          if (!worktrees) {
            worktrees = getAllWorktrees(cwd);
          }
          const totalWorktrees = 1 + worktrees.worktrees.length;
          if (totalWorktrees > 1) {
            // Create fallback workspace rows with Unknown status
            const config = loadAisanityConfig(cwd);
            const workspaceName = config?.workspace || 'unknown';
            
            const workspaceRows: WorkspaceStatusRow[] = [{
              workspace: workspaceName,
              branch: worktrees.main.branch || 'unknown',
              container: worktrees.main.containerName || 'unknown',
              worktreeStatus: '✅ main',
              status: 'Unknown',
              ports: '-',
              isCurrentWorktree: worktrees.main.isActive,
              hasWarning: false
            }];
            
            for (const worktree of worktrees.worktrees) {
              const worktreeName = getWorktreeName(worktree.path);
              workspaceRows.push({
                workspace: workspaceName,
                branch: worktree.branch || 'unknown',
                container: worktree.containerName || 'unknown',
                worktreeStatus: `✅ ${worktreeName}`,
                status: 'Unknown',
                ports: '-',
                isCurrentWorktree: worktree.isActive,
                hasWarning: false
              });
            }
            
            const tableOutput = formatWorkspaceTable(workspaceRows);
            console.log(tableOutput);
            
            const summary = generateWorkspaceSummary(workspaceName, workspaceRows);
            console.log(`\nWorkspace: ${summary.workspaceName}`);
            console.log(`Current: ${summary.currentWorktree}`);
            console.log(`Total: ${summary.totalContainers} containers (0 running, 0 stopped)`);
            console.log(`Worktrees: ${summary.containersWithWorktrees} with worktree, ${summary.containersWithoutWorktrees} without worktree`);
          }
        } catch (fallbackError) {
          // If even fallback fails, just show a simple message
          console.log('Unable to determine worktree status due to Docker unavailability');
        }
        return;
       } else {
         throw error;
       }
    }
  });

/**
 * Display unified table format for multiple worktrees (workspace-centric)
 */
async function displayUnifiedWorktreeStatus(worktrees: WorktreeList, verbose: boolean, debug: boolean): Promise<void> {
  const workspacePath = worktrees.main.path;
  
  // Use new workspace-centric grouping
  const { workspaceName, rows, errors, warnings } = await groupContainersByWorkspace(workspacePath, { verbose, debug });
  
  // Display errors and warnings
  displayErrorsAndWarnings(errors, warnings, verbose);
  
  // Generate and display workspace table
  const tableOutput = formatWorkspaceTable(rows);
  console.log(tableOutput);

  // Generate and display workspace summary
  const summary = generateWorkspaceSummary(workspaceName, rows);
  console.log(`\nWorkspace: ${summary.workspaceName}`);
  console.log(`Current: ${summary.currentWorktree}`);
  console.log(`Total: ${summary.totalContainers} containers (${summary.runningContainers} running, ${summary.stoppedContainers} stopped)`);
  console.log(`Worktrees: ${summary.containersWithWorktrees} with worktree, ${summary.containersWithoutWorktrees} without worktree`);

  // UPDATED: Check for orphaned containers using unified discovery
  try {
    const discoveryResult = await discoverAllAisanityContainers({
      mode: 'global',
      includeOrphaned: true,
      validationMode: 'permissive',
      verbose,
      debug,
      cachedWorktrees: worktrees
    });
    
    if (discoveryResult.orphaned.length > 0) {
      console.log(`\n⚠️  Warning: ${discoveryResult.orphaned.length} orphaned containers detected`);
      console.log('These containers may be from manually deleted worktrees.');
      console.log('Consider running "aisanity stop --all-worktrees" to clean them up.');
      
      if (verbose) {
        const orphanedInfo = formatOrphanedContainerInfo(
          discoveryResult.orphaned,
          discoveryResult.validationResults
        );
        console.log(orphanedInfo);
      }
    }
  } catch (error) {
    // Log error but don't fail status display
    if (verbose) {
      console.warn('Failed to detect orphaned containers:', error);
    }
  }
}

/**
 * Display detailed format for single worktree (maintains existing behavior)
 */
export async function displaySingleWorktreeStatus(cwd: string, verbose: boolean, debug: boolean = false): Promise<void> {
  const config = loadAisanityConfig(cwd);

   if (!config) {
     throw new Error('No .aisanity config found. Run "aisanity init" first.');
   }

  const workspaceName = config.workspace;
  const containerName = getContainerName(cwd, verbose);
  const branch = getCurrentBranch(cwd);

  console.log(`Workspace: ${workspaceName}`);
  console.log(`Branch: ${branch}`);
  console.log(`Container: ${containerName}`);
  console.log('─'.repeat(50));

  // Check main container status using full workspace path
  try {
    const output = execSync(`docker ps -a --filter "label=aisanity.workspace=${cwd}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"`, {
      encoding: 'utf8'
    });

    if (output.trim()) {
      console.log('Main Container:');
      console.log(output);
    } else {
      console.log('Main Container: Not found');
    }
  } catch (error) {
    console.log('Main Container: Error checking status');
  }

  // Check for devcontainer related to current workspace
  try {
    const output = execSync(`docker ps -a --filter "label=aisanity.workspace=${cwd}" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"`, {
      encoding: 'utf8'
    });

    const lines = output.trim().split('\n');
    if (lines.length > 1) {
      console.log('\nDevcontainer:');
      // Show all containers for this workspace
      for (let i = 1; i < lines.length; i++) {
        const containerLine = lines[i];
        if (containerLine && containerLine.trim()) {
          const parts = containerLine.split('\t');
          if (parts.length >= 3) {
            console.log(`  Name: ${parts[0]}`);
            console.log(`  Status: ${parts[1]}`);
            console.log(`  Image: ${parts[2]}`);
            console.log(''); // Add spacing between containers
          }
        }
      }
    } else {
      console.log('\nDevcontainer: Not running');
    }
  } catch (error) {
    console.log('\nDevcontainer: Error checking status');
  }

  // Check workspace configuration
  console.log('\nConfiguration:');
  console.log(`  Workspace: ${config.workspace}`);
  console.log(`  Container Name: ${config.containerName || 'auto-generated'}`);
  if (config.env && Object.keys(config.env).length > 0) {
    console.log('  Environment Variables:');
    Object.entries(config.env).forEach(([key, value]) => {
      console.log(`    ${key}=${value}`);
    });
  } else {
    console.log('  Environment Variables: None');
  }
}

/**
 * Get display width of text, accounting for Unicode characters and emojis
 * Emojis and wide Unicode characters take 2 display columns
 */
function getDisplayWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    // Check if character is an emoji or wide Unicode character
    const code = char.codePointAt(0);
    if (code && (
      (code >= 0x1F300 && code <= 0x1F9FF) || // Misc Symbols and Pictographs
      (code >= 0x2600 && code <= 0x26FF) ||   // Misc Symbols
      (code >= 0x2700 && code <= 0x27BF) ||   // Dingbats
      (code >= 0x1F600 && code <= 0x1F64F) ||  // Emoticons
      (code >= 0x1F680 && code <= 0x1F6FF) ||  // Transport and Map
      char === '✅' || char === '❌' || char === '❓' // Specific emojis we use
    )) {
      width += 2; // Emoji takes 2 display columns
    } else {
      width += 1; // Regular character takes 1 display column
    }
  }
  return width;
}

/**
 * Truncate text to fit within specified display width, adding ellipsis if needed
 */
function truncateText(text: string, maxWidth: number): string {
  if (getDisplayWidth(text) <= maxWidth) {
    return text;
  }
  
  let currentWidth = 0;
  let result = '';
  
  for (const char of text) {
    const charCode = char.codePointAt(0);
    const charWidth = (char === '✅' || char === '❌' || char === '❓' || 
                      (charCode && charCode >= 0x1F300 && charCode <= 0x1F9FF)) ? 2 : 1;
    
    if (currentWidth + charWidth + 3 > maxWidth) { // +3 for ellipsis
      break;
    }
    
    result += char;
    currentWidth += charWidth;
  }
  
  const truncated = result + '...';
  
  // If the truncated text is still too wide (due to emojis), truncate further
  while (getDisplayWidth(truncated) > maxWidth && result.length > 0) {
    const lastChar = result[result.length - 1];
    const lastCharWidth = (lastChar === '✅' || lastChar === '❌' || lastChar === '❓' || 
                          (lastChar.codePointAt(0) && lastChar.codePointAt(0)! >= 0x1F300 && lastChar.codePointAt(0)! <= 0x1F9FF)) ? 2 : 1;
    
    result = result.slice(0, -1);
    currentWidth -= lastCharWidth;
  }
  
  return result + '...';
}

/**
 * Pad text to specific display width, accounting for Unicode characters and emojis
 */
function padToDisplayWidth(text: string, targetWidth: number): string {
  const currentWidth = getDisplayWidth(text);
  if (currentWidth >= targetWidth) {
    return text;
  }
  return text + ' '.repeat(targetWidth - currentWidth);
}



/**
 * Calculate optimal column widths for workspace table
 */
function calculateWorkspaceColumnWidths(rows: WorkspaceStatusRow[]): {
  workspace: number;
  branch: number;
  container: number;
  worktree: number;
  status: number;
  ports: number;
} {
  const minWidths = { workspace: 12, branch: 12, container: 12, worktree: 12, status: 10, ports: 8 };
  const maxWidths = { workspace: 20, branch: 25, container: 20, worktree: 15, status: 12, ports: 15 };
  
  // Find the maximum content length for each column
  const contentWidths = { ...minWidths };
  
  for (const row of rows) {
    const indicator = row.isCurrentWorktree ? '→ ' : '  ';
    contentWidths.workspace = Math.max(contentWidths.workspace, Math.min(getDisplayWidth(indicator + row.workspace), maxWidths.workspace));
    contentWidths.branch = Math.max(contentWidths.branch, Math.min(getDisplayWidth(row.branch), maxWidths.branch));
    contentWidths.container = Math.max(contentWidths.container, Math.min(getDisplayWidth(row.container), maxWidths.container));
    contentWidths.worktree = Math.max(contentWidths.worktree, Math.min(getDisplayWidth(row.worktreeStatus), maxWidths.worktree));
    contentWidths.status = Math.max(contentWidths.status, Math.min(getDisplayWidth(row.status), maxWidths.status));
    contentWidths.ports = Math.max(contentWidths.ports, Math.min(getDisplayWidth(row.ports), maxWidths.ports));
  }
  
  return contentWidths;
}

/**
 * Format workspace status rows into a table
 */
export function formatWorkspaceTable(rows: WorkspaceStatusRow[]): string {
  // Calculate optimal column widths
  const colWidths = calculateWorkspaceColumnWidths(rows);
  
  // Build table header
  const header = '┌' + '─'.repeat(colWidths.workspace + 2) + '┬' + '─'.repeat(colWidths.branch + 2) + '┬' + '─'.repeat(colWidths.container + 2) + '┬' + '─'.repeat(colWidths.worktree + 2) + '┬' + '─'.repeat(colWidths.status + 2) + '┬' + '─'.repeat(colWidths.ports + 2) + '┐';
  const headerText = '│ ' + padToDisplayWidth('Workspace', colWidths.workspace) + ' │ ' + padToDisplayWidth('Branch', colWidths.branch) + ' │ ' + padToDisplayWidth('Container', colWidths.container) + ' │ ' + padToDisplayWidth('Worktree', colWidths.worktree) + ' │ ' + padToDisplayWidth('Status', colWidths.status) + ' │ ' + padToDisplayWidth('Ports', colWidths.ports) + ' │';
  const separator = '├' + '─'.repeat(colWidths.workspace + 2) + '┼' + '─'.repeat(colWidths.branch + 2) + '┼' + '─'.repeat(colWidths.container + 2) + '┼' + '─'.repeat(colWidths.worktree + 2) + '┼' + '─'.repeat(colWidths.status + 2) + '┼' + '─'.repeat(colWidths.ports + 2) + '┤';
  
  let table = header + '\n' + headerText + '\n' + separator + '\n';
  
  // Build table rows
  for (const row of rows) {
    const indicator = row.isCurrentWorktree ? '→' : ' ';
    const workspaceName = indicator + ' ' + truncateText(row.workspace, colWidths.workspace - 2);
    
    const rowText = '│ ' + padToDisplayWidth(workspaceName, colWidths.workspace) + ' │ ' + 
                   padToDisplayWidth(truncateText(row.branch, colWidths.branch), colWidths.branch) + ' │ ' + 
                   padToDisplayWidth(truncateText(row.container, colWidths.container), colWidths.container) + ' │ ' + 
                   padToDisplayWidth(truncateText(row.worktreeStatus, colWidths.worktree), colWidths.worktree) + ' │ ' + 
                   padToDisplayWidth(truncateText(row.status, colWidths.status), colWidths.status) + ' │ ' + 
                   padToDisplayWidth(truncateText(row.ports, colWidths.ports), colWidths.ports) + ' │';
    
    table += rowText + '\n';
  }
  
  // Build table footer
  const footer = '└' + '─'.repeat(colWidths.workspace + 2) + '┴' + '─'.repeat(colWidths.branch + 2) + '┴' + '─'.repeat(colWidths.container + 2) + '┴' + '─'.repeat(colWidths.worktree + 2) + '┴' + '─'.repeat(colWidths.status + 2) + '┴' + '─'.repeat(colWidths.ports + 2) + '┘';
  
  return table + footer;
}

/**
 * Generate workspace summary information
 */
export function generateWorkspaceSummary(
  workspaceName: string,
  rows: WorkspaceStatusRow[]
): WorkspaceSummary {
  let runningContainers = 0;
  let stoppedContainers = 0;
  let containersWithWorktrees = 0;
  let containersWithoutWorktrees = 0;
  let currentWorktree = 'none';
  
  // Count container statuses and worktree presence
  for (const row of rows) {
    if (row.status === 'Running') {
      runningContainers++;
    } else if (row.status === 'Stopped') {
      stoppedContainers++;
    }
    
    if (row.worktreeStatus.startsWith('✅')) {
      containersWithWorktrees++;
    } else {
      containersWithoutWorktrees++;
    }
    
    if (row.isCurrentWorktree) {
      currentWorktree = row.branch;
    }
  }
  
  return {
    workspaceName,
    totalContainers: rows.length,
    runningContainers,
    stoppedContainers,
    containersWithWorktrees,
    containersWithoutWorktrees,
    currentWorktree
  };
}

/**
 * Display errors and warnings in status output
 */
function displayErrorsAndWarnings(
  errors: ContainerError[],
  warnings: ContainerWarning[],
  verbose: boolean
): void {
  // Display critical errors
  if (errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    for (const error of errors) {
      console.log(`   ${error.message}`);
      if (verbose) {
        console.log(`   Recovery: ${error.recovery}`);
        console.log(`   Details: ${error.error}`);
      }
    }
  }
  
  // Display warnings
  if (warnings.length > 0) {
    if (verbose) {
      console.log('\n⚠️  Warnings:');
      for (const warning of warnings) {
        console.log(`   ${warning.container}: ${warning.type}`);
        for (const detail of warning.details) {
          console.log(`     - ${detail}`);
        }
        console.log(`     Suggestion: ${warning.suggestion}`);
      }
    } else {
      console.log(`\n⚠️  ${warnings.length} warning(s) detected. Run with --verbose for details.`);
    }
  }
}