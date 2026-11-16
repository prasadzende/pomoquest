// Everything that touches the Obsidian vault lives here (pure Node, easy to test).
const fs = require('fs');
const path = require('path');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (n, w = 2) => String(n).padStart(w, '0');

/** Note-name choices shown in Settings. "custom" lets the user type a format. */
const NOTE_PRESETS = [
  { id: 'daily', name: 'Daily note', format: 'YYYY-MM-DD' },
  { id: 'daily-uk', name: 'Daily note (day first)', format: 'DD-MM-YYYY' },
  { id: 'daily-long', name: 'Daily note with weekday', format: 'YYYY-MM-DD dddd' },
  { id: 'weekly', name: 'Weekly note', format: 'GGGG-[W]WW' },
  { id: 'monthly', name: 'Monthly note', format: 'YYYY-MM' },
  { id: 'single', name: 'One note for everything', format: '[Pomodoro Log]' },
  { id: 'custom', name: 'Custom name…', format: null }
];

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { year: d.getUTCFullYear(), week: Math.ceil(((d - yearStart) / DAY_MS + 1) / 7) };
}

/** Moment.js-style formatting (the subset Obsidian users actually use). Text in [brackets] is kept as-is. */
function formatDate(date, fmt) {
  const re = /\[([^\]]*)\]|GGGG|YYYY|YY|MMMM|MMM|MM|M|Do|DD|D|dddd|ddd|WW|W|HH|H|hh|h|mm|ss|A|a/g;
  return String(fmt).replace(re, (tok, literal) => {
    if (literal !== undefined) return literal;
    const h = date.getHours();
    switch (tok) {
      case 'GGGG': return String(isoWeek(date).year);
      case 'YYYY': return String(date.getFullYear());
      case 'YY': return String(date.getFullYear()).slice(-2);
      case 'MMMM': return MONTHS[date.getMonth()];
      case 'MMM': return MONTHS[date.getMonth()].slice(0, 3);
      case 'MM': return pad(date.getMonth() + 1);
      case 'M': return String(date.getMonth() + 1);
      case 'Do': return ordinal(date.getDate());
      case 'DD': return pad(date.getDate());
      case 'D': return String(date.getDate());
      case 'dddd': return DAYS[date.getDay()];
      case 'ddd': return DAYS[date.getDay()].slice(0, 3);
      case 'WW': return pad(isoWeek(date).week);
      case 'W': return String(isoWeek(date).week);
      case 'HH': return pad(h);
      case 'H': return String(h);
      case 'hh': return pad(h % 12 || 12);
      case 'h': return String(h % 12 || 12);
      case 'mm': return pad(date.getMinutes());
      case 'ss': return pad(date.getSeconds());
      case 'A': return h < 12 ? 'AM' : 'PM';
      case 'a': return h < 12 ? 'am' : 'pm';
      default: return tok;
    }
  });
}

/** The format string currently in use, based on the chosen preset. */
function noteFormatOf(settings) {
  const p = NOTE_PRESETS.find((x) => x.id === settings.notePreset);
  if (p && p.format) return p.format;
  return String(settings.noteFormat || '').trim() || 'YYYY-MM-DD';
}

/** True when the note name changes every day (so log lines don't need the date). */
function isPerDayNote(format) {
  const base = new Date(2026, 0, 5, 12);
  for (let i = 0; i < 6; i++) {
    const a = new Date(base.getTime() + i * DAY_MS);
    const b = new Date(a.getTime() + DAY_MS);
    if (formatDate(a, format) === formatDate(b, format)) return false;
  }
  return true;
}

function presetList(date = new Date()) {
  return NOTE_PRESETS.map((p) => ({ ...p, example: p.format ? formatDate(date, p.format) : '' }));
}

function presetForFormat(format) {
  const p = NOTE_PRESETS.find((x) => x.format === format);
  return p ? p.id : 'custom';
}

