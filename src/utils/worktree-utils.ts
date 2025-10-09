import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { AisanityConfig, loadAisanityConfig, getWorkspaceName, sanitizeBranchName, getCurrentBranch } from './config';
import { discoverContainers, DockerContainer } from './container-utils';

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
 * Check if current directory is a worktree by examining .git file for gitdir: reference
 */
export function isWorktree(cwd: string): boolean {
  try {
    const gitFilePath = path.join(cwd, '.git');
    if (!fs.existsSync(gitFilePath)) {
      return false;
    }

    const gitFileContent = fs.readFileSync(gitFilePath, 'utf8').trim();
    return gitFileContent.startsWith('gitdir:');
  } catch (error) {
    return false;
  }
}

/**
 * Get the main repository's .git directory path from worktree .git file
 */
export function getMainGitDirPath(cwd: string): string | null {
  try {
    const gitFilePath = path.join(cwd, '.git');
    if (!fs.existsSync(gitFilePath)) {
      return null;
    }

    const gitFileContent = fs.readFileSync(gitFilePath, 'utf8').trim();
    if (!gitFileContent.startsWith('gitdir:')) {
      return null;
    }

    const gitdirPath = gitFileContent.substring('gitdir:'.length).trim();
    // Resolve to absolute path if relative
    const absoluteGitdirPath = path.isAbsolute(gitdirPath) ? gitdirPath : path.resolve(cwd, gitdirPath);

    // Strip /worktrees/<name> to get main repo .git directory
    const worktreesIndex = absoluteGitdirPath.indexOf('/worktrees/');
    if (worktreesIndex === -1) {
      return null; // Not a worktree
    }

    return absoluteGitdirPath.substring(0, worktreesIndex);
  } catch (error) {
    return null;
  }
}

/**
 * Get the top-level workspace path (parent of aisanity/ subdirectory)
 * Expected structure:
 *   /path/to/project/           <- Top level (returned)
 *     .aisanity                 <- Config at top level
 *     aisanity/                 <- Main repo subdirectory
 *       .git/
 *     worktrees/                <- Worktrees at top level
 */
