import { Command } from "commander";
import { discoverOpencodeInstances, formatPlain } from "./discover-opencode";
import { createLoggerFromCommandOptions } from "../utils/logger";
import { exec } from "child_process";

export const startAndAttachCommand = new Command("start-and-attach")
  .description("Start opencode serve in background and attach to it")
  .option("--timeout <seconds>", "Maximum time to wait for discovery", "30")
  .option("--retry-interval <seconds>", "Initial retry interval", "1")
  .option("-v, --verbose", "Show detailed user information")
  .option("-d, --debug", "Show system debugging information")
  .option("--dry-run", "Show what would be done without executing")
  .action(async (options) => {
    const logger = createLoggerFromCommandOptions(options);
    const timeout = parseInt(options.timeout) || 30;
    const retryInterval = parseInt(options.retryInterval) || 1;

    logger.info("Starting opencode serve in background...");

    if (options.dryRun) {
      console.log("Would run: aisanity run opencode serve (background)");
      console.log(`Would wait up to ${timeout}s for discovery with ${retryInterval}s intervals`);
      console.log("Would then run: opencode attach <discovered-host:port>");
      return;
    }

    // Start opencode serve in background using nohup
    // TODO: Should be checked for the actual binary name, to not require BUN etc.
    // but hardcoding aisanity is also not ideal
    const { spawn: spawnBg } = await import("child_process");
    const backgroundProcess = spawnBg("nohup", ["aisanity", "run", "opencode", "serve", "-h", "0.0.0.0"], {
      detached: true,
      stdio: "ignore",
      cwd: process.cwd(),
    });

    // Don't wait for the background process
    backgroundProcess.unref();

    logger.info(`Started opencode serve with PID: ${backgroundProcess.pid}`);

    // Discovery loop with retry
    const maxAttempts = Math.ceil(timeout / retryInterval);
    logger.info(`Discovering opencode instance (max ${timeout}s, ${retryInterval}s intervals)...`);

    let hostPort = "";

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        logger.verbose(`Attempt ${attempt + 1}/${maxAttempts}...`);
        await new Promise((resolve) => setTimeout(resolve, retryInterval * 1000));
      }

      try {
        const result = await discoverOpencodeInstances({
          format: "plain",
          verbose: options.verbose,
          all: false,
        });

        if (result.mostRecent) {
          hostPort = formatPlain(result);
          logger.info(`Found opencode at: ${hostPort}`);
          break;
        }
      } catch (error) {
        logger.verbose(`Discovery attempt ${attempt + 1} failed: ${error}`);
      }
    }

    if (!hostPort) {
      logger.error("Failed to discover opencode instance within timeout");
      logger.error("You may need to check if opencode serve started correctly");
      process.exit(1);
    }

    hostPort = "http://" + hostPort;

    // Replace current process with opencode attach
    logger.info(`Attaching to opencode at ${hostPort}...`);

    // Use spawn to replace the current process
    const { spawn } = await import("child_process");
    const attachProcess = spawn("opencode", ["attach", hostPort], {
      cwd: process.cwd(),
      stdio: "inherit",
    });

    attachProcess.on("error", (error: any) => {
      logger.error(`Failed to attach to opencode: ${error.message}`);
      process.exit(1);
    });

    // Wait for the attach process
    attachProcess.on("close", (code: number | null) => {
      process.exit(code || 0);
    });
  });
