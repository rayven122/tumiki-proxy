import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { FileLogger } from "../logger/file-logger.js";
import { LoggingTransport } from "../middleware/logging.js";

/**
 * Transport configuration
 */
export interface TransportConfig {
  type: "stdio" | "sse";
  // stdio config
  command?: string;
  args?: string[];
  // sse config
  url?: string;
}

/**
 * Unified MCP proxy core
 * Handles backend connection and logging for both stdio and HTTP modes
 */
export class MCPProxy {
  private client: Client | null = null;
  private logger: FileLogger;

  constructor(logger: FileLogger) {
    this.logger = logger;
  }

  /**
   * Connect to backend MCP server with logging
   */
  async connect(transportConfig: TransportConfig): Promise<Client> {
    // Create base transport based on config
    const baseTransport = this.createTransport(transportConfig);

    // Wrap with logging transport
    const loggingTransport = new LoggingTransport(baseTransport, this.logger);

    // Create MCP client
    this.client = new Client(
      {
        name: "tumiki-proxy-sdk",
        version: "0.1.0",
      },
      {
        capabilities: {},
      }
    );

    // Connect to backend
    await this.client.connect(loggingTransport);

    const backend = transportConfig.type === "stdio"
      ? `${transportConfig.command} ${transportConfig.args?.join(" ")}`
      : transportConfig.url;

    this.logger.logInfo(`Connected to backend: ${backend}`);

    return this.client;
  }

  /**
   * Create transport based on configuration
   */
  private createTransport(config: TransportConfig): Transport {
    switch (config.type) {
      case "stdio":
        if (!config.command) {
          throw new Error("stdio transport requires command");
        }
        this.logger.logInfo(
          `Creating stdio transport: ${config.command} ${config.args?.join(" ") || ""}`
        );
        return new StdioClientTransport({
          command: config.command,
          args: config.args || [],
        });

      case "sse":
        if (!config.url) {
          throw new Error("SSE transport requires url");
        }
        this.logger.logInfo(`Creating SSE transport: ${config.url}`);
        return new SSEClientTransport(new URL(config.url));

      default:
        throw new Error(`Unsupported transport type: ${config.type}`);
    }
  }

  /**
   * Get connected client
   */
  getClient(): Client | null {
    return this.client;
  }

  /**
   * Close connection and cleanup
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.logger.logInfo("Client connection closed");
    }

    await this.logger.close();
  }
}