export function getMainWorkspacePath(cwd: string): string {
  try {
    // Get the git root directory
    const gitRoot = execSync('git rev-parse --show-toplevel', {
      cwd,
      encoding: 'utf8'
    }).trim();
    
    // Check if we're in a worktree
    const gitDir = execSync('git rev-parse --git-dir', {
      cwd,
      encoding: 'utf8'
    }).trim();
    
    // In worktrees, git dir is like: /main/repo/.git/worktrees/<worktree-name>
    if (gitDir.includes('worktrees')) {
      // Extract main repo path from git dir path
      const mainGitDirPath = gitDir.split('/worktrees/')[0]; // /main/repo/.git
      const mainRepoPath = path.dirname(mainGitDirPath); // /main/repo
      
      // Check if this main repo is in a subdirectory structure (aisanity/aisanity/)
      const parentDir = path.dirname(mainRepoPath);
      const parentConfig = path.join(parentDir, '.aisanity');
      const parentWorktrees = path.join(parentDir, 'worktrees');
      
      if (fs.existsSync(parentConfig) || fs.existsSync(parentWorktrees)) {
        // Main repo is in subdirectory, return parent as top level
        return parentDir;
      }
      
      // Otherwise, main repo directory is the top level
      return mainRepoPath;
    }
    
    // For main workspace, check if we're in an aisanity/ subdirectory structure
    // by looking for .aisanity config or worktrees directory in parent directory
    const parentDir = path.dirname(gitRoot);
    const parentConfig = path.join(parentDir, '.aisanity');
    const parentWorktrees = path.join(parentDir, 'worktrees');
    
    if (fs.existsSync(parentConfig) || fs.existsSync(parentWorktrees)) {
      // We're in the aisanity/ subdirectory, return parent as top level
      return parentDir;
    }
    
    // Otherwise, git root is the top level
    return gitRoot;
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
  const topLevelPath = getMainWorkspacePath(cwd);
  const worktreesDir = path.join(topLevelPath, 'worktrees');
  
  // Find the main git repository path (not worktree path)
  const gitDir = execSync('git rev-parse --git-dir', {
    cwd,
    encoding: 'utf8'
  }).trim();
  
  let mainGitRepo: string;
  
  if (gitDir.includes('worktrees')) {
    // We're in a worktree - extract main repo path from git dir
    // gitDir format: /main/repo/.git/worktrees/worktree-name
    const mainGitDirPath = gitDir.split('/worktrees/')[0]; // /main/repo/.git
    mainGitRepo = path.dirname(mainGitDirPath); // /main/repo
  } else {
    // We're in main repo - use show-toplevel
    mainGitRepo = execSync('git rev-parse --show-toplevel', {
      cwd,
      encoding: 'utf8'
    }).trim();
  }
  
  // Get main workspace info - config might be in top level or git root
  let mainConfigPath = topLevelPath;
  if (!fs.existsSync(path.join(topLevelPath, '.aisanity'))) {
    mainConfigPath = mainGitRepo;
  }
  
  const mainConfig = loadAisanityConfig(mainConfigPath);
  if (!mainConfig) {
    throw new Error('No .aisanity config found in main workspace');
  }
  
  const mainWorkspaceName = getWorkspaceName(mainConfigPath);
  const mainBranch = getCurrentBranch(mainGitRepo);
  
  // Main workspace is active only if we're in the main repo AND not in a worktree
  const isInWorktreeDir = isWorktree(cwd);
  const isInMainRepo = cwd === mainGitRepo || cwd.startsWith(mainGitRepo);
  
  const mainWorktree: WorktreeInfo = {
    path: mainGitRepo,
    branch: mainBranch,
    containerName: generateWorktreeContainerName(mainWorkspaceName, mainBranch),
    isActive: isInMainRepo && !isInWorktreeDir,
    configPath: path.join(mainConfigPath, '.aisanity')
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
            isActive: cwd === worktreePath || cwd.startsWith(worktreePath + path.sep),
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
export function getWorktreeByName(worktreeName: string, topLevelPath: string): WorktreeInfo | null {
  const worktreePath = path.join(topLevelPath, 'worktrees', worktreeName);

  if (!fs.existsSync(worktreePath)) {
    return null;
  }

  try {
    // Get git root to find config
    const gitRoot = execSync('git rev-parse --show-toplevel', {
      cwd: worktreePath,
      encoding: 'utf8'
    }).trim();

    // Config might be in top level or git root
    let mainConfigPath = topLevelPath;
    if (!fs.existsSync(path.join(topLevelPath, '.aisanity'))) {
      mainConfigPath = gitRoot;
    }

    const mainConfig = loadAisanityConfig(mainConfigPath);
    if (!mainConfig) {
      return null;
    }

    const mainWorkspaceName = getWorkspaceName(mainConfigPath);
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

/**
 * Detect orphaned containers from manually deleted worktrees
 */
export async function detectOrphanedContainers(verbose: boolean = false): Promise<{
  orphaned: DockerContainer[];
  worktreePaths: string[];
}> {
  try {
    const discoveryResult = await discoverContainers(verbose);
    const worktrees = getAllWorktrees(process.cwd());
    const existingWorktreePaths = new Set([
      worktrees.main.path,
      ...worktrees.worktrees.map(wt => wt.path)
    ]);

    const orphaned = discoveryResult.containers.filter(container => {
      const workspacePath = container.labels['aisanity.workspace'];
      return workspacePath && !existingWorktreePaths.has(workspacePath);
    });

    return {
      orphaned,
      worktreePaths: Array.from(existingWorktreePaths)
    };
  } catch (error) {
    if (verbose) {
      console.warn('Failed to detect orphaned containers:', error);
    }
    return {
      orphaned: [],
      worktreePaths: []
    };
  }
}

/**
 * Check if .devcontainer should be copied to worktree
 * Returns true if .devcontainer exists locally but is not tracked in git
 */
export function shouldCopyDevContainer(workspacePath: string): boolean {
  const devcontainerPath = path.join(workspacePath, '.devcontainer');
  if (!fs.existsSync(devcontainerPath)) {
    return false;
  }

  try {
    // Check if tracked in git
    execSync('git ls-files --error-unmatch .devcontainer', {
      cwd: workspacePath,
      stdio: 'pipe'
    });
    // If succeeds, it's tracked, don't copy
    return false;
  } catch (error) {
    // If fails, not tracked, should copy
    return true;
  }
}

/**
 * Copy .devcontainer directory from source workspace to worktree
 */
export function copyDevContainerToWorktree(sourcePath: string, worktreePath: string): void {
  const sourceDevcontainer = path.join(sourcePath, '.devcontainer');
  const destDevcontainer = path.join(worktreePath, '.devcontainer');

  if (!fs.existsSync(sourceDevcontainer)) {
    throw new Error('Source .devcontainer directory does not exist');
  }

  if (fs.existsSync(destDevcontainer)) {
    throw new Error('Destination .devcontainer directory already exists');
  }

  fs.cpSync(sourceDevcontainer, destDevcontainer, { recursive: true });
}

/**
 * Clean up orphaned containers
 */
export async function cleanupOrphanedContainers(verbose: boolean = false): Promise<number> {
  try {
    const { orphaned } = await detectOrphanedContainers(verbose);

    if (orphaned.length === 0) {
      if (verbose) {
        console.log('No orphaned containers found');
      }
      return 0;
    }

    console.log(`Found ${orphaned.length} orphaned containers:`);
    orphaned.forEach(container => {
      console.log(`  ${container.name} (${container.id})`);
    });

    // Stop and remove orphaned containers
    const containerIds = orphaned.map(c => c.id);

    // Import here to avoid circular dependency
    const { stopContainers, removeContainers } = await import('./container-utils');

    await stopContainers(containerIds, verbose);
    await removeContainers(containerIds, verbose);

    console.log(`Cleaned up ${orphaned.length} orphaned containers`);
    return orphaned.length;
  } catch (error) {
    console.error('Failed to cleanup orphaned containers:', error);
    return 0;
  }
}