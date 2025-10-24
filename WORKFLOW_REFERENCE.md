# Workflow Reference

Complete reference documentation for aisanity workflow system YAML schema and CLI commands.

## Table of Contents

- [YAML Schema Reference](#yaml-schema-reference)
- [CLI Command Reference](#cli-command-reference)
- [Template Variables](#template-variables)
- [Error Codes](#error-codes)
- [Performance Characteristics](#performance-characteristics)
- [Security Considerations](#security-considerations)
- [Extension Points](#extension-points)

## YAML Schema Reference

### Root Structure

```yaml
workflows:
  <workflow-id>:
    # Workflow definition
  <workflow-id-2>:
    # Another workflow definition

metadata:
  # File-level metadata
```

### Workflow Definition

Each workflow is identified by a unique key under `workflows:`.

#### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Human-readable workflow name |
| `initialState` | string | Name of the starting state |
| `states` | object | Map of state names to state definitions |

#### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `description` | string | - | Workflow description |
| `globalTimeout` | number | 120 | Default timeout for all states (seconds) |

#### Example

```yaml
workflows:
  my-workflow:
    name: "My Workflow"
    description: "Description of what this workflow does"
    initialState: "start"
    globalTimeout: 300
    states:
      # State definitions
```

### State Definition

States are the building blocks of workflows.

#### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `command` | string | Command to execute |
| `transitions` | object | Map of outcomes to next states |

#### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `description` | string | - | State description |
| `args` | array | [] | Command arguments |
| `timeout` | number | globalTimeout or 120 | State-specific timeout (seconds) |
| `stdin` | string | null | Standard input mode: `inherit`, `pipe`, or `null` |
| `confirmation` | object | - | Confirmation prompt configuration |

#### Example

```yaml
states:
  my-state:
    description: "Builds the application"
    command: "npm"
    args: ["run", "build"]
    timeout: 180
    stdin: "inherit"
    confirmation:
      message: "Continue with build?"
      timeout: 30
      defaultAccept: true
    transitions:
      success: "next-state"
      failure: "error-state"
      timeout: "timeout-state"
```

### Transitions

Transitions define workflow flow based on state execution outcomes.

#### Transition Types

| Type | Description | Trigger |
|------|-------------|---------|
| `success` | Execute when command succeeds | Exit code 0 |
| `failure` | Execute when command fails | Non-zero exit code |
| `timeout` | Execute when command times out | Timeout exceeded |

#### Special Values

- `null`: Terminal state (workflow ends)
- String: Name of next state to execute

#### Example

```yaml
transitions:
  success: "next-state"    # Go to next-state on success
  failure: "error-handler" # Go to error-handler on failure
  timeout: "timeout-handler" # Go to timeout-handler on timeout

# Terminal state
transitions:
  success: null  # Workflow ends
  failure: null  # Workflow ends
```

### Confirmation Configuration

Interactive confirmation prompts for critical operations.

#### Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `message` | string | "Proceed?" | Confirmation message |
| `timeout` | number | 30 | Timeout for user response (seconds) |
| `defaultAccept` | boolean | false | Default choice if timeout occurs |

#### Example

```yaml
confirmation:
  message: "Deploy to production?"
  timeout: 60
  defaultAccept: false
```

### Metadata

File-level metadata for workflow versioning and documentation.

#### Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Workflow file version |
| `created` | string | Creation date (ISO 8601) |
| `modified` | string | Last modification date (ISO 8601) |

#### Example

```yaml
metadata:
  version: "1.0.0"
  created: "2025-01-20"
  modified: "2025-01-24"
```

## CLI Command Reference

### state execute

Execute a workflow from its initial state or a specific state.

#### Syntax

```bash
aisanity state execute <workflow_name> [state] [args...] [options]
```

#### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `workflow_name` | Yes | Name of workflow to execute |
| `state` | No | Specific state to start from (default: initial state) |
| `args...` | No | Template variable arguments (key=value format) |

#### Options

| Option | Short | Description |
|--------|-------|-------------|
| `--yes` | - | Bypass all confirmation prompts |
| `--dry-run` | - | Show execution plan without running commands |
| `--verbose` | `-v` | Enable verbose logging |
| `--silent` | - | Suppress aisanity output (shows only command output) |
| `--quiet` | - | Alias for --silent |

#### Examples

```bash
# Execute workflow from initial state
aisanity state execute deploy

# Execute from specific state
aisanity state execute deploy verify-deployment

# Pass template variables
aisanity state execute deploy branch=main environment=production

# Bypass confirmations
aisanity state execute deploy --yes

# Dry run (preview)
aisanity state execute deploy --dry-run

# Verbose mode
aisanity state execute deploy --verbose

# Silent mode for scripts
aisanity state execute deploy --silent

# Combined options
aisanity state execute deploy environment=prod --yes --verbose
```

## Template Variables

### Variable Syntax

Template variables use curly brace syntax: `{variable_name}`

```yaml
states:
  deploy:
    command: "deploy"
    args: ["--env={environment}", "--branch={branch}"]
```

### Passing Variables

Variables are passed via command-line arguments:

```bash
aisanity state execute workflow_name variable=value another=value2
```

### Built-in Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{branch}` | Current git branch | main, feature/new-feature |
| `{workspace}` | Current directory name | my-project |
| `{worktree}` | Git worktree name (if applicable) | feature-worktree |
| `{timestamp}` | ISO 8601 timestamp | 2025-01-24T10:30:00Z |

### Variable Naming Rules

- Must start with letter or underscore
- Can contain letters, numbers, underscores
- Case-sensitive
- Examples: `{env}`, `{_private}`, `{var123}`

### Security

Template variables are validated to prevent command injection:

**Blocked patterns:**
- Command chaining: `; && ||`
- Command substitution: `` ` `` `$()`
- System file access: `/etc/` `/var/log/`
- Dangerous commands: `rm -rf /`

**Allowed patterns:**
- Alphanumeric: `abc123`
- Paths: `./path ../relative /absolute`
- URLs: `https://example.com`
- Versions: `1.2.3-beta.4`

## Error Codes

### Exit Codes

| Code | Description | Recoverable |
|------|-------------|-------------|
| 0 | Success | N/A |
| 1 | General error | Maybe |
| 2 | Command execution error | Maybe |
| 3 | Workflow validation error | Yes |
| 4 | Workflow file error | Yes |
| 5 | State transition error | Maybe |
| 6 | State not found | Yes |
| 7 | Confirmation timeout | Maybe |

### Error Types

#### WorkflowFileError

Workflow file cannot be loaded or parsed.

**Common causes:**
- File not found
- Invalid YAML syntax
- Permission denied

**Resolution:**
- Check file exists: `.aisanity-workflows.yml`
- Validate YAML syntax
- Check file permissions

#### WorkflowValidationError

Workflow structure is invalid.

**Common causes:**
- Missing required fields
- Invalid state references
- Circular dependencies

**Resolution:**
- Verify required fields present
- Check state names match
- Use validation tools

#### StateNotFoundError

Referenced state doesn't exist.

**Common causes:**
- Typo in state name
- Missing state definition
- Invalid transition target

**Resolution:**
- Check state spelling
- Verify state defined in workflow
- Review transition targets

#### CommandExecutionError

Command failed to execute.

**Common causes:**
- Command not found
- Invalid arguments
- Permission denied
- Command returned non-zero exit code

**Resolution:**
- Verify command available in PATH
- Check command arguments
- Review command permissions
- Check command output for errors

#### ConfirmationTimeoutError

User didn't respond to confirmation prompt.

**Common causes:**
- Timeout too short
- Unattended execution
- User unavailable

**Resolution:**
- Increase confirmation timeout
- Use `--yes` flag for automation
- Adjust `defaultAccept` setting

## Performance Characteristics

### Startup Performance

| Metric | Target | Typical |
|--------|--------|---------|
| Complete system startup | <500ms | 100-300ms |
| FSM initialization | <20ms | 5-15ms |
| YAML parsing | <100ms | 20-50ms |
| Workflow validation | <50ms | 10-30ms |

### Runtime Performance

| Metric | Impact | Notes |
|--------|--------|-------|
| State transition | <1ms | Negligible overhead |
| Context updates | <1ms | Negligible overhead |
| History tracking | <1ms per state | Memory scales linearly |

### Scalability

| Scenario | Supported | Performance |
|----------|-----------|-------------|
| States per workflow | 100+ | Linear scaling |
| Concurrent workflows | Limited by system | Independent execution |
| State history | Unlimited | Linear memory growth |
| Template variables | 100+ | Negligible impact |

### Optimization Tips

1. **Minimize state count**: Combine related operations
2. **Set appropriate timeouts**: Avoid unnecessary waiting
3. **Use dry-run**: Validate before executing
4. **Cache template variables**: Reduce resolution overhead
5. **Clean up resources**: Remove temporary files

## Security Considerations

### Command Execution

- **Sandboxing**: Commands execute in current shell environment
- **No privilege escalation**: Runs with user permissions
- **Path resolution**: Commands resolved via PATH

### Template Variable Validation

- **Input sanitization**: Dangerous characters blocked
- **Pattern matching**: Known attack patterns rejected
- **Whitelist approach**: Only safe characters allowed

### File System Access

- **Relative paths**: Supported for development workflows
- **System paths**: Access to system directories blocked
- **Permission checks**: Respects file system permissions

### Best Practices

1. **Validate inputs**: Check CLI arguments before execution
2. **Use confirmations**: Add prompts for destructive operations
3. **Limit permissions**: Run with minimal required permissions
4. **Review workflows**: Audit workflow definitions regularly
5. **Test safely**: Use `--dry-run` to preview execution

## Extension Points

### Custom Variable Resolvers

Add custom template variable resolution logic:

```typescript
import { VariableResolver } from 'aisanity/workflow';

const resolver = new VariableResolver();
resolver.registerCustomResolver('myvar', async () => {
  return 'custom-value';
});
```

### Custom Validators

Add custom validation rules:

```typescript
import { TemplateValidator } from 'aisanity/workflow';

const validator = new TemplateValidator();
// Add custom validation logic
```

### Error Handlers

Customize error handling behavior:

```typescript
import { WorkflowErrorHandler } from 'aisanity/workflow';

const errorHandler = new WorkflowErrorHandler(logger);
errorHandler.registerCleanupHandler(async () => {
  // Custom cleanup logic
});
```

### Future Extensions

Planned extension points for future versions:

- **Plugin system**: Load custom state executors
- **State middleware**: Hook into state execution lifecycle
- **Custom reporters**: Format execution reports
- **Remote workflows**: Load workflows from remote sources
- **Workflow composition**: Include workflows in other workflows

## See Also

- [WORKFLOWS.md](./WORKFLOWS.md) - Getting started guide
- [WORKFLOW_EXAMPLES.md](./WORKFLOW_EXAMPLES.md) - Real-world examples
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Development workflow documentation
- [CLI_EXAMPLES.md](./CLI_EXAMPLES.md) - Additional CLI examples
