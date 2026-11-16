// Tiny chiptune sound effects generated live with Web Audio (no audio files needed).
(function () {
  let ctx = null;
  let volume = 0.6;
  let enabled = true;
  let alarmTimer = null;

  const N = {
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77,
    C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, C4: 261.63, G4: 392.0, E4: 329.63
  };

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function play(seq, type = 'square') {
    if (!enabled || volume <= 0) return 0;
    const c = ac();
    let t = c.currentTime + 0.03;
    for (const [f, d] of seq) {
      if (f) {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.13 * volume, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d * 0.95);
        o.connect(g).connect(c.destination);
        o.start(t);
        o.stop(t + d);
      }
      t += d;
    }
    return (t - c.currentTime) * 1000;
  }

  const SONGS = {
    click: [[N.A5, 0.04]],
    start: [[N.C5, 0.07], [N.E5, 0.07], [N.G5, 0.12]],
    pause: [[N.G5, 0.07], [N.C5, 0.12]],
    coin: [[N.B5, 0.07], [N.E6, 0.28]],
    fanfare: [[N.C5, 0.11], [N.E5, 0.11], [N.G5, 0.11], [N.C6, 0.26], [0, 0.06], [N.G5, 0.11], [N.C6, 0.42]],
    breakOver: [[N.E5, 0.12], [N.C5, 0.12], [N.E5, 0.12], [N.G5, 0.3]],
    levelUp: [[N.C5, 0.08], [N.E5, 0.08], [N.G5, 0.08], [N.C6, 0.08], [N.E6, 0.08], [N.G6, 0.35]],
    checkIn: [[N.G5, 0.1], [N.E5, 0.1], [N.C6, 0.22], [0, 0.08], [N.G5, 0.1], [N.C6, 0.28]],
    error: [[N.E4, 0.12], [N.C4, 0.25]]
  };

  window.PQSfx = {
    setVolume(v) { volume = Math.max(0, Math.min(1, Number(v))); },
    setEnabled(on) { enabled = Boolean(on); },
    play(name) { return play(SONGS[name] || SONGS.click); },
    alarm(name, repeats) {
      this.stopAlarm();
      let left = Math.max(1, repeats || 1);
      const loop = () => {
        const ms = play(SONGS[name] || SONGS.fanfare);
        left -= 1;
        if (left > 0) alarmTimer = setTimeout(loop, ms + 700);
      };
      loop();
    },
    stopAlarm() { if (alarmTimer) clearTimeout(alarmTimer); alarmTimer = null; }
  };
})();
