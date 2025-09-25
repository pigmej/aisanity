import { Command } from 'commander';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { loadAisanityConfig, getContainerName } from '../utils/config';
import { getAllWorktrees } from '../utils/worktree-utils';
import { discoverContainers, stopContainers } from '../utils/container-utils';

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
         // Stop all worktree containers with confirmation
         await stopAllWorktreeContainers(options.verbose);
         console.log('All worktree containers stopped successfully');
         return;
       }
      
       if (options.worktree) {
         const worktreePath = path.resolve(options.worktree);
         if (!fs.existsSync(worktreePath)) {
           throw new Error(`Worktree path does not exist: ${worktreePath}`);
         }
         cwd = worktreePath;
         console.log(`Stopping containers for worktree: ${worktreePath}`);
       }
      
       config = loadAisanityConfig(cwd);

       if (!config) {
         throw new Error('No .aisanity config found. Run "aisanity init" first.');
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
       throw error;
     }
  });

/**
 * Stop containers for all worktrees
 */
async function stopAllWorktreeContainers(verbose: boolean = false): Promise<void> {
  try {
    console.log('Discovering all aisanity-related containers...');

    // Use multi-strategy container discovery
    const discoveryResult = await discoverContainers(verbose);

    if (discoveryResult.errors.length > 0 && verbose) {
      console.warn('Discovery errors encountered:');
      discoveryResult.errors.forEach(error => {
        console.warn(`  ${error.container}: ${error.error}`);
      });
    }

    const allContainers = discoveryResult.containers;

    if (allContainers.length === 0) {
      console.log('No aisanity containers found');
      return;
    }

    console.log(`Found ${allContainers.length} containers (${discoveryResult.labeled.length} labeled, ${discoveryResult.unlabeled.length} unlabeled)`);

    if (discoveryResult.orphaned.length > 0) {
      console.log(`Warning: ${discoveryResult.orphaned.length} orphaned containers detected`);
      if (verbose) {
        discoveryResult.orphaned.forEach(container => {
          console.log(`  Orphaned: ${container.name} (${container.id})`);
        });
      }
    }

    // User confirmation for destructive operation
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question(`Are you sure you want to stop ${allContainers.length} containers? [y/N]: `, resolve);
    });

    rl.close();

    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('Container stop operation cancelled');
      return;
    }

    // Stop all discovered containers
    const containerIds = allContainers.map(c => c.id);
    await stopContainers(containerIds, verbose);

    console.log(`Successfully stopped ${containerIds.length} containers`);

  } catch (error) {
    console.error('Failed to stop all worktree containers:', error);
    throw error;
  }
}