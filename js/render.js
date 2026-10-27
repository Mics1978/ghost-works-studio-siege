// Canvas renderer: all artwork procedurally drawn (no image assets).
import { GRID_W, GRID_H, TOWERS, ENEMIES, ENVIRONMENTS, towerStats } from './data.js';

export class Renderer {
  constructor(canvas) { this.c = canvas; this.ctx = canvas.getContext('2d'); this.cell = 40; this.ox = 0; this.oy = 0; this.t = 0; }
  resize(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.c.width = Math.floor(w * dpr); this.c.height = Math.floor(h * dpr);
    this.c.style.width = w + 'px'; this.c.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cell = Math.floor(Math.min(w / (GRID_W + 1), h / GRID_H));
    this.ox = Math.floor((w - this.cell * (GRID_W + 1)) / 2); this.oy = Math.floor((h - this.cell * GRID_H) / 2);
    this.w = w; this.h = h; this.bgCache = null;
  }
  toCell(px, py) { return [Math.floor((px - this.ox) / this.cell), Math.floor((py - this.oy) / this.cell)]; }
  drawBackground(game) {
    const env = ENVIRONMENTS[game.def.env % ENVIRONMENTS.length], s = this.cell;
    const off = document.createElement('canvas'); off.width = this.c.width; off.height = this.c.height;
    const ctx = off.getContext('2d'); const dpr = this.c.width / this.w; ctx.scale(dpr, dpr);
    ctx.fillStyle = env.bg; ctx.fillRect(0, 0, this.w, this.h);
    ctx.save(); ctx.translate(this.ox, this.oy);
    for (let x = 0; x < GRID_W; x++) for (let y = 0; y < GRID_H; y++) {
      ctx.strokeStyle = env.grid; ctx.lineWidth = 1; ctx.strokeRect(x * s + 0.5, y * s + 0.5, s - 1, s - 1);
      if (env.id === 'server' && (x * 7 + y * 3) % 11 === 0) { ctx.fillStyle = '#0c2630'; ctx.fillRect(x * s + 4, y * s + 4, s - 8, s - 8); }
      if (env.id === 'rooftop' && (x * 5 + y * 9) % 13 === 0) { ctx.fillStyle = '#2a1a0c'; ctx.beginPath(); ctx.arc(x * s + s / 2, y * s + s / 2, s / 4, 0, 7); ctx.fill(); }
      if (env.id === 'studio' && (x + y * 4) % 9 === 0) { ctx.fillStyle = '#17123a'; ctx.fillRect(x * s + s * 0.3, y * s + s * 0.3, s * 0.4, s * 0.4); }
    }
    for (const p of game.def.routes) {
      ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
      for (const [w, col] of [[s * 0.92, env.pathEdge], [s * 0.8, env.path]]) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
        p.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, x * s + s / 2, y * s + s / 2)); ctx.stroke();
      }
    }
    // Studio (objective)
    const ends = game.def.routes.map((p) => p[p.length - 1]);
    for (const [ex, ey] of ends) {
      const x = ex * s, y = ey * s;
      ctx.fillStyle = '#120f22'; ctx.fillRect(x, y - s * 0.4, s * 0.95, s * 1.8);
      ctx.strokeStyle = env.accent; ctx.lineWidth = 2; ctx.strokeRect(x, y - s * 0.4, s * 0.95, s * 1.8);
      drawGhost(ctx, x + s * 0.47, y + s * 0.45, s * 0.32, env.accent);
    }
    ctx.restore(); this.bgCache = off;
  }
  draw(game, ui) {
    const ctx = this.ctx, s = this.cell; this.t += 1 / 60;
    if (!this.bgCache || this.bgFor !== game) { this.drawBackground(game); this.bgFor = game; }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(this.bgCache, 0, 0);
    const dpr = this.c.width / this.w; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save(); ctx.translate(this.ox, this.oy);
    if (game.def.event === 'blackout' && game.phase === 'wave') { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, GRID_W * s, GRID_H * s); }
    // hover/selection
    if (ui.hover) { const [hx, hy] = ui.hover; ctx.fillStyle = game.canPlace(hx, hy) ? 'rgba(120,255,160,0.18)' : 'rgba(255,80,80,0.18)'; ctx.fillRect(hx * s, hy * s, s, s); }
    const sel = ui.selected;
    if (sel) { const st = towerStats(sel.type, sel.level); if (st.range) { ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(sel.x * s + s / 2, sel.y * s + s / 2, st.range * s * game.rangeMul(), 0, 7); ctx.stroke(); ctx.setLineDash([]); } }
    for (const t of game.towers) drawTower(ctx, t, s, this.t);
    for (const e of game.enemies) drawEnemy(ctx, e, s, this.t);
    for (const f of game.effects) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.t * 5));
      if (f.kind === 'beam') { ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(f.x * s, f.y * s); ctx.lineTo(f.x2 * s, f.y2 * s); ctx.stroke(); }
      else if (f.kind === 'pulse') { ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x * s, f.y * s, f.r * s * (1 - f.t / 0.3 * 0.6), 0, 7); ctx.stroke(); }
      else if (f.kind === 'pop') { ctx.fillStyle = '#7dff8a'; ctx.font = `bold ${Math.max(10, s * 0.3)}px system-ui`; ctx.fillText(f.text, f.x * s, f.y * s - (0.35 - f.t) * s * 2); }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}
