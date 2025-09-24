import { Command } from 'commander';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { loadAisanityConfig, getContainerName } from '../utils/config';
import { getAllWorktrees } from '../utils/worktree-utils';

export const stopCommand = new Command('stop')
  .description('Stop all containers used for the current workspace')
  .option('--worktree <path>', 'Stop containers for specific worktree')
  .option('--all-worktrees', 'Stop containers for all worktrees')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    try {
      let cwd = process.cwd();
      let config;
      
      // Handle worktree options
      if (options.allWorktrees) {
        // Stop all worktree containers
        await stopAllWorktreeContainers(options.verbose);
        console.log('All worktree containers stopped successfully');
        return;
      }
      
      if (options.worktree) {
        const worktreePath = path.resolve(options.worktree);
        if (!fs.existsSync(worktreePath)) {
          console.error(`Worktree path does not exist: ${worktreePath}`);
          process.exit(1);
        }
        cwd = worktreePath;
        console.log(`Stopping containers for worktree: ${worktreePath}`);
      }
      
      config = loadAisanityConfig(cwd);

      if (!config) {
        console.error('No .aisanity config found. Run "aisanity init" first.');
        process.exit(1);
      }

      const workspaceName = config.workspace;
      const containerName = getContainerName(cwd, options.verbose || false);

      console.log(`Stopping containers for workspace: ${workspaceName}`);

      try {
        // Try to stop the container using docker
        execSync(`docker stop ${containerName}`, { stdio: 'inherit' });
        console.log(`Stopped container: ${containerName}`);
      } catch (error) {
        console.log(`Container ${containerName} not found or already stopped`);
      }

      // Also try to stop any devcontainer-related containers for this workspace
      try {
        const output = execSync(`docker ps --filter "label=devcontainer.local_folder=${cwd}" --format "{{.Names}}"`, {
          encoding: 'utf8'
        });

        const containers = output.trim().split('\n').filter(name => name.trim() !== '');

        for (const container of containers) {
          if (container) {
            execSync(`docker stop ${container}`, { stdio: 'inherit' });
            console.log(`Stopped devcontainer: ${container}`);
          }
        }
      } catch (error) {
        // No devcontainers found for this workspace, that's okay
      }

      // Also stop any containers with the specific workspace name pattern
      // Search for both old format (aisanity-${workspaceName}) and new format (${workspaceName}-)
      try {
        const output = execSync(`docker ps --filter "name=aisanity-${workspaceName}" --filter "name=${workspaceName}-" --format "{{.Names}}"`, {
          encoding: 'utf8'
        });

        const containers = output.trim().split('\n').filter(name => name.trim() !== '');

        for (const container of containers) {
          if (container) {
            execSync(`docker stop ${container}`, { stdio: 'inherit' });
            console.log(`Stopped aisanity container: ${container}`);
          }
        }
      } catch (error) {
        // No aisanity containers found for this workspace, that's okay
      }

      console.log('All workspace containers stopped successfully');

    } catch (error) {
      console.error('Failed to stop containers:', error);
      process.exit(1);
    }
  });

/**
 * Stop containers for all worktrees
 */
async function stopAllWorktreeContainers(verbose: boolean = false): Promise<void> {
  try {
    const cwd = process.cwd();
    const worktrees = getAllWorktrees(cwd);
    
    console.log('Stopping containers for all worktrees...');
    
    // Stop main workspace container
    try {
      execSync(`docker stop ${worktrees.main.containerName}`, { 
        stdio: verbose ? 'inherit' : 'pipe' 
      });
      console.log(`Stopped main workspace container: ${worktrees.main.containerName}`);
    } catch (error) {
      if (verbose) {
        console.log(`Main workspace container not running or already stopped: ${worktrees.main.containerName}`);
      }
    }
    
    // Stop all worktree containers
    for (const worktree of worktrees.worktrees) {
      try {
        execSync(`docker stop ${worktree.containerName}`, { 
          stdio: verbose ? 'inherit' : 'pipe' 
        });
        console.log(`Stopped worktree container: ${worktree.containerName}`);
      } catch (error) {
        if (verbose) {
          console.log(`Worktree container not running or already stopped: ${worktree.containerName}`);
        }
      }
    }
    
    // Also stop any devcontainer-related containers
    try {
      const output = execSync(`docker ps --filter "label=aisanity.workspace" --format "{{.Names}}"`, {
        encoding: 'utf8'
      });
      
      const containers = output.trim().split('\n').filter(name => name.trim() !== '');
      
      for (const container of containers) {
        if (container) {
          try {
            execSync(`docker stop ${container}`, { stdio: verbose ? 'inherit' : 'pipe' });
            console.log(`Stopped aisanity container: ${container}`);
          } catch (error) {
            if (verbose) {
              console.log(`Container not running or already stopped: ${container}`);
            }
          }
        }
      }
    } catch (error) {
      // No aisanity containers found, that's okay
    }
    
  } catch (error) {
    console.error('Failed to stop all worktree containers:', error);
    throw error;
  }
}