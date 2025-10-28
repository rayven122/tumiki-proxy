# Homebrew Tap リポジトリ作成手順

Homebrewでの配布には、専用のTapリポジトリが**必須**です。以下の手順で作成してください。

## 背景

Homebrew v3.0以降、セキュリティ上の理由により、直接URLからのFormulaインストールが制限されています。Formulaを配布するには、GitHubにTapリポジトリを作成する必要があります。

## 手順

### 1. GitHubでリポジトリを作成

1. GitHubで新しいリポジトリを作成
   - **リポジトリ名**: `homebrew-tumiki` （**必須**: `homebrew-` プレフィックス）
   - **説明**: "Homebrew tap for tumiki-proxy"
   - **公開設定**: Public
   - **README**: 追加しない（後で追加）

2. リポジトリURL: `https://github.com/rayven122/homebrew-tumiki`

### 2. ローカルでTapリポジトリをセットアップ

```bash
# 新しいディレクトリを作成
cd ~/Documents/app/rayven/
git clone https://github.com/rayven122/homebrew-tumiki.git
cd homebrew-tumiki

# Formulaディレクトリを作成
mkdir -p Formula

# tumiki-proxyリポジトリからFormulaをコピー
cp ../tumiki-proxy/Formula/tumiki-proxy.rb Formula/

# README作成
cat > README.md <<'EOF'
# Tumiki Homebrew Tap

Homebrew tap for [tumiki-proxy](https://github.com/rayven122/tumiki-proxy)

## Installation

```bash
brew tap rayven122/tumiki
brew install tumiki-proxy
```

## What is tumiki-proxy?

Transparent MCP logging proxy with multi-transport support (stdio, HTTP/StreamableHTTP, HTTP/SSE).

See the [main repository](https://github.com/rayven122/tumiki-proxy) for details.
EOF

# Gitコミット
git add Formula/tumiki-proxy.rb README.md
git commit -m "Add tumiki-proxy formula

Initial formula for tumiki-proxy v0.2.0

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# プッシュ
git push origin main
```

### 3. ユーザーへのインストール手順（完成）

Tapリポジトリ作成後、ユーザーは以下のコマンドでインストールできます：

```bash
# Tapを追加
brew tap rayven122/tumiki

# インストール
brew install tumiki-proxy

# アップデート
brew update
brew upgrade tumiki-proxy

# アンインストール
brew uninstall tumiki-proxy
brew untap rayven122/tumiki
```

### 4. メインリポジトリのドキュメントを更新

`tumiki-proxy`リポジトリのREADMEとドキュメントを以下のように更新：

```bash
cd ../tumiki-proxy

# README.mdを更新
# "### 方法1: Homebrew" セクションを以下に置き換え：
```

```markdown
### 方法1: Homebrew（macOS/Linux - 推奨）

macOSまたはLinuxユーザーの場合、Homebrewで最も簡単にインストールできます：

\`\`\`bash
# Tapを追加
brew tap rayven122/tumiki

# インストール
brew install tumiki-proxy
\`\`\`

詳細は[Homebrewインストールガイド](./claudedocs/HOMEBREW_INSTALL.md)を参照してください。
```

## バージョン更新時の手順

新しいバージョンをリリースする場合：

### 1. メインリポジトリでリリース

```bash
cd tumiki-proxy

# バージョン更新
# package.json の version を更新

# タグ作成
git tag -a v0.3.0 -m "Release v0.3.0"
git push origin v0.3.0

# GitHub Actions が自動でバイナリをビルド
```

### 2. SHA256を計算

```bash
# リリース完了後
./scripts/generate-sha256.sh v0.3.0
```

### 3. Tap リポジトリのFormula を更新

```bash
cd ../homebrew-tumiki

# Formula/tumiki-proxy.rb を編集
# - version を更新
# - url を新しいバージョンに更新
# - sha256 を新しい値に更新

git add Formula/tumiki-proxy.rb
git commit -m "Bump tumiki-proxy to v0.3.0"
git push origin main
```

### 4. ユーザーが自動的にアップデート可能

```bash
brew update  # Tapの変更を取得
brew upgrade tumiki-proxy  # 新しいバージョンをインストール
```

## トラブルシューティング

### "repository not found" エラー

```
Error: Failure while executing; `git clone https://github.com/rayven122/homebrew-tumiki ...
remote: Repository not found.
```

**原因**: `homebrew-tumiki` リポジトリがまだ作成されていない

**解決策**: 上記の手順1-2を実行してリポジトリを作成

### Formula が見つからない

```
Error: No available formula with the name "tumiki-proxy"
```

**原因**: Formula が `Formula/` ディレクトリに配置されていない

**解決策**: `Formula/tumiki-proxy.rb` の配置を確認

### SHA256 mismatch エラー

```
Error: SHA256 mismatch
```

**原因**: Formula内のSHA256が実際のバイナリと一致していない

**解決策**:
```bash
./scripts/generate-sha256.sh v0.2.0
# 出力されたSHA256でFormula/tumiki-proxy.rb を更新
```

## 利点

### Tapリポジトリを使う利点

1. **簡潔なコマンド**: `brew install tumiki-proxy`
2. **自動アップデート**: `brew update` でFormula更新を自動取得
3. **Homebrew標準**: 公式サポートされた方法
4. **信頼性**: キャッシング、バージョン管理、ロールバックが可能
5. **発見しやすさ**: `brew search tumiki` で検索可能

### メインリポジトリとの分離

- Formulaの更新がメインリポジトリのコミット履歴を汚さない
- バイナリリリースとFormula更新を独立して管理できる
- 複数のツールがある場合、すべてを1つのTapで管理可能

## 参考資料

- [Homebrew Taps 公式ドキュメント](https://docs.brew.sh/Taps)
- [Formula Cookbook](https://docs.brew.sh/Formula-Cookbook)
- [How to Create and Maintain a Tap](https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap)
