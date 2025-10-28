#!/bin/bash

# SHA256チェックサム生成スクリプト
# 使用方法: ./scripts/generate-sha256.sh v0.2.0

set -e

VERSION=${1:-v0.2.0}
REPO="rayven122/tumiki-proxy"
BASE_URL="https://github.com/${REPO}/releases/download/${VERSION}"

echo "Generating SHA256 checksums for tumiki-proxy ${VERSION}"
echo "=================================================="
echo ""

PLATFORMS=(
  "tumiki-proxy-macos-arm64:macOS ARM64"
  "tumiki-proxy-macos-x64:macOS x64"
  "tumiki-proxy-linux-x64:Linux x64"
)

for platform in "${PLATFORMS[@]}"; do
  IFS=':' read -r filename description <<< "$platform"
  url="${BASE_URL}/${filename}"

  echo "Platform: ${description}"
  echo "URL: ${url}"
  echo -n "SHA256: "

  if command -v curl &> /dev/null; then
    curl -sL "${url}" | shasum -a 256 | awk '{print $1}'
  else
    echo "Error: curl not found"
    exit 1
  fi

  echo ""
done

echo "=================================================="
echo "Copy these SHA256 values to Formula/tumiki-proxy.rb"
