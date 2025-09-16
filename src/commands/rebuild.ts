import { Command } from 'commander';
import * as path from 'path';
import { spawn } from 'child_process';
import { loadAisanityConfig } from '../utils/config';

export const rebuildCommand = new Command('rebuild')
  .description('Rebuild the devcontainer')
  .option('--devcontainer-json <path>', 'Path to devcontainer.json file')
  .action(async (options) => {
    try {
      const cwd = process.cwd();
      const config = loadAisanityConfig(cwd);

      if (!config) {
        console.error('No .aisanity config found. Run "aisanity init" first.');
        process.exit(1);
      }

      const workspaceName = config.workspace;

      console.log(`Rebuilding container for workspace: ${workspaceName}`);

      // Stop the container
      console.log('Stopping existing container...');
      const downArgs = ['down', '--workspace-folder', cwd];

      if (options.devcontainerJson) {
        downArgs.push('--config', path.resolve(options.devcontainerJson));
      }

      const downResult = spawn('devcontainer', downArgs, {
        stdio: 'inherit',
        cwd
      });

      await new Promise<void>((resolve, reject) => {
        downResult.on('error', reject);
        downResult.on('exit', (code) => {
          if (code === 0 || code === 1) { // 1 if no container running
            resolve();
          } else {
            reject(new Error(`devcontainer down failed with code ${code}`));
          }
        });
      });

      // Build the container
      console.log('Building dev container...');
      const buildArgs = ['build', '--workspace-folder', cwd];

      if (options.devcontainerJson) {
        buildArgs.push('--config', path.resolve(options.devcontainerJson));
      }

      const buildResult = spawn('devcontainer', buildArgs, {
        stdio: 'inherit',
        cwd
      });

      await new Promise<void>((resolve, reject) => {
        buildResult.on('error', reject);
        buildResult.on('exit', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`devcontainer build failed with code ${code}`));
          }
        });
      });

      // Start the container
      console.log('Starting dev container...');
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

      console.log('Dev container rebuilt and started successfully');

    } catch (error) {
      console.error('Failed to rebuild container:', error);
      process.exit(1);
    }
  });