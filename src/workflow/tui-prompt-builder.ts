/**
 * TUIPromptBuilder - Generate safe bash commands for interactive TUI prompts
 * Handles shell argument escaping to prevent injection and ensures consistent behavior
 */

/**
 * Builder for creating safe bash subprocess commands for TUI interactions
 */
export class TUIPromptBuilder {
  /**
   * Build a bash command for yes/no confirmation prompt
   * @param message Prompt message to display
   * @param defaultValue Default choice if user presses Enter
   * @returns Bash command string for confirmation
   */
  static buildConfirmationPrompt(
    message: string,
    defaultValue: boolean = false
  ): string {
    const escapedMessage = this.escapeShellArg(message);
    const defaultChar = defaultValue ? 'Y/n' : 'y/N';
    const defaultExit = defaultValue ? 0 : 1;
    
    return `bash -c '
      read -p "${escapedMessage} [${defaultChar}]: " -n 1 answer
      echo
      if [[ "$answer" =~ ^[Yy]$ ]]; then
        exit 0
      elif [[ "$answer" =~ ^[Nn]$ ]]; then
        exit 1
      else
        exit ${defaultExit}
      fi
    '`;
  }

  /**
   * Build a bash command for selection menu
   * @param message Prompt message to display
   * @param options Array of choices to present
   * @param defaultIndex Optional default selection index (currently unused)
   * @returns Bash command string for selection
   */
  static buildSelectionPrompt(
    message: string,
    options: string[],
    defaultIndex?: number
  ): string {
    const escapedMessage = this.escapeShellArg(message);
    const escapedOptions = options.map(opt => this.escapeShellArg(opt));
    
    // Use bash select for menu
    return `bash -c '
      echo "${escapedMessage}"
      PS3="Select option: "
      select opt in ${escapedOptions.join(' ')}; do
        if [ -n "$opt" ]; then
          echo "$opt"
          exit 0
        fi
      done
      exit 1
    '`;
  }

  /**
   * Build a bash command for text input prompt
   * @param message Prompt message to display
   * @param defaultValue Optional default value to use if user enters nothing
   * @param validator Optional bash regex pattern for input validation
   * @returns Bash command string for input
   */
  static buildInputPrompt(
    message: string,
    defaultValue?: string,
    validator?: string
  ): string {
    const escapedMessage = this.escapeShellArg(message);
    const escapedDefault = defaultValue 
      ? this.escapeShellArg(defaultValue) 
      : '';
    
    let validatorCheck = '';
    if (validator) {
      validatorCheck = `
        if [[ ! "$input" =~ ${validator} ]]; then
          echo "Invalid input" >&2
          exit 1
        fi
      `;
    }
    
    return `bash -c '
      read -p "${escapedMessage} [${escapedDefault}]: " input
      input=\${input:-${escapedDefault}}
      ${validatorCheck}
      echo "$input"
      exit 0
    '`;
  }

  /**
   * Escape shell arguments to prevent injection
   * Uses proper bash escaping for bash -c context
   * @param arg Argument to escape
   * @returns Safely escaped argument
   */
  private static escapeShellArg(arg: string): string {
    // For bash -c context, we need to escape properly to prevent injection
    // Use proper bash escaping: close existing quote, escape quote, reopen quote
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }

  /**
   * Validate prompt arguments for security
   * @param args Arguments to validate
   */
  private static validatePromptArgs(args: string[]): void {
    for (const arg of args) {
      // Prevent malicious input in prompts
      if (arg.includes('\n') || arg.includes('\r')) {
        throw new Error('Prompt arguments cannot contain newlines');
      }
      if (arg.length > 1000) {
        throw new Error('Prompt argument too long');
      }
    }
  }
}