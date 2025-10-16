import { Command } from 'commander';
import * as YAML from 'yaml';
import pc from 'picocolors';
import { $ } from 'bun';
import { loadAisanityConfig, getContainerName as getAisanityContainerName } from '../utils/config';

export interface OpencodeInstance {
  containerId: string;
  containerName: string;
  host: string;
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
  verbose: boolean;
}

// Function to check if port serves opencode API
async function isOpencodeApi(containerId: string, host: string, port: number, verbose: boolean = false): Promise<boolean> {
  try {
    const result = await $`docker exec ${containerId} curl -s http://${host}:${port}/config`.text();

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

// Function to validate container ID format
export function isValidContainerId(containerId: string): boolean {
  if (!containerId || typeof containerId !== 'string') {
    return false;
  }

  // Check for invalid characters (only hex allowed, no spaces)
  if (!/^[a-f0-9]+$/i.test(containerId)) {
    return false;
  }

  // Docker container IDs are 64-character hexadecimal strings
  // But short IDs (first 12 chars) are also valid
  return containerId.length >= 12 && containerId.length <= 64;
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
async function getContainerName(containerId: string, verbose: boolean = false): Promise<string> {
  try {
    const output = await $`docker inspect ${containerId} --format {{.Name}}`.text();
    return output.trim().replace(/^\//, '');
  } catch (error) {
    return containerId;
  }
}

/**
 * Resolves the IP address of a Docker container using Docker inspect commands.
 * 
 * This function attempts to retrieve the container's IP address using two methods:
 * 1. Primary method: Uses NetworkSettings.IPAddress field for containers on default bridge network
 * 2. Fallback method: Iterates through all network interfaces to find first available IP
 * 
 * @param containerId - The Docker container ID (12-64 character hex string)
 * @param verbose - Enable verbose logging to stderr for debugging IP resolution process
 * @returns Promise<string> - Resolved IP address or empty string if resolution fails
 * 
 * @example
 * ```typescript
 * const ip = await getContainerIpAddress('abc123def456', true);
 * if (ip) {
 *   console.log(`Container IP: ${ip}`);
 * } else {
 *   console.log('Could not resolve container IP');
 * }
 * ```
 */
export async function getContainerIpAddress(containerId: string, verbose: boolean): Promise<string> {
  // Validate container ID
  if (!containerId || !isValidContainerId(containerId)) {
    if (verbose) console.error('Invalid container ID for IP resolution');
    return '';
  }

  // Log resolution attempt
  if (verbose) console.error(`Resolving IP address for container ${containerId}...`);

  try {
    // Primary method: Default IPAddress field
    const primaryResult = await $`docker inspect --format '{{.NetworkSettings.IPAddress}}' ${containerId}`.text();
    const primaryIp = primaryResult.trim();
    
    if (primaryIp && primaryIp !== '' && primaryIp !== '<no value>') {
      if (verbose) console.error(`Primary IP resolution successful: ${primaryIp}`);
      return primaryIp;
    }
    
    if (verbose) console.error('Primary IP resolution returned empty, trying fallback method...');
    
    // Fallback method: Iterate through Networks
    const fallbackResult = await $`docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${containerId}`.text();
    const fallbackIp = fallbackResult.trim();
    
    if (fallbackIp && fallbackIp !== '' && fallbackIp !== '<no value>') {
      if (verbose) console.error(`Fallback IP resolution successful: ${fallbackIp}`);
      return fallbackIp;
    }
    
    if (verbose) console.error('Both IP resolution methods returned empty');
    return '';
    
  } catch (error) {
    if (verbose) {
      console.error('IP resolution failed with error:', error instanceof Error ? error.message : String(error));
    }
    return '';
  }
}

// Main discovery function
export async function discoverOpencodeInstances(options: CommandOptions): Promise<DiscoveryResult> {
  const instances: OpencodeInstance[] = [];

  try {
    const cwd = process.cwd();
    const config = loadAisanityConfig(cwd);

    if (!config) {
      return { instances: [], mostRecent: null, error: 'No .aisanity config found. Run "aisanity init" first.' };
    }

    const containerName = getAisanityContainerName(cwd, options.verbose);

    // Find containers with opencode processes
    if (options.verbose) console.error('Finding opencode instances...');

    const containerIdsSet = new Set<string>();

     // Get main container
     try {
       const mainOutput = await $`docker ps -q --filter name=${containerName}`.text();
       mainOutput.trim().split('\n').filter((id: string) => id.length > 0).forEach((id: string) => containerIdsSet.add(id));
     } catch (error) {
       // No main container
     }

      // Get devcontainer
       try {
         const devOutput = await $`docker ps -q --filter label=devcontainer.local_folder=${cwd}`.text();
         devOutput.trim().split('\n').filter((id: string) => id.length > 0).forEach((id: string) => containerIdsSet.add(id));
       } catch (error) {
         // No devcontainer
       }

      // Get aisanity-labeled containers
      try {
        if (options.verbose) console.error(`Searching for containers with label aisanity.container=${containerName}...`);
        const labelOutput = await $`docker ps -q --filter label=aisanity.container=${containerName}`.text();
        const labeledContainers = labelOutput.trim().split('\n').filter((id: string) => id.length > 0);
        if (options.verbose && labeledContainers.length > 0) {
          console.error(`Found ${labeledContainers.length} container(s) with aisanity.container label`);
        }
        labeledContainers.forEach((id: string) => containerIdsSet.add(id));
      } catch (error) {
        if (options.verbose) console.error('Error searching for aisanity-labeled containers:', error instanceof Error ? error.message : String(error));
        // No aisanity-labeled containers
      }



    const containerIds = Array.from(containerIdsSet);

    if (containerIds.length === 0) {
      return { instances: [], mostRecent: null, error: 'No running containers found' };
    }

    // Filter containers that have opencode processes
    const containersWithOpencode: string[] = [];

     for (const containerId of containerIds) {
       try {
         const output = await $`docker exec ${containerId} ps aux`.text();
         // Check if opencode is running (excluding tui- and grep)
         const hasOpencode = output.split('\n').some((line: string) =>
           line.includes('opencode') && !line.includes('tui-') && !line.includes('grep')
         );
         if (hasOpencode) {
           containersWithOpencode.push(containerId);
         }
       } catch (error) {
         // No opencode process in this container
       }
     }

    if (containersWithOpencode.length === 0) {
      return { instances: [], mostRecent: null, error: 'No containers with opencode processes found' };
    }

    // Process each container
     for (const containerId of containersWithOpencode) {
        const containerName = await getContainerName(cwd, options.verbose);

       // Apply filter if specified
       if (options.filter && !containerName.includes(options.filter)) {
         continue;
       }

       try {
         // Get opencode processes
         const processesOutput = await $`docker exec ${containerId} ps -eo pid,etime,cmd`.text();
         const processes = processesOutput
           .split('\n')
           .filter((line: string) => line.includes('opencode') && !line.includes('tui-') && !line.includes('grep'))
           .map((line: string) => {
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
           .filter((process: any): process is NonNullable<typeof process> => process !== null);

         if (processes.length === 0) continue;

          // Get listening ports with hosts
          const portsOutput = await $`docker exec ${containerId} netstat -tlnp`.text();
          const rawListeningAddresses = portsOutput
            .split('\n')
            .filter((line: string) => line.includes('LISTEN'))
            .map((line: string) => {
              // Match patterns like "127.0.0.1:3000", "0.0.0.0:3000", "192.168.1.100:3000"
              const match = line.match(/(\d+\.\d+\.\d+\.\d+|localhost|0\.0\.0\.0):(\d+)/);
              if (match) {
                const rawHost = match[1];
                const port = parseInt(match[2]);
                return { rawHost, port };
              }
              return null;
            })
            .filter(Boolean) as { rawHost: string; port: number }[];

          // Resolve 0.0.0.0 to actual container IP
          const listeningAddresses = [];
          for (const { rawHost, port } of rawListeningAddresses) {
            let host: string;
            
            // Check if 0.0.0.0 (listen on all interfaces)
            if (rawHost === '0.0.0.0') {
              // Resolve to actual container IP
              const containerIp = await getContainerIpAddress(containerId, options.verbose);
              
              // Use resolved IP or fallback to localhost
              host = containerIp || 'localhost';
              
              if (options.verbose) {
                console.error(`Resolved 0.0.0.0 to ${host} for container ${containerId}`);
              }
            } else {
              // Preserve existing behavior for specific IPs
              host = rawHost;
            }
            
            listeningAddresses.push({ host, port });
          }

         if (listeningAddresses.length === 0) continue;

         // Check each listening address
         for (const { host, port } of listeningAddresses) {
           if (await isOpencodeApi(containerId, host, port, options.verbose)) {
             if (options.verbose) console.error(`Found opencode API in container ${containerName} on ${host}:${port}`);

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
                 host,
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
    return pc.red(`Error: ${result.error}`);
  }

  if (result.instances.length === 0) {
      return pc.yellow('No opencode instances found');
  }

  let output = '';

  if (showAll) {
    output += pc.green(`Found ${result.instances.length} opencode instance(s):\n\n`);
    result.instances.forEach((instance, index) => {
      output += pc.blue(`Instance ${index + 1}:\n`);
      output += `  Container: ${instance.containerName}\n`;
      output += `  Port: ${instance.port}\n`;
      output += `  Age: ${instance.elapsedTime} seconds\n`;
      output += `  Host:Port: ${instance.host}:${instance.port}\n\n`;
    });
  } else {
    if (!result.mostRecent) {
    return pc.yellow('No opencode instances found');
    }

    output += pc.green('Most recent opencode instance:\n');
    output += `  Container: ${result.mostRecent.containerName}\n`;
    output += `  Port: ${result.mostRecent.port}\n`;
    output += `  Age: ${result.mostRecent.elapsedTime} seconds\n`;
    output += `  Host:Port: ${result.mostRecent.host}:${result.mostRecent.port}\n`;

    if (result.instances.length > 1) {
      output += `\nOther instances found: ${result.instances.length - 1}\n`;
    }
  }

  return output;
}

export function formatPlain(result: DiscoveryResult): string {
  if (result.mostRecent) {
    return `${result.mostRecent.host}:${result.mostRecent.port}`;
  }
  return '';
}

export const discoverOpencodeCommand = new Command('discover-opencode')
  .description('Dynamically discover opencode instances running in Docker containers')
  .option('-a, --all', 'Return all discovered instances instead of just the most recent')
  .option('-f, --format <format>', 'Output format (text, json, yaml, plain)', 'text')
  .option('--filter <pattern>', 'Filter containers by name or label')
  .option('-v, --verbose', 'Enable verbose logging')
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
        console.error(pc.red('Error discovering opencode instances:'), errorMessage);
       process.exit(1);
     }
   });