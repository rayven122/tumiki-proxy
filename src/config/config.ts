import { LoggerConfig, DEFAULT_LOGGER_CONFIG } from "../logger/entry.js";

/**
 * Load configuration from environment variables
 * @throws Error if TUMIKI_LOG_FILE is not set
 */
export function loadConfig(): LoggerConfig {
  const filePath = process.env.TUMIKI_LOG_FILE;

  if (!filePath) {
    throw new Error("TUMIKI_LOG_FILE environment variable is required");
  }

  return {
    filePath,
    bufferSize:
      parseInt(process.env.TUMIKI_LOG_BUFFER_SIZE || "") ||
      DEFAULT_LOGGER_CONFIG.bufferSize!,
    batchSize:
      parseInt(process.env.TUMIKI_LOG_BATCH_SIZE || "") ||
      DEFAULT_LOGGER_CONFIG.batchSize!,
    batchTimeoutMs:
      parseInt(process.env.TUMIKI_LOG_BATCH_TIMEOUT_MS || "") ||
      DEFAULT_LOGGER_CONFIG.batchTimeoutMs!,
  };
}
