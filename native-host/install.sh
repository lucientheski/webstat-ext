#!/bin/bash
# WebStat Native Messaging Host — Installer
# Registers the native messaging host manifest for Chrome/Chromium.
# Usage: ./install.sh [--uninstall]

set -euo pipefail

HOST_NAME="com.webstat.host"
HOST_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_PATH="$HOST_DIR/host.js"

# Detect OS and set manifest location
case "$(uname -s)" in
  Linux)
    CHROME_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
    CHROMIUM_DIR="$HOME/.config/chromium/NativeMessagingHosts"
    ;;
  Darwin)
    CHROME_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    CHROMIUM_DIR="$HOME/Library/Application Support/Chromium/NativeMessagingHosts"
    ;;
  *)
    echo "Unsupported OS: $(uname -s)"
    echo "For Windows, manually create the registry key and manifest."
    exit 1
    ;;
esac

MANIFEST='{
  "name": "'"$HOST_NAME"'",
  "description": "WebStat system monitoring native host",
  "path": "'"$HOST_PATH"'",
  "type": "stdio",
  "allowed_origins": []
}'

uninstall() {
  echo "Uninstalling $HOST_NAME..."
  rm -f "$CHROME_DIR/$HOST_NAME.json" 2>/dev/null
  rm -f "$CHROMIUM_DIR/$HOST_NAME.json" 2>/dev/null
  echo "Removed native messaging manifests."
  echo ""
  echo "Note: You'll need to add your extension ID to allowed_origins after"
  echo "loading the extension. Run this script again with your extension ID:"
  echo "  ./install.sh --extension-id=<your-extension-id>"
}

install() {
  local ext_id="${1:-}"

  if [[ -n "$ext_id" ]]; then
    MANIFEST='{
  "name": "'"$HOST_NAME"'",
  "description": "WebStat system monitoring native host",
  "path": "'"$HOST_PATH"'",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://'"$ext_id"'/"]
}'
  fi

  # Make host executable
  chmod +x "$HOST_PATH"

  # Install for Chrome
  mkdir -p "$CHROME_DIR"
  echo "$MANIFEST" > "$CHROME_DIR/$HOST_NAME.json"
  echo "Installed: $CHROME_DIR/$HOST_NAME.json"

  # Install for Chromium
  mkdir -p "$CHROMIUM_DIR"
  echo "$MANIFEST" > "$CHROMIUM_DIR/$HOST_NAME.json"
  echo "Installed: $CHROMIUM_DIR/$HOST_NAME.json"

  echo ""
  if [[ -z "$ext_id" ]]; then
    echo "⚠ No extension ID provided. You'll need to update the manifest with"
    echo "  your extension ID after loading it in Chrome."
    echo ""
    echo "  1. Load the extension in chrome://extensions (Developer mode → Load unpacked)"
    echo "  2. Copy the extension ID"
    echo "  3. Run: ./install.sh --extension-id=<your-extension-id>"
  else
    echo "✓ Configured for extension ID: $ext_id"
    echo "  Restart Chrome for changes to take effect."
  fi
}

# Parse args
case "${1:-}" in
  --uninstall)
    uninstall
    ;;
  --extension-id=*)
    ext_id="${1#--extension-id=}"
    install "$ext_id"
    ;;
  "")
    install ""
    ;;
  *)
    echo "Usage: $0 [--extension-id=<id>] [--uninstall]"
    exit 1
    ;;
esac
