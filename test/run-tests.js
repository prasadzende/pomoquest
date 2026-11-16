// Run with: npm test  (no Electron needed)
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const v = require('../src/vault');
const { parseTime, formatClock } = require('../src/renderer/timeparse');
const { DEFAULT_SETTINGS } = require('../src/defaults');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ✓', name); };

console.log('Time box');
test('understands the ways you might type a time', () => {
  assert.strictEqual(parseTime('25'), 25 * 60000);
  assert.strictEqual(parseTime('25:00'), 25 * 60000);
  assert.strictEqual(parseTime('0:30'), 30000);
  assert.strictEqual(parseTime('1:30:00'), 90 * 60000);
  assert.strictEqual(parseTime('1h 30m'), 90 * 60000);
  assert.strictEqual(parseTime('1.5h'), 90 * 60000);
  assert.strictEqual(parseTime('45 min'), 45 * 60000);
  assert.strictEqual(parseTime('90s'), 90000);
  for (const bad of ['', 'abc', '0', '25:99', '-5', '25 apples', '30h']) assert.strictEqual(parseTime(bad), null, bad);
  assert.strictEqual(formatClock(25 * 60000), '25:00');
  assert.strictEqual(formatClock(90 * 60000), '1:30:00');
});

console.log('Note names');
const d = new Date(2026, 10, 16, 11, 0);
test('every preset produces the expected name', () => {
  const ex = Object.fromEntries(v.presetList(d).map((p) => [p.id, p.example]));
  assert.deepStrictEqual(ex, {
    daily: '2026-11-16', 'daily-uk': '16-11-2026', 'daily-long': '2026-11-16 Monday',
    weekly: '2026-W47', monthly: '2026-11', single: 'Pomodoro Log', custom: ''
  });
  assert.strictEqual(v.formatDate(new Date(2027, 0, 1), 'GGGG-[W]WW'), '2026-W53');
});
test('custom names and per-day detection', () => {
  const s = { ...DEFAULT_SETTINGS, vaultPath: '/tmp/v', notesFolder: 'Focus', notePreset: 'custom', noteFormat: '[Focus] MMMM YYYY' };
  assert.strictEqual(v.notePath(s, d), path.resolve('/tmp/v/Focus/Focus November 2026.md'));
  assert.ok(v.isPerDayNote('YYYY-MM-DD'));
  assert.ok(!v.isPerDayNote('GGGG-[W]WW'));
  assert.ok(!v.isPerDayNote('[Pomodoro Log]'));
  assert.throws(() => v.notePath({ ...s, notesFolder: '../../etc' }, d));
});

console.log('Logging');
test('inserts under the heading, before the next section, keeping line endings', () => {
  assert.strictEqual(v.insertUnderHeading('# Day\n\n## 🍅 Pomodoro Log\n- a\n\n## Notes\nhi\n', '## 🍅 Pomodoro Log', '- b'),
    '# Day\n\n## 🍅 Pomodoro Log\n- a\n- b\n\n## Notes\nhi\n');
  assert.strictEqual(v.insertUnderHeading('# Hi\n', '## Log', '- x'), '# Hi\n\n## Log\n- x\n');
  assert.strictEqual(v.insertUnderHeading('## Log\r\n- a\r\n', '## Log', '- b'), '## Log\r\n- a\r\n- b\r\n');
});
test('writes completed and stopped sessions to the right note', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pq-'));
  fs.mkdirSync(path.join(dir, '.obsidian'));
  fs.writeFileSync(path.join(dir, '.obsidian', 'daily-notes.json'), JSON.stringify({ folder: 'Daily', format: 'DD-MM-YYYY' }));
  const det = v.detectVault(dir);
  assert.ok(det.isVault);
  assert.strictEqual(v.presetForFormat(det.dailyNotes.format), 'daily-uk');

  const s = { ...DEFAULT_SETTINGS, vaultPath: dir, notesFolder: 'Daily', notePreset: 'daily-uk' };
  const start = new Date(2026, 10, 16, 10, 0).getTime();
  v.logSession(s, { start, end: start + 25 * 60000, plannedMs: 25 * 60000, completed: true,
    activity: 'Feature store design doc\nAdded the backfill section', tags: ['deepwork', 'coding'] });
  v.logSession(s, { start: start + 30 * 60000, end: start + 42 * 60000, plannedMs: 50 * 60000, completed: false });
  assert.strictEqual(fs.readFileSync(path.join(dir, 'Daily', '16-11-2026.md'), 'utf8'),
    '## 🍅 Pomodoro Log\n- 🍅 **10:00 – 10:25** (25 min) Feature store design doc #deepwork #coding\n\t- Added the backfill section\n'
    + '- ⏹️ **10:30 – 10:42** (12 min of 50 min, stopped early) Focus session\n');

  const single = { ...s, notesFolder: '', notePreset: 'single' };
  v.logSession(single, { start, end: start + 90 * 60000, plannedMs: 90 * 60000, completed: true });
  assert.strictEqual(fs.readFileSync(path.join(dir, 'Pomodoro Log.md'), 'utf8'),
    '## 🍅 Pomodoro Log\n- 🍅 **Mon 16 Nov, 10:00 – 11:30** (1 h 30 min) Focus session\n');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('tags become valid Obsidian tags', () => {
  assert.deepStrictEqual(v.parseTagList('deepwork, Deep Work, #review!, , 123, deepwork'), ['#deepwork', '#Deep-Work', '#review']);
  assert.strictEqual(v.toTag('café/notes'), '#café/notes');
});
test('a new line in the middle of an existing section keeps the comment lines together', () => {
  const out = v.insertUnderHeading('## Log\n- a\n## Next\n', '## Log', '- b\n\t- note');
  assert.strictEqual(out, '## Log\n- a\n- b\n\t- note\n## Next\n');
});

console.log(`\nAll ${passed} tests passed 🍅`);
