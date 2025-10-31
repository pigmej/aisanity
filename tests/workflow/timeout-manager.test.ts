/**
 * Unit tests for TimeoutManager
 */

import { TimeoutManager } from '../../src/workflow/timeout-manager';

describe('TimeoutManager', () => {
  let manager: TimeoutManager;

  beforeEach(() => {
    manager = new TimeoutManager();
  });

  afterEach(() => {
    manager.cancel();
  });

  describe('timeout lifecycle', () => {
    it('should start timeout', () => {
      const controller = manager.startTimeout(5000);
      
      expect(controller).toBeInstanceOf(AbortController);
      expect(controller.signal.aborted).toBe(false);
    });

    it('should abort after timeout', async () => {
      const controller = manager.startTimeout(100);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(controller.signal.aborted).toBe(true);
    });

    it('should cancel timeout', () => {
      const controller = manager.startTimeout(5000);
      
      manager.cancel();
      
      expect(controller.signal.aborted).toBe(true);
    });

    it('should handle multiple cancellations', () => {
      manager.startTimeout(5000);
      manager.cancel();
      manager.cancel(); // Should not throw
      
      expect(manager['abortController']).toBeUndefined();
    });

    it('should handle zero timeout', () => {
      const controller = manager.startTimeout(0);
      
      // Should not set timeout ID for zero timeout
      expect(manager['timeoutId']).toBeUndefined();
      expect(controller.signal.aborted).toBe(false);
    });
  });

  describe('parent timeout coordination', () => {
    it('should respect parent signal', () => {
      const parentController = new AbortController();
      const childController = manager.startTimeout(5000, parentController.signal);
      
      parentController.abort();
      
      expect(childController.signal.aborted).toBe(true);
    });

    it('should handle already aborted parent', () => {
      const parentController = new AbortController();
      parentController.abort();
      
      const childController = manager.startTimeout(5000, parentController.signal);
      
      expect(childController.signal.aborted).toBe(true);
    });

    it('should not abort child when parent is not aborted', () => {
      const parentController = new AbortController();
      const childController = manager.startTimeout(5000, parentController.signal);
      
      expect(childController.signal.aborted).toBe(false);
      expect(parentController.signal.aborted).toBe(false);
    });
  });

  describe('time tracking', () => {
    it('should track remaining time', async () => {
      manager.startTimeout(5000);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const remaining = manager.getRemainingTime();
      expect(remaining).toBeLessThan(5000);
      expect(remaining).toBeGreaterThan(3500);
    });

    it('should return 0 when expired', async () => {
      manager.startTimeout(100);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(manager.getRemainingTime()).toBe(0);
      expect(manager.isExpired()).toBe(true);
    });

    it('should track elapsed time', async () => {
      manager.startTimeout(5000);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const elapsed = manager.getElapsedTime();
      expect(elapsed).toBeGreaterThanOrEqual(500);
    });

    it('should calculate progress percentage', async () => {
      manager.startTimeout(1000);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const progress = manager.getProgressPercentage();
      expect(progress).toBeGreaterThan(40);
      expect(progress).toBeLessThan(60);
    });

    it('should cap progress at 100%', async () => {
      manager.startTimeout(100);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const progress = manager.getProgressPercentage();
      expect(progress).toBe(100);
    });

    it('should return 0 progress when not started', () => {
      const progress = manager.getProgressPercentage();
      expect(progress).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle very short timeouts', async () => {
      const controller = manager.startTimeout(1);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(controller.signal.aborted).toBe(true);
    });

    it('should handle very long timeouts', () => {
      const controller = manager.startTimeout(365 * 24 * 60 * 60 * 1000); // 1 year
      
      expect(controller.signal.aborted).toBe(false);
      expect(manager.getRemainingTime()).toBeGreaterThan(0);
    });

    it('should handle negative timeouts', () => {
      const controller = manager.startTimeout(-1000);
      
      expect(controller.signal.aborted).toBe(false);
    });

    it('should return 0 for remaining time when not started', () => {
      const remaining = manager.getRemainingTime();
      expect(remaining).toBe(0);
    });

    it('should return 0 for elapsed time when not started', () => {
      const elapsed = manager.getElapsedTime();
      expect(elapsed).toBe(0);
    });

    it('should return false for isExpired when not started', () => {
      const expired = manager.isExpired();
      expect(expired).toBe(false);
    });
  });

  describe('resource cleanup', () => {
    it('should clean up timeout ID on cancel', () => {
      manager.startTimeout(5000);
      const timeoutId = manager['timeoutId'];
      
      expect(timeoutId).toBeDefined();
      
      manager.cancel();
      
      expect(manager['timeoutId']).toBeUndefined();
    });

    it('should clean up abort controller on cancel', () => {
      manager.startTimeout(5000);
      const controller = manager['abortController'];
      
      expect(controller).toBeDefined();
      
      manager.cancel();
      
      expect(manager['abortController']).toBeUndefined();
    });

    it('should clean up start time on cancel', () => {
      manager.startTimeout(5000);
      const startTime = manager['startTime'];
      
      expect(startTime).toBeDefined();
      
      manager.cancel();
      
      expect(manager['startTime']).toBeUndefined();
    });

    it('should clean up timeout duration on cancel', () => {
      manager.startTimeout(5000);
      const timeoutMs = manager['timeoutMs'];
      
      expect(timeoutMs).toBeDefined();
      
      manager.cancel();
      
      expect(manager['timeoutMs']).toBeUndefined();
    });
  });
});