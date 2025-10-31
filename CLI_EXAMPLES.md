# AI-Powered CLI Command Examples

This file demonstrates how to use the `aisanity state execute` command with AI-powered workflows that showcase aisanity's unique capabilities with opencode integration, container isolation, and intelligent automation.

## AI Workflow Examples

The `.aisanity-workflows.yml` file contains AI-focused workflow examples:

1. **`ai-feature-development`** - Complete AI-assisted feature development with opencode agents
2. **`ai-code-review`** - Automated code analysis and review using AI in isolated containers
3. **`ai-debug-assistant`** - AI-powered bug diagnosis and fixing in isolated environments
4. **`parallel-ai-development`** - Multiple AI agents working simultaneously in parallel
5. **`ai-dev-environment`** - Automated AI development environment setup
6. **`git-town-ai-feature`** - Git Town integration with AI-assisted development
7. **`hello-world`** - Minimal example for understanding state machine basics

## AI-Powered Development Examples

### AI Feature Development

Complete AI-assisted feature development workflow that leverages opencode agents for requirements analysis, implementation planning, and code generation.

```bash
# Develop user authentication feature with AI assistance
aisanity state execute ai-feature-development feature_name=user-auth requirements_file=docs/auth-requirements.md

# Develop payment integration with automatic plan acceptance
aisanity state execute ai-feature-development feature_name=payment-integration requirements_file=docs/payment-spec.md --yes

# Preview AI development plan without execution
aisanity state execute ai-feature-development feature_name=dashboard-redesign requirements_file=docs/ui-spec.md --dry-run

# Verbose AI development with detailed logging
aisanity state execute ai-feature-development feature_name=api-v2 requirements_file=docs/api-v2-spec.md --verbose

# AI development with custom timeout for complex features
aisanity state execute ai-feature-development feature_name=ml-pipeline requirements_file=docs/ml-requirements.md --timeout=3600
```

**AI Development Process:**
1. **Requirements Analysis**: AI parses and understands feature requirements
2. **Implementation Planning**: AI generates detailed implementation plans
3. **Isolated Development**: Feature developed in separate container
4. **AI Code Generation**: OpenCode agents write actual implementation code
5. **Automated Testing**: Tests run in isolated environment
6. **AI PR Generation**: AI creates pull requests with descriptions

### AI Code Review

Automated code analysis and review using AI agents in isolated containers for security, performance, and quality analysis.

```bash
# Run comprehensive AI code review
aisanity state execute ai-code-review auto_fix=false

# Run review with automatic fix application
aisanity state execute ai-code-review auto_fix=true --yes

# Review specific changes from commit
aisanity state execute ai-code-review --from-commit abc123

# Verbose code review with detailed AI analysis
aisanity state execute ai-code-review auto_fix=false --verbose

# Dry run to preview AI review process
aisanity state execute ai-code-review --dry-run
```

**AI Review Capabilities:**
- **Automated Code Analysis**: AI reviews code for quality and best practices
- **Security Scanning**: AI identifies security vulnerabilities in isolated environment
- **Performance Analysis**: AI detects performance bottlenecks and optimization opportunities
- **Comprehensive Reporting**: AI generates detailed review reports
- **Automated Fixes**: AI suggests and can automatically apply fixes

### AI Debugging Assistant

Use AI agents to diagnose and fix bugs in isolated environments, protecting your main codebase while leveraging AI debugging capabilities.

```bash
# Debug specific bug with AI assistance
aisanity state execute ai-debug-assistant bug_id=auth-failure-123

# Debug with automatic fix application
aisanity state execute ai-debug-assistant bug_id=memory-leak-456 --yes

# Debug from specific error log
aisanity state execute ai-debug-assistant bug_id=api-timeout error_file=logs/api-error.log

# Verbose debugging with detailed AI analysis
aisanity state execute ai-debug-assistant bug_id=database-connection --verbose

# Preview AI debugging plan
aisanity state execute ai-debug-assistant bug_id=ui-crash --dry-run
```

**AI Debugging Features:**
- **Error Log Analysis**: AI analyzes error logs and stack traces
- **Root Cause Analysis**: AI identifies underlying causes of bugs
- **Fix Suggestions**: AI generates specific fix recommendations
- **Isolated Testing**: Fixes tested in temporary worktrees
- **Automated Verification**: AI verifies fixes with test execution

