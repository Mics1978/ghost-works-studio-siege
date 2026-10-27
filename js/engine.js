// Headless-safe simulation core (no DOM). Fixed-step update.
import { TOWERS, ENEMIES, GRID_W, GRID_H, MAX_TOWER_LEVEL, towerStats, upgradeCost } from './data.js';

function buildPath(points) {
  const segs = []; let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i], [bx, by] = points[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    segs.push({ ax, ay, bx, by, len, start: total }); total += len;
  }
  return { points, segs, length: total };
}
function posAt(path, d) {
  for (const s of path.segs) {
    if (d <= s.start + s.len) { const t = s.len ? (d - s.start) / s.len : 0; return [s.ax + (s.bx - s.ax) * t + 0.5, s.ay + (s.by - s.ay) * t + 0.5]; }
  }
  const l = path.points[path.points.length - 1]; return [l[0] + 0.5, l[1] + 0.5];
}

export class Game {
  constructor(def) {
    this.def = def;
    this.paths = def.routes.map(buildPath);
    this.blocked = new Set();
    for (const p of def.routes) for (let i = 0; i < p.length - 1; i++) {
      let [x, y] = p[i]; const [bx, by] = p[i + 1];
      const dx = Math.sign(bx - x), dy = Math.sign(by - y);
      while (true) { if (x >= 0 && x < GRID_W && y >= 0 && y < GRID_H) this.blocked.add(`${x},${y}`); if (x === bx && y === by) break; x += dx; y += dy; }
    }
    this.credits = def.credits; this.lives = def.lives; this.score = 0;
    this.towers = []; this.enemies = []; this.effects = []; this.queue = [];
    this.wave = 0; this.phase = 'build'; this.time = 0; this.kills = 0; this.bossKills = 0; this.leaked = 0;
    this.nextId = 1; this.events = [];
  }
  get totalWaves() { return this.def.waves.length; }
  emit(e) { this.events.push(e); }
  canPlace(x, y) { return x >= 0 && y >= 0 && x < GRID_W && y < GRID_H && !this.blocked.has(`${x},${y}`) && !this.towerAt(x, y); }
  towerAt(x, y) { return this.towers.find((t) => t.x === x && t.y === y); }
  place(type, x, y) {
    if (!TOWERS[type] || !this.def.unlock.includes(type)) return { ok: false, reason: 'Locked' };
    if (!this.canPlace(x, y)) return { ok: false, reason: 'Blocked tile' };
    if (this.credits < TOWERS[type].cost) return { ok: false, reason: 'Not enough credits' };
    this.credits -= TOWERS[type].cost;
    const t = { id: this.nextId++, type, x, y, level: 1, cd: 0, spent: TOWERS[type].cost, angle: 0 };
    this.towers.push(t); this.emit({ type: 'place', tower: t }); return { ok: true, tower: t };
  }
  upgrade(t) {
    if (t.level >= MAX_TOWER_LEVEL) return { ok: false, reason: 'Max level' };
    const c = upgradeCost(t.type, t.level);
    if (this.credits < c) return { ok: false, reason: 'Not enough credits' };
    this.credits -= c; t.spent += c; t.level++; return { ok: true };
  }
  sell(t) { this.credits += Math.floor(t.spent * 0.7); this.towers = this.towers.filter((o) => o !== t); return { ok: true }; }
  startWave() {
    if (this.phase !== 'build' || this.wave >= this.totalWaves) return false;
    const groups = this.def.waves[this.wave];
    this.queue = [];
    for (const g of groups) for (let i = 0; i < g.count; i++) this.queue.push({ at: this.time + g.delay + i * g.interval, type: g.type, path: Math.min(g.path || 0, this.paths.length - 1) });
    this.queue.sort((a, b) => a.at - b.at);
    this.wave++; this.phase = 'wave'; this.emit({ type: 'wave', n: this.wave }); return true;
  }
  spawn(type, pathIdx, dist = 0) {
    const e = ENEMIES[type], boss = !!e.boss;
    const hp = e.hp * this.def.hpMul * (boss ? this.def.bossHpMul : 1);
    const en = { id: this.nextId++, type, path: pathIdx, d: dist, hp, maxHp: hp, armor: e.armor + (boss ? 0 : Math.floor((this.def.difficulty || 0) / 12)),
      speed: e.speed * this.def.speedMul, slow: 0, slowT: 0, shred: 0, boss, splitMark: 0.75, x: 0, y: 0 };
    [en.x, en.y] = posAt(this.paths[pathIdx], dist); this.enemies.push(en); return en;
  }
  rangeMul() { return this.def.event === 'blackout' && this.phase === 'wave' ? 0.8 : 1; }
  damage(en, amount, pierce) {
    const armor = pierce ? en.armor * 0.3 : Math.max(0, en.armor - en.shred);
    const dmg = Math.max(amount * 0.15, amount - armor);
    en.hp -= dmg;
    const def = ENEMIES[en.type];
    if (def.splits && en.hp > 0 && en.hp / en.maxHp < en.splitMark) {
      en.splitMark -= 0.25;
      for (let i = 0; i < 4; i++) this.spawn(def.splits, en.path, Math.max(0, en.d - i * 0.3));
    }
  }
  update(dt) {
    if (this.phase !== 'wave') return;
    this.time += dt;
    while (this.queue.length && this.queue[0].at <= this.time) { const q = this.queue.shift(); this.spawn(q.type, q.path); }
    // enemies move
    for (const en of this.enemies) {
      const def = ENEMIES[en.type];
      if (def.regen) en.hp = Math.min(en.maxHp, en.hp + def.regen * this.def.hpMul * dt);
      if (en.slowT > 0) en.slowT -= dt; else en.slow = 0;
      const resist = def.cloak || en.boss ? 0.5 : 1;
      en.d += en.speed * (1 - en.slow * resist) * dt;
      const p = this.paths[en.path];
      if (en.d >= p.length) { en.leaked = true; this.lives -= def.leak; this.leaked += def.leak; this.emit({ type: 'leak', enemy: en }); }
      else [en.x, en.y] = posAt(p, en.d);
    }
    this.enemies = this.enemies.filter((e) => !e.leaked);
    // towers attack
    const rm = this.rangeMul();
    for (const t of this.towers) {
      const s = towerStats(t.type, t.level);
      if (!s.rate) continue;
      t.cd -= dt; if (t.cd > 0) continue;
      const cx = t.x + 0.5, cy = t.y + 0.5, r = s.range * rm;
      const inRange = this.enemies.filter((e) => e.hp > 0 && Math.hypot(e.x - cx, e.y - cy) <= r);
      if (!inRange.length) continue;
      const boost = 1 + 0.15 * this.towers.filter((o) => o.type === 'producer' && Math.abs(o.x - t.x) <= 1 && Math.abs(o.y - t.y) <= 1).length;
      const dmg = s.damage * boost;
      t.cd = 1 / s.rate;
      if (s.targeting === 'area') {
        for (const e of inRange) this.damage(e, dmg, false);
        this.effects.push({ kind: 'pulse', x: cx, y: cy, r, color: s.color, t: 0.3 });
      } else {
        let tgt;
        if (s.targeting === 'strongest') tgt = inRange.reduce((a, b) => (b.hp > a.hp ? b : a));
        else if (s.targeting === 'closest') tgt = inRange.reduce((a, b) => (Math.hypot(b.x - cx, b.y - cy) < Math.hypot(a.x - cx, a.y - cy) ? b : a));
        else tgt = inRange.reduce((a, b) => (b.d > a.d ? b : a));
        this.damage(tgt, dmg, !!s.pierce);
        if (s.slow) { tgt.slow = Math.max(tgt.slow, s.slow); tgt.slowT = s.slowTime; }
        if (s.shred) tgt.shred = Math.min(tgt.armor, tgt.shred + s.shred);
        t.angle = Math.atan2(tgt.y - cy, tgt.x - cx);
        this.effects.push({ kind: 'beam', x: cx, y: cy, x2: tgt.x, y2: tgt.y, color: s.color, t: 0.12 });
      }
    }
    // deaths
    for (const e of this.enemies) if (e.hp <= 0) {
      const def = ENEMIES[e.type], reward = Math.max(1, Math.round(def.reward * this.def.rewardMul));
      this.credits += reward; this.score += reward * 10; this.kills++;
      if (e.boss) { this.bossKills++; this.score += 2000; }
      this.effects.push({ kind: 'pop', x: e.x, y: e.y, color: def.color, t: 0.35, text: `+${reward}` });
      this.emit({ type: 'kill', enemy: e, reward });
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    for (const fx of this.effects) fx.t -= dt;
    this.effects = this.effects.filter((f) => f.t > 0);
    if (this.lives <= 0) { this.lives = 0; this.phase = 'lost'; this.emit({ type: 'lost' }); return; }
    if (!this.queue.length && !this.enemies.length) {
      // wave cleared: producer income
      if (this.def.event !== 'austerity') for (const t of this.towers) if (t.type === 'producer') this.credits += towerStats('producer', t.level).income;
      this.credits += 20 + this.wave * 5;
      if (this.wave >= this.totalWaves) { this.phase = 'won'; this.score += this.lives * 50 + this.def.number * 100; this.emit({ type: 'won' }); }
      else { this.phase = 'build'; this.emit({ type: 'waveClear', n: this.wave }); }
    }
  }
}
