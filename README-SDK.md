# tumiki-proxy-sdk

MCP TypeScript SDK ベースの透過的ロギングプロキシ。stdio および HTTP/SSE ベースの MCP サーバーに対応。

## 特徴

- **2つのモード**: stdio、HTTP bridge
- **統一ログ形式**: すべてのモードで NDJSON 形式
- **公式SDK**: @modelcontextprotocol/sdk 使用
- **後方互換**: Phase 1 (stdio専用) との互換性維持
- **自動フォールバック**: StreamableHTTP → SSE の自動切り替え

## インストール

```bash
npm install
npm run build
```

## 使用方法

### 1. stdio モード（コマンド実行型MCPサーバー）

```bash
# 環境変数で設定
export TUMIKI_LOG_FILE=/tmp/mcp-filesystem.log

# MCPサーバーを実行
node dist/index-sdk.js npx -y @modelcontextprotocol/server-filesystem /path/to/dir
```

**Claude Code 設定:**
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "node",
      "args": [
        "/path/to/tumiki-proxy/dist/index-sdk.js",
        "npx", "-y", "@modelcontextprotocol/server-filesystem",
        "/path/to/dir"
      ],
      "env": {
        "TUMIKI_LOG_FILE": "/tmp/mcp-filesystem.log"
      }
    }
  }
}
```

### 2. HTTP bridge モード（HTTPベースMCPサーバー）

HTTPベースのMCPサーバー（context7など）をstdio経由で使用し、ログを収集します。

**トランスポート自動選択**:
1. StreamableHTTP（新プロトコル、2024-11-05以降）を試行
2. 失敗時は自動的に SSE（レガシー）にフォールバック
3. どちらのプロトコルでも透過的に動作

```bash
# 環境変数で設定
export TUMIKI_LOG_FILE=/tmp/mcp-context7.log
export CONTEXT7_API_KEY=your-api-key  # 認証が必要な場合

# HTTPサーバーに接続
node dist/index-sdk.js --http https://mcp.context7.com/mcp
```

**Claude Code 設定:**
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

**サポートされる API キー環境変数:**
- `CONTEXT7_API_KEY` - Context7 専用
- `MCP_API_KEY` - 汎用 MCP API キー
- `API_KEY` - フォールバック


## ログ形式

すべてのモードで同じ NDJSON（改行区切りJSON）形式を使用：

```json
{"timestamp":"2025-10-27T10:00:00.000Z","type":"info","backendCmd":"npx","message":"tumiki-proxy-sdk starting (stdio mode)"}
{"timestamp":"2025-10-27T10:00:00.001Z","type":"request","direction":"client→backend","backendCmd":"npx","message":{"jsonrpc":"2.0","id":1,"method":"tools/list"},"raw":"..."}
{"timestamp":"2025-10-27T10:00:00.100Z","type":"response","direction":"backend→client","backendCmd":"npx","message":{"jsonrpc":"2.0","id":1,"result":{...}},"raw":"..."}
```

### ログエントリタイプ

- `info`: プロキシのライフサイクルイベント
- `request`: クライアント → バックエンド
- `response`: バックエンド → クライアント
- `error`: エラーメッセージ

## アーキテクチャ

### stdio モード
```
Claude Code (stdio)
  ↕ stdin/stdout
tumiki-proxy-sdk
  ↕ spawn + pipe
MCP Server (stdio)
```

### HTTP bridge モード
```
Claude Code (stdio)
  ↕ stdin/stdout
tumiki-proxy-sdk
  - StdioServerTransport (Claude Code側)
  - StreamableHTTPClientTransport または SSEClientTransport (HTTPサーバー側)
    * 自動フォールバック: StreamableHTTP → SSE
  - FileLogger (NDJSON ログ記録)
  ↕ HTTP/StreamableHTTP または HTTP/SSE
MCP Server (HTTP)
```

**トランスポート選択ロジック**:
1. StreamableHTTP を試行（MCP 2024-11-05 以降の新プロトコル）
2. 接続失敗時は SSE にフォールバック（レガシープロトコル）
3. ログにどちらが使用されたかを記録

## 環境変数

### 必須
- `TUMIKI_LOG_FILE`: ログファイルパス

### オプション
- `TUMIKI_LOG_BUFFER_SIZE`: バッファサイズ（デフォルト: 1000）
- `TUMIKI_LOG_BATCH_SIZE`: バッチサイズ（デフォルト: 100）
- `TUMIKI_LOG_BATCH_TIMEOUT_MS`: フラッシュ間隔（デフォルト: 100ms）

### 認証（HTTP bridge モード）
- `CONTEXT7_API_KEY`: Context7 API キー
- `MCP_API_KEY`: 汎用 MCP API キー
- `API_KEY`: フォールバック API キー

## トラブルシューティング

### HTTP bridge モード接続確認

ログファイルでトランスポート選択を確認できます：

```bash
# StreamableHTTP が使用された場合
{"type":"info","message":"Connected using StreamableHTTP transport"}

# SSE にフォールバックした場合
{"type":"info","message":"StreamableHTTP connection failed, falling back to SSE transport"}
{"type":"info","message":"Connected using SSE transport"}
```

### context7 接続エラー

**症状**: MCP サーバーが failed 状態

**原因と解決策**:

1. **API キーの問題**（認証が必要なサーバーの場合）
   - Context7 の API キーを取得
   - `.mcp.json` の `CONTEXT7_API_KEY` を設定
   - Claude Code を再起動

2. **トランスポート接続エラー**
   - ログファイルで詳細を確認
   - StreamableHTTP と SSE の両方が失敗している場合、ネットワーク接続を確認
   - ファイアウォール設定を確認

### ログファイルが作成されない

**確認事項**:
1. `TUMIKI_LOG_FILE` 環境変数が設定されているか
2. ログファイルのパスに書き込み権限があるか
3. ログファイルが既に開かれていないか

### クリーンアップエラー

以前のバージョンで "Maximum call stack size exceeded" エラーが発生していた場合:
- 最新版では修正済み（再入防止とイベントハンドラクリアを実装）
- ログで正常なクリーンアップを確認: `"Starting bridge cleanup"` → `"Bridge cleanup complete"`

## Phase 1 との違い

| 項目 | Phase 1 | Phase 1.5 (SDK) |
|------|---------|-----------------|
| コマンド | `tumiki-proxy` | `tumiki-proxy-sdk` |
| 対応トランスポート | stdio のみ | stdio + HTTP (StreamableHTTP/SSE) |
| 実装 | spawn + pipe | MCP SDK |
| HTTP Bridge 対応 | ❌ | ✅ |
| 認証対応 | ❌ | ✅ (API キー) |
| 自動フォールバック | ❌ | ✅ (StreamableHTTP → SSE) |
| 再入防止 | ❌ | ✅ (クリーンアップ時) |
| コード行数 | ~310行 | ~350行 |

## ライセンス

MIT License
