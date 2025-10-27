#!/usr/bin/env node

import { loadConfig } from "./config/config.js";
import { FileLogger } from "./logger/file-logger.js";
import { TumikiProxy } from "./proxy/proxy.js";

/**
 * CLI entry point for tumiki-proxy
 * Usage: tumiki-proxy <backend-command> [args...]
 */
async function main() {
  // Validate arguments
  if (process.argv.length < 3) {
    console.error("Usage: tumiki-proxy <backend-command> [args...]");
    console.error(
      "Example: TUMIKI_LOG_FILE=./mcp.log tumiki-proxy npx -y @modelcontextprotocol/server-everything"
    );
    process.exit(1);
  }

  try {
    // Load configuration from environment
    const config = loadConfig();

    // Initialize logger
    const logger = new FileLogger(config);
    await logger.init();

    logger.logInfo(`tumiki-proxy starting`);
    logger.logInfo(`Log file: ${config.filePath}`);

    // Extract backend command and args
    const [command, ...args] = process.argv.slice(2);

    // Initialize and start proxy
    const proxy = new TumikiProxy(logger);

    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      logger.logInfo(`Received ${signal}, shutting down gracefully`);
      await proxy.close();
      process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    // Start proxying
    await proxy.start(command, args);
  } catch (error) {
    console.error(`[tumiki-proxy] Fatal error: ${error}`);
    process.exit(1);
  }
}

main();
