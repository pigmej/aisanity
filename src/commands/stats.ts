import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { createLoggerFromCommandOptions } from '../utils/logger';

interface MessageData {
  id?: string;
  role?: string;
  tokens?: {
    input?: string;
    output?: string;
    reasoning?: string;
  };
  cost?: string;
  modelID?: string;
  time?: {
    created?: string;
  };
}

interface DailyStats {
  date: string; // YYYY-MM-DD format
  model: string;
  messageCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalReasoningTokens: number;
  totalTokens: number;
  totalCost: number;
}

interface SummaryStats {
  totalMessages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalReasoningTokens: number;
  totalTokens: number;
  totalCost: number;
  processedFiles: number;
  totalFiles: number;
}

interface StatsOptions {
  days: string;
  sort?: string;
  model?: string;
  verbose?: boolean;
}

export async function generateStats(options: StatsOptions): Promise<void> {
  try {
    const days = parseInt(options.days, 10);
    if (isNaN(days) || days < 1) {
      console.error('Error: --days must be a positive number');
      process.exit(1);
    }

    const home = process.env.HOME;
    if (!home) {
      console.error('Error: HOME environment variable not set');
      process.exit(1);
    }
    
    const opencodeStoragePath = path.join(home, '.local', 'share', 'opencode', 'storage', 'message');
    
    // Validate OpenCode storage directory exists
    if (!fs.existsSync(opencodeStoragePath)) {
      console.error('Error: OpenCode storage directory not found');
      console.error(`Expected at: ${opencodeStoragePath}`);
      console.error('Please ensure OpenCode is installed and has been used at least once');
      process.exit(1);
    }

    // Get all JSON files in the message directory and subdirectories
    const files: string[] = [];
    
    function findJsonFiles(dir: string, depth = 0, maxDepth = 10) {
      if (depth > maxDepth) {
        console.warn(`Warning: Maximum directory depth (${maxDepth}) reached at ${dir}`);
        return;
      }
      
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            findJsonFiles(fullPath, depth + 1, maxDepth);
          } else if (entry.isFile() && entry.name.endsWith('.json')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        console.warn(`Warning: Cannot read directory ${dir}: ${error}`);
      }
    }
    
    findJsonFiles(opencodeStoragePath);

    if (files.length === 0) {
      console.log('No OpenCode message files found');
      return;
    }

    console.log(`Processing OpenCode message files...`);
    
    const cutoffDate = new Date();
    
    if (days === 1) {
      // For 1 day, only include today's data starting from 00:00:00
      cutoffDate.setHours(0, 0, 0, 0);
    } else {
      // For multiple days, include data from (days) days ago at 00:00:00
      cutoffDate.setDate(cutoffDate.getDate() - days);
      cutoffDate.setHours(0, 0, 0, 0);
    }

    const dailyStatsMap = new Map<string, DailyStats>();
    let processedFiles = 0;
    let skippedFiles = 0;
    let skipReasons = {
      fileTooLarge: 0,
      parseError: 0,
      invalidRole: 0,
      missingData: 0,
      invalidTimestamp: 0,
      negativeTokens: 0,
      otherError: 0
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        // Check file size before parsing (limit to 1MB)
        const stats = fs.statSync(file);
        if (stats.size > 1024 * 1024) { // 1MB limit
          skippedFiles++;
          skipReasons.fileTooLarge++;
          if (options.verbose) {
            console.warn(`Skipped ${file}: File too large (${stats.size} bytes)`);
          }
          continue;
        }

        const content = fs.readFileSync(file, 'utf8');
        let messageData: MessageData;
        try {
          messageData = JSON.parse(content) as MessageData;
        } catch (parseError) {
          skippedFiles++;
          skipReasons.parseError++;
          if (options.verbose) {
            console.warn(`Skipped ${file}: JSON parse error`);
          }
          continue;
        }

        // Only process assistant messages with token data
        if (messageData.role !== 'assistant') {
          skippedFiles++;
          skipReasons.invalidRole++;
          if (options.verbose) {
            console.warn(`Skipped ${file}: Not an assistant message (role: ${messageData.role})`);
          }
          continue;
        }

        if (!messageData.tokens || !messageData.time || !messageData.time.created) {
          skippedFiles++;
          skipReasons.missingData++;
          if (options.verbose) {
            console.warn(`Skipped ${file}: Missing required data (tokens or timestamp)`);
          }
          continue;
        }

        // Validate timestamp
        let timestamp: Date;
        try {
          timestamp = new Date(messageData.time.created);
          if (isNaN(timestamp.getTime())) {
            skippedFiles++;
            skipReasons.invalidTimestamp++;
            if (options.verbose) {
              console.warn(`Skipped ${file}: Invalid timestamp (${messageData.time.created})`);
            }
            continue;
          }
        } catch {
          skippedFiles++;
          skipReasons.invalidTimestamp++;
          if (options.verbose) {
            console.warn(`Skipped ${file}: Invalid timestamp format`);
          }
          continue;
        }

        if (timestamp < cutoffDate) {
          continue;
        }

        const dateStr = timestamp.toISOString().split('T')[0];
        const model = messageData.modelID || 'unknown';
        const key = `${dateStr}|${model}`;

        // Validate and parse token counts
        const inputTokens = messageData.tokens.input ? parseInt(messageData.tokens.input) || 0 : 0;
        const outputTokens = messageData.tokens.output ? parseInt(messageData.tokens.output) || 0 : 0;
        const reasoningTokens = messageData.tokens.reasoning ? parseInt(messageData.tokens.reasoning) || 0 : 0;
        const cost = messageData.cost ? parseFloat(messageData.cost) || 0 : 0;

        // Additional validation for token counts
        if (inputTokens < 0 || outputTokens < 0 || reasoningTokens < 0 || cost < 0) {
          skippedFiles++;
          skipReasons.negativeTokens++;
          if (options.verbose) {
            console.warn(`Skipped ${file}: Negative token counts or cost`);
          }
          continue;
        }

        if (dailyStatsMap.has(key)) {
          const stats = dailyStatsMap.get(key)!;
          stats.messageCount++;
          stats.totalInputTokens += inputTokens;
          stats.totalOutputTokens += outputTokens;
          stats.totalReasoningTokens += reasoningTokens;
          stats.totalTokens += inputTokens + outputTokens + reasoningTokens;
          stats.totalCost += cost;
        } else {
          dailyStatsMap.set(key, {
            date: dateStr,
            model,
            messageCount: 1,
            totalInputTokens: inputTokens,
            totalOutputTokens: outputTokens,
            totalReasoningTokens: reasoningTokens,
            totalTokens: inputTokens + outputTokens + reasoningTokens,
            totalCost: cost
          });
        }

        processedFiles++;
      } catch (error) {
        skippedFiles++;
        skipReasons.otherError++;
        if (options.verbose) {
          console.warn(`Skipped ${file}: Unexpected error - ${error}`);
        }
      }
    }

    if (processedFiles === 0) {
      console.log(`No messages found in the last ${days} days`);
      return;
    }

    // Convert map to array
    let dailyStats = Array.from(dailyStatsMap.values());

    // Apply model filter if specified
    if (options.model) {
      dailyStats = dailyStats.filter(stats => 
        stats.model.toLowerCase().includes(options.model!.toLowerCase())
      );
    }

    // Apply sorting
    const sortField = options.sort?.toLowerCase() || 'date';
    dailyStats.sort((a, b) => {
      switch (sortField) {
        case 'model':
          return a.model.localeCompare(b.model);
        case 'messages':
          return b.messageCount - a.messageCount;
        case 'tokens':
          return b.totalTokens - a.totalTokens;
        case 'cost':
          return b.totalCost - a.totalCost;
        case 'date':
        default:
          // Default: newest first, then by model
          if (a.date !== b.date) {
            return b.date.localeCompare(a.date);
          }
          return a.model.localeCompare(b.model);
      }
    });

    // Calculate summary
    const summary: SummaryStats = {
      totalMessages: dailyStats.reduce((sum, stats) => sum + stats.messageCount, 0),
      totalInputTokens: dailyStats.reduce((sum, stats) => sum + stats.totalInputTokens, 0),
      totalOutputTokens: dailyStats.reduce((sum, stats) => sum + stats.totalOutputTokens, 0),
      totalReasoningTokens: dailyStats.reduce((sum, stats) => sum + stats.totalReasoningTokens, 0),
      totalTokens: dailyStats.reduce((sum, stats) => sum + stats.totalTokens, 0),
      totalCost: dailyStats.reduce((sum, stats) => sum + stats.totalCost, 0),
      processedFiles,
      totalFiles: files.length
    };

    // Display results
    displayStats(dailyStats, summary, days, skippedFiles, skipReasons, options);

  } catch (error) {
    console.error('Failed to generate stats:', error);
    process.exit(1);
  }
}

