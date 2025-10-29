import { Command } from 'commander';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { loadAisanityConfig, getContainerName } from '../utils/config';
import { getAllWorktrees } from '../utils/worktree-utils';
import { discoverContainers, stopContainers, discoverAllAisanityContainers } from '../utils/container-utils';
import { createLoggerFromCommandOptions } from '../utils/logger';

export const stopCommand = new Command('stop')
  .description('Stop all containers used for the current workspace')
  .option('--worktree <path>', 'Stop containers for specific worktree')
  .option('--all-worktrees', 'Stop containers for all worktrees')
  .option('-v, --verbose', 'Show detailed user information (container status, orphaned containers)')
  .option('-d, --debug', 'Show system debugging information (discovery process, timing)')
  .action(async (options) => {
    const logger = createLoggerFromCommandOptions(options);
    
    try {
      let cwd = process.cwd();
      let config;
      
       // Handle worktree options
       if (options.allWorktrees) {
         // Stop all worktree containers with confirmation
         await stopAllWorktreeContainers(logger, options.verbose, options.debug);
         logger.info('All worktree containers stopped successfully');
         return;
       }
      
       if (options.worktree) {
         const worktreePath = path.resolve(options.worktree);
         if (!fs.existsSync(worktreePath)) {
           throw new Error(`Worktree path does not exist: ${worktreePath}`);
         }
         cwd = worktreePath;
         logger.info(`Stopping containers for worktree: ${worktreePath}`);
       }
      
       config = loadAisanityConfig(cwd);

       if (!config) {
         throw new Error('No .aisanity config found. Run "aisanity init" first.');
       }

      const workspaceName = config.workspace;
      const containerName = getContainerName(cwd, options.verbose || false);

      logger.info(`Stopping containers for workspace: ${workspaceName}`);

      try {
        // Try to stop the container using docker
        execSync(`docker stop ${containerName}`, { stdio: 'inherit' });
        logger.info(`Stopped container: ${containerName}`);
      } catch (error) {
        logger.info(`Container ${containerName} not found or already stopped`);
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
            logger.info(`Stopped devcontainer: ${container}`);
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
            logger.info(`Stopped aisanity container: ${container}`);
          }
        }
      } catch (error) {
        // No aisanity containers found for this workspace, that's okay
      }

      logger.info('All workspace containers stopped successfully');

    } catch (error) {
       console.error('Failed to stop containers:', error);
       throw error;
     }
  });

/**
 * UPDATED: Stop containers for all worktrees using unified discovery
 */
async function stopAllWorktreeContainers(logger: any, verbose: boolean = false, debug: boolean = false): Promise<void> {
  try {
    logger.info('Discovering all aisanity-related containers...');

    // UPDATED: Use new unified discovery with permissive validation
    const discoveryResult = await discoverAllAisanityContainers({
      mode: 'global',
      includeOrphaned: true,
      validationMode: 'permissive',  // KEY CHANGE: Don't filter by worktree validity
      verbose,
      debug
    });

    // Report discovery errors if any
    if (discoveryResult.errors.length > 0 && verbose) {
      logger.warn('Discovery errors encountered:');
      discoveryResult.errors.forEach(error => {
        logger.warn(`  ${error.container}: ${error.error}`);
      });
    }

    const allContainers = discoveryResult.containers;

    if (allContainers.length === 0) {
      logger.info('No aisanity containers found');
      return;
    }

    // UPDATED: Show discovery breakdown (user-facing info)
    logger.info(`Found ${allContainers.length} containers (${discoveryResult.labeled.length} labeled, ${discoveryResult.unlabeled.length} unlabeled)`);

    // UPDATED: Report orphaned containers with details (user-facing verbose)
    if (discoveryResult.orphaned.length > 0) {
      logger.info(`Warning: ${discoveryResult.orphaned.length} orphaned containers detected`);
      
      if (verbose) {
        logger.verbose('\nOrphaned containers:');
        discoveryResult.orphaned.forEach(container => {
          const validation = discoveryResult.validationResults.get(container.id);
          logger.verbose(`  - ${container.name} (${container.id})`);
          logger.verbose(`    Workspace: ${validation?.workspacePath || 'unknown'}`);
          logger.verbose(`    Exists: ${validation?.exists ? 'yes' : 'no'}`);
          logger.verbose(`    Reason: ${validation?.error || 'Worktree directory not found'}`);
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
      logger.info('Container stop operation cancelled');
      return;
    }

    // Stop all discovered containers
    const containerIds = allContainers.map(c => c.id);
    await stopContainers(containerIds, verbose);

    logger.info(`Successfully stopped ${containerIds.length} containers`);

  } catch (error) {
    logger.error('Failed to stop all worktree containers:', error);
    throw error;
  }
}