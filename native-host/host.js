#!/usr/bin/env node
/* WebStat Native Messaging Host
 * Communicates with the browser extension via Chrome's native messaging protocol.
 * Collects: processes, network interfaces, uptime, load average.
 *
 * Protocol: length-prefixed JSON over stdin/stdout.
 * - Read: 4-byte LE uint32 length, then UTF-8 JSON payload
 * - Write: 4-byte LE uint32 length, then UTF-8 JSON payload
 */
'use strict';

const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

// ─── Native Messaging I/O ───

function sendMessage(obj) {
  const json = JSON.stringify(obj);
  const buf = Buffer.from(json, 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buf.length, 0);
  process.stdout.write(header);
  process.stdout.write(buf);
}

let inputBuf = Buffer.alloc(0);

process.stdin.on('data', (chunk) => {
  inputBuf = Buffer.concat([inputBuf, chunk]);
  processInput();
});

function processInput() {
  while (inputBuf.length >= 4) {
    const msgLen = inputBuf.readUInt32LE(0);
    if (inputBuf.length < 4 + msgLen) return; // wait for more data

    const payload = inputBuf.slice(4, 4 + msgLen).toString('utf8');
    inputBuf = inputBuf.slice(4 + msgLen);

    try {
      const msg = JSON.parse(payload);
      handleMessage(msg);
    } catch (e) {
      sendMessage({ error: 'Invalid JSON' });
    }
  }
}

process.stdin.on('end', () => process.exit(0));

// ─── Message Handler ───

function handleMessage(msg) {
  if (msg.type === 'query') {
    const data = collectSystemData();
    sendMessage(data);
  } else if (msg.type === 'ping') {
    sendMessage({ type: 'pong', version: '0.1.0' });
  } else {
    sendMessage({ error: 'Unknown message type: ' + msg.type });
  }
}

// ─── Data Collection ───

function collectSystemData() {
  const result = {
    uptime: os.uptime(),
    loadavg: os.loadavg(),
    hostname: os.hostname(),
    platform: os.platform(),
    processes: getProcesses(),
    network: getNetworkData(),
    disk: getDiskUsage(),
  };
  return result;
}

function getProcesses() {
  try {
    const platform = os.platform();
    let output;

    if (platform === 'linux') {
      // ps with sorted output — top 15 by CPU
      output = execSync(
        'ps aux --sort=-%cpu | head -16',
        { encoding: 'utf8', timeout: 3000 }
      );
    } else if (platform === 'darwin') {
      output = execSync(
        'ps aux -r | head -16',
        { encoding: 'utf8', timeout: 3000 }
      );
    } else if (platform === 'win32') {
      try {
        output = execSync(
          'powershell -NoProfile -Command "Get-Process | Sort-Object CPU -Descending | Select-Object -First 15 | ForEach-Object { $_.Name + \\"|\\" + [math]::Round($_.CPU,1) + \\"|\\" + [math]::Round($_.WorkingSet64/1MB,1) }"',
          { encoding: 'utf8', timeout: 5000 }
        );
        return parseWinProcesses(output);
      } catch (_) {
        return [];
      }
    } else {
      return [];
    }

    return parsePsOutput(output);
  } catch (e) {
    return [];
  }
}

function parsePsOutput(output) {
  const lines = output.trim().split('\n');
  if (lines.length < 2) return [];

  // Skip header line
  const processes = [];
  for (let i = 1; i < lines.length && processes.length < 10; i++) {
    const parts = lines[i].trim().split(/\s+/);
    if (parts.length < 11) continue;

    const cpu = parseFloat(parts[2]) || 0;
    const mem = parseFloat(parts[3]) || 0;
    const name = parts[10] || parts[parts.length - 1];
    const cmd = parts.slice(10).join(' ');

    // Skip idle/system processes with 0 CPU and 0 MEM
    if (cpu === 0 && mem === 0) continue;

    processes.push({
      name: name.split('/').pop(), // just the binary name
      cpu,
      mem,
      cmd: cmd.substring(0, 100),
    });
  }
  return processes;
}

