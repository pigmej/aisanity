import { Command } from 'commander';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { loadAisanityConfig, getContainerName, getCurrentBranch } from '../utils/config';

export const statusCommand = new Command('status')
  .description('Display the status of all containers used for the current workspace')
  .option('--worktree <path>', 'Show status for specific worktree')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    try {
      let cwd = process.cwd();
      
      // Handle worktree option
      if (options.worktree) {
        const worktreePath = path.resolve(options.worktree);
        if (!fs.existsSync(worktreePath)) {
          console.error(`Worktree path does not exist: ${worktreePath}`);
          process.exit(1);
        }
        cwd = worktreePath;
        console.log(`Showing status for worktree: ${worktreePath}`);
      }
      
      const config = loadAisanityConfig(cwd);

      if (!config) {
        console.error('No .aisanity config found. Run "aisanity init" first.');
        process.exit(1);
      }

      const workspaceName = config.workspace;
      const containerName = getContainerName(cwd, options.verbose || false);
      const branch = getCurrentBranch(cwd);

      console.log(`Workspace: ${workspaceName}`);
      console.log(`Branch: ${branch}`);
      console.log(`Container: ${containerName}`);
      console.log('─'.repeat(50));

      // Check main container status using ID labels
      try {
        const output = execSync(`docker ps -a --filter "label=aisanity.workspace=${workspaceName}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"`, {
          encoding: 'utf8'
        });

        if (output.trim()) {
          console.log('Main Container:');
          console.log(output);
        } else {
          console.log('Main Container: Not found');
        }
      } catch (error) {
        console.log('Main Container: Error checking status');
      }

      // Check for devcontainer related to current workspace
      try {
        const output = execSync(`docker ps -a --filter "label=devcontainer.local_folder=${cwd}" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"`, {
          encoding: 'utf8'
        });

        const lines = output.trim().split('\n');
        if (lines.length > 1) {
          console.log('\nDevcontainer:');
          // Show only the current workspace's devcontainer
          const containerLine = lines[1]; // Skip header, get first container
          if (containerLine && containerLine.trim()) {
            const parts = containerLine.split('\t');
            if (parts.length >= 3) {
              console.log(`  Name: ${parts[0]}`);
              console.log(`  Status: ${parts[1]}`);
              console.log(`  Image: ${parts[2]}`);
            } else {
              console.log(containerLine);
            }
          }
        } else {
          console.log('\nDevcontainer: Not running');
        }
      } catch (error) {
        console.log('\nDevcontainer: Error checking status');
      }

      // Check workspace configuration
      console.log('\nConfiguration:');
      console.log(`  Workspace: ${config.workspace}`);
      console.log(`  Container Name: ${config.containerName || 'auto-generated'}`);
      if (config.env && Object.keys(config.env).length > 0) {
        console.log('  Environment Variables:');
        Object.entries(config.env).forEach(([key, value]) => {
          console.log(`    ${key}=${value}`);
        });
      } else {
        console.log('  Environment Variables: None');
      }

    } catch (error) {
      console.error('Failed to check status:', error);
      process.exit(1);
    }
  });