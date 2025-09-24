import { Command } from 'commander';
import * as path from 'path';
import { spawn } from 'child_process';
import { loadAisanityConfig, getContainerName, getCurrentBranch } from '../utils/config';
import * as fs from 'fs';

export const runCommand = new Command('run')
  .description('Run interactive container work using devcontainer exec')
  .argument('[command...]', 'Command to run in container (defaults to shell)')
  .option('--devcontainer-json <path>', 'Path to devcontainer.json file')
  .option('--force-recreate', 'Force recreation of branch-specific devcontainer file')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (commandArgs: string[], options) => {
    const cwd = process.cwd();
    
    try {
      const config = loadAisanityConfig(cwd);

      if (!config) {
        console.error('No .aisanity config found. Run "aisanity init" first.');
        process.exit(1);
      }

      const workspaceName = config.workspace;
      const containerName = getContainerName(cwd, options.verbose || false);

      // Default to bash shell if no command provided
      const command = commandArgs.length > 0 ? commandArgs : ['bash'];

      console.log(`Starting container for workspace: ${workspaceName}`);
      console.log(`Running command: ${command.join(' ')}`);

      // Generate consistent ID labels for container identification
      const branch = getCurrentBranch(cwd);
      const idLabels = [
        `aisanity.workspace=${workspaceName}`,
        `aisanity.branch=${branch}`,
        `aisanity.container=${containerName}`
      ];
      
      // Determine which devcontainer.json to use
      let devcontainerPath: string;
      if (options.devcontainerJson) {
        devcontainerPath = path.resolve(options.devcontainerJson);
        console.log(`Using specified devcontainer: ${devcontainerPath}`);
      } else {
        // Use default devcontainer.json
        const defaultPath = path.join(cwd, '.devcontainer', 'devcontainer.json');
        if (!fs.existsSync(defaultPath)) {
          console.error('No devcontainer.json found in .devcontainer/ directory.');
          process.exit(1);
        }
        devcontainerPath = defaultPath;
      }
      
      console.log(`Starting devcontainer for branch '${branch}' with labels: ${idLabels.join(', ')}`);

      // First, ensure the dev container is up and running
      console.log('Checking/starting dev container...');
      const upArgs = ['up', '--workspace-folder', cwd];

      if (devcontainerPath) {
        upArgs.push('--config', devcontainerPath);
      }
      
      // Add ID labels for consistent container identification
      idLabels.forEach(label => {
        upArgs.push('--id-label', label);
      });

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

      if (devcontainerPath) {
        execArgs.push('--config', devcontainerPath);
      }
      
      // Add ID labels for consistent container identification
      idLabels.forEach(label => {
        execArgs.push('--id-label', label);
      });

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