import { Command } from 'commander';
import { execSync } from 'child_process';
import * as YAML from 'yaml';
import chalk from 'chalk';
import { loadAisanityConfig } from '../utils/config';

interface OpencodeInstance {
  containerId: string;
  containerName: string;
  port: number;
  processId: number;
  elapsedTime: number;
  isValidApi: boolean;
}

interface DiscoveryResult {
  instances: OpencodeInstance[];
  mostRecent: OpencodeInstance | null;
  error?: string;
}

interface CommandOptions {
  all: boolean;
  format: 'text' | 'json' | 'yaml' | 'plain';
  filter?: string;
}

// Function to validate container ID format to prevent command injection
export function isValidContainerId(containerId: string): boolean {
  // Container IDs are typically 12 or 64 hexadecimal characters
  // Don't trim to catch trailing spaces which could be malicious
  return /^[a-f0-9]{12,64}$/i.test(containerId) && containerId.length >= 12 && containerId.length <= 64;
}

// Function to check if port serves opencode API
function isOpencodeApi(containerId: string, port: number): boolean {
  if (!isValidContainerId(containerId)) {
    return false;
  }

  try {
    const result = execSync(`docker exec ${containerId} curl -s "http://localhost:${port}/config"`, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 5000
    });

    // Parse and validate the response content
    try {
      const response = JSON.parse(result.trim());
      // Check if it has expected opencode API structure
      return response && typeof response === 'object' && (
        'version' in response || 
        'config' in response || 
        'status' in response ||
        '$schema' in response ||
        'theme' in response ||
        'keybinds' in response
      );
    } catch (parseError) {
      // If not valid JSON, check if it's a valid response (e.g., HTML with expected content)
      return result.trim().length > 0 && !result.includes('404') && !result.includes('Not Found');
    }
  } catch (error) {
    return false;
  }
}

// Function to convert elapsed time to seconds
export function elapsedToSeconds(time: string): number {
  // Handle HH:MM:SS format
  let match = time.match(/^(\d+):(\d+):(\d+)$/);
  if (match) {
    const [, hours, minutes, seconds] = match;
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
  }

  // Handle MM:SS format
  match = time.match(/^(\d+):(\d+)$/);
  if (match) {
    const [, minutes, seconds] = match;
    return parseInt(minutes) * 60 + parseInt(seconds);
  }

  // Handle SS format
  match = time.match(/^(\d+)$/);
  if (match) {
    return parseInt(match[1]);
  }

  return 0;
}

