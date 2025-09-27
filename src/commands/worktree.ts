import { Command } from 'commander';
import { worktreeCreateCommand } from './worktree-create';
import { worktreeListCommand } from './worktree-list';
import { worktreeRemoveCommand } from './worktree-remove';
import { worktreeCheckCommand } from './worktree-check';

export const worktreeCommand = new Command('worktree')
  .description('Manage git worktrees for parallel development')
  .addCommand(worktreeCreateCommand)
  .addCommand(worktreeListCommand)
  .addCommand(worktreeRemoveCommand)
  .addCommand(worktreeCheckCommand);