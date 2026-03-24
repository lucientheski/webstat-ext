/* WebStat — popup.js */
'use strict';

const REFRESH_MS = 2000;
const NATIVE_HOST = 'com.webstat.host';

// ─── State ───
let prevCpuTimes = null;
let nativePort = null;
let nativeConnected = false;
let prevNetData = null;
let prevNetTs = null;

// ─── DOM refs ───
const $ = (s) => document.querySelector(s);
const cpuOverall = $('#cpu-overall');
const cpuModel = $('#cpu-model');
const cpuCores = $('#cpu-cores');
const memPercent = $('#mem-percent');
const memBar = $('#mem-bar');
const memDetail = $('#mem-detail');
const storageList = $('#storage-list');
const enhancedSection = $('#enhanced-section');
const uptimeRow = $('#uptime-row');
const processBody = $('#process-body');
const networkList = $('#network-list');
const nativeStatus = $('#native-status');
const connectBtn = $('#connect-native');
const themeToggle = $('#theme-toggle');
const statusDot = $('#status-dot');

// ─── Helpers ───
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0) + ' ' + units[i];
}

function formatRate(bytesPerSec) {
  if (bytesPerSec < 1024) return bytesPerSec.toFixed(0) + ' B/s';
  if (bytesPerSec < 1048576) return (bytesPerSec / 1024).toFixed(1) + ' KB/s';
  return (bytesPerSec / 1048576).toFixed(1) + ' MB/s';
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(d + 'd');
  if (h) parts.push(h + 'h');
  parts.push(m + 'm');
  return parts.join(' ');
}

function barClass(pct) {
  if (pct >= 90) return 'crit';
  if (pct >= 70) return 'warn';
  return '';
}

function coreClass(pct) {
  if (pct >= 80) return 'high';
  if (pct >= 40) return 'med';
  return 'low';
}

// ─── CPU ───
async function updateCPU() {
  try {
    const info = await chrome.system.cpu.getInfo();
    cpuModel.textContent = info.modelName;

    const coreUsages = [];

    if (prevCpuTimes) {
      cpuCores.innerHTML = '';
      for (let i = 0; i < info.processors.length; i++) {
        const cur = info.processors[i].usage;
        const prev = prevCpuTimes[i];
        const totalDelta = cur.total - prev.total;
        const idleDelta = cur.idle - prev.idle;
        const usage = totalDelta > 0 ? Math.round(((totalDelta - idleDelta) / totalDelta) * 100) : 0;
        coreUsages.push(usage);

        const cell = document.createElement('div');
        cell.className = 'core-cell ' + coreClass(usage);
        cell.textContent = usage + '%';
        cell.title = 'Core ' + i;
        cpuCores.appendChild(cell);
      }

      const overall = coreUsages.length > 0
        ? Math.round(coreUsages.reduce((a, b) => a + b, 0) / coreUsages.length)
        : 0;
      cpuOverall.textContent = overall + '%';
    } else {
      cpuCores.innerHTML = '';
      for (let i = 0; i < info.processors.length; i++) {
        const cell = document.createElement('div');
        cell.className = 'core-cell low';
        cell.textContent = '—';
        cell.title = 'Core ' + i;
        cpuCores.appendChild(cell);
      }
    }

    prevCpuTimes = info.processors.map(p => ({ ...p.usage }));
  } catch (e) {
    cpuModel.textContent = 'CPU info unavailable';
  }
}

// ─── Memory ───
async function updateMemory() {
  try {
    const info = await chrome.system.memory.getInfo();
    const used = info.capacity - info.availableCapacity;
    const pct = Math.round((used / info.capacity) * 100);

    memPercent.textContent = pct + '%';
    memBar.style.width = pct + '%';
    memBar.className = 'bar ' + barClass(pct);
    memDetail.textContent = formatBytes(used) + ' / ' + formatBytes(info.capacity);
  } catch (e) {
    memDetail.textContent = 'Memory info unavailable';
  }
}

