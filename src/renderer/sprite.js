// Pixel-art tomato hero, drawn on a 16x16 canvas and scaled up with CSS.
(function () {
  const BASE = [
    '................',
    '.......KK.......',
    '.......gK.......',
    '...KKK.gg.KKK...',
    '..KGGGKggKGGGK..',
    '..KKGGGggGGGKK..',
    '..KRKKgGGgKKRK..',
    '.KRHRRKKKKRRRRK.',
    '.KHHRRRRRRRRRRK.',
    'KRHRRRRRRRRRRRrK',
    'KRRRRRRRRRRRRRrK',
    'KRRRRRRRRRRRRrrK',
    'KRRRRRRRRRRRrrrK',
    '.KRRRRRRRRRrrrK.',
    '..KKrrrrrrrrKK..',
    '....KKKKKKKK....'
  ];
  const PAL = {
    K: '#3b1d2a', R: '#ff636b', r: '#de4052', H: '#ffbebe', G: '#6ed678', g: '#34a050',
    E: '#3b1d2a', W: '#ffffff', B: '#ff96b4', T: '#7cc8ff'
  };
  const blush = { '2,11': 'B', '3,11': 'B', '12,11': 'B', '13,11': 'B' };
  const FACES = {
    happy: { '4,9': 'W', '5,9': 'E', '4,10': 'E', '5,10': 'E', '10,9': 'W', '11,9': 'E', '10,10': 'E', '11,10': 'E',
      '6,11': 'E', '9,11': 'E', '7,12': 'E', '8,12': 'E', ...blush },
    focus: { '4,9': 'E', '5,9': 'E', '4,10': 'W', '5,10': 'E', '10,9': 'E', '11,9': 'E', '10,10': 'E', '11,10': 'W',
      '3,8': 'E', '4,8': 'E', '11,8': 'E', '12,8': 'E', '7,12': 'E', '8,12': 'E', ...blush },
    cheer: { '3,10': 'E', '4,9': 'E', '5,10': 'E', '10,10': 'E', '11,9': 'E', '12,10': 'E',
      '6,11': 'E', '7,11': 'E', '8,11': 'E', '9,11': 'E', '7,12': 'r', '8,12': 'r', ...blush },
    sleep: { '3,10': 'E', '4,10': 'E', '5,10': 'E', '10,10': 'E', '11,10': 'E', '12,10': 'E', '7,12': 'E', ...blush },
    worried: { '4,9': 'W', '5,9': 'E', '4,10': 'E', '5,10': 'E', '10,9': 'W', '11,9': 'E', '10,10': 'E', '11,10': 'E',
      '7,12': 'E', '8,12': 'E', '6,13': 'E', '9,13': 'E', '13,8': 'T', '13,9': 'T', ...blush }
  };

  function drawHero(canvas, mood = 'happy') {
    const ctx = canvas.getContext('2d');
    canvas.width = 16; canvas.height = 16;
    ctx.clearRect(0, 0, 16, 16);
    const face = FACES[mood] || FACES.happy;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const c = face[`${x},${y}`] || BASE[y][x];
        if (c === '.') continue;
        ctx.fillStyle = PAL[c];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  window.PQSprite = { drawHero };
})();
