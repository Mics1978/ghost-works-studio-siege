// Level definitions: handcrafted onboarding (1-10) + seeded procedural missions (11+, no upper limit).
import { GRID_W, GRID_H, TOWER_ORDER, BOSSES, ENVIRONMENTS } from './data.js';
import { createRng, hashString } from './rng.js';

const P = (...pts) => pts; // waypoint helper (grid cells, axis-aligned segments)
const ROUTES = {
  straight: P([-1, 5], [16, 5]),
  zig: P([-1, 2], [4, 2], [4, 7], [9, 7], [9, 3], [16, 3]),
  snake: P([-1, 1], [12, 1], [12, 4], [3, 4], [3, 8], [16, 8]),
  ushape: P([-1, 8], [3, 8], [3, 1], [8, 1], [8, 8], [12, 8], [12, 4], [16, 4]),
  long: P([-1, 1], [14, 1], [14, 3], [1, 3], [1, 6], [14, 6], [14, 8], [16, 8]),
  hook: P([-1, 4], [6, 4], [6, 1], [11, 1], [11, 7], [6, 7], [6, 9], [16, 9]),
};
const g = (type, count, interval = 1, delay = 0, path = 0) => ({ type, count, interval, delay, path });

const CAMPAIGN = [
  { name: 'First Shift', route: ['straight'], env: 0, credits: 150, unlock: ['security'],
    intro: 'Welcome to Ghost Works. Tap a free tile, then build a Security Unit beside the route. Hit START WAVE when ready.',
    waves: [[g('glitch', 6, 1.4)], [g('glitch', 9, 1.1)], [g('glitch', 12, 0.9)]] },
  { name: 'Upgrade Path', route: ['zig'], env: 0, credits: 140, unlock: ['security', 'signal'],
    intro: 'Tap a built unit to UPGRADE it. New: Signal Tower slows enemies. Watch for fast Spark Runners.',
    waves: [[g('glitch', 10, 1)], [g('spark', 8, 0.8)], [g('glitch', 8, 1), g('spark', 8, 0.7, 4)], [g('spark', 14, 0.5)]] },
  { name: 'Bit Storm', route: ['snake'], env: 1, credits: 180, unlock: ['security', 'signal', 'sound'],
    intro: 'Bit Swarms arrive in packs. The Sound System hits every enemy in range.',
    waves: [[g('swarm', 16, 0.35)], [g('glitch', 10, 0.9), g('swarm', 12, 0.3, 5)], [g('swarm', 30, 0.25)], [g('spark', 10, 0.6), g('swarm', 20, 0.3, 3)]] },
  { name: 'Hard Drives', route: ['ushape'], env: 1, credits: 200, unlock: ['security', 'signal', 'sound', 'engineer'],
    intro: 'Firewall Brutes are armoured: weak hits barely scratch them. Engineer Rigs shred armour.',
    waves: [[g('glitch', 12, 0.9)], [g('brick', 4, 2.5)], [g('brick', 5, 2), g('glitch', 10, 0.8, 3)], [g('brick', 7, 1.6), g('swarm', 16, 0.3, 6)], [g('brick', 9, 1.2), g('spark', 10, 0.6, 4)]] },
  { name: 'Budget Cut', route: ['hook'], env: 2, credits: 160, unlock: ['security', 'signal', 'sound', 'engineer', 'producer'],
    intro: 'Producers earn bonus credits after every wave and boost nearby units. Invest early!',
    waves: [[g('glitch', 12, 0.9)], [g('spark', 12, 0.5)], [g('brick', 6, 1.6), g('swarm', 20, 0.3, 4)], [g('glitch', 16, 0.6), g('spark', 10, 0.5, 5)], [g('brick', 8, 1.2), g('spark', 12, 0.5, 3)]] },
  { name: 'Phantom Signal', route: ['zig'], env: 2, credits: 220, unlock: TOWER_ORDER,
    intro: 'Elite Phantom Agents regenerate. Recon Drones snipe the toughest target and pierce armour.',
    waves: [[g('glitch', 14, 0.7)], [g('phantom', 3, 3)], [g('phantom', 4, 2.2), g('swarm', 20, 0.3, 3)], [g('brick', 8, 1.2), g('phantom', 4, 2, 6)], [g('phantom', 5, 1.7), g('spark', 12, 0.5, 3)]] },
  { name: 'Mixed Signals', route: ['long'], env: 0, credits: 240, unlock: TOWER_ORDER,
    intro: 'Every class at once. Balance your defence.',
    waves: [[g('glitch', 16, 0.6), g('spark', 8, 0.6, 5)], [g('swarm', 30, 0.2), g('brick', 4, 2, 4)], [g('phantom', 5, 1.6), g('spark', 14, 0.4, 2)], [g('brick', 10, 1), g('swarm', 30, 0.2, 5)], [g('glitch', 20, 0.4), g('phantom', 6, 1.4, 4), g('brick', 6, 1.5, 8)]] },
  { name: 'Two Doors', route: ['zig', 'snake'], env: 1, credits: 280, unlock: TOWER_ORDER,
    intro: 'Special event: DOUBLE ROUTE. Enemies breach from two entry points.',
    waves: [[g('glitch', 10, 0.8, 0, 0), g('glitch', 10, 0.8, 0, 1)], [g('spark', 10, 0.5, 0, 0), g('swarm', 20, 0.25, 2, 1)], [g('brick', 6, 1.5, 0, 1), g('phantom', 4, 2, 3, 0)], [g('swarm', 25, 0.2, 0, 0), g('brick', 8, 1.2, 0, 1)], [g('phantom', 6, 1.3, 0, 0), g('phantom', 6, 1.3, 0, 1), g('spark', 16, 0.35, 4, 0)]] },
  { name: 'Overclock', route: ['ushape'], env: 2, credits: 330, unlock: TOWER_ORDER,
    intro: 'Pressure rising. Big mixed waves. Next level: the first BOSS.',
    waves: [[g('spark', 14, 0.5)], [g('brick', 6, 1.3), g('swarm', 24, 0.25, 3)], [g('phantom', 6, 1.4), g('glitch', 16, 0.5, 2)], [g('brick', 12, 0.9), g('spark', 18, 0.35, 5)], [g('phantom', 10, 1), g('swarm', 40, 0.15, 4), g('brick', 8, 1.2, 8)]] },
  { name: 'Static Overlord', route: ['long'], env: 0, credits: 320, unlock: TOWER_ORDER, boss: true,
    intro: 'BOSS: the Static Overlord. Survive to complete the introductory campaign — the Infinite Missions await.',
    waves: [[g('glitch', 16, 0.6), g('spark', 10, 0.5, 4)], [g('brick', 8, 1.2), g('swarm', 30, 0.2, 3)], [g('phantom', 8, 1.2), g('spark', 16, 0.4, 3)], [g('overlord', 1, 1), g('glitch', 14, 0.8, 4)], [g('brick', 10, 1), g('phantom', 8, 1.1, 4), g('swarm', 30, 0.2, 8)]] },
];

