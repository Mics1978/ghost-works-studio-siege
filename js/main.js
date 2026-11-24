// UI controller: wires DOM, input (touch + mouse via Pointer Events), game loop and persistence.
import { TOWERS, TOWER_ORDER, ENEMIES, ENVIRONMENTS, MAX_TOWER_LEVEL, towerStats, upgradeCost } from './data.js';
import { getLevel, CAMPAIGN_LENGTH, EVENTS } from './levels.js';
import { Game } from './engine.js';
import { Renderer, drawTowerIcon } from './render.js';
import * as Save from './save.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game'), stage = $('stage'), overlay = $('overlay');
const renderer = new Renderer(canvas);
let save = Save.load(localStorage);
let game = null, buildType = 'security', selected = null, hover = null, speed = save.settings.speed, paused = true;

function persist() { Save.store(localStorage, save); }
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 1600); }
function banner(msg) { const b = $('banner'); b.textContent = msg; b.classList.add('show'); clearTimeout(banner.h); banner.h = setTimeout(() => b.classList.remove('show'), 1500); }
function resize() { const r = stage.getBoundingClientRect(); renderer.resize(r.width, r.height); }
window.addEventListener('resize', resize); window.addEventListener('orientationchange', () => setTimeout(resize, 200));

function showOverlay(html) { overlay.innerHTML = `<div class="card">${html}</div>`; overlay.classList.add('show'); paused = true; audioControls(overlay.firstElementChild,true); }
function hideOverlay() { overlay.classList.remove('show'); overlay.innerHTML = ''; paused = false; }
function bind(map) { for (const [id, fn] of Object.entries(map)) { const el = $(id); if (el) el.onclick = fn; } }

