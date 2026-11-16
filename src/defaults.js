const DEFAULT_SETTINGS = {
  // Obsidian
  vaultPath: '',
  notesFolder: '',
  notePreset: 'daily',
  noteFormat: 'YYYY-MM-DD',
  logHeading: '## 🍅 Pomodoro Log',
  tags: 'deepwork, coding, meeting, learning, planning, review, email, admin',

  // App
  soundOn: true,
  theme: 'day',
  lastTime: '25:00',
  lastTags: ''
};

const DEFAULT_STATS = {
  xp: 0,
  coins: 0,
  totalSessions: 0,
  totalFocusMinutes: 0,
  streak: 0,
  lastActiveDate: '',
  todayDate: '',
  todaySessions: 0,
  todayFocusMinutes: 0
};

module.exports = { DEFAULT_SETTINGS, DEFAULT_STATS };
