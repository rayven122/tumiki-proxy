# tumiki-proxy - クラウド対応 MCP ロギングプロキシ 設計書（TypeScript 版）

## エグゼクティブサマリー

**プロジェクト名**: tumiki-proxy

**リポジトリ**: `github.com/your-org/tumiki-proxy` （新規作成）

**目的**: MCP サーバーを透過的にラップし、全ての JSON-RPC トラフィックをローカル＆クラウドにログ記録する軽量プロキシ

**主要機能**:

- ✨ **透過的ラッパー**: MCP サーバーのコマンドを差し替えるだけでログ記録
- 🪶 **軽量**: Phase 1 は~300 行のシンプルな実装
- 📁 **ローカルログ**: JSON 形式でファイルに記録（Phase 1）
- 🔄 **非同期バッファリング**: パフォーマンス影響なし
- ☁️ **クラウド対応**: HTTP/HTTPS 経由で任意のログサービスに送信（Phase 2）
- 🔁 **信頼性**: リトライ機構 + Dead Letter Queue（Phase 2）
- 🖥️ **GUI 対応**: Electron 統合で設定 UI・ログビューア提供（Phase 3）

**使用例（CLI）**:

```json
{
  "mcpServers": {
    "serena": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "tumiki-proxy",
        "uvx",
        "--from",
        "git+https://...",
        "serena",
        "start-mcp-server"
      ],
      "env": {
        "TUMIKI_LOG_ENDPOINT": "https://logs.example.com/api/v1/logs",
        "TUMIKI_LOG_AUTH_TOKEN": "your-api-token"
      }
    }
  }
}
```

**シンプルな使い方（推奨）**:

```bash
# ラッパースクリプト作成
cat > ~/.local/bin/tumiki-serena << 'EOF'
#!/bin/bash
export TUMIKI_LOG_FILE="$HOME/.tumiki-logs/serena.log"
export TUMIKI_LOG_ENDPOINT="https://logs.example.com/api/v1/logs"
export TUMIKI_LOG_AUTH_TOKEN="your-api-token"
exec npx tumiki-proxy uvx --from git+https://github.com/oraios/serena serena start-mcp-server "$@"
EOF
chmod +x ~/.local/bin/tumiki-serena
```

```json
{
  "mcpServers": {
    "serena": {
      "type": "stdio",
      "command": "tumiki-serena"
    }
  }
}
```

**技術スタック**:

- TypeScript 5.x
- Node.js 18+
- 依存: なし（標準ライブラリのみ、将来的に Electron 追加）

---

## 1. プロジェクト概要

### 1.1 背景と動機

**課題**:

- MCP サーバーのトラフィックを中央で管理したい
- クラウドログサービス（Loki、Elasticsearch 等）に統合したい
- ローカルファイルだけでは運用が煩雑

**解決策**:
tumiki-proxy は、任意の MCP サーバーをラップし、ログを柔軟な送信先に記録：

```
[Claude Code Client]
        ↓ stdin/stdout (JSON-RPC)
[tumiki-proxy] ← 透過的ラッパー (TypeScript/Node.js)
        ├─ 全トラフィックをログ記録
        ├─ ローカルファイルに保存
        ├─ クラウドHTTPエンドポイントに送信
        └─ メッセージをそのまま転送
                ↓ stdin/stdout
        [実MCPサーバー (uvx serena ...)]
```

### 1.2 設計原則

1. **透過性**: MCP プロトコルに一切変更を加えない
2. **柔軟性**: ローカル、クラウド、両方を選択可能
3. **信頼性**: ネットワーク障害でもログを失わない
4. **非同期性**: ログ送信がプロキシのパフォーマンスに影響しない
5. **シンプルさ**: 設定は環境変数のみ
6. **拡張性**: CLI → Electron GUI へスムーズに拡張可能

### 1.3 TypeScript 選択理由

**メリット**:

- Electron GUI とコードベース統一
- Node.js エコシステムの豊富なライブラリ
- 開発速度重視
- Web 版への拡張も可能

**トレードオフ**:

- Go より若干メモリ使用量増（~20MB vs ~6MB）
- バイナリサイズ大（ただし npx 配布で問題なし）

### 1.4 tumiki-mcp-http-adapter との関係

**完全独立**:

- **tumiki-proxy**: 新規リポジトリ、MCP ロギング専用
- **tumiki-mcp-http-adapter**: 既存リポジトリ、stdio↔HTTP 変換

**組み合わせ可能**:

```json
{
  "command": "npx",
  "args": [
    "tumiki-proxy",
    "tumiki-mcp-http",
    "--stdio",
    "npx",
    "@playwright/mcp"
  ]
}
```

---

## 2. アーキテクチャ設計

### 2.1 システムアーキテクチャ