function titleScreen() {
  const run = save.run;
  showOverlay(`<div class="title-ghost"></div><h1>GHOST WORKS<span>STUDIO SIEGE</span></h1>
    <p>Defend the Ghost Works studio network from rogue signals, firewall brutes and phantom agents.</p>
    <div class="btns">
      ${run ? `<button class="primary" id="o-continue">CONTINUE · Level ${run.level}</button>` : ''}
      <button ${run ? '' : 'class="primary"'} id="o-new">NEW RUN</button>
      <button id="o-stats">Progress</button><button id="o-how">Field manual</button><button id="o-credits">Credits / About</button>
    </div>`);
  bind({ 'o-continue': () => startLevel(save.run.level), 'o-new': confirmNewRun, 'o-stats': statsScreen, 'o-how': howScreen, 'o-credits': creditsScreen });
}
function confirmNewRun() {
  if (!save.run) return newRunNow();
  showOverlay(`<h2>Start a new run?</h2><p>Your current run (Level ${save.run.level}) will be abandoned. Lifetime records are kept.</p>
    <div class="btns"><button class="primary" id="o-yes">NEW RUN</button><button id="o-no">Cancel</button></div>`);
  bind({ 'o-yes': newRunNow, 'o-no': titleScreen });
}
function newRunNow() { save.run = Save.newRun(); save.stats.runsStarted++; persist(); startLevel(1); }
function statsScreen() {
  const s = save.stats;
  showOverlay(`<h2>Progress</h2><table>
    <tr><td>Current run level</td><td>${save.run ? save.run.level : '—'}</td></tr>
    <tr><td>Current run score</td><td>${save.run ? save.run.score : '—'}</td></tr>
    <tr><td>Run seed</td><td>${save.run ? save.run.seed : '—'}</td></tr>
    <tr><td>Highest level reached</td><td>${s.highestLevel}</td></tr><tr><td>Highest score</td><td>${s.highScore}</td></tr>
    <tr><td>Longest successful run (levels cleared)</td><td>${s.longestRun}</td></tr><tr><td>Bosses defeated</td><td>${s.bossesDefeated}</td></tr>
    <tr><td>Total enemies defeated</td><td>${s.totalKills}</td></tr><tr><td>Runs started</td><td>${s.runsStarted}</td></tr></table>
    <div class="btns"><button id="o-back">Back</button><button id="o-reset">Reset all progress</button></div>`);
  bind({ 'o-back': titleScreen, 'o-reset': () => { if (confirm('Erase all Ghost Works progress?')) { save = Save.defaultSave(); persist(); titleScreen(); } } });
}
function howScreen() {
  const tw = TOWER_ORDER.map((k) => `<tr><td><b style="color:${TOWERS[k].color}">${TOWERS[k].name}</b> ₵${TOWERS[k].cost}<br><small>${MACHINE_LORE[k]}<br>${TOWERS[k].desc}</small></td></tr>`).join('');
  const en = Object.values(ENEMIES).map((e) => `<tr><td><b style="color:${e.color}">${e.name}</b> — <small>${e.desc}</small></td></tr>`).join('');
  showOverlay(`<h2>Ghost Works Field Manual</h2><p>MISSION: Protect the studio network from hostile transmissions. Deploy machines along the enemy route before launching the next wave.</p><h3>01 · Build your defence</h3><p>Choose a named machine in the shop, then tap a marked construction tile on the grid. You cannot build on the enemy route. Each machine costs credits. Tap an installed unit to inspect, upgrade or sell it.</p><h3>02 · Hold the line</h3><p>Press START WAVE to release the next enemy group. Your machines act automatically. Defeated enemies earn credits. If studio integrity (♥) reaches zero, the run ends.</p>
    <p>Levels 1–10 are the introductory campaign. From Level 11, Infinite Missions are generated from your run seed — there is no final level.</p>
    <h3>Defences</h3><table>${tw}</table><h3>Threats</h3><table>${en}</table><div class="btns"><button id="o-back">Back</button></div>`);
  bind({ 'o-back': game && !game.ended ? resumeOrTitle : titleScreen });
}
function creditsScreen() {
  showOverlay(`<h2>Credits / About</h2><p><b>Ghost Works: Studio Siege</b> — Amiga Plus audiovisual preview</p>
    <p>An original Ghost Works title. All artwork is procedurally generated with HTML Canvas and CSS; no third-party art or franchise assets are used.</p>
    <p>Credits (₵) are a fictional in-game currency with no real-world value. No purchases, wallets or payments.</p>
    <p><small>Original synthesized soundtrack and arcade sound effects. Development assisted by Grok Build and ChatGPT.</small></p>
    <div class="btns"><button id="o-back">Back</button></div>`);
  bind({ 'o-back': titleScreen });
}
function resumeOrTitle() { if (game && game.phase !== 'lost' && game.phase !== 'won') hideOverlay(); else titleScreen(); }
function menuScreen() {
  showOverlay(`<h2>Paused</h2><div class="btns"><button class="primary" id="o-resume">Resume</button><button id="o-restart">Restart level</button>
    <button id="o-how">How to play</button><button id="o-new">New run</button><button id="o-title">Main menu</button></div>`);
  bind({ 'o-resume': hideOverlay, 'o-restart': () => startLevel(game.def.number), 'o-how': howScreen, 'o-new': confirmNewRun, 'o-title': titleScreen });
}

function startLevel(n) {
  if (!save.run) { save.run = Save.newRun(); persist(); }
  const def = getLevel(n, save.run.seed);
  game = new Game(def); selected = null;
  if (!def.unlock.includes(buildType)) buildType = def.unlock[0];
  renderer.bgCache = null; resize(); buildBar(); updateHud();
  const env = ENVIRONMENTS[def.env % ENVIRONMENTS.length];
  const tags = [def.procedural ? 'Infinite Mission' : `Campaign ${n}/${CAMPAIGN_LENGTH}`, env.name, def.event ? '⚡ ' + (EVENTS[def.event]?.name || def.event) : null, def.boss ? 'BOSS' : null]
    .filter(Boolean).map((t) => `<span class="tag">${t}</span>`).join('');
  showOverlay(`<h2>Level ${n}: ${def.name}</h2>${tags}<p>${def.intro}</p><p>${def.waves.length} waves · Starting credits ₵${def.credits}${def.procedural ? ` · Seed ${def.seed.toString(16).toUpperCase()}` : ''}</p>
    <div class="btns"><button class="primary" id="o-go">DEFEND THE STUDIO</button></div>`);
  bind({ 'o-go': hideOverlay });
}

