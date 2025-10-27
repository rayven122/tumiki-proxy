# tumiki-proxy

Transparent logging proxy for MCP (Model Context Protocol) servers. Logs all MCP traffic between Claude Code and backend servers to local files for debugging and analysis.

## Features

- **Transparent**: Zero-impact wrapper - works with any MCP server
- **Efficient**: Async buffering with batch processing (minimal overhead)
- **Simple**: Single environment variable configuration
- **Lightweight**: ~310 lines, zero external dependencies
- **Type-safe**: Full TypeScript implementation

## Installation

```bash
# Clone repository
git clone https://github.com/yourusername/tumiki-proxy.git
cd tumiki-proxy

# Install dependencies and build
npm install
npm run build

# Optional: Install globally
npm install -g .
```

## Usage

### Basic Usage

```bash
# Set log file location
export TUMIKI_LOG_FILE="./mcp-traffic.log"

# Run MCP server through proxy
tumiki-proxy npx -y @modelcontextprotocol/server-everything
```

### Claude Code MCP Configuration

Replace your MCP server command with tumiki-proxy wrapper:

```json
{
  "mcpServers": {
    "everything": {
      "command": "tumiki-proxy",
      "args": [
        "npx",
        "-y",
        "@modelcontextprotocol/server-everything"
      ],
      "env": {
        "TUMIKI_LOG_FILE": "/path/to/mcp-everything.log"
      }
    }
  }
}
```

### Wrapper Script (Recommended)

Create a wrapper script for each MCP server:

**wrapper-everything.sh:**
```bash
#!/bin/bash
export TUMIKI_LOG_FILE="${HOME}/.mcp-logs/everything.log"
exec tumiki-proxy npx -y @modelcontextprotocol/server-everything "$@"
```

**MCP Configuration:**
```json
{
  "mcpServers": {
    "everything": {
      "command": "/path/to/wrapper-everything.sh",
      "args": []
    }
  }
}
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TUMIKI_LOG_FILE` | Yes | - | Path to log file |
| `TUMIKI_LOG_BUFFER_SIZE` | No | 1000 | Max entries in queue before dropping |
| `TUMIKI_LOG_BATCH_SIZE` | No | 100 | Flush when queue reaches this size |
| `TUMIKI_LOG_BATCH_TIMEOUT_MS` | No | 100 | Flush interval in milliseconds |

### Example with Custom Configuration

```bash
export TUMIKI_LOG_FILE="./mcp.log"
export TUMIKI_LOG_BUFFER_SIZE=500
export TUMIKI_LOG_BATCH_SIZE=50
export TUMIKI_LOG_BATCH_TIMEOUT_MS=200

tumiki-proxy your-mcp-server
```

## Log Format

Logs are written as newline-delimited JSON (NDJSON):

```json
{"timestamp":"2024-01-15T10:30:00.000Z","type":"request","direction":"client→backend","backendCmd":"npx","message":{"jsonrpc":"2.0","id":1,"method":"tools/list"},"raw":"{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}"}
{"timestamp":"2024-01-15T10:30:00.100Z","type":"response","direction":"backend→client","backendCmd":"npx","message":{"jsonrpc":"2.0","id":1,"result":{"tools":[...]}},"raw":"{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"tools\":[...]}}"}
{"timestamp":"2024-01-15T10:30:00.150Z","type":"stderr","backendCmd":"npx","message":"Debug: Tool loaded"}
{"timestamp":"2024-01-15T10:30:00.200Z","type":"info","backendCmd":"npx","message":"Backend exited: code=0, signal=null"}
```

### Log Entry Types

- `request`: Client → Backend (Claude Code → MCP Server)
- `response`: Backend → Client (MCP Server → Claude Code)
- `stderr`: Backend error output
- `info`: Proxy lifecycle events (start, exit)
- `error`: Proxy errors

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Clean build artifacts
npm run clean
```

## Architecture

```
┌─────────────┐
│ Claude Code │
└──────┬──────┘
       │ stdin/stdout (JSON-RPC)
       ↓
┌────────────────────┐
│  tumiki-proxy      │
│  ┌──────────────┐  │
│  │ FileLogger   │──┼─→ Local log file (NDJSON)
│  └──────────────┘  │
│  ┌──────────────┐  │
│  │ TumikiProxy  │  │
│  └──────────────┘  │
└────────┬───────────┘
         │ stdin/stdout (transparent)
         ↓
┌─────────────────┐
│   MCP Server    │
└─────────────────┘
```

## License

MIT License - see LICENSE file for details

## Future Roadmap

- **Phase 2**: HTTP upload to cloud storage (S3, GCS, etc.)
- **Phase 3**: Electron GUI for log viewing and analysis
- **Phase 4**: Package and release management
