import { spawn, ChildProcess } from "child_process";
import { Readable, Writable } from "stream";
import { FileLogger } from "../logger/file-logger.js";

/**
 * Transparent proxy that wraps MCP servers and logs all traffic
 */
export class TumikiProxy {
  private backendProcess: ChildProcess | null = null;
  private logger: FileLogger;

  constructor(logger: FileLogger) {
    this.logger = logger;
  }

  /**
   * Start the proxy: spawn backend process and set up pipes
   */
  async start(command: string, args: string[]): Promise<void> {
    this.logger.logInfo(`Starting backend: ${command} ${args.join(" ")}`);

    // Spawn backend MCP server
    this.backendProcess = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // stdin: Claude Code → log → backend
    this.pipeWithLog(process.stdin, this.backendProcess.stdin!, (data) =>
      this.logger.logRequest(data.toString())
    );

    // stdout: backend → log → Claude Code
    this.pipeWithLog(this.backendProcess.stdout!, process.stdout, (data) =>
      this.logger.logResponse(data.toString())
    );

    // stderr: backend → log → stderr
    this.backendProcess.stderr!.on("data", (data) => {
      const line = data.toString().trim();
      this.logger.logStderr(line);
      process.stderr.write(data);
    });

    // Handle backend process exit
    this.backendProcess.on("exit", async (code, signal) => {
      this.logger.logInfo(`Backend exited: code=${code}, signal=${signal}`);
      await this.close();
      process.exit(code || 0);
    });

    // Handle backend process errors
    this.backendProcess.on("error", async (err) => {
      this.logger.logError(`Backend error: ${err.message}`);
      await this.close();
      process.exit(1);
    });
  }

  /**
   * Pipe data from source to destination with logging
   */
  private pipeWithLog(
    source: Readable,
    destination: Writable,
    logCallback: (data: Buffer) => void
  ): void {
    source.on("data", (data: Buffer) => {
      logCallback(data);
      destination.write(data);
    });

    source.on("end", () => {
      destination.end();
    });
  }

  /**
   * Close proxy: kill backend process and close logger
   */
  async close(): Promise<void> {
    if (this.backendProcess && !this.backendProcess.killed) {
      this.backendProcess.kill();
    }

    await this.logger.close();
  }
}
