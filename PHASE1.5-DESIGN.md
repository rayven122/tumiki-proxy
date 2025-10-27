# Phase 1.5 実装設計書：MCP SDK統合

## 概要

Phase 1（stdio専用、約310行）を MCP TypeScript SDK ベースに再実装し、stdio/HTTP 両対応を実現します。

## 目標

- ✅ stdio/HTTP 両対応（context7などのHTTPベースMCPサーバーをサポート）
- ✅ 公式SDKによる堅牢な実装
- ✅ コード量削減（約150行に）
- ✅ 拡張性の向上（middleware ベース）
- ✅ Phase 1 との後方互換性維持

## アーキテクチャ

### stdio モード（既存 Phase 1 と同等）
```
┌─────────────┐
│ Claude Code │
└──────┬──────┘
       │ stdio (JSON-RPC)
       ↓
┌────────────────────┐
│ tumiki-proxy-sdk   │
│ ┌────────────────┐ │
│ │ LoggingMiddle  │ ├──→ ログファイル
│ │ ware           │ │
│ └────────────────┘ │
│ ┌────────────────┐ │
│ │ MCP Client     │ │
│ │ (stdio)        │ │
│ └────────────────┘ │
└────────┬───────────┘
         │ stdio (spawn)
         ↓
┌─────────────────┐
│   MCP Server    │
└─────────────────┘
```

### HTTP Bridge モード（新規）
```
┌─────────────┐
│ Claude Code │
└──────┬──────┘
       │ stdio
       ↓
┌────────────────────┐
│ tumiki-proxy-sdk   │
│ (stdio-HTTP bridge)│
│ ┌────────────────┐ │
│ │ LoggingMiddle  │ ├──→ ログファイル
│ │ ware           │ │
│ └────────────────┘ │
│ ┌────────────────┐ │
│ │ Stdio Server   │ │
│ │ Transport      │ │
│ └────────────────┘ │
│ ┌────────────────┐ │
│ │ StreamableHTTP │ │
│ │ /SSE Client    │ │
│ └────────────────┘ │
└────────┬───────────┘
         │ HTTP/SSE
         ↓
┌─────────────────────┐
│ MCP Server (HTTP)   │
│ (context7など)       │
└─────────────────────┘
```

## ファイル構成

```
tumiki-proxy/
├── package.json                    # @modelcontextprotocol/sdk 追加
├── tsconfig.json                   # 既存
├── src/
│   ├── index.ts                    # Phase 1 (stdio専用、後方互換)
│   ├── index-sdk.ts                # Phase 1.5 (stdio/HTTP bridge統合)
│   ├── middleware/
│   │   └── logging.ts              # カスタムロギングミドルウェア
│   ├── config/
│   │   └── config.ts               # 環境変数設定
│   ├── logger/
│   │   ├── entry.ts                # ログエントリ型定義
│   │   └── file-logger.ts          # ファイルロガー実装
│   └── proxy/
│       ├── proxy.ts                # Phase 1用stdioプロキシ
│       └── stdio-http-bridge-simple.ts  # stdio-HTTP bridge
└── dist/                           # ビルド出力
```

## 実装詳細

### 1. 依存関係（package.json）

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  },
  "bin": {
    "tumiki-proxy": "./dist/index.js",
    "tumiki-proxy-sdk": "./dist/index-sdk.js"
  }
}
```

### 2. ログ形式（既存と互換）

```typescript
// src/middleware/logging.ts
export interface MCPLogEntry {
  timestamp: Date;
  type: "request" | "response" | "error" | "info";
  direction?: "client→server" | "server→client";
  method?: string;
  message: unknown;
  raw?: string;
}
```

### 3. 設定方法

**stdio モード**（環境変数のみ、Phase 1互換）:
```bash
export TUMIKI_LOG_FILE=/tmp/mcp-filesystem.log
tumiki-proxy-sdk npx -y @modelcontextprotocol/server-filesystem /path
```

**HTTP bridge モード**（環境変数のみ）:
```bash
export TUMIKI_LOG_FILE=/tmp/mcp-context7.log
export CONTEXT7_API_KEY=your-api-key  # オプション
tumiki-proxy-sdk --http https://mcp.context7.com/mcp
```

### 4. MCP 設定例

#### stdio モード（Phase 1互換）
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "tumiki-proxy-sdk",
      "args": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/path"],
      "env": {
        "TUMIKI_LOG_FILE": "/tmp/mcp-filesystem.log"
      }
    }
  }
}
```

