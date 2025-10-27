# CLI Command Integration - Example Workflows

This file demonstrates how to use the `aisanity state execute` command with various workflow examples.

## Example Workflows

The `.aisanity-workflows.yml` file contains three example workflows:

1. **`simple-demo`** - Minimal workflow for testing basic functionality
2. **`build-and-test`** - Complete CI/CD pipeline with confirmation steps
3. **`deploy-staging`** - Deployment workflow with safety confirmations

## Usage Examples

### Basic Workflow Execution

```bash
# Execute entire simple-demo workflow
aisanity state execute simple-demo

# Execute with template arguments (positional)
aisanity state execute simple-demo hello world

# Execute with named template arguments
aisanity state execute simple-demo start name=TestUser
```

### Build and Test Pipeline

```bash
# Execute full build pipeline
aisanity state execute build-and-test

# Execute specific state (linting)
aisanity state execute build-and-test lint

# Execute with template arguments for test coverage
aisanity state execute build-and-test test 2 80%
```

### Deployment Workflow

```bash
# Execute deployment with confirmation prompts
aisanity state execute deploy-staging

# Execute specific deployment state
aisanity state execute deploy-staging deploy

# Execute with template variables
aisanity state execute deploy-staging deploy version=v1.2.3 environment=staging

# Execute with confirmation bypass (use carefully!)
aisanity state execute deploy-staging deploy --yes version=v1.2.3 environment=staging
```

### Dry Run Mode

```bash
# Preview workflow execution without running commands
aisanity state execute simple-demo --dry-run

# Preview with template arguments
aisanity state execute simple-demo --dry-run hello world

# Preview specific state
aisanity state execute deploy-staging deploy --dry-run version=v1.2.3 environment=staging
```

### Verbose Mode

```bash
# Enable detailed logging
aisanity state execute build-and-test --verbose

# Combine with dry-run for detailed preview
aisanity state execute simple-demo --dry-run --verbose
```

### Silent Mode

```bash
# Suppress aisanity output (show only command output)
aisanity state execute simple-demo --silent

# Combine with confirmation bypass for automated execution
aisanity state execute simple-demo --yes --silent
```

## Template Variable Examples

### Positional Arguments
```bash
# arg1=2, arg2=80%
aisanity state execute build-and-test test 2 80%
```

### Named Arguments
```bash
# name=TestUser, workflow=simple-demo
aisanity state execute simple-demo start name=TestUser
```

### Combined Arguments
```bash
# arg1=2, arg2=80%, version=v1.2.3
aisanity state execute build-and-test test 2 80% version=v1.2.3
```

## Template Usage in Workflows

The example workflows demonstrate various template usage patterns:

```yaml
# Positional arguments
command: "npm test -- --maxWorkers={{arg1}}"

# Named arguments  
command: "echo 'Hello {{name}}!'"

# Built-in variables
command: "echo 'State: {{currentState}}'"

# Workflow context
command: "echo 'Workflow: {{workflow}}'"
```

## Security Features

All workflows are executed with security features:
- Template injection prevention
- Command validation
- Timeout enforcement
- Proper error handling

## Help System

```bash
# Show state command help
aisanity state --help

# Show execute subcommand help  
aisanity state execute --help

# Show general aisanity help
aisanity --help
```