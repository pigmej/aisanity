import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

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
}

export async function generateStats(options: StatsOptions): Promise<void> {
  try {
    const days = parseInt(options.days, 10);
    if (isNaN(days) || days < 1) {
      console.error('Error: --days must be a positive number');
      process.exit(1);
    }

    const opencodeStoragePath = path.join(process.env.HOME || '', '.local', 'share', 'opencode', 'storage', 'message');
    
    // Validate OpenCode storage directory exists
    if (!fs.existsSync(opencodeStoragePath)) {
      console.error('Error: OpenCode storage directory not found');
      console.error(`Expected at: ${opencodeStoragePath}`);
      console.error('Please ensure OpenCode is installed and has been used at least once');
      process.exit(1);
    }

    // Get all JSON files in the message directory and subdirectories
    const files: string[] = [];
    
    function findJsonFiles(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          findJsonFiles(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          files.push(fullPath);
        }
      }
    }
    
    findJsonFiles(opencodeStoragePath);

    if (files.length === 0) {
      console.log('No OpenCode message files found');
      return;
    }

    console.log(`Processing OpenCode message files...`);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    cutoffDate.setHours(0, 0, 0, 0);

    const dailyStatsMap = new Map<string, DailyStats>();
    let processedFiles = 0;
    let skippedFiles = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        // Check file size before parsing (limit to 1MB)
        const stats = fs.statSync(file);
        if (stats.size > 1024 * 1024) { // 1MB limit
          skippedFiles++;
          continue;
        }

        const content = fs.readFileSync(file, 'utf8');
        let messageData: MessageData;
        try {
          messageData = JSON.parse(content) as MessageData;
        } catch (parseError) {
          skippedFiles++;
          continue;
        }

        // Only process assistant messages with token data
        if (messageData.role !== 'assistant' || !messageData.tokens || !messageData.time || !messageData.time.created) {
          skippedFiles++;
          continue;
        }

        // Validate timestamp
        let timestamp: Date;
        try {
          timestamp = new Date(messageData.time.created);
          if (isNaN(timestamp.getTime())) {
            skippedFiles++;
            continue;
          }
        } catch {
          skippedFiles++;
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
      }

      // Show progress more frequently (every 10 files or for the last file)
      if ((i + 1) % 10 === 0 || i === files.length - 1) {
        console.log(`Processed ${i + 1} of ${files.length} files`);
      }
    }

    if (processedFiles === 0) {
      console.log(`No messages found in the last ${days} days`);
      return;
    }

    // Convert map to array and sort
    const dailyStats = Array.from(dailyStatsMap.values())
      .sort((a, b) => {
        // Sort by date (newest first) then by model name
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date);
        }
        return a.model.localeCompare(b.model);
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
    displayStats(dailyStats, summary, days, skippedFiles);

  } catch (error) {
    console.error('Failed to generate stats:', error);
    process.exit(1);
  }
}

export const statsCommand = new Command('stats')
  .description('Display OpenCode usage statistics')
  .option('--days <number>', 'Number of days to show (default: 30)', '30')
  .action(async (options) => {
    await generateStats(options);
  });

function displayStats(dailyStats: DailyStats[], summary: SummaryStats, days: number, skippedFiles: number): void {
  console.log(`\nOpenCode Usage Statistics (Last ${days} days)`);
  console.log(`Processed ${summary.processedFiles.toLocaleString()} messages from ${summary.totalFiles.toLocaleString()} total files`);
  if (skippedFiles > 0) {
    console.log(`Skipped ${skippedFiles.toLocaleString()} files due to errors or missing data`);
  }
  console.log('');

  // Table header
  const header = [
    'Date       ',
    'Model                    ',
    'Messages ',
    'Input    ',
    'Output   ',
    'Reasoning ',
    'Total    ',
    'Cost     '
  ];
  
  console.log(header.join(' | '));
  console.log('─'.repeat(header.join(' | ').length));

  // Table rows
  dailyStats.forEach(stats => {
    const row = [
      stats.date,
      stats.model.padEnd(24, ' '),
      stats.messageCount.toString().padStart(8, ' '),
      formatNumber(stats.totalInputTokens).padStart(8, ' '),
      formatNumber(stats.totalOutputTokens).padStart(8, ' '),
      formatNumber(stats.totalReasoningTokens).padStart(9, ' '),
      formatNumber(stats.totalTokens).padStart(8, ' '),
      formatCost(stats.totalCost).padStart(8, ' ')
    ];
    console.log(row.join(' | '));
  });

  // Summary separator
  console.log('─'.repeat(header.join(' | ').length));

  // Summary row
  const summaryRow = [
    'TOTAL      ',
    '                         ',
    summary.totalMessages.toString().padStart(8, ' '),
    formatNumber(summary.totalInputTokens).padStart(8, ' '),
    formatNumber(summary.totalOutputTokens).padStart(8, ' '),
    formatNumber(summary.totalReasoningTokens).padStart(9, ' '),
    formatNumber(summary.totalTokens).padStart(8, ' '),
    formatCost(summary.totalCost).padStart(8, ' ')
  ];
  console.log(summaryRow.join(' | '));
  console.log('');
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}