```
┌─────────────────────────────────────────────────────┐
│              Claude Code Client                      │
│          (JSON-RPC 2.0 over stdio)                  │
└──────────────────┬──────────────────────────────────┘
                   │ stdin/stdout
                   ↓
┌─────────────────────────────────────────────────────┐
│          tumiki-proxy (TypeScript/Node.js)           │
│  ┌────────────────────────────────────────────┐    │
│  │         Transparent Proxy                   │    │
│  │  ┌──────────────┐    ┌──────────────┐     │    │
│  │  │ Read stdin   │    │ Write stdout │     │    │
│  │  │   ↓          │    │   ↑          │     │    │
│  │  │ Log Entry    │    │ Log Entry    │     │    │
│  │  │   ↓          │    │   ↑          │     │    │
│  │  │ Forward →────┼────┼→ Forward     │     │    │
│  │  └──────────────┘    └──────────────┘     │    │
│  └────────────────────────────────────────────┘    │
│                         ↓                            │
│  ┌────────────────────────────────────────────┐    │
│  │          Async Logger                       │    │
│  │   ┌──────────────────────────────────┐    │    │
│  │   │   Event Queue (1000)             │    │    │
│  │   └──────────┬───────────────────────┘    │    │
│  │              ↓                              │    │
│  │   ┌──────────────────────────────────┐    │    │
│  │   │   Batch Processor (100/100ms)    │    │    │
│  │   └──────────┬──────┬────────────────┘    │    │
│  │              ↓      ↓                      │    │
│  │   ┌─────────────┐ ┌──────────────┐       │    │
│  │   │File Dest    │ │HTTP Dest     │       │    │
│  │   │(local)      │ │(cloud)       │       │    │
│  │   │  + Retry    │ │  + Retry     │       │    │
│  │   │  + DLQ      │ │  + DLQ       │       │    │
│  │   └─────────────┘ └──────────────┘       │    │
│  └────────────────────────────────────────────┘    │
│                         ↓                            │
│  ┌────────────────────────────────────────────┐    │
│  │          Child Process (spawn)              │    │
│  │      (Backend MCP Server)                   │    │
│  └────────────────────────────────────────────┘    │
└──────────────────┬──────────────────────────────────┘
                   │ stdin/stdout
                   ↓
          [実MCPサーバー起動]
```

### 2.2 データフロー

#### シーケンス図: リクエスト/レスポンス + クラウド送信

```
Claude    tumiki-proxy    Backend MCP    Local File    HTTP Cloud
   |            |               |              |              |
   |--request-->|               |              |              |
   |            |--log entry--->|              |              |
   |            |  (buffered)   |              |              |
   |            |--forward----->|              |              |
   |            |               |              |              |
   |            |<--response----|              |              |
   |            |--log entry--->|              |              |
   |            |  (buffered)   |              |              |
   |<-response--|               |              |              |
   |            |               |              |              |
   |            |   [Batch Processor]          |              |
   |            |               |              |              |
   |            |--batch write-----------------+------------->|
   |            |  (async)      |              |              |
   |            |               |              |              |
```

### 2.3 プロジェクト構造

#### Phase 1（ローカルログのみ）

```
tumiki-proxy/  # 新規リポジトリ
├── src/
│   ├── index.ts              # CLIエントリーポイント（~50行）
│   ├── proxy/
│   │   └── proxy.ts          # Proxy実装（~80行）
│   ├── logger/
│   │   ├── entry.ts          # LogEntry型定義（~30行）
│   │   └── file-logger.ts    # FileLogger実装（~120行）
│   └── config/
│       └── config.ts         # 設定読み込み（~30行）
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE

合計: ~310行
```

#### Phase 2 拡張後（クラウド統合）

```
tumiki-proxy/
├── src/
│   ├── index.ts              # CLIエントリーポイント（~60行）
│   ├── proxy/
│   │   └── proxy.ts          # Proxy実装（~80行）
│   ├── logger/
│   │   ├── entry.ts          # LogEntry型定義（~40行）
│   │   ├── logger.ts         # Logger本体（~150行）
│   │   ├── destination.ts    # Destinationインターフェース（~30行）
│   │   ├── file-destination.ts    # FileDestination（~90行）
│   │   └── http-destination.ts    # HTTPDestination（~120行）
│   └── config/
│       └── config.ts         # 設定読み込み（~80行）
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE
└── .github/
    └── workflows/
        └── ci.yml

合計: ~650行
```

---

## 3. 詳細設計

### 3.1 Phase 1 実装（ローカルログのみ）

#### src/logger/entry.ts

```typescript
export interface LogEntry {
  timestamp: Date;
  type: "request" | "response" | "stderr" | "info" | "error";
  direction?: "client→backend" | "backend→client";
  backendCmd: string;
  message: unknown;
  raw?: string;
}

export interface LoggerConfig {
  filePath: string; // Phase 1: ローカルファイルのみ必須
  bufferSize: number;
  batchSize: number;
  batchTimeoutMs: number;
}

export const DEFAULT_LOGGER_CONFIG: Partial<LoggerConfig> = {
  bufferSize: 1000,
  batchSize: 100,
  batchTimeoutMs: 100,
};
```

#### src/logger/file-logger.ts（Phase 1: シンプル版）

