/**
 * Tests for OutputBuffer component
 */

import { OutputBuffer } from '../../src/workflow/output-buffer';
import { Logger } from '../../src/utils/logger';

describe('OutputBuffer', () => {
  it('should buffer stream data', async () => {
    const buffer = new OutputBuffer();
    
    buffer.write('line 1\n');
    buffer.write('line 2\n');
    buffer.end();
    
    expect(buffer.getContent()).toBe('line 1\nline 2\n');
  });

  it('should enforce size limits', async () => {
    const buffer = new OutputBuffer(100); // 100 bytes
    
    buffer.write('x'.repeat(50));
    buffer.write('y'.repeat(60)); // Exceeds limit
    buffer.end();
    
    const content = buffer.getContent();
    expect(content.length).toBeLessThanOrEqual(100);
    expect(buffer.isTruncated()).toBe(true);
  });

  it('should stream to logger', async () => {
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn()
    } as any;
    
    const buffer = new OutputBuffer();
    buffer.pipeToLogger(mockLogger, 'stdout');
    
    buffer.write('test output\n');
    buffer.end();
    
    expect(mockLogger.info).toHaveBeenCalledWith('test output');
  });

  it('should stream errors to logger', async () => {
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn()
    } as any;
    
    const buffer = new OutputBuffer();
    buffer.pipeToLogger(mockLogger, 'stderr');
    
    buffer.write('error output\n');
    buffer.end();
    
    expect(mockLogger.error).toHaveBeenCalledWith('error output');
  });

  it('should handle large outputs efficiently', async () => {
    const buffer = new OutputBuffer(10 * 1024 * 1024); // 10MB
    
    const largeData = 'x'.repeat(1024 * 1024); // 1MB chunks
    
    for (let i = 0; i < 5; i++) {
      buffer.write(largeData);
    }
    buffer.end();
    
    expect(buffer.getSize()).toBeLessThanOrEqual(10 * 1024 * 1024);
  });

  it('should clear buffer', async () => {
    const buffer = new OutputBuffer();
    
    buffer.write('test data');
    expect(buffer.getContent()).toBe('test data');
    
    buffer.clear();
    expect(buffer.getContent()).toBe('');
    expect(buffer.getSize()).toBe(0);
    expect(buffer.isTruncated()).toBe(false);
  });

  it('should handle different encodings', async () => {
    const buffer = new OutputBuffer(1024, 'utf8');
    
    buffer.write('test with unicode: ñáéíóú');
    buffer.end();
    
    expect(buffer.getContent()).toContain('ñáéíóú');
  });

  it('should handle empty buffer', async () => {
    const buffer = new OutputBuffer();
    buffer.end();
    
    expect(buffer.getContent()).toBe('');
    expect(buffer.getSize()).toBe(0);
    expect(buffer.isTruncated()).toBe(false);
  });

  it('should handle single chunk larger than limit', async () => {
    const buffer = new OutputBuffer(50); // 50 bytes
    
    buffer.write('x'.repeat(100)); // Single chunk exceeds limit
    buffer.end();
    
    expect(buffer.getSize()).toBeLessThanOrEqual(50);
    expect(buffer.isTruncated()).toBe(true);
  });

  it('should add truncation warning', async () => {
    const buffer = new OutputBuffer(50);
    
    buffer.write('x'.repeat(100));
    buffer.end();
    
    const content = buffer.getContent();
    expect(content).toContain('[Output truncated due to size limit]');
  });
});