## Aisanity Platform Examples

### Parallel AI Development

Multiple AI agents working on different features simultaneously in isolated containers.

```bash
# Develop two features in parallel with AI
aisanity state execute parallel-ai-development feature_a=user-profile feature_b=notification-system

# Parallel development with automatic merging
aisanity state execute parallel-ai-development feature_a=api-v2 feature_b=frontend-redesign --yes

# Monitor parallel AI development progress
aisanity state execute parallel-ai-development feature_a=payment-gateway feature_b=admin-panel --verbose

# Preview parallel development plan
aisanity state execute parallel-ai-development feature_a=search feature_b=analytics --dry-run
```

**Parallel Development Benefits:**
- **Simultaneous AI Work**: Multiple AI agents work independently
- **Isolated Environments**: Each feature in separate container
- **Resource Management**: Efficient use of development resources
- **Progress Monitoring**: Real-time monitoring of all AI agents
- **Automated Merging**: Intelligent merging of completed features

### AI Development Environment Setup

Automated setup of complete AI-powered development environment with opencode integration.

```bash
# Setup AI development environment for current project
aisanity state execute ai-dev-environment

# Setup with specific project type
aisanity state execute ai-dev-environment project_type=python

# Setup with custom AI tools
aisanity state execute ai-dev-environment ai_tools=opencode,copilot,tabnine

# Verbose environment setup with detailed logging
aisanity state execute ai-dev-environment --verbose

# Preview environment setup process
aisanity state execute ai-dev-environment --dry-run
```

**Environment Setup Features:**
- **Project Detection**: Automatic detection of project type and structure
- **DevContainer Generation**: AI-optimized devcontainer configuration
- **Tool Installation**: Automatic installation of opencode and AI tools
- **Git Hook Integration**: AI assistance integrated into git workflow
- **Health Verification**: Comprehensive environment validation

## Git Town Integration Examples

### Git Town AI Feature Branch

Automated feature branch workflow combining Git Town's branch management with AI-assisted development.

```bash
# Create and implement feature with Git Town + AI
aisanity state execute git-town-ai-feature feature_name=user-dashboard requirements="Add user dashboard with profile management"

# Quick feature implementation
aisanity state execute git-town-ai-feature feature_name=api-endpoint requirements="Add REST API endpoint for user data" --yes

# Feature with detailed requirements
aisanity state execute git-town-ai-feature feature_name=search-functionality requirements="Implement full-text search with filters and pagination"

# Verbose Git Town + AI workflow
aisanity state execute git-town-ai-feature feature_name=export-feature requirements="Add data export functionality" --verbose

# Preview Git Town + AI workflow
aisanity state execute git-town-ai-feature feature_name=import-tool requirements="Add CSV import tool" --dry-run
```

**Git Town + AI Benefits:**
- **Structured Branching**: Git Town's proven branch management
- **AI Implementation**: AI agents write the actual code
- **Isolated Development**: Each feature in separate container
- **Automated Syncing**: Git Town handles branch synchronization
- **Clean Shipping**: Automated feature shipping with cleanup

## Getting Started Examples

### Hello World Workflow

Minimal example to understand state machine basics and workflow execution.

```bash
# Run basic AI workflow
aisanity state execute hello-world

# Run with verbose output
aisanity state execute hello-world --verbose

# Dry run to see execution plan
aisanity state execute hello-world --dry-run

# Run from specific state
aisanity state execute hello-world middle
```

## Advanced AI Workflow Usage

### Template Variables in AI Workflows

Use template variables to make AI workflows more flexible:

```bash
# AI workflow with multiple template variables
aisanity state execute ai-custom-feature feature_name=payment-gateway complexity=high coding_style=enterprise

# AI debugging with specific parameters
aisanity state execute ai-debug-assistant bug_id=production-error severity=critical auto_fix=true

# Parallel development with priority settings
aisanity state execute parallel-ai-development feature_a=high-priority-fix feature_b=low-priority-enhancement priority_a=high priority_b=low
```

### Conditional AI Operations

