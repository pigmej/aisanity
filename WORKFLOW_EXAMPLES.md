# Workflow Examples

Real-world workflow examples for common development scenarios.

## Table of Contents

- [Node.js/TypeScript Development](#nodejstypescript-development)
- [Docker Workflows](#docker-workflows)
- [Git Operations](#git-operations)
- [Testing and CI/CD](#testing-and-cicd)
- [Database Operations](#database-operations)
- [Multi-Project Workflows](#multi-project-workflows)

## Node.js/TypeScript Development

### Build, Test, and Deploy

Complete pipeline for Node.js applications:

```yaml
workflows:
  node-pipeline:
    name: "Node.js CI/CD Pipeline"
    description: "Complete build, test, and deployment pipeline"
    initialState: "clean"
    globalTimeout: 300
    states:
      clean:
        command: "rm"
        args: ["-rf", "dist", "node_modules"]
        transitions:
          success: "install"
      install:
        command: "npm"
        args: ["ci"]
        timeout: 180
        transitions:
          success: "lint"
          failure: "cleanup"
      lint:
        command: "npm"
        args: ["run", "lint"]
        transitions:
          success: "build"
          failure: "cleanup"
      build:
        command: "npm"
        args: ["run", "build"]
        timeout: 120
        transitions:
          success: "test"
          failure: "cleanup"
      test:
        command: "npm"
        args: ["test"]
        transitions:
          success: "deploy-confirm"
          failure: "cleanup"
      deploy-confirm:
        command: "npm"
        args: ["run", "deploy", "--env={environment}"]
        confirmation:
          message: "Deploy to {environment}?"
          timeout: 30
          defaultAccept: false
        transitions:
          success: "verify"
          failure: "cleanup"
      verify:
        command: "npm"
        args: ["run", "health-check"]
        timeout: 60
        transitions:
          success: "complete"
          failure: "rollback"
      rollback:
        command: "npm"
        args: ["run", "rollback"]
        transitions:
          success: "cleanup"
      cleanup:
        command: "echo"
        args: ["Cleaning up resources"]
        transitions:
          success: "complete"
      complete:
        command: "echo"
        args: ["Pipeline completed"]
        transitions: {}

metadata:
  version: "1.0.0"
```

Usage:
```bash
# Deploy to staging
aisanity state execute node-pipeline environment=staging

# Deploy to production with verbose logging
aisanity state execute node-pipeline environment=production --verbose

# Dry run to preview
aisanity state execute node-pipeline environment=production --dry-run
```

### Development Server Workflow

Start development environment with dependencies:

```yaml
workflows:
  dev-server:
    name: "Development Server"
    description: "Start development server with database"
    initialState: "check-deps"
    states:
      check-deps:
        command: "which"
        args: ["docker"]
        transitions:
          success: "start-db"
          failure: "install-deps"
      install-deps:
        command: "echo"
        args: ["Please install Docker first"]
        transitions: {}
      start-db:
        command: "docker"
        args: ["compose", "up", "-d", "postgres"]
        transitions:
          success: "wait-db"
      wait-db:
        command: "sleep"
        args: ["3"]
        transitions:
          success: "migrate"
      migrate:
        command: "npm"
        args: ["run", "migrate"]
        transitions:
          success: "start-server"
          failure: "stop-db"
      start-server:
        command: "npm"
        args: ["run", "dev"]
        stdin: "inherit"
        transitions:
          success: "stop-db"
      stop-db:
        command: "docker"
        args: ["compose", "down"]
        transitions: {}

metadata:
  version: "1.0.0"
```

## Docker Workflows

### Build and Push Docker Image

```yaml
workflows:
  docker-build-push:
    name: "Docker Build and Push"
    description: "Build and push Docker image to registry"
    initialState: "build"
    states:
      build:
        command: "docker"
        args: ["build", "-t", "{image}:{tag}", "."]
        timeout: 600
        transitions:
          success: "test-image"
          failure: "cleanup"
      test-image:
        command: "docker"
        args: ["run", "--rm", "{image}:{tag}", "npm", "test"]
        transitions:
          success: "tag-latest"
          failure: "cleanup"
      tag-latest:
        command: "docker"
        args: ["tag", "{image}:{tag}", "{image}:latest"]
        transitions:
          success: "push-confirm"
      push-confirm:
        command: "docker"
        args: ["push", "{image}:{tag}"]
        confirmation:
          message: "Push {image}:{tag} to registry?"
          timeout: 30
        transitions:
          success: "push-latest"
      push-latest:
        command: "docker"
        args: ["push", "{image}:latest"]
        transitions:
          success: "complete"
      cleanup:
        command: "docker"
        args: ["rmi", "{image}:{tag}"]
        transitions: {}
      complete:
        command: "echo"
        args: ["Docker image pushed successfully"]
        transitions: {}

metadata:
  version: "1.0.0"
```

Usage:
```bash
aisanity state execute docker-build-push image=myapp tag=v1.2.3
```

### Docker Compose Multi-Service

```yaml
workflows:
  compose-services:
    name: "Docker Compose Services"
    description: "Manage multi-service Docker Compose setup"
    initialState: "build"
    states:
      build:
        command: "docker"
        args: ["compose", "build"]
        timeout: 600
        transitions:
          success: "start-services"
      start-services:
        command: "docker"
        args: ["compose", "up", "-d"]
        transitions:
          success: "wait-healthy"
      wait-healthy:
        command: "sleep"
        args: ["10"]
        transitions:
          success: "check-health"
      check-health:
        command: "docker"
        args: ["compose", "ps"]
        transitions:
          success: "run-migrations"
          failure: "stop-services"
      run-migrations:
        command: "docker"
        args: ["compose", "exec", "-T", "api", "npm", "run", "migrate"]
        transitions:
          success: "seed-data"
          failure: "stop-services"
      seed-data:
        command: "docker"
        args: ["compose", "exec", "-T", "api", "npm", "run", "seed"]
        transitions:
          success: "complete"
      stop-services:
        command: "docker"
        args: ["compose", "down"]
        transitions: {}
      complete:
        command: "echo"
        args: ["All services are running"]
        transitions: {}

metadata:
  version: "1.0.0"
```

## Git Operations

### Feature Branch Workflow

```yaml
workflows:
  feature-branch:
    name: "Feature Branch Workflow"
    description: "Create, work on, and merge feature branch"
    initialState: "update-main"
    states:
      update-main:
        command: "git"
        args: ["checkout", "main"]
        transitions:
          success: "pull-main"
      pull-main:
        command: "git"
        args: ["pull", "origin", "main"]
        transitions:
          success: "create-branch"
      create-branch:
        command: "git"
        args: ["checkout", "-b", "feature/{feature}"]
        transitions:
          success: "work"
          failure: "checkout-existing"
      checkout-existing:
        command: "git"
        args: ["checkout", "feature/{feature}"]
        transitions:
          success: "work"
      work:
        command: "echo"
        args: ["Branch ready for development"]
        transitions: {}

metadata:
  version: "1.0.0"
```

Usage:
```bash
aisanity state execute feature-branch feature=user-authentication
```

### Release Workflow

```yaml
workflows:
  release:
    name: "Release Workflow"
    description: "Create and publish release"
    initialState: "check-clean"
    states:
      check-clean:
        command: "git"
        args: ["status", "--porcelain"]
        transitions:
          success: "create-tag"
          failure: "error-dirty"
      create-tag:
        command: "git"
        args: ["tag", "-a", "v{version}", "-m", "Release v{version}"]
        confirmation:
          message: "Create release tag v{version}?"
          timeout: 30
        transitions:
          success: "push-tag"
      push-tag:
        command: "git"
        args: ["push", "origin", "v{version}"]
        transitions:
          success: "build-release"
      build-release:
        command: "npm"
        args: ["run", "build"]
        transitions:
          success: "publish"
          failure: "delete-tag"
      publish:
        command: "npm"
        args: ["publish"]
        transitions:
          success: "complete"
          failure: "delete-tag"
      delete-tag:
        command: "git"
        args: ["tag", "-d", "v{version}"]
        transitions:
          success: "error-rollback"
      error-dirty:
        command: "echo"
        args: ["Working directory is not clean"]
        transitions: {}
      error-rollback:
        command: "echo"
        args: ["Release failed, tag deleted"]
        transitions: {}
      complete:
        command: "echo"
        args: ["Release v{version} published successfully"]
        transitions: {}

metadata:
  version: "1.0.0"
```

## Testing and CI/CD

### Comprehensive Test Suite

```yaml
workflows:
  test-suite:
    name: "Comprehensive Test Suite"
    description: "Run all test types in sequence"
    initialState: "unit-tests"
    states:
      unit-tests:
        command: "npm"
        args: ["run", "test:unit"]
        transitions:
          success: "integration-tests"
          failure: "report-failure"
      integration-tests:
        command: "npm"
        args: ["run", "test:integration"]
        timeout: 180
        transitions:
          success: "e2e-tests"
          failure: "report-failure"
      e2e-tests:
        command: "npm"
        args: ["run", "test:e2e"]
        timeout: 300
        transitions:
          success: "coverage-report"
          failure: "report-failure"
      coverage-report:
        command: "npm"
        args: ["run", "test:coverage"]
        transitions:
          success: "check-coverage"
      check-coverage:
        command: "bash"
        args: ["-c", "coverage=$(npm run test:coverage --silent | grep 'All files' | awk '{print $10}' | sed 's/%//'); [ $coverage -ge 80 ]"]
        transitions:
          success: "report-success"
          failure: "report-low-coverage"
      report-success:
        command: "echo"
        args: ["All tests passed with sufficient coverage"]
        transitions: {}
      report-failure:
        command: "echo"
        args: ["Tests failed"]
        transitions: {}
      report-low-coverage:
        command: "echo"
        args: ["Test coverage below 80% threshold"]
        transitions: {}

metadata:
  version: "1.0.0"
```

### Pre-Commit Checks

```yaml
workflows:
  pre-commit:
    name: "Pre-Commit Checks"
    description: "Run checks before committing"
    initialState: "format-check"
    states:
      format-check:
        command: "npm"
        args: ["run", "format:check"]
        transitions:
          success: "lint"
          failure: "format-fix"
      format-fix:
        command: "npm"
        args: ["run", "format:fix"]
        confirmation:
          message: "Auto-fix formatting issues?"
          timeout: 15
          defaultAccept: true
        transitions:
          success: "lint"
      lint:
        command: "npm"
        args: ["run", "lint"]
        transitions:
          success: "type-check"
          failure: "lint-fix"
      lint-fix:
        command: "npm"
        args: ["run", "lint:fix"]
        confirmation:
          message: "Auto-fix linting issues?"
          timeout: 15
          defaultAccept: true
        transitions:
          success: "type-check"
      type-check:
        command: "npm"
        args: ["run", "type-check"]
        transitions:
          success: "test"
      test:
        command: "npm"
        args: ["run", "test"]
        transitions:
          success: "complete"
          failure: "error"
      complete:
        command: "echo"
        args: ["Pre-commit checks passed - ready to commit"]
        transitions: {}
      error:
        command: "echo"
        args: ["Pre-commit checks failed - fix errors before committing"]
        transitions: {}

metadata:
  version: "1.0.0"
```

## Database Operations

### Database Migration and Seed

```yaml
workflows:
  db-setup:
    name: "Database Setup"
    description: "Initialize database with migrations and seed data"
    initialState: "check-connection"
    states:
      check-connection:
        command: "npm"
        args: ["run", "db:ping"]
        timeout: 10
        transitions:
          success: "drop-confirm"
          failure: "start-db"
      start-db:
        command: "docker"
        args: ["compose", "up", "-d", "postgres"]
        transitions:
          success: "wait-db"
      wait-db:
        command: "sleep"
        args: ["5"]
        transitions:
          success: "check-connection"
      drop-confirm:
        command: "npm"
        args: ["run", "db:drop"]
        confirmation:
          message: "Drop existing database?"
          timeout: 30
          defaultAccept: false
        transitions:
          success: "create-db"
          failure: "migrate"
      create-db:
        command: "npm"
        args: ["run", "db:create"]
        transitions:
          success: "migrate"
      migrate:
        command: "npm"
        args: ["run", "db:migrate"]
        transitions:
          success: "seed"
          failure: "error"
      seed:
        command: "npm"
        args: ["run", "db:seed"]
        transitions:
          success: "complete"
          failure: "error"
      complete:
        command: "echo"
        args: ["Database setup complete"]
        transitions: {}
      error:
        command: "echo"
        args: ["Database setup failed"]
        transitions: {}

metadata:
  version: "1.0.0"
```

## Multi-Project Workflows

### Monorepo Build

```yaml
workflows:
  monorepo-build:
    name: "Monorepo Build"
    description: "Build all packages in monorepo"
    initialState: "install-root"
    states:
      install-root:
        command: "npm"
        args: ["install"]
        transitions:
          success: "build-shared"
      build-shared:
        command: "npm"
        args: ["run", "build", "--workspace=packages/shared"]
        transitions:
          success: "build-api"
          failure: "error"
      build-api:
        command: "npm"
        args: ["run", "build", "--workspace=packages/api"]
        transitions:
          success: "build-web"
          failure: "error"
      build-web:
        command: "npm"
        args: ["run", "build", "--workspace=packages/web"]
        transitions:
          success: "test-all"
          failure: "error"
      test-all:
        command: "npm"
        args: ["test", "--workspaces"]
        transitions:
          success: "complete"
          failure: "error"
      complete:
        command: "echo"
        args: ["Monorepo build complete"]
        transitions: {}
      error:
        command: "echo"
        args: ["Monorepo build failed"]
        transitions: {}

metadata:
  version: "1.0.0"
```

## Tips for Writing Workflows

1. **Keep states focused**: Each state should do one thing well
2. **Add descriptions**: Help future you understand what each state does
3. **Handle failures**: Always define failure transitions for robustness
4. **Use confirmations wisely**: Add them for destructive or expensive operations
5. **Set appropriate timeouts**: Consider real execution times, add buffer
6. **Test with dry-run**: Validate workflows before executing
7. **Use template variables**: Make workflows reusable across environments
8. **Document in metadata**: Track workflow versions and changes

## See Also

- [WORKFLOWS.md](./WORKFLOWS.md) - Getting started guide
- [WORKFLOW_REFERENCE.md](./WORKFLOW_REFERENCE.md) - Complete YAML schema reference
- [CLI_EXAMPLES.md](./CLI_EXAMPLES.md) - Command-line usage examples
