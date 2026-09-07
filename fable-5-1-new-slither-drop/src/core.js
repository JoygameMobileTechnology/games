/* SlitherDrop — core rules. Pure logic, no DOM. Shared by the browser build and tools/verify.js */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SDCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DIRS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
  const DIR_KEYS = ['U', 'D', 'L', 'R'];
  const OPPOSITE = { U: 'D', D: 'U', L: 'R', R: 'L' };

  function key(c, r) { return c + ',' + r; }

  class State {
    constructor(level) {
      if (!level) return;
      this.cols = level.cols;
      this.rows = level.rows;
      this.sticks = new Map(); // "c,r" -> color letter
      level.map.forEach((line, r) => {
        for (let c = 0; c < line.length; c++) {
          const ch = line[c];
          if (ch !== '.' && ch !== ' ') this.sticks.set(key(c, r), ch);
        }
      });
      this.holes = level.holes.map((h, i) => ({
        id: i,
        color: h.color,
        cells: h.cells.map(p => [p[0], p[1]]), // ordered end-to-end
        capacity: h.cells.length,
        filled: 0,
        alive: true,
      }));
    }

    clone() {
      const s = new State(null);
      s.cols = this.cols; s.rows = this.rows;
      s.sticks = new Map(this.sticks);
      s.holes = this.holes.map(h => ({
        id: h.id, color: h.color, cells: h.cells.map(p => [p[0], p[1]]),
        capacity: h.capacity, filled: h.filled, alive: h.alive,
      }));
      return s;
    }

    inBounds(c, r) { return c >= 0 && r >= 0 && c < this.cols && r < this.rows; }
    stickAt(c, r) { return this.sticks.get(key(c, r)) || null; }

    holeAt(c, r) {
      for (const h of this.holes) {
        if (!h.alive) continue;
        for (let i = 0; i < h.cells.length; i++) {
          if (h.cells[i][0] === c && h.cells[i][1] === r) return { hole: h, index: i };
        }
      }
      return null;
    }

    aliveHoles() { return this.holes.filter(h => h.alive); }

    /** end 0 => leading cell is cells[0]; end 1 => leading cell is cells[len-1] */
    leadCell(h, end) { return end === 0 ? h.cells[0] : h.cells[h.cells.length - 1]; }

    canStep(h, end, dir) {
      const d = DIRS[dir];
      const lead = this.leadCell(h, end);
      const c = lead[0] + d[0], r = lead[1] + d[1];
      if (!this.inBounds(c, r)) return { ok: false, reason: 'oob', target: [c, r] };
      const occ = this.holeAt(c, r);
      if (occ) return { ok: false, reason: occ.hole === h ? 'self' : 'hole', target: [c, r], blocker: occ.hole };
      const st = this.stickAt(c, r);
      if (st && st !== h.color) return { ok: false, reason: 'stick', target: [c, r], stick: st };
      return { ok: true, target: [c, r], collect: !!st };
    }

    /** Applies one step. Returns the canStep result extended with collected/satisfied/won. */
    step(h, end, dir) {
      const res = this.canStep(h, end, dir);
      if (!res.ok) return res;
      const [c, r] = res.target;
      if (end === 0) { h.cells.unshift([c, r]); h.cells.pop(); }
      else { h.cells.push([c, r]); h.cells.shift(); }
      res.collected = null;
      res.satisfied = false;
      if (res.collect) {
        this.sticks.delete(key(c, r));
        h.filled++;
        res.collected = h.color;
        if (h.filled >= h.capacity) { h.alive = false; res.satisfied = true; }
      }
      res.won = this.isWon();
      return res;
    }

    isWon() { return this.sticks.size === 0 && this.holes.every(h => !h.alive); }

    legalMoves() {
      const out = [];
      for (const h of this.holes) {
        if (!h.alive) continue;
        const ends = h.cells.length === 1 ? [0] : [0, 1];
        for (const end of ends) for (const dir of DIR_KEYS) {
          if (this.canStep(h, end, dir).ok) out.push({ hole: h, end, dir });
        }
      }
      return out;
    }

    hasMoves() {
      for (const h of this.holes) {
        if (!h.alive) continue;
        const ends = h.cells.length === 1 ? [0] : [0, 1];
        for (const end of ends) for (const dir of DIR_KEYS) if (this.canStep(h, end, dir).ok) return true;
      }
      return false;
    }

    /** Orientation-independent key for solver visited sets. */
    canonicalKey() {
      const parts = [[...this.sticks.keys()].sort().join(';')];
      for (const h of this.holes) {
        if (!h.alive) { parts.push('x'); continue; }
        const a = h.cells.map(p => p[0] + ',' + p[1]).join(';');
        const b = h.cells.slice().reverse().map(p => p[0] + ',' + p[1]).join(';');
        parts.push((a < b ? a : b) + '#' + h.filled);
      }
      return parts.join('|');
    }
  }

  /**
   * BFS over board cells: shortest legal route for the leading end of hole h to reach target.
   * Own body cells are treated as blocked (conservative). Returns an array of dir letters or null.
   */
  function findPath(state, h, end, target, maxLen) {
    maxLen = maxLen || 16;
    const lead = state.leadCell(h, end);
    const tc = target[0], tr = target[1];
    if (lead[0] === tc && lead[1] === tr) return [];
    if (!state.inBounds(tc, tr)) return null;
    const startKey = key(lead[0], lead[1]);
    const prev = new Map([[startKey, null]]);
    const queue = [[lead[0], lead[1], 0]];
    let qi = 0;
    while (qi < queue.length) {
      const [c, r, dist] = queue[qi++];
      if (dist >= maxLen) continue;
      for (const dir of DIR_KEYS) {
        const d = DIRS[dir];
        const nc = c + d[0], nr = r + d[1];
        const k = key(nc, nr);
        if (prev.has(k)) continue;
        if (!state.inBounds(nc, nr)) continue;
        if (state.holeAt(nc, nr)) continue;
        const st = state.stickAt(nc, nr);
        if (st && st !== h.color) continue;
        prev.set(k, [key(c, r), dir]);
        if (nc === tc && nr === tr) {
          const path = [];
          let cur = k;
          while (prev.get(cur)) { const [pk, pd] = prev.get(cur); path.push(pd); cur = pk; }
          return path.reverse();
        }
        queue.push([nc, nr, dist + 1]);
      }
    }
    return null;
  }

  /** Static sanity checks on a level definition. Returns an array of problem strings (empty = fine). */
  function validateLevel(level) {
    const problems = [];
    if (level.map.length !== level.rows) problems.push('map has ' + level.map.length + ' rows, expected ' + level.rows);
    level.map.forEach((line, r) => {
      if (line.length !== level.cols) problems.push('row ' + r + ' has ' + line.length + ' cols, expected ' + level.cols);
    });
    const st = new State(level);
    const stickCount = {}, capCount = {};
    for (const col of st.sticks.values()) stickCount[col] = (stickCount[col] || 0) + 1;
    const seen = new Set();
    level.holes.forEach((h, i) => {
      capCount[h.color] = (capCount[h.color] || 0) + h.cells.length;
      h.cells.forEach((p, j) => {
        const k = key(p[0], p[1]);
        if (!st.inBounds(p[0], p[1])) problems.push('hole ' + i + ' cell ' + j + ' out of bounds');
        if (seen.has(k)) problems.push('hole ' + i + ' cell ' + j + ' overlaps another hole cell');
        seen.add(k);
        if (st.stickAt(p[0], p[1])) problems.push('hole ' + i + ' cell ' + j + ' sits on a stickman');
        if (j > 0) {
          const q = h.cells[j - 1];
          if (Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) !== 1) problems.push('hole ' + i + ' cells ' + (j - 1) + ' and ' + j + ' are not adjacent');
        }
      });
    });
    const colors = new Set([...Object.keys(stickCount), ...Object.keys(capCount)]);
    for (const col of colors) {
      if ((stickCount[col] || 0) !== (capCount[col] || 0)) {
        problems.push('color ' + col + ': ' + (stickCount[col] || 0) + ' stickmen vs capacity ' + (capCount[col] || 0));
      }
    }
    return problems;
  }

  /**
   * Runs a scripted solution: [{ h: holeIndex, end: 0|1, path: 'UULR' }, ...].
   * Returns { won, steps, error, remaining }.
   */
  function runSolution(level, solution) {
    const st = new State(level);
    let steps = 0;
    for (let m = 0; m < solution.length; m++) {
      const mv = solution[m];
      const h = st.holes[mv.h];
      if (!h) return { won: false, steps, error: 'move ' + m + ': no hole ' + mv.h };
      if (!h.alive) return { won: false, steps, error: 'move ' + m + ': hole ' + mv.h + ' already satisfied' };
      let dirs;
      if (mv.path) dirs = mv.path.replace(/\s+/g, '').split('');
      else {
        dirs = findPath(st, h, mv.end, mv.to, 64);
        if (!dirs) return { won: false, steps, error: 'move ' + m + ': hole ' + mv.h + ' (' + h.color + ') end ' + mv.end + ' cannot reach ' + mv.to.join(',') + ' from ' + st.leadCell(h, mv.end).join(',') };
      }
      for (let i = 0; i < dirs.length; i++) {
        const dir = dirs[i];
        if (!DIRS[dir]) return { won: false, steps, error: 'move ' + m + ': bad dir ' + dir };
        const res = st.step(h, mv.end, dir);
        steps++;
        if (!res.ok) {
          return { won: false, steps, error: 'move ' + m + ': hole ' + mv.h + ' blocked (' + res.reason + ') stepping ' + dir + ' into ' + res.target.join(',') };
        }
        if (!h.alive) {
          if (mv.to && i < dirs.length - 1) return { won: false, steps, error: 'move ' + m + ': hole ' + mv.h + ' was satisfied before reaching ' + mv.to.join(',') };
          break; // hole vanished; remaining letters in this move are ignored
        }
      }
    }
    const won = st.isWon();
    return { won, steps, error: won ? null : 'not won at end of script', remaining: st.sticks.size, holesLeft: st.aliveHoles().length };
  }

  /**
   * Breadth-first solver over full game states (single steps as moves).
   * opts: { maxStates, maxMillis }. Returns { solved, steps, moves, states, capped }.
   */
  function solve(level, opts) {
    opts = opts || {};
    const maxStates = opts.maxStates || 400000;
    const maxMillis = opts.maxMillis || 20000;
    const start = new State(level);
    if (start.isWon()) return { solved: true, steps: 0, moves: [], states: 1, capped: false };
    const t0 = Date.now();
    const startKey = start.canonicalKey();
    const visited = new Map([[startKey, null]]);
    const queue = [{ st: start, key: startKey }];
    let qi = 0;
    while (qi < queue.length) {
      if (visited.size > maxStates || Date.now() - t0 > maxMillis) return { solved: false, states: visited.size, capped: true };
      const node = queue[qi++];
      for (let hi = 0; hi < node.st.holes.length; hi++) {
        const h = node.st.holes[hi];
        if (!h.alive) continue;
        const ends = h.cells.length === 1 ? [0] : [0, 1];
        for (const end of ends) for (const dir of DIR_KEYS) {
          if (!node.st.canStep(h, end, dir).ok) continue;
          const ns = node.st.clone();
          const res = ns.step(ns.holes[hi], end, dir);
          const k = ns.canonicalKey();
          if (visited.has(k)) continue;
          visited.set(k, { parentKey: node.key, move: { h: hi, end, dir } });
          if (res.won) {
            const moves = [];
            let cur = k;
            while (visited.get(cur)) { moves.push(visited.get(cur).move); cur = visited.get(cur).parentKey; }
            moves.reverse();
            return { solved: true, steps: moves.length, moves, states: visited.size, capped: false };
          }
          queue.push({ st: ns, key: k });
        }
      }
    }
    return { solved: false, states: visited.size, capped: false };
  }

  /** Compress solver moves into the scripted-solution format for readability. */
  function compressMoves(moves) {
    const out = [];
    for (const m of moves) {
      const last = out[out.length - 1];
      if (last && last.h === m.h && last.end === m.end) last.path += m.dir;
      else out.push({ h: m.h, end: m.end, path: m.dir });
    }
    return out;
  }

  return { State, DIRS, DIR_KEYS, OPPOSITE, key, findPath, validateLevel, runSolution, solve, compressMoves };
});
