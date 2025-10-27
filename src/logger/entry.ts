/**
 * Log entry structure for all log types
 */
export interface LogEntry {
  timestamp: Date;
  type: "request" | "response" | "stderr" | "info" | "error";
  direction?: "client→backend" | "backend→client";
  backendCmd: string;
  message: unknown;
  raw?: string;
}

/**
 * Logger configuration for Phase 1 (local file only)
 */
export interface LoggerConfig {
  filePath: string; // Required: path to log file
  bufferSize: number; // Max entries in queue before dropping
  batchSize: number; // Flush when queue reaches this size
  batchTimeoutMs: number; // Flush every N milliseconds
}

/**
 * Default configuration values
 */
export const DEFAULT_LOGGER_CONFIG: Partial<LoggerConfig> = {
  bufferSize: 1000,
  batchSize: 100,
  batchTimeoutMs: 100,
};
