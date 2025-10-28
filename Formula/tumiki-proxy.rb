class TumikiProxy < Formula
  desc "Transparent MCP logging proxy with multi-transport support"
  homepage "https://github.com/rayven122/tumiki-proxy"
  version "0.2.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/rayven122/tumiki-proxy/releases/download/v0.2.0/tumiki-proxy-macos-arm64"
      sha256 "d9ddd1d01912b33d1dfa95e9d5d210a679a9da17fc7ea2134606993cdcf405de"
    else
      url "https://github.com/rayven122/tumiki-proxy/releases/download/v0.2.0/tumiki-proxy-macos-x64"
      sha256 "338e31ac0c9ad93cf6b33db50fd660fc4cb2e8d20699830b26684ed4368554fb"
    end
  end

  on_linux do
    if Hardware::CPU.intel?
      url "https://github.com/rayven122/tumiki-proxy/releases/download/v0.2.0/tumiki-proxy-linux-x64"
      sha256 "e8d91f916914e5945e970916f1b78b1aff88f1088eb7ef6d5af9cc9f743b73c7"
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
