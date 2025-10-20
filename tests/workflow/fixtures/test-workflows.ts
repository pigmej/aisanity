/**
 * Test workflow fixtures for FSM unit tests
 * Provides pre-defined workflow structures for testing
 */

import { Workflow } from '../../../src/workflow/interfaces';

/**
 * Simple linear workflow with two states
 */
export const simpleWorkflow: Workflow = {
  name: 'test-simple',
  initialState: 'start',
  states: {
    start: {
      command: 'echo "hello"',
      transitions: { success: 'end' }
    },
    end: {
      command: 'echo "done"',
      transitions: {}
    }
  }
};

/**
 * Branching workflow with success and failure paths
 */
export const branchingWorkflow: Workflow = {
  name: 'test-branching',
  initialState: 'check',
  states: {
    check: {
      command: 'test -f file.txt',
      transitions: {
        success: 'process',
        failure: 'create'
      }
    },
    create: {
      command: 'touch file.txt',
      transitions: { success: 'process' }
    },
    process: {
      command: 'cat file.txt',
      transitions: {}
    }
  }
};

/**
 * Circular workflow (should trigger warnings)
 */
export const circularWorkflow: Workflow = {
  name: 'test-circular',
  initialState: 'a',
  states: {
    a: {
      command: 'echo "a"',
      transitions: { success: 'b' }
    },
    b: {
      command: 'echo "b"',
      transitions: { success: 'c' }
    },
    c: {
      command: 'echo "c"',
      transitions: { success: 'a' }
    }
  }
};

/**
 * Workflow with unreachable state
 */
export const unreachableStateWorkflow: Workflow = {
  name: 'test-unreachable',
  initialState: 'start',
  states: {
    start: {
      command: 'echo "start"',
      transitions: { success: 'end' }
    },
    unreachable: {
      command: 'echo "never reached"',
      transitions: {}
    },
    end: {
      command: 'echo "end"',
      transitions: {}
    }
  }
};

/**
 * Invalid workflow with missing initial state
 */
export const invalidInitialStateWorkflow: Workflow = {
  name: 'test-invalid-initial',
  initialState: 'nonexistent',
  states: {
    start: {
      command: 'echo "start"',
      transitions: {}
    }
  }
};

/**
 * Invalid workflow with invalid transition target
 */
export const invalidTransitionWorkflow: Workflow = {
  name: 'test-invalid-transition',
  initialState: 'start',
  states: {
    start: {
      command: 'echo "start"',
      transitions: { success: 'nonexistent' }
    }
  }
};

/**
 * Complex workflow with multiple paths
 */
export const complexWorkflow: Workflow = {
  name: 'test-complex',
  initialState: 'init',
  states: {
    init: {
      command: 'echo "init"',
      transitions: {
        success: 'build',
        failure: 'error'
      }
    },
    build: {
      command: 'npm run build',
      transitions: {
        success: 'test',
        failure: 'cleanup'
      }
    },
    test: {
      command: 'npm test',
      transitions: {
        success: 'deploy',
        failure: 'cleanup'
      }
    },
    deploy: {
      command: 'npm run deploy',
      transitions: {
        success: 'complete',
        failure: 'rollback'
      }
    },
    rollback: {
      command: 'npm run rollback',
      transitions: { success: 'cleanup' }
    },
    cleanup: {
      command: 'npm run clean',
      transitions: { success: 'complete' }
    },
    error: {
      command: 'echo "Error occurred"',
      transitions: {}
    },
    complete: {
      command: 'echo "Complete"',
      transitions: {}
    }
  }
};
