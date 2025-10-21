/**
 * OutputBuffer - Efficient stream management for process output
 * Provides buffered capture with size limits and logger integration
 */

import { Transform, TransformCallback } from 'node:stream';
import { Logger } from '../utils/logger';

/**
 * Transform stream that buffers process output while enforcing size limits
 * and optionally streaming to a logger for real-time output
 */
export class OutputBuffer extends Transform {
  private chunks: Buffer[] = [];
  private currentSize = 0;
  private maxSize: number;
  private encoding: BufferEncoding;
  private logger?: Logger;
  private streamType?: 'stdout' | 'stderr';
  private truncated = false;

  /**
   * Create a new output buffer
   * @param maxSize Maximum buffer size in bytes (default: 10MB)
   * @param encoding Text encoding for output (default: utf8)
   */
  constructor(
    maxSize = 10 * 1024 * 1024, // 10MB default
    encoding: BufferEncoding = 'utf8'
  ) {
    super();
    this.maxSize = maxSize;
    this.encoding = encoding;
  }

  /**
   * Transform stream implementation - handles incoming chunks
   */
  _transform(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    // Handle single chunks larger than limit
    if (chunk.length > this.maxSize) {
      this.truncated = true;
      
      // Truncate the chunk to fit within limit
      const truncatedChunk = chunk.subarray(0, this.maxSize);
      this.chunks = [truncatedChunk];
      this.currentSize = this.maxSize;
      
      // Pass through truncated chunk
      this.push(truncatedChunk);
      
      // Stream to logger if configured
      if (this.logger && this.streamType) {
        const text = truncatedChunk.toString(this.encoding);
        if (this.streamType === 'stdout') {
          this.logger.info(text.trim());
        } else {
          this.logger.error(text.trim());
        }
      }
      
      callback();
      return;
    }
    
    // Check if adding this chunk would exceed limit
    if (this.currentSize + chunk.length > this.maxSize) {
      this.truncated = true;
      
      // Keep newest content, drop oldest
      const spaceNeeded = chunk.length;
      while (this.chunks.length > 0 && this.currentSize + spaceNeeded > this.maxSize) {
        const removed = this.chunks.shift();
        if (removed) {
          this.currentSize -= removed.length;
        }
      }
    }
    
    // Add new chunk
    this.chunks.push(chunk);
    this.currentSize += chunk.length;
    
    // Pass through for real-time processing
    this.push(chunk);
    
    // Stream to logger if configured
    if (this.logger && this.streamType) {
      const text = chunk.toString(this.encoding);
      if (this.streamType === 'stdout') {
        this.logger.info(text.trim());
      } else {
        this.logger.error(text.trim());
      }
    }
    
    callback();
  }

  /**
   * Flush implementation - called when stream ends
   */
  _flush(callback: TransformCallback): void {
    if (this.truncated) {
      const warning = Buffer.from(
        '\n[Output truncated due to size limit]\n',
        this.encoding
      );
      // Add warning to chunks for getContent() but don't count towards size limit
      this.chunks.push(warning);
      this.push(warning);
    }
    callback();
  }

  /**
   * Get the complete buffered content as a string
   * @returns All buffered content concatenated as a single string
   */
  getContent(): string {
    return Buffer.concat(this.chunks).toString(this.encoding);
  }

  /**
   * Get current buffer size in bytes
   * @returns Current size of buffered content in bytes
   */
  getSize(): number {
    return this.currentSize;
  }

  /**
   * Clear all buffered content
   * Resets the buffer to empty state
   */
  clear(): void {
    this.chunks = [];
    this.currentSize = 0;
    this.truncated = false;
  }

  /**
   * Check if output was truncated due to size limit
   */
  isTruncated(): boolean {
    return this.truncated;
  }

  /**
   * Enable real-time logging of stream output
   * @param logger Logger instance to stream to
   * @param streamType Type of stream for proper logging level
   */
  pipeToLogger(logger: Logger, streamType: 'stdout' | 'stderr'): void {
    this.logger = logger;
    this.streamType = streamType;
  }
}