```typescript
import { promises as fs } from "fs";
import { LogEntry, LoggerConfig } from "./entry";

export class FileLogger {
  private fileHandle: fs.FileHandle | null = null;
  private logQueue: LogEntry[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isClosing = false;
  private writeMutex = Promise.resolve();

  constructor(private config: LoggerConfig) {}

  async init(): Promise<void> {
    this.fileHandle = await fs.open(this.config.filePath, "a");
    this.startBatchTimer();
  }

  private startBatchTimer(): void {
    this.batchTimer = setInterval(() => {
      this.flush();
    }, this.config.batchTimeoutMs);
  }

  logRequest(raw: string): void {
    this.log({
      timestamp: new Date(),
      type: "request",
      direction: "client→backend",
      backendCmd: this.getBackendCmd(),
      message: this.parseJSON(raw),
      raw,
    });
  }

  logResponse(raw: string): void {
    this.log({
      timestamp: new Date(),
      type: "response",
      direction: "backend→client",
      backendCmd: this.getBackendCmd(),
      message: this.parseJSON(raw),
      raw,
    });
  }

  logStderr(line: string): void {
    this.log({
      timestamp: new Date(),
      type: "stderr",
      backendCmd: this.getBackendCmd(),
      message: line,
    });
  }

  logInfo(msg: string): void {
    this.log({
      timestamp: new Date(),
      type: "info",
      backendCmd: this.getBackendCmd(),
      message: msg,
    });
  }

  logError(msg: string): void {
    this.log({
      timestamp: new Date(),
      type: "error",
      backendCmd: this.getBackendCmd(),
      message: msg,
    });
  }

  private log(entry: LogEntry): void {
    if (this.isClosing) return;

    this.logQueue.push(entry);

    // バッファサイズ超過時はドロップ
    if (this.logQueue.length > this.config.bufferSize) {
      this.logQueue.shift();
      console.error("[tumiki-proxy] Log queue full, dropping oldest entry");
    }

    // バッチサイズ到達時は即座にフラッシュ
    if (this.logQueue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  private flush(): void {
    if (this.logQueue.length === 0 || !this.fileHandle) return;

    const batch = this.logQueue.splice(0);

    // 非同期書き込み（順序保証）
    this.writeMutex = this.writeMutex
      .then(async () => {
        for (const entry of batch) {
          const data = JSON.stringify(entry) + "\n";
          await this.fileHandle!.write(data);
        }
      })
      .catch((err) => {
        console.error("[tumiki-proxy] Failed to write logs:", err);
      });
  }

  async close(): Promise<void> {
    this.isClosing = true;

    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    this.flush();
    await this.writeMutex;

    if (this.fileHandle) {
      await this.fileHandle.close();
      this.fileHandle = null;
    }
  }

  private parseJSON(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  private getBackendCmd(): string {
    return process.argv[2] || "unknown";
  }
}
```

#### src/config/config.ts（Phase 1 版）

```typescript
import { LoggerConfig, DEFAULT_LOGGER_CONFIG } from "../logger/entry";

export function loadConfig(): LoggerConfig {
  const filePath = process.env.TUMIKI_LOG_FILE;

  if (!filePath) {
    throw new Error("TUMIKI_LOG_FILE environment variable is required");
  }

  return {
    filePath,
    bufferSize:
      parseInt(process.env.TUMIKI_LOG_BUFFER_SIZE || "") ||
      DEFAULT_LOGGER_CONFIG.bufferSize!,
    batchSize:
      parseInt(process.env.TUMIKI_LOG_BATCH_SIZE || "") ||
      DEFAULT_LOGGER_CONFIG.batchSize!,
    batchTimeoutMs:
      parseInt(process.env.TUMIKI_LOG_BATCH_TIMEOUT_MS || "") ||
      DEFAULT_LOGGER_CONFIG.batchTimeoutMs!,
  };
}
```

#### src/index.ts（Phase 1 版）

```typescript
#!/usr/bin/env node

import { FileLogger } from "./logger/file-logger";
import { TumikiProxy } from "./proxy/proxy";
import { loadConfig } from "./config/config";

async function main() {
  if (process.argv.length < 3) {
    console.error("Usage: tumiki-proxy <command> [args...]");
    console.error("Environment: TUMIKI_LOG_FILE=<path> (required)");
    process.exit(1);
  }

  const config = loadConfig();
  const logger = new FileLogger(config);
  await logger.init();

  const proxy = new TumikiProxy(logger);

  const [command, ...args] = process.argv.slice(2);
  await proxy.start(command, args);

  // シグナルハンドリング
  process.on("SIGINT", async () => {
    await proxy.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await proxy.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[tumiki-proxy] Fatal error:", err);
  process.exit(1);
});
```

---

### 3.2 Phase 2 拡張（フル実装）

Phase 2 では以下を追加：

#### 追加する型定義

```typescript
export interface LoggerConfig {
  // Phase 1
  filePath?: string; // オプショナルに変更

  // Phase 2 追加
  endpoint?: string;
  authType?: "bearer" | "apikey" | "basic";
  authToken?: string;
  dlqFilePath?: string;
  retryCount: number;
  timeoutSeconds: number;

  // 共通
  bufferSize: number;
  batchSize: number;
  batchTimeoutMs: number;
}
```

### 3.2 Destination 抽象化

#### src/logger/destination.ts

```typescript
import { LogEntry } from "./entry";

export interface Destination {
  send(entry: LogEntry): Promise<void>;
  sendWithRetry(entry: LogEntry, maxRetries: number): Promise<void>;
  close(): Promise<void>;
}
```

### 3.3 FileDestination 実装

#### src/logger/file-destination.ts

