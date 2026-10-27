// Headless quality-check harness for game logic (node tests/sim.test.js).
import assert from 'node:assert/strict';
import { Game } from '../js/engine.js';
import { getLevel, generateMission, threatScore, CAMPAIGN_LENGTH } from '../js/levels.js';
import { TOWERS, TOWER_ORDER, GRID_W, GRID_H } from '../js/data.js';
import * as Save from '../js/save.js';

let pass = 0; const ok = (name, fn) => { fn(); pass++; console.log('✔', name); };
const run = (g, secs) => { for (let i = 0; i < secs * 60 && (g.phase === 'wave'); i++) g.update(1 / 60); };

// Simple bot: places towers on tiles adjacent to route, upgrades, starts waves.
function botPlay(def, maxTime = 900) {
  const g = new Game(def);
  const spots = [];
  for (let x = 0; x < GRID_W; x++) for (let y = 0; y < GRID_H; y++) if (g.canPlace(x, y)) {
    let n = 0; for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) if (g.blocked.has(`${x + dx},${y + dy}`)) n++;
    spots.push({ x, y, n });
  }
  spots.sort((a, b) => b.n - a.n);
  const plan = ['security', 'security', 'signal', 'sound', 'engineer', 'drone', 'security', 'sound', 'drone', 'engineer', 'security', 'producer'];
  let pi = 0, t = 0;
  while (g.phase !== 'won' && g.phase !== 'lost' && t < maxTime) {
    if (g.phase === 'build') {
      let did = true;
      while (did) {
        did = false;
        let type = plan[pi % plan.length]; while (!def.unlock.includes(type)) type = plan[++pi % plan.length];
        if (g.towers.length < 14 && g.credits >= TOWERS[type].cost) { const s = spots.find((s) => g.canPlace(s.x, s.y)); if (s && g.place(type, s.x, s.y).ok) { pi++; did = true; } }
        else for (const tw of g.towers) if (g.upgrade(tw).ok) { did = true; break; }
      }
      g.startWave();
    }
    g.update(1 / 30); t += 1 / 30;
  }
  return g;
}

ok('placement + blocked tiles + credits deducted', () => {
  const g = new Game(getLevel(1));
  assert.equal(g.place('security', 0, 5).ok, false, 'path tile blocked');
  const c = g.credits; assert.ok(g.place('security', 3, 4).ok); assert.equal(g.credits, c - TOWERS.security.cost);
  assert.equal(g.place('security', 3, 4).ok, false, 'occupied');
  assert.equal(g.place('drone', 5, 4).ok, false, 'locked in L1');
});
ok('defences attack enemies and kills earn credits', () => {
  const g = new Game(getLevel(1)); g.place('security', 3, 4); g.place('security', 6, 6);
  const c0 = g.credits; g.startWave(); run(g, 60);
  assert.ok(g.kills > 0, 'kills'); assert.ok(g.credits > c0, 'credits earned'); assert.ok(g.score > 0);
});
ok('upgrades work and increase stats', () => {
  const g = new Game(getLevel(1)); g.credits = 1000; const t = g.place('security', 3, 4).tower;
  assert.ok(g.upgrade(t).ok); assert.equal(t.level, 2); g.upgrade(t); g.upgrade(t); assert.equal(g.upgrade(t).ok, false, 'max level');
});
ok('enemies reach objective, loss state triggers', () => {
  const g = new Game(getLevel(5)); for (let i = 0; i < 5; i++) { g.startWave(); run(g, 200); if (g.phase === 'lost') break; }
  assert.ok(g.leaked > 0); assert.equal(g.phase, 'lost'); assert.equal(g.lives, 0);
});
ok('levels 1-10 are completable by a simple bot', () => {
  for (let n = 1; n <= CAMPAIGN_LENGTH; n++) { const g = botPlay(getLevel(n)); assert.equal(g.phase, 'won', `level ${n} ${g.phase} lives=${g.lives}`); if (n === 10) assert.ok(g.bossKills >= 1); }
});
ok('level 11+ procedural, deterministic per seed, no max level', () => {
  const a = getLevel(11, 'SEED-A'), b = getLevel(11, 'SEED-A'), c = getLevel(11, 'SEED-B');
  assert.ok(a.procedural); assert.deepEqual(a, b); assert.notDeepEqual(a, c);
  const archetypes = new Set(), events = new Set();
  for (let n = 11; n <= 500; n++) { const d = getLevel(n, 'RUN'); assert.ok(d.waves.length > 0 && d.routes.length > 0); archetypes.add(d.archetype); if (d.event) events.add(d.event);
    for (const r of d.routes) { assert.equal(r[0][0], -1); assert.equal(r[r.length - 1][0], GRID_W); for (let i = 1; i < r.length; i++) assert.ok(r[i][0] === r[i - 1][0] || r[i][1] === r[i - 1][1], 'axis aligned'); }
    if (n % 10 === 0) assert.ok(d.boss, `boss at ${n}`); if (n % 5 === 0) assert.ok(d.event, `event at ${n}`); }
  assert.ok(archetypes.size >= 6, 'archetype variety ' + [...archetypes]); assert.ok(events.size >= 5, 'event variety');
  const huge = getLevel(100000, 'RUN'); assert.ok(huge.waves.length > 0 && Number.isFinite(huge.hpMul));
  new Game(huge); // constructs
});
ok('difficulty rises across procedural missions', () => {
  const avg = (from) => { let s = 0; for (let n = from; n < from + 20; n++) s += threatScore(getLevel(n, 'X')); return s / 20; };
  const t1 = avg(11), t2 = avg(40), t3 = avg(100); console.log('   threat', t1.toFixed(1), t2.toFixed(1), t3.toFixed(1));
  assert.ok(t2 > t1 && t3 > t2);
  assert.ok(getLevel(200, 'X').speedMul <= 1.3 * 1.12 * 1.2 + 1e-9, 'speed capped');
});
ok('early infinite missions are playable by bot', () => {
  let wins = 0; for (let n = 11; n <= 16; n++) if (botPlay(getLevel(n, 'BOT')).phase === 'won') wins++;
  console.log('   bot wins 11-16:', wins, '/ 6'); assert.ok(wins >= 3);
});
ok('save validation handles corruption', () => {
  const mem = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; } };
  assert.deepEqual(Save.load(mem), Save.defaultSave());
  mem.d[Save.SAVE_KEY] = '{not json'; assert.deepEqual(Save.load(mem), Save.defaultSave());
  mem.d[Save.SAVE_KEY] = JSON.stringify({ version: 1, stats: { highestLevel: -5, highScore: 'x', bossesDefeated: 3 }, run: { level: 'abc', seed: 1 } });
  const s = Save.load(mem); assert.equal(s.stats.highestLevel, 1); assert.equal(s.stats.highScore, 0); assert.equal(s.stats.bossesDefeated, 3); assert.equal(s.run, null);
  const sv = Save.defaultSave(); sv.run = Save.newRun('ABC');
  for (let n = 1; n <= 12; n++) Save.recordLevelClear(sv, n, n * 100, n === 10 ? 1 : 0, 5);
  Save.store(mem, sv); const r = Save.load(mem);
  assert.equal(r.run.level, 13); assert.equal(r.stats.highestLevel, 13); assert.equal(r.stats.longestRun, 12); assert.equal(r.stats.bossesDefeated, 1);
  // new run (restart) resets run, keeps stats
  r.run = Save.newRun('NEW'); assert.equal(r.run.level, 1); assert.equal(r.stats.highestLevel, 13);
});
console.log(`\n${pass} test groups passed`);