function parseWinProcesses(output) {
  const lines = output.trim().split('\n').filter(l => l.trim());
  const processes = [];
  for (const line of lines) {
    const parts = line.trim().split('|');
    if (parts.length < 3) continue;
    processes.push({
      name: parts[0].trim(),
      cpu: parseFloat(parts[1]) || 0,
      mem: parseFloat(parts[2]) || 0,
    });
    if (processes.length >= 10) break;
  }
  return processes;
}

function getNetworkData() {
  const ifaces = os.networkInterfaces();
  const result = [];

  // On Linux, read /proc/net/dev for byte counters
  if (os.platform() === 'linux') {
    try {
      const raw = fs.readFileSync('/proc/net/dev', 'utf8');
      const lines = raw.trim().split('\n');
      for (let i = 2; i < lines.length; i++) {
        const parts = lines[i].trim().split(/[\s:]+/);
        if (parts.length < 10) continue;
        const name = parts[0];
        if (name === 'lo') continue; // skip loopback
        result.push({
          name,
          rx: parseInt(parts[1]) || 0,
          tx: parseInt(parts[9]) || 0,
        });
      }
      return result;
    } catch (_) {}
  }

  // Fallback: just list interfaces (no byte counters)
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (name === 'lo' || name === 'lo0') continue;
    const ipv4 = addrs.find(a => a.family === 'IPv4' && !a.internal);
    if (ipv4) {
      result.push({ name, rx: 0, tx: 0, address: ipv4.address });
    }
  }
  return result;
}

function getDiskUsage() {
  try {
    const platform = os.platform();
    if (platform === 'linux' || platform === 'darwin') {
      const output = execSync(
        "df -B1 --output=target,size,used,avail,pcent 2>/dev/null || df -k",
        { encoding: 'utf8', timeout: 3000 }
      );
      return parseDfOutput(output);
    } else if (platform === 'win32') {
      const output = execSync(
        'powershell -NoProfile -Command "Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -ne $null } | ForEach-Object { $_.Name + \\":|\\"+$_.Used+\\"|\\" +($_.Used+$_.Free)+\\"|\\"+$_.Free }"',
        { encoding: 'utf8', timeout: 5000 }
      );
      return parseWinDisk(output);
    }
    return [];
  } catch (_) {
    return [];
  }
}

function parseWinDisk(output) {
  const lines = output.trim().split('\n').filter(l => l.trim());
  const disks = [];
  for (const line of lines) {
    const parts = line.trim().split('|');
    if (parts.length < 4) continue;
    const mount = parts[0].trim();
    const used = parseInt(parts[1]) || 0;
    const size = parseInt(parts[2]) || 0;
    const avail = parseInt(parts[3]) || 0;
    if (size === 0) continue;
    const pct = Math.round((used / size) * 100);
    disks.push({ mount, size, used, avail, pct });
  }
  return disks;
}

function parseDfOutput(output) {
  const lines = output.trim().split('\n');
  if (lines.length < 2) return [];

  const disks = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].trim().split(/\s+/);
    if (parts.length < 4) continue;

    const mount = parts[0];
    // Skip virtual/temp filesystems
    if (/^(tmpfs|devtmpfs|udev|overlay|shm|none)/.test(mount)) continue;
    if (mount === '-') continue;
    // Skip non-physical mount points
    if (/^\/(run|dev\/shm|sys|proc)/.test(mount)) continue;

    const size = parseInt(parts[1]) || 0;
    const used = parseInt(parts[2]) || 0;
    const avail = parseInt(parts[3]) || 0;
    const pctStr = parts[4] || '0%';
    const pct = parseInt(pctStr) || 0;

    if (size === 0) continue;

    disks.push({ mount, size, used, avail, pct });
  }
  return disks;
}

// Ready
sendMessage({ type: 'ready', version: '0.1.0' });
