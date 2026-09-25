const KEY = 'bra_save_v1';

export const DEFAULT_SAVE = {
  coins: 0,
  upg: { hp: 0, speed: 0, atk: 0 },
  level: 1,
  bestMult: 1,
  lastStopper: null, // { name, tier, hp, segment }
  prevMult: 0,
  sound: true,
  seen: [],          // card ids seen at least once ("New" tag)
  stats: { levels: 0, kills: 0, startedAt: 0, bossKilled: false },
  suggest: null,     // suggested upgrade id after a fail
};

let memory = null;

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      memory = { ...structuredClone(DEFAULT_SAVE), ...d, upg: { ...DEFAULT_SAVE.upg, ...(d.upg || {}) }, stats: { ...DEFAULT_SAVE.stats, ...(d.stats || {}) } };
      return memory;
    }
  } catch (e) { /* storage unavailable: keep working for the session */ }
  memory = structuredClone(DEFAULT_SAVE);
  return memory;
}

export function writeSave(data) {
  memory = data;
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
}

export function resetSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  memory = structuredClone(DEFAULT_SAVE);
  return memory;
}
