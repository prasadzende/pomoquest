const { contextBridge, ipcRenderer } = require('electron');

const EVENTS = ['lock', 'nudge'];

contextBridge.exposeInMainWorld('pq', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:save', patch),
  getStats: () => ipcRenderer.invoke('stats:get'),
  presets: () => ipcRenderer.invoke('vault:presets'),
  pickVault: () => ipcRenderer.invoke('vault:pick'),
  detectVault: (p) => ipcRenderer.invoke('vault:detect', p),
  previewPath: (draft) => ipcRenderer.invoke('vault:preview', draft),
  openNote: () => ipcRenderer.invoke('vault:openNote'),
  timerStart: (plannedMs, activity, tags) => ipcRenderer.invoke('timer:start', { plannedMs, activity, tags }),
  timerActivity: (activity, tags) => ipcRenderer.invoke('timer:activity', { activity, tags }),
  timerStop: () => ipcRenderer.invoke('timer:stop'),
  timerDone: () => ipcRenderer.invoke('timer:done'),
  timerAck: () => ipcRenderer.invoke('timer:ack'),
  on: (channel, cb) => {
    if (!EVENTS.includes(channel)) return () => {};
    const handler = (_e, data) => cb(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  }
});
