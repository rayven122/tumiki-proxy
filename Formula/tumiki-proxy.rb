class TumikiProxy < Formula
  desc "Transparent MCP logging proxy with multi-transport support"
  homepage "https://github.com/rayven122/tumiki-proxy"
  version "0.2.1"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/rayven122/tumiki-proxy/releases/download/v0.2.1/tumiki-proxy-macos-arm64"
      sha256 "3412fa759e827a183195dd339f030ebe9cf0b3a7bb87b18c5b87690b0033a79a"
    else
      url "https://github.com/rayven122/tumiki-proxy/releases/download/v0.2.1/tumiki-proxy-macos-x64"
      sha256 "0d1272992c83ad09df6807bcc881723740596ddd6c2ad88d40a3d28c9e2ea1e3"
    end
  end

  on_linux do
    if Hardware::CPU.intel?
      url "https://github.com/rayven122/tumiki-proxy/releases/download/v0.2.1/tumiki-proxy-linux-x64"
      sha256 "4e1d35471c6ff4fc5c74571b6d90a88417dc90ce9fd2d3a6bbc72a3e2ece71b7"
    end
  end

  def install
    # The downloaded file is named tumiki-proxy-macos-arm64 or tumiki-proxy-macos-x64
    # Find and rename to tumiki-proxy
    binary = Dir["tumiki-proxy-*"].first
    bin.install binary => "tumiki-proxy" if binary
  end

  test do
    assert_match "tumiki-proxy", shell_output("#{bin}/tumiki-proxy --help 2>&1", 1)
  end
end