export function drawGhost(ctx, x, y, r, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y - r * 0.2, r, Math.PI, 0);
  ctx.lineTo(x + r, y + r * 0.8);
  for (let i = 0; i < 3; i++) { const bx = x + r - (i + 0.5) * (2 * r / 3); ctx.quadraticCurveTo(bx, y + r * 0.4, bx - r / 3, y + r * 0.8); }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#0d0b1a'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.2, r * 0.17, 0, 7); ctx.arc(x + r * 0.35, y - r * 0.2, r * 0.17, 0, 7); ctx.fill();
}
export function drawTowerIcon(ctx, type, cx, cy, s, level = 1, angle = 0, time = 0) {
  const T = TOWERS[type]; const r = s * 0.38;
  ctx.fillStyle = '#1a1830'; ctx.strokeStyle = T.color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx - r, cy - r, 2 * r, 2 * r, r * 0.3) : ctx.rect(cx - r, cy - r, 2 * r, 2 * r); ctx.fill(); ctx.stroke();
  ctx.fillStyle = T.color; ctx.strokeStyle = T.color;
  ctx.save(); ctx.translate(cx, cy);
  switch (type) {
    case 'security': ctx.rotate(angle); ctx.fillRect(0, -r * 0.15, r * 0.95, r * 0.3); ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, 7); ctx.fill(); break;
    case 'sound': for (const k of [0.25, 0.5, 0.75]) { ctx.beginPath(); ctx.arc(0, 0, r * k * (1 + 0.08 * Math.sin(time * 8)), 0, 7); ctx.stroke(); } break;
    case 'signal': ctx.beginPath(); ctx.moveTo(0, -r * 0.8); ctx.lineTo(r * 0.5, r * 0.7); ctx.lineTo(-r * 0.5, r * 0.7); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -r * 0.8, r * 0.18, 0, 7); ctx.fill(); break;
    case 'producer': ctx.font = `bold ${r * 1.2}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('₵', 0, r * 0.05); break;
    case 'drone': ctx.rotate(time * 2); for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillRect(-r * 0.08, 0, r * 0.16, r * 0.8); ctx.beginPath(); ctx.arc(0, r * 0.8, r * 0.18, 0, 7); ctx.fill(); } break;
    case 'engineer': ctx.rotate(angle); ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.lineTo(Math.cos(a) * r * (i % 2 ? 0.35 : 0.7), Math.sin(a) * r * (i % 2 ? 0.35 : 0.7)); } ctx.closePath(); ctx.fill(); break;
  }
  ctx.restore();
  for (let i = 1; i < level; i++) { ctx.fillStyle = '#fff'; ctx.fillRect(cx - r + (i - 1) * r * 0.35 + 2, cy + r - 5, r * 0.25, 3); }
}
function drawTower(ctx, t, s, time) { drawTowerIcon(ctx, t.type, t.x * s + s / 2, t.y * s + s / 2, s, t.level, t.angle, time); }
function drawEnemy(ctx, e, s, time) {
  const def = ENEMIES[e.type], x = e.x * s, y = e.y * s, r = def.size * s;
  ctx.fillStyle = def.color;
  ctx.beginPath();
  if (e.type === 'brick' || e.type === 'overlord') ctx.rect(x - r, y - r, 2 * r, 2 * r);
  else if (e.type === 'spark') { ctx.moveTo(x + r, y); ctx.lineTo(x - r, y - r * 0.7); ctx.lineTo(x - r * 0.5, y); ctx.lineTo(x - r, y + r * 0.7); }
  else if (e.type === 'phantom' || e.type === 'nullking') { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + time; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } }
  else ctx.arc(x, y, r, 0, 7);
  ctx.closePath(); ctx.fill();
  if (e.slow) { ctx.strokeStyle = '#ffd84f'; ctx.lineWidth = 2; ctx.stroke(); }
  if (e.boss) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
  if (e.hp < e.maxHp) { ctx.fillStyle = '#300'; ctx.fillRect(x - r, y - r - 6, 2 * r, 3); ctx.fillStyle = '#5f5'; ctx.fillRect(x - r, y - r - 6, 2 * r * Math.max(0, e.hp / e.maxHp), 3); }
}
