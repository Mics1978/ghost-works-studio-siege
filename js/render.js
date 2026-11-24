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
    const backdrop=ctx.createLinearGradient(0,0,0,this.h);backdrop.addColorStop(0,shade(env.bg,2.0));backdrop.addColorStop(1,shade(env.bg,1.15));ctx.fillStyle=backdrop;ctx.fillRect(0,0,this.w,this.h);
    ctx.save(); ctx.translate(this.ox, this.oy);
    for (let x = 0; x < GRID_W; x++) for (let y = 0; y < GRID_H; y++) {
      ctx.fillStyle=(x+y)%2?'#ffffff16':'#0000000c';ctx.fillRect(x*s+1,y*s+1,s-2,s-2);
      ctx.fillStyle=env.grid;ctx.fillRect(x*s+2,y*s+2,s-4,Math.max(1,s*.04));ctx.fillRect(x*s+2,y*s+2,Math.max(1,s*.04),s-4);
      if((x*13+y*7)%5===0){ctx.fillStyle=env.accent;ctx.globalAlpha=.34;ctx.fillRect(x*s+s*.14,y*s+s*.16,Math.max(1,s*.07),Math.max(1,s*.07));ctx.globalAlpha=1;}
      ctx.strokeStyle = env.grid; ctx.lineWidth = 1; ctx.strokeRect(x * s + 0.5, y * s + 0.5, s - 1, s - 1);
      if (env.id === 'server' && (x * 7 + y * 3) % 11 === 0) { ctx.fillStyle = '#0c2630'; ctx.fillRect(x * s + 4, y * s + 4, s - 8, s - 8); }
      if (env.id === 'rooftop' && (x * 5 + y * 9) % 13 === 0) { ctx.fillStyle = '#2a1a0c'; ctx.beginPath(); ctx.arc(x * s + s / 2, y * s + s / 2, s / 4, 0, 7); ctx.fill(); }
      if (env.id === 'studio' && (x + y * 4) % 9 === 0) { ctx.fillStyle = '#17123a'; ctx.fillRect(x * s + s * 0.3, y * s + s * 0.3, s * 0.4, s * 0.4); }
    }
    for (const p of game.def.routes) {
      ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
      for (const [w, col] of [[s*.98,'#080b19'],[s * 0.92, shade(env.pathEdge,1.3)], [s * 0.78, shade(env.path,1.5)]]) {
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
    // Construction markers: actual placement rules, not decorative cells.
    if(game.phase==='build'&&!ui.selected){
      ctx.strokeStyle='#70e5c38c';ctx.lineWidth=Math.max(.7,s*.035);
      for(let y=0;y<GRID_H;y++)for(let x=0;x<GRID_W;x++)if(game.canPlace(x,y)){
        const a=x*s+s*.5,b=y*s+s*.5,d=s*.105;ctx.beginPath();ctx.moveTo(a-d,b);ctx.lineTo(a+d,b);ctx.moveTo(a,b-d);ctx.lineTo(a,b+d);ctx.stroke();
      }
    }
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
// Amiga Plus: cached 96px vector sprites; no external textures.
const sprites=new Map();
function shade(hex,k){const n=parseInt(hex.slice(1),16);return '#'+[n>>16,(n>>8)&255,n&255].map(v=>Math.max(0,Math.min(255,Math.round(v*k))).toString(16).padStart(2,'0')).join('');}
function makeSprite(kind,color,frame=0){
 const key=kind+':'+color+':'+frame;if(sprites.has(key))return sprites.get(key);
 const cv=document.createElement('canvas');cv.width=cv.height=96;const g=cv.getContext('2d');g.scale(4,4);g.lineJoin='round';g.lineCap='round';
 const ink='#101a32',steel='#6989a9',dark=shade(color,.48);
 function grad(c,x,y,h){const p=g.createLinearGradient(x,y,x+h*.4,y+h);p.addColorStop(0,shade(c,1.5));p.addColorStop(.38,c);p.addColorStop(1,shade(c,.48));return p;}
 function path(pts,c,edge=ink){g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=c;g.fill();if(edge){g.strokeStyle=edge;g.lineWidth=.6;g.stroke();}}
 function box(x,y,w,h,c,r=1){r=Math.min(r,w/2,h/2);g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();g.fillStyle=grad(c,x,y,h);g.fill();g.strokeStyle=ink;g.lineWidth=.6;g.stroke();}
 function orb(x,y,r,c){const p=g.createRadialGradient(x-r*.3,y-r*.4,0,x,y,r);p.addColorStop(0,'#fff');p.addColorStop(.3,shade(c,1.35));p.addColorStop(.65,c);p.addColorStop(1,shade(c,.48));g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fillStyle=p;g.fill();g.strokeStyle=ink;g.lineWidth=.45;g.stroke();}
 function line(x,y,a,b,c,w=.6){g.beginPath();g.moveTo(x,y);g.lineTo(a,b);g.strokeStyle=c;g.lineWidth=w;g.stroke();}
 function dot(x,y,r,c){g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fillStyle=c;g.fill();}
 function base(){path([[2,7],[7,3],[17,3],[22,7],[22,18],[17,22],[7,22],[2,18]],grad(steel,2,3,19));path([[4,8],[8,5],[16,5],[20,8],[20,17],[16,20],[8,20],[4,17]],grad('#294968',4,5,15));for(const [x,y] of [[5,7],[19,7],[5,18],[19,18]])dot(x,y,.65,color);}
 if(kind==='ghost'||kind==='glitch'||kind==='phantom'){
  if(kind==='phantom'){path([[1,9],[5,5],[8,15],[4,21]],grad(dark,1,5,16));path([[23,9],[19,5],[16,15],[20,21]],grad(dark,16,5,16));}
  g.beginPath();g.moveTo(4.5,20);g.lineTo(4.5,10);g.bezierCurveTo(4.5,1,19.5,1,19.5,10);g.lineTo(19.5,20);g.quadraticCurveTo(17,22-frame,15,18);g.quadraticCurveTo(12,23,9,18);g.quadraticCurveTo(6,22,4.5,20);g.closePath();g.fillStyle=grad(color,5,3,19);g.fill();g.strokeStyle=ink;g.lineWidth=.7;g.stroke();box(7,9,4,5,'#182b48',1.4);box(13,9,4,5,'#182b48',1.4);dot(8.4,10.5,.8,'#fff');dot(14.4,10.5,.8,'#fff');line(8,6,11,5,'#fff',.9);
 }else if(kind==='spark'){path([[1,9+frame],[8,10],[8,15],[1,17-frame]],grad(color,1,9,8),null);path([[4,12],[10,5],[17,5],[23,12],[17,19],[10,19]],grad(color,4,5,14));orb(15,12,4,color);line(9,8,14,7,'#fff');}
 else if(kind==='swarm'){for(let i=0;i<3;i++){const x=5+i*7,y=10+((i+frame)%2)*4;orb(x,y,3.2,color);dot(x,y,.9,'#fff');}}
 else if(kind==='brick'||kind==='overlord'){box(3,4,18,17,steel,2);box(1,8,5,10,dark,1);box(18,8,5,10,dark,1);box(7,6,10,12,color,2);box(8,8,8,4,'#15263e',1);line(9,10,15,10,'#fff8bd',1);box(5,19,5,4,steel);box(14,19,5,4,steel);if(kind==='overlord'){path([[2,7],[2,1],[7,5],[7,9]],grad(color,2,1,8));path([[17,9],[17,5],[22,1],[22,7]],grad(color,17,1,8));orb(12,15,3,color);}}
 else if(kind==='hydra'||kind==='nullking'){box(5,4,14,17,steel,2);orb(12,12,5,color);for(const [x,y] of [[4,5],[20,5],[4,18],[20,18]]){line(12,12,x,y,steel,2);orb(x,y+(frame%2)*.5,2.8,color);}path([[8,5],[8,1],[12,4],[16,1],[16,5]],grad(color,8,1,5));}
 else {base();
  if(kind==='security'||kind==='engineer'){orb(12,12,5.4,steel);box(8,8,8,8,color,2);orb(12,12,2.4,color);if(kind==='engineer'){for(const [x,y] of [[7,7],[17,7],[7,17],[17,17]])dot(x,y,1.1,color);}}
  else if(kind==='sound'){for(const y of [5,12]){box(6,y,12,7,steel);orb(12,y+3.5,3,color);dot(12,y+3.5,1.1,'#fff');}}
  else if(kind==='signal'){box(7,16,10,3,steel);line(12,16,12,4,color,1.7);for(let i=0;i<3;i++)line(8-i,7+i*3,16+i,7+i*3,color,.8);orb(12,4,2.4,color);}
  else if(kind==='producer'){box(6,6,12,12,steel,2);box(8,8,8,7,color);line(9,11,15,11,'#fff',.9);line(9,13,13,13,'#fff',.7);for(let i=0;i<3;i++)dot(9+i*3,17,.6,color);}
  else if(kind==='drone'){line(5,5,19,19,steel,3);line(19,5,5,19,steel,3);for(const [x,y] of [[5,5],[19,5],[5,19],[19,19]]){orb(x,y,3,steel);dot(x,y,1.1,color);}orb(12,12,5,color);}
 }
 sprites.set(key,cv);return cv;
}
function blit(ctx,kind,color,x,y,size,frame=0){ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(makeSprite(kind,color,frame),x-size/2,y-size/2,Math.max(1,size),Math.max(1,size));ctx.restore();}
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
