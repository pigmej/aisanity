# Workflows

Aisanity workflows provide a powerful state machine-based system for defining and executing multi-step development processes. Define your workflows once in YAML, then execute them reliably with built-in error handling, confirmation prompts, and dry-run support.

## Quick Start

Create `.aisanity-workflows.yml` in your project root:

```yaml
workflows:
  hello-world:
    name: "Hello World"
    description: "A simple greeting workflow"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Hello, World!"]
        transitions:
          success: null

metadata:
  version: "1.0.0"
```

Run your workflow:

```bash
aisanity state execute hello-world
```

## Core Concepts

### Workflows

A workflow is a collection of states that define a process from start to finish. Each workflow has:

- **name**: Human-readable workflow name
- **description**: What the workflow does
- **initialState**: Starting point for execution
- **states**: Collection of named states
- **globalTimeout** (optional): Default timeout for all states in seconds

### States

States represent individual steps in your workflow. Each state defines:

- **command**: The command to execute
- **args** (optional): Array of command arguments
- **timeout** (optional): Maximum execution time in seconds
- **stdin** (optional): How to handle standard input (`inherit`, `pipe`, or `null`)
- **confirmation** (optional): Require user confirmation before execution
- **transitions**: Define what happens next based on the result

### Transitions

Transitions connect states together based on execution outcomes:

- **success**: Next state if command succeeds (exit code 0)
- **failure**: Next state if command fails (non-zero exit code)
- **timeout**: Next state if command times out

Use `null` or omit the transition to mark a terminal state (workflow ends).

## Basic Examples

### Linear Workflow

Execute states in sequence:

```yaml
workflows:
  deploy:
    name: "Deploy Application"
    description: "Build and deploy application"
    initialState: "build"
    states:
      build:
        command: "npm"
        args: ["run", "build"]
        transitions:
          success: "deploy"
      deploy:
        command: "npm"
        args: ["run", "deploy"]
        transitions:
          success: null
```

### Branching Workflow

Handle success and failure paths:

```yaml
workflows:
  test-and-deploy:
    name: "Test and Deploy"
    description: "Run tests before deploying"
    initialState: "test"
    states:
      test:
        command: "npm"
        args: ["test"]
        transitions:
          success: "deploy"
          failure: "notify-failure"
      deploy:
        command: "npm"
        args: ["run", "deploy"]
        transitions:
          success: "notify-success"
      notify-success:
        command: "echo"
        args: ["Deployment successful!"]
        transitions: {}
      notify-failure:
        command: "echo"
        args: ["Tests failed - deployment cancelled"]
        transitions: {}
```

### Workflow with Confirmations

Add interactive confirmation prompts:

```yaml
workflows:
  production-deploy:
    name: "Production Deployment"
    description: "Deploy to production with confirmation"
    initialState: "build"
    states:
      build:
        command: "npm"
        args: ["run", "build"]
        transitions:
          success: "confirm-deploy"
      confirm-deploy:
        command: "npm"
        args: ["run", "deploy", "--env=production"]
        confirmation:
          message: "Deploy to production?"
          timeout: 30
          defaultAccept: false
        transitions:
          success: null
```

## Command-Line Usage

### Execute a Workflow

```bash
# Execute from initial state
aisanity state execute my-workflow

# Execute from specific state
aisanity state execute my-workflow middle-state
```

### Command Options

- `--yes`: Bypass all confirmation prompts
- `--dry-run`: Show what would be executed without running commands
- `--verbose`: Show detailed execution information
- `--silent, --quiet`: Suppress aisanity output (only show command output)

### Examples

```bash
# Bypass confirmations for automated execution
aisanity state execute deploy --yes

# Preview execution plan
aisanity state execute deploy --dry-run

# Verbose execution with detailed logging
aisanity state execute deploy --verbose

# Silent mode for scripts
aisanity state execute deploy --silent
```

## Template Variables

Pass dynamic values to your workflows using template variables:

```yaml
workflows:
  deploy-branch:
    name: "Deploy Branch"
    description: "Deploy specific branch"
    initialState: "checkout"
    states:
      checkout:
        command: "git"
        args: ["checkout", "{branch}"]
        transitions:
          success: "deploy"
      deploy:
        command: "npm"
        args: ["run", "deploy", "--env={environment}"]
        transitions: {}
```

Pass values via command line:

```bash
aisanity state execute deploy-branch branch=main environment=production
```

## Timeouts

Control execution time limits:

### Global Timeout

Set a default timeout for all states:

```yaml
workflows:
  my-workflow:
    name: "My Workflow"
    globalTimeout: 300  # 5 minutes for all states
    initialState: "start"
    states:
      start:
        command: "npm"
        args: ["test"]
        transitions: {}
```

### Per-State Timeout

Override global timeout for specific states:

```yaml
workflows:
  build-workflow:
    name: "Build Workflow"
    globalTimeout: 60
    initialState: "quick-step"
    states:
      quick-step:
        command: "echo"
        args: ["Quick operation"]
        timeout: 10  # Override: only 10 seconds
        transitions:
          success: "long-step"
      long-step:
        command: "npm"
        args: ["run", "build"]
        timeout: 600  # Override: 10 minutes
        transitions: {}
```

### Handling Timeouts

Define timeout transitions:

```yaml
workflows:
  timeout-example:
    name: "Timeout Handling"
    initialState: "long-running"
    states:
      long-running:
        command: "npm"
        args: ["test"]
        timeout: 30
        transitions:
          success: "complete"
          timeout: "timeout-handler"
      timeout-handler:
        command: "echo"
        args: ["Operation timed out"]
        transitions: {}
      complete:
        command: "echo"
        args: ["Complete"]
        transitions: {}
```

## Error Handling and Recovery

Build robust workflows with error handling:

```yaml
workflows:
  robust-deploy:
    name: "Robust Deployment"
    description: "Deployment with cleanup and rollback"
    initialState: "init"
    states:
      init:
        command: "echo"
        args: ["Starting deployment"]
        transitions:
          success: "build"
      build:
        command: "npm"
        args: ["run", "build"]
        transitions:
          success: "test"
          failure: "cleanup"
      test:
        command: "npm"
        args: ["test"]
        transitions:
          success: "deploy"
          failure: "cleanup"
      deploy:
        command: "npm"
        args: ["run", "deploy"]
        transitions:
          success: "verify"
          failure: "rollback"
      verify:
        command: "npm"
        args: ["run", "health-check"]
        transitions:
          success: "complete"
          failure: "rollback"
      rollback:
        command: "npm"
        args: ["run", "rollback"]
        transitions:
          success: "cleanup"
      cleanup:
        command: "npm"
        args: ["run", "clean"]
        transitions:
          success: "complete"
      complete:
        command: "echo"
        args: ["Deployment process complete"]
        transitions: {}
```

## Troubleshooting

### Workflow Not Found

**Error**: `Workflow 'my-workflow' not found in .aisanity-workflows.yml`

**Solution**: Ensure your workflow file exists and contains the workflow name:
```bash
# Check if file exists
ls -la .aisanity-workflows.yml

# Verify workflow name in file
cat .aisanity-workflows.yml | grep "workflows:" -A 5
```

### Invalid Workflow Structure

**Error**: Validation errors about missing fields

**Solution**: Verify all required fields are present:
- Workflow must have: `name`, `initialState`, `states`
- Each state must have: `command`, `transitions`

### Command Not Found

**Error**: Command execution fails with "command not found"

**Solution**:
- Ensure command is available in PATH
- Use full path to command if needed
- Verify command works outside of aisanity first

### Timeout Issues

**Error**: Commands timing out unexpectedly

**Solution**:
- Increase timeout values in workflow
- Use `globalTimeout` for workflow-wide changes
- Add timeout transitions to handle gracefully

### Template Variables Not Substituting

**Error**: Template variables appear as literal `{variable}` in output

**Solution**:
- Ensure variable names match exactly (case-sensitive)
- Pass variables on command line: `key=value`
- Check for typos in variable names

## Next Steps

- See [WORKFLOW_EXAMPLES.md](./WORKFLOW_EXAMPLES.md) for real-world workflow examples
- See [WORKFLOW_REFERENCE.md](./WORKFLOW_REFERENCE.md) for complete YAML schema reference
- See [CLI_EXAMPLES.md](./CLI_EXAMPLES.md) for additional command-line examples

## Best Practices

1. **Start Simple**: Begin with linear workflows, add complexity as needed
2. **Use Confirmations**: Add confirmation prompts for destructive operations
3. **Handle Errors**: Define failure transitions for robust workflows
4. **Test with Dry Run**: Use `--dry-run` to validate workflows before execution
5. **Document**: Add clear names and descriptions to workflows and states
6. **Set Timeouts**: Configure appropriate timeouts to prevent hanging
7. **Use Template Variables**: Make workflows reusable with template substitution
8. **Version Control**: Commit `.aisanity-workflows.yml` to your repository
