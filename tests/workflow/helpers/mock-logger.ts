/**
 * Mock logger for testing
 * Captures all log messages for assertion
 */

export class MockLogger {
  public infoMessages: string[] = [];
  public errorMessages: string[] = [];
  public debugMessages: string[] = [];
  public warnMessages: string[] = [];

  info(message: string): void {
    this.infoMessages.push(message);
  }

  error(message: string): void {
    this.errorMessages.push(message);
  }

  debug(message: string): void {
    this.debugMessages.push(message);
  }

  warn(message: string): void {
    this.warnMessages.push(message);
  }

  clear(): void {
    this.infoMessages = [];
    this.errorMessages = [];
    this.debugMessages = [];
    this.warnMessages = [];
  }

  // Helper methods for testing
  hasInfoMessage(message: string): boolean {
    return this.infoMessages.some(msg => msg.includes(message));
  }

  hasErrorMessage(message: string): boolean {
    return this.errorMessages.some(msg => msg.includes(message));
  }

  hasDebugMessage(message: string): boolean {
    return this.debugMessages.some(msg => msg.includes(message));
  }

  hasWarnMessage(message: string): boolean {
    return this.warnMessages.some(msg => msg.includes(message));
  }

  getMessageCount(): number {
    return this.infoMessages.length + 
           this.errorMessages.length + 
           this.debugMessages.length + 
           this.warnMessages.length;
  }
}