```typescript
import { promises as fs } from "fs";
import { Destination } from "./destination";
import { LogEntry } from "./entry";

export class FileDestination implements Destination {
  private fileHandle: fs.FileHandle | null = null;
  private writeMutex = Promise.resolve();

  constructor(private filePath: string) {}

  async init(): Promise<void> {
    this.fileHandle = await fs.open(this.filePath, "a");
  }

  async send(entry: LogEntry): Promise<void> {
    if (!this.fileHandle) {
      throw new Error("FileDestination not initialized");
    }

    // ミューテックスで順序保証
    this.writeMutex = this.writeMutex.then(async () => {
      const data = JSON.stringify(entry) + "\n";
      await this.fileHandle!.write(data);
    });

    await this.writeMutex;
  }

  async sendWithRetry(entry: LogEntry, maxRetries: number): Promise<void> {
    // ファイル書き込みはリトライ不要（即座に成功/失敗）
    await this.send(entry);
  }

  async close(): Promise<void> {
    await this.writeMutex; // 残りの書き込み完了を待つ
    if (this.fileHandle) {
      await this.fileHandle.close();
      this.fileHandle = null;
    }
  }
}
```

### 3.4 HTTPDestination 実装

#### src/logger/http-destination.ts

```typescript
import { Destination } from "./destination";
import { LogEntry } from "./entry";

export class HTTPDestination implements Destination {
  private controller = new AbortController();

  constructor(
    private endpoint: string,
    private authType?: "bearer" | "apikey" | "basic",
    private authToken?: string,
    private timeoutMs: number = 5000
  ) {}

  async send(entry: LogEntry): Promise<void> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // 認証ヘッダー
    if (this.authType && this.authToken) {
      switch (this.authType) {
        case "bearer":
          headers["Authorization"] = `Bearer ${this.authToken}`;
          break;
        case "apikey":
          headers["X-API-Key"] = this.authToken;
          break;
        case "basic":
          headers["Authorization"] = `Basic ${this.authToken}`;
          break;
      }
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(entry),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  async sendWithRetry(entry: LogEntry, maxRetries: number): Promise<void> {
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.send(entry);
        return; // 成功
      } catch (error) {
        lastError = error as Error;

        // Exponential backoff: 100ms, 200ms, 400ms
        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100 * (1 << i)));
        }
      }
    }

    throw lastError;
  }

  async close(): Promise<void> {
    this.controller.abort();
  }
}
```

### 3.5 Logger 本体（非同期処理）

#### src/logger/logger.ts

```typescript
import { promises as fs } from "fs";
import { Destination } from "./destination";
import { LogEntry, LoggerConfig } from "./entry";
import { FileDestination } from "./file-destination";
import { HTTPDestination } from "./http-destination";

export class Logger {
  private destinations: Destination[] = [];
  private dlqFileHandle: fs.FileHandle | null = null;
  private logQueue: LogEntry[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isClosing = false;

  constructor(private config: LoggerConfig) {}

  async init(): Promise<void> {
    // ローカルファイル送信先
    if (this.config.filePath) {
      const fileDest = new FileDestination(this.config.filePath);
      await fileDest.init();
      this.destinations.push(fileDest);
    }

    // HTTP送信先
    if (this.config.endpoint) {
      const httpDest = new HTTPDestination(
        this.config.endpoint,
        this.config.authType,
        this.config.authToken,
        this.config.timeoutSeconds * 1000
      );
      this.destinations.push(httpDest);
    }

    // Dead Letter Queue
    if (this.config.dlqFilePath) {
      this.dlqFileHandle = await fs.open(this.config.dlqFilePath, "a");
    }

    if (this.destinations.length === 0) {
      throw new Error("No destinations configured");
    }

    // バッチ処理タイマー開始
    this.startBatchTimer();
  }

  private startBatchTimer(): void {
    this.batchTimer = setInterval(() => {
      this.flush();
    }, this.config.batchTimeoutMs);
  }

  logRequest(raw: string): void {
    this.log({
      timestamp: new Date(),
      type: "request",
      direction: "client→backend",
      backendCmd: this.getBackendCmd(),
      message: this.parseJSON(raw),
      raw,
    });
  }

  logResponse(raw: string): void {
    this.log({
      timestamp: new Date(),
      type: "response",
      direction: "backend→client",
      backendCmd: this.getBackendCmd(),
      message: this.parseJSON(raw),
      raw,
    });
  }

  logStderr(line: string): void {
    this.log({
      timestamp: new Date(),
      type: "stderr",
      backendCmd: this.getBackendCmd(),
      message: line,
    });
  }

  logInfo(msg: string): void {
    this.log({
      timestamp: new Date(),
      type: "info",
      backendCmd: this.getBackendCmd(),
      message: msg,
    });
  }

  logError(msg: string): void {
    this.log({
      timestamp: new Date(),
      type: "error",
      backendCmd: this.getBackendCmd(),
      message: msg,
    });
  }

  private log(entry: LogEntry): void {
    if (this.isClosing) return;

    this.logQueue.push(entry);

    // バッファサイズ超過時はドロップ
    if (this.logQueue.length > this.config.bufferSize) {
      this.logQueue.shift();
      console.error("[tumiki-proxy] Log queue full, dropping oldest entry");
    }

    // バッチサイズ到達時は即座にフラッシュ
    if (this.logQueue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.logQueue.length === 0) return;

    const batch = this.logQueue.splice(0);

    // 各送信先に並行送信
    const results = await Promise.allSettled(
      this.destinations.map(async (dest) => {
        for (const entry of batch) {
          await dest.sendWithRetry(entry, this.config.retryCount);
        }
      })
    );

    // 失敗したエントリをDLQに保存
    const failedIndices = results
      .map((result, i) => (result.status === "rejected" ? i : -1))
      .filter((i) => i !== -1);

    if (failedIndices.length > 0 && this.dlqFileHandle) {
      for (const entry of batch) {
        const data = JSON.stringify(entry) + "\n";
        await this.dlqFileHandle.write(data);
      }
    }

    // エラーログ出力
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        console.error(
          `[tumiki-proxy] Failed to send to destination ${i}:`,
          result.reason
        );
      }
    });
  }

  async close(): Promise<void> {
    this.isClosing = true;

    // タイマー停止
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    // 残りのログをフラッシュ
    await this.flush();

    // 全送信先をクローズ
    await Promise.all(this.destinations.map((dest) => dest.close()));

    // DLQをクローズ
    if (this.dlqFileHandle) {
      await this.dlqFileHandle.close();
      this.dlqFileHandle = null;
    }
  }

  private parseJSON(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  private getBackendCmd(): string {
    return process.argv[2] || "unknown";
  }
}
```

