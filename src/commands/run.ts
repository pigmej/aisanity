import { Command } from 'commander';
import * as path from 'path';
import { $ } from 'bun';
import { loadAisanityConfig, getContainerName, getCurrentBranch } from '../utils/config';
import { generateContainerLabels, validateContainerLabels, ContainerLabels } from '../utils/container-utils';
import { isWorktree, getMainGitDirPath } from '../utils/worktree-utils';
import { Logger } from '../utils/logger';
import * as fs from 'fs';

export const runCommand = new Command('run')
  .description('Run interactive container work using devcontainer exec')
  .argument('[command...]', 'Command to run in container (defaults to shell)')
  .option('--devcontainer-json <path>', 'Path to devcontainer.json file')
  .option('--force-recreate', 'Force recreation of branch-specific devcontainer file')
  .option('--worktree <path>', 'Run command in specific worktree')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--silent, --quiet', 'Suppress aisanity output, show only tool output')
  .action(async (commandArgs: string[], options) => {
    // Initialize logger with silent taking precedence over verbose
    const logger = new Logger(
      options.silent || options.quiet || false,
      options.verbose && !options.silent && !options.quiet || false
    );
    
    let cwd = process.cwd();
    
    // Handle worktree option
    if (options.worktree) {
      const worktreePath = path.resolve(options.worktree);
      if (!fs.existsSync(worktreePath)) {
        console.error(`Worktree path does not exist: ${worktreePath}`);
        process.exit(1);
      }
      cwd = worktreePath;
      logger.info(`Running in worktree: ${worktreePath}`);
    }
    
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

      logger.info(`Starting container for workspace: ${workspaceName}`);
      logger.info(`Running command: ${command.join(' ')}`);

       // Check for existing container first
       const branch = getCurrentBranch(cwd);
       let containerLabels: Record<string, string> | ContainerLabels;
       let idLabels: string[];
       
       try {
         // Try to find existing container for this workspace and branch
         const existingResult = await $`docker ps -a --filter label=aisanity.workspace=${cwd} --filter label=aisanity.branch=${branch} --format {{.Labels}}`.text();
         
         if (existingResult.trim()) {
           // Parse existing container labels to reuse them
           const existingLabels: Record<string, string> = {};
           existingResult.trim().split(',').forEach((label: string) => {
             const [key, value] = label.split('=');
             if (key && value && key.startsWith('aisanity.')) {
               existingLabels[key] = value;
             }
           });
           
            if (existingLabels['aisanity.workspace'] && existingLabels['aisanity.branch'] && existingLabels['aisanity.container']) {
              logger.info('Found existing container, reusing labels');
              containerLabels = existingLabels;
             idLabels = Object.entries(containerLabels).map(([key, value]) => `${key}=${value}`);
            } else {
              // Generate new labels if existing ones are incomplete
              containerLabels = await generateContainerLabels(workspaceName, branch, containerName, cwd);
              idLabels = Object.entries(containerLabels).map(([key, value]) => `${key}=${value}`);
            }
          } else {
            // No existing container, generate new labels
            containerLabels = await generateContainerLabels(workspaceName, branch, containerName, cwd);
            idLabels = Object.entries(containerLabels).map(([key, value]) => `${key}=${value}`);
          }
        } catch (error) {
          // If Docker command fails, generate new labels
          containerLabels = await generateContainerLabels(workspaceName, branch, containerName, cwd);
          idLabels = Object.entries(containerLabels).map(([key, value]) => `${key}=${value}`);
        }

       // Validate that all required labels are present
       if (!validateContainerLabels(containerLabels)) {
         console.error('Failed to generate required container labels');
         process.exit(1);
       }
      
      // Determine which devcontainer.json to use
      let devcontainerPath: string;
      if (options.devcontainerJson) {
        devcontainerPath = path.resolve(options.devcontainerJson);
        logger.info(`Using specified devcontainer: ${devcontainerPath}`);
      } else {
        // Use default devcontainer.json
        const defaultPath = path.join(cwd, '.devcontainer', 'devcontainer.json');
        if (!fs.existsSync(defaultPath)) {
          console.error('No devcontainer.json found in .devcontainer/ directory.');
          process.exit(1);
        }
        devcontainerPath = defaultPath;
      }
      
       logger.info(`Starting devcontainer for branch '${branch}' with labels: ${idLabels.join(', ')}`);

         // Check if we're in a git worktree and add mount for main repo .git directory
        const additionalMounts: string[] = [];
        if (isWorktree(cwd)) {
          const mainGitDir = getMainGitDirPath(cwd);
          if (mainGitDir) {
            const mountSpec = `type=bind,source=${mainGitDir},target=${mainGitDir}`;
            additionalMounts.push(mountSpec);
            logger.info(`Detected git worktree, mounting main repo .git directory: ${mainGitDir}`);
          }
        }

         // First, ensure the dev container is up and running
         logger.info('Checking/starting dev container...');
         const upArgs = ['up', '--workspace-folder', cwd];

       if (devcontainerPath) {
         upArgs.push('--config', devcontainerPath);
       }

        // Add ID labels for consistent container identification
        idLabels.forEach(label => {
          upArgs.push('--id-label', label);
        });

        // Add mounts for git worktree support
        additionalMounts.forEach(mount => {
          upArgs.push('--mount', mount);
        });

      // Determine if silent mode is enabled
      const isSilent = options.silent || options.quiet || false;

      const upResult = Bun.spawn(['devcontainer', ...upArgs], {
        stdio: isSilent ? ['inherit', 'pipe', 'pipe'] : ['inherit', 'inherit', 'inherit'],
        cwd
      });

      const upExitCode = await upResult.exited;
      if (upExitCode !== 0) {
        throw new Error(`devcontainer up failed with code ${upExitCode}`);
      }

      logger.info('Dev container is ready');

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
      const child = Bun.spawn(['devcontainer', ...execArgs], {
        stdio: ['inherit', 'inherit', 'inherit'],
        cwd
      });

      // Wait for process to exit
      const exitCode = await child.exited;
      process.exit(exitCode || 0);

    } catch (error) {
      console.error('Failed to run container:', error);
      process.exit(1);
    }
  });