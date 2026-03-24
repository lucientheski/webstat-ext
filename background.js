/* WebStat — background.js (service worker) */
'use strict';

// Badge defaults
chrome.action.setBadgeBackgroundColor({ color: '#00cc66' });
chrome.action.setBadgeText({ text: '' });

// Periodic badge update even when popup is closed
// Uses alarms API to wake the service worker
chrome.alarms.create('badge-update', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'badge-update') {
    try {
      const info = await chrome.system.cpu.getInfo();
      // We can't compute delta from a single sample in the service worker
      // without persistent state, so we just keep the badge from the popup's
      // last update. The popup handles live badge updates while open.
    } catch (_) {}
  }
});
