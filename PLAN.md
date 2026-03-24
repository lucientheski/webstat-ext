# webstat-ext — Browser Extension Build Plan

## Concept
System monitoring browser extension with two tiers:
1. **Pure extension** (zero install friction) — CPU, memory, storage via Chrome APIs
2. **Native messaging host** (opt-in) — unlocks full monitoring: processes, network, disk I/O, temperatures

## Architecture

```
┌─────────────────────────────────┐
│ Browser Extension (Manifest V3) │
│  ├── popup.html/js — dashboard  │
│  ├── background.js — service    │
│  │   worker, polls system APIs  │
│  │   + native host if available │
│  └── icons/                     │
└──────────┬──────────────────────┘
           │ chrome.runtime.connectNative()
           │ (optional)
┌──────────▼──────────────────────┐
│ Native Messaging Host (Node.js) │
│  ├── host.js — stdio JSON IPC  │
│  ├── install.sh — registers    │
│  │   native messaging manifest │
│  └── collects: processes,      │
│      network, disk I/O, temps  │
└─────────────────────────────────┘
```

## Build Phases

### Phase 1: Extension Skeleton
- [ ] Initialize git repo
- [ ] Create manifest.json (Manifest V3)
  - Permissions: system.cpu, system.memory, system.storage
  - Action popup
- [ ] Create popup.html with basic structure
- [ ] Create popup.css — dark theme, clean layout
- [ ] Create popup.js — stub that calls Chrome system APIs

### Phase 2: Core Dashboard (Pure Extension)
- [ ] CPU display — model name, core count, per-core usage bars, overall %
- [ ] Memory display — used/total, usage bar, percentage
- [ ] Storage display — list devices with capacity bars
- [ ] Auto-refresh on configurable interval (default 2s)
- [ ] Badge icon showing current CPU or memory %

### Phase 3: Polish
- [ ] Dark/light theme toggle (respects system preference)
- [ ] Responsive popup sizing
- [ ] Smooth transitions on bar updates
- [ ] Extension icon set (16, 32, 48, 128px)
- [ ] Error states (API unavailable, permission denied)

### Phase 4: Native Messaging Host
- [ ] Create host.js — Node.js stdio process
  - Reads JSON messages from stdin (length-prefixed per Chrome protocol)
  - Responds with system data: processes (top 10 by CPU), network interfaces + throughput, disk I/O, CPU temps (Linux)
- [ ] Create native messaging manifest (com.webstat.host.json)
- [ ] Create install.sh — copies manifest to correct OS location, sets path
- [ ] Extension: detect native host availability via test message
- [ ] Popup: show "enhanced" section when native host connected

### Phase 5: Enhanced Dashboard (Native Host)
- [ ] Process list — top processes by CPU/memory, sortable
- [ ] Network — interfaces, rx/tx bytes, throughput rate
- [ ] Uptime + load average
- [ ] Graceful degradation — enhanced sections hidden when host unavailable

### Phase 6: Package & Publish
- [ ] README.md with install instructions (extension + optional native host)
- [ ] Screenshots
- [ ] GitHub repo: webstat-ext
- [ ] Chrome Web Store developer account setup (if pursuing store listing)
- [ ] Create .crx or load-unpacked instructions for sideloading

## Tech Stack
- **Extension:** Vanilla JS, HTML, CSS (zero dependencies)
- **Native Host:** Node.js (matches webstat's existing stack)
- **Protocol:** Chrome native messaging (length-prefixed JSON over stdio)

## Design Principles
- Extension-only experience must be useful standalone — not a teaser for the native host
- No external network requests, no analytics, no tracking
- Works offline, works on any OS Chrome runs on
- Open source, MIT license