export const ARCHETYPES = {
  standard: { name: 'Standard Assault', weights: { glitch: 5, spark: 2, brick: 2, swarm: 2, phantom: 1 }, waves: 5, countMul: 1 },
  swarm:    { name: 'Swarm Attack', weights: { glitch: 1, spark: 1, brick: 0.5, swarm: 8, phantom: 0.5 }, waves: 5, countMul: 1.25 },
  armoured: { name: 'Armoured Assault', weights: { glitch: 2, spark: 0.5, brick: 6, swarm: 1, phantom: 1.5 }, waves: 5, countMul: 0.8 },
  raid:     { name: 'High-Speed Raid', weights: { glitch: 1, spark: 7, brick: 0.5, swarm: 2, phantom: 1 }, waves: 5, countMul: 1.1, speed: 1.12 },
  endurance:{ name: 'Endurance', weights: { glitch: 4, spark: 2, brick: 2, swarm: 3, phantom: 1 }, waves: 8, countMul: 0.85 },
  boss:     { name: 'Boss Mission', weights: { glitch: 3, spark: 2, brick: 2, swarm: 2, phantom: 1.5 }, waves: 5, countMul: 0.8, boss: true },
  mixed:    { name: 'Mixed Pressure', weights: { glitch: 2, spark: 2, brick: 2, swarm: 2, phantom: 2 }, waves: 6, countMul: 1 },
};
const ARCH_KEYS = Object.keys(ARCHETYPES);

