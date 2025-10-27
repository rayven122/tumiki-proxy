import { promises as fs } from "fs";

/**
 * HTTP proxy configuration for a single MCP server
 */
export interface ProxyTarget {
  path: string; // URL path (e.g., "/context7")
  target: string; // Target MCP server URL
  transport: "sse" | "http"; // Transport type
  logFile: string; // Log file path
}

/**
 * HTTP server configuration
 */
export interface HttpServerConfig {
  host: string;
  port: number;
}

/**
 * Proxy configuration file structure
 */
export interface ProxyConfig {
  mode: "http" | "stdio";
  httpServer?: HttpServerConfig;
  proxies?: Record<string, ProxyTarget>;
}

/**
 * Default HTTP server configuration
 */
export const DEFAULT_HTTP_SERVER: HttpServerConfig = {
  host: "localhost",
  port: 3100,
};

/**
 * Load proxy configuration from file
 * @param configPath Path to configuration file
 */
export async function loadProxyConfig(
  configPath: string
): Promise<ProxyConfig> {
  try {
    const content = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(content) as ProxyConfig;

    // Validate required fields
    if (!config.mode) {
      throw new Error("Configuration must specify 'mode' (http or stdio)");
    }

    if (config.mode === "http") {
      if (!config.httpServer) {
        config.httpServer = DEFAULT_HTTP_SERVER;
      }
      if (!config.proxies || Object.keys(config.proxies).length === 0) {
        throw new Error(
          "HTTP mode requires at least one proxy configuration in 'proxies'"
        );
      }
    }

    return config;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    throw error;
  }
}
