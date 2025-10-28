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

### 方法1: Homebrew（macOS/Linux - 推奨）

macOSまたはLinuxユーザーの場合、Homebrewで最も簡単にインストールできます：

```bash
# Formulaを直接指定してインストール
brew install https://raw.githubusercontent.com/rayven122/tumiki-proxy/main/Formula/tumiki-proxy.rb
```

詳細は[Homebrewインストールガイド](./claudedocs/HOMEBREW_INSTALL.md)を参照してください。

### 方法2: バイナリ配布

GitHubのReleasesページから、お使いのプラットフォーム用のビルド済みバイナリをダウンロード：

```bash
# macOS (ARM64)
curl -L -o tumiki-proxy https://github.com/rayven122/tumiki-proxy/releases/latest/download/tumiki-proxy-macos-arm64
chmod +x tumiki-proxy

# macOS (x64)
curl -L -o tumiki-proxy https://github.com/rayven122/tumiki-proxy/releases/latest/download/tumiki-proxy-macos-x64
chmod +x tumiki-proxy

# Linux (x64)
curl -L -o tumiki-proxy https://github.com/rayven122/tumiki-proxy/releases/latest/download/tumiki-proxy-linux-x64
chmod +x tumiki-proxy

# Windows (x64)
# PowerShellで実行:
Invoke-WebRequest -Uri "https://github.com/rayven122/tumiki-proxy/releases/latest/download/tumiki-proxy-win-x64.exe" -OutFile "tumiki-proxy.exe"
```

### 方法3: ソースからビルド

#### Bunを使用（推奨 - スタンドアロンバイナリ）

```bash
# リポジトリをクローン
git clone https://github.com/rayven122/tumiki-proxy.git
cd tumiki-proxy

# Bunで依存関係のインストールとビルド
bun install
bun run build

# スタンドアロンバイナリの生成
bun run build:binary
# → tumiki-proxy バイナリが生成されます
```

#### Node.jsを使用（従来の方法）

```bash
# リポジトリをクローン
git clone https://github.com/rayven122/tumiki-proxy.git
cd tumiki-proxy

# 依存関係のインストールとビルド
npm install
npm run build

# Node.js経由で実行
node dist/index.js [args...]
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
      "command": "./tumiki-proxy",
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
      "command": "./tumiki-proxy",
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

**注意**: バイナリ版を使用する場合は `./tumiki-proxy` のように相対パスまたは絶対パスを指定してください。Node.js版を使用する場合は `node dist/index.js` を command に指定し、args の最初に実際のコマンドを配置してください。

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

### Bunを使用した開発（推奨）

```bash
# 依存関係のインストール
bun install

# TypeScriptのビルド
bun run build

# ウォッチモード
bun run dev

# スタンドアロンバイナリの生成
bun run build:binary
# → tumiki-proxy バイナリが生成されます (57MB)
# → Bun runtime込みの完全なスタンドアロン実行ファイル
# → 外部ランタイム不要、高速起動

# ビルド成果物のクリーンアップ
rm -rf dist tumiki-proxy
```

### Node.jsを使用した開発

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

### 技術仕様

**バイナリビルド**:
- **ツール**: Bun 1.x
- **サイズ**: 約57MB (Bun runtime含む)
- **起動時間**: < 100ms
- **互換性**: macOS (x64/ARM64), Linux (x64), Windows (x64)
- **依存関係**: なし（完全スタンドアロン）

**Node.js版**:
- **要件**: Node.js >= 18.0.0
- **依存関係**: @modelcontextprotocol/sdk
- **実行**: `node dist/index.js`

## コントリビューション

コントリビューションを歓迎します！お気軽にPull Requestを送信してください。

## ライセンス

MIT License - 詳細はLICENSEファイルを参照してください

## 今後のロードマップ

- **クラウドストレージ連携**: クラウドストレージサービス（S3、GCSなど）へのHTTPアップロード
- **ログビューアー**: ログの表示と分析のためのElectronベースGUI
- **分析機能の強化**: MCPトラフィックパターンとパフォーマンスを分析する組み込みツール
- **パッケージ配布**: より簡単なインストールのためのNPMパッケージ公開
