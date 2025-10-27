import http from "http";
import { MCPProxy } from "./mcp-proxy.js";
import { FileLogger } from "../logger/file-logger.js";
import { ProxyConfig } from "../config/proxy-config.js";

/**
 * HTTP server that proxies MCP requests to backend servers
 */
export class MCPHttpServer {
  private server: http.Server | null = null;
  private proxies: Map<string, MCPProxy> = new Map();
  private loggers: Map<string, FileLogger> = new Map();

  constructor(private config: ProxyConfig) {}

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    const { host, port } = this.config.httpServer!;

    // Initialize all proxies
    for (const [name, target] of Object.entries(this.config.proxies!)) {
      const logger = new FileLogger({
        filePath: target.logFile,
        bufferSize: 1000,
        batchSize: 100,
        batchTimeoutMs: 100,
      });
      await logger.init();
      this.loggers.set(name, logger);

      const proxy = new MCPProxy(logger);
      await proxy.connect({
        type: target.transport as "stdio" | "sse",
        url: target.target,
      });

      this.proxies.set(target.path, proxy);
      console.log(`✅ Proxy ready: ${target.path} → ${target.target}`);
    }

    // Start HTTP server
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    await new Promise<void>((resolve) => {
      this.server!.listen(port, host, () => {
        console.log(`\n🚀 HTTP proxy server listening on http://${host}:${port}`);
        console.log(`\nConfigured proxies:`);
        for (const [path] of this.proxies.entries()) {
          console.log(`  - http://${host}:${port}${path}`);
        }
        resolve();
      });
    });
  }

  /**
   * Handle incoming HTTP request
   */
  private handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): void {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const proxy = this.proxies.get(url.pathname);

    if (!proxy) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Not Found",
          message: `No proxy configured for path: ${url.pathname}`,
        })
      );
      return;
    }

    // Forward request to MCP proxy
    // TODO: Implement proper MCP message forwarding
    // For now, return placeholder response

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        message: "Proxy is connected to backend",
      })
    );
  }

  /**
   * Stop the HTTP server
   */
  async close(): Promise<void> {
    // Close all proxies
    for (const [path, proxy] of this.proxies.entries()) {
      await proxy.close();
      console.log(`Closed proxy: ${path}`);
    }
    this.proxies.clear();

    // Close all loggers
    for (const [name, logger] of this.loggers.entries()) {
      await logger.close();
      console.log(`Closed logger: ${name}`);
    }
    this.loggers.clear();

    // Close HTTP server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
      console.log("HTTP server closed");
    }
  }
}