const MACHINE_LORE={security:'The studio’s first line of defence. Reliable fire against incoming rogue signals.',sound:'Turns studio bass into a shockwave. Hits every enemy in range.',signal:'Jams hostile transmissions, slowing intruders for other units to intercept.',producer:'Keeps the studio funded. Generates credits and boosts nearby defences.',drone:'A long-range recon unit that prioritises the toughest enemy and pierces armour.',engineer:'A rapid arc rig that strips enemy armour for the rest of the defence team.'};
function buildBar() {
  const bar = $('build-bar'); const scroll=bar.scrollLeft; bar.innerHTML = '';
  for (const k of TOWER_ORDER) {
    const T = TOWERS[k], locked = !game.def.unlock.includes(k);
    const b = document.createElement('button'); b.className = 'tb' + (k === buildType ? ' sel' : '') + (locked ? ' locked' : ''); b.dataset.type = k;
    const cv = document.createElement('canvas'); cv.width = 120; cv.height = 120; drawTowerIcon(cv.getContext('2d'), k, 60, 60, 120);
    b.append(cv); b.insertAdjacentHTML('beforeend', `<span class="machine-name">${T.name}</span><span class="c">₵${T.cost}${locked ? " · LOCKED" : ""}</span><span class="machine-desc">${MACHINE_LORE[k]}</span>`);
    b.onclick = () => { if (locked) return toast(`${T.name} unlocks later in the campaign`); buildType = k; audio.effect('select'); selected = null; showPanel(); buildBar(); toast(`${T.name}: tap a free tile to deploy`); };
    b.setAttribute('aria-pressed',String(k===buildType)); b.setAttribute('aria-label',T.name+', '+T.cost+' credits. '+MACHINE_LORE[k]+(locked?' Locked.':'')); bar.append(b);
  }
  bar.scrollLeft=scroll; updateBuildHint();
}
function showPanel() {
  const p = $('tower-panel'), bar = $('build-bar');
  if (!selected) { p.hidden = true; bar.hidden = false; updateBuildHint(); return; }
  const t = selected, T = TOWERS[t.type], s = towerStats(t.type, t.level), max = t.level >= MAX_TOWER_LEVEL, uc = upgradeCost(t.type, t.level);
  p.hidden = false; bar.hidden = true; updateBuildHint();
  p.innerHTML = `<div class="info"><b style="color:${T.color}">${T.name}</b> Lv${t.level}<br>
    ${MACHINE_LORE[t.type]}<br>${t.type === 'producer' ? `+₵${s.income}/wave · +15% dmg to neighbours` : `DMG ${s.damage.toFixed(0)} · RATE ${s.rate.toFixed(1)}/s · RNG ${s.range.toFixed(1)}`}</div>
    <button id="p-up" ${max || game.credits < uc ? 'disabled' : ''}>${max ? 'MAX' : `Upgrade ₵${uc}`}</button>
    <button id="p-sell">Sell ₵${Math.floor(t.spent * 0.7)}</button><button id="p-close" class="sm">✕</button>`;
  bind({ 'p-up': () => { const r = game.upgrade(t); if (!r.ok) toast(r.reason); else audio.effect('upgrade'); showPanel(); updateHud(); },
    'p-sell': () => { game.sell(t); audio.effect('sell'); selected = null; showPanel(); updateHud(); }, 'p-close': () => { selected = null; showPanel(); } });
}
function updateBuildHint(){const el=$('build-hint');if(!el||!game)return;const T=TOWERS[buildType];el.textContent=selected?'Selected: '+TOWERS[selected.type].name+' · Upgrade or sell below':game.credits<T.cost?'Selected: '+T.name+' · Not enough credits':'Selected: '+T.name+' · Tap a marked tile to deploy';}
function updateHud() {
  updateBuildHint(); $('hud-level').textContent = game.def.number; $('hud-wave').textContent = `${game.wave}/${game.totalWaves}`;
  $('hud-credits').textContent = game.credits; $('hud-lives').textContent = game.lives;
  $('hud-score').textContent = (save.run?.score || 0) + game.score;
  const w = $('btn-wave'); w.disabled = game.phase !== 'build'; w.textContent = game.phase === 'wave' ? 'WAVE LIVE…' : `START WAVE ${game.wave + 1} ▶`;
  for (const b of document.querySelectorAll('.tb')) b.classList.toggle('dis', TOWERS[b.dataset.type].cost > game.credits);
}