function cleanFolder(folder) {
  return String(folder || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim();
}

/** Absolute path of the note for `date`. Refuses to leave the vault. */
function notePath(settings, date) {
  if (!settings.vaultPath) throw new Error('No Obsidian vault chosen yet. Pick one in Settings.');
  const vault = path.resolve(settings.vaultPath);
  const name = formatDate(date, noteFormatOf(settings)).replace(/\\/g, '/').replace(/[:*?"<>|]/g, '-').trim();
  if (!name) throw new Error('The note name is empty.');
  const rel = [cleanFolder(settings.notesFolder), name + '.md'].filter(Boolean).join('/');
  const full = path.resolve(vault, ...rel.split('/'));
  if (!full.startsWith(vault + path.sep)) throw new Error('The note must be inside the vault.');
  return full;
}

/** Insert `entry` at the end of the section that starts with `heading` (created if missing). */
function insertUnderHeading(content, heading, entry) {
  const nl = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.length ? content.split(/\r?\n/) : [];
  const trimEnd = () => { while (lines.length && lines[lines.length - 1].trim() === '') lines.pop(); };
  const h = String(heading || '').trim();

  if (!h) {
    trimEnd();
    lines.push(...String(entry).split(/\r?\n/));
    return lines.join(nl) + nl;
  }
  const idx = lines.findIndex((l) => l.trim() === h);
  if (idx === -1) {
    trimEnd();
    if (lines.length) lines.push('');
    lines.push(h, ...String(entry).split(/\r?\n/));
    return lines.join(nl) + nl;
  }
  const level = (h.match(/^#+/) || [''])[0].length;
  let end = lines.length;
  for (let i = idx + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s/);
    if (m && (level === 0 || m[1].length <= level)) { end = i; break; }
  }
  let at = end;
  while (at > idx + 1 && lines[at - 1].trim() === '') at--;
  lines.splice(at, 0, ...String(entry).split(/\r?\n/));
  let out = lines.join(nl);
  if (!out.endsWith(nl)) out += nl;
  return out;
}

function minutesText(ms) {
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Turn "Deep Work", "#review" etc. into valid Obsidian tags: #deep-work, #review. */
function toTag(t) {
  const clean = String(t || '').trim().replace(/^#+/, '').replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_\-/]/gu, '');
  return clean && !/^\d+$/.test(clean) ? '#' + clean : '';
}

function parseTagList(text) {
  const seen = new Set();
  return String(text || '').split(/[,\n]/).map(toTag).filter((t) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()));
}

/** Markdown for a Pomodoro session: a bullet, plus indented lines for any extra comment lines. */
function sessionLine({ start, end, plannedMs, completed, includeDate, activity, tags }) {
  const s = new Date(start);
  const e = new Date(end);
  const when = `${includeDate ? formatDate(s, 'ddd D MMM') + ', ' : ''}${formatDate(s, 'HH:mm')} – ${formatDate(e, 'HH:mm')}`;
  const length = completed ? minutesText(plannedMs) : `${minutesText(end - start)} of ${minutesText(plannedMs)}, stopped early`;
  const notes = String(activity || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const title = notes.shift() || 'Focus session';
  const tagText = (Array.isArray(tags) ? tags : parseTagList(tags)).map(toTag).filter(Boolean).join(' ');
  const head = `- ${completed ? '🍅' : '⏹️'} **${when}** (${length}) ${title}${tagText ? ' ' + tagText : ''}`;
  return [head, ...notes.map((n) => `\t- ${n.replace(/^[-*]\s+/, '')}`)].join('\n');
}

/** Log a session into the vault. Returns { file, line }. */
function logSession(settings, session) {
  if (!fs.existsSync(settings.vaultPath || '')) {
    throw new Error('The vault folder could not be found. Check it in Settings.');
  }
  const date = new Date(session.start);
  const file = notePath(settings, date);
  const line = sessionLine({ ...session, includeDate: !isPerDayNote(noteFormatOf(settings)) });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  fs.writeFileSync(file, insertUnderHeading(existing, settings.logHeading, line), 'utf8');
  return { file, line };
}

/** Look at a folder and pull Obsidian's own daily-note settings if present. */
function detectVault(vaultPath) {
  const result = { isVault: false, vaultName: path.basename(vaultPath || ''), dailyNotes: null };
  if (!vaultPath || !fs.existsSync(vaultPath)) return result;
  const obs = path.join(vaultPath, '.obsidian');
  result.isVault = fs.existsSync(obs);
  try {
    const dn = path.join(obs, 'daily-notes.json');
    if (fs.existsSync(dn)) {
      const cfg = JSON.parse(fs.readFileSync(dn, 'utf8'));
      result.dailyNotes = { folder: cfg.folder || '', format: cfg.format || 'YYYY-MM-DD' };
    }
  } catch (_) { /* ignore a malformed config */ }
  return result;
}

function obsidianUri(settings, file) {
  const vault = path.resolve(settings.vaultPath);
  const rel = path.relative(vault, file).split(path.sep).join('/');
  return `obsidian://open?vault=${encodeURIComponent(path.basename(vault))}&file=${encodeURIComponent(rel)}`;
}

module.exports = {
  NOTE_PRESETS, formatDate, noteFormatOf, isPerDayNote, presetList, presetForFormat, notePath,
  insertUnderHeading, sessionLine, logSession, toTag, parseTagList, detectVault, obsidianUri
};
