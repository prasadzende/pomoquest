// PomoQuest — main process: window, always-on-top lock while the timer runs, Obsidian logging, XP.
const { app, BrowserWindow, ipcMain, Menu, Notification, dialog, shell, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const { JsonStore } = require('./store');
const { DEFAULT_SETTINGS, DEFAULT_STATS } = require('./defaults');
const vault = require('./vault');

const isMac = process.platform === 'darwin';
const RENDERER = path.join(__dirname, 'renderer');
const iconPath = path.join(__dirname, 'assets', 'icon.png');

let win = null;
let settingsStore;
let statsStore;
let quitting = false;

// Timer lock: while a session runs (and until its "time's up" alert is dismissed)
// the window stays above every other window and cannot be minimized, hidden or closed.
let locked = false;
let session = null; // { start, plannedMs, activity, tags }

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
if (process.platform === 'win32') app.setAppUserModelId('com.pomoquest.app');

const settings = () => settingsStore.get();

function notify(title, body) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: nativeImage.createFromPath(iconPath), silent: true });
  n.on('click', () => win && win.show());
  n.show();
}

function safe(fn) {
  return async (_e, ...args) => {
    try { return await fn(...args); } catch (err) { return { ok: false, error: err && err.message ? err.message : String(err) }; }
  };
}

// ---------------------------------------------------------------- window lock
function pinOnTop() {
  if (!win || win.isDestroyed()) return;
  win.setAlwaysOnTop(true, 'screen-saver');
  if (isMac) win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
}

function setLocked(on) {
  locked = on;
  if (!win || win.isDestroyed()) return;
  if (on) {
    if (win.isMinimized()) win.restore();
    if (win.isFullScreen()) win.setFullScreen(false);
    win.show();
    pinOnTop();
    win.setMinimizable(false);
    win.setClosable(false);
    win.setFullScreenable(false);
  } else {
    win.setAlwaysOnTop(false);
    if (isMac) win.setVisibleOnAllWorkspaces(false, { skipTransformProcessType: true });
    win.setMinimizable(true);
    win.setClosable(true);
    win.setFullScreenable(true);
  }
  win.webContents.send('lock', on);
}

function nudge() {
  if (win && !win.isDestroyed()) win.webContents.send('nudge');
}

// ---------------------------------------------------------------- stats / XP
const dayKey = (d = new Date()) => vault.formatDate(d, 'YYYY-MM-DD');
const yesterdayKey = () => { const d = new Date(); return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)); };

function levelInfo(xp) {
  let level = 1; let need = 100; let rest = xp;
  while (rest >= need) { rest -= need; level += 1; need = 100 + (level - 1) * 50; }
  return { level, xpInLevel: rest, xpToNext: need };
}

function freshStats() {
  const s = statsStore.get();
  if (s.todayDate !== dayKey()) { s.todayDate = dayKey(); s.todaySessions = 0; s.todayFocusMinutes = 0; }
  return s;
}

function publicStats(s = freshStats()) {
  const alive = s.lastActiveDate === dayKey() || s.lastActiveDate === yesterdayKey();
  return { ...s, streak: alive ? s.streak : 0, ...levelInfo(s.xp) };
}

function award(xp, coins, minutes, completed) {
  const s = freshStats();
  const before = levelInfo(s.xp).level;
  s.xp += xp; s.coins += coins;
  s.totalFocusMinutes += minutes; s.todayFocusMinutes += minutes;
  if (completed) { s.totalSessions += 1; s.todaySessions += 1; }
  if (s.lastActiveDate !== dayKey()) {
    s.streak = s.lastActiveDate === yesterdayKey() ? (s.streak || 0) + 1 : 1;
    s.lastActiveDate = dayKey();
  }
  statsStore.set(s);
  const stats = publicStats(s);
  return { stats, leveledUp: stats.level > before };
}

// ---------------------------------------------------------------- sessions
function finishSession(completed) {
  if (!session) return { ok: true, logged: false };
  const end = Date.now();
  const { start, plannedMs, activity, tags } = session;
  session = null;
  const spentMs = completed ? plannedMs : Math.min(plannedMs, end - start);
  const minutes = Math.round(spentMs / 60000);

  // Sessions stopped before a full minute are not worth logging.
  if (!completed && spentMs < 60000) return { ok: true, logged: false, tooShort: true, stats: publicStats() };

  const xp = completed ? Math.max(5, minutes * 2) : Math.max(1, minutes);
  const coins = completed ? 3 : 0;
  const reward = award(xp, coins, minutes, completed);

  const s = settings();
  let logged = false; let logError = null; let file = null; let line = null;
  if (s.vaultPath) {
    try {
      const r = vault.logSession(s, { start, end: completed ? start + plannedMs : end, plannedMs, completed, activity, tags });
      logged = true; file = r.file; line = r.line;
    } catch (err) { logError = err.message; }
  }
  // No vault configured: the timer still works, the session just isn't logged.
  return { ok: true, xpGained: xp, coins, logged, logError, file, line, ...reward };
}

function cleanActivity({ activity, tags } = {}) {
  return {
    activity: String(activity || '').slice(0, 2000),
    tags: (Array.isArray(tags) ? tags : []).map(String).slice(0, 20)
  };
}

// ---------------------------------------------------------------- settings
function sanitize(patch) {
  const out = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (!(k in DEFAULT_SETTINGS)) continue;
    out[k] = typeof DEFAULT_SETTINGS[k] === 'boolean' ? Boolean(v) : String(v ?? '').trim();
  }
  if ('notePreset' in out && !vault.NOTE_PRESETS.some((p) => p.id === out.notePreset)) out.notePreset = 'daily';
  return out;
}