export const statsCommand = new Command('stats')
  .description('Display OpenCode usage statistics')
  .option('--days <number>', 'Number of days to show (default: 30)', '30')
  .option('--sort <field>', 'Sort by field: date, model, messages, tokens, cost')
  .option('--model <name>', 'Filter by specific model name')
  .option('-v, --verbose', 'Show detailed user information (container status, orphaned containers)')
  .option('-d, --debug', 'Show system debugging information (discovery process, timing)')
  .action(async (options) => {
    const logger = createLoggerFromCommandOptions(options);
    await generateStats(options);
  });

interface SkipReasons {
  fileTooLarge: number;
  parseError: number;
  invalidRole: number;
  missingData: number;
  invalidTimestamp: number;
  negativeTokens: number;
  otherError: number;
}

function displayStats(dailyStats: DailyStats[], summary: SummaryStats, days: number, skippedFiles: number, skipReasons: SkipReasons, options: StatsOptions): void {
  console.log(`\nOpenCode Usage Statistics (Last ${days} days)`);
  if (options.model) {
    console.log(`Filtered by model: ${options.model}`);
  }
  if (options.sort && options.sort !== 'date') {
    console.log(`Sorted by: ${options.sort}`);
  }
  console.log(`Processed ${summary.processedFiles.toLocaleString()} messages from ${summary.totalFiles.toLocaleString()} total files`);
  if (skippedFiles > 0) {
    console.log(`Skipped ${skippedFiles.toLocaleString()} files due to errors or missing data`);
    
    // Show detailed skip reasons in verbose mode
    if (options.verbose) {
      console.log('\nSkip reasons:');
      if (skipReasons.fileTooLarge > 0) {
        console.log(`  - File too large: ${skipReasons.fileTooLarge}`);
      }
      if (skipReasons.parseError > 0) {
        console.log(`  - JSON parse error: ${skipReasons.parseError}`);
      }
      if (skipReasons.invalidRole > 0) {
        console.log(`  - Not assistant message: ${skipReasons.invalidRole}`);
      }
      if (skipReasons.missingData > 0) {
        console.log(`  - Missing required data: ${skipReasons.missingData}`);
      }
      if (skipReasons.invalidTimestamp > 0) {
        console.log(`  - Invalid timestamp: ${skipReasons.invalidTimestamp}`);
      }
      if (skipReasons.negativeTokens > 0) {
        console.log(`  - Negative token counts: ${skipReasons.negativeTokens}`);
      }
      if (skipReasons.otherError > 0) {
        console.log(`  - Other errors: ${skipReasons.otherError}`);
      }
    }
  }
  console.log('');

  // Calculate dynamic column widths
  const maxModelLength = Math.max(
    'Model'.length,
    ...dailyStats.map(stats => stats.model.length),
    'TOTAL'.length
  );
  
  const columnWidths = {
    date: 10,
    model: Math.max(20, Math.min(40, maxModelLength + 2)),
    messages: 9,
    input: 10,
    output: 10,
    reasoning: 11,
    total: 10,
    cost: 12
  };

  // Helper function to format cells
  const formatCell = (content: string, width: number, align: 'left' | 'right' = 'left') => {
    if (align === 'right') {
      return content.padStart(width, ' ');
    }
    return content.padEnd(width, ' ');
  };

  // Table header
  const header = [
    formatCell('Date', columnWidths.date),
    formatCell('Model', columnWidths.model),
    formatCell('Messages', columnWidths.messages, 'right'),
    formatCell('Input', columnWidths.input, 'right'),
    formatCell('Output', columnWidths.output, 'right'),
    formatCell('Reasoning', columnWidths.reasoning, 'right'),
    formatCell('Total', columnWidths.total, 'right'),
    formatCell('Cost', columnWidths.cost, 'right')
  ];
  
  console.log(header.join(' | '));
  
  // Separator line
  const separator = '─'.repeat(
    columnWidths.date + columnWidths.model + columnWidths.messages + columnWidths.input + 
    columnWidths.output + columnWidths.reasoning + columnWidths.total + columnWidths.cost + 
    (7 * 3) // 7 separators * 3 characters each
  );
  console.log(separator);

  // Table rows
  dailyStats.forEach(stats => {
    const row = [
      formatCell(stats.date, columnWidths.date),
      formatCell(stats.model, columnWidths.model),
      formatCell(stats.messageCount.toString(), columnWidths.messages, 'right'),
      formatCell(formatNumber(stats.totalInputTokens), columnWidths.input, 'right'),
      formatCell(formatNumber(stats.totalOutputTokens), columnWidths.output, 'right'),
      formatCell(formatNumber(stats.totalReasoningTokens), columnWidths.reasoning, 'right'),
      formatCell(formatNumber(stats.totalTokens), columnWidths.total, 'right'),
      formatCell(formatCost(stats.totalCost), columnWidths.cost, 'right')
    ];
    console.log(row.join(' | '));
  });

  // Summary separator
  console.log(separator);

  // Summary row
  const summaryRow = [
    formatCell('TOTAL', columnWidths.date),
    formatCell('', columnWidths.model),
    formatCell(summary.totalMessages.toString(), columnWidths.messages, 'right'),
    formatCell(formatNumber(summary.totalInputTokens), columnWidths.input, 'right'),
    formatCell(formatNumber(summary.totalOutputTokens), columnWidths.output, 'right'),
    formatCell(formatNumber(summary.totalReasoningTokens), columnWidths.reasoning, 'right'),
    formatCell(formatNumber(summary.totalTokens), columnWidths.total, 'right'),
    formatCell(formatCost(summary.totalCost), columnWidths.cost, 'right')
  ];
  console.log(summaryRow.join(' | '));
  console.log('');

  // Show model breakdown if we have multiple models and not already filtered by model
  if (!options.model && dailyStats.length > 0) {
    showModelBreakdown(dailyStats, summary);
  }
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function showModelBreakdown(dailyStats: DailyStats[], summary: SummaryStats): void {
  // Group by model
  const modelStats = new Map<string, {
    messageCount: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalReasoningTokens: number;
    totalTokens: number;
    totalCost: number;
    percentage: number;
  }>();

  // Calculate totals per model
  dailyStats.forEach(stats => {
    if (modelStats.has(stats.model)) {
      const existing = modelStats.get(stats.model)!;
      existing.messageCount += stats.messageCount;
      existing.totalInputTokens += stats.totalInputTokens;
      existing.totalOutputTokens += stats.totalOutputTokens;
      existing.totalReasoningTokens += stats.totalReasoningTokens;
      existing.totalTokens += stats.totalTokens;
      existing.totalCost += stats.totalCost;
    } else {
      modelStats.set(stats.model, {
        messageCount: stats.messageCount,
        totalInputTokens: stats.totalInputTokens,
        totalOutputTokens: stats.totalOutputTokens,
        totalReasoningTokens: stats.totalReasoningTokens,
        totalTokens: stats.totalTokens,
        totalCost: stats.totalCost,
        percentage: 0
      });
    }
  });

  // Calculate percentages
  modelStats.forEach(model => {
    model.percentage = summary.totalCost > 0 
      ? (model.totalCost / summary.totalCost) * 100 
      : 0;
  });

  // Convert to array and sort by cost (highest first)
  const modelArray = Array.from(modelStats.entries())
    .map(([model, stats]) => ({ model, ...stats }))
    .sort((a, b) => b.totalCost - a.totalCost);

  if (modelArray.length > 1) {
    console.log('Model Breakdown (by cost):');
    console.log('');

    const breakdownWidths = {
      model: 30,
      messages: 10,
      tokens: 12,
      cost: 12,
      percentage: 10
    };

    const breakdownHeader = [
      'Model'.padEnd(breakdownWidths.model, ' '),
      'Messages'.padStart(breakdownWidths.messages, ' '),
      'Total Tokens'.padStart(breakdownWidths.tokens, ' '),
      'Cost'.padStart(breakdownWidths.cost, ' '),
      '%'.padStart(breakdownWidths.percentage, ' ')
    ];
    console.log(breakdownHeader.join(' | '));

    const breakdownSeparator = '─'.repeat(
      breakdownWidths.model + breakdownWidths.messages + breakdownWidths.tokens + 
      breakdownWidths.cost + breakdownWidths.percentage + (4 * 3)
    );
    console.log(breakdownSeparator);

    modelArray.forEach(model => {
      const row = [
        model.model.padEnd(breakdownWidths.model, ' '),
        model.messageCount.toString().padStart(breakdownWidths.messages, ' '),
        formatNumber(model.totalTokens).padStart(breakdownWidths.tokens, ' '),
        formatCost(model.totalCost).padStart(breakdownWidths.cost, ' '),
        `${model.percentage.toFixed(1)}%`.padStart(breakdownWidths.percentage, ' ')
      ];
      console.log(row.join(' | '));
    });
    console.log('');
  }
}