import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { FileLogger } from "../logger/file-logger.js";

/**
 * Transport wrapper that logs all JSON-RPC messages
 */
export class LoggingTransport implements Transport {
  private baseTransport: Transport;
  private logger: FileLogger;

  constructor(baseTransport: Transport, logger: FileLogger) {
    this.baseTransport = baseTransport;
    this.logger = logger;

    // Wrap the onmessage callback to log incoming messages
    const originalOnMessage = baseTransport.onmessage;
    baseTransport.onmessage = (message: JSONRPCMessage) => {
      this.logMessage("response", "server→client", message);
      if (originalOnMessage) {
        originalOnMessage.call(baseTransport, message);
      }
    };

    // Forward other callbacks
    baseTransport.onerror = (error: Error) => {
      this.logger.logError(`Transport error: ${error.message}`);
      if (this.onerror) {
        this.onerror(error);
      }
    };

    baseTransport.onclose = () => {
      this.logger.logInfo("Transport closed");
      if (this.onclose) {
        this.onclose();
      }
    };
  }

  // Transport interface implementation
  sessionId?: string;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  async start(): Promise<void> {
    this.logger.logInfo("Transport starting");
    await this.baseTransport.start();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this.logMessage("request", "client→server", message);
    await this.baseTransport.send(message);
  }

  async close(): Promise<void> {
    this.logger.logInfo("Transport closing");
    await this.baseTransport.close();
  }

  /**
   * Log a JSON-RPC message
   */
  private logMessage(
    type: "request" | "response",
    direction: "client→server" | "server→client",
    message: JSONRPCMessage
  ): void {
    const raw = JSON.stringify(message);

    if (type === "request") {
      this.logger.logRequest(raw);
    } else {
      this.logger.logResponse(raw);
    }
  }
}
