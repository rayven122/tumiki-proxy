#!/bin/bash

# Basic functionality test for tumiki-proxy

export TUMIKI_LOG_FILE=/tmp/tumiki-test.log
rm -f "$TUMIKI_LOG_FILE"

echo "Testing tumiki-proxy basic functionality..."

# Test 1: Run with echo command and send a line
echo '{"jsonrpc":"2.0","method":"test"}' | node dist/index.js cat &
PID=$!

# Wait a bit for the proxy to start and process
sleep 2

# Send SIGINT to stop gracefully
kill -INT $PID 2>/dev/null || true
wait $PID 2>/dev/null || true

sleep 1

# Check results
echo ""
if [ -f "$TUMIKI_LOG_FILE" ]; then
  echo "✅ Log file created successfully"
  LINE_COUNT=$(wc -l < "$TUMIKI_LOG_FILE")
  echo "   Log entries: $LINE_COUNT"
  echo ""
  echo "Sample log entries:"
  head -5 "$TUMIKI_LOG_FILE"
else
  echo "❌ Log file not created"
  exit 1
fi

echo ""
echo "✅ Basic test completed successfully"
