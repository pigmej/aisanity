import { Command } from 'commander';
import * as path from 'path';
import { getMainWorkspacePath, getWorktreeByName, getAllWorktrees, isWorktree } from '../utils/worktree-utils';
import { checkWorktreeEnabled } from '../utils/config';

export const worktreeSwitchCommand = new Command('switch')
  .description('Switch to a different worktree')
  .argument('<path>', 'Worktree path or name to switch to')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (worktreeIdentifier: string, options) => {
    const cwd = process.cwd();
    
    // Check if worktree functionality is enabled
    checkWorktreeEnabled(cwd);
    
    try {
      const mainPath = getMainWorkspacePath(cwd);
      
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
        
        // Special case: "main" refers to the main workspace
        if (worktreeName === 'main') {
          worktreePath = mainPath;
        } else {
          worktreePath = path.join(mainPath, 'worktrees', worktreeName);
        }
      }
      
      // Get worktree info
      let worktree;
      if (worktreeName === 'main') {
        // Handle main workspace case
        const worktrees = getAllWorktrees(cwd);
        worktree = worktrees.main;
      } else {
        worktree = getWorktreeByName(worktreeName, mainPath);
      }
      
      if (!worktree) {
        console.error(`Worktree '${worktreeName}' not found`);
        console.error('Use "aisanity worktree list" to see available worktrees');
        process.exit(1);
      }
      
      // Verify worktree path exists
      if (!require('fs').existsSync(worktreePath)) {
        console.error(`Worktree path does not exist: ${worktreePath}`);
        process.exit(1);
      }
      
      // Show current location
      const currentLocation = isWorktree(cwd) ? 
        `worktree '${path.basename(cwd)}'` : 
        'main workspace';
      
      console.log(`Switching from ${currentLocation} to worktree '${worktreeName}'`);
      
      if (options.verbose) {
        console.log(`Current path: ${cwd}`);
        console.log(`Target path: ${worktreePath}`);
        console.log(`Target branch: ${worktree.branch}`);
        console.log(`Target container: ${worktree.containerName}`);
      }
      
       // Switch to the worktree directory
       process.chdir(worktreePath);

       console.log(`✓ Switched to worktree: ${worktreeName}`);
       console.log(`  Path: ${worktreePath}`);
       console.log(`  Branch: ${worktree.branch}`);
       console.log(`  Container: ${worktree.containerName}`);

       // Note about container provisioning
       console.log('');
       console.log(`Note: If this is your first time in this worktree, run 'aisanity run' to provision the container`);
      
    } catch (error) {
      console.error('Failed to switch worktree:', error);
      process.exit(1);
    }
  });