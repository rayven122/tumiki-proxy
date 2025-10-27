# tumiki-proxy

MCP (Model Context Protocol) サーバーの透過的ロギングプロキシ。Claude Code とバックエンドサーバー間のすべてのMCPトラフィックをローカルファイルに記録し、デバッグと分析を支援します。

## 特徴

- **マルチトランスポート**: stdio、HTTP/StreamableHTTP、HTTP/SSEに対応
- **公式SDK**: `@modelcontextprotocol/sdk`を使用
- **自動フォールバック**: StreamableHTTP → SSEの自動切り替え
- **認証対応**: HTTPベースサーバー向けAPIキーサポート
- **透過的**: ゼロインパクトラッパー - MCPプロトコルに変更なし
- **効率的**: 非同期バッファリングとバッチ処理（最小限のオーバーヘッド）
- **型安全**: TypeScriptによる完全実装
- **統一ログ形式**: すべてのトランスポートでNDJSON形式

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

## 使用方法

### stdio モード（ローカルMCPサーバー）

```bash
# ログファイルの場所を指定
export TUMIKI_LOG_FILE="./mcp-filesystem.log"

# stdioベースのMCPサーバーをプロキシ経由で実行
tumiki-proxy npx -y @modelcontextprotocol/server-filesystem /path/to/dir
```

### HTTP bridge モード（HTTPベースのMCPサーバー）

```bash
export TUMIKI_LOG_FILE="./mcp-context7.log"
export CONTEXT7_API_KEY="your-api-key"  # オプション
tumiki-proxy --http https://mcp.context7.com/mcp
```

## Claude Code MCP設定

### stdio サーバー

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "tumiki-proxy",
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

### HTTP bridge サーバー

```json
{
  "mcpServers": {
    "context7": {
      "command": "tumiki-proxy",
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

**wrapper-filesystem.sh:**
```bash
#!/bin/bash
export TUMIKI_LOG_FILE="${HOME}/.mcp-logs/filesystem.log"
exec tumiki-proxy npx -y @modelcontextprotocol/server-filesystem "$@"
```

**MCP設定:**
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "/path/to/wrapper-filesystem.sh",
      "args": ["/path/to/dir"]
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

### HTTP bridge モード用の認証環境変数

| 変数 | 説明 |
|----------|-------------|
| `CONTEXT7_API_KEY` | Context7 専用APIキー |
| `MCP_API_KEY` | 汎用 MCP APIキー |
| `API_KEY` | フォールバック用APIキー |

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
{"timestamp":"2024-01-15T10:30:00.150Z","type":"info","backendCmd":"--http","message":"Connected using StreamableHTTP transport"}
```

### ログエントリタイプ

- `request`: クライアント → バックエンド（Claude Code → MCPサーバー）
- `response`: バックエンド → クライアント（MCPサーバー → Claude Code）
- `stderr`: バックエンドのエラー出力（stdioモードのみ）
- `info`: プロキシのライフサイクルイベント（起動、終了、接続情報）
- `error`: プロキシのエラー

## アーキテクチャ

### stdio モード
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
│  │ spawn + pipe │  │
│  └──────────────┘  │
└────────┬───────────┘
         │ stdin/stdout (透過的)
         ↓
┌─────────────────┐
│  MCP Server     │
│  (stdio)        │
└─────────────────┘
```

### HTTP bridge モード
```
┌─────────────┐
│ Claude Code │
└──────┬──────┘
       │ stdin/stdout
       ↓
┌────────────────────┐
│  tumiki-proxy      │
│  ┌──────────────┐  │
│  │ FileLogger   │──┼─→ ローカルログファイル (NDJSON)
│  └──────────────┘  │
│  ┌──────────────┐  │
│  │ Stdio Server │  │
│  │ Transport    │  │
│  └──────────────┘  │
│  ┌──────────────┐  │
│  │StreamableHTTP│  │
│  │/SSE Client   │  │
│  └──────────────┘  │
└────────┬───────────┘
         │ HTTP/SSE
         ↓
┌─────────────────┐
│  MCP Server     │
│  (HTTP)         │
└─────────────────┘
```

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

## 開発

```bash
# 依存関係のインストール
npm install

# TypeScriptのビルド
npm run build

# ウォッチモード
npm run dev

# ビルド成果物のクリーンアップ
rm -rf dist
```

## ライセンス

MIT License - 詳細はLICENSEファイルを参照

## 今後のロードマップ

- **Phase 2**: クラウドストレージへのHTTPアップロード（S3、GCSなど）
- **Phase 3**: ログビューアと分析用Electron GUI
- **Phase 4**: パッケージングとリリース管理
