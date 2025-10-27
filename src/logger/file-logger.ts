import { promises as fs } from "fs";
import { LogEntry, LoggerConfig } from "./entry.js";

/**
 * File logger with async buffering and batch processing
 */
export class FileLogger {
  private fileHandle: fs.FileHandle | null = null;
  private logQueue: LogEntry[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isClosing = false;
  private writeMutex = Promise.resolve();

  constructor(private config: LoggerConfig) {}

  /**
   * Initialize the logger: open file and start batch timer
   */
  async init(): Promise<void> {
    this.fileHandle = await fs.open(this.config.filePath, "a");
    this.startBatchTimer();
  }

  /**
   * Start periodic batch flush timer
   */
  private startBatchTimer(): void {
    this.batchTimer = setInterval(() => {
      this.flush();
    }, this.config.batchTimeoutMs);
  }

  /**
   * Log a request (client → backend)
   */
  logRequest(raw: string): void {
    this.log({
      timestamp: new Date(),
      type: "request",
      direction: "client→backend",
      backendCmd: this.getBackendCmd(),
      message: this.parseJSON(raw),
      raw,
    });
  }

  /**
   * Log a response (backend → client)
   */
  logResponse(raw: string): void {
    this.log({
      timestamp: new Date(),
      type: "response",
      direction: "backend→client",
      backendCmd: this.getBackendCmd(),
      message: this.parseJSON(raw),
      raw,
    });
  }

  /**
   * Log stderr output from backend
   */
  logStderr(line: string): void {
    this.log({
      timestamp: new Date(),
      type: "stderr",
      backendCmd: this.getBackendCmd(),
      message: line,
    });
  }

  /**
   * Log informational message
   */
  logInfo(msg: string): void {
    this.log({
      timestamp: new Date(),
      type: "info",
      backendCmd: this.getBackendCmd(),
      message: msg,
    });
  }

  /**
   * Log error message
   */
  logError(msg: string): void {
    this.log({
      timestamp: new Date(),
      type: "error",
      backendCmd: this.getBackendCmd(),
      message: msg,
    });
  }

  /**
   * Add log entry to queue and flush if needed
   */
  private log(entry: LogEntry): void {
    if (this.isClosing) return;

    this.logQueue.push(entry);

    // Drop oldest entry if buffer is full
    if (this.logQueue.length > this.config.bufferSize) {
      this.logQueue.shift();
      console.error("[tumiki-proxy] Log queue full, dropping oldest entry");
    }

    // Flush immediately if batch size reached
    if (this.logQueue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Flush queued entries to file
   */
  private flush(): void {
    if (this.logQueue.length === 0 || !this.fileHandle) return;

    const batch = this.logQueue.splice(0);

    // Write batch asynchronously with order guarantee
    this.writeMutex = this.writeMutex
      .then(async () => {
        for (const entry of batch) {
          const data = JSON.stringify(entry) + "\n";
          await this.fileHandle!.write(data);
        }
      })
      .catch((err) => {
        console.error("[tumiki-proxy] Failed to write logs:", err);
      });
  }

  /**
   * Close logger: stop timer, flush remaining logs, close file
   */
  async close(): Promise<void> {
    this.isClosing = true;

    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    this.flush();
    await this.writeMutex;

    if (this.fileHandle) {
      await this.fileHandle.close();
      this.fileHandle = null;
    }
  }

  /**
   * Parse JSON string, return parsed object or original string on error
   */
  private parseJSON(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  /**
   * Get backend command from process args
   */
  private getBackendCmd(): string {
    return process.argv[2] || "unknown";
  }
}
