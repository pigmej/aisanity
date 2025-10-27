# Argument Templating System Example

This example demonstrates how to use the argument templating system to substitute variables in workflow commands.

## Basic Usage

```typescript
import { ArgumentTemplater } from '../src/workflow/argument-templater';
import { Logger } from '../src/utils/logger';

const logger = new Logger();
const templater = new ArgumentTemplater(logger);

// Process a command with template variables
const command = 'git checkout {branch}';
const args = ['--force', '--message={message}'];
const cliParams = { 
  branch: 'feature/new-ui', 
  message: 'Implement new user interface' 
};

const processed = await templater.processCommandArgs(command, args, cliParams);

console.log('Original command:', command);
console.log('Processed command:', processed.command);
console.log('Processed args:', processed.args);
console.log('Substitutions:', processed.substitutions);
console.log('Execution ready:', processed.executionReady);
```

## Built-in Variables

The system automatically provides these built-in variables:

- `{branch}` - Current git branch name
- `{workspace}` - Current workspace directory name
- `{worktree}` - Git worktree name (if applicable)
- `{timestamp}` - ISO timestamp

```typescript
const command = 'echo "Building {workspace} on {branch} at {timestamp}"';
const processed = await templater.processCommandArgs(command, [], {});

console.log(processed.command);
// Output: echo "Building aisanity on main at 2025-01-21T13:45:30.123Z"
```

## Template Validation

The system validates templates for security:

```typescript
// Safe template
const safeTemplate = 'echo "Building {workspace}"';
const validation = templater.validateTemplateSyntax(safeTemplate);
console.log(validation.isValid); // true

// Dangerous template (rejected)
const dangerousTemplate = 'echo {input}; rm -rf /';
const validation = templater.validateTemplateSyntax(dangerousTemplate);
console.log(validation.isValid); // false
console.log(validation.errors); // ["Template contains potentially dangerous injection patterns"]
```

## Escaped Braces

Use double braces to include literal braces in your commands:

```typescript
const command = 'echo "{{literal}} and {branch}"';
const processed = await templater.processCommandArgs(command, [], { branch: 'main' });

console.log(processed.command);
// Output: echo "{literal} and main"
```

## Integration with Workflows

In workflow YAML files:

```yaml
workflows:
  build-and-deploy:
    name: "Build and Deploy"
    initialState: "build"
    states:
      build:
        command: "echo"
        args: ["Building {workspace} on {branch}"]
        transitions:
          success: "deploy"
      deploy:
        command: "echo"
        args: ["Deploying to {environment}"]
        transitions:
          success: null
```

When executed with CLI parameters `--environment=production`, the system will substitute:
- `{workspace}` with current workspace name
- `{branch}` with current git branch
- `{environment}` with "production"

## Security Features

- **Input Validation**: All variable values are validated against safe patterns
- **Injection Prevention**: Dangerous shell metacharacters are blocked
- **Length Limits**: Templates and values have maximum length restrictions
- **Path Traversal Protection**: Directory traversal attempts are blocked

## Error Handling

The system provides detailed error information:

```typescript
const processed = await templater.processCommandArgs(
  'git checkout {branch}; rm -rf /',
  [],
  { branch: 'main' }
);

if (!processed.executionReady) {
  console.log('Validation errors:', processed.validationErrors);
  // Output: Validation errors: ["Template contains potentially dangerous injection patterns"]
}
```