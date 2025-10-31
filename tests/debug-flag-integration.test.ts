import { describe, it, expect } from 'bun:test';

describe('Debug flag integration across commands', () => {
  describe('Command debug flag presence', () => {
    it('should have debug flag in status command', async () => {
      const { statusCommand } = await import('../src/commands/status');
      
      const debugOption = statusCommand.options.find(opt => opt.flags === '-d, --debug');
      expect(debugOption).toBeDefined();
      expect(debugOption?.description).toBeDefined();
      expect(debugOption?.description).toContain('system debugging');
    });

    it('should have debug flag in stop command', async () => {
      const { stopCommand } = await import('../src/commands/stop');
      
      const debugOption = stopCommand.options.find(opt => opt.flags === '-d, --debug');
      expect(debugOption).toBeDefined();
      expect(debugOption?.description).toBeDefined();
      expect(debugOption?.description).toContain('system debugging');
    });

    it('should have debug flag in discover-opencode command', async () => {
      const { discoverOpencodeCommand } = await import('../src/commands/discover-opencode');
      
      const debugOption = discoverOpencodeCommand.options.find(opt => opt.flags === '-d, --debug');
      expect(debugOption).toBeDefined();
      expect(debugOption?.description).toBeDefined();
      expect(debugOption?.description).toContain('system debugging');
    });

    it('should have debug flag in cleanup command', async () => {
      const { cleanupCommand } = await import('../src/commands/cleanup');
      
      const debugOption = cleanupCommand.options.find(opt => opt.flags === '-d, --debug');
      expect(debugOption).toBeDefined();
      expect(debugOption?.description).toBeDefined();
      expect(debugOption?.description).toContain('system debugging');
    });

    it('should have debug flag in stats command', async () => {
      const { statsCommand } = await import('../src/commands/stats');
      
      const debugOption = statsCommand.options.find(opt => opt.flags === '-d, --debug');
      expect(debugOption).toBeDefined();
      expect(debugOption?.description).toBeDefined();
      expect(debugOption?.description).toContain('system debugging');
    });

    it('should have debug flag in run command', async () => {
      const { runCommand } = await import('../src/commands/run');
      
      const debugOption = runCommand.options.find(opt => opt.flags === '-d, --debug');
      expect(debugOption).toBeDefined();
      expect(debugOption?.description).toBeDefined();
      expect(debugOption?.description).toContain('system debugging');
    });

    it('should have debug flag in start-and-attach command', async () => {
      const { startAndAttachCommand } = await import('../src/commands/start-and-attach');
      
      const debugOption = startAndAttachCommand.options.find(opt => opt.flags === '-d, --debug');
      expect(debugOption).toBeDefined();
      expect(debugOption?.description).toBeDefined();
      expect(debugOption?.description).toContain('system debugging');
    });

    it('should have debug flag in rebuild command', async () => {
      const { rebuildCommand } = await import('../src/commands/rebuild');
      
      const debugOption = rebuildCommand.options.find(opt => opt.flags === '-d, --debug');
      expect(debugOption).toBeDefined();
      expect(debugOption?.description).toBeDefined();
    });

    it('should have debug flag in worktree-check command', async () => {
      const { worktreeCheckCommand } = await import('../src/commands/worktree-check');
      
      const debugOption = worktreeCheckCommand.options.find(opt => opt.flags === '-d, --debug');
      expect(debugOption).toBeDefined();
      expect(debugOption?.description).toBeDefined();
    });

    it('should have debug flag in worktree-create command', async () => {
      const { worktreeCreateCommand } = await import('../src/commands/worktree-create');
      
      const debugOption = worktreeCreateCommand.options.find(opt => opt.flags === '-d, --debug');
      expect(debugOption).toBeDefined();
      expect(debugOption?.description).toBeDefined();
    });

    it('should have debug flag in worktree-list command', async () => {
      const { worktreeListCommand } = await import('../src/commands/worktree-list');
      
      const debugOption = worktreeListCommand.options.find(opt => opt.flags === '-d, --debug');
      expect(debugOption).toBeDefined();
      expect(debugOption?.description).toBeDefined();
    });

    it('should have debug flag in worktree-remove command', async () => {
      const { worktreeRemoveCommand } = await import('../src/commands/worktree-remove');
      
      const debugOption = worktreeRemoveCommand.options.find(opt => opt.flags === '-d, --debug');
      expect(debugOption).toBeDefined();
      expect(debugOption?.description).toBeDefined();
    });
  });

  describe('Command verbose flag descriptions', () => {
    it('should have user-focused verbose flag descriptions', async () => {
      const commands = [
        { name: 'status', module: '../src/commands/status', export: 'statusCommand' },
        { name: 'stop', module: '../src/commands/stop', export: 'stopCommand' },
        { name: 'rebuild', module: '../src/commands/rebuild', export: 'rebuildCommand' },
        { name: 'worktree-check', module: '../src/commands/worktree-check', export: 'worktreeCheckCommand' },
        { name: 'worktree-create', module: '../src/commands/worktree-create', export: 'worktreeCreateCommand' },
        { name: 'worktree-list', module: '../src/commands/worktree-list', export: 'worktreeListCommand' },
        { name: 'worktree-remove', module: '../src/commands/worktree-remove', export: 'worktreeRemoveCommand' }
      ];

      for (const cmd of commands) {
        const module = await import(cmd.module);
        const command = module[cmd.export];
        
        const verboseOption = command.options.find((opt: any) => opt.flags === '-v, --verbose');
        expect(verboseOption).toBeDefined();
        expect(verboseOption?.description).toBeDefined();
        
        // Verbose descriptions should NOT say "Enable verbose logging" - they should be descriptive
        expect(verboseOption?.description).not.toBe('Enable verbose logging');
        expect(verboseOption?.description.length).toBeGreaterThan(10);
      }
    });
  });

  describe('Logger integration', () => {
    it('should create logger with debug mode from options', () => {
      const { createLogger } = require('../src/utils/logger');
      
      // Test debug-only mode
      const debugLogger = createLogger({ debug: true, verbose: false });
      expect(debugLogger).toBeDefined();
      
      // Test verbose-only mode
      const verboseLogger = createLogger({ debug: false, verbose: true });
      expect(verboseLogger).toBeDefined();
      
      // Test combined mode
      const combinedLogger = createLogger({ debug: true, verbose: true });
      expect(combinedLogger).toBeDefined();
      
      // Test default mode
      const defaultLogger = createLogger({});
      expect(defaultLogger).toBeDefined();
    });

    it('should separate verbose and debug output', () => {
      const { Logger } = require('../src/utils/logger');
      
      let logOutput: string[] = [];
      const originalLog = console.log;
      console.log = (...args: any[]) => {
        logOutput.push(args.join(' '));
      };
      
      try {
        // Verbose-only logger
        logOutput = [];
        const verboseLogger = new Logger(false, true, false);
        verboseLogger.verbose('User-facing info');
        verboseLogger.debug('System internal');
        
        expect(logOutput).toContain('User-facing info');
        expect(logOutput).not.toContain('System internal');
        
        // Debug-only logger
        logOutput = [];
        const debugLogger = new Logger(false, false, true);
        debugLogger.verbose('User-facing info');
        debugLogger.debug('System internal');
        
        expect(logOutput).not.toContain('User-facing info');
        expect(logOutput).toContain('System internal');
        
        // Combined logger
        logOutput = [];
        const combinedLogger = new Logger(false, true, true);
        combinedLogger.verbose('User-facing info');
        combinedLogger.debug('System internal');
        
        expect(logOutput).toContain('User-facing info');
        expect(logOutput).toContain('System internal');
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe('Flag consistency', () => {
    it('should have consistent debug flag descriptions across discovery commands', async () => {
      const discoveryCommands = [
        { module: '../src/commands/status', export: 'statusCommand' },
        { module: '../src/commands/stop', export: 'stopCommand' },
        { module: '../src/commands/discover-opencode', export: 'discoverOpencodeCommand' },
        { module: '../src/commands/cleanup', export: 'cleanupCommand' },
        { module: '../src/commands/stats', export: 'statsCommand' }
      ];

      for (const cmd of discoveryCommands) {
        const module = await import(cmd.module);
        const command = module[cmd.export];
        
        const debugOption = command.options.find((opt: any) => opt.flags === '-d, --debug');
        expect(debugOption).toBeDefined();
        
        // All discovery commands should mention debugging system internals
        const description = debugOption?.description.toLowerCase();
        expect(
          description.includes('system') || 
          description.includes('debugging') || 
          description.includes('discovery')
        ).toBe(true);
      }
    });

    it('should have both verbose and debug flags in all major commands', async () => {
      const majorCommands = [
        { module: '../src/commands/status', export: 'statusCommand' },
        { module: '../src/commands/stop', export: 'stopCommand' },
        { module: '../src/commands/rebuild', export: 'rebuildCommand' },
        { module: '../src/commands/worktree-create', export: 'worktreeCreateCommand' },
        { module: '../src/commands/worktree-list', export: 'worktreeListCommand' },
        { module: '../src/commands/worktree-remove', export: 'worktreeRemoveCommand' }
      ];

      for (const cmd of majorCommands) {
        const module = await import(cmd.module);
        const command = module[cmd.export];
        
        const verboseOption = command.options.find((opt: any) => opt.flags === '-v, --verbose');
        const debugOption = command.options.find((opt: any) => opt.flags === '-d, --debug');
        
        expect(verboseOption).toBeDefined();
        expect(debugOption).toBeDefined();
      }
    });
  });
});
