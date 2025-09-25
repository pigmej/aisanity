import { Command } from 'commander';
import { discoverContainers, stopContainers, removeContainers } from '../utils/container-utils';

export const cleanupCommand = new Command('cleanup')
  .description('Clean up orphaned containers from manually deleted worktrees')
  .option('--dry-run', 'Show what would be cleaned up without actually doing it')
  .option('--force', 'Skip confirmation prompts')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    try {
      console.log('Discovering orphaned containers...');

      // Discover all containers
      const discoveryResult = await discoverContainers(options.verbose);

      if (discoveryResult.errors.length > 0 && options.verbose) {
        console.warn('Discovery errors encountered:');
        discoveryResult.errors.forEach(error => {
          console.warn(`  ${error.container}: ${error.error}`);
        });
      }

      const orphanedContainers = discoveryResult.orphaned;

      if (orphanedContainers.length === 0) {
        console.log('No orphaned containers found');
        return;
      }

      console.log(`Found ${orphanedContainers.length} orphaned containers:`);
      orphanedContainers.forEach(container => {
        console.log(`  - ${container.name} (${container.id}) - ${container.status}`);
      });

      if (options.dryRun) {
        console.log('\nDry run mode: No action taken');
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
          console.log('Cleanup cancelled');
          return;
        }
      }

      // Stop orphaned containers
      const containerIds = orphanedContainers.map(c => c.id);
      console.log('Stopping orphaned containers...');
      await stopContainers(containerIds, options.verbose);

      console.log('Removing orphaned containers...');
      await removeContainers(containerIds, options.verbose);

      console.log(`Successfully cleaned up ${orphanedContainers.length} orphaned containers`);

    } catch (error) {
      console.error('Failed to cleanup orphaned containers:', error);
      throw error;
    }
  });