// ---------------------------------------------------------------- window
function createWindow() {
  win = new BrowserWindow({
    width: 400, height: 700, minWidth: 360, minHeight: 600,
    title: 'PomoQuest', icon: iconPath, show: false, autoHideMenuBar: true,
    backgroundColor: '#bfe7ff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required'
    }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.loadFile(path.join(RENDERER, 'index.html'));
  win.once('ready-to-show', () => win.show());

  // Enforce the lock even where the window manager ignores the disabled buttons (e.g. some Linux desktops).
  win.on('minimize', () => { if (locked) { win.restore(); win.focus(); nudge(); } });
  win.on('hide', () => { if (locked && !quitting) { win.show(); nudge(); } });
  win.on('blur', () => { if (locked) pinOnTop(); });
  win.on('close', (e) => { if (locked && !quitting) { e.preventDefault(); nudge(); } });
  win.on('closed', () => { win = null; });
}

function buildMenu() {
  if (!isMac) { Menu.setApplicationMenu(null); return; }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'editMenu' },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'close' }] }
  ]));
}

// ---------------------------------------------------------------- IPC
function registerIpc() {
  ipcMain.handle('settings:get', () => settings());
  ipcMain.handle('settings:save', safe((patch) => ({ ok: true, settings: settingsStore.set(sanitize(patch)) })));
  ipcMain.handle('stats:get', () => publicStats());

  ipcMain.handle('vault:presets', () => vault.presetList(new Date()));
  ipcMain.handle('vault:pick', safe(async () => {
    const res = await dialog.showOpenDialog(win, { title: 'Choose your Obsidian vault folder', properties: ['openDirectory', 'createDirectory'] });
    if (res.canceled || !res.filePaths.length) return { ok: false, canceled: true };
    const p = res.filePaths[0];
    const d = vault.detectVault(p);
    return { ok: true, path: p, ...d, suggestedPreset: d.dailyNotes ? vault.presetForFormat(d.dailyNotes.format) : null };
  }));
  ipcMain.handle('vault:detect', safe((p) => ({ ok: true, ...vault.detectVault(p) })));
  ipcMain.handle('vault:preview', safe((draft) => {
    const s = { ...settings(), ...sanitize(draft) };
    const file = vault.notePath(s, new Date());
    return { ok: true, file, relative: path.relative(path.resolve(s.vaultPath), file).split(path.sep).join('/') };
  }));
  ipcMain.handle('vault:openNote', safe(async () => {
    const s = settings();
    const file = vault.notePath(s, new Date());
    if (!fs.existsSync(file)) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, (s.logHeading ? s.logHeading + '\n' : ''), 'utf8');
    }
    try { await shell.openExternal(vault.obsidianUri(s, file)); } catch (_) { await shell.openPath(file); }
    return { ok: true };
  }));

  ipcMain.handle('timer:start', safe(({ plannedMs, activity, tags }) => {
    const ms = Number(plannedMs);
    if (!(ms > 0)) throw new Error('Enter a time first.');
    session = { start: Date.now(), plannedMs: ms, ...cleanActivity({ activity, tags }) };
    setLocked(true);
    return { ok: true, start: session.start };
  }));

  // The activity box stays editable while the timer runs; the latest text is what gets logged.
  ipcMain.handle('timer:activity', safe((payload) => {
    if (session) Object.assign(session, cleanActivity(payload));
    return { ok: true };
  }));

  ipcMain.handle('timer:stop', safe(() => {
    const r = finishSession(false);
    setLocked(false);
    return r;
  }));

  // Time's up: log it, celebrate, and keep the window on top until the alert is dismissed.
  ipcMain.handle('timer:done', safe(() => {
    const r = finishSession(true);
    if (win) { win.show(); win.focus(); win.flashFrame(true); }
    if (isMac && app.dock) app.dock.bounce('critical');
    notify('🍅 Quest complete!', 'Time is up. Great focus, take a break!');
    return r;
  }));

  ipcMain.handle('timer:ack', () => {
    if (win) win.flashFrame(false);
    setLocked(false);
    return { ok: true };
  });
}

// ---------------------------------------------------------------- lifecycle
app.whenReady().then(() => {
  if (!gotLock) return;
  const dir = app.getPath('userData');
  settingsStore = new JsonStore(path.join(dir, 'settings.json'), DEFAULT_SETTINGS);
  statsStore = new JsonStore(path.join(dir, 'stats.json'), DEFAULT_STATS);
  if (isMac && app.dock && !app.isPackaged) app.dock.setIcon(nativeImage.createFromPath(path.join(__dirname, '..', 'build', 'icon.png')));
  buildMenu();
  registerIpc();
  createWindow();
  app.on('activate', () => { if (!win) createWindow(); else win.show(); });
});

// Quitting mid-session asks first, and logs the session as stopped if you go ahead.
app.on('before-quit', (e) => {
  if (!locked || quitting) { quitting = true; return; }
  e.preventDefault();
  const choice = dialog.showMessageBoxSync(win, {
    type: 'question', buttons: ['Keep focusing', 'Stop timer and quit'], defaultId: 0, cancelId: 0,
    title: 'PomoQuest', message: 'Your timer is still running.', detail: 'Quitting now will stop it and log it as stopped early.'
  });
  if (choice === 1) {
    finishSession(false);
    quitting = true;
    setLocked(false);
    app.quit();
  }
});

app.on('window-all-closed', () => app.quit());
