import { Command } from 'commander';
import * as path from 'path';
import { execSync } from 'child_process';
import { loadAisanityConfig, getContainerName } from '../utils/config';
import { createLoggerFromCommandOptions } from '../utils/logger';

export const rebuildCommand = new Command('rebuild')
  .description('Rebuild the devcontainer')
  .option('--devcontainer-json <path>', 'Path to devcontainer.json file')
  .option('--clean', 'Remove containers instead of just stopping them')
  .option('-v, --verbose', 'Show detailed container rebuild information')
  .option('-d, --debug', 'Show system debugging information (rebuild process, timing)')
  .action(async (options) => {
    const logger = createLoggerFromCommandOptions(options);
    try {
      const cwd = process.cwd();
      const config = loadAisanityConfig(cwd);

      if (!config) {
        console.error('No .aisanity config found. Run "aisanity init" first.');
        process.exit(1);
      }

      const workspaceName = config.workspace;

      console.log(`Rebuilding container for workspace: ${workspaceName}`);

      // Stop/Remove the container
      const action = options.clean ? 'Removing' : 'Stopping';
      console.log(`${action} existing container...`);

      const containerName = getContainerName(cwd, options.verbose || false);

      try {
        // Try to stop/remove the container using docker
        const dockerCommand = options.clean ? `docker rm -f ${containerName}` : `docker stop ${containerName}`;
        execSync(dockerCommand, { stdio: 'inherit' });
        console.log(`${action.slice(0, -3)}ed container: ${containerName}`);
      } catch (error) {
        console.log(`Container ${containerName} not found or already ${options.clean ? 'removed' : 'stopped'}`);
      }

      // Also try to stop/remove any devcontainer-related containers for this workspace
      try {
        const output = execSync(`docker ps --filter "label=devcontainer.local_folder=${cwd}" --format "{{.Names}}"`, {
          encoding: 'utf8'
        });

        const containers = output.trim().split('\n').filter(name => name.trim() !== '');

        for (const container of containers) {
          if (container) {
            const dockerCommand = options.clean ? `docker rm -f ${container}` : `docker stop ${container}`;
            execSync(dockerCommand, { stdio: 'inherit' });
            console.log(`${action.slice(0, -3)}ed devcontainer: ${container}`);
          }
        }
      } catch (error) {
        // No devcontainers found for this workspace, that's okay
      }

      // Also stop/remove any containers with the specific workspace name pattern
      // Search for both old format (aisanity-${workspaceName}) and new format (${workspaceName}-)
      try {
        const output = execSync(`docker ps --filter "name=aisanity-${workspaceName}" --filter "name=${workspaceName}-" --format "{{.Names}}"`, {
          encoding: 'utf8'
        });

        const containers = output.trim().split('\n').filter(name => name.trim() !== '');

        for (const container of containers) {
          if (container) {
            const dockerCommand = options.clean ? `docker rm -f ${container}` : `docker stop ${container}`;
            execSync(dockerCommand, { stdio: 'inherit' });
            console.log(`${action.slice(0, -3)}ed aisanity container: ${container}`);
          }
        }
      } catch (error) {
        // No aisanity containers found for this workspace, that's okay
      }

      // Build the container
      console.log('Building dev container...');
      const buildArgs = ['build', '--workspace-folder', cwd];

      if (options.devcontainerJson) {
        buildArgs.push('--config', path.resolve(options.devcontainerJson));
      }

      const buildResult = Bun.spawn(['devcontainer', ...buildArgs], {
        stdio: ['inherit', 'inherit', 'inherit'],
        cwd
      });

      const buildExitCode = await buildResult.exited;
      if (buildExitCode !== 0) {
        throw new Error(`devcontainer build failed with code ${buildExitCode}`);
      }

      // Start the container
      console.log('Starting dev container...');
      const upArgs = ['up', '--workspace-folder', cwd];

      if (options.devcontainerJson) {
        upArgs.push('--config', path.resolve(options.devcontainerJson));
      }

      const upResult = Bun.spawn(['devcontainer', ...upArgs], {
        stdio: ['inherit', 'inherit', 'inherit'],
        cwd
      });

      const upExitCode = await upResult.exited;
      if (upExitCode !== 0) {
        throw new Error(`devcontainer up failed with code ${upExitCode}`);
      }

      console.log('Dev container rebuilt and started successfully');

    } catch (error) {
      console.error('Failed to rebuild container:', error);
      process.exit(1);
    }
  });