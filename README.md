# ⚡ WebStat — Browser Extension

Instant system monitoring in your browser. One click to see CPU, memory, and storage — no server, no setup, no dependencies.

## Features

### Extension Only (zero setup)
- **CPU** — overall usage %, per-core usage grid with color coding
- **Memory** — used/total with usage bar
- **Storage** — device list with capacity
- **Dark/light theme** — respects system preference, toggle in popup
- **Live refresh** — updates every 2 seconds while popup is open

### Enhanced Mode (optional native host)
Install the lightweight native host to unlock:
- **Process list** — top processes by CPU/memory
- **Network** — interface throughput (rx/tx rates)
- **Disk** — used/free/percentage per mount point
- **Uptime & load average**

## Install

### Extension
1. Clone this repo or download the source
2. Open `chrome://extensions` in Chrome/Chromium
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the `webstat-ext` directory
5. Click the ⚡ icon in your toolbar

### Native Host (optional)
Requires [Node.js](https://nodejs.org) (v16+).

**Linux / macOS:**
```bash
cd native-host

# Install without extension ID (update later):
./install.sh

# Or install with your extension ID:
./install.sh --extension-id=your-extension-id-here

# Uninstall:
./install.sh --uninstall
```

**Windows (PowerShell):**
```powershell
cd native-host

# Install without extension ID (update later):
.\install.ps1

# Or install with your extension ID:
.\install.ps1 -ExtensionId your-extension-id-here

# Uninstall:
.\install.ps1 -Uninstall
```

To find your extension ID: go to `chrome://extensions`, find WebStat, copy the ID.

After installing, restart Chrome/Edge. The extension will automatically detect the native host and show enhanced monitoring data.

## How It Works

**Extension only:** Uses Chrome's built-in `system.cpu`, `system.memory`, and `system.storage` APIs. No network requests, no external dependencies, no data leaves your machine.

**Enhanced mode:** The extension connects to a local Node.js process via [Chrome Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging). The host process reads system data from `/proc` (Linux), `ps`/`df` (macOS), or `wmic` (Windows) and sends it to the extension over stdio. No network, no ports, no servers.

## Privacy

- Zero network requests
- Zero analytics or tracking
- Zero data collection
- All data stays on your machine
- Open source — read every line

## Compatibility

- **Chrome** 91+ / **Chromium** 91+
- **Native host:** Linux, macOS, Windows (PowerShell installer + Edge support)
- **Firefox:** Not yet supported (different extension API)

## License

MIT
