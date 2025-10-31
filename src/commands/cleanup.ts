import { Command } from 'commander';
import { discoverAllAisanityContainers, stopContainers, removeContainers } from '../utils/container-utils';
import { createLoggerFromCommandOptions } from '../utils/logger';

export const cleanupCommand = new Command('cleanup')
  .description('Clean up orphaned containers from manually deleted worktrees')
  .option('--dry-run', 'Show what would be cleaned up without actually doing it')
  .option('--force', 'Skip confirmation prompts')
  .option('-v, --verbose', 'Show detailed user information (container status, orphaned containers)')
  .option('-d, --debug', 'Show system debugging information (discovery process, timing)')
  .action(async (options) => {
    const logger = createLoggerFromCommandOptions(options);
    
    try {
      logger.info('Discovering orphaned containers...');

      // Discover all containers
      const discoveryResult = await discoverAllAisanityContainers({
        mode: 'global',
        includeOrphaned: true,
        validationMode: 'permissive',
        verbose: options.verbose || false
      });

      if (discoveryResult.errors.length > 0 && options.verbose) {
        logger.warn('Discovery errors encountered:');
        discoveryResult.errors.forEach(error => {
          logger.warn(`  ${error.container}: ${error.error}`);
        });
      }

      const orphanedContainers = discoveryResult.orphaned;

      if (orphanedContainers.length === 0) {
        logger.info('No orphaned containers found');
        return;
      }

      logger.info(`Found ${orphanedContainers.length} orphaned containers:`);
      orphanedContainers.forEach(container => {
        logger.info(`  - ${container.name} (${container.id}) - ${container.status}`);
      });

      if (options.dryRun) {
        logger.info('\nDry run mode: No action taken');
        return;
      }

      // User confirmation unless forced
      if (!options.force) {
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question(`Are you sure you want to stop and remove ${orphanedContainers.length} orphaned containers? [y/N]: `, resolve);
        });

        rl.close();

        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          logger.info('Cleanup cancelled');
          return;
        }
      }

      // Stop orphaned containers
      const containerIds = orphanedContainers.map(c => c.id);
      logger.info('Stopping orphaned containers...');
      await stopContainers(containerIds, options.verbose);

      logger.info('Removing orphaned containers...');
      await removeContainers(containerIds, options.verbose);

      logger.info(`Successfully cleaned up ${orphanedContainers.length} orphaned containers`);

    } catch (error) {
      logger.error('Failed to cleanup orphaned containers:', error);
      throw error;
    }
  });