// ─── Storage ───
async function updateStorage() {
  // If native host is connected, disk data comes from handleNativeData
  if (nativeConnected) return;

  try {
    const units = await chrome.system.storage.getInfo();
    storageList.innerHTML = '';

    if (units.length === 0) {
      storageList.innerHTML = '<div class="detail">No storage devices found</div>';
      return;
    }

    for (const unit of units) {
      const item = document.createElement('div');
      item.className = 'storage-item';

      const label = document.createElement('div');
      label.className = 'storage-label';

      const name = document.createElement('span');
      name.className = 'storage-name';
      name.textContent = unit.name || unit.id;
      name.title = unit.name || unit.id;

      const cap = document.createElement('span');
      cap.className = 'storage-cap';
      cap.textContent = unit.capacity > 0 ? formatBytes(unit.capacity) : 'Unknown';

      label.appendChild(name);
      label.appendChild(cap);
      item.appendChild(label);

      if (unit.capacity > 0) {
        const detail = document.createElement('div');
        detail.className = 'detail';
        detail.textContent = formatBytes(unit.capacity) + ' total — install native host for usage details';
        detail.style.fontSize = '10px';
        detail.style.marginTop = '2px';
        item.appendChild(detail);
      }

      storageList.appendChild(item);
    }
  } catch (e) {
    storageList.innerHTML = '<div class="detail">Storage info unavailable</div>';
  }
}

// ─── Native Messaging ───
function connectNative() {
  try {
    nativePort = chrome.runtime.connectNative(NATIVE_HOST);

    nativePort.onMessage.addListener((msg) => {
      if (!nativeConnected) {
        nativeConnected = true;
        enhancedSection.classList.remove('hidden');
        nativeStatus.textContent = 'Enhanced mode';
        connectBtn.classList.add('hidden');
      }
      handleNativeData(msg);
    });

    nativePort.onDisconnect.addListener(() => {
      nativeConnected = false;
      nativePort = null;
      enhancedSection.classList.add('hidden');
      nativeStatus.textContent = 'Extension only';
      connectBtn.classList.remove('hidden');
      prevNetData = null;
      prevNetTs = null;
    });

    // Request initial data
    nativePort.postMessage({ type: 'query' });
  } catch (e) {
    nativeStatus.textContent = 'Native host unavailable';
  }
}

