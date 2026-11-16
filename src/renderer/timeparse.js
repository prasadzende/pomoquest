// Turns what the user types in the time box into milliseconds.
// Accepts: "25" (minutes), "25:00", "1:30:00", "90s", "1h 30m", "1.5h", "45 min".
(function (root) {
  const MAX = 24 * 60 * 60 * 1000;

  function parseTime(input) {
    const s = String(input || '').trim().toLowerCase().replace(',', '.');
    if (!s) return null;
    let ms = null;

    if (/^\d+(\.\d+)?$/.test(s)) {
      ms = parseFloat(s) * 60000;
    } else if (/^\d+(:\d{1,2}){1,2}$/.test(s)) {
      const parts = s.split(':').map(Number);
      if (parts.slice(1).some((p) => p > 59)) return null;
      ms = parts.length === 2 ? (parts[0] * 60 + parts[1]) * 1000 : (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    } else {
      const re = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/g;
      let total = 0;
      let used = '';
      let m;
      while ((m = re.exec(s))) {
        const n = parseFloat(m[1]);
        const u = m[2][0];
        total += u === 'h' ? n * 3600000 : u === 'm' ? n * 60000 : n * 1000;
        used += m[0];
      }
      if (used.replace(/\s/g, '') !== s.replace(/\s/g, '')) return null;
      ms = total;
    }
    ms = Math.round(ms / 1000) * 1000;
    return ms > 0 && ms <= MAX ? ms : null;
  }

  function formatClock(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    const p = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
  }

  const api = { parseTime, formatClock };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PQTime = api;
})(typeof window !== 'undefined' ? window : globalThis);
