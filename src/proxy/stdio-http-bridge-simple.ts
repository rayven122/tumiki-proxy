import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { FileLogger } from "../logger/file-logger.js";

/**
 * Simple stdio ↔ HTTP message bridge
 * Forwards messages between Claude Code (stdio) and HTTP MCP server
 * Supports both StreamableHTTP (new) and SSE (legacy) transports with automatic fallback
 */
export class StdioHttpBridgeSimple {
  private stdioTransport: StdioServerTransport | null = null;
  private httpTransport: Transport | null = null;
  private logger: FileLogger;
  private isClosing: boolean = false;

  constructor(logger: FileLogger) {
    this.logger = logger;
  }

  /**
   * Setup transport message handlers
   */
  private setupTransportHandlers(transport: Transport): void {
    // Setup message handler (backend → stdio)
    transport.onmessage = (message: JSONRPCMessage) => {
      try {
        this.logger.logResponse(JSON.stringify(message));
        if (this.stdioTransport) {
          this.stdioTransport.send(message).catch((err) => {
            this.logger.logError(`Failed to send to stdio: ${err}`);
          });
        }
      } catch (error) {
        this.logger.logError(`Error in HTTP transport onmessage: ${error}`);
      }
    };

    transport.onerror = (error: Error) => {
      this.logger.logError(`HTTP transport error: ${error.message}`);
      this.logger.logError(`HTTP transport error stack: ${error.stack}`);
    };

    transport.onclose = () => {
      this.logger.logInfo("HTTP transport connection closed");
      // Don't exit immediately, let the main loop handle it
      if (!this.stdioTransport) {
        process.exit(0);
      }
    };
  }

  /**
   * Start the bridge
   */
  async start(targetUrl: string): Promise<void> {
    this.logger.logInfo(`Starting stdio-http bridge to: ${targetUrl}`);

    try {
      // Get API key from environment if available
      const apiKey =
        process.env.CONTEXT7_API_KEY ||
        process.env.MCP_API_KEY ||
        process.env.API_KEY;

      // Prepare request headers
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers["X-Context7-API-Key"] = apiKey;
        headers["Authorization"] = `Bearer ${apiKey}`;
        this.logger.logInfo("Using API key from environment");
      } else {
        this.logger.logInfo("No API key found, connecting without authentication");
      }

      // Try StreamableHTTP first (new protocol), fallback to SSE (legacy)
      const baseUrl = new URL(targetUrl);
      let transportType = "unknown";

      try {
        this.logger.logInfo("Attempting StreamableHTTP transport...");
        this.httpTransport = new StreamableHTTPClientTransport(baseUrl, {
          requestInit: {
            headers,
          },
        });

        // Try to start (don't setup handlers yet)
        await this.httpTransport.start();
        transportType = "StreamableHTTP";
        this.logger.logInfo("Connected using StreamableHTTP transport");
      } catch (error) {
        // If StreamableHTTP fails, try SSE transport
        this.logger.logInfo(
          `StreamableHTTP connection failed: ${error}, falling back to SSE transport`
        );

        this.httpTransport = new SSEClientTransport(baseUrl, {
          requestInit: {
            headers,
          },
        });

        // Try SSE (don't setup handlers yet)
        await this.httpTransport.start();
        transportType = "SSE";
        this.logger.logInfo("Connected using SSE transport");
      }

      // Create stdio transport to Claude Code
      this.logger.logInfo("Creating stdio transport...");
      this.stdioTransport = new StdioServerTransport();

      // Now setup HTTP transport handlers (after stdio transport is created)
      this.setupTransportHandlers(this.httpTransport);

      // Setup stdio message handler (Claude Code → backend)
      this.stdioTransport.onmessage = (message: JSONRPCMessage) => {
        this.logger.logRequest(JSON.stringify(message));
        if (this.httpTransport) {
          this.httpTransport.send(message).catch((err) => {
            this.logger.logError(`Failed to send to HTTP: ${err}`);
          });
        }
      };

      this.stdioTransport.onerror = (error: Error) => {
        this.logger.logError(`stdio error: ${error.message}`);
        this.logger.logError(`stdio error stack: ${error.stack}`);
      };

      this.stdioTransport.onclose = () => {
        this.logger.logInfo("stdio connection closed");
        this.close().then(() => process.exit(0));
      };

      // Start stdio transport
      this.logger.logInfo("Starting stdio transport...");
      await this.stdioTransport.start();
      this.logger.logInfo("stdio transport ready");

      this.logger.logInfo("Bridge is fully operational");

      // Keep process alive
      await new Promise<void>((resolve) => {
        process.on("SIGINT", async () => {
          this.logger.logInfo("Received SIGINT");
          await this.close();
          resolve();
        });

        process.on("SIGTERM", async () => {
          this.logger.logInfo("Received SIGTERM");
          await this.close();
          resolve();
        });
      });
    } catch (error) {
      this.logger.logError(`Failed to start bridge: ${error}`);
      if (error instanceof Error) {
        this.logger.logError(`Error stack: ${error.stack}`);
      }
      await this.close();
      throw error;
    }
  }

  /**
   * Close the bridge
   */
  async close(): Promise<void> {
    // Prevent re-entrant calls
    if (this.isClosing) {
      this.logger.logInfo("close() called while already closing, ignoring");
      return;
    }

    this.isClosing = true;
    this.logger.logInfo("Starting bridge cleanup");

    // Close stdio transport
    if (this.stdioTransport) {
      this.logger.logInfo("Clearing stdio event handlers");
      // Clear handlers to prevent them from firing during close
      this.stdioTransport.onmessage = undefined;
      this.stdioTransport.onerror = undefined;
      this.stdioTransport.onclose = undefined;

      this.logger.logInfo("Closing stdio transport");
      await this.stdioTransport.close();
      this.stdioTransport = null;
      this.logger.logInfo("stdio transport closed");
    }

    // Close HTTP transport
    if (this.httpTransport) {
      this.logger.logInfo("Clearing HTTP event handlers");
      // Clear handlers to prevent them from firing during close
      this.httpTransport.onmessage = undefined;
      this.httpTransport.onerror = undefined;
      this.httpTransport.onclose = undefined;

      this.logger.logInfo("Closing HTTP transport");
      await this.httpTransport.close();
      this.httpTransport = null;
      this.logger.logInfo("HTTP transport closed");
    }

    this.logger.logInfo("Closing logger");
    await this.logger.close();
    this.logger.logInfo("Bridge cleanup complete");
  }
}
