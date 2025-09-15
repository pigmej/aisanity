import { Command } from 'commander';
import * as path from 'path';
import { spawn } from 'child_process';
import { loadAisanityConfig } from '../utils/config';

export const runCommand = new Command('run')
  .description('Run interactive container work using devcontainer exec')
  .argument('[command...]', 'Command to run in container (defaults to shell)')
  .option('--devcontainer-json <path>', 'Path to devcontainer.json file')
  .action(async (commandArgs: string[], options) => {
    try {
      const cwd = process.cwd();
      const config = loadAisanityConfig(cwd);

      if (!config) {
        console.error('No .aisanity config found. Run "aisanity init" first.');
        process.exit(1);
      }

      const workspaceName = config.workspace;

      // Default to bash shell if no command provided
      const command = commandArgs.length > 0 ? commandArgs : ['bash'];

      console.log(`Starting container for workspace: ${workspaceName}`);
      console.log(`Running command: ${command.join(' ')}`);

      // First, ensure the dev container is up and running
      console.log('Checking/starting dev container...');
      const upArgs = ['up', '--workspace-folder', cwd];

      if (options.devcontainerJson) {
        upArgs.push('--config', path.resolve(options.devcontainerJson));
      }

      const upResult = spawn('devcontainer', upArgs, {
        stdio: 'inherit',
        cwd
      });

      await new Promise<void>((resolve, reject) => {
        upResult.on('error', reject);
        upResult.on('exit', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`devcontainer up failed with code ${code}`));
          }
        });
      });

      console.log('Dev container is ready');

      // Now execute the command in the running container
      const execArgs = [
        'exec',
        '--workspace-folder', cwd
      ];

      if (options.devcontainerJson) {
        execArgs.push('--config', path.resolve(options.devcontainerJson));
      }

      execArgs.push(...command);

      // Spawn devcontainer exec process
      const child = spawn('devcontainer', execArgs, {
        stdio: 'inherit',
        cwd
      });

      // Handle process events
      child.on('error', (error) => {
        console.error('Failed to execute command in devcontainer:', error.message);
        process.exit(1);
      });

      child.on('exit', (code) => {
        process.exit(code || 0);
      });

    } catch (error) {
      console.error('Failed to run container:', error);
      process.exit(1);
    }
  });