/**
 * Unit tests for ConfirmationHandler
 */

import { ConfirmationHandler, ConfirmationOptions, ConfirmationResult } from '../../src/workflow/confirmation-handler';
import { CommandExecutor } from '../../src/workflow/executor';
import { Logger } from '../../src/utils/logger';

describe('ConfirmationHandler', () => {
  let mockExecutor: jest.Mocked<CommandExecutor>;
  let mockLogger: jest.Mocked<Logger>;
  let handler: ConfirmationHandler;

  beforeEach(() => {
    mockExecutor = {
      executeCommand: jest.fn(),
      executeTUICommand: jest.fn(),
      executeConfirmation: jest.fn(),
      executeSelection: jest.fn(),
      cleanup: jest.fn(),
      getActiveProcessCount: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any;

    handler = new ConfirmationHandler(mockExecutor, mockLogger);
  });

  describe('requestConfirmation', () => {
    it('should request confirmation successfully', async () => {
      // Mock user accepting confirmation
      mockExecutor.executeCommand.mockResolvedValue({
        exitCode: 0,
        stdout: '',
        stderr: '',
        duration: 100
      });

      const result = await handler.requestConfirmation('Continue?');

      expect(result.confirmed).toBe(true);
      expect(result.method).toBe('user');
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(mockExecutor.executeCommand).toHaveBeenCalledWith(
        'bash',
        ['-c', expect.stringContaining('Continue?')],
        { timeout: 30000 }
      );
    });

    it('should handle user declining confirmation', async () => {
      // Mock user declining (exit code 1)
      mockExecutor.executeCommand.mockResolvedValue({
        exitCode: 1,
        stdout: '',
        stderr: '',
        duration: 50
      });

      const result = await handler.requestConfirmation('Delete?');

      expect(result.confirmed).toBe(false);
      expect(result.method).toBe('user');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Confirmation declined')
      );
    });

    it('should auto-confirm with --yes flag', async () => {
      const result = await handler.requestConfirmation('Deploy?', {
        yesFlag: true
      });

      expect(result.confirmed).toBe(true);
      expect(result.method).toBe('override');
      expect(result.duration).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith('Auto-confirmed: Deploy?');
      
      // Executor should not be called
      expect(mockExecutor.executeCommand).not.toHaveBeenCalled();
    });

    it('should handle timeout with default response', async () => {
      // Mock timeout error
      const timeoutError = new Error('Command timed out');
      (timeoutError as any).code = 'TIMEOUT';
      mockExecutor.executeCommand.mockRejectedValue(timeoutError);

      const result = await handler.requestConfirmation('Approve?', {
        timeout: 1000,
        defaultResponse: false
      });

      expect(result.confirmed).toBe(false);
      expect(result.method).toBe('timeout');
      expect(result.timedOut).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith('Confirmation error: Command timed out');
    });

    it('should respect defaultResponse on timeout', async () => {
      mockExecutor.executeCommand.mockRejectedValue({
        code: 'TIMEOUT',
        message: 'Command timed out'
      });

      const resultAccept = await handler.requestConfirmation('Test?', {
        timeout: 1000,
        defaultResponse: true  // Default to yes
      });

      expect(resultAccept.confirmed).toBe(true);
      expect(resultAccept.method).toBe('timeout');
    });

    it('should validate timeout ranges', async () => {
      const handlerWithLimits = new ConfirmationHandler(
        mockExecutor,
        mockLogger,
        { minTimeout: 5000, maxTimeout: 60000 }
      );

      // Too short
      await handlerWithLimits.requestConfirmation('Test?', { timeout: 100 });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('too short')
      );

      // Too long
      await handlerWithLimits.requestConfirmation('Test?', { timeout: 600000 });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('too long')
      );
    });

    it('should handle other errors gracefully', async () => {
      mockExecutor.executeCommand.mockRejectedValue(new Error('Spawn failed'));

      const result = await handler.requestConfirmation('Test?');

      expect(result.confirmed).toBe(false);
      expect(result.method).toBe('error');
      expect(result.error).toBeInstanceOf(Error);
      expect(mockLogger.warn).toHaveBeenCalledWith('Confirmation error: Spawn failed');
    });
  });

  describe('confirmWithTimeout', () => {
    it('should work with explicit timeout', async () => {
      mockExecutor.executeCommand.mockResolvedValue({
        exitCode: 0,
        stdout: '',
        stderr: '',
        duration: 200
      });

      const confirmed = await handler.confirmWithTimeout(
        'Continue?',
        45000,  // 45 seconds
        { defaultResponse: false }
      );

      expect(confirmed).toBe(true);
      expect(mockExecutor.executeCommand).toHaveBeenCalledWith(
        'bash',
        ['-c', expect.stringContaining('Continue?')],
        { timeout: 45000 }
      );
    });
  });

  describe('confirmWithOverride', () => {
    it('should work with --yes flag', async () => {
      const confirmed = await handler.confirmWithOverride(
        'Deploy to staging?',
        true  // --yes flag
      );

      expect(confirmed).toBe(true);
      expect(mockExecutor.executeCommand).not.toHaveBeenCalled();
    });

    it('should prompt when --yes flag is false', async () => {
      mockExecutor.executeCommand.mockResolvedValue({
        exitCode: 1,
        stdout: '',
        stderr: '',
        duration: 100
      });

      const confirmed = await handler.confirmWithOverride(
        'Deploy to staging?',
        false,
        30000
      );

      expect(confirmed).toBe(false);
      expect(mockExecutor.executeCommand).toHaveBeenCalled();
    });
  });

  describe('configuration', () => {
    it('should use custom configuration', () => {
      const customHandler = new ConfirmationHandler(
        mockExecutor,
        mockLogger,
        {
          defaultTimeout: 60000,      // 1 minute
          minTimeout: 5000,           // 5 seconds
          maxTimeout: 300000,         // 5 minutes
          enableProgressIndicator: false
        }
      );

      // Configuration is applied internally
      expect(customHandler).toBeDefined();
    });
  });
});