// Pointer input: works for touch, pen, mouse.
canvas.addEventListener('pointerdown', (ev) => {
  if (!game || paused) return;
  const r = canvas.getBoundingClientRect(); const [cx, cy] = renderer.toCell(ev.clientX - r.left, ev.clientY - r.top);
  const t = game.towerAt(cx, cy);
  if (t) { selected = t; showPanel(); return; }
  if (selected) { selected = null; showPanel(); return; }
  const res = game.place(buildType, cx, cy);
  if (!res.ok && cx >= 0 && cy >= 0 && cx < 16 && cy < 10) toast(res.reason==='Blocked tile'?'Choose a marked construction tile, not the enemy route.':res.reason);
  updateHud();
});
canvas.addEventListener('pointermove', (ev) => { if (ev.pointerType !== 'mouse' || !game) return; const r = canvas.getBoundingClientRect(); hover = renderer.toCell(ev.clientX - r.left, ev.clientY - r.top); });
canvas.addEventListener('pointerleave', () => (hover = null));
bind({ 'btn-wave': () => { if (game && game.startWave()) { banner(`WAVE ${game.wave}`); updateHud(); } },
  'btn-menu': () => (game ? menuScreen() : titleScreen()),
  'btn-speed': () => { speed = speed === 1 ? 2 : 1; save.settings.speed = speed; persist(); $('btn-speed').textContent = speed + '×'; } });
$('btn-speed').textContent = speed + '×';

