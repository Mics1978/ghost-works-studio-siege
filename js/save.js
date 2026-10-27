// Versioned, validated localStorage persistence.
export const SAVE_KEY = 'ghostworks.studioSiege.save';
export const SAVE_VERSION = 1;
const int = (v, d = 0) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);
export function defaultSave() {
  return { version: SAVE_VERSION, stats: { highestLevel: 1, highScore: 0, longestRun: 0, bossesDefeated: 0, totalKills: 0, runsStarted: 0 }, run: null, settings: { speed: 1 } };
}
export function newRun(seed) { return { level: 1, score: 0, cleared: 0, seed: String(seed || 'GW-' + Math.floor(Math.random() * 1e9).toString(36).toUpperCase()) }; }
export function validate(raw) {
  const s = defaultSave();
  if (!raw || typeof raw !== 'object' || raw.version !== SAVE_VERSION) return s;
  const st = raw.stats || {};
  for (const k of Object.keys(s.stats)) s.stats[k] = int(st[k], s.stats[k]);
  s.stats.highestLevel = Math.max(1, s.stats.highestLevel);
  const r = raw.run;
  if (r && typeof r === 'object' && typeof r.seed === 'string' && r.seed.length < 64 && Number.isInteger(r.level) && r.level >= 1)
    s.run = { level: r.level, score: int(r.score), cleared: int(r.cleared), seed: r.seed };
  if (raw.settings && [1, 2].includes(raw.settings.speed)) s.settings.speed = raw.settings.speed;
  return s;
}
export function load(storage) {
  try { const txt = storage.getItem(SAVE_KEY); return validate(txt ? JSON.parse(txt) : null); } catch { return defaultSave(); }
}
export function store(storage, save) { try { storage.setItem(SAVE_KEY, JSON.stringify(validate(save))); return true; } catch { return false; } }
export function recordLevelClear(save, level, runScore, bossKills, kills) {
  const run = save.run; run.level = level + 1; run.score = runScore; run.cleared++;
  const st = save.stats;
  st.highestLevel = Math.max(st.highestLevel, run.level); st.highScore = Math.max(st.highScore, run.score);
  st.longestRun = Math.max(st.longestRun, run.cleared); st.bossesDefeated += bossKills; st.totalKills += kills;
}