```bash
# AI workflow with conditional logic
aisanity state execute ai-conditional-workflow feature_name=complex-feature enable_advanced_ai=true

# Environment-specific AI workflows
aisanity state execute ai-feature-development feature_name=production-feature environment=production testing_level=comprehensive
```

### AI Workflow Chaining

```bash
# Chain multiple AI workflows
aisanity state execute ai-code-review && aisanity state execute ai-feature-development feature_name=next-feature

# Conditional workflow execution based on AI results
aisanity state execute ai-code-review auto_fix=false || aisanity state execute ai-debug-assistant bug_id=review-failures
```

## AI Workflow Options and Flags

### Common AI Workflow Options

```bash
# Bypass AI confirmation prompts (use with caution)
aisanity state execute ai-feature-development feature_name=auto-feature --yes

# Verbose AI execution with detailed logging
aisanity state execute ai-code-review --verbose

# Silent AI execution (minimal output)
aisanity state execute ai-debug-assistant bug_id=quick-fix --silent

# Dry run to preview AI operations
aisanity state execute ai-feature-development feature_name=planned-feature --dry-run

# Custom timeout for long AI operations
aisanity state execute ai-feature-development feature_name=complex-ml-feature --timeout=7200
```

### AI-Specific Options

```bash
# AI model selection (if supported)
aisanity state execute ai-feature-development feature_name=feature ai_model=gpt-4

# AI confidence threshold
aisanity state execute ai-code-review auto_fix=true confidence_threshold=0.8

# AI parallel processing
aisanity state execute parallel-ai-development feature_a=feature1 feature_b=feature2 parallel_agents=4

# AI learning mode (if supported)
aisanity state execute ai-feature-development feature_name=learning-feature learning_mode=true
```

## AI Workflow Monitoring and Debugging

### Monitor AI Workflow Execution

```bash
# Monitor AI workflow progress in real-time
aisanity state execute ai-feature-development feature_name=long-feature --monitor

# Check AI workflow status
aisanity state status ai-feature-development

# View AI workflow logs
aisanity state logs ai-feature-development --tail=50

# Monitor AI resource usage
aisanity state monitor --ai-agents --resource-usage
```

### Debug AI Workflows

```bash
# Debug AI workflow with maximum verbosity
aisanity state execute ai-feature-development feature_name=debug-feature --debug --verbose

# Step-by-step AI workflow execution
aisanity state execute ai-feature-development feature_name=step-by-step --interactive

# AI workflow validation without execution
aisanity state validate ai-feature-development feature_name=test-feature

# Check AI workflow dependencies
aisanity state check-dependencies ai-feature-development
```

## AI Workflow Best Practices

### Security Considerations

```bash
# Always use dry run for new AI workflows
aisanity state execute new-ai-workflow --dry-run

# Review AI-generated changes before applying
aisanity state execute ai-code-review auto_fix=false

# Use isolated environments for AI operations
aisanity state execute ai-feature-development feature_name=test-feature --isolate

# Run AI security scans automatically
aisanity state execute ai-code-review security_scan=true
```

### Performance Optimization

```bash
# Use parallel AI workflows for multiple features
aisanity state execute parallel-ai-development feature_a=feature1 feature_b=feature2

# Set appropriate timeouts for AI operations
aisanity state execute ai-feature-development feature_name=complex-feature --timeout=3600

# Monitor AI resource usage
aisanity state monitor --ai --resources

# Use AI caching for repeated operations
aisanity state execute ai-feature-development feature_name=cached-feature --cache=true
```

### Error Handling

```bash
# Continue on AI errors when appropriate
aisanity state execute ai-feature-development feature_name=experimental-feature --continue-on-error

# Rollback on AI failures
aisanity state execute ai-feature-development feature_name=critical-feature --rollback-on-error

# Retry AI operations on failure
aisanity state execute ai-feature-development feature_name=unstable-feature --retry=3

# Use AI fallback options
aisanity state execute ai-feature-development feature_name=important-feature --fallback=true
```

## AI Workflow Integration

### CI/CD Integration

```bash
# AI workflows in CI pipelines
aisanity state execute ai-code-review auto_fix=true --ci-mode

# AI workflows for automated testing
aisanity state execute ai-feature-development feature_name=ci-test --test-only

# AI workflows for deployment validation
aisanity state execute ai-code-review deployment_check=true --pre-deploy
```

