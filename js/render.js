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
    const backdrop=ctx.createLinearGradient(0,0,0,this.h);backdrop.addColorStop(0,env.bg);backdrop.addColorStop(1,'#060917');ctx.fillStyle=backdrop;ctx.fillRect(0,0,this.w,this.h);
    ctx.save(); ctx.translate(this.ox, this.oy);
    for (let x = 0; x < GRID_W; x++) for (let y = 0; y < GRID_H; y++) {
      ctx.fillStyle=(x+y)%2?'#ffffff08':'#00000017';ctx.fillRect(x*s+1,y*s+1,s-2,s-2);
      ctx.fillStyle=env.grid;ctx.fillRect(x*s+2,y*s+2,s-4,Math.max(1,s*.04));ctx.fillRect(x*s+2,y*s+2,Math.max(1,s*.04),s-4);
      if((x*13+y*7)%5===0){ctx.fillStyle=env.accent;ctx.globalAlpha=.34;ctx.fillRect(x*s+s*.14,y*s+s*.16,Math.max(1,s*.07),Math.max(1,s*.07));ctx.globalAlpha=1;}
      ctx.strokeStyle = env.grid; ctx.lineWidth = 1; ctx.strokeRect(x * s + 0.5, y * s + 0.5, s - 1, s - 1);
      if (env.id === 'server' && (x * 7 + y * 3) % 11 === 0) { ctx.fillStyle = '#0c2630'; ctx.fillRect(x * s + 4, y * s + 4, s - 8, s - 8); }
      if (env.id === 'rooftop' && (x * 5 + y * 9) % 13 === 0) { ctx.fillStyle = '#2a1a0c'; ctx.beginPath(); ctx.arc(x * s + s / 2, y * s + s / 2, s / 4, 0, 7); ctx.fill(); }
      if (env.id === 'studio' && (x + y * 4) % 9 === 0) { ctx.fillStyle = '#17123a'; ctx.fillRect(x * s + s * 0.3, y * s + s * 0.3, s * 0.4, s * 0.4); }
    }
    for (const p of game.def.routes) {
      ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
      for (const [w, col] of [[s*.98,'#080b19'],[s * 0.92, env.pathEdge], [s * 0.78, env.path]]) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
        p.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, x * s + s / 2, y * s + s / 2)); ctx.stroke();
      }
    }
    // Dotted route lanes stay unobtrusive beneath units.
    for(const p of game.def.routes){ctx.strokeStyle='#ffffff25';ctx.lineWidth=1;ctx.setLineDash([Math.max(2,s*.13),Math.max(3,s*.23)]);ctx.beginPath();p.forEach(([x,y],i)=>(i?ctx.lineTo:ctx.moveTo).call(ctx,x*s+s/2,y*s+s/2));ctx.stroke();ctx.setLineDash([]);}
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
      if (f.kind === 'beam') { ctx.strokeStyle = f.color; ctx.lineWidth = Math.max(3,s*.14); ctx.beginPath(); ctx.moveTo(f.x * s, f.y * s); ctx.lineTo(f.x2 * s, f.y2 * s); ctx.stroke();ctx.strokeStyle='#fff4dc';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=f.color;ctx.fillRect(f.x2*s-2,f.y2*s-2,5,5); }
      else if (f.kind === 'pulse') { ctx.strokeStyle = f.color; ctx.lineWidth = Math.max(2,s*.09); ctx.beginPath(); ctx.arc(f.x * s, f.y * s, f.r * s * (1 - f.t / 0.3 * 0.6), 0, 7); ctx.stroke(); }
      else if (f.kind === 'pop') { ctx.fillStyle = '#7dff8a'; ctx.font = `bold ${Math.max(10, s * 0.3)}px system-ui`; ctx.fillText(f.text, f.x * s, f.y * s - (0.35 - f.t) * s * 2); }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}
