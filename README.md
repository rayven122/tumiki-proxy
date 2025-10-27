# tumiki-proxy

MCP (Model Context Protocol) サーバーの透過的ロギングプロキシ。Claude Code とバックエンドサーバー間のすべてのMCPトラフィックをローカルファイルに記録し、デバッグと分析を支援します。

## 特徴

- **マルチトランスポート対応**: stdio、HTTP/StreamableHTTP、HTTP/SSEに対応
- **公式SDK使用**: `@modelcontextprotocol/sdk`をベースに構築
- **自動フォールバック**: StreamableHTTP → SSEの自動切り替え
- **認証対応**: HTTPベースサーバー向けAPIキーサポート
- **透過的**: MCPプロトコルに変更を加えないゼロインパクトラッパー
- **効率的**: 非同期バッファリングとバッチ処理による最小限のオーバーヘッド
- **型安全**: TypeScriptによる完全実装
- **統一ログ形式**: すべてのトランスポートでNDJSON形式を採用

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

stdin/stdout で通信するローカルのMCPサーバーの場合：

```bash
# ログファイルの場所を指定
export TUMIKI_LOG_FILE="./mcp-filesystem.log"

# stdioベースのMCPサーバーをプロキシ経由で実行
tumiki-proxy npx -y @modelcontextprotocol/server-filesystem /path/to/dir
```

### SSE・Streamable HTTP モード（リモートMCPサーバー）

HTTP経由でアクセス可能なリモートMCPサーバーの場合：

```bash
export TUMIKI_LOG_FILE="./mcp-context7.log"
export CONTEXT7_API_KEY="your-api-key"  # オプション
tumiki-proxy --http https://mcp.context7.com/mcp
```

## Claude Code 設定

`.mcp.json` ファイルを使った設定が推奨です。プロジェクトのルートディレクトリに `.mcp.json` を配置してください。

### 設定例（`.mcp.json`）

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
        "TUMIKI_LOG_FILE": "/tmp/mcp-filesystem.log"
      }
    },
    "context7": {
      "command": "tumiki-proxy",
      "args": [
        "--http",
        "https://mcp.context7.com/mcp"
      ],
      "env": {
        "TUMIKI_LOG_FILE": "/tmp/mcp-context7.log",
        "CONTEXT7_API_KEY": "your-api-key"
      }
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

### 認証用環境変数（SSE・Streamable HTTP モード）

| 変数 | 説明 |
|----------|-------------|
| `CONTEXT7_API_KEY` | Context7専用APIキー |
| `MCP_API_KEY` | 汎用MCP APIキー |
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

ログは改行区切りJSON（NDJSON）形式で記録されます：

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

### SSE・Streamable HTTP モード
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
         │ Streamable HTTP/SSE
         ↓
┌─────────────────┐
│  MCP Server     │
│  (HTTP)         │
└─────────────────┘
```

## トラブルシューティング

### SSE・Streamable HTTP モード接続確認

ログファイルでトランスポート選択を確認できます：

```bash
# Streamable HTTP が使用された場合
{"type":"info","message":"Connected using StreamableHTTP transport"}

# SSE にフォールバックした場合
{"type":"info","message":"StreamableHTTP connection failed, falling back to SSE transport"}
{"type":"info","message":"Connected using SSE transport"}
```

### HTTPサーバー接続エラー

**症状**: MCPサーバーが failed 状態

**診断と解決策**:

1. **APIキーの問題**（認証が必要なサーバーの場合）
   - サービスプロバイダーからAPIキーを取得
   - 適切な環境変数を設定（`CONTEXT7_API_KEY`、`MCP_API_KEY`、または `API_KEY`）
   - Claude Code を再起動

2. **トランスポート接続エラー**
   - ログファイルで詳細なエラーメッセージを確認
   - StreamableHTTP と SSE の両方が失敗している場合、ネットワーク接続を確認
   - ファイアウォール設定を確認

### ログファイルが作成されない

**確認事項**:
1. `TUMIKI_LOG_FILE` 環境変数が設定されているか
2. ログファイルのパスに書き込み権限があるか
3. ログファイルが既に別のプロセスで開かれていないか

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

## コントリビューション

コントリビューションを歓迎します！お気軽にPull Requestを送信してください。

## ライセンス

MIT License - 詳細はLICENSEファイルを参照してください

## 今後のロードマップ

- **クラウドストレージ連携**: クラウドストレージサービス（S3、GCSなど）へのHTTPアップロード
- **ログビューアー**: ログの表示と分析のためのElectronベースGUI
- **分析機能の強化**: MCPトラフィックパターンとパフォーマンスを分析する組み込みツール
- **パッケージ配布**: より簡単なインストールのためのNPMパッケージ公開