### 3.6 Proxy 実装

#### src/proxy/proxy.ts

```typescript
import { spawn, ChildProcess } from "child_process";
import { Readable, Writable } from "stream";
import { Logger } from "../logger/logger";

export class TumikiProxy {
  private backendProcess: ChildProcess | null = null;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async start(command: string, args: string[]): Promise<void> {
    this.logger.logInfo(`Starting backend: ${command} ${args.join(" ")}`);

    // バックエンドプロセス起動
    this.backendProcess = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // stdin: Claude Code → log → backend
    this.pipeWithLog(process.stdin, this.backendProcess.stdin!, (data) =>
      this.logger.logRequest(data.toString())
    );

    // stdout: backend → log → Claude Code
    this.pipeWithLog(this.backendProcess.stdout!, process.stdout, (data) =>
      this.logger.logResponse(data.toString())
    );

    // stderr: backend → log → stderr
    this.backendProcess.stderr!.on("data", (data) => {
      const line = data.toString().trim();
      this.logger.logStderr(line);
      process.stderr.write(data);
    });

    // プロセス終了処理
    this.backendProcess.on("exit", async (code, signal) => {
      this.logger.logInfo(`Backend exited: code=${code}, signal=${signal}`);
      await this.close();
      process.exit(code || 0);
    });

    // エラー処理
    this.backendProcess.on("error", async (err) => {
      this.logger.logError(`Backend error: ${err.message}`);
      await this.close();
      process.exit(1);
    });
  }

  private pipeWithLog(
    source: Readable,
    destination: Writable,
    logCallback: (data: Buffer) => void
  ): void {
    source.on("data", (data: Buffer) => {
      logCallback(data);
      destination.write(data);
    });

    source.on("end", () => {
      destination.end();
    });
  }

  async close(): Promise<void> {
    if (this.backendProcess && !this.backendProcess.killed) {
      this.backendProcess.kill();
    }

    await this.logger.close();
  }
}
```

### 3.7 設定読み込み

#### src/config/config.ts

```typescript
import { LoggerConfig, DEFAULT_LOGGER_CONFIG } from "../logger/entry";

export function loadConfig(): LoggerConfig {
  return {
    // 送信先設定
    filePath: process.env.TUMIKI_LOG_FILE,
    endpoint: process.env.TUMIKI_LOG_ENDPOINT,
    authType: (process.env.TUMIKI_LOG_AUTH_TYPE as any) || undefined,
    authToken: process.env.TUMIKI_LOG_AUTH_TOKEN,

    // パフォーマンス設定
    bufferSize:
      parseInt(process.env.TUMIKI_LOG_BUFFER_SIZE || "") ||
      DEFAULT_LOGGER_CONFIG.bufferSize!,
    batchSize:
      parseInt(process.env.TUMIKI_LOG_BATCH_SIZE || "") ||
      DEFAULT_LOGGER_CONFIG.batchSize!,
    batchTimeoutMs:
      parseInt(process.env.TUMIKI_LOG_BATCH_TIMEOUT_MS || "") ||
      DEFAULT_LOGGER_CONFIG.batchTimeoutMs!,

    // 信頼性設定
    retryCount:
      parseInt(process.env.TUMIKI_LOG_RETRY_COUNT || "") ||
      DEFAULT_LOGGER_CONFIG.retryCount!,
    timeoutSeconds:
      parseInt(process.env.TUMIKI_LOG_TIMEOUT_SECONDS || "") ||
      DEFAULT_LOGGER_CONFIG.timeoutSeconds!,
    dlqFilePath: process.env.TUMIKI_LOG_DLQ_FILE,
  };
}
```

### 3.8 CLI エントリーポイント

#### src/index.ts

```typescript
#!/usr/bin/env node

import { Logger } from "./logger/logger";
import { TumikiProxy } from "./proxy/proxy";
import { loadConfig } from "./config/config";

async function main() {
  if (process.argv.length < 3) {
    console.error("Usage: tumiki-proxy <command> [args...]");
    process.exit(1);
  }

  const config = loadConfig();
  const logger = new Logger(config);
  await logger.init();

  const proxy = new TumikiProxy(logger);

  const [command, ...args] = process.argv.slice(2);
  await proxy.start(command, args);

  // シグナルハンドリング
  process.on("SIGINT", async () => {
    await proxy.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await proxy.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[tumiki-proxy] Fatal error:", err);
  process.exit(1);
});
```

---

## 4. 環境変数設定

### 4.1 完全な環境変数リスト

