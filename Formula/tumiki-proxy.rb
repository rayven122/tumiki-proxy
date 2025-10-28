class TumikiProxy < Formula
  desc "Transparent MCP logging proxy with multi-transport support"
  homepage "https://github.com/rayven122/tumiki-proxy"
  version "0.2.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/rayven122/tumiki-proxy/releases/download/v0.2.0/tumiki-proxy-macos-arm64"
      sha256 "0019dfc4b32d63c1392aa264aed2253c1e0c2fb09216f8e2cc269bbfb8bb49b5"
    else
      url "https://github.com/rayven122/tumiki-proxy/releases/download/v0.2.0/tumiki-proxy-macos-x64"
      sha256 "0019dfc4b32d63c1392aa264aed2253c1e0c2fb09216f8e2cc269bbfb8bb49b5"
    end
  end

  on_linux do
    if Hardware::CPU.intel?
      url "https://github.com/rayven122/tumiki-proxy/releases/download/v0.2.0/tumiki-proxy-linux-x64"
      sha256 "0019dfc4b32d63c1392aa264aed2253c1e0c2fb09216f8e2cc269bbfb8bb49b5"
    end
  end

  def install
    bin.install Dir["tumiki-proxy*"].first => "tumiki-proxy"
  end

  test do
    assert_match "tumiki-proxy", shell_output("#{bin}/tumiki-proxy --help 2>&1", 1)
  end
end
