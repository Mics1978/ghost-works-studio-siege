// Static definitions: defences, enemies, environments.
export const GRID_W = 16, GRID_H = 10;

export const TOWERS = {
  security: { name: 'Security Unit', short: 'SEC', color: '#4fd1ff', cost: 50, range: 2.3, damage: 14, rate: 2.0,
    targeting: 'first', desc: 'Reliable all-rounder. Targets the enemy furthest along the route.' },
  sound: { name: 'Sound System', short: 'SND', color: '#ff5ea8', cost: 85, range: 1.8, damage: 10, rate: 1.0,
    targeting: 'area', splash: 1.8, desc: 'Bass pulse hits every enemy in range. Great vs swarms.' },
  signal: { name: 'Signal Tower', short: 'SIG', color: '#ffd84f', cost: 70, range: 2.6, damage: 6, rate: 1.2,
    targeting: 'first', slow: 0.45, slowTime: 1.6, desc: 'Jams enemy uplinks, slowing them down.' },
  producer: { name: 'Producer', short: 'PRD', color: '#7dff8a', cost: 90, range: 0, damage: 0, rate: 0,
    targeting: 'none', income: 18, desc: 'Generates bonus credits each wave and boosts nearby units +15% damage.' },
  drone: { name: 'Recon Drone', short: 'DRN', color: '#b28cff', cost: 120, range: 4.2, damage: 60, rate: 0.55,
    targeting: 'strongest', desc: 'Long-range precision strike on the toughest target. Pierces armour.' , pierce: true },
  engineer: { name: 'Engineer Rig', short: 'ENG', color: '#ff9b4f', cost: 110, range: 2.0, damage: 6, rate: 6,
    targeting: 'closest', shred: 0.25, desc: 'Rapid arc welder. Shreds armour on hit (stacks).' },
};
export const TOWER_ORDER = ['security', 'sound', 'signal', 'producer', 'drone', 'engineer'];
export const MAX_TOWER_LEVEL = 4;
export function upgradeCost(type, level) { return Math.round(TOWERS[type].cost * (0.7 + 0.45 * level)); }
export function towerStats(type, level) {
  const t = TOWERS[type], m = 1 + 0.55 * (level - 1);
  return { ...t, damage: t.damage * m, range: t.range ? t.range + 0.2 * (level - 1) : 0,
    rate: t.rate * (1 + 0.1 * (level - 1)), income: (t.income || 0) * level, slow: t.slow ? Math.min(0.7, t.slow + 0.05 * (level - 1)) : 0 };
}

export const ENEMIES = {
  glitch:  { name: 'Glitch', color: '#e8e8ff', hp: 40, speed: 1.0, armor: 0, reward: 6, size: 0.28, leak: 1, desc: 'Basic corrupted packet.' },
  spark:   { name: 'Spark Runner', color: '#ffe066', hp: 28, speed: 1.9, armor: 0, reward: 7, size: 0.22, leak: 1, desc: 'Fast. Hard to catch.' },
  brick:   { name: 'Firewall Brute', color: '#9aa4b8', hp: 130, speed: 0.6, armor: 6, reward: 14, size: 0.36, leak: 2, desc: 'Armoured: flat damage reduction.' },
  swarm:   { name: 'Bit Swarm', color: '#7cf5d0', hp: 12, speed: 1.35, armor: 0, reward: 2, size: 0.16, leak: 1, desc: 'Arrive in large groups.' },
  phantom: { name: 'Phantom Agent', color: '#ff6b6b', hp: 130, speed: 1.05, armor: 3, reward: 20, size: 0.32, leak: 3, regen: 6, cloak: true, desc: 'Elite: regenerates and resists slows.' },
  // Bosses
  overlord: { name: 'Static Overlord', color: '#ff2e63', hp: 1400, speed: 0.45, armor: 8, reward: 150, size: 0.55, leak: 10, boss: true, desc: 'Boss: massive armoured core.' },
  hydra:    { name: 'Hydra Process', color: '#c0ff2e', hp: 1000, speed: 0.6, armor: 4, reward: 150, size: 0.5, leak: 10, boss: true, splits: 'swarm', desc: 'Boss: spawns swarms when damaged.' },
  nullking: { name: 'Null King', color: '#8a5cff', hp: 1200, speed: 0.7, armor: 5, reward: 170, size: 0.5, leak: 10, boss: true, regen: 25, desc: 'Boss: heavy regeneration.' },
};
export const CORE_ENEMIES = ['glitch', 'spark', 'brick', 'swarm', 'phantom'];
export const BOSSES = ['overlord', 'hydra', 'nullking'];

export const ENVIRONMENTS = [
  { id: 'studio', name: 'Neon Studio Floor', bg: '#0d0b1a', grid: '#1c1840', path: '#2b2350', pathEdge: '#5a3fd1', accent: '#ff5ea8' },
  { id: 'server', name: 'Server Vault', bg: '#06141a', grid: '#0f2d38', path: '#123844', pathEdge: '#2fd6ff', accent: '#4fd1ff' },
  { id: 'rooftop', name: 'Signal Rooftop', bg: '#1a0f08', grid: '#33200f', path: '#3d2814', pathEdge: '#ff9b4f', accent: '#ffd84f' },
];
