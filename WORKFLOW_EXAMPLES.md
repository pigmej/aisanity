# AI-Powered Workflow Examples

Real-world workflow examples showcasing aisanity's unique AI development capabilities with opencode integration, container isolation, and intelligent automation.

## Table of Contents

- [AI-Powered Development](#ai-powered-development)
  - [OpenCode Feature Development](#opencode-feature-development)
  - [AI Code Review](#ai-code-review)
  - [AI Debugging Assistant](#ai-debugging-assistant)
- [Aisanity Platform Features](#aisanity-platform-features)
  - [Parallel AI Development](#parallel-ai-development)
  - [AI Development Environment Setup](#ai-development-environment-setup)
- [Git Town Integration](#git-town-integration)
  - [Git Town AI Feature Branch](#git-town-ai-feature-branch)
- [Getting Started](#getting-started)
  - [Hello World Workflow](#hello-world-workflow)

---

## AI-Powered Development

### OpenCode Feature Development

Complete AI-assisted feature development workflow that leverages opencode agents for requirements analysis, implementation planning, and code generation in isolated containers.

```yaml
workflows:
  ai-feature-development:
    name: "AI-Assisted Feature Development"
    description: "Use opencode agents to implement features from requirements in isolated containers"
    initialState: "parse-requirements"
    globalTimeout: 1800
    states:
      parse-requirements:
        description: "Parse and analyze feature requirements using AI"
        command: "opencode"
        args: ["analyze", "--file", "{requirements_file}", "--output", "analysis.json"]
        timeout: 300
        transitions:
          success: "generate-plan"
          failure: "requirements-error"
      generate-plan:
        description: "Generate implementation plan using AI agent"
        command: "opencode"
        args: ["plan", "--analysis", "analysis.json", "--output", "implementation-plan.md"]
        timeout: 600
        confirmation:
          message: "Review implementation plan in implementation-plan.md. Continue?"
          timeout: 60
          defaultAccept: false
        transitions:
          success: "create-worktree"
          failure: "plan-error"
      create-worktree:
        description: "Create isolated worktree for feature development"
        command: "aisanity"
        args: ["worktree-create", "--branch", "feature/{feature_name}"]
        timeout: 60
        transitions:
          success: "launch-ai-agent"
          failure: "worktree-error"
      launch-ai-agent:
        description: "Launch opencode agent in isolated container"
        command: "aisanity"
        args: ["run", "--worktree", "feature/{feature_name}", "opencode", "implement", "--plan", "implementation-plan.md"]
        stdin: "inherit"
        timeout: 900
        transitions:
          success: "run-tests"
          failure: "implementation-error"
      run-tests:
        description: "Run tests in isolated environment"
        command: "aisanity"
        args: ["run", "--worktree", "feature/{feature_name}", "npm", "test"]
        timeout: 300
        transitions:
          success: "create-pr"
          failure: "test-error"
      create-pr:
        description: "Create PR with AI-generated description"
        command: "opencode"
        args: ["pr", "--feature", "{feature_name}", "--auto-description"]
        timeout: 120
        transitions:
          success: "complete"
          failure: "pr-error"
```

**Usage Examples:**
```bash
# Develop user authentication feature
aisanity state execute ai-feature-development feature_name=user-auth requirements_file=docs/auth-requirements.md

# Develop payment integration with auto-accept
aisanity state execute ai-feature-development feature_name=payment-integration requirements_file=docs/payment-spec.md --yes

# Dry run to preview AI development plan
aisanity state execute ai-feature-development feature_name=dashboard-redesign requirements_file=docs/ui-spec.md --dry-run
```

**Key AI Features:**
- **Requirements Analysis**: AI parses and understands feature requirements
- **Implementation Planning**: AI generates detailed implementation plans
- **Isolated Development**: Each feature developed in separate container
- **AI Code Generation**: OpenCode agents write actual implementation code
- **Automated Testing**: Tests run in isolated environment
- **AI PR Generation**: AI creates pull requests with descriptions

---

### AI Code Review

Automated code analysis and review workflow using AI agents in isolated containers for security, performance, and quality analysis.

```yaml
workflows:
  ai-code-review:
    name: "AI-Powered Code Review"
    description: "Automated code analysis and review using AI agents in isolated containers"
    initialState: "detect-changes"
    globalTimeout: 1200
    states:
      detect-changes:
        description: "Detect changes in current worktree"
        command: "git"
        args: ["diff", "--name-only", "HEAD~1"]
        timeout: 30
        transitions:
          success: "launch-review-agent"
          failure: "no-changes"
      launch-review-agent:
        description: "Launch opencode review agent in isolated container"
        command: "aisanity"
        args: ["run", "opencode", "review", "--files", "changed-files.txt", "--output", "review-report.md"]
        timeout: 600
        transitions:
          success: "security-analysis"
          failure: "review-error"
      security-analysis:
        description: "Run security analysis in isolated environment"
        command: "aisanity"
        args: ["run", "opencode", "security-scan", "--output", "security-report.md"]
        timeout: 300
        transitions:
          success: "performance-analysis"
          failure: "security-error"
      performance-analysis:
        description: "Run performance analysis"
        command: "aisanity"
        args: ["run", "opencode", "performance-scan", "--output", "performance-report.md"]
        timeout: 300
        transitions:
          success: "generate-report"
          failure: "performance-error"
      generate-report:
        description: "Generate comprehensive review report"
        command: "opencode"
        args: ["report", "--merge", "review-report.md,security-report.md,performance-report.md", "--output", "comprehensive-review.md"]
        timeout: 120
        transitions:
          success: "suggest-fixes"
          failure: "report-error"
      suggest-fixes:
        description: "Suggest fixes for identified issues"
        command: "opencode"
        args: ["fix-suggestions", "--report", "comprehensive-review.md", "--auto-apply", "{auto_fix}"]
        confirmation:
          message: "Apply AI-suggested fixes automatically?"
          timeout: 30
          defaultAccept: false
        timeout: 300
        transitions:
          success: "complete"
          failure: "fix-error"
```

**Usage Examples:**
```bash
# Run comprehensive AI code review
aisanity state execute ai-code-review auto_fix=false

# Run review with automatic fix application
aisanity state execute ai-code-review auto_fix=true --yes

# Review specific changes from commit
aisanity state execute ai-code-review --from-commit abc123
```

**AI Review Capabilities:**
- **Automated Code Analysis**: AI reviews code for quality and best practices
- **Security Scanning**: AI identifies security vulnerabilities in isolated environment
- **Performance Analysis**: AI detects performance bottlenecks and optimization opportunities
- **Comprehensive Reporting**: AI generates detailed review reports
- **Automated Fixes**: AI suggests and can automatically apply fixes

---

### AI Debugging Assistant

Use AI agents to diagnose and fix bugs in isolated environments, protecting your main codebase while leveraging AI debugging capabilities.

```yaml
workflows:
  ai-debug-assistant:
    name: "AI Bug Diagnosis and Fix"
    description: "Use AI agents to diagnose and fix bugs in isolated environments"
    initialState: "capture-error"
    globalTimeout: 900
    states:
      capture-error:
        description: "Capture error logs and context"
        command: "bash"
        args: ["-c", "find . -name '*.log' -o -name 'error*.txt' | head -5 > error-files.txt"]
        timeout: 30
        transitions:
          success: "launch-debug-agent"
          failure: "no-errors"
      launch-debug-agent:
        description: "Launch opencode debug agent in isolated container"
        command: "aisanity"
        args: ["run", "opencode", "debug", "--logs", "error-files.txt", "--output", "diagnosis.md"]
        timeout: 300
        transitions:
          success: "analyze-stack-trace"
          failure: "debug-error"
      analyze-stack-trace:
        description: "AI analysis of stack traces and error patterns"
        command: "opencode"
        args: ["analyze-stack", "--diagnosis", "diagnosis.md", "--output", "root-cause.md"]
        timeout: 180
        transitions:
          success: "suggest-fixes"
          failure: "analysis-error"
      suggest-fixes:
        description: "AI suggests fixes based on analysis"
        command: "opencode"
        args: ["fix-suggestions", "--root-cause", "root-cause.md", "--output", "fix-plan.md"]
        timeout: 240
        confirmation:
          message: "Review AI-suggested fixes in fix-plan.md. Apply them?"
          timeout: 60
          defaultAccept: false
        transitions:
          success: "apply-fixes"
          failure: "complete"
      apply-fixes:
        description: "Apply fixes in isolated worktree"
        command: "aisanity"
        args: ["worktree-create", "--branch", "bugfix/{bug_id}", "--temporary"]
        timeout: 60
        transitions:
          success: "execute-fixes"
          failure: "worktree-error"
      execute-fixes:
        description: "Execute AI-suggested fixes"
        command: "aisanity"
        args: ["run", "--worktree", "bugfix/{bug_id}", "opencode", "apply-fixes", "--plan", "fix-plan.md"]
        timeout: 300
        transitions:
          success: "verify-fix"
          failure: "fix-execution-error"
      verify-fix:
        description: "Verify fix with tests"
        command: "aisanity"
        args: ["run", "--worktree", "bugfix/{bug_id}", "npm", "test"]
        timeout: 180
        transitions:
          success: "cleanup"
          failure: "verification-error"
      cleanup:
        description: "Clean up temporary worktree"
        command: "aisanity"
        args: ["worktree-remove", "--branch", "bugfix/{bug_id}", "--force"]
        transitions:
          success: "complete"
          failure: "cleanup-error"
```

**Usage Examples:**
```bash
# Debug specific bug with ID
aisanity state execute ai-debug-assistant bug_id=auth-failure-123

# Debug with automatic fix application
aisanity state execute ai-debug-assistant bug_id=memory-leak-456 --yes

# Debug from specific error log
aisanity state execute ai-debug-assistant bug_id=api-timeout error_file=logs/api-error.log
```

**AI Debugging Features:**
- **Error Log Analysis**: AI analyzes error logs and stack traces
- **Root Cause Analysis**: AI identifies underlying causes of bugs
- **Fix Suggestions**: AI generates specific fix recommendations
- **Isolated Testing**: Fixes tested in temporary worktrees
- **Automated Verification**: AI verifies fixes with test execution

---

## Aisanity Platform Features

### Parallel AI Development

Multiple AI agents working on different features simultaneously in isolated containers, showcasing aisanity's unique parallel development capabilities.

```yaml
workflows:
  parallel-ai-development:
    name: "Parallel AI Development"
    description: "Multiple AI agents working on different features simultaneously in isolated containers"
    initialState: "setup-worktrees"
    globalTimeout: 2400
    states:
      setup-worktrees:
        description: "Create isolated worktrees for parallel development"
        command: "bash"
        args: ["-c", "aisanity worktree-create --branch feature/{feature_a} && aisanity worktree-create --branch feature/{feature_b}"]
        timeout: 120
        transitions:
          success: "launch-agent-a"
          failure: "setup-error"
      launch-agent-a:
        description: "Launch opencode agent for feature A"
        command: "aisanity"
        args: ["run", "--worktree", "feature/{feature_a}", "opencode", "implement", "--feature", "{feature_a}", "--priority", "high"]
        stdin: "inherit"
        timeout: 600
        transitions:
          success: "launch-agent-b"
          failure: "agent-a-error"
      launch-agent-b:
        description: "Launch opencode agent for feature B"
        command: "aisanity"
        args: ["run", "--worktree", "feature/{feature_b}", "opencode", "implement", "--feature", "{feature_b}", "--priority", "medium"]
        stdin: "inherit"
        timeout: 600
        transitions:
          success: "monitor-progress"
          failure: "agent-b-error"
      monitor-progress:
        description: "Monitor both AI agents in parallel"
        command: "opencode"
        args: ["monitor", "--worktrees", "feature/{feature_a},feature/{feature_b}", "--interval", "30"]
        timeout: 900
        transitions:
          success: "merge-features"
          failure: "monitor-error"
      merge-features:
        description: "Merge successfully implemented features"
        command: "bash"
        args: ["-c", "git checkout main && git merge feature/{feature_a} && git merge feature/{feature_b}"]
        confirmation:
          message: "Merge both features into main branch?"
          timeout: 30
          defaultAccept: false
        transitions:
          success: "cleanup"
          failure: "merge-error"
      cleanup:
        description: "Clean up feature worktrees"
        command: "bash"
        args: ["-c", "aisanity worktree-remove --branch feature/{feature_a} && aisanity worktree-remove --branch feature/{feature_b}"]
        transitions:
          success: "complete"
          failure: "cleanup-error"
```

**Usage Examples:**
```bash
# Develop two features in parallel
aisanity state execute parallel-ai-development feature_a=user-profile feature_b=notification-system

# Parallel development with automatic merging
aisanity state execute parallel-ai-development feature_a=api-v2 feature_b=frontend-redesign --yes

# Monitor parallel AI development progress
aisanity state execute parallel-ai-development feature_a=payment-gateway feature_b=admin-panel --verbose
```

**Parallel Development Benefits:**
- **Simultaneous AI Work**: Multiple AI agents work independently
- **Isolated Environments**: Each feature in separate container
- **Resource Management**: Efficient use of development resources
- **Progress Monitoring**: Real-time monitoring of all AI agents
- **Automated Merging**: Intelligent merging of completed features

---

### AI Development Environment Setup

Automated setup of complete AI-powered development environment with opencode integration and devcontainer configuration.

```yaml
workflows:
  ai-dev-environment:
    name: "AI Development Environment Setup"
    description: "Automated setup of complete AI-powered development environment"
    initialState: "detect-project"
    globalTimeout: 600
    states:
      detect-project:
        description: "Detect project type and structure"
        command: "aisanity"
        args: ["detect-project", "--output", "project-info.json"]
        timeout: 30
        transitions:
          success: "generate-devcontainer"
          failure: "detection-error"
      generate-devcontainer:
        description: "Generate devcontainer configuration for AI development"
        command: "opencode"
        args: ["generate-devcontainer", "--project", "project-info.json", "--ai-tools", "true"]
        timeout: 120
        transitions:
          success: "setup-container"
          failure: "devcontainer-error"
      setup-container:
        description: "Setup devcontainer with AI tools"
        command: "aisanity"
        args: ["init", "--devcontainer", "--ai-tools"]
        timeout: 180
        transitions:
          success: "install-opencode"
          failure: "container-error"
      install-opencode:
        description: "Install and configure opencode automatically"
        command: "aisanity"
        args: ["run", "opencode", "install", "--auto-configure"]
        timeout: 120
        transitions:
          success: "configure-ai-agents"
          failure: "opencode-error"
      configure-ai-agents:
        description: "Configure AI agent preferences and workflows"
        command: "opencode"
        args: ["configure", "--project-type", "auto", "--workflows", "true"]
        timeout: 60
        transitions:
          success: "setup-git-hooks"
          failure: "config-error"
      setup-git-hooks:
        description: "Setup git hooks for AI assistance"
        command: "opencode"
        args: ["git-hooks", "--install", "--pre-commit", "--ai-review"]
        timeout: 30
        transitions:
          success: "verify-environment"
          failure: "hooks-error"
      verify-environment:
        description: "Verify AI development environment readiness"
        command: "aisanity"
        args: ["run", "opencode", "health-check", "--verbose"]
        timeout: 60
        transitions:
          success: "complete"
          failure: "verification-error"
```

**Usage Examples:**
```bash
# Setup AI development environment for current project
aisanity state execute ai-dev-environment

# Setup with specific project type
aisanity state execute ai-dev-environment project_type=python

# Setup with custom AI tools
aisanity state execute ai-dev-environment ai_tools=opencode,copilot,tabnine
```

**Environment Setup Features:**
- **Project Detection**: Automatic detection of project type and structure
- **DevContainer Generation**: AI-optimized devcontainer configuration
- **Tool Installation**: Automatic installation of opencode and AI tools
- **Git Hook Integration**: AI assistance integrated into git workflow
- **Health Verification**: Comprehensive environment validation

---

## Git Town Integration

### Git Town AI Feature Branch

Automated feature branch workflow combining Git Town's branch management with AI-assisted development in isolated containers.

```yaml
workflows:
  git-town-ai-feature:
    name: "Git Town AI Feature Branch"
    description: "Automated feature branch workflow with Git Town and AI assistance"
    initialState: "git-town-hack"
    globalTimeout: 1200
    states:
      git-town-hack:
        description: "Create feature branch using Git Town"
        command: "git"
        args: ["town", "hack", "{feature_name}"]
        timeout: 60
        transitions:
          success: "create-worktree"
          failure: "git-town-error"
      create-worktree:
        description: "Create isolated worktree for feature development"
        command: "aisanity"
        args: ["worktree-create", "--branch", "{feature_name}"]
        timeout: 60
        transitions:
          success: "ai-implementation"
          failure: "worktree-error"
      ai-implementation:
        description: "Use AI agent to implement feature"
        command: "aisanity"
        args: ["run", "--worktree", "{feature_name}", "opencode", "implement", "--feature", "{feature_name}", "--requirements", "{requirements}"]
        stdin: "inherit"
        timeout: 600
        transitions:
          success: "run-tests"
          failure: "implementation-error"
      run-tests:
        description: "Run tests in isolated environment"
        command: "aisanity"
        args: ["run", "--worktree", "{feature_name}", "npm", "test"]
        timeout: 180
        transitions:
          success: "git-town-sync"
          failure: "test-error"
      git-town-sync:
        description: "Sync branch with Git Town"
        command: "git"
        args: ["town", "sync"]
        timeout: 120
        transitions:
          success: "git-town-ship"
          failure: "sync-error"
      git-town-ship:
        description: "Ship feature to main branch"
        command: "git"
        args: ["town", "ship"]
        confirmation:
          message: "Ship feature {feature_name} to main branch?"
          timeout: 30
          defaultAccept: false
        transitions:
          success: "cleanup"
          failure: "ship-error"
      cleanup:
        description: "Clean up worktree"
        command: "aisanity"
        args: ["worktree-remove", "--branch", "{feature_name}"]
        transitions:
          success: "complete"
          failure: "cleanup-error"
```

**Usage Examples:**
```bash
# Create and implement feature with Git Town + AI
aisanity state execute git-town-ai-feature feature_name=user-dashboard requirements="Add user dashboard with profile management"

# Quick feature implementation
aisanity state execute git-town-ai-feature feature_name=api-endpoint requirements="Add REST API endpoint for user data" --yes

# Feature with detailed requirements
aisanity state execute git-town-ai-feature feature_name=search-functionality requirements="Implement full-text search with filters and pagination"
```

**Git Town + AI Benefits:**
- **Structured Branching**: Git Town's proven branch management
- **AI Implementation**: AI agents write the actual code
- **Isolated Development**: Each feature in separate container
- **Automated Syncing**: Git Town handles branch synchronization
- **Clean Shipping**: Automated feature shipping with cleanup

---

## Getting Started

### Hello World Workflow

Minimal example to understand state machine basics and workflow execution.

```yaml
workflows:
  hello-world:
    name: "Hello World Workflow"
    description: "Minimal example to understand state machine basics"
    initialState: "start"
    states:
      start:
        command: "echo"
        args: ["Starting AI-powered development workflow"]
        transitions:
          success: "middle"
      middle:
        command: "echo"
        args: ["Processing with AI assistance..."]
        transitions:
          success: "end"
      end:
        command: "echo"
        args: ["Workflow completed successfully!"]
        transitions: {}
```

**Usage Examples:**
```bash
# Run basic workflow
aisanity state execute hello-world

# Run with verbose output
aisanity state execute hello-world --verbose

# Dry run to see execution plan
aisanity state execute hello-world --dry-run
```

---

## AI Workflow Best Practices

### 1. **Container Isolation**
- Always use `aisanity run --worktree` for AI operations
- Keep AI work isolated from main codebase
- Use temporary worktrees for experimental features

### 2. **AI Agent Configuration**
- Configure AI agents for specific project types
- Use appropriate AI models for different tasks
- Set proper timeouts for AI operations

### 3. **Error Handling**
- Always define failure transitions for AI operations
- Use confirmation prompts for destructive AI actions
- Implement rollback mechanisms for AI-generated changes

### 4. **Security Considerations**
- Run AI security scans in isolated containers
- Review AI-generated code before merging
- Use AI code review workflows for quality assurance

### 5. **Performance Optimization**
- Use parallel workflows for multiple AI agents
- Monitor AI agent resource usage
- Set appropriate timeouts for AI operations

### 6. **Integration Patterns**
- Combine AI workflows with Git Town for branch management
- Use AI workflows in CI/CD pipelines
- Integrate with existing development tools

---

## Advanced AI Workflow Features

### Template Variables in AI Workflows

Use template variables to make AI workflows more flexible:

```yaml
# AI workflow with template variables
ai-custom-feature:
  name: "Custom AI Feature Development"
  description: "Develop custom feature with AI assistance"
  initialState: "analyze"
  states:
    analyze:
      command: "opencode"
      args: ["analyze", "--feature", "{feature_name}", "--complexity", "{complexity}", "--output", "analysis.json"]
      transitions:
        success: "implement"
    implement:
      command: "aisanity"
      args: ["run", "--worktree", "feature/{feature_name}", "opencode", "implement", "--analysis", "analysis.json", "--style", "{coding_style}"]
      transitions:
        success: "complete"
```

**Usage with template variables:**
```bash
aisanity state execute ai-custom-feature feature_name=payment-gateway complexity=high coding_style=enterprise
```

### Conditional AI Operations

Use AI workflows with conditional logic:

```yaml
ai-conditional-workflow:
  name: "Conditional AI Workflow"
  description: "AI workflow with conditional operations"
  initialState: "assess-complexity"
  states:
    assess-complexity:
      command: "opencode"
      args: ["assess", "--feature", "{feature_name}", "--output", "complexity.json"]
      transitions:
        success: "route-by-complexity"
    route-by-complexity:
      command: "bash"
      args: ["-c", "if [ $(cat complexity.json | jq .complexity) -gt 7 ]; then echo 'high'; else echo 'low'; fi > complexity-level.txt"]
      transitions:
        success: "implement-based-on-complexity"
    implement-based-on-complexity:
      command: "opencode"
      args: ["implement", "--feature", "{feature_name}", "--approach", "$(cat complexity-level.txt)"]
      transitions:
        success: "complete"
```

---

## See Also

- [WORKFLOWS.md](./WORKFLOWS.md) - Getting started guide
- [WORKFLOW_REFERENCE.md](./WORKFLOW_REFERENCE.md) - Complete YAML schema reference
- [CLI_EXAMPLES.md](./CLI_EXAMPLES.md) - AI workflow command-line examples
- [README.md](./README.md) - Aisanity overview and installation

---

## Troubleshooting AI Workflows

### Common AI Workflow Issues

**AI Agent Not Found:**
```bash
# Ensure opencode is installed
aisanity run opencode --version

# Install opencode if needed
aisanity run opencode install
```

**Container Isolation Issues:**
```bash
# Check worktree status
aisanity worktree-list

# Clean up orphaned worktrees
aisanity worktree-remove --cleanup
```

**AI Agent Timeouts:**
```bash
# Increase timeout for complex AI operations
aisanity state execute ai-feature-development feature_name=complex-feature --timeout=3600
```

**Git Town Integration Issues:**
```bash
# Verify Git Town installation
git town --version

# Check Git Town configuration
git town config
```

### Debug Mode for AI Workflows

Use verbose mode to debug AI workflow execution:

```bash
# Run AI workflow with detailed logging
aisanity state execute ai-feature-development feature_name=test --verbose

# Dry run to preview AI operations
aisanity state execute ai-feature-development feature_name=test --dry-run --verbose
```

---

## Contributing AI Workflows

When contributing new AI workflow examples:

1. **Focus on AI Integration**: Showcase opencode and AI agent capabilities
2. **Use Container Isolation**: Demonstrate aisanity's unique container features
3. **Include Error Handling**: Define proper failure transitions
4. **Add Security Considerations**: Include AI security scanning where appropriate
5. **Document Thoroughly**: Explain AI workflow benefits and use cases
6. **Test Realistically**: Ensure workflows work with actual AI tools

Submit AI workflow examples as pull requests with detailed descriptions of the AI capabilities demonstrated.