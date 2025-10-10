# Architecture Research: XState-Based Workflow State Machine Executor

**Feature ID:** 100
**Created:** 2025-10-10
**Status:** Draft

## Research Findings

### XState Best Practices for Command Execution

#### Invoke Pattern vs Services vs Pure Functions
Based on XState v5 documentation and community patterns:

**Invoke with Services (Recommended)**
```typescript
states: {
  executing: {
    invoke: {
      src: 'executeCommand',
      input: { command: context.command, timeout: context.timeout },
      onDone: {
        target: 'success',
        actions: assign({ lastExitCode: ({ event }) => event.data.exitCode })
      },
      onError: {
        target: 'error',
        actions: assign({ error: ({ event }) => event.data })
      }
    }
  }
}
```

**Benefits:**
- Built-in timeout support
- Clean error boundaries
- Proper async handling
- Event-driven architecture

**Alternative: Pure Functions**
```typescript
states: {
  executing: {
    always: [
      {
        target: 'success',
        guard: 'commandSucceeded',
        actions: 'executeCommand'
      }
    ]
  }
}
```

**Trade-offs:**
- Pure functions simpler but lack timeout support
- Invoke pattern more complex but handles edge cases better
- Services provide better separation of concerns

### TUI Process Spawning Best Practices

#### Node.js Child Process Options
Research from Node.js documentation and community experience:

**For TUI Programs (vim, editors):**
```typescript
spawn(command, args, {
  stdio: 'inherit',        // Pass through all terminal I/O
  detached: false,         // Keep in parent process group
  shell: true,            // Allow shell syntax
  env: { ...process.env, TERM: process.env.TERM }
});
```

**For Shell Commands:**
```typescript
spawn(command, args, {
  stdio: 'pipe',          // Capture output
  shell: true,
  timeout: 30000          // 30 second timeout
});
```

#### Terminal State Preservation
Key findings from terminal application development:
- Preserve `process.stdin.setRawMode()` state
- Handle `SIGINT`, `SIGTERM`, `SIGCONT` signals
- Restore terminal state after TUI processes
- Use `process.stdout.write()` for progress indicators

### Exit Code Standards and Patterns

#### POSIX Exit Codes
Research from POSIX standards and Git practices:
- `0`: Success
- `1`: General error
- `2`: Misuse of shell builtins
- `126`: Command not executable
- `127`: Command not found
- `128`: Invalid exit argument
- `128+N`: Fatal error signal N (e.g., 130 = SIGINT)
- `255`: Exit status out of range

#### Git-Specific Exit Codes
From Git documentation:
- `0`: Success
- `1`: Error (merge conflicts, etc.)
- `128`: Fatal error
- `129`: SIGHUP
- `130`: SIGINT (Ctrl+C)

### YAML Schema Validation Approaches

#### JSON Schema vs Custom Validation vs Zod

**JSON Schema (Recommended)**
```yaml
# workflow-schema.json
{
  "type": "object",
  "properties": {
    "workflows": {
      "type": "object",
      "patternProperties": {
        "^[a-zA-Z][a-zA-Z0-9-]*$": {
          "$ref": "#/definitions/workflow"
        }
      }
    }
  },
  "definitions": {
    "workflow": {
      "type": "object",
      "properties": {
        "initial": {"type": "string"},
        "states": {"type": "object"},
        "context": {"type": "object"}
      },
      "required": ["initial", "states"]
    }
  }
}
```

**Benefits:**
- Standardized validation
- Good error messages
- Tool support (IDEs, linters)
- Language-agnostic

**Zod Alternative**
```typescript
const WorkflowSchema = z.object({
  workflows: z.record(z.object({
    initial: z.string(),
    states: z.record(z.object({
      command: z.string(),
      timeout: z.number().optional(),
      arguments: z.record(z.object({
        type: z.enum(['string', 'number', 'boolean']),
        required: z.boolean().default(false),
        default: z.any().optional()
      })).optional()
    }))
  }))
});
```

**Trade-offs:**
- JSON Schema more standard for YAML
- Zod better TypeScript integration
- Custom validation most flexible but most work

## Options Considered

### State Machine Implementation Options

#### Option 1: XState (Chosen)
**Pros:**
- Industry standard (28.8k stars)
- TypeScript native
- Visual tools and debugger
- SCXML compliant
- Active community
- Built-in persistence support (for future)

**Cons:**
- Learning curve
- Additional dependency
- Over-engineering risk for simple cases

#### Option 2: Custom State Machine
**Pros:**
- No dependencies
- Tailored to exact requirements
- Smaller bundle size
- Full control

**Cons:**
- Reinventing the wheel
- No tooling support
- Maintenance burden
- Edge case handling

#### Option 3: Simple State Pattern
**Pros:**
- Minimal complexity
- Easy to understand
- Fast implementation

**Cons:**
- Limited flexibility
- No visualization
- Hard to extend
- No standard patterns

### Process Execution Options

#### Option 1: Node.js child_process.spawn (Chosen)
**Pros:**
- Native to Node.js
- Full control over stdio
- Cross-platform
- Good signal handling

**Cons:**
- Manual error handling
- Platform differences
- Complex for simple cases

#### Option 2: execa library
**Pros:**
- Simplified API
- Better error handling
- Cross-platform consistency

**Cons:**
- Additional dependency
- Less control for TUI programs
- May not handle all edge cases

#### Option 3: shelljs
**Pros:**
- Unix-like commands in Node
- Simple API

**Cons:**
- Not designed for TUI programs
- Limited control
- Not suitable for interactive programs

### Configuration Format Options

#### Option 1: YAML (Chosen)
**Pros:**
- Human-readable
- Comments support
- Widely used for configuration
- Good tooling support

**Cons:**
- Indentation sensitivity
- Slower parsing than JSON

#### Option 2: JSON
**Pros:**
- Fast parsing
- Schema validation built-in
- Type safety

**Cons:**
- No comments
- Verbose syntax
- Less human-friendly

#### Option 3: TypeScript/JavaScript
**Pros:**
- Full type safety
- IDE support
- No parsing step

**Cons:**
- Requires compilation
- Less accessible to non-developers
- Configuration as code complexity

## Deep Dive Analysis

### Error Handling Strategies

#### Command Execution Errors
**Strategy: Immediate Failure with Clear Messages**
```typescript
const executeCommand = async (command: string, options: CommandOptions) => {
  try {
    const result = await spawnCommand(command, options);
    return {
      success: true,
      exitCode: result.exitCode,
      output: result.output
    };
  } catch (error) {
    if (error.code === 'ETIMEDOUT') {
      throw new CommandTimeoutError(command, options.timeout);
    } else if (error.code === 'ENOENT') {
      throw new CommandNotFoundError(command);
    } else {
      throw new CommandExecutionError(command, error.message);
    }
  }
};
```

**Benefits:**
- Clear error categorization
- Actionable error messages
- No retry complexity
- Predictable behavior

#### State Transition Errors
**Strategy: Fail Fast with Recovery Suggestions**
```typescript
const handleTransitionError = (error: Error, currentState: string) => {
  console.error(`❌ Error in state '${currentState}': ${error.message}`);
  
  if (error instanceof CommandTimeoutError) {
    console.error(`💡 Consider increasing timeout or checking command: ${error.command}`);
  } else if (error instanceof CommandNotFoundError) {
    console.error(`💡 Check if command exists in PATH: ${error.command}`);
  }
  
  // No automatic retry - user must decide next action
  process.exit(1);
};
```

### Timeout Implementation Approaches

#### Approach 1: Process Timeout (Chosen)
```typescript
const spawnWithTimeout = (command: string, args: string[], timeout: number) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'pipe' });
    let output = '';
    
    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new CommandTimeoutError(command, timeout));
    }, timeout);
    
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.on('close', (code) => {
      clearTimeout(timeoutId);
      resolve({ exitCode: code, output });
    });
  });
};
```

#### Approach 2: XState Built-in Timeout
```typescript
states: {
  executing: {
    invoke: {
      src: 'executeCommand',
      input: { command: context.command },
      after: {
        30000: { target: 'timeout', actions: 'handleTimeout' }
      }
    }
  }
}
```

**Decision:** Process timeout provides more control and better error messages.

### Future Persistence Design Patterns

#### Pattern 1: State Snapshots
```typescript
interface StateSnapshot {
  workflowId: string;
  currentState: string;
  context: any;
  timestamp: number;
  executionHistory: Transition[];
}

const saveSnapshot = (snapshot: StateSnapshot) => {
  // Save to file system or database
};
```

#### Pattern 2: Event Sourcing
```typescript
interface WorkflowEvent {
  id: string;
  type: string;
  timestamp: number;
  data: any;
}

const replayEvents = (events: WorkflowEvent[]) => {
  // Reconstruct state from events
};
```

**Recommendation:** Design for state snapshots initially, easier to implement and understand.

## References

### Documentation
- [XState Documentation](https://xstate.js.org/docs/)
- [Node.js Child Process](https://nodejs.org/api/child_process.html)
- [YAML Specification](https://yaml.org/spec/)
- [JSON Schema Specification](https://json-schema.org/)

### Articles and Case Studies
- [State Machines in User Interfaces](https://statecharts.github.io/)
- [Building CLI Tools with Node.js](https://nodejs.dev/learn/building-cli-tools-with-nodejs)
- [Terminal Applications Best Practices](https://github.com/termstandard/semantic-terminal)

### Community Resources
- [XState Discord Community](https://discord.gg/xstate)
- [Node.js CLI Tools Discussion](https://github.com/nodejs/node/discussions/categories/cli-tools)
- [YAML Best Practices](https://yamllint.readthedocs.io/en/stable/rules.html)

### Related Projects
- [GitHub CLI](https://cli.github.com/) - CLI architecture reference
- [Lerna](https://lerna.js.org/) - Multi-package tool execution
- [Nx](https://nx.dev/) - Task orchestration patterns