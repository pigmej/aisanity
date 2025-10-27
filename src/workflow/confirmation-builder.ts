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
    
    const basePrompt = this.buildBasePrompt(message, defaultValue);
    return this.wrapWithTimeout(basePrompt, timeoutMs, defaultValue);
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
   * Build base confirmation prompt (without timeout)
   * @param message Confirmation message
   * @param defaultValue Default value on Enter
   * @returns Bash command for confirmation prompt
   */
  private static buildBasePrompt(
    message: string,
    defaultValue: boolean
  ): string {
    const escapedMessage = this.escapePromptText(message);
    const defaultChar = defaultValue ? 'Y/n' : 'y/N';
    
    return `read -p "${escapedMessage} [${defaultChar}]: " -n 1 answer; echo; [[ "$answer" =~ ^[Yy]$ ]] && exit 0 || [[ "$answer" =~ ^[Nn]$ ]] && exit 1 || exit ${defaultValue ? '0' : '1'}`;
  }

  /**
   * Wrap prompt with bash timeout command
   * @param command Base confirmation command
   * @param timeoutMs Timeout in milliseconds
   * @param defaultValue Default value on timeout
   * @returns Timeout-wrapped bash command
   */
  private static wrapWithTimeout(
    command: string,
    timeoutMs: number,
    defaultValue: boolean
  ): string {
    const timeoutSeconds = Math.ceil(timeoutMs / 1000);
    const defaultExit = defaultValue ? 0 : 1;
    
    // Use bash timeout command with proper signal handling
    // Exit code 124 indicates timeout occurred
    return `
      timeout ${timeoutSeconds} bash -c '${command}' || {
        exit_code=$?
        if [ $exit_code -eq 124 ]; then
          exit ${defaultExit}
        else
          exit $exit_code
        fi
      }
    `.trim().replace(/\s+/g, ' ');
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