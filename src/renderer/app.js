/* PomoQuest renderer: one time box, one button, compact settings. */
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const pq = window.pq;
  const { parseTime, formatClock } = window.PQTime;

  let settings = null;
  const timer = { running: false, plannedMs: 0, endAt: 0, handle: null, lastBubble: 0 };
  let selectedTags = new Set();
  const CHEERS = ['Focus mode! 💪', 'You got this!', 'Keep going~', 'Deep work time ✨', 'One step at a time!', 'Stay on target 🎯'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // ---------------------------------------------------------------- helpers
  function toast(msg, kind = '') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function confetti() {
    const colors = ['#ff636b', '#ffd166', '#7fdcab', '#c4b5ff', '#8fd3ff', '#ff8fab'];
    for (let i = 0; i < 50; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = 1.6 + Math.random() * 1.8 + 's';
      p.style.animationDelay = Math.random() * 0.5 + 's';
      $('#confetti').appendChild(p);
      setTimeout(() => p.remove(), 4200);
    }
  }

  function setHero(mood, anim) {
    PQSprite.drawHero($('#hero'), mood);
    $('#hero').className = `pixel hero ${anim}`;
  }

  function applyTheme() {
    document.body.classList.toggle('theme-night', settings.theme === 'night');
    document.body.classList.toggle('theme-day', settings.theme !== 'night');
  }

  function renderStats(s) {
    if (!s) return;
    $('#lvl').textContent = `LV ${s.level}`;
    $('#xpFill').style.width = `${Math.min(100, (s.xpInLevel / s.xpToNext) * 100)}%`;
    $('.xpbar').title = `${s.xpInLevel} / ${s.xpToNext} XP · Today: ${s.todaySessions} 🍅, ${Math.round(s.todayFocusMinutes)} min`;
    $('#coins').textContent = s.coins;
    $('#streak').textContent = s.streak;
  }

  // ---------------------------------------------------------------- activity & tags
  // Same clean-up as the Obsidian writer, so a chip shows exactly the tag that gets logged.
  const cleanTag = (t) => String(t).trim().replace(/^#+/, '').replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_\-/]/gu, '');
  const splitTags = (text) => [...new Set(String(text || '').split(',').map(cleanTag).filter((t) => t && !/^\d+$/.test(t)))];

  function renderTags() {
    const wrap = $('#tagChips');
    wrap.innerHTML = '';
    const tags = splitTags(settings.tags);
    selectedTags = new Set([...selectedTags].filter((t) => tags.includes(t)));
    settings.lastTags = [...selectedTags].join(',');
    for (const t of tags) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `tag-chip ${selectedTags.has(t) ? 'on' : ''}`;
      b.textContent = `#${t}`;
      b.addEventListener('click', () => {
        if (selectedTags.has(t)) selectedTags.delete(t); else selectedTags.add(t);
        b.classList.toggle('on', selectedTags.has(t));
        PQSfx.play('click');
        onActivityChange();
      });
      wrap.appendChild(b);
    }
  }

  let activityTimer = null;
  function onActivityChange() {
    const tags = [...selectedTags];
    settings.lastTags = tags.join(',');
    clearTimeout(activityTimer);
    activityTimer = setTimeout(() => {
      pq.saveSettings({ lastTags: settings.lastTags });
      if (timer.running) pq.timerActivity($('#activity').value, tags);
    }, 400);
  }

  // ---------------------------------------------------------------- timer
  const box = $('#timeBox');
  const btn = $('#btnStart');

  function setProgress(pct) { box.style.setProperty('--progress', `${Math.max(0, Math.min(100, pct))}%`); }

  function showIdle() {
    timer.running = false;
    clearInterval(timer.handle);
    document.body.classList.remove('running');
    box.readOnly = false;
    box.value = settings.lastTime || '25:00';
    setProgress(0);
    btn.textContent = '▶ START';
    btn.classList.remove('stop');
    setHero('happy', 'bob');
    $('#bubble').textContent = 'Ready for a quest?';
    document.title = 'PomoQuest';
  }

  async function start() {
    const ms = parseTime(box.value);
    if (!ms) {
      box.classList.remove('bad'); void box.offsetWidth; box.classList.add('bad');
      PQSfx.play('error');
      toast('Try 25, 25:00, 1:30:00 or 1h 30m', 'error');
      return;
    }
    clearTimeout(activityTimer);
    const res = await pq.timerStart(ms, $('#activity').value, [...selectedTags]);
    if (!res.ok) { toast(res.error, 'error'); return; }

    const label = formatClock(ms);
    settings.lastTime = label;
    pq.saveSettings({ lastTime: label });

    timer.running = true;
    timer.plannedMs = ms;
    timer.endAt = Date.now() + ms;
    document.body.classList.add('running');
    box.readOnly = true;
    box.blur();
    btn.textContent = '■ STOP';
    btn.classList.add('stop');
    setHero('focus', 'run');
    $('#bubble').textContent = pick(CHEERS);
    timer.lastBubble = Date.now();
    PQSfx.play('start');
    clearInterval(timer.handle);
    timer.handle = setInterval(tick, 250);
    tick();
  }

  function tick() {
    const left = Math.max(0, timer.endAt - Date.now());
    box.value = formatClock(left);
    setProgress(100 - (left / timer.plannedMs) * 100);
    document.title = `${formatClock(left)} · PomoQuest`;
    if (Date.now() - timer.lastBubble > 60000) { timer.lastBubble = Date.now(); $('#bubble').textContent = pick(CHEERS); }
    if (left <= 0) complete();
  }

  async function stop() {
    clearInterval(timer.handle);
    clearTimeout(activityTimer);
    await pq.timerActivity($('#activity').value, [...selectedTags]);
    const res = await pq.timerStop();
    if (res && (res.logged || res.xpGained)) $('#activity').value = '';
    PQSfx.play('pause');
    showIdle();
    if (res && res.stats) renderStats(res.stats);
    if (res && res.logged) toast('Stopped · logged to Obsidian ✓', 'good');
    else if (res && res.logError) toast(`Stopped · couldn't log: ${res.logError}`, 'error');
    else toast('Timer stopped');
  }

  async function complete() {
    clearInterval(timer.handle);
    timer.running = false;
    box.value = '00:00';
    setProgress(100);
    setHero('cheer', 'jump');
    PQSfx.alarm('fanfare', 3);
    clearTimeout(activityTimer);
    await pq.timerActivity($('#activity').value, [...selectedTags]);
    const res = (await pq.timerDone()) || {};
    $('#activity').value = '';

    PQSprite.drawHero($('#doneHero'), 'cheer');
    const parts = [];
    if (res.xpGained) parts.push(`<div class="xp">+${res.xpGained} XP</div>`);
    if (res.coins) parts.push(`<div class="gold">+${res.coins} COINS</div>`);
    if (res.leveledUp) parts.push(`<div class="lvup">LEVEL UP! LV ${res.stats.level}</div>`);
    $('#doneRewards').innerHTML = parts.join('');
    const logged = res.line || res.previewLine;
    $('#doneNote').textContent = res.logged ? `📜 Logged to Obsidian:\n${logged ? logged.split('\n')[0].replace(/^- /, '').replace(/\*\*/g, '') : ''}`
      : res.logError ? `Couldn't log to Obsidian: ${res.logError}` : '';
    $('#doneModal').classList.remove('hidden');
    $('#btnDoneOk').focus();
    renderStats(res.stats);
    confetti();
    if (res.leveledUp) setTimeout(() => PQSfx.play('levelUp'), 2000);
  }

  async function dismissDone() {
    PQSfx.stopAlarm();
    $('#doneModal').classList.add('hidden');
    await pq.timerAck();
    showIdle();
  }

  // ---------------------------------------------------------------- settings (auto-saved)
  const form = $('#settingsForm');

  async function loadPresets() {
    const list = await pq.presets();
    $('#notePreset').innerHTML = '';
    for (const p of list) {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.example ? `${p.name} · ${p.example}` : p.name;
      $('#notePreset').appendChild(o);
    }
  }

  function fillForm() {
    for (const el of form.elements) {
      if (!el.name || !(el.name in settings)) continue;
      if (el.type === 'checkbox') el.checked = Boolean(settings[el.name]);
      else el.value = settings[el.name];
    }
    $('#nightToggle').checked = settings.theme === 'night';
    $('#customRow').classList.toggle('hidden', settings.notePreset !== 'custom');
    describeVault(settings.vaultPath);
    updatePreview();
  }

  function readForm() {
    const out = {};
    for (const el of form.elements) {
      if (!el.name) continue;
      out[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim();
    }
    out.theme = $('#nightToggle').checked ? 'night' : 'day';
    return out;
  }

  async function describeVault(p) {
    const hint = $('#vaultHint');
    hint.className = 'hint';
    if (!p) { hint.textContent = 'Optional. Without a vault the timer still works, sessions just aren\'t logged.'; return; }
    const d = await pq.detectVault(p);
    if (d.ok && d.isVault) { hint.textContent = `✓ Vault "${d.vaultName}" found`; hint.className = 'hint ok'; }
    else { hint.textContent = '⚠ No .obsidian folder here. Is this your vault?'; hint.className = 'hint warn'; }
  }

  async function updatePreview() {
    const draft = readForm();
    const el = $('#pathPreview');
    if (!draft.vaultPath) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const r = await pq.previewPath(draft);
    el.textContent = r.ok ? `📍 Logs go to: ${r.relative}` : `⚠ ${r.error}`;
  }

  let saveTimer = null;
  function autoSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const res = await pq.saveSettings(readForm());
      if (!res.ok) { toast(res.error, 'error'); return; }
      const keepTime = settings.lastTime;
      settings = { ...res.settings, lastTime: keepTime };
      PQSfx.setEnabled(settings.soundOn);
      const before = settings.lastTags;
      renderTags();
      if (settings.lastTags !== before) pq.saveSettings({ lastTags: settings.lastTags });
      applyTheme();
    }, 350);
  }

  function onFormChange(e) {
    if (e.target.name === 'notePreset') $('#customRow').classList.toggle('hidden', e.target.value !== 'custom');
    if (e.target.name === 'vaultPath' && e.type === 'change') describeVault(e.target.value.trim());
    updatePreview();
    autoSave();
  }

  async function pickVault() {
    const res = await pq.pickVault();
    if (!res.ok) { if (res.error) toast(res.error, 'error'); return; }
    form.elements.vaultPath.value = res.path;
    if (res.dailyNotes) {
      form.elements.notesFolder.value = res.dailyNotes.folder;
      form.elements.notePreset.value = res.suggestedPreset;
      if (res.suggestedPreset === 'custom') form.elements.noteFormat.value = res.dailyNotes.format;
      $('#customRow').classList.toggle('hidden', res.suggestedPreset !== 'custom');
      toast('Matched your Obsidian daily notes 📅', 'good');
    }
    describeVault(res.path);
    updatePreview();
    autoSave();
  }

  function openSettings() { fillForm(); $('#settingsSheet').classList.remove('hidden'); }
  function closeSettings() { $('#settingsSheet').classList.add('hidden'); }

  // ---------------------------------------------------------------- wiring
  function wire() {
    btn.addEventListener('click', () => (timer.running ? stop() : start()));
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !timer.running) start(); });
    box.addEventListener('focus', () => { if (!timer.running) box.select(); });
    $('#activity').addEventListener('input', onActivityChange);
    $('#activity').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !timer.running) start(); });

    $('#btnDoneOk').addEventListener('click', dismissDone);
    $('#btnSettings').addEventListener('click', openSettings);
    $('#btnCloseSettings').addEventListener('click', closeSettings);
    $('#settingsSheet').addEventListener('click', (e) => { if (e.target.id === 'settingsSheet') closeSettings(); });
    form.addEventListener('input', onFormChange);
    form.addEventListener('change', onFormChange);
    form.addEventListener('submit', (e) => e.preventDefault());
    $('#btnPickVault').addEventListener('click', pickVault);
    $('#btnOpenNote').addEventListener('click', async () => {
      if (!settings.vaultPath) { toast('Choose a vault first', 'error'); return; }
      const r = await pq.openNote();
      if (!r.ok) toast(r.error, 'error');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('#doneModal').classList.contains('hidden')) dismissDone();
      else closeSettings();
    });

    // Window tried to minimise/close while the timer runs.
    pq.on('nudge', () => {
      $('#hero').classList.remove('shake'); void $('#hero').offsetWidth;
      setHero('worried', 'shake');
      $('#bubble').textContent = 'Stop the timer first! ✋';
      PQSfx.play('error');
      setTimeout(() => { if (timer.running) setHero('focus', 'run'); }, 1500);
    });
  }

  // ---------------------------------------------------------------- boot
  async function boot() {
    settings = await pq.getSettings();
    PQSfx.setEnabled(settings.soundOn);
    applyTheme();
    PQSprite.drawHero($('#hudHero'), 'happy');
    renderStats(await pq.getStats());
    await loadPresets();
    selectedTags = new Set(splitTags(settings.lastTags));
    renderTags();
    wire();
    showIdle();
    box.focus();
  }

  boot();
})();
