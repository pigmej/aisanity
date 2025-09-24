import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { getMainWorkspacePath, getWorktreeByName, getAllWorktrees } from '../utils/worktree-utils';
import { safeDockerExec } from '../utils/docker-safe-exec';
import { checkWorktreeEnabled } from '../utils/config';

export const worktreeRemoveCommand = new Command('remove')
  .description('Remove a worktree and clean up associated containers')
  .argument('<path>', 'Worktree path or name to remove')
  .option('--force', 'Force removal without confirmation')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (worktreeIdentifier: string, options) => {
    const cwd = process.cwd();
    
    // Check if worktree functionality is enabled
    checkWorktreeEnabled(cwd);
    
    try {
      const topLevelPath = getMainWorkspacePath(cwd);
      
      // Get git root for git commands
      const { execSync } = require('child_process');
      const gitRoot = execSync('git rev-parse --show-toplevel', {
        cwd,
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
      
      // Determine if identifier is a path or name
      let worktreePath: string;
      let worktreeName: string;
      
      if (path.isAbsolute(worktreeIdentifier)) {
        // Absolute path provided
        worktreePath = worktreeIdentifier;
        worktreeName = path.basename(worktreePath);
      } else if (worktreeIdentifier.includes(path.sep)) {
        // Relative path provided
        worktreePath = path.resolve(cwd, worktreeIdentifier);
        worktreeName = path.basename(worktreePath);
      } else {
        // Worktree name provided
        worktreeName = worktreeIdentifier;
        worktreePath = path.join(topLevelPath, 'worktrees', worktreeName);
      }
      
      // Get worktree info
      const worktree = getWorktreeByName(worktreeName, topLevelPath);
      if (!worktree) {
        console.error(`Worktree '${worktreeName}' not found`);
        console.error('Use "aisanity worktree list" to see available worktrees');
        process.exit(1);
      }
      
      // Verify worktree path exists
      if (!fs.existsSync(worktreePath)) {
        console.error(`Worktree path does not exist: ${worktreePath}`);
        process.exit(1);
      }
      
      // Show worktree details
      console.log(`Worktree to remove:`);
      console.log(`  Name: ${worktreeName}`);
      console.log(`  Path: ${worktreePath}`);
      console.log(`  Branch: ${worktree.branch}`);
      console.log(`  Container: ${worktree.containerName}`);
      console.log('');
      
      // Confirmation check
      if (!options.force) {
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answer = await new Promise<string>((resolve) => {
          rl.question(`Are you sure you want to remove worktree '${worktreeName}'? This will delete the directory and remove the container. [y/N]: `, resolve);
        });
        
        rl.close();
        
        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log('Worktree removal cancelled');
          process.exit(0);
        }
      }
      
      if (options.verbose) {
        console.log(`Removing worktree: ${worktreeName}`);
      }
      
      // Stop and remove container if it exists
      try {
        await safeDockerExec(['stop', worktree.containerName], {
          verbose: options.verbose,
          timeout: 30000
        });
        if (options.verbose) {
          console.log(`Stopped container: ${worktree.containerName}`);
        }
      } catch (error) {
        // Container might not be running, that's okay
        if (options.verbose) {
          console.log(`Container not running or does not exist: ${worktree.containerName}`);
        }
      }
      
      try {
        await safeDockerExec(['rm', worktree.containerName], {
          verbose: options.verbose,
          timeout: 30000
        });
        if (options.verbose) {
          console.log(`Removed container: ${worktree.containerName}`);
        }
      } catch (error) {
        // Container might not exist, that's okay
        if (options.verbose) {
          console.log(`Container does not exist: ${worktree.containerName}`);
        }
      }
      
      // Remove git worktree
      try {
        const removeResult = spawn('git', ['worktree', 'remove', worktreePath], {
          cwd: gitRoot,
          stdio: options.verbose ? 'inherit' : 'pipe'
        });
        
        await new Promise<void>((resolve, reject) => {
          removeResult.on('error', reject);
          removeResult.on('exit', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`git worktree remove failed with code ${code}`));
            }
          });
        });
        
        if (options.verbose) {
          console.log(`Removed git worktree: ${worktreePath}`);
        }
      } catch (error) {
        console.error(`Failed to remove git worktree: ${error}`);
        // Continue with directory removal even if git worktree removal fails
      }
      
      // Remove worktree directory if it still exists
      if (fs.existsSync(worktreePath)) {
        fs.rmSync(worktreePath, { recursive: true, force: true });
        if (options.verbose) {
          console.log(`Removed worktree directory: ${worktreePath}`);
        }
      }
      
      console.log(`✓ Successfully removed worktree '${worktreeName}'`);
      
      // Show remaining worktrees
      const remainingWorktrees = getAllWorktrees(cwd);
      console.log('');
      console.log(`Remaining worktrees: ${remainingWorktrees.worktrees.length}`);
      
      if (remainingWorktrees.worktrees.length > 0) {
        console.log('Use "aisanity worktree list" to see all worktrees');
      }
      
    } catch (error) {
      console.error('Failed to remove worktree:', error);
      process.exit(1);
    }
  });