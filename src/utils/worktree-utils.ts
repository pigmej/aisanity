import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { AisanityConfig, loadAisanityConfig, getWorkspaceName, sanitizeBranchName, getCurrentBranch } from './config';

export interface WorktreeInfo {
  path: string;          // Absolute path to worktree directory
  branch: string;        // Associated git branch name
  containerName: string; // Generated container name (e.g., "aisanity-feature-auth")
  isActive: boolean;     // Whether this is the currently active worktree
  configPath: string;    // Path to .aisanity config file
}

export interface WorktreeList {
  main: WorktreeInfo;           // Main workspace worktree
  worktrees: WorktreeInfo[];    // Array of additional worktrees
}

/**
 * Check if current directory is a worktree
 */
export function isWorktree(cwd: string): boolean {
  try {
    const gitDir = execSync('git rev-parse --git-dir', {
      cwd,
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim();
    
    // In worktrees, the git dir points to the main repo's git dir
    return gitDir.includes('worktrees');
  } catch (error) {
    return false;
  }
}

/**
 * Get the main workspace path from a worktree
 */
export function getMainWorkspacePath(cwd: string): string {
  try {
    const gitDir = execSync('git rev-parse --git-dir', {
      cwd,
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim();
    
    // In worktrees, git dir is like: .git/worktrees/<worktree-name>
    // The main repo is two levels up from the worktrees directory
    if (gitDir.includes('worktrees')) {
      const worktreesDir = path.dirname(gitDir);
      const mainGitDir = path.dirname(worktreesDir);
      return path.dirname(mainGitDir); // Return the directory containing .git
    }
    
    return cwd; // Already in main workspace
  } catch (error) {
    throw new Error('Failed to determine main workspace path');
  }
}

/**
 * Get worktree name from path
 */
export function getWorktreeName(worktreePath: string): string {
  const pathParts = worktreePath.split(path.sep);
  return pathParts[pathParts.length - 1]; // Last part of the path
}

/**
 * Generate container name for worktree
 */
export function generateWorktreeContainerName(workspaceName: string, worktreeName: string): string {
  const sanitizedWorktreeName = sanitizeBranchName(worktreeName);
  return `${workspaceName}-${sanitizedWorktreeName}`;
}

/**
 * Get all worktrees for the current repository
 */
export function getAllWorktrees(cwd: string): WorktreeList {
  const mainPath = getMainWorkspacePath(cwd);
  const worktreesDir = path.join(mainPath, 'worktrees');
  
  // Get main workspace info
  const mainConfig = loadAisanityConfig(mainPath);
  if (!mainConfig) {
    throw new Error('No .aisanity config found in main workspace');
  }
  
  const mainWorkspaceName = getWorkspaceName(mainPath);
  const mainBranch = getCurrentBranch(mainPath);
  
  const mainWorktree: WorktreeInfo = {
    path: mainPath,
    branch: mainBranch,
    containerName: generateWorktreeContainerName(mainWorkspaceName, mainBranch),
    isActive: cwd === mainPath,
    configPath: path.join(mainPath, '.aisanity')
  };
  
  const worktrees: WorktreeInfo[] = [];
  
  // Check if worktrees directory exists
  if (fs.existsSync(worktreesDir)) {
    const worktreeDirs = fs.readdirSync(worktreesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    for (const worktreeName of worktreeDirs) {
      const worktreePath = path.join(worktreesDir, worktreeName);
      
      try {
        // Verify this is actually a git worktree
        const worktreeBranch = getCurrentBranch(worktreePath);
        const worktreeConfig = loadAisanityConfig(worktreePath);
        
        if (worktreeConfig) {
          const worktreeInfo: WorktreeInfo = {
            path: worktreePath,
            branch: worktreeBranch,
            containerName: generateWorktreeContainerName(mainWorkspaceName, worktreeName),
            isActive: cwd === worktreePath,
            configPath: path.join(worktreePath, '.aisanity')
          };
          
          worktrees.push(worktreeInfo);
        }
      } catch (error) {
        // Skip invalid worktrees
        console.warn(`Skipping invalid worktree: ${worktreeName}`);
      }
    }
  }
  
  return {
    main: mainWorktree,
    worktrees
  };
}



/**
 * Validate branch name
 */
export function validateBranchName(branchName: string): boolean {
  // Basic validation - should not contain spaces or special characters that break git
  return /^[a-zA-Z0-9_\-\/\.]+$/.test(branchName) && branchName.length > 0;
}

/**
 * Copy .aisanity config from main workspace to worktree
 */
export function copyConfigToWorktree(mainPath: string, worktreePath: string): void {
  const mainConfigPath = path.join(mainPath, '.aisanity');
  const worktreeConfigPath = path.join(worktreePath, '.aisanity');
  
  if (!fs.existsSync(mainConfigPath)) {
    throw new Error('No .aisanity config found in main workspace');
  }
  
  const configContent = fs.readFileSync(mainConfigPath, 'utf8');
  fs.writeFileSync(worktreeConfigPath, configContent, 'utf8');
}

/**
 * Create aisanity directory structure in worktree
 */
export function createAisanityDirectory(worktreePath: string): void {
  const aisanityDir = path.join(worktreePath, 'aisanity');
  if (!fs.existsSync(aisanityDir)) {
    fs.mkdirSync(aisanityDir, { recursive: true });
  }
}

/**
 * Check if a worktree with given name already exists
 */
export function worktreeExists(worktreeName: string, mainPath: string): boolean {
  const worktreePath = path.join(mainPath, 'worktrees', worktreeName);
  return fs.existsSync(worktreePath);
}

/**
 * Get worktree info by name
 */
export function getWorktreeByName(worktreeName: string, mainPath: string): WorktreeInfo | null {
  const worktreePath = path.join(mainPath, 'worktrees', worktreeName);
  
  if (!fs.existsSync(worktreePath)) {
    return null;
  }
  
  try {
    const mainConfig = loadAisanityConfig(mainPath);
    if (!mainConfig) {
      return null;
    }
    
    const mainWorkspaceName = getWorkspaceName(mainPath);
    const worktreeBranch = getCurrentBranch(worktreePath);
    const worktreeConfig = loadAisanityConfig(worktreePath);
    
    if (!worktreeConfig) {
      return null;
    }
    
    return {
      path: worktreePath,
      branch: worktreeBranch,
      containerName: generateWorktreeContainerName(mainWorkspaceName, worktreeName),
      isActive: process.cwd() === worktreePath,
      configPath: path.join(worktreePath, '.aisanity')
    };
  } catch (error) {
    return null;
  }
}