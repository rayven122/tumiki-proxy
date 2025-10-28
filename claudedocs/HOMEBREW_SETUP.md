# Homebrew Formula セットアップガイド

tumiki-proxyのHomebrew配布を設定するための手順です。

## 前提条件

- GitHub Releasesでバイナリが公開されていること
- リリースタグが`v0.2.0`の形式であること
- 以下のバイナリファイルが含まれていること：
  - `tumiki-proxy-macos-arm64`
  - `tumiki-proxy-macos-x64`
  - `tumiki-proxy-linux-x64`

## セットアップ手順

### 1. SHA256チェックサムの計算

リリース後、各バイナリのSHA256を計算します：

```bash
# macOS ARM64
curl -L https://github.com/rayven122/tumiki-proxy/releases/download/v0.2.0/tumiki-proxy-macos-arm64 | shasum -a 256

# macOS x64
curl -L https://github.com/rayven122/tumiki-proxy/releases/download/v0.2.0/tumiki-proxy-macos-x64 | shasum -a 256

# Linux x64
curl -L https://github.com/rayven122/tumiki-proxy/releases/download/v0.2.0/tumiki-proxy-linux-x64 | shasum -a 256
```

または、スクリプトを使用：

```bash
./scripts/generate-sha256.sh v0.2.0
```

### 2. Formulaファイルの更新

`Formula/tumiki-proxy.rb`の以下の部分を実際のSHA256で置き換えます：

```ruby
sha256 "PUT_ARM64_SHA256_HERE"    # ARM64用
sha256 "PUT_X64_SHA256_HERE"      # x64用
sha256 "PUT_LINUX_SHA256_HERE"    # Linux用
```

### 3. Gitへのコミットとプッシュ

Formulaファイルをリポジトリに追加します：

```bash
git add Formula/tumiki-proxy.rb
git commit -m "Add Homebrew formula"
git push origin main
```

### 4. ユーザーへのインストール手順

現在のリポジトリを完全URLで指定することで、`homebrew-` プレフィックスなしでTapとして使用できます：

```bash
# Tapを追加（完全URLを指定）
brew tap rayven122/tumiki-proxy https://github.com/rayven122/tumiki-proxy

# インストール
brew install tumiki-proxy

# アップデート
brew update
brew upgrade tumiki-proxy
```

**重要**: 完全URL（`https://github.com/...`）を指定することで、リポジトリ名を変更する必要はありません。

#### 独自Tapリポジトリを作成する場合（オプション）

短いコマンド（`brew tap rayven122/tumiki`）を使いたい場合のみ、`homebrew-` プレフィックス付きの独自Tapリポジトリを作成してください：

1. GitHubで新しいリポジトリ `homebrew-tumiki` を作成
2. `Formula/tumiki-proxy.rb` をそこに配置
3. ユーザーは以下でインストール可能：

```bash
brew tap rayven122/tumiki
brew install tumiki-proxy
```

**通常は不要**: 完全URL指定で現在のリポジトリをそのまま使えるため、別のTapリポジトリを作成する必要はありません。

## バージョン更新手順

新しいバージョンをリリースする場合：

1. **新しいリリースを作成**
   ```bash
   git tag v0.3.0
   git push origin v0.3.0
   ```

2. **GitHub Actionsで自動ビルド**（.github/workflows/release.ymlが設定されている場合）

3. **SHA256を計算**
   ```bash
   ./scripts/generate-sha256.sh v0.3.0
   ```

4. **Formulaを更新**
   ```ruby
   version "0.3.0"
   url "https://github.com/rayven122/tumiki-proxy/releases/download/v0.3.0/..."
   sha256 "新しいSHA256"
   ```

5. **コミットとプッシュ**
   ```bash
   git add Formula/tumiki-proxy.rb
   git commit -m "Bump version to 0.3.0"
   git push
   ```

## テスト

Formulaが正しく動作するかテスト：

```bash
# ローカルでテスト
brew install --build-from-source Formula/tumiki-proxy.rb

# 実行確認
tumiki-proxy --help

# アンインストール
brew uninstall tumiki-proxy
```

## トラブルシューティング

### SHA256エラー

```
Error: SHA256 mismatch
```

**解決策**: SHA256を再計算して更新してください。

### ダウンロードエラー

```
Error: Failed to download resource
```

**解決策**:
- リリースタグが正しいか確認
- バイナリファイル名が正しいか確認
- GitHub Releasesでファイルが公開されているか確認

### インストールエラー

```
Error: No such file or directory
```

**解決策**: `install`メソッドのファイル名パターンを確認してください。

## 参考資料

- [Homebrew Formula Cookbook](https://docs.brew.sh/Formula-Cookbook)
- [Homebrew Taps](https://docs.brew.sh/Taps)
- [Binary Formula](https://docs.brew.sh/Formula-Cookbook#binary-formula)
