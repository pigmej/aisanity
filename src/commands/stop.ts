import { Command } from 'commander';
import { execSync } from 'child_process';
import { loadAisanityConfig, getContainerName } from '../utils/config';

export const stopCommand = new Command('stop')
  .description('Stop all containers used for the current workspace')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    try {
      const cwd = process.cwd();
      const config = loadAisanityConfig(cwd);

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