```bash
# ============= 送信先設定 =============

# ローカルファイル（オプション）
TUMIKI_LOG_FILE="/path/to/local.log"

# クラウドHTTPエンドポイント（オプション）
TUMIKI_LOG_ENDPOINT="https://logs.example.com/api/v1/logs"

# 認証設定
TUMIKI_LOG_AUTH_TYPE="bearer"  # bearer | apikey | basic | (empty)
TUMIKI_LOG_AUTH_TOKEN="your-api-token"

# ============= パフォーマンス設定 =============

# バッファサイズ（デフォルト: 1000）
TUMIKI_LOG_BUFFER_SIZE=1000

# バッチサイズ（デフォルト: 100）
TUMIKI_LOG_BATCH_SIZE=100

# バッチタイムアウト（ミリ秒、デフォルト: 100）
TUMIKI_LOG_BATCH_TIMEOUT_MS=100

# ============= 信頼性設定 =============

# リトライ回数（デフォルト: 3）
TUMIKI_LOG_RETRY_COUNT=3

# HTTPタイムアウト（秒、デフォルト: 5）
TUMIKI_LOG_TIMEOUT_SECONDS=5

# Dead Letter Queue（送信失敗時のバックアップ）
TUMIKI_LOG_DLQ_FILE="/var/log/tumiki-dlq.log"
```

### 4.2 設定例

#### 例 1: ラッパースクリプト（最もシンプル）

```bash
# ~/.local/bin/tumiki-serena
#!/bin/bash
export TUMIKI_LOG_FILE="$HOME/.tumiki-logs/serena.log"
export TUMIKI_LOG_ENDPOINT="https://logs.example.com/api/v1/logs"
export TUMIKI_LOG_AUTH_TOKEN="your-api-token"
exec npx tumiki-proxy uvx --from git+https://github.com/oraios/serena serena start-mcp-server "$@"
```

**Claude Code 設定**:

```json
{
  "mcpServers": {
    "serena": {
      "type": "stdio",
      "command": "tumiki-serena"
    }
  }
}
```

#### 例 2: シェル環境変数

```bash
# ~/.zshrc または ~/.bashrc
export TUMIKI_LOG_FILE="$HOME/.tumiki-logs/mcp.log"
export TUMIKI_LOG_ENDPOINT="https://logs.example.com/api/v1/logs"
export TUMIKI_LOG_AUTH_TOKEN="your-api-token"
```

**Claude Code 設定**:

```json
{
  "mcpServers": {
    "serena": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "tumiki-proxy",
        "uvx",
        "--from",
        "git+https://...",
        "serena",
        "start-mcp-server"
      ]
    }
  }
}
```

#### 例 3: Claude Code env 指定

```json
{
  "mcpServers": {
    "serena": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "tumiki-proxy",
        "uvx",
        "--from",
        "git+https://...",
        "serena",
        "start-mcp-server"
      ],
      "env": {
        "TUMIKI_LOG_ENDPOINT": "https://logs.example.com/api/v1/logs",
        "TUMIKI_LOG_AUTH_TYPE": "bearer",
        "TUMIKI_LOG_AUTH_TOKEN": "your-api-token",
        "TUMIKI_LOG_DLQ_FILE": "/tmp/tumiki-dlq.log"
      }
    }
  }
}
```

---

## 5. クラウドサービス統合例

### 5.1 Grafana Loki

```bash
TUMIKI_LOG_ENDPOINT="https://loki.example.com/loki/api/v1/push"
TUMIKI_LOG_AUTH_TYPE="bearer"
TUMIKI_LOG_AUTH_TOKEN="your-loki-token"
```

**ログフォーマット変換**: LogEntry を Loki 形式に変換するラッパーが必要（Phase 2）

### 5.2 Elasticsearch

```bash
TUMIKI_LOG_ENDPOINT="https://elasticsearch.example.com/_bulk"
TUMIKI_LOG_AUTH_TYPE="basic"
TUMIKI_LOG_AUTH_TOKEN="base64(username:password)"
```

### 5.3 汎用 HTTP エンドポイント

```bash
TUMIKI_LOG_ENDPOINT="https://your-service.com/logs"
TUMIKI_LOG_AUTH_TYPE="apikey"
TUMIKI_LOG_AUTH_TOKEN="your-custom-api-key"
```

---

## 6. 実装計画

### Phase 1: ローカルログプロキシ（1-2 日）

**目標**: 透過的な軽量プロキシ - ローカルファイルログのみ

**スコープ**:

- ✅ stdin/stdout 透過的転送
- ✅ ローカルファイルに JSON 形式でログ出力
- ✅ 非同期バッファリング（パフォーマンス影響なし）
- ❌ HTTP/クラウド送信（Phase 2 へ）
- ❌ DLQ（Phase 2 へ）
- ❌ リトライ機構（Phase 2 へ）

**実装タスク**:

- [ ] プロジェクト構造作成
- [ ] package.json, tsconfig.json 設定
- [ ] entry.ts 実装（型定義 - シンプル版）
- [ ] file-logger.ts 実装（ファイルログのみ）
- [ ] proxy.ts 実装
- [ ] config.ts 実装（環境変数: TUMIKI_LOG_FILE のみ）
- [ ] index.ts 実装（CLI エントリー）
- [ ] 手動テスト（ローカルファイル）
- [ ] README.md 作成

**完了基準**:

