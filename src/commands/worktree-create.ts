import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { spawn } from 'child_process';
import {
  getMainWorkspacePath,
  validateBranchName,
  worktreeExists,
  copyConfigToWorktree,
  createAisanityDirectory,
  getAllWorktrees,
  shouldCopyDevContainer,
  copyDevContainerToWorktree
} from '../utils/worktree-utils';
import { loadAisanityConfig, getCurrentBranch, checkWorktreeEnabled } from '../utils/config';
import { generateContainerLabels, validateContainerLabels } from '../utils/container-utils';

export const worktreeCreateCommand = new Command('create')
  .description('Create a new worktree with automatic container setup')
  .argument('<branch>', 'Branch name for the new worktree')
  .option('--no-switch', 'Do not switch to the new worktree after creation')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (branch: string, options) => {
    const cwd = process.cwd();
    
    // Check if worktree functionality is enabled
    checkWorktreeEnabled(cwd);
    
    try {
       // Validate branch name
       if (!validateBranchName(branch)) {
         throw new Error(`Invalid branch name: ${branch}. Branch names should contain only letters, numbers, hyphens, underscores, dots, and slashes`);
       }
      
      // Get top-level workspace path (parent directory structure)
      const topLevelPath = getMainWorkspacePath(cwd);
      
      // Get git root (where .git actually is)
      const gitRoot = execSync('git rev-parse --show-toplevel', {
        cwd,
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
      
       // Check if worktree already exists
       if (worktreeExists(branch, topLevelPath)) {
         throw new Error(`Worktree '${branch}' already exists`);
       }
      
      // Verify main workspace has .aisanity config (could be in top level or git root)
      let mainConfigPath = topLevelPath;
      if (!fs.existsSync(path.join(topLevelPath, '.aisanity'))) {
        mainConfigPath = gitRoot;
      }
      
       const mainConfig = loadAisanityConfig(mainConfigPath);
       if (!mainConfig) {
         throw new Error('No .aisanity config found in main workspace. Please run "aisanity init" in the main workspace first');
       }
      
      if (options.verbose) {
        console.log(`Creating worktree for branch: ${branch}`);
        console.log(`Top-level path: ${topLevelPath}`);
        console.log(`Git root: ${gitRoot}`);
        console.log(`Config path: ${mainConfigPath}`);
      }
      
      // Create worktrees directory if it doesn't exist
      const worktreesDir = path.join(topLevelPath, 'worktrees');
      if (!fs.existsSync(worktreesDir)) {
        fs.mkdirSync(worktreesDir, { recursive: true });
        if (options.verbose) {
          console.log(`Created worktrees directory: ${worktreesDir}`);
        }
      }
      
      const worktreePath = path.join(worktreesDir, branch);
      
      // Check if branch already exists
      let branchExists = false;
      try {
        execSync(`git show-ref --verify --quiet refs/heads/${branch}`, {
          cwd: gitRoot,
          stdio: 'pipe'
        });
        branchExists = true;
      } catch (error) {
        // Branch doesn't exist, that's okay
        branchExists = false;
      }
      
      // Create git worktree
      try {
        let gitArgs;
        if (branchExists) {
          // Branch exists, create worktree - CORRECT ORDER: path first, then branch
          gitArgs = ['worktree', 'add', worktreePath, branch];
        } else {
          // Branch doesn't exist, create worktree with -b flag
          gitArgs = ['worktree', 'add', '-b', branch, worktreePath];
        }
        
        // Use spawn for better security
        const gitResult = spawn('git', gitArgs, {
          cwd: gitRoot,
          stdio: options.verbose ? 'inherit' : 'pipe'
        });
        
        await new Promise<void>((resolve, reject) => {
          gitResult.on('error', reject);
          gitResult.on('exit', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`git worktree add failed with code ${code}`));
            }
          });
        });
        
        if (options.verbose) {
          console.log(`Created git worktree: ${worktreePath} ${branchExists ? '(existing branch)' : '(new branch)'}`);
        }
       } catch (error) {
         console.error(`Failed to create git worktree: ${error}`);
         throw error;
       }
      
       // Copy .aisanity config to worktree
       copyConfigToWorktree(mainConfigPath, worktreePath);
       if (options.verbose) {
         console.log(`Copied .aisanity config to worktree`);
       }

       // Copy .devcontainer if it exists locally but is not tracked in git
       if (shouldCopyDevContainer(gitRoot)) {
         try {
           copyDevContainerToWorktree(gitRoot, worktreePath);
           if (options.verbose) {
             console.log(`Copied .devcontainer directory to worktree (not tracked in git)`);
           }
         } catch (error) {
           console.warn(`Warning: Failed to copy .devcontainer to worktree: ${error}`);
         }
       }

       // Create aisanity directory structure
       createAisanityDirectory(worktreePath);
       if (options.verbose) {
         console.log(`Created aisanity directory structure`);
       }
      
      // Automatically provision container for the worktree
      if (options.verbose) {
        console.log(`Provisioning container for worktree: ${branch}`);
      }
      
      try {
        await provisionContainer(worktreePath, options.verbose);
        if (options.verbose) {
          console.log(`Container provisioned successfully`);
        }
      } catch (error) {
        console.warn(`Warning: Failed to provision container automatically: ${error}`);
        console.log(`You can manually provision the container later by running 'aisanity run' in the worktree`);
      }
      
      // Get worktree info for display
      const worktrees = getAllWorktrees(worktreePath);
      const newWorktree = worktrees.worktrees.find(wt => wt.path === worktreePath);
      
      if (newWorktree) {
        console.log(`✓ Created worktree '${branch}'`);
        console.log(`  Path: ${newWorktree.path}`);
        console.log(`  Branch: ${newWorktree.branch}`);
        console.log(`  Container name: ${newWorktree.containerName}`);
        console.log(`  Config: ${newWorktree.configPath}`);
        console.log(`  Container: Automatically provisioned`);
      }
      
      // Show path to switch to worktree if requested (default behavior)
      if (options.switch !== false) {
        console.log(`\nTo switch to this worktree, run:`);
        console.log(`  cd ${worktreePath}`);
        console.log(`\nThen run 'aisanity run' to start the development container`);
      } else {
        console.log(`\nWorktree created at: ${worktreePath}`);
        console.log(`To switch to it, run: cd ${worktreePath}`);
      }
      
     } catch (error) {
       console.error('Failed to create worktree:', error);
       throw error;
     }
  });