### IDE Integration

```bash
# AI workflows from VS Code terminal
aisanity state execute ai-feature-development feature_name=vscode-feature

# AI workflows with editor integration
aisanity state execute ai-code-review --editor-integration

# AI workflows for code completion
aisanity state execute ai-feature-development feature_name=completion-test --auto-complete
```

### Git Integration

```bash
# AI workflows for pre-commit hooks
aisanity state execute ai-code-review --pre-commit

# AI workflows for merge requests
aisanity state execute ai-feature-development feature_name=mr-feature --merge-request

# AI workflows for release preparation
aisanity state execute ai-code-review --release-prep
```

## AI Workflow Troubleshooting

### Common AI Workflow Issues

**AI Agent Not Found:**
```bash
# Check AI agent availability
aisanity state check-ai-agents

# Install missing AI agents
aisanity state install-ai-agent opencode

# Verify AI agent configuration
aisanity state verify-ai-config
```

**Container Isolation Issues:**
```bash
# Check worktree status
aisanity worktree-list

# Clean up orphaned AI worktrees
aisanity worktree-remove --cleanup --ai-only

# Verify container isolation
aisanity state check-isolation
```

**AI Agent Timeouts:**
```bash
# Increase timeout for complex AI operations
aisanity state execute ai-feature-development feature_name=complex-feature --timeout=7200

# Check AI agent performance
aisanity state benchmark-ai-agents

# Optimize AI agent settings
aisanity state optimize-ai-config
```

### AI Workflow Recovery

```bash
# Resume interrupted AI workflow
aisanity state resume ai-feature-development feature_name=interrupted-feature

# Recover from AI failures
aisanity state recover ai-feature-development --from-backup

# Reset AI workflow state
aisanity state reset ai-feature-development --clean-state

# AI workflow rollback
aisanity state rollback ai-feature-development --to-state=previous
```

## AI Workflow Help and Documentation

### Get Help with AI Workflows

```bash
# Show AI workflow help
aisanity state --help --ai

# Show specific AI workflow details
aisanity state describe ai-feature-development

# List available AI workflows
aisanity state list --ai-only

# Show AI workflow examples
aisanity state examples --ai
```

### AI Workflow Documentation

```bash
# Generate AI workflow documentation
aisanity state docs ai-feature-development --output=ai-feature-docs.md

# Export AI workflow configuration
aisanity state export ai-feature-development --format=yaml

# Validate AI workflow syntax
aisanity state validate --ai-workflows

# Show AI workflow metrics
aisanity state metrics --ai --detailed
```

## See Also

- [WORKFLOW_EXAMPLES.md](./WORKFLOW_EXAMPLES.md) - Detailed AI workflow examples
- [WORKFLOWS.md](./WORKFLOWS.md) - Getting started guide
- [WORKFLOW_REFERENCE.md](./WORKFLOW_REFERENCE.md) - Complete YAML schema reference
- [README.md](./README.md) - Aisanity overview and installation

---

## AI Workflow Tips and Tricks

### Productivity Tips

1. **Use Template Variables**: Make AI workflows reusable with template variables
2. **Parallel Processing**: Use parallel AI workflows for multiple features
3. **Dry Run First**: Always preview AI workflows with `--dry-run`
4. **Verbose Mode**: Use `--verbose` for debugging complex AI workflows
5. **Timeout Management**: Set appropriate timeouts for AI operations

### Advanced Techniques

1. **Workflow Chaining**: Chain multiple AI workflows for complex processes
2. **Conditional Execution**: Use conditional logic in AI workflows
3. **Resource Monitoring**: Monitor AI agent resource usage
4. **Error Recovery**: Implement robust error handling for AI workflows
5. **Performance Optimization**: Optimize AI workflows for speed and efficiency

### Security Best Practices

1. **Isolated Execution**: Always run AI operations in isolated containers
2. **Code Review**: Use AI code review workflows for quality assurance
3. **Access Control**: Limit AI agent access to sensitive resources
4. **Audit Trails**: Maintain logs of AI workflow executions
5. **Validation**: Validate AI-generated code before merging

Master these AI workflow examples to unlock the full potential of aisanity's AI-powered development capabilities!