import { Command } from 'commander';
import * as path from 'path';
import { $ } from 'bun';
import { getAllWorktrees, isWorktree } from '../utils/worktree-utils';
import { checkWorktreeEnabled } from '../utils/config';
import { createLoggerFromCommandOptions } from '../utils/logger';

export const worktreeListCommand = new Command('list')
  .description('List all worktrees and their container status')
  .option('-v, --verbose', 'Show detailed worktree and container information')
  .option('-d, --debug', 'Show system debugging information (discovery process, timing)')
  .action(async (options) => {
    const logger = createLoggerFromCommandOptions(options);
    const cwd = process.cwd();
    
    // Check if worktree functionality is enabled
    checkWorktreeEnabled(cwd);
    
    try {
      const worktrees = getAllWorktrees(cwd);
      
      console.log('Worktrees for this repository:');
      console.log('');
      
      // Display main workspace
      const main = worktrees.main;
      const mainStatus = await getContainerStatus(main.containerName, options.verbose);
      const mainIndicator = main.isActive ? '→' : ' ';
      const mainActive = main.isActive ? '(active)' : '';
      
      console.log(`${mainIndicator} Main Workspace ${mainActive}`);
      console.log(`   Path: ${main.path}`);
      console.log(`   Branch: ${main.branch}`);
      console.log(`   Container: ${main.containerName}`);
      console.log(`   Status: ${mainStatus}`);
      console.log(`   Config: ${main.configPath}`);
      console.log('');
      
      // Display additional worktrees
      if (worktrees.worktrees.length === 0) {
        console.log('No additional worktrees found.');
        console.log('Use "aisanity worktree create <branch>" to create a new worktree.');
      } else {
        console.log('Additional Worktrees:');
        console.log('');
        
        for (const worktree of worktrees.worktrees) {
          const worktreeStatus = await getContainerStatus(worktree.containerName, options.verbose);
          const worktreeIndicator = worktree.isActive ? '→' : ' ';
          const worktreeActive = worktree.isActive ? '(active)' : '';
          const worktreeName = worktree.path.split(path.sep).pop() || 'unknown';
          
          console.log(`${worktreeIndicator} ${worktreeName} ${worktreeActive}`);
          console.log(`   Path: ${worktree.path}`);
          console.log(`   Branch: ${worktree.branch}`);
          console.log(`   Container: ${worktree.containerName}`);
          console.log(`   Status: ${worktreeStatus}`);
          console.log(`   Config: ${worktree.configPath}`);
          console.log('');
        }
      }
      
      // Show current context
      if (isWorktree(cwd)) {
        const currentWorktreeName = cwd.split(path.sep).pop() || 'unknown';
        console.log(`Current worktree: ${currentWorktreeName}`);
      } else {
        console.log('Current location: Main workspace');
      }
      
    } catch (error) {
      console.error('Failed to list worktrees:', error);
      process.exit(1);
    }
  });

/**
 * Get container status for a given container name
 */
async function getContainerStatus(containerName: string, verbose: boolean = false): Promise<string> {
  try {
    // Single call to get all containers and their status
    const result = await $`docker ps -a --filter label=aisanity.container=${containerName} --format {{.Names}}\t{{.Status}}`.text();
    
    const lines = result.trim().split('\n').filter((line: string) => line.trim() !== '');
    
    if (lines.length === 0) {
      return 'Not created';
    }
    
    // Look for the container that matches the expected name
    for (const line of lines) {
      const [name, status] = line.split('\t');
      if (name === containerName) {
        // Check if container is running by looking for "Up" in status
        if (status.includes('Up')) {
          return `Running (${status})`;
        } else {
          return `Stopped (${status})`;
        }
      }
    }
    
    return 'Not created';
  } catch (error) {
    return 'Unknown (Docker error)';
  }
}