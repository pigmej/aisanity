/**
 * Logger helper utilities for formatting debug and verbose output
 * Separates user-facing information from system-level debugging
 */

import { DockerContainer } from './container-utils';
import { WorktreeValidationResult } from './container-utils';

/**
 * Format user-facing orphaned container information
 * Use this for --verbose output to show containers without worktrees
 * 
 * @param containers - Array of orphaned containers
 * @param validationResults - Map of container validation results
 * @returns Formatted string for verbose output
 */
export function formatOrphanedContainerInfo(
  containers: DockerContainer[],
  validationResults: Map<string, WorktreeValidationResult>
): string {
  if (containers.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('\nOrphaned containers:');
  
  for (const container of containers) {
    const validation = validationResults.get(container.id);
    lines.push(`  - ${container.name} (${container.status})`);
    lines.push(`    Workspace: ${validation?.workspacePath || 'unknown'}`);
    lines.push(`    Reason: ${validation?.error || 'Worktree directory not found'}`);
  }
  
  return lines.join('\n');
}

/**
 * Format debug-level discovery statistics
 * Use this for --debug output to show system internals
 * 
 * @param metadata - Discovery metadata with counts and timing
 * @param duration - Duration of discovery in milliseconds
 * @returns Formatted string for debug output
 */
export function formatDiscoveryDebugInfo(
  metadata: {
    totalDiscovered: number;
    labeledCount: number;
    unlabeledCount: number;
    orphanedCount: number;
  },
  duration: number
): string {
  const lines: string[] = [];
  lines.push(`[Discovery] Completed in ${duration}ms`);
  lines.push(
    `[Discovery] Total: ${metadata.totalDiscovered}, Labeled: ${metadata.labeledCount}, Unlabeled: ${metadata.unlabeledCount}, Orphaned: ${metadata.orphanedCount}`
  );
  return lines.join('\n');
}

/**
 * Format validation summary for debug output
 * Use this for --debug output to show validation details
 * 
 * @param validationResults - Map of container validation results
 * @returns Formatted string for debug output
 */
export function formatValidationDebugInfo(
  validationResults: Map<string, WorktreeValidationResult>
): string {
  const validCount = Array.from(validationResults.values()).filter(v => v.isValid).length;
  const invalidCount = validationResults.size - validCount;
  
  return `[Validation] Validated ${validationResults.size} worktrees (${validCount} valid, ${invalidCount} invalid)`;
}
