#!/usr/bin/env node

import { loadConfig } from "./config/config.js";
import { FileLogger } from "./logger/file-logger.js";
import { TumikiProxy } from "./proxy/proxy.js";
import { StdioHttpBridgeSimple } from "./proxy/stdio-http-bridge-simple.js";

/**
 * Detect mode: stdio or http-bridge
 */
function detectMode(): "stdio" | "http-bridge" {
  // Check for HTTP bridge mode: --http <URL>
  const httpIndex = process.argv.indexOf("--http");
  if (httpIndex !== -1 && process.argv.length > httpIndex + 1) {
    return "http-bridge";
  }

  // Default to stdio mode
  return "stdio";
}

/**
 * stdio mode: Transparent proxy using spawn + pipe (Phase 1)
 */
async function runStdioMode() {
  // Validate arguments
  if (process.argv.length < 3) {
    console.error("Usage: tumiki-proxy-sdk <backend-command> [args...]");
    console.error(
      "Example: TUMIKI_LOG_FILE=./mcp.log tumiki-proxy-sdk npx -y @modelcontextprotocol/server-filesystem /path"
    );
    process.exit(1);
  }

  try {
    // Load configuration from environment
    const config = loadConfig();

    // Initialize logger
    const logger = new FileLogger(config);
    await logger.init();

    logger.logInfo("tumiki-proxy-sdk starting (stdio mode)");
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
    console.error(`[tumiki-proxy-sdk] Fatal error: ${error}`);
    process.exit(1);
  }
}


/**
 * HTTP bridge mode: stdio ↔ HTTP/SSE bridge
 */
async function runHttpBridge() {
  try {
    // Get URL from arguments
    const httpIndex = process.argv.indexOf("--http");
    const targetUrl = process.argv[httpIndex + 1];

    if (!targetUrl) {
      console.error("Usage: tumiki-proxy-sdk --http <URL>");
      console.error(
        "Example: TUMIKI_LOG_FILE=./mcp.log tumiki-proxy-sdk --http https://mcp.context7.com/mcp"
      );
      process.exit(1);
    }

    // Load configuration from environment
    const config = loadConfig();

    // Initialize logger
    const logger = new FileLogger(config);
    await logger.init();

    logger.logInfo("tumiki-proxy-sdk starting (HTTP bridge mode)");
    logger.logInfo(`Log file: ${config.filePath}`);
    logger.logInfo(`Target URL: ${targetUrl}`);

    // Initialize and start bridge
    const bridge = new StdioHttpBridgeSimple(logger);
    await bridge.start(targetUrl);
  } catch (error) {
    console.error(`[tumiki-proxy-sdk] Fatal error: ${error}`);
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main() {
  const mode = detectMode();

  if (mode === "stdio") {
    await runStdioMode();
  } else if (mode === "http-bridge") {
    await runHttpBridge();
  } else {
    console.error("Unknown mode");
    console.error("");
    console.error("Usage:");
    console.error("  stdio mode:        tumiki-proxy-sdk <command> [args...]");
    console.error("  HTTP bridge mode:  tumiki-proxy-sdk --http <URL>");
    process.exit(1);
  }
}

main();
