/* Verifies every level: static checks, scripted solution replay, and (optionally) a BFS solvability search.
   Usage: node tools/verify.js [--no-bfs] [--level N] [--print] [--max-states N] */
const core = require('../src/core.js');
const { LEVELS } = require('../src/levels.js');

const args = process.argv.slice(2);
const noBfs = args.includes('--no-bfs');
const print = args.includes('--print');
const onlyIdx = args.includes('--level') ? parseInt(args[args.indexOf('--level') + 1], 10) - 1 : -1;
const maxStates = args.includes('--max-states') ? parseInt(args[args.indexOf('--max-states') + 1], 10) : 600000;

let failures = 0;

function renderBoard(level) {
  const st = new core.State(level);
  const rows = [];
  for (let r = 0; r < level.rows; r++) {
    let line = '';
    for (let c = 0; c < level.cols; c++) {
      const h = st.holeAt(c, r);
      const s = st.stickAt(c, r);
      if (h) {
        const isEnd = h.index === 0 || h.index === h.hole.cells.length - 1;
        line += isEnd ? '[' + h.hole.color.toLowerCase() + ']' : ' ' + h.hole.color.toLowerCase() + ' ';
      } else if (s) line += ' ' + s + ' ';
      else line += ' . ';
    }
    rows.push(line);
  }
  return rows.join('\n');
}

LEVELS.forEach((lv, i) => {
  if (onlyIdx >= 0 && i !== onlyIdx) return;
  const tag = 'L' + (i + 1) + ' "' + lv.name + '" (' + lv.cols + 'x' + lv.rows + ', ' + lv.holes.length + ' holes)';
  const problems = core.validateLevel(lv);
  let line = tag + ': ';
  if (problems.length) { failures++; line += 'INVALID -> ' + problems.join('; '); console.log(line); return; }
  line += 'valid';
  if (lv.solution) {
    const res = core.runSolution(lv, lv.solution);
    if (!res.won) { failures++; line += ' | script FAILED: ' + res.error + ' (remaining ' + res.remaining + ')'; }
    else line += ' | script OK (' + res.steps + ' steps)';
  } else {
    line += ' | no script';
  }
  if (!noBfs) {
    const t0 = Date.now();
    const sol = core.solve(lv, { maxStates, maxMillis: 25000 });
    const ms = Date.now() - t0;
    if (sol.solved) {
      line += ' | BFS optimal ' + sol.steps + ' steps (' + sol.states + ' states, ' + ms + 'ms)';
      if (print) line += '\n   ' + JSON.stringify(core.compressMoves(sol.moves));
    } else if (sol.capped) {
      line += ' | BFS capped after ' + sol.states + ' states (' + ms + 'ms)';
    } else {
      failures++;
      line += ' | BFS: UNSOLVABLE (' + sol.states + ' states)';
    }
  }
  console.log(line);
  if (print) console.log(renderBoard(lv) + '\n');
});

if (failures) { console.log('\n' + failures + ' problem(s).'); process.exit(1); }
console.log('\nAll levels OK.');
