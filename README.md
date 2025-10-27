# tumiki-proxy

MCP (Model Context Protocol) サーバーの透過的ロギングプロキシ。Claude Code とバックエンドサーバー間のすべてのMCPトラフィックをローカルファイルに記録し、デバッグと分析を支援します。

## 機能

### Phase 1 (stdio専用、`tumiki-proxy`)
- **透過的**: ゼロインパクトラッパー - あらゆるstdioベースのMCPサーバーに対応
- **効率的**: 非同期バッファリングとバッチ処理（最小限のオーバーヘッド）
- **シンプル**: 環境変数1つで設定完了
- **軽量**: 約310行、外部依存なし
- **型安全**: TypeScriptによる完全実装

### Phase 1.5 (SDKベース、`tumiki-proxy-sdk`)
- **マルチトランスポート**: stdio、HTTP/StreamableHTTP、HTTP/SSEに対応
- **公式SDK**: `@modelcontextprotocol/sdk`を使用
- **自動フォールバック**: StreamableHTTP → SSEの自動切り替え
- **認証対応**: HTTPベースサーバー向けAPIキーサポート
- **高度な機能**: HTTPブリッジとサーバーモードについては[README-SDK.md](./README-SDK.md)を参照

## インストール

```bash
# リポジトリをクローン
git clone https://github.com/yourusername/tumiki-proxy.git
cd tumiki-proxy

# 依存関係のインストールとビルド
npm install
npm run build

# オプション: グローバルインストール
npm install -g .
```

**注意**: Phase 1.5には`@modelcontextprotocol/sdk`が必要です（依存関係に含まれています）。

## 使用方法

### Phase 1: 基本的なstdioモード（`tumiki-proxy`）

```bash
# ログファイルの場所を指定
export TUMIKI_LOG_FILE="./mcp-traffic.log"

# stdioベースのMCPサーバーをプロキシ経由で実行
tumiki-proxy npx -y @modelcontextprotocol/server-everything
```

### Phase 1.5: 高度なモード（`tumiki-proxy-sdk`）

#### stdio モード（Phase 1と同じ）
```bash
export TUMIKI_LOG_FILE="./mcp-traffic.log"
tumiki-proxy-sdk npx -y @modelcontextprotocol/server-filesystem /path
```

#### HTTP ブリッジモード（HTTPベースのMCPサーバー用）
```bash
export TUMIKI_LOG_FILE="./mcp-context7.log"
export CONTEXT7_API_KEY="your-api-key"
tumiki-proxy-sdk --http https://mcp.context7.com/mcp
```

Phase 1.5の完全なドキュメント（HTTPサーバーモード、認証など）については、[README-SDK.md](./README-SDK.md)を参照してください。

### Claude Code MCP設定

#### Phase 1: stdio専用サーバー

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

#### Phase 1.5: stdioサーバー（Phase 1と互換性あり）

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "tumiki-proxy-sdk",
      "args": [
        "npx",
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/path/to/dir"
      ],
      "env": {
        "TUMIKI_LOG_FILE": "/path/to/mcp-filesystem.log"
      }
    }
  }
}
```

#### Phase 1.5: HTTPブリッジモード（HTTPベースサーバー用）

```json
{
  "mcpServers": {
    "context7": {
      "command": "tumiki-proxy-sdk",
      "args": ["--http", "https://mcp.context7.com/mcp"],
      "env": {
        "TUMIKI_LOG_FILE": "/path/to/mcp-context7.log",
        "CONTEXT7_API_KEY": "your-api-key"
      }
    }
  }
}
```

### ラッパースクリプト（推奨）

各MCPサーバー用にラッパースクリプトを作成:

**wrapper-everything.sh:**
```bash
#!/bin/bash
export TUMIKI_LOG_FILE="${HOME}/.mcp-logs/everything.log"
exec tumiki-proxy npx -y @modelcontextprotocol/server-everything "$@"
```

**MCP設定:**
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

## 設定

### 環境変数

| 変数 | 必須 | デフォルト | 説明 |
|----------|----------|---------|-------------|
| `TUMIKI_LOG_FILE` | はい | - | ログファイルのパス |
| `TUMIKI_LOG_BUFFER_SIZE` | いいえ | 1000 | ドロップ前のキュー内の最大エントリ数 |
| `TUMIKI_LOG_BATCH_SIZE` | いいえ | 100 | このサイズに達したらフラッシュ |
| `TUMIKI_LOG_BATCH_TIMEOUT_MS` | いいえ | 100 | フラッシュ間隔（ミリ秒） |

### カスタム設定の例

```bash
export TUMIKI_LOG_FILE="./mcp.log"
export TUMIKI_LOG_BUFFER_SIZE=500
export TUMIKI_LOG_BATCH_SIZE=50
export TUMIKI_LOG_BATCH_TIMEOUT_MS=200

tumiki-proxy your-mcp-server
```

## ログフォーマット

ログは改行区切りJSON（NDJSON）形式で記録されます:

```json
{"timestamp":"2024-01-15T10:30:00.000Z","type":"request","direction":"client→backend","backendCmd":"npx","message":{"jsonrpc":"2.0","id":1,"method":"tools/list"},"raw":"{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}"}
{"timestamp":"2024-01-15T10:30:00.100Z","type":"response","direction":"backend→client","backendCmd":"npx","message":{"jsonrpc":"2.0","id":1,"result":{"tools":[...]}},"raw":"{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"tools\":[...]}}"}
{"timestamp":"2024-01-15T10:30:00.150Z","type":"stderr","backendCmd":"npx","message":"Debug: Tool loaded"}
{"timestamp":"2024-01-15T10:30:00.200Z","type":"info","backendCmd":"npx","message":"Backend exited: code=0, signal=null"}
```

### ログエントリタイプ

- `request`: クライアント → バックエンド（Claude Code → MCPサーバー）
- `response`: バックエンド → クライアント（MCPサーバー → Claude Code）
- `stderr`: バックエンドのエラー出力
- `info`: プロキシのライフサイクルイベント（起動、終了）
- `error`: プロキシのエラー

## 開発

```bash
# 依存関係のインストール
npm install

# TypeScriptのビルド
npm run build

# ビルド成果物のクリーンアップ
npm run clean
```

## アーキテクチャ

```
┌─────────────┐
│ Claude Code │
└──────┬──────┘
       │ stdin/stdout (JSON-RPC)
       ↓
┌────────────────────┐
│  tumiki-proxy      │
│  ┌──────────────┐  │
│  │ FileLogger   │──┼─→ ローカルログファイル (NDJSON)
│  └──────────────┘  │
│  ┌──────────────┐  │
│  │ TumikiProxy  │  │
│  └──────────────┘  │
└────────┬───────────┘
         │ stdin/stdout (透過的)
         ↓
┌─────────────────┐
│   MCP Server    │
└─────────────────┘
```

## ライセンス

MIT License - 詳細はLICENSEファイルを参照

## 今後のロードマップ

- **Phase 2**: クラウドストレージへのHTTPアップロード（S3、GCSなど）
- **Phase 3**: ログビューアと分析用Electron GUI
- **Phase 4**: パッケージングとリリース管理