function onWin() {
  const n = game.def.number;
  Save.recordLevelClear(save, n, (save.run.score || 0) + game.score, game.bossKills, game.kills); persist();
  const finale = n === CAMPAIGN_LENGTH;
  showOverlay(`<h2>${finale ? 'INTRODUCTORY CAMPAIGN COMPLETE' : 'LEVEL CLEARED'}</h2>
    <p>${finale ? 'The Static Overlord is offline. But the network never sleeps — Infinite Missions are now unlocked. Every mission from here is generated from your run seed, with no final level.' : `Studio integrity ${game.lives}/20 · Kills ${game.kills}`}</p>
    <p>Run score: <b>${save.run.score}</b></p><div class="btns"><button class="primary" id="o-next">${finale ? 'ENTER INFINITE MISSIONS' : 'NEXT LEVEL'} → ${n + 1}</button><button id="o-title">Main menu</button></div>`);
  bind({ 'o-next': () => startLevel(save.run.level), 'o-title': titleScreen });
}
function onLose() {
  const n = game.def.number;
  save.stats.highScore = Math.max(save.stats.highScore, (save.run.score || 0) + game.score);
  save.stats.totalKills += game.kills; save.stats.bossesDefeated += game.bossKills;
  const cleared = save.run.cleared; persist();
  showOverlay(`<h2>STUDIO BREACHED</h2><p>Level ${n} failed. This run cleared ${cleared} level(s).</p>
    <div class="btns"><button class="primary" id="o-retry">Retry level ${n}</button><button id="o-new">New run</button><button id="o-title">Main menu</button></div>`);
  bind({ 'o-retry': () => startLevel(n), 'o-new': () => { save.run = null; newRunNow(); }, 'o-title': titleScreen });
}


 // Original procedural FM-inspired soundtrack; no external audio or assets.
 const MUSIC = {
   menu:{bpm:100,roots:[45,41,48,43],lead:[69,null,72,null,76,74,null,72,67,null,69,null,72,null,64,null]},
   build:{bpm:112,roots:[45,48,43,41],lead:[69,72,null,76,74,null,72,null,67,71,null,74,72,null,69,null]},
   wave:{bpm:136,roots:[45,43,41,43],lead:[76,null,74,72,69,null,72,74,77,null,76,72,71,null,74,76]},
   boss:{bpm:152,roots:[40,41,38,43],lead:[76,77,79,null,76,72,74,null,77,76,72,71,74,null,79,77]}
 };
 class ArcadeAudio {
   constructor(){this.ctx=null;this.bus=null;this.enabled=true;this.mode='menu';this.step=0;this.next=0;this.timer=null;this.nodes=new Set();this.fxNodes=new Set();this.fxEnabled=true;this.lastFx={};try{this.enabled=localStorage.getItem('ghostworks.music')!=='off';this.fxEnabled=localStorage.getItem('ghostworks.sfx')!=='off';}catch{}}
   async start(){if(!this.enabled&&!this.fxEnabled)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
     try{if(!this.ctx){this.ctx=new AC();this.bus=this.ctx.createGain();this.bus.gain.value=.16;this.bus.connect(this.ctx.destination);this.fxBus=this.ctx.createGain();this.fxBus.gain.value=.20;this.fxBus.connect(this.ctx.destination);}
       if(this.ctx.state==='suspended')await this.ctx.resume();
       if(this.ctx.state!=='running'||document.hidden)return;
       if(this.enabled&&!this.timer){this.next=this.ctx.currentTime+.06;this.timer=setInterval(()=>this.tick(),35);}
     }catch{}}
   stop(){if(this.timer){clearInterval(this.timer);this.timer=null;}for(const n of this.nodes){try{n.stop();}catch{}}this.nodes.clear();}
   setEnabled(v){this.enabled=v;try{localStorage.setItem('ghostworks.music',v?'on':'off');}catch{}if(v)this.start();else this.stop();}
   stopFx(){for(const n of this.fxNodes){try{n.stop();}catch{}}this.fxNodes.clear();}
   setFx(v){this.fxEnabled=v;try{localStorage.setItem('ghostworks.sfx',v?'on':'off');}catch{}if(v)this.start();else this.stopFx();}
   setMode(mode){if(mode!==this.mode){this.mode=mode;this.step=0;this.stop();if(this.enabled&&!document.hidden&&this.ctx?.state==='running')this.start();}}
   tone(note,at,dur,vol,type='square',slide=0,fx=false){if(!this.ctx||note==null)return;const nodes=fx?this.fxNodes:this.nodes;const o=this.ctx.createOscillator(),g=this.ctx.createGain();const hz=440*Math.pow(2,(note-69)/12);o.type=type;o.frequency.setValueAtTime(hz,at);if(slide)o.frequency.exponentialRampToValueAtTime(hz*Math.pow(2,slide/12),at+dur*.8);
     g.gain.setValueAtTime(.0001,at);g.gain.linearRampToValueAtTime(vol,at+.008);g.gain.exponentialRampToValueAtTime(.0001,at+dur);o.connect(g);g.connect(fx?this.fxBus:this.bus);nodes.add(o);o.onended=()=>{nodes.delete(o);o.disconnect();g.disconnect();};o.start(at);o.stop(at+dur+.012);}
   effect(kind){if(!this.fxEnabled||!this.ctx||this.ctx.state!=='running'||document.hidden||this.fxNodes.size>28)return;
     const now=this.ctx.currentTime;if(now-(this.lastFx[kind]??-10)<(kind==='laser'?.075:kind==='kill'?.10:.045))return;this.lastFx[kind]=now;
     const hit=(n,delay,dur,vol,type='triangle',slide=0)=>this.tone(n,now+.012+delay,dur,vol,type,slide,true);
     const phrase=(ns,step=.075)=>ns.forEach((n,i)=>hit(n,i*step,.13,.17,'triangle'));
     switch(kind){case 'laser':hit(83,0,.065,.11,'square',-15);break;case 'pulse':hit(43,0,.23,.32,'sine',-17);hit(55,0,.14,.12,'triangle',-10);break;
       case 'place':phrase([55,67,74],.045);break;case 'upgrade':phrase([60,64,67,72],.06);break;case 'sell':phrase([72,67,60],.05);break;case 'kill':hit(57,0,.09,.13,'triangle',-12);hit(79,.025,.05,.09,'square',-10);break;
       case 'bossKill':hit(37,0,.48,.35,'triangle',-17);phrase([60,67,72,76],.09);break;case 'leak':hit(50,0,.3,.24,'sawtooth',-7);break;case 'wave':phrase([55,55,62,67],.085);break;
       case 'clear':phrase([60,64,67,72],.11);break;case 'won':phrase([60,64,67,72,76,79],.12);break;case 'lost':phrase([64,60,57,48],.16);break;case 'select':hit(76,0,.055,.10,'triangle');break;}
   }
   tick(){if(!this.ctx||this.ctx.state!=='running'||document.hidden)return;const m=MUSIC[this.mode]||MUSIC.menu,dt=60/m.bpm/4,now=this.ctx.currentTime;if(this.next<now-.15)this.next=now+.03;
     let guard=0;while(this.next<now+.13&&guard++<16){const n=this.step++,i=n%16,root=m.roots[Math.floor(n/16)%m.roots.length],at=this.next;
       if(i%4===0||i%4===2)this.tone(root+(i%8===6?7:0),at,dt*1.7,.22,'triangle');
       const melody=m.lead[i];if(melody!=null){this.tone(melody,at,dt*1.55,.095,'square');this.tone(melody+12,at,dt*.65,.018,'sine');}
       if(i%4===0)this.tone(29,at,.12,.18,'sine',-17);
       if(i%4===2)this.tone(78,at,.045,.025,'triangle',-11);
       if(i%4===1||i%4===3)this.tone(93,at,.027,.012,'square',-7);
       if(i%8===0){this.tone(root+12,at,dt*6.5,.026,'triangle');this.tone(root+19,at,dt*6.5,.021,'triangle');}
       this.next+=dt;
     }}
 }
 const audio=new ArcadeAudio();
 function audioControls(host,overlayMode=false){const wrap=document.createElement('div');wrap.className='audio-controls';for(const kind of ['music','sfx']){const b=document.createElement('button');b.type='button';b.className='sm';b.dataset.audio=kind;b.dataset.full=overlayMode?'yes':'no';b.setAttribute('aria-label',kind==='music'?'Toggle music':'Toggle sound effects');b.onclick=()=>{if(kind==='music')audio.setEnabled(!audio.enabled);else{audio.setFx(!audio.fxEnabled);audio.effect('select');}audioLabels();};wrap.append(b);}host.prepend(wrap);audioLabels();}
 function audioLabels(){for(const b of document.querySelectorAll('[data-audio]')){const music=b.dataset.audio==='music',on=music?audio.enabled:audio.fxEnabled;b.textContent=b.dataset.full==='yes'?(music?'Music':'Sound')+': '+(on?'ON':'OFF'):(music?'♫':'FX')+(on?'':' ×');b.setAttribute('aria-pressed',String(on));b.title=(on?'Mute ':'Enable ')+(music?'music':'sound effects');}}
 audioControls(document.querySelector('.ctrls'));
 document.addEventListener('pointerdown',()=>audio.start(),{passive:true});
 document.addEventListener('keydown',()=>audio.start());
 document.addEventListener('visibilitychange',()=>{if(document.hidden){audio.stop();audio.stopFx();}else if(audio.ctx&&(audio.enabled||audio.fxEnabled))audio.start();});