export const EVENTS = {
  boss:      { name: 'Boss Wave', desc: 'A boss breaches on the final wave.' },
  double:    { name: 'Double-Route Attack', desc: 'Enemies split between two entry routes.' },
  blackout:  { name: 'Power Blackout', desc: 'Defence range reduced 20% while waves are live.' },
  elite:     { name: 'Elite Invasion', desc: 'Phantom Agents dominate every wave.' },
  austerity: { name: 'Resource Restriction', desc: 'Kill rewards -35%, no Producer income.' },
  surge:     { name: 'Overclock Surge', desc: 'All enemies move 20% faster, but pay +25%.' },
};

function weightedPick(rng, weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  let total = entries.reduce((s, [, w]) => s + w, 0), r = rng.next() * total;
  for (const [k, w] of entries) { if ((r -= w) <= 0) return k; }
  return entries[entries.length - 1][0];
}

// Generates an axis-aligned route from left edge to the studio on the right edge.
export function generateRoute(rng, turns, startY = null) {
  let y = startY ?? rng.int(1, GRID_H - 2);
  const pts = [[-1, y]];
  let x = 0;
  const cols = [];
  // choose distinct turning columns spread across the board
  const segs = turns + 1;
  for (let i = 1; i < segs; i++) cols.push(Math.min(GRID_W - 2, Math.max(1, Math.round((i * GRID_W) / segs + rng.int(-1, 1)))));
  for (const cx of cols) {
    if (cx <= x) continue;
    x = cx; pts.push([x, y]);
    let ny; let guard = 0;
    do { ny = rng.int(0, GRID_H - 1); } while ((Math.abs(ny - y) < 2) && guard++ < 20);
    y = ny; pts.push([x, y]);
  }
  pts.push([GRID_W, y]);
  return pts;
}

function difficultyOf(level) { return Math.max(0, level - 10); }

export function missionSeed(runSeed, level) { return hashString(`${runSeed}|L${level}`); }