/**
 * Provision a container for the given worktree path
 */
async function provisionContainer(worktreePath: string, verbose: boolean = false): Promise<void> {
  const config = loadAisanityConfig(worktreePath);
  if (!config) {
    throw new Error('No .aisanity config found in worktree');
  }

  const workspaceName = config.workspace;
  const branch = getCurrentBranch(worktreePath);
  const containerName = `${workspaceName}-${branch}`;

  // Generate consistent ID labels for container identification
  const containerLabels = generateContainerLabels(workspaceName, branch, containerName, worktreePath);
  const idLabels = Object.entries(containerLabels).map(([key, value]) => `${key}=${value}`);

  // Validate that all required labels are present
  if (!validateContainerLabels(containerLabels)) {
    throw new Error('Failed to generate required container labels');
  }
  
  // Determine devcontainer.json path
  const devcontainerPath = path.join(worktreePath, '.devcontainer', 'devcontainer.json');
  if (!fs.existsSync(devcontainerPath)) {
    throw new Error('No devcontainer.json found in .devcontainer/ directory');
  }
  
  if (verbose) {
    console.log(`Starting devcontainer for branch '${branch}' with labels: ${idLabels.join(', ')}`);
  }

  // Start the dev container
  const upArgs = ['up', '--workspace-folder', worktreePath];
  upArgs.push('--config', devcontainerPath);
  
  // Add ID labels for consistent container identification
  idLabels.forEach(label => {
    upArgs.push('--id-label', label);
  });

  const upResult = spawn('devcontainer', upArgs, {
    stdio: verbose ? 'inherit' : 'pipe',
    cwd: worktreePath
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
}