import { Command } from 'commander';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { loadAisanityConfig, getContainerName, getCurrentBranch } from '../utils/config';
import { getAllWorktrees, getWorktreeName, WorktreeInfo, WorktreeList, detectOrphanedContainers } from '../utils/worktree-utils';
import { safeDockerExec } from '../utils/docker-safe-exec';

// Internal interfaces for status display
interface WorktreeStatusRow {
  name: string;           // Worktree name (display name)
  branch: string;        // Branch name
  container: string;     // Container name
  status: string;        // Container status (Running/Stopped/Not created)
  ports: string;        // Port mapping information
  isActive: boolean;     // Whether this is the active worktree
}

interface WorktreeSummary {
  currentLocation: string;    // Current worktree/workspace path
  totalWorktrees: number;     // Total number of worktrees
  runningContainers: number;  // Number of running containers
  stoppedContainers: number;  // Number of stopped containers
}

export const statusCommand = new Command('status')
  .description('Display the status of all containers used for the current workspace')
  .option('--worktree <path>', 'Show status for specific worktree')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    try {
      let cwd = process.cwd();
      
       // Handle worktree option - maintain existing behavior
       if (options.worktree) {
         const worktreePath = path.resolve(options.worktree);
         if (!fs.existsSync(worktreePath)) {
           throw new Error(`Worktree path does not exist: ${worktreePath}`);
         }
         console.log(`Showing status for worktree: ${worktreePath}`);
         cwd = worktreePath;
         await displaySingleWorktreeStatus(cwd, options.verbose || false);
         return;
       }
      
      // Get all worktrees to determine display format
      const worktrees = getAllWorktrees(cwd);
      const totalWorktrees = 1 + worktrees.worktrees.length;
      
      // Decision logic: use unified table for multiple worktrees, detailed for single
      if (totalWorktrees > 1) {
        await displayUnifiedWorktreeStatus(worktrees, options.verbose || false);
      } else {
        await displaySingleWorktreeStatus(cwd, options.verbose || false);
      }

    } catch (error) {
      console.error('Failed to check status:', error);
      // Don't exit for Docker errors - allow the command to continue with fallback status
      if (error instanceof Error && (error.message.includes('Docker') || error.message.includes('safeDockerExec'))) {
        console.log('Warning: Docker not available, some status information may be incomplete');
        // For Docker errors in unified display, show a basic table with Unknown status
        try {
          const worktrees = getAllWorktrees(process.cwd());
          const totalWorktrees = 1 + worktrees.worktrees.length;
          if (totalWorktrees > 1) {
            // Create fallback status rows with Unknown status
            const statusRows = [{
              name: 'main',
              branch: worktrees.main.branch || 'unknown',
              container: worktrees.main.containerName || 'unknown',
              status: 'Unknown',
              ports: '-',
              isActive: worktrees.main.isActive
            }];
            
            for (const worktree of worktrees.worktrees) {
              const worktreeName = getWorktreeName(worktree.path);
              statusRows.push({
                name: worktreeName,
                branch: worktree.branch || 'unknown',
                container: worktree.containerName || 'unknown',
                status: 'Unknown',
                ports: '-',
                isActive: worktree.isActive
              });
            }
            
            const tableOutput = formatWorktreeTable(statusRows);
            console.log(tableOutput);
            
            const summary = generateWorktreeSummary(worktrees, statusRows);
            console.log(`\nCurrent: ${summary.currentLocation}`);
            console.log(`Total: ${summary.totalWorktrees} worktrees (0 running, 0 stopped)`);
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
 * Display unified table format for multiple worktrees
 */
async function displayUnifiedWorktreeStatus(worktrees: WorktreeList, verbose: boolean): Promise<void> {
  const statusRows: WorktreeStatusRow[] = [];
  
  // Process main workspace
  let mainStatus = { status: 'Unknown', ports: '-' };
  try {
    mainStatus = await getContainerStatusWithPorts(worktrees.main.containerName, verbose);
  } catch (error) {
    // Docker failed, use Unknown status
  }
  
  statusRows.push({
    name: 'main',
    branch: worktrees.main.branch,
    container: worktrees.main.containerName,
    status: mainStatus.status,
    ports: mainStatus.ports,
    isActive: worktrees.main.isActive
  });
  
  // Process additional worktrees
  for (const worktree of worktrees.worktrees) {
    let worktreeStatus = { status: 'Unknown', ports: '-' };
    try {
      worktreeStatus = await getContainerStatusWithPorts(worktree.containerName, verbose);
    } catch (error) {
      // Docker failed, use Unknown status
    }
    
    const worktreeName = getWorktreeName(worktree.path);
    statusRows.push({
      name: worktreeName,
      branch: worktree.branch,
      container: worktree.containerName,
      status: worktreeStatus.status,
      ports: worktreeStatus.ports,
      isActive: worktree.isActive
    });
  }
  
  // Generate and display table
  const tableOutput = formatWorktreeTable(statusRows);
  console.log(tableOutput);

  // Generate and display summary
  const summary = generateWorktreeSummary(worktrees, statusRows);
  console.log(`\nCurrent: ${summary.currentLocation}`);
  console.log(`Total: ${summary.totalWorktrees} worktrees (${summary.runningContainers} running, ${summary.stoppedContainers} stopped)`);

  // Check for orphaned containers
  try {
    const { orphaned } = await detectOrphanedContainers(verbose);
    if (orphaned.length > 0) {
      console.log(`\n⚠️  Warning: ${orphaned.length} orphaned containers detected`);
      console.log('These containers may be from manually deleted worktrees.');
      console.log('Consider running "aisanity stop --all-worktrees" to clean them up.');
      if (verbose) {
        orphaned.forEach(container => {
          console.log(`  - ${container.name} (${container.status})`);
        });
      }
    }
  } catch (error) {
    // Ignore errors in orphaned container detection for status display
  }
}

/**
 * Display detailed format for single worktree (maintains existing behavior)
 */
async function displaySingleWorktreeStatus(cwd: string, verbose: boolean): Promise<void> {
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
 * Get container status with port information
 */
async function getContainerStatusWithPorts(containerName: string, verbose: boolean): Promise<{ status: string; ports: string }> {
  try {
    // Get container status and ports in a single call
    const result = await safeDockerExec(['ps', '-a', '--filter', `label=aisanity.container=${containerName}`, '--format', '{{.Names}}\t{{.Status}}\t{{.Ports}}'], {
      verbose,
      timeout: 5000
    });
    
    const lines = result.trim().split('\n').filter(line => line.trim() !== '');
    
    if (lines.length === 0) {
      return { status: 'Not created', ports: '-' };
    }
    
    // Process the first result (since we're filtering by label, there should be at most one match)
    for (const line of lines) {
      const [name, status, ports] = line.split('\t');
      // Check if container is running
      if (status.includes('Up')) {
        return { 
          status: 'Running', 
          ports: ports && ports.trim() ? ports.trim() : '-' 
        };
      } else {
        return { 
          status: 'Stopped', 
          ports: '-' 
        };
      }
    }
    
    return { status: 'Not created', ports: '-' };
  } catch (error) {
    return { status: 'Unknown', ports: '-' };
  }
}

/**
 * Format worktree status rows into a table
 */
function formatWorktreeTable(rows: WorktreeStatusRow[]): string {
  // Define column widths
  const colWidths = {
    worktree: 15,
    branch: 15,
    container: 15,
    status: 15,
    ports: 15
  };
  
  // Build table header
  const header = '┌' + '─'.repeat(colWidths.worktree + 2) + '┬' + '─'.repeat(colWidths.branch + 2) + '┬' + '─'.repeat(colWidths.container + 2) + '┬' + '─'.repeat(colWidths.status + 2) + '┬' + '─'.repeat(colWidths.ports + 2) + '┐';
  const headerText = '│ ' + 'Worktree'.padEnd(colWidths.worktree) + ' │ ' + 'Branch'.padEnd(colWidths.branch) + ' │ ' + 'Container'.padEnd(colWidths.container) + ' │ ' + 'Status'.padEnd(colWidths.status) + ' │ ' + 'Ports'.padEnd(colWidths.ports) + ' │';
  const separator = '├' + '─'.repeat(colWidths.worktree + 2) + '┼' + '─'.repeat(colWidths.branch + 2) + '┼' + '─'.repeat(colWidths.container + 2) + '┼' + '─'.repeat(colWidths.status + 2) + '┼' + '─'.repeat(colWidths.ports + 2) + '┤';
  
  let table = header + '\n' + headerText + '\n' + separator + '\n';
  
  // Build table rows
  for (const row of rows) {
    const indicator = row.isActive ? '→' : ' ';
    const worktreeName = indicator + ' ' + row.name;
    
    const rowText = '│ ' + worktreeName.padEnd(colWidths.worktree) + ' │ ' + 
                   row.branch.padEnd(colWidths.branch) + ' │ ' + 
                   row.container.padEnd(colWidths.container) + ' │ ' + 
                   row.status.padEnd(colWidths.status) + ' │ ' + 
                   row.ports.padEnd(colWidths.ports) + ' │';
    
    table += rowText + '\n';
  }
  
  // Build table footer
  const footer = '└' + '─'.repeat(colWidths.worktree + 2) + '┴' + '─'.repeat(colWidths.branch + 2) + '┴' + '─'.repeat(colWidths.container + 2) + '┴' + '─'.repeat(colWidths.status + 2) + '┴' + '─'.repeat(colWidths.ports + 2) + '┘';
  
  return table + footer;
}

/**
 * Generate worktree summary information
 */
function generateWorktreeSummary(worktrees: WorktreeList, statusRows: WorktreeStatusRow[]): WorktreeSummary {
  let currentLocation = '';
  let runningContainers = 0;
  let stoppedContainers = 0;
  
  // Determine current location
  if (worktrees.main.isActive) {
    currentLocation = `main workspace (${worktrees.main.path})`;
  } else {
    const activeWorktree = worktrees.worktrees.find(wt => wt.isActive);
    if (activeWorktree) {
      const worktreeName = getWorktreeName(activeWorktree.path);
      currentLocation = `${worktreeName} worktree (${activeWorktree.path})`;
    } else {
      currentLocation = worktrees.main.path;
    }
  }
  
  // Count container statuses
  for (const row of statusRows) {
    if (row.status === 'Running') {
      runningContainers++;
    } else if (row.status === 'Stopped') {
      stoppedContainers++;
    }
  }
  
  return {
    currentLocation,
    totalWorktrees: statusRows.length,
    runningContainers,
    stoppedContainers
  };
}