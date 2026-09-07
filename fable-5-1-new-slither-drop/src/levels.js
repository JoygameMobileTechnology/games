/* SlitherDrop — handcrafted levels.
   map: rows top->bottom, '.' empty, letter = stickman color (R red, B blue, G green, Y yellow, P purple, O orange).
   holes: cells listed end-to-end as [col,row]; capacity = number of cells.
   solution: verification script (tools/verify.js). Each entry moves one end of a hole:
     { h, end, to:[c,r] } routes the leading end to a cell (shortest legal path), or { h, end, path:'UDLR' }. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SDLevels = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TIERS = {
    tutorial: { label: 'Tutorial', color: '#3fb0f2' },
    easy:     { label: 'Easy',     color: '#5cc85a' },
    medium:   { label: 'Medium',   color: '#f7a62b' },
    hard:     { label: 'Hard',     color: '#ef4d5c' },
    expert:   { label: 'Expert',   color: '#9b5fe8' },
  };

  const LEVELS = [
    // ---------------------------------------------------------------- 1
    {
      name: 'First Bite', tier: 'tutorial', cols: 4, rows: 5, time: 60,
      hint: 'Drag the hole from its end onto the matching stickmen.',
      map: [
        '....',
        '.R..',
        '.R..',
        '....',
        '....',
      ],
      holes: [
        { color: 'R', cells: [[1, 4], [2, 4]] },
      ],
      solution: [{ h: 0, end: 0, path: 'UUU' }],
    },
    // ---------------------------------------------------------------- 2
    {
      name: 'Two Colors', tier: 'tutorial', cols: 4, rows: 5, time: 60,
      hint: 'Other colors block the way. Holes can be dragged from either end.',
      map: [
        'R..B',
        '....',
        'B..R',
        '....',
        '....',
      ],
      holes: [
        { color: 'R', cells: [[1, 4], [0, 4]] },
        { color: 'B', cells: [[2, 4], [3, 4]] },
      ],
      solution: [
        { h: 0, end: 0, path: 'URRUULULL' },
        { h: 1, end: 0, path: 'ULLUURURR' },
      ],
    },
    // ---------------------------------------------------------------- 3
    {
      name: 'Around the Bend', tier: 'easy', cols: 5, rows: 6, time: 75,
      map: [
        '.G...',
        '.Y.G.',
        '.G...',
        '....Y',
        '.....',
        '.....',
      ],
      holes: [
        { color: 'G', cells: [[1, 4], [0, 4], [0, 5]] },
        { color: 'Y', cells: [[3, 5], [4, 5]] },
      ],
      solution: [
        { h: 0, end: 0, to: [1, 2] }, { h: 0, end: 0, to: [1, 0] }, { h: 0, end: 1, to: [3, 1] },
        { h: 1, end: 0, to: [4, 3] }, { h: 1, end: 0, to: [1, 1] },
      ],
    },
    // ---------------------------------------------------------------- 4
    {
      name: 'Crossroads', tier: 'easy', cols: 5, rows: 6, time: 75,
      map: [
        'R...G',
        '..B..',
        '.R...',
        'B..R.',
        '..G..',
        '.....',
      ],
      holes: [
        { color: 'R', cells: [[1, 4], [0, 4], [0, 5]] },
        { color: 'B', cells: [[2, 5], [3, 5]] },
        { color: 'G', cells: [[4, 4], [4, 5]] },
      ],
      solution: [
        { h: 2, end: 0, to: [2, 4] }, { h: 2, end: 0, to: [4, 0] },
        { h: 1, end: 0, to: [2, 1] }, { h: 1, end: 0, to: [0, 3] },
        { h: 0, end: 0, to: [3, 3] }, { h: 0, end: 0, to: [0, 0] }, { h: 0, end: 0, to: [1, 2] },
      ],
    },
    // ---------------------------------------------------------------- 5
    {
      name: 'Detour', tier: 'easy', cols: 5, rows: 6, time: 75,
      map: [
        'Y.P.O',
        '.....',
        'PY.O.',
        '....Y',
        '.P...',
        '.....',
      ],
      holes: [
        { color: 'Y', cells: [[0, 4], [0, 5], [1, 5]] },
        { color: 'P', cells: [[2, 4], [2, 5], [3, 5]] },
        { color: 'O', cells: [[4, 4], [4, 5]] },
      ],
      solution: [
        { h: 2, end: 0, to: [3, 2] }, { h: 2, end: 0, to: [4, 0] },
        { h: 0, end: 0, to: [1, 2] }, { h: 0, end: 0, to: [0, 0] }, { h: 0, end: 1, to: [4, 3] },
        { h: 1, end: 0, to: [2, 0] }, { h: 1, end: 0, to: [0, 2] }, { h: 1, end: 0, to: [1, 4] },
      ],
    },
    // ---------------------------------------------------------------- 6
    {
      name: 'Slate Garden', tier: 'medium', cols: 6, rows: 7, time: 100,
      map: [
        'B.R.B.',
        '.G...Y',
        'R.B.G.',
        '...R.B',
        'Y.....',
        '......',
        '......',
      ],
      holes: [
        { color: 'B', cells: [[0, 5], [1, 5], [1, 6], [2, 6]] },
        { color: 'Y', cells: [[2, 5], [3, 5]] },
        { color: 'R', cells: [[4, 5], [4, 6], [3, 6]] },
        { color: 'G', cells: [[5, 5], [5, 6]] },
      ],
      solution: [
        { h: 3, end: 0, to: [4, 2] }, { h: 3, end: 0, to: [1, 1] },
        { h: 1, end: 0, to: [5, 1] }, { h: 1, end: 1, to: [0, 4] },
        { h: 2, end: 0, to: [3, 3] }, { h: 2, end: 0, to: [2, 0] }, { h: 2, end: 0, to: [0, 2] },
        { h: 0, end: 0, to: [0, 0] }, { h: 0, end: 0, to: [4, 0] }, { h: 0, end: 0, to: [5, 3] }, { h: 0, end: 1, to: [2, 2] },
      ],
    },
    // ---------------------------------------------------------------- 7
    {
      name: 'Tight Squeeze', tier: 'medium', cols: 6, rows: 7, time: 100,
      map: [
        'P.O..G',
        '....B.',
        'G.P..O',
        '.B....',
        '.P.P..',
        '......',
        '......',
      ],
      holes: [
        { color: 'P', cells: [[0, 5], [0, 6], [1, 6], [1, 5]] },
        { color: 'B', cells: [[3, 5], [4, 5]] },
        { color: 'O', cells: [[5, 5], [5, 6]] },
        { color: 'G', cells: [[2, 6], [3, 6]] },
      ],
      solution: [
        { h: 0, end: 0, to: [1, 4] }, { h: 0, end: 0, to: [3, 4] }, { h: 0, end: 0, to: [2, 2] }, { h: 0, end: 0, to: [0, 0] },
        { h: 1, end: 1, to: [4, 1] }, { h: 1, end: 1, to: [1, 3] },
        { h: 2, end: 0, to: [5, 2] }, { h: 2, end: 0, to: [2, 0] },
        { h: 3, end: 0, to: [5, 0] }, { h: 3, end: 1, to: [0, 2] },
      ],
    },
    // ---------------------------------------------------------------- 8
    {
      name: 'Interlock', tier: 'medium', cols: 6, rows: 7, time: 100,
      map: [
        '.R..Y.',
        '..BG..',
        '.Y..R.',
        '..GB..',
        '.R..Y.',
        '......',
        '......',
      ],
      holes: [
        { color: 'R', cells: [[1, 5], [0, 5], [0, 6]] },
        { color: 'Y', cells: [[4, 5], [5, 5], [5, 6]] },
        { color: 'B', cells: [[2, 5], [2, 6]] },
        { color: 'G', cells: [[3, 6], [4, 6]] },
      ],
      solution: [
        { h: 2, end: 0, to: [3, 3] }, { h: 2, end: 0, to: [2, 1] },
        { h: 3, end: 0, to: [2, 3] }, { h: 3, end: 0, to: [3, 1] },
        { h: 1, end: 0, to: [4, 4] }, { h: 1, end: 0, to: [4, 0] }, { h: 1, end: 1, to: [1, 2] },
        { h: 0, end: 0, to: [1, 4] }, { h: 0, end: 0, to: [4, 2] }, { h: 0, end: 0, to: [1, 0] },
      ],
    },
    // ---------------------------------------------------------------- 9
    {
      name: 'Corridors', tier: 'hard', cols: 7, rows: 8, time: 130,
      map: [
        'RG.B.PR',
        '...B...',
        'G.R..G.',
        '....P..',
        'B..R...',
        '.......',
        '.......',
        '.......',
      ],
      holes: [
        { color: 'R', cells: [[0, 6], [1, 6], [1, 7], [2, 7]] },
        { color: 'G', cells: [[3, 6], [4, 6], [5, 6]] },
        { color: 'B', cells: [[5, 5], [6, 5], [6, 6]] },
        { color: 'P', cells: [[5, 7], [6, 7]] },
      ],
      solution: [
        { h: 1, end: 0, to: [0, 2] }, { h: 1, end: 0, to: [1, 0] }, { h: 1, end: 1, to: [5, 2] },
        { h: 3, end: 0, to: [4, 3] }, { h: 3, end: 0, to: [5, 0] },
        { h: 2, end: 0, to: [3, 1] }, { h: 2, end: 0, to: [3, 0] }, { h: 2, end: 0, to: [0, 4] },
        { h: 0, end: 0, to: [0, 0] }, { h: 0, end: 0, to: [2, 2] }, { h: 0, end: 0, to: [3, 4] }, { h: 0, end: 0, to: [6, 0] },
      ],
    },
    // ---------------------------------------------------------------- 10
    {
      name: 'Gridlock', tier: 'hard', cols: 7, rows: 8, time: 130,
      map: [
        'R..Y..G',
        '.B...O.',
        '..Y.R.B',
        'G..B..Y',
        '..R..B.',
        '.O.....',
        '.......',
        '.......',
      ],
      holes: [
        { color: 'R', cells: [[6, 4], [6, 5], [5, 5]] },
        { color: 'O', cells: [[6, 6], [6, 7]] },
        { color: 'G', cells: [[4, 7], [5, 7]] },
        { color: 'Y', cells: [[4, 6], [3, 6], [3, 7]] },
        { color: 'B', cells: [[0, 6], [1, 6], [1, 7], [2, 7]] },
      ],
      solution: [
        { h: 0, end: 1, to: [4, 2] }, { h: 0, end: 0, to: [2, 4] }, { h: 0, end: 0, to: [0, 0] },
        { h: 2, end: 1, to: [0, 3] }, { h: 2, end: 1, to: [6, 0] },
        { h: 3, end: 0, to: [6, 3] }, { h: 3, end: 1, to: [2, 2] }, { h: 3, end: 1, to: [3, 0] },
        { h: 1, end: 0, to: [5, 1] }, { h: 1, end: 1, to: [1, 5] },
        { h: 4, end: 1, to: [5, 4] }, { h: 4, end: 1, to: [3, 3] }, { h: 4, end: 1, to: [6, 2] }, { h: 4, end: 1, to: [1, 1] },
      ],
    },
    // ---------------------------------------------------------------- 11
    {
      name: 'Serpentine', tier: 'expert', cols: 8, rows: 9, time: 170,
      map: [
        'R.B..G.P',
        '...Y....',
        'B.R..P.Y',
        '....B...',
        'G.Y...R.',
        '....G...',
        '.R......',
        '........',
        '........',
      ],
      holes: [
        { color: 'R', cells: [[0, 7], [1, 7], [1, 8], [2, 8]] },
        { color: 'B', cells: [[4, 7], [3, 7], [3, 8]] },
        { color: 'G', cells: [[6, 7], [7, 7], [7, 8]] },
        { color: 'Y', cells: [[4, 8], [5, 8], [6, 8]] },
        { color: 'P', cells: [[7, 4], [7, 5]] },
      ],
      solution: [
        { h: 4, end: 1, to: [5, 2] }, { h: 4, end: 1, to: [7, 0] },
        { h: 2, end: 0, to: [4, 5] }, { h: 2, end: 0, to: [5, 0] }, { h: 2, end: 1, to: [0, 4] },
        { h: 3, end: 1, to: [7, 2] }, { h: 3, end: 1, to: [3, 1] }, { h: 3, end: 1, to: [2, 4] },
        { h: 1, end: 0, to: [4, 3] }, { h: 1, end: 0, to: [0, 2] }, { h: 1, end: 0, to: [2, 0] },
        { h: 0, end: 0, to: [0, 0] }, { h: 0, end: 0, to: [2, 2] }, { h: 0, end: 0, to: [6, 4] }, { h: 0, end: 0, to: [1, 6] },
      ],
    },
    // ---------------------------------------------------------------- 12
    {
      name: 'Six Shades', tier: 'expert', cols: 8, rows: 9, time: 170,
      map: [
        'P.R..B.O',
        '.Y..G...',
        '...B..RP',
        'G.O..Y..',
        '....R...',
        '.B.Y..G.',
        '..R.....',
        '........',
        '........',
      ],
      holes: [
        { color: 'O', cells: [[0, 4], [0, 5]] },
        { color: 'P', cells: [[7, 4], [7, 5]] },
        { color: 'R', cells: [[0, 7], [1, 7], [1, 8], [2, 8]] },
        { color: 'B', cells: [[4, 7], [3, 7], [3, 8]] },
        { color: 'Y', cells: [[4, 8], [5, 8], [6, 8]] },
        { color: 'G', cells: [[6, 7], [7, 7], [7, 8]] },
      ],
      solution: [
        { h: 1, end: 0, to: [7, 2] }, { h: 1, end: 0, to: [0, 0] },
        { h: 5, end: 0, to: [6, 5] }, { h: 5, end: 0, to: [4, 1] }, { h: 5, end: 0, to: [0, 3] },
        { h: 4, end: 1, to: [5, 3] }, { h: 4, end: 1, to: [3, 5] }, { h: 4, end: 1, to: [1, 1] },
        { h: 3, end: 0, to: [3, 2] }, { h: 3, end: 0, to: [1, 5] }, { h: 3, end: 1, to: [5, 0] },
        { h: 0, end: 1, to: [2, 3] }, { h: 0, end: 1, to: [7, 0] },
        { h: 2, end: 0, to: [2, 0] }, { h: 2, end: 0, to: [6, 2] }, { h: 2, end: 0, to: [4, 4] }, { h: 2, end: 0, to: [2, 6] },
      ],
    },
  ];

  // Lower-case letters in a map are hole placeholders in the design notes; the engine only reads upper-case stickmen.
  // Normalise: any character that is not an upper-case color letter becomes '.'.
  for (const lv of LEVELS) {
    lv.map = lv.map.map(row => row.replace(/[^RBGYPO]/g, '.'));
  }

  return { LEVELS, TIERS };
});