// Original pixel-art sprites; 24 x 24 logical pixels, independent of simulation.
const sprites = new Map();
function shade(hex,k){const n=parseInt(hex.slice(1),16);return '#'+[n>>16,(n>>8)&255,n&255].map(v=>Math.max(0,Math.min(255,Math.round(v*k))).toString(16).padStart(2,'0')).join('');}
function makeSprite(kind,color,frame=0){
  const key=kind+':'+color+':'+frame;if(sprites.has(key))return sprites.get(key);
  const cv=document.createElement('canvas');cv.width=cv.height=24;const g=cv.getContext('2d');
  const dark='#080c1b',steel='#293957',mid=shade(color,.65),hi=shade(color,1.25);
  function p(x,y,w,h,c){g.fillStyle=c;g.fillRect(x,y,w,h);}
  function panel(x,y,w,h,c){p(x,y,w,h,dark);p(x+1,y+1,w-2,h-2,steel);p(x+2,y+2,w-4,h-4,c);p(x+2,y+2,w-4,1,hi);p(x+2,y+h-3,w-4,1,mid);}
  function eye(x,y){p(x,y,3,3,dark);p(x+1,y,2,1,'#fff8d7');}
  function glow(x,y,w,h){p(x,y,w,h,mid);p(x+1,y+1,Math.max(1,w-2),Math.max(1,h-2),color);}
  if(kind==='ghost'||kind==='glitch'||kind==='phantom'){
    p(5,19,14,3,'#080c1b');p(6,4,12,2,dark);p(4,6,16,12,dark);p(6,6,12,12,mid);p(7,5,10,12,color);p(5,9,14,8,color);p(7,7,3,2,hi);
    for(let i=0;i<3;i++){p(5+i*5,17,4,3+(frame+i)%2,mid);p(6+i*5,17,2,2,color);}eye(7,10);eye(14,10);
    if(kind==='phantom'){p(2,7,3,10,mid);p(19,7,3,10,mid);p(9,15,6,1,'#fbe6ff');}
  }else if(kind==='spark'){
    p(1,10,5,3,mid);p(4,8,5,7,dark);p(7,6,11,12,dark);p(9,7,8,10,color);p(17,10,5,4,hi);p(10,8,5,2,'#fff7b0');p(12,14,5,2,mid);p(1,9+frame*3,5,1,color);
  }else if(kind==='swarm'){
    for(let i=0;i<3;i++){const x=2+i*7,y=8+((i+frame)%2)*3;panel(x,y,6,7,color);p(x+2,y+2,2,2,'#f3fff9');}
  }else if(kind==='brick'||kind==='overlord'){
    panel(3,4,18,17,mid);panel(1,8,5,10,steel);panel(18,8,5,10,steel);panel(7,7,10,10,color);
    p(9,9,6,3,dark);p(10,10,4,1,'#fff6db');p(5,20,5,3,dark);p(14,20,5,3,dark);p(6,20,3,1,color);p(15,20,3,1,color);
    if(kind==='overlord'){p(2,1,5,7,mid);p(17,1,5,7,mid);glow(9,13,6,5);p(11,14,2,2,'#fff');}
  }else if(kind==='hydra'||kind==='nullking'){
    panel(5,5,14,15,mid);glow(8,8,8,9);p(10,10,4,4,'#fff7cc');
    for(let i=0;i<4;i++){const x=i%2?18:1,y=i<2?4:15;panel(x,y+((i+frame)%2),5,6,color);}
    p(7,2,2,5,color);p(15,2,2,5,color);p(11,1,2,5,hi);
  }else{
    // Bevelled mounting platform and distinct defence silhouettes.
    panel(2,3,20,19,steel);p(4,19,16,2,'#101c33');p(4,5,2,2,color);p(18,5,2,2,color);p(4,17,2,1,hi);p(18,17,2,1,hi);
    if(kind==='security'||kind==='engineer'){
      panel(7,7,10,10,mid);p(10,10,5,4,color);p(14,10,8,4,dark);p(15,11,7,2,hi);p(20,10,2,4,color);p(8,8,4,2,hi);
      if(kind==='engineer'){p(6,6,3,3,color);p(6,15,3,3,color);p(15,15,3,3,color);}
    }else if(kind==='sound'){
      for(const y of [5,12]){panel(6,y,12,7,mid);p(9,y+2,6,4,dark);p(10,y+2,4,3,color);p(11,y+3,2,1,hi);}
    }else if(kind==='signal'){
      p(11,3,2,15,color);p(9,6,6,2,hi);p(7,9,10,2,mid);p(5,12,14,2,mid);p(7,16,10,3,color);glow(10,2,4,4);
    }else if(kind==='producer'){
      panel(6,6,12,12,mid);glow(8,8,8,7);p(9,9,6,1,hi);p(9,12,2,1,'#fff');p(12,12,3,1,'#fff');p(8,16,8,1,color);
    }else if(kind==='drone'){
      p(5,10,14,4,mid);p(10,5,4,14,color);panel(7,7,10,10,steel);glow(9,9,6,6);for(const [x,y] of [[3,3],[17,3],[3,17],[17,17]]){panel(x,y,4,4,color);}
    }
  }
  sprites.set(key,cv);return cv;
}
function blit(ctx,kind,color,x,y,size,frame=0){ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(makeSprite(kind,color,frame),Math.round(x-size/2),Math.round(y-size/2),Math.max(1,Math.round(size)),Math.max(1,Math.round(size)));ctx.restore();}
export function drawGhost(ctx,x,y,r,color){blit(ctx,'ghost',color,x,y,r*2.4);}
export function drawTowerIcon(ctx,type,cx,cy,s,level=1,angle=0,time=0){
  const color=TOWERS[type].color;
  blit(ctx,type,color,cx,cy,s*.93);
  if(type==='security'||type==='engineer'){ctx.save();ctx.translate(cx,cy);ctx.rotate(angle||0);ctx.fillStyle='#10172b';ctx.fillRect(0,-s*.055,s*.37,s*.11);ctx.fillStyle=color;ctx.fillRect(s*.08,-s*.025,s*.28,s*.05);ctx.restore();}
  if(type==='drone'||type==='signal'||type==='sound'){ctx.fillStyle=color;ctx.globalAlpha=.55+.4*Math.sin(time*5);ctx.fillRect(cx-s*.05,cy-s*.3,s*.1,Math.max(1,s*.04));ctx.globalAlpha=1;}
  for(let i=1;i<level;i++){ctx.fillStyle='#ffe9a3';ctx.fillRect(cx-s*.29+(i-1)*s*.15,cy+s*.34,s*.10,Math.max(2,s*.05));}
}
function drawTower(ctx,t,s,time){drawTowerIcon(ctx,t.type,t.x*s+s/2,t.y*s+s/2,s,t.level,t.angle,time);}
function drawEnemy(ctx,e,s,time){
  const def=ENEMIES[e.type],x=e.x*s,y=e.y*s,r=def.size*s,frame=Math.floor(time*8)%2;
  ctx.fillStyle='#05081280';ctx.fillRect(x-r*.8,y+r*.52,r*1.6,Math.max(2,r*.3));
  blit(ctx,e.type,def.color,x,y+Math.sin(time*6+e.x)*Math.min(2,s*.04),r*2.4,frame);
  if(e.slow||e.boss){ctx.strokeStyle=e.slow?'#ffd84f':'#ffe5f3';ctx.lineWidth=1;ctx.strokeRect(x-r*1.04,y-r*1.04,r*2.08,r*2.08);}
  if(e.hp<e.maxHp||e.boss){const w=r*2.2;ctx.fillStyle='#100c24';ctx.fillRect(x-w/2-1,y-r-7,w+2,5);ctx.fillStyle=e.boss?'#ff5ea8':'#7dff8a';ctx.fillRect(x-w/2,y-r-6,w*Math.max(0,e.hp/e.maxHp),3);}
}