```bash
# ローカルファイルテスト
TUMIKI_LOG_FILE=/tmp/test.log npx tumiki-proxy uvx ... serena ...
tail -f /tmp/test.log | jq .

# 複数MCPサーバーで動作確認
TUMIKI_LOG_FILE=$HOME/.tumiki-logs/serena.log tumiki-serena
TUMIKI_LOG_FILE=$HOME/.tumiki-logs/playwright.log tumiki-playwright

# パフォーマンステスト（高負荷でもログ欠損なし）
```

### Phase 2: クラウド統合（2-3 日）

**目標**: HTTP/クラウド送信機能追加

**実装タスク**:

- [ ] destination.ts 実装（インターフェース追加）
- [ ] file-destination.ts 実装（Phase 1 のコードをリファクタ）
- [ ] http-destination.ts 実装
- [ ] logger.ts 拡張（複数送信先対応）
- [ ] DLQ 実装
- [ ] リトライ機構実装
- [ ] 設定拡張（認証、エンドポイント）
- [ ] 手動テスト（HTTP 送信、DLQ）
- [ ] クラウドサービス統合テスト（Loki, Elasticsearch）

**完了基準**:

```bash
# HTTP送信テスト
TUMIKI_LOG_ENDPOINT=https://logs.example.com/api/v1/logs \
TUMIKI_LOG_AUTH_TOKEN=token123 \
npx tumiki-proxy uvx ... serena ...

# ローカル + クラウド両方
TUMIKI_LOG_FILE=/tmp/test.log \
TUMIKI_LOG_ENDPOINT=https://logs.example.com/api/v1/logs \
npx tumiki-proxy uvx ... serena ...

# ネットワーク障害時のDLQ動作確認
```

### Phase 3: Electron GUI（2-3 日）

**実装タスク**:

- [ ] Electron プロジェクト追加（monorepo 化）
- [ ] 設定 UI 実装（React）
- [ ] ログビューア実装（リアルタイム表示）
- [ ] プロキシ管理機能（start/stop/restart）
- [ ] 設定ファイル管理（読み込み/保存）
- [ ] システムトレイ統合
- [ ] アプリケーションパッケージング

### Phase 4: リリース準備（1 日）

**実装タスク**:

- [ ] 単体テスト作成（Jest）
- [ ] 統合テスト作成
- [ ] ドキュメント完成（README, CONTRIBUTING）
- [ ] GitHub Actions 設定（CI/CD）
- [ ] npm publish 準備
- [ ] Electron 配布バイナリ作成（macOS/Windows/Linux）

---

## 7. テスト戦略

### 7.1 手動テスト

#### シナリオ 1: ローカルファイルのみ

```bash
TUMIKI_LOG_FILE=/tmp/tumiki-test.log \
npx tumiki-proxy uvx --from git+https://github.com/oraios/serena serena start-mcp-server

# Claude Codeから接続してツール実行

# ログ確認
cat /tmp/tumiki-test.log | jq .
```

#### シナリオ 2: HTTP 送信のみ

```bash
# テスト用HTTPサーバー起動（別ターミナル）
npx http-server -p 8080

TUMIKI_LOG_ENDPOINT=http://localhost:8080 \
npx tumiki-proxy uvx ... serena ...

# HTTPサーバーでPOSTリクエストを確認
```

#### シナリオ 3: ネットワーク障害

```bash
# 存在しないエンドポイント
TUMIKI_LOG_ENDPOINT=https://nonexistent.example.com \
TUMIKI_LOG_DLQ_FILE=/tmp/dlq.log \
npx tumiki-proxy uvx ... serena ...

# DLQにバックアップされることを確認
cat /tmp/dlq.log | jq .
```

### 7.2 単体テスト

```typescript
// src/logger/__tests__/http-destination.test.ts
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { createServer, Server } from "http";
import { HTTPDestination } from "../http-destination";
import { LogEntry } from "../entry";

describe("HTTPDestination", () => {
  let server: Server;
  let port: number;

  beforeAll((done) => {
    server = createServer((req, res) => {
      if (req.method === "POST") {
        res.writeHead(200);
        res.end("OK");
      }
    });
    server.listen(0, () => {
      port = (server.address() as any).port;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  it("should send log entry successfully", async () => {
    const dest = new HTTPDestination(
      `http://localhost:${port}`,
      "bearer",
      "test-token"
    );

    const entry: LogEntry = {
      timestamp: new Date(),
      type: "request",
      backendCmd: "test",
      message: "test message",
    };

    await expect(dest.send(entry)).resolves.not.toThrow();
  });

  it("should retry on failure", async () => {
    let attempts = 0;
    const failServer = createServer((req, res) => {
      attempts++;
      if (attempts < 3) {
        res.writeHead(500);
        res.end("Error");
      } else {
        res.writeHead(200);
        res.end("OK");
      }
    });

    await new Promise((resolve) => failServer.listen(0, resolve));
    const failPort = (failServer.address() as any).port;

    const dest = new HTTPDestination(`http://localhost:${failPort}`);
    const entry: LogEntry = {
      timestamp: new Date(),
      type: "test",
      backendCmd: "test",
      message: "test",
    };

    await dest.sendWithRetry(entry, 3);
    expect(attempts).toBe(3);

    await new Promise((resolve) => failServer.close(resolve));
  });
});
```

---

## 8. パフォーマンス考慮事項

### 8.1 オーバーヘッド分析

| 処理                     | レイテンシ                |
| ------------------------ | ------------------------- |
| JSON 解析                | ~0.1ms                    |
| キュー書き込み           | ~0.01ms（非ブロッキング） |
| パイプ転送               | ~0.1ms                    |
| **合計（プロキシ影響）** | **~0.21ms（ほぼゼロ）**   |

**バックグラウンド処理**:

- バッチ送信: 100 エントリごと or 100ms ごと
- HTTP 送信: 平均~50ms（ネットワーク次第）
- ローカルファイル: ~1ms

### 8.2 メモリ使用量

```
Node.js基本オーバーヘッド: ~15MB
ログキュー: 1000エントリ × ~1KB/エントリ = ~1MB
バッチバッファ: 100エントリ × ~1KB/エントリ = ~100KB