function handleNativeData(data) {
  if (data.uptime != null) {
    uptimeRow.textContent = 'Uptime: ' + formatUptime(data.uptime) +
      (data.loadavg ? ' · Load: ' + data.loadavg.map(l => l.toFixed(2)).join(', ') : '');
  }

  if (data.processes && data.processes.length) {
    processBody.innerHTML = '';
    for (const proc of data.processes.slice(0, 10)) {
      const tr = document.createElement('tr');
      const tdName = document.createElement('td');
      tdName.className = 'col-name';
      tdName.textContent = proc.name;
      tdName.title = proc.cmd || proc.name;
      const tdCpu = document.createElement('td');
      tdCpu.className = 'col-num';
      tdCpu.textContent = proc.cpu.toFixed(1);
      const tdMem = document.createElement('td');
      tdMem.className = 'col-num';
      tdMem.textContent = proc.mem.toFixed(1);
      tr.appendChild(tdName);
      tr.appendChild(tdCpu);
      tr.appendChild(tdMem);
      processBody.appendChild(tr);
    }
  }

  if (data.disk && data.disk.length) {
    storageList.innerHTML = '';
    for (const d of data.disk) {
      const item = document.createElement('div');
      item.className = 'storage-item';

      const label = document.createElement('div');
      label.className = 'storage-label';

      const name = document.createElement('span');
      name.className = 'storage-name';
      name.textContent = d.mount;
      name.title = d.mount;

      const cap = document.createElement('span');
      cap.className = 'storage-cap';
      cap.textContent = formatBytes(d.used) + ' / ' + formatBytes(d.size) + ' (' + d.pct + '%)';

      label.appendChild(name);
      label.appendChild(cap);
      item.appendChild(label);

      const barContainer = document.createElement('div');
      barContainer.className = 'bar-container';
      const bar = document.createElement('div');
      bar.className = 'bar ' + barClass(d.pct);
      bar.style.width = d.pct + '%';
      barContainer.appendChild(bar);
      item.appendChild(barContainer);

      storageList.appendChild(item);
    }
  }

  if (data.network) {
    const now = Date.now();
    networkList.innerHTML = '';

    for (const iface of data.network) {
      const item = document.createElement('div');
      item.className = 'net-item';

      const nameEl = document.createElement('span');
      nameEl.className = 'net-name';
      nameEl.textContent = iface.name;

      const rateEl = document.createElement('span');
      rateEl.className = 'net-rate';

      if (prevNetData && prevNetTs) {
        const prev = prevNetData.find(p => p.name === iface.name);
        if (prev) {
          const dt = (now - prevNetTs) / 1000;
          const rxRate = Math.max(0, (iface.rx - prev.rx) / dt);
          const txRate = Math.max(0, (iface.tx - prev.tx) / dt);
          rateEl.textContent = '↓' + formatRate(rxRate) + ' ↑' + formatRate(txRate);
        }
      }

      if (!rateEl.textContent) {
        rateEl.textContent = '↓' + formatBytes(iface.rx) + ' ↑' + formatBytes(iface.tx);
      }

      item.appendChild(nameEl);
      item.appendChild(rateEl);
      networkList.appendChild(item);
    }

    prevNetData = data.network;
    prevNetTs = now;
  }
}

function pollNative() {
  if (nativePort && nativeConnected) {
    nativePort.postMessage({ type: 'query' });
  }
}

// ─── Theme ───
function initTheme() {
  const saved = localStorage.getItem('webstat-theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
    themeToggle.textContent = saved === 'light' ? '☀️' : '🌙';
  } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
    document.documentElement.setAttribute('data-theme', 'light');
    themeToggle.textContent = '☀️';
  }
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('webstat-theme', next);
  themeToggle.textContent = next === 'light' ? '☀️' : '🌙';
});

// ─── Connect native button ───
connectBtn.addEventListener('click', async () => {
  // Request nativeMessaging permission if not already granted
  try {
    const granted = await chrome.permissions.request({ permissions: ['nativeMessaging'] });
    if (granted) {
      connectNative();
    } else {
      nativeStatus.textContent = 'Permission denied';
    }
  } catch (e) {
    // Permission might already be granted
    connectNative();
  }
});

// ─── Update badge ───
function updateBadge(cpuPct) {
  if (cpuPct != null && !isNaN(cpuPct)) {
    chrome.action.setBadgeText({ text: cpuPct + '' });
    chrome.action.setBadgeBackgroundColor({
      color: cpuPct >= 90 ? '#ff4444' : cpuPct >= 70 ? '#ffa500' : '#00cc66'
    });
  }
}

// ─── Main loop ───
async function refresh() {
  try {
    await Promise.all([updateCPU(), updateMemory(), updateStorage()]);
    pollNative();
    statusDot.className = 'dot dot-ok';

    // Update badge with overall CPU
    const badgeText = cpuOverall.textContent;
    if (badgeText && badgeText !== '—%') {
      updateBadge(parseInt(badgeText));
    }
  } catch (e) {
    statusDot.className = 'dot dot-err';
  }
}

// ─── Init ───
initTheme();

// Try native connection silently on load (only if permission already granted)
chrome.permissions.contains({ permissions: ['nativeMessaging'] }, (granted) => {
  if (granted) {
    try { connectNative(); } catch (_) {}
  } else {
    // Show the connect button so user can opt-in
    connectBtn.classList.remove('hidden');
  }
});

// First refresh, then interval
refresh();
setInterval(refresh, REFRESH_MS);