export function generateMission(level, runSeed) {
  const seed = missionSeed(runSeed, level);
  const rng = createRng(seed);
  const D = difficultyOf(level);
  // Special event cadence: every 5th level guaranteed; every 10th is a boss.
  let event = null;
  if (level % 10 === 0) event = 'boss';
  else if (level % 5 === 0) event = rng.pick(['double', 'blackout', 'elite', 'austerity', 'surge']);
  let archetype = rng.pick(ARCH_KEYS);
  if (event === 'boss') archetype = 'boss';
  else if (archetype === 'boss' && rng.chance(0.5)) archetype = 'mixed';
  const A = ARCHETYPES[archetype];

  // Soft-scaling curves (sub-linear where it matters; caps on speed/count).
  const hpMul = 1.0 + 0.09 * D + 0.001 * D * D;
  const countMul = A.countMul * Math.min(2.2, 1 + 0.045 * D);
  const speedMul = (A.speed || 1) * Math.min(1.3, 1 + 0.008 * D) * (event === 'surge' ? 1.2 : 1);
  const eliteBias = Math.min(4, 0.15 * D);
  const turns = Math.min(5, 2 + Math.floor(D / 8) + rng.int(0, 1));
  const rewardMul = Math.max(0.65, 1 - 0.008 * D) * (event === 'austerity' ? 0.65 : 1) * (event === 'surge' ? 1.25 : 1);
  const credits = Math.round(Math.max(220, 340 - 2 * D) + rng.int(-2, 2) * 10);

  const routes = [generateRoute(rng, turns)];
  if (event === 'double' || (D > 15 && rng.chance(0.2))) {
    let r2; let guard = 0;
    do { r2 = generateRoute(rng, Math.max(2, turns - 1)); } while (r2[0][1] === routes[0][0][1] && guard++ < 10);
    routes.push(r2);
  }
  const weights = { ...A.weights, phantom: A.weights.phantom + eliteBias + (event === 'elite' ? 6 : 0) };
  const waveCount = A.waves + Math.min(3, Math.floor(D / 15));
  const waves = [];
  for (let w = 0; w < waveCount; w++) {
    const budget = (12 + w * 4) * countMul;
    const groups = [];
    let delay = 0, spent = 0, gi = 0;
    while (spent < budget && gi < 4) {
      const type = weightedPick(rng, weights);
      const unit = { glitch: 1, spark: 1, brick: 2.5, swarm: 0.4, phantom: 3 }[type];
      const count = Math.max(1, Math.round(((budget - spent) * rng.range(0.35, 0.7)) / unit));
      const interval = { glitch: 0.8, spark: 0.5, brick: 1.4, swarm: 0.22, phantom: 1.5 }[type] * rng.range(0.75, 1.1);
      groups.push(g(type, count, +interval.toFixed(2), +delay.toFixed(2), routes.length > 1 ? (gi % routes.length) : 0));
      spent += count * unit; delay += rng.range(2, 5); gi++;
    }
    waves.push(groups);
  }
  let bossType = null;
  if (A.boss || event === 'boss') {
    bossType = BOSSES[(Math.floor(level / 10) + rng.int(0, 2)) % BOSSES.length];
    const bossCount = 1 + Math.floor(D / 30);
    waves[waves.length - 1].push(g(bossType, bossCount, 6, 3, 0));
  }
  const env = (Math.floor((level - 11) / 3) + rng.int(0, 2)) % ENVIRONMENTS.length;
  return {
    number: level, procedural: true, seed, archetype, archetypeName: A.name, event, difficulty: D,
    name: `${A.name}${event ? ' · ' + EVENTS[event].name : ''}`,
    env, routes, credits, lives: 20, unlock: TOWER_ORDER, waves,
    hpMul, speedMul, rewardMul, bossHpMul: 1 + 0.08 * D, boss: !!bossType,
    intro: `Infinite Mission ${level} — ${A.name}. Difficulty ${D}.` + (event ? ` EVENT: ${EVENTS[event].name}: ${EVENTS[event].desc}` : ''),
  };
}

export function getLevel(level, runSeed = 'GHOSTWORKS') {
  if (!Number.isInteger(level) || level < 1) level = 1;
  if (level <= CAMPAIGN.length) {
    const c = CAMPAIGN[level - 1];
    return { number: level, procedural: false, name: c.name, env: c.env, routes: c.route.map((r) => ROUTES[r]),
      credits: c.credits, lives: 20, unlock: c.unlock, waves: c.waves, intro: c.intro,
      hpMul: 1 + 0.025 * (level - 1), speedMul: 1, rewardMul: 1, bossHpMul: 1, boss: !!c.boss,
      event: level === 8 ? 'double' : (c.boss ? 'boss' : null), archetype: 'campaign', difficulty: 0,
      campaignFinale: level === CAMPAIGN.length };
  }
  return generateMission(level, runSeed);
}
export const CAMPAIGN_LENGTH = CAMPAIGN.length;

// Rough difficulty "threat" estimate used for tests / HUD.
export function threatScore(def) {
  const base = { glitch: 40, spark: 40, brick: 160, swarm: 12, phantom: 220, overlord: 1400, hydra: 1000, nullking: 1200 };
  let hp = 0;
  for (const w of def.waves) for (const gr of w) hp += base[gr.type] * gr.count * (['overlord', 'hydra', 'nullking'].includes(gr.type) ? def.bossHpMul * def.hpMul : def.hpMul);
  return hp * def.speedMul / def.credits;
}
