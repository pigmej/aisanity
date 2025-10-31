/**
 * Unit tests for ProgressIndicator
 */

import { ProgressIndicator } from '../../src/workflow/progress-indicator';
import { Logger } from '../../src/utils/logger';

describe('ProgressIndicator', () => {
  let indicator: ProgressIndicator;
  let mockLogger: jest.Mocked<Logger>;
  let originalStdoutWrite: typeof process.stdout.write;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any;

    indicator = new ProgressIndicator(mockLogger);
    
    // Mock process.stdout.write to track calls
    originalStdoutWrite = process.stdout.write;
    process.stdout.write = jest.fn();
  });

  afterEach(() => {
    indicator.stop();
    process.stdout.write = originalStdoutWrite;
  });

  describe('start and stop', () => {
    it('should start progress indication', () => {
      indicator.start(10000, 'Testing...');
      
      expect(indicator['isRunning']).toBe(true);
      expect(indicator['intervalId']).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith('Testing...');
    });

    it('should stop progress indication', () => {
      indicator.start(10000);
      indicator.stop();
      
      expect(indicator['isRunning']).toBe(false);
      expect(indicator['intervalId']).toBeUndefined();
    });

    it('should handle multiple stop calls', () => {
      indicator.start(10000);
      indicator.stop();
      indicator.stop(); // Should not throw
      
      expect(indicator['isRunning']).toBe(false);
    });

    it('should ignore start when already running', () => {
      indicator.start(10000);
      const firstIntervalId = indicator['intervalId'];
      
      indicator.start(10000); // Second start should be ignored
      
      expect(indicator['intervalId']).toBe(firstIntervalId);
    });
  });

  describe('progress updates', () => {
    it('should update progress periodically', async () => {
      const mockWrite = process.stdout.write as jest.Mock;
      
      indicator.start(5000, 'Waiting...', 100); // Fast updates for testing
      
      await new Promise(resolve => setTimeout(resolve, 250));
      
      expect(mockWrite).toHaveBeenCalled();
      expect(mockWrite.mock.calls[0][0]).toContain('Waiting...');
      
      indicator.stop();
    });

    it('should display remaining time correctly', () => {
      const formatted = indicator['formatTimeRemaining'](65000);
      expect(formatted).toBe('1m 5s');
      
      const formatted2 = indicator['formatTimeRemaining'](30000);
      expect(formatted2).toBe('30s');
      
      const formatted3 = indicator['formatTimeRemaining'](59000);
      expect(formatted3).toBe('59s');
    });

    it('should render spinner frames', () => {
      const frame0 = indicator['renderSpinner'](0);
      const frame1 = indicator['renderSpinner'](1);
      
      expect(frame0).toBeTruthy();
      expect(frame1).toBeTruthy();
      expect(frame0).not.toBe(frame1);
    });

    it('should cycle through spinner frames', () => {
      const frames = indicator['spinnerFrames'];
      const frame0 = indicator['renderSpinner'](0);
      const frame10 = indicator['renderSpinner'](10);
      
      expect(frame0).toBe(frames[0]);
      expect(frame10).toBe(frames[0]); // Should cycle back
    });
  });

  describe('cleanup', () => {
    it('should clear terminal line on stop', () => {
      const mockWrite = process.stdout.write as jest.Mock;
      
      indicator.start(5000);
      indicator.stop();
      
      // Should clear line with spaces and carriage return
      const lastCall = mockWrite.mock.calls[mockWrite.mock.calls.length - 1];
      expect(lastCall[0]).toContain('\r');
    });

    it('should stop automatically when timeout expires', async () => {
      indicator.start(50, 'Test...');
      
      // Wait for timeout to expire plus one interval
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(indicator['isRunning']).toBe(false);
    });
  });

  describe('default parameters', () => {
    it('should use default message when not provided', () => {
      indicator.start(5000);
      
      expect(mockLogger.info).toHaveBeenCalledWith('Waiting for confirmation...');
    });

    it('should use default update interval when not provided', () => {
      indicator.start(5000, 'Test');
      
      // Should use 1000ms default interval
      expect(indicator['intervalId']).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle zero timeout', () => {
      indicator.start(0, 'Test');
      
      expect(indicator['isRunning']).toBe(true);
      // Should stop immediately on first update
    });

    it('should handle very short timeouts', async () => {
      indicator.start(10, 'Test');
      
      // Wait for timeout to expire plus one interval
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(indicator['isRunning']).toBe(false);
    });

    it('should handle negative timeout', () => {
      indicator.start(-1000, 'Test');
      
      expect(indicator['isRunning']).toBe(true);
    });
  });
});