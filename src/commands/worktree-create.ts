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
  getAllWorktrees 
} from '../utils/worktree-utils';
import { loadAisanityConfig, getCurrentBranch } from '../utils/config';

export const worktreeCreateCommand = new Command('create')
  .description('Create a new worktree with automatic container setup')
  .argument('<branch>', 'Branch name for the new worktree')
  .option('--no-switch', 'Do not switch to the new worktree after creation')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (branch: string, options) => {
    const cwd = process.cwd();
    
    try {
      // Validate branch name
      if (!validateBranchName(branch)) {
        console.error(`Invalid branch name: ${branch}`);
        console.error('Branch names should contain only letters, numbers, hyphens, underscores, dots, and slashes');
        process.exit(1);
      }
      
      // Get main workspace path
      const mainPath = getMainWorkspacePath(cwd);
      
      // Check if worktree already exists
      if (worktreeExists(branch, mainPath)) {
        console.error(`Worktree '${branch}' already exists`);
        process.exit(1);
      }
      
      // Verify main workspace has .aisanity config
      const mainConfig = loadAisanityConfig(mainPath);
      if (!mainConfig) {
        console.error('No .aisanity config found in main workspace');
        console.error('Please run "aisanity init" in the main workspace first');
        process.exit(1);
      }
      
      if (options.verbose) {
        console.log(`Creating worktree for branch: ${branch}`);
        console.log(`Main workspace path: ${mainPath}`);
      }
      
      // Create worktrees directory if it doesn't exist
      const worktreesDir = path.join(mainPath, 'worktrees');
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
          cwd: mainPath,
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
          cwd: mainPath,
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
        process.exit(1);
      }
      
      // Copy .aisanity config to worktree
      copyConfigToWorktree(mainPath, worktreePath);
      if (options.verbose) {
        console.log(`Copied .aisanity config to worktree`);
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
      
      // Switch to worktree if requested (default behavior)
      if (options.switch !== false) {
        console.log(`\nSwitching to worktree: ${worktreePath}`);
        process.chdir(worktreePath);
        console.log(`You are now in worktree: ${branch}`);
        console.log(`Run 'aisanity run' to start the development container`);
      } else {
        console.log(`\nWorktree created at: ${worktreePath}`);
        console.log(`Use 'aisanity worktree switch ${branch}' to switch to it`);
      }
      
    } catch (error) {
      console.error('Failed to create worktree:', error);
      process.exit(1);
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
  
  // Generate consistent ID labels for container identification
  const idLabels = [
    `aisanity.workspace=${workspaceName}`,
    `aisanity.branch=${branch}`,
    `aisanity.container=${workspaceName}-${branch}`
  ];
  
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