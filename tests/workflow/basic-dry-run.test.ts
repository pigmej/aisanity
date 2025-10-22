/**
 * Test suite for Basic Dry-Run Functionality
 * Tests the basic dry-run implementation in CLI commands
 */

import { describe, test, expect, jest } from '@jest/globals';
import { executeStateOrWorkflow } from '../../src/commands/state';
import { StateMachine } from '../../src/workflow/fsm';
import { Logger } from '../../src/utils/logger';

// Mock dependencies
jest.mock('../../src/workflow/fsm');
jest.mock('../../src/utils/logger');

describe('Basic Dry-Run CLI Integration', () => {
  let mockStateMachine: jest.Mocked<StateMachine>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockLogger = new Logger(false, false) as jest.Mocked<Logger>;
    mockStateMachine = {
      getContext: jest.fn().mockReturnValue({
        variables: { testVar: 'testValue' }
      }),
      simulateExecution: jest.fn().mockResolvedValue({
        success: true,
        finalState: 'complete',
        totalDuration: 5000,
        executionPlan: [
          {
            stateName: 'start',
            description: 'Start state',
            rawCommand: 'echo',
            processedCommand: 'echo',
            rawArgs: ['Starting workflow'],
            processedArgs: ['Starting workflow'],
            estimatedDuration: 1000,
            durationConfidence: 'high',
            isTerminal: false,
            requiresConfirmation: false,
            substitutions: {},
            hasSubstitutions: false
          }
        ],
        executionPath: ['start'],
        templateVariables: { testVar: 'testValue' },
        processedSubstitutions: {},
        warnings: [],
        estimatedComplexity: 'low',
        hasConfirmationPrompts: false,
        totalConfirmations: 0
      })
    } as jest.Mocked<StateMachine>;
  });

  test('should handle dry-run flag and call simulateExecution', async () => {
    const options = { dryRun: true, yes: false };
    
    await executeStateOrWorkflow(
      mockStateMachine,
      'start',
      options,
      mockLogger
    );

    expect(mockStateMachine.simulateExecution).toHaveBeenCalledWith({
      startingState: 'start',
      templateVariables: { testVar: 'testValue' },
      includeTimingEstimates: true,
      includeWarnings: true,
      assumeSuccess: true
    });
  });

  test('should return structured DryRunResult from dry-run execution', async () => {
    const options = { dryRun: true, yes: false };
    
    const result = await executeStateOrWorkflow(
      mockStateMachine,
      'start',
      options,
      mockLogger
    );

    expect(result).toMatchObject({
      success: true,
      finalState: 'complete',
      totalDuration: 5000,
      executionPlan: expect.any(Array),
      executionPath: expect.any(Array),
      templateVariables: expect.any(Object),
      warnings: expect.any(Array),
      hasConfirmationPrompts: false
    });
  });

  test('should fall back to basic dry-run on simulation error', async () => {
    mockStateMachine.simulateExecution.mockRejectedValueOnce(new Error('Simulation failed'));
    
    const options = { dryRun: true, yes: false };
    
    const result = await executeStateOrWorkflow(
      mockStateMachine,
      'start',
      options,
      mockLogger
    );

    expect(result).toMatchObject({
      success: true,
      message: 'Basic dry run completed'
    });
  });

  test('should execute normally when dry-run is not specified', async () => {
    const options = { dryRun: false, yes: false };
    
    // Mock executeState to return a basic result
    mockStateMachine.executeState = jest.fn().mockResolvedValue({
      stateName: 'start',
      exitCode: 0,
      executedAt: new Date(),
      duration: 1000,
      output: 'State executed'
    });

    const result = await executeStateOrWorkflow(
      mockStateMachine,
      'start',
      options,
      mockLogger
    );

    expect(result).toMatchObject({
      stateName: 'start',
      exitCode: 0
    });
  });

  test('should handle workflow execution when no state specified', async () => {
    const options = { dryRun: false, yes: false };
    
    // Mock execute to return a basic result
    mockStateMachine.execute = jest.fn().mockResolvedValue({
      success: true,
      finalState: 'complete',
      stateHistory: [],
      totalDuration: 5000
    });

    const result = await executeStateOrWorkflow(
      mockStateMachine,
      undefined,
      options,
      mockLogger
    );

    expect(result).toMatchObject({
      success: true,
      finalState: 'complete'
    });
  });
});

export {};