#### HTTP bridge モード（新規）
```json
{
  "mcpServers": {
    "context7": {
      "command": "node",
      "args": [
        "/path/to/tumiki-proxy/dist/index-sdk.js",
        "--http",
        "https://mcp.context7.com/mcp"
      ],
      "env": {
        "TUMIKI_LOG_FILE": "/tmp/mcp-context7.log",
        "CONTEXT7_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## 実装ステップ

### ✅ ステップ1: SDK インストール
```bash
npm install @modelcontextprotocol/sdk
```

### ✅ ステップ2: ロギングミドルウェア実装（~40行）
- `src/middleware/logging.ts`
- リクエスト/レスポンスをファイルに記録
- 既存の FileLogger を再利用

### ✅ ステップ3: stdio プロキシ（Phase 1互換）
- `src/proxy/proxy.ts`
- spawn + pipe による透過的転送

### ✅ ステップ4: HTTP bridge 実装（~200行）
- `src/proxy/stdio-http-bridge-simple.ts`
- StdioServerTransport (Claude Code側)
- StreamableHTTPClientTransport/SSEClientTransport (HTTPサーバー側)
- 自動フォールバック機能

### ✅ ステップ5: 統合 CLI（~100行）
- `src/index-sdk.ts`
- モード判定（stdio or HTTP bridge）
- 適切なプロキシ起動

### ✅ ステップ6: ビルド＆テスト
- `npm run build`
- stdio テスト（filesystem server）
- HTTP bridge テスト（context7）

## 利点

### コード品質
- ✅ 公式SDKによる堅牢な実装
- ✅ プロトコル詳細はSDK任せ
- ✅ メンテナンス性向上

### 機能性
- ✅ stdio/HTTP 両対応
- ✅ SSE/WebSocket サポート（将来）
- ✅ OAuth認証対応（将来）

### 拡張性
- ✅ ミドルウェアベースで機能追加容易
- ✅ Phase 2（クラウド連携）への準備

## Phase 1 との違い

| 項目 | Phase 1 | Phase 1.5 (SDK) |
|------|---------|-----------------|
| 対応トランスポート | stdio | stdio + HTTP bridge |
| 実装行数 | ~310行 | ~350行 |
| 外部依存 | なし | @modelcontextprotocol/sdk |
| 拡張性 | 低 | 高（SDK & middleware） |
| メンテナンス | 手動 | SDK追従 |
| コマンド | tumiki-proxy | tumiki-proxy-sdk |
| HTTP対応 | ❌ | ✅ (StreamableHTTP/SSE) |
| 自動フォールバック | ❌ | ✅ |

## 後方互換性

- Phase 1 実装（`index.ts`）は保持
- `tumiki-proxy` コマンドは stdio 専用として維持
- `tumiki-proxy-sdk` が新しい統合コマンド

## 成果物

- ✅ stdio/HTTP bridge 両対応のMCPロギングプロキシ
- ✅ context7 などの HTTP ベース MCP サーバー対応
- ✅ 公式SDKによる堅牢性
- ✅ StreamableHTTP/SSE 自動フォールバック
- ✅ 約350行の簡潔な実装
- ✅ Phase 1 との後方互換性
- ✅ 統一NDJSON ログ形式

## 次フェーズへの準備

Phase 1.5 完了後:
- Phase 2: クラウド連携（S3/GCS アップロード）
- Phase 3: Electron GUI（ログビューア）
- Phase 4: パッケージング＆リリース
