/**
 * ConfirmationBuilder - Generate safe bash commands for timed confirmation prompts
 * Handles shell argument escaping to prevent injection
 */

/**
 * Static utility class for building confirmation commands
 */
export class ConfirmationBuilder {
  /**
   * Generate bash command for timed confirmation prompt
   * @param message Confirmation message
   * @param timeoutMs Timeout in milliseconds
   * @param defaultValue Default choice on timeout or Enter
   * @returns Bash command string
   */
  static buildTimedConfirmation(
    message: string,
    timeoutMs: number,
    defaultValue: boolean = false
  ): string {
    // Validate prompt message first
    this.validatePromptMessage(message);
    
    // Use bash's built-in read -t for timeout instead of external timeout command
    // This avoids nested bash -c calls that break stdin
    const timeoutSeconds = Math.ceil(timeoutMs / 1000);
    const escapedMessage = this.escapePromptText(message);
    const defaultChar = defaultValue ? 'Y/n' : 'y/N';
    const defaultExit = defaultValue ? '0' : '1';
    
    // Use read -t for timeout, reading from /dev/tty for true interactive terminal support
    // This allows user input even when stdin is not properly forwarded
    return `if read -t ${timeoutSeconds} -p "${escapedMessage} [${defaultChar}]: " -n 1 answer < /dev/tty; then echo; [[ "$answer" =~ ^[Yy]$ ]] && exit 0 || [[ "$answer" =~ ^[Nn]$ ]] && exit 1 || exit ${defaultExit}; else echo; exit ${defaultExit}; fi`;
  }

  /**
   * Escape shell special characters in prompt text
   * @param text Raw prompt text
   * @returns Shell-escaped text
   */
  static escapePromptText(text: string): string {
    // Comprehensive shell escaping for confirmation messages
    return text
      .replace(/\\/g, '\\\\')    // Escape backslashes first
      .replace(/;/g, '\\;')      // Escape semicolons (command separators)
      .replace(/'/g, "'\"'\"'")  // Escape single quotes
      .replace(/"/g, '\\"')      // Escape double quotes
      .replace(/`/g, '\\`')      // Escape backticks (command substitution)
      .replace(/\$/g, '\\$')     // Escape dollar signs (variable expansion)
      .replace(/\n/g, '\\n')     // Escape newlines
      .replace(/\r/g, '\\r');    // Escape carriage returns
  }

  /**
   * Validate prompt message for security and length
   * @param message Prompt message to validate
   */
  private static validatePromptMessage(message: string): void {
    if (!message || message.trim().length === 0) {
      throw new Error('Confirmation message cannot be empty');
    }
    
    if (message.length > 500) {
      throw new Error('Confirmation message too long (max 500 characters)');
    }
    
    // Prevent control characters (except spaces and newlines handled by escaping)
    const controlChars = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/;
    if (controlChars.test(message)) {
      throw new Error('Confirmation message contains invalid control characters');
    }
  }
}