const heardEffects=new WeakSet();
let last = performance.now(), acc = 0; const STEP = 1 / 60;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  audio.setMode(!game||paused?'menu':game.phase==='wave'?(game.enemies.some(e=>e.boss)?'boss':'wave'):'build');
  if (game) {
    if (!paused) { acc += dt * speed; while (acc >= STEP) { game.update(STEP); acc -= STEP; } } else acc = 0;
    if(!paused){for(const f of game.effects){if(!heardEffects.has(f)){heardEffects.add(f);if(f.kind==='beam')audio.effect('laser');else if(f.kind==='pulse')audio.effect('pulse');}}}
    for (const e of game.events.splice(0)) {
      if(e.type==='place'||e.type==='wave'||e.type==='leak'||e.type==='won'||e.type==='lost')audio.effect(e.type);
      if(e.type==='kill')audio.effect(e.enemy?.boss?'bossKill':'kill');
      if(e.type==='waveClear')audio.effect('clear');
      if (e.type === 'waveClear') { banner('WAVE CLEARED'); }
      if (e.type === 'leak') navigator.vibrate?.(30);
      if (e.type === 'won') onWin();
      if (e.type === 'lost') onLose();
    }
    if (selected && !game.towers.includes(selected)) { selected = null; showPanel(); }
    renderer.draw(game, { hover, selected, buildType }); updateHudThrottled();
  }
  requestAnimationFrame(loop);
}
let hudTick = 0; function updateHudThrottled() { if (++hudTick % 6 === 0) { updateHud(); if (selected) { const b = $('p-up'); if (b && selected.level < MAX_TOWER_LEVEL) b.disabled = game.credits < upgradeCost(selected.type, selected.level); } } }
resize(); titleScreen(); requestAnimationFrame(loop);
window.__gw = { get game() { return game; }, startLevel, get save() { return save; } }; // debug/testing hook