合計: ~16-20MB
```

### 8.3 スループット

- **想定**: 1000 req/s
- **キュー**: 1000 バッファ → 1 秒間バッファリング可能
- **バッチ送信**: 100 エントリ/100ms → 1000 エントリ/s = 十分対応

---

## 9. 運用ガイド

### 9.1 ログ監視

```bash
# リアルタイム監視（ローカルファイル）
tail -f ~/.tumiki-logs/*.log | jq .

# エラーのみ表示
cat ~/.tumiki-logs/*.log | jq 'select(.type == "error")'

# DLQ確認（送信失敗したログ）
cat /tmp/tumiki-dlq.log | jq .
```

### 9.2 トラブルシューティング

#### 問題: クラウドに送信されない

```bash
# 1. 環境変数確認
echo $TUMIKI_LOG_ENDPOINT
echo $TUMIKI_LOG_AUTH_TOKEN

# 2. DLQを確認
cat /tmp/tumiki-dlq.log | jq .

# 3. 手動でcurlテスト
curl -X POST https://logs.example.com/api/v1/logs \
  -H "Authorization: Bearer $TUMIKI_LOG_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"test": "message"}'
```

#### 問題: パフォーマンス低下

```bash
# バッファサイズを増やす
export TUMIKI_LOG_BUFFER_SIZE=5000
export TUMIKI_LOG_BATCH_SIZE=500
```

---

## 10. Electron GUI 統合（Phase 2）

### 10.1 プロジェクト構造（拡張後）

```
tumiki-proxy/
├── packages/
│   ├── cli/              # 既存CLI（Phase 1）
│   │   ├── src/
│   │   └── package.json
│   └── gui/              # Electron GUI（Phase 2）
│       ├── src/
│       │   ├── main/
│       │   │   ├── index.ts
│       │   │   └── proxy-manager.ts
│       │   └── renderer/
│       │       ├── App.tsx
│       │       ├── components/
│       │       └── styles/
│       └── package.json
├── pnpm-workspace.yaml
└── package.json
```

### 10.2 GUI 機能概要

**設定 UI**:

- MCP サーバー設定管理
- ログ送信先設定（ローカル/クラウド）
- 認証情報管理
- パフォーマンス設定調整

**ログビューア**:

- リアルタイムログ表示
- フィルタリング（type, direction, backend）
- 検索機能
- エクスポート機能

**プロキシ管理**:

- プロキシ起動/停止/再起動
- ステータス表示
- エラー通知

---

## 11. まとめ

### プロジェクトの価値

✅ **クラウド対応**: 任意のログサービスに統合
✅ **柔軟性**: ローカル、クラウド、両方を選択可能
✅ **信頼性**: リトライ + DLQ でログを失わない
✅ **非同期**: パフォーマンス影響ゼロ
✅ **軽量**: ~600 行のシンプルな実装
✅ **透過的**: MCP プロトコルに変更なし
✅ **拡張性**: CLI → Electron GUI へスムーズに拡張

### TypeScript 選択のメリット

🎯 **開発速度**: 型安全で迅速な開発
🎯 **エコシステム**: npm 豊富なライブラリ
🎯 **GUI 統合**: Electron とコードベース統一
🎯 **保守性**: 広く使われる技術スタックで長期保守容易

### 次のステップ

1. ✅ 詳細設計完了（TypeScript 版、段階的実装）
2. ⏳ **新規リポジトリ作成**: `github.com/your-org/tumiki-proxy`
3. ⏳ **Phase 1 実装**: ローカルログプロキシ（1-2 日）
   - 透過的 stdin/stdout 転送
   - ローカルファイルログ出力
   - 非同期バッファリング
   - **合計: ~310 行**
4. ⏳ **Phase 2 実装**: クラウド統合（2-3 日）
   - HTTP/HTTPS 送信
   - DLQ + リトライ機構
   - 複数送信先対応
5. ⏳ **Phase 3 実装**: Electron GUI（2-3 日）
   - 設定 UI + ログビューア
6. ⏳ **Phase 4 リリース**: テスト + npm publish（1 日）

---

## Phase 1 優先メリット

✅ **即座に使える**: 1-2 日で実用可能なプロキシ
✅ **シンプル**: ~310 行で理解しやすい
✅ **リスク低減**: 段階的実装で各フェーズを検証
✅ **学習曲線**: TypeScript/Node.js エコシステムを段階的に習得

この設計により、MCP エコシステムに**段階的にロギング機能**を提供し、将来的なクラウド統合・GUI 化もスムーズに実現できます 🚀
