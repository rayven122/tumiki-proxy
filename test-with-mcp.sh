#!/bin/bash

# Test tumiki-proxy with a real MCP server

echo "Testing tumiki-proxy with @modelcontextprotocol/server-filesystem..."
echo ""

export TUMIKI_LOG_FILE=/tmp/mcp-test.log
rm -f "$TUMIKI_LOG_FILE"

# Test if filesystem server is available
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js"
    exit 1
fi

echo "Starting filesystem server through proxy..."
echo "Log file: $TUMIKI_LOG_FILE"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Run filesystem server through proxy for current directory
node dist/index.js npx -y @modelcontextprotocol/server-filesystem "$PWD"
