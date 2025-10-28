#!/usr/bin/env node

import { loadConfig } from "./config/config.js";
import { FileLogger } from "./logger/file-logger.js";
import { StdioProxy } from "./proxy/stdio-proxy.js";
import { StdioStreamableHttp } from "./proxy/stdio-streamable-http.js";

const VERSION = "0.2.2";

/**
 * Show version information
 */
function showVersion() {
  console.log(`tumiki-proxy version ${VERSION}`);
  console.log("Transparent MCP logging proxy with multi-transport support");
  process.exit(0);
}

/**
 * Show help information
 */
function showHelp() {
  console.log(`tumiki-proxy version ${VERSION}`);
  console.log("");
  console.log("Usage:");
  console.log("  stdio mode:           tumiki-proxy <command> [args...]");
  console.log("  streamable HTTP mode: tumiki-proxy --http <URL>");
  console.log("");
  console.log("Options:");
  console.log("  -v, --version    Show version information");
  console.log("  -h, --help       Show this help message");
  console.log("");
  console.log("Environment Variables:");
  console.log("  TUMIKI_LOG_FILE              Path to log file (required)");
  console.log("  TUMIKI_LOG_BUFFER_SIZE       Buffer size (default: 1000)");
  console.log("  TUMIKI_LOG_BATCH_SIZE        Batch size (default: 100)");
  console.log("  TUMIKI_LOG_BATCH_TIMEOUT_MS  Batch timeout (default: 100)");
  console.log("");
  console.log("Examples:");
  console.log("  TUMIKI_LOG_FILE=./mcp.log tumiki-proxy npx -y @modelcontextprotocol/server-filesystem /path");
  console.log("  TUMIKI_LOG_FILE=./mcp.log tumiki-proxy --http https://mcp.context7.com/mcp");
  process.exit(0);
}

/**
 * Detect mode: stdio or streamable-http
 */
function detectMode(): "stdio" | "streamable-http" {
  // Check for streamable HTTP mode: --http <URL>
  const httpIndex = process.argv.indexOf("--http");
  if (httpIndex !== -1 && process.argv.length > httpIndex + 1) {
    return "streamable-http";
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
    console.error("Usage: tumiki-proxy <backend-command> [args...]");
    console.error(
      "Example: TUMIKI_LOG_FILE=./mcp.log tumiki-proxy npx -y @modelcontextprotocol/server-filesystem /path"
    );
    process.exit(1);
  }

  try {
    // Load configuration from environment
    const config = loadConfig();

    // Initialize logger
    const logger = new FileLogger(config);
    await logger.init();

    logger.logInfo("tumiki-proxy starting (stdio mode)");
    logger.logInfo(`Log file: ${config.filePath}`);

    // Extract backend command and args
    const [command, ...args] = process.argv.slice(2);

    // Initialize and start proxy
    const proxy = new StdioProxy(logger);

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


/**
 * Streamable HTTP mode: stdio ↔ HTTP/SSE bridge
 */
async function runStreamableHttp() {
  try {
    // Get URL from arguments
    const httpIndex = process.argv.indexOf("--http");
    const targetUrl = process.argv[httpIndex + 1];

    if (!targetUrl) {
      console.error("Usage: tumiki-proxy --http <URL>");
      console.error(
        "Example: TUMIKI_LOG_FILE=./mcp.log tumiki-proxy --http https://mcp.context7.com/mcp"
      );
      process.exit(1);
    }

    // Load configuration from environment
    const config = loadConfig();

    // Initialize logger
    const logger = new FileLogger(config);
    await logger.init();

    logger.logInfo("tumiki-proxy starting (streamable HTTP mode)");
    logger.logInfo(`Log file: ${config.filePath}`);
    logger.logInfo(`Target URL: ${targetUrl}`);

    // Initialize and start bridge
    const bridge = new StdioStreamableHttp(logger);
    await bridge.start(targetUrl);
  } catch (error) {
    console.error(`[tumiki-proxy] Fatal error: ${error}`);
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main() {
  // Check for version or help flags first (before any env variable checks)
  const args = process.argv.slice(2);

  if (args.includes("-v") || args.includes("--version")) {
    showVersion();
  }

  if (args.includes("-h") || args.includes("--help") || args.length === 0) {
    showHelp();
  }

  const mode = detectMode();

  if (mode === "stdio") {
    await runStdioMode();
  } else if (mode === "streamable-http") {
    await runStreamableHttp();
  } else {
    console.error("Unknown mode");
    console.error("");
    console.error("Usage:");
    console.error("  stdio mode:           tumiki-proxy <command> [args...]");
    console.error("  streamable HTTP mode: tumiki-proxy --http <URL>");
    process.exit(1);
  }
}

main();
