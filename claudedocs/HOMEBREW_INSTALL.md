# Homebrew でのインストール手順

tumiki-proxyをHomebrewでインストールするためのユーザー向けガイドです。

## 前提条件

- macOS または Linux
- Homebrew がインストールされていること
  ```bash
  # Homebrewのインストール（未インストールの場合）
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  ```

## インストール方法

### Tapを追加してインストール（推奨）

最も簡単な方法です。完全URLを指定することで、`homebrew-` プレフィックスなしのリポジトリも使用できます。

```bash
# Tapを追加（初回のみ）
brew tap rayven122/tumiki-proxy https://github.com/rayven122/tumiki-proxy

# インストール
brew install tumiki-proxy

# バージョン確認
tumiki-proxy --version
```

**注意**: 完全URL（`https://github.com/...`）を指定することで、リポジトリ名に `homebrew-` プレフィックスは不要です。

## 使用方法

インストール後、`tumiki-proxy`コマンドがすぐに使用できます。

### stdio モード

```bash
export TUMIKI_LOG_FILE="./mcp-filesystem.log"
tumiki-proxy npx -y @modelcontextprotocol/server-filesystem /path/to/dir
```

### HTTP モード

```bash
export TUMIKI_LOG_FILE="./mcp-context7.log"
export CONTEXT7_API_KEY="your-api-key"
tumiki-proxy --http https://mcp.context7.com/mcp
```

## アップデート

```bash
# Tapを更新して最新版を取得
brew update

# tumiki-proxyをアップグレード
brew upgrade tumiki-proxy
```

## アンインストール

```bash
# tumiki-proxyをアンインストール
brew uninstall tumiki-proxy

# Tapも削除する場合（オプション）
brew untap rayven122/tumiki-proxy
```

## トラブルシューティング

### インストールエラー

#### SHA256 mismatch エラー

```
Error: SHA256 mismatch
Expected: ...
Actual: ...
```

**原因**: Formulaのチェックサムが古い可能性があります。

**解決策**:
```bash
# Homebrewのキャッシュをクリア
brew cleanup tumiki-proxy

# Formulaを更新
brew update

# 再インストール
brew reinstall tumiki-proxy
```

#### Permission denied エラー

```
Error: Permission denied
```

**解決策**:
```bash
# Homebrewディレクトリの権限を修正
sudo chown -R $(whoami) $(brew --prefix)/*
```

### 実行エラー

#### Command not found

```bash
tumiki-proxy: command not found
```

**解決策**:
```bash
# HomebrewのbinディレクトリがPATHに含まれているか確認
echo $PATH | grep -q "$(brew --prefix)/bin" || echo 'export PATH="$(brew --prefix)/bin:$PATH"' >> ~/.zshrc

# シェルを再起動
source ~/.zshrc
```

#### Binary format error (macOS)

```
bad CPU type in executable
```

**原因**: アーキテクチャが一致していません（ARM64 vs x64）。

**解決策**: Homebrewは自動的に適切なアーキテクチャを選択しますが、問題がある場合：

```bash
# インストール済みバージョンを確認
brew info tumiki-proxy

# アンインストールして再インストール
brew uninstall tumiki-proxy
brew install tumiki-proxy
```

## 詳細情報

### インストール先

```bash
# バイナリの場所を確認
which tumiki-proxy
# 通常: /opt/homebrew/bin/tumiki-proxy (Apple Silicon)
# 通常: /usr/local/bin/tumiki-proxy (Intel Mac)
```

### Formula情報

```bash
# インストール済み情報を表示
brew info tumiki-proxy

# 依存関係を確認
brew deps tumiki-proxy

# Formulaのソースを表示
brew cat tumiki-proxy
```

### ログとデバッグ

```bash
# 詳細なログを表示してインストール
brew install --verbose tumiki-proxy

# デバッグモード
brew install --debug tumiki-proxy
```

## よくある質問（FAQ）

**Q: Homebrewとバイナリ配布のどちらを使うべきですか？**

A: 以下の場合はHomebrewを推奨：
- macOS/Linuxユーザー
- パッケージ管理を一元化したい
- 自動アップデートが必要

以下の場合は直接バイナリをダウンロード：
- Windows ユーザー
- 特定バージョンを固定したい
- Homebrewをインストールしたくない

**Q: 複数バージョンを共存できますか？**

A: Homebrewでは通常、最新バージョンのみがインストールされます。特定バージョンが必要な場合は、直接バイナリをダウンロードしてください。

**Q: 自動アップデートは可能ですか？**

A: Homebrew自体は自動アップデートしませんが、以下のコマンドで定期的に更新できます：

```bash
# 週1回などcronで実行
brew update && brew upgrade tumiki-proxy
```

## サポート

問題が発生した場合：

1. [GitHub Issues](https://github.com/rayven122/tumiki-proxy/issues)で既知の問題を確認
2. 新しいIssueを作成（インストール環境の情報を含める）
3. [README](https://github.com/rayven122/tumiki-proxy#readme)で追加情報を確認
