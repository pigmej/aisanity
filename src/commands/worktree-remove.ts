import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { safeSpawn, safeExecSyncSync as execSync } from '../utils/runtime-utils';
import { getMainWorkspacePath, getWorktreeByName, getAllWorktrees } from '../utils/worktree-utils';
import { safeDockerExec } from '../utils/docker-safe-exec';
import { checkWorktreeEnabled } from '../utils/config';
import { discoverByLabels, stopContainers, removeContainers } from '../utils/container-utils';

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
         throw new Error(`Worktree '${worktreeName}' not found. Use "aisanity worktree list" to see available worktrees`);
       }
      
       // Verify worktree path exists
       if (!fs.existsSync(worktreePath)) {
         throw new Error(`Worktree path does not exist: ${worktreePath}`);
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
           throw new Error('Worktree removal cancelled by user');
         }
      }
      
      if (options.verbose) {
        console.log(`Removing worktree: ${worktreeName}`);
      }
      
      // Stop and remove containers using label-based discovery
      try {
        // Discover containers by workspace path and branch labels
        const containers = await discoverByLabels(options.verbose);
        
        // Filter containers that match the worktree being removed
        const matchingContainers = containers.filter(container => {
          const workspaceLabel = container.labels['aisanity.workspace'];
          const branchLabel = container.labels['aisanity.branch'];
          return workspaceLabel === worktree.path && branchLabel === worktree.branch;
        });

        if (matchingContainers.length > 0) {
          if (options.verbose) {
            console.log(`Found ${matchingContainers.length} container(s) for workspace:`);
            matchingContainers.forEach(container => {
              console.log(`  - '${container.name}' (ID: ${container.id})`);
            });
          }

          // Stop containers by their actual IDs
          const containerIds = matchingContainers.map(c => c.id);
          await stopContainers(containerIds, options.verbose);
          
          // Remove containers by their actual IDs
          await removeContainers(containerIds, options.verbose);
          
          if (options.verbose) {
            matchingContainers.forEach(container => {
              const expectedName = container.labels['aisanity.container'] || 'unknown';
              console.log(`Cleaned up container: ${container.name} (${expectedName})`);
            });
          }
        } else {
          if (options.verbose) {
            console.log(`No containers found for workspace: ${worktree.path}`);
          }
        }
      } catch (error) {
        // Container discovery or cleanup failed, but continue with worktree removal
        if (options.verbose) {
          console.warn(`Container cleanup encountered issues: ${error instanceof Error ? error.message : 'Unknown error'}`);
          console.log('Continuing with worktree directory cleanup...');
        }
      }
      
      // Remove git worktree
      try {
        const removeResult = safeSpawn('git', ['worktree', 'remove', worktreePath], {
          cwd: gitRoot,
          stdio: options.verbose ? 'inherit' : 'pipe'
        });
        
        await new Promise<void>((resolve, reject) => {
          removeResult.on('error', reject);
          removeResult.on('exit', (code: number) => {
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
       throw error;
     }
  });