// Function to get container name
function getContainerName(containerId: string): string {
  if (!isValidContainerId(containerId)) {
    return containerId;
  }

  try {
    const output = execSync(`docker inspect ${containerId} --format '{{.Name}}'`, {
      encoding: 'utf8',
      timeout: 5000
    });
    return output.trim().replace(/^\//, '');
  } catch (error) {
    return containerId;
  }
}

// Main discovery function
async function discoverOpencodeInstances(options: CommandOptions): Promise<DiscoveryResult> {
  const instances: OpencodeInstance[] = [];

  try {
    const cwd = process.cwd();
    const config = loadAisanityConfig(cwd);

    if (!config) {
      return { instances: [], mostRecent: null, error: 'No .aisanity config found. Run "aisanity init" first.' };
    }

    const containerName = config.containerName || `aisanity-${config.workspace}`;

    // Find containers with opencode processes
    console.log('Finding opencode instances...');

    const containerIdsSet = new Set<string>();

    // Get main container
    try {
      const mainOutput = execSync(`docker ps -q --filter "name=${containerName}"`, { encoding: 'utf8', timeout: 10000 });
      mainOutput.trim().split('\n').filter(id => id.length > 0).forEach(id => containerIdsSet.add(id));
    } catch (error) {
      // No main container
    }

    // Get devcontainer
    try {
      const devOutput = execSync(`docker ps -q --filter "label=devcontainer.local_folder=${cwd}"`, { encoding: 'utf8', timeout: 10000 });
      devOutput.trim().split('\n').filter(id => id.length > 0).forEach(id => containerIdsSet.add(id));
    } catch (error) {
      // No devcontainer
    }

    const containerIds = Array.from(containerIdsSet);

    if (containerIds.length === 0) {
      return { instances: [], mostRecent: null, error: 'No running containers found' };
    }

    // Filter containers that have opencode processes
    const containersWithOpencode: string[] = [];

    for (const containerId of containerIds) {
      if (!isValidContainerId(containerId)) {
        continue;
      }

      try {
        execSync(`docker exec ${containerId} ps aux | grep -q opencode`, {
          stdio: 'pipe',
          timeout: 5000
        });
        containersWithOpencode.push(containerId);
      } catch (error) {
        // No opencode process in this container
      }
    }

    if (containersWithOpencode.length === 0) {
      return { instances: [], mostRecent: null, error: 'No containers with opencode processes found' };
    }

    // Process each container
    for (const containerId of containersWithOpencode) {
      const containerName = getContainerName(containerId);

      // Apply filter if specified
      if (options.filter && !containerName.includes(options.filter)) {
        continue;
      }

      try {
        // Get opencode processes
        const processesOutput = execSync(`docker exec ${containerId} ps -eo pid,etime,cmd`, {
          encoding: 'utf8',
          timeout: 5000
        });
        const processes = processesOutput
          .split('\n')
          .filter(line => line.includes('opencode') && !line.includes('tui-') && !line.includes('grep'))
          .map(line => {
            const match = line.trim().match(/^\s*(\d+)\s+([^ ]+)\s+(.+)$/);
            if (match) {
              return {
                pid: parseInt(match[1]),
                elapsed: match[2],
                cmd: match[3]
              };
            }
            return null;
          })
          .filter((process): process is NonNullable<typeof process> => process !== null);

        if (processes.length === 0) continue;

        // Get listening ports
        const portsOutput = execSync(`docker exec ${containerId} netstat -tlnp 2>/dev/null`, {
          encoding: 'utf8',
          timeout: 5000
        });
        const ports = portsOutput
          .split('\n')
          .filter(line => line.includes('LISTEN') && line.includes('127.0.0.1:'))
          .map(line => {
            const match = line.match(/127\.0\.0\.1:(\d+)/);
            return match ? parseInt(match[1]) : null;
          })
          .filter(Boolean) as number[];

        if (ports.length === 0) continue;

        // Check each port
        for (const port of ports) {
          if (isOpencodeApi(containerId, port)) {
            console.log(`Found opencode API in container ${containerName} on port ${port}`);

            // Find the most recent process for this port
            let mostRecentProcess = null;
            let lowestElapsed = Infinity;

            for (const process of processes) {
              const elapsedSeconds = elapsedToSeconds(process.elapsed);
              if (elapsedSeconds < lowestElapsed) {
                lowestElapsed = elapsedSeconds;
                mostRecentProcess = process;
              }
            }

            if (mostRecentProcess) {
              const instance: OpencodeInstance = {
                containerId,
                containerName,
                port,
                processId: mostRecentProcess.pid,
                elapsedTime: lowestElapsed,
                isValidApi: true
              };

              instances.push(instance);
            }
          }
        }
      } catch (error) {
        // Skip containers that can't be inspected
        continue;
      }
    }

    if (instances.length === 0) {
      return { instances: [], mostRecent: null, error: 'No opencode API instances found' };
    }

    // Sort by elapsed time (most recent first)
    instances.sort((a, b) => a.elapsedTime - b.elapsedTime);

    const mostRecent = instances[0];

    return { instances, mostRecent };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { instances: [], mostRecent: null, error: `Discovery failed: ${errorMessage}` };
  }
}

// Output formatting functions
export function formatText(result: DiscoveryResult, showAll: boolean = false): string {
  if (result.error) {
    return chalk.red(`Error: ${result.error}`);
  }

  if (result.instances.length === 0) {
    return chalk.yellow('No opencode instances found');
  }

  let output = '';

  if (showAll) {
    output += chalk.green(`Found ${result.instances.length} opencode instance(s):\n\n`);
    result.instances.forEach((instance, index) => {
      output += chalk.blue(`Instance ${index + 1}:\n`);
      output += `  Container: ${instance.containerName}\n`;
      output += `  Port: ${instance.port}\n`;
      output += `  Age: ${instance.elapsedTime} seconds\n`;
      output += `  Host:Port: localhost:${instance.port}\n\n`;
    });
  } else {
    if (!result.mostRecent) {
      return chalk.yellow('No opencode instances found');
    }

    output += chalk.green('Most recent opencode instance:\n');
    output += `  Container: ${result.mostRecent.containerName}\n`;
    output += `  Port: ${result.mostRecent.port}\n`;
    output += `  Age: ${result.mostRecent.elapsedTime} seconds\n`;
    output += `  Host:Port: localhost:${result.mostRecent.port}\n`;

    if (result.instances.length > 1) {
      output += `\nOther instances found: ${result.instances.length - 1}\n`;
    }
  }

  return output;
}

export function formatPlain(result: DiscoveryResult): string {
  if (result.mostRecent) {
    return `localhost:${result.mostRecent.port}`;
  }
  return '';
}

export const discoverOpencodeCommand = new Command('discover-opencode')
  .description('Dynamically discover opencode instances running in Docker containers')
  .option('-a, --all', 'Return all discovered instances instead of just the most recent')
  .option('-f, --format <format>', 'Output format (text, json, yaml, plain)', 'text')
  .option('--filter <pattern>', 'Filter containers by name or label')
  .action(async (options) => {
    try {
      const result = await discoverOpencodeInstances(options);

      switch (options.format) {
        case 'json':
          console.log(JSON.stringify(result, null, 2));
          break;
        case 'yaml':
          console.log(YAML.stringify(result));
          break;
        case 'plain':
          console.log(formatPlain(result));
          break;
        default: // text format
          console.log(formatText(result, options.all));
          break;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red('Error discovering opencode instances:'), errorMessage);
      process.exit(1);
    }
  });