#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init';
import { runCommand } from './commands/run';
import { stopCommand } from './commands/stop';
import { statusCommand } from './commands/status';

const program = new Command();

program
  .name('aisanity')
  .description('Devcontainer wrapper for sandboxed development environments')
  .version('0.1.0');

// Register commands
program.addCommand(initCommand);
program.addCommand(runCommand);
program.addCommand(stopCommand);
program.addCommand(statusCommand);

// Parse command line arguments
program.parse();