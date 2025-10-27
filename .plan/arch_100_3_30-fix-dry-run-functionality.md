# Dry-Run Functionality Architecture

## Context Analysis

### Problem Statement
The current dry-run functionality in the CLI command integration (Task 100_3_20) is incomplete and returns "undefined" values instead of providing a meaningful execution preview. Users need a comprehensive preview showing what would be executed without actually running commands.

### Current State Analysis
- **StateMachine**: Has execution logic but lacks dry-run simulation methods
- **CLI Integration**: Dry-run flag exists but only shows basic placeholder messages
- **Template System**: Variables are processed but not displayed in dry-run mode
- **Execution Context**: Contains workflow data but not leveraged for preview

### Architectural Gap
The system needs a dedicated dry-run simulation capability that can:
- Generate execution plans without command execution
- Simulate state transitions based on workflow logic
- Display processed template variables and context
- Provide timing estimates and execution flow

## Technology Recommendations

### **IMPORTANT**: Reuse Existing Technology Stack
- **FSM Engine**: Extend existing StateMachine with dry-run simulation methods
- **Template System**: Leverage existing ArgumentTemplater for variable preview
- **CLI Framework**: Use existing commander integration with enhanced output
- **Terminal Colors**: Utilize picocolors for color-coded dry-run output
- **Process Execution**: No actual execution in dry-run mode

### **IMPORTANT**: No New Dependencies
- Maintain existing dependency-free approach
- Extend current interfaces rather than introducing new abstractions
- Reuse validation and parsing infrastructure

## System Architecture

### Core Components

#### 1. DryRunSimulator (New Component)
- **Purpose**: Simulate workflow execution without running commands
- **Responsibilities**:
  - Generate execution path based on workflow transitions
  - Calculate estimated timing for each state
  - Process template variables in simulation context
  - Build comprehensive execution preview

#### 2. Enhanced StateMachine
- **New Methods**:
  - `simulateExecution()`: Generate dry-run execution plan
  - `getExecutionPlan()`: Return state-by-state breakdown
  - `estimateTiming()`: Calculate expected durations

#### 3. Enhanced CLI Integration
- **Enhanced Reporting**: Rich dry-run output with structured data
- **Color Coding**: Visual indicators for different execution elements
- **Progress Simulation**: Show estimated progress through workflow

### Data Flow Architecture

```
CLI Command → StateMachine.simulateExecution() → DryRunSimulator → Enhanced Output
     ↓
Template Variables → Execution Context → Preview Display
     ↓
Workflow Definition → Execution Plan → State-by-State Breakdown
```

## Integration Patterns

### **IMPORTANT**: Non-Intrusive Integration
- Dry-run mode should not affect normal execution paths
- Simulation logic should be isolated from actual execution
- Existing StateMachine methods remain unchanged

### **IMPORTANT**: Template Variable Access
- Leverage existing `ExecutionContext.variables` for template preview
- Process variables through existing ArgumentTemplater
- Display variable substitution in dry-run output

### **IMPORTANT**: Execution Plan Generation
- Use workflow structure to predict execution path
- Consider all possible transition paths (success/failure)
- Estimate timing based on command complexity

## Implementation Guidance

### Phase 1: Core Dry-Run Simulation
1. **Add `simulateExecution()` method to StateMachine**
   - Generate execution path based on workflow transitions
   - Process template variables in simulation context
   - Return structured execution plan

2. **Create DryRunSimulator class**
   - Handle state-by-state simulation
   - Calculate timing estimates
   - Build comprehensive preview data

3. **Enhance CLI reporting**
   - Format dry-run output with color coding
   - Show template variable substitutions
   - Display execution flow and timing estimates

### Phase 2: Enhanced Preview Features
1. **Add progress indicators**
   - Show estimated progress through workflow
   - Color-code different state types
   - Highlight potential failure paths

2. **Improve timing estimates**
   - Use command complexity for better estimates
   - Consider confirmation timeouts
   - Account for transition delays

### **IMPORTANT**: Security Considerations
- Template variable preview should not expose sensitive data
- Command preview should show sanitized output
- Prevent information leakage in dry-run mode

### **IMPORTANT**: Performance Requirements
- Dry-run execution should be faster than actual execution
- Simulation should complete in <100ms for typical workflows
- Memory footprint should remain minimal

## Critical Decisions

### **IMPORTANT**: Simulation vs. Actual Execution
- **Decision**: Dry-run should simulate execution path but not run commands
- **Rationale**: Maintains safety while providing useful preview
- **Impact**: Users get execution plan without side effects

### **IMPORTANT**: Template Variable Processing
- **Decision**: Process variables in dry-run mode for accurate preview
- **Rationale**: Shows users exactly what substitutions would occur
- **Impact**: More accurate execution preview

### **IMPORTANT**: Timing Estimation Strategy
- **Decision**: Use command-based timing estimates rather than fixed values
- **Rationale**: Provides more realistic execution preview
- **Impact**: Better user expectation setting

## Expected Outcomes

### User Experience
- `aisanity state execute <workflow> --dry-run` shows comprehensive preview
- Clear indication of what commands would run
- Template variable substitutions displayed
- Estimated timing and execution flow

### Technical Outcomes
- Complete dry-run functionality integrated with existing FSM
- No impact on normal execution performance
- Maintains existing security and validation patterns
- Extensible for future enhancements

## Success Metrics
- Dry-run output includes all required information (finalState, totalDuration, execution plan)
- No "undefined" values in dry-run output
- Users can make informed decisions based on dry-run preview
- Performance remains within acceptable limits (<100ms for simulation)