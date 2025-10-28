class TumikiProxy < Formula
  desc "Transparent MCP logging proxy with multi-transport support"
  homepage "https://github.com/rayven122/tumiki-proxy"
  version "0.2.2"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/rayven122/tumiki-proxy/releases/download/v0.2.2/tumiki-proxy-macos-arm64"
      sha256 "7136b1a465d8e6c2e35f1141153904240fb26dbc7535c1098cb22e591478eca7"
    else
      url "https://github.com/rayven122/tumiki-proxy/releases/download/v0.2.2/tumiki-proxy-macos-x64"
      sha256 "32e788fcf8e06744f6bc7bff939a5f668d1fb6208dba58fe4e9655ef15daed4c"
    end
  end

  on_linux do
    if Hardware::CPU.intel?
      url "https://github.com/rayven122/tumiki-proxy/releases/download/v0.2.2/tumiki-proxy-linux-x64"
      sha256 "60cd461633e7e900a9b7f25230c38423b1728bcafc002f2196f12f487dedcfd4"
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
