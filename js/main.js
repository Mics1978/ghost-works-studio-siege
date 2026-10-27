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

function showOverlay(html) { overlay.innerHTML = `<div class="card">${html}</div>`; overlay.classList.add('show'); paused = true; }
function hideOverlay() { overlay.classList.remove('show'); overlay.innerHTML = ''; paused = false; }
function bind(map) { for (const [id, fn] of Object.entries(map)) { const el = $(id); if (el) el.onclick = fn; } }

function titleScreen() {
  const run = save.run;
  showOverlay(`<div class="title-ghost"></div><h1>GHOST WORKS<span>STUDIO SIEGE</span></h1>
    <p>Defend the Ghost Works studio network from rogue signals, firewall brutes and phantom agents.</p>
    <div class="btns">
      ${run ? `<button class="primary" id="o-continue">CONTINUE · Level ${run.level}</button>` : ''}
      <button ${run ? '' : 'class="primary"'} id="o-new">NEW RUN</button>
      <button id="o-stats">Progress</button><button id="o-how">How to play</button><button id="o-credits">Credits / About</button>
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
  const tw = TOWER_ORDER.map((k) => `<tr><td><b style="color:${TOWERS[k].color}">${TOWERS[k].name}</b> ₵${TOWERS[k].cost}<br><small>${TOWERS[k].desc}</small></td></tr>`).join('');
  const en = Object.values(ENEMIES).map((e) => `<tr><td><b style="color:${e.color}">${e.name}</b> — <small>${e.desc}</small></td></tr>`).join('');
  showOverlay(`<h2>How to play</h2><p>Pick a defence in the bottom bar, tap a free tile to build. Tap a built unit to upgrade or sell it. Press START WAVE. Defeated enemies pay credits. If studio integrity (♥) hits zero, the run ends.</p>
    <p>Levels 1–10 are the introductory campaign. From Level 11, Infinite Missions are generated from your run seed — there is no final level.</p>
    <h3>Defences</h3><table>${tw}</table><h3>Threats</h3><table>${en}</table><div class="btns"><button id="o-back">Back</button></div>`);
  bind({ 'o-back': game && !game.ended ? resumeOrTitle : titleScreen });
}
function creditsScreen() {
  showOverlay(`<h2>Credits / About</h2><p><b>Ghost Works: Studio Siege</b> — Version 1.0</p>
    <p>An original Ghost Works title. All artwork is procedurally generated with HTML Canvas and CSS; no third-party art or franchise assets are used.</p>
    <p>Credits (₵) are a fictional in-game currency with no real-world value. No purchases, wallets or payments.</p>
    <p><small>Development assisted by AI tooling (Grok Build).</small></p>
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

function buildBar() {
  const bar = $('build-bar'); bar.innerHTML = '';
  for (const k of TOWER_ORDER) {
    const T = TOWERS[k], locked = !game.def.unlock.includes(k);
    const b = document.createElement('button'); b.className = 'tb' + (k === buildType ? ' sel' : '') + (locked ? ' locked' : ''); b.dataset.type = k;
    const cv = document.createElement('canvas'); cv.width = 60; cv.height = 60; drawTowerIcon(cv.getContext('2d'), k, 30, 30, 60);
    b.append(cv); b.insertAdjacentHTML('beforeend', `<span>${T.short}</span><span class="c">₵${T.cost}</span>`);
    b.onclick = () => { if (locked) return toast(`${T.name} unlocks later in the campaign`); buildType = k; selected = null; showPanel(); buildBar(); toast(`${T.name}: ${T.desc}`); };
    bar.append(b);
  }
}
function showPanel() {
  const p = $('tower-panel'), bar = $('build-bar');
  if (!selected) { p.hidden = true; bar.hidden = false; return; }
  const t = selected, T = TOWERS[t.type], s = towerStats(t.type, t.level), max = t.level >= MAX_TOWER_LEVEL, uc = upgradeCost(t.type, t.level);
  p.hidden = false; bar.hidden = true;
  p.innerHTML = `<div class="info"><b style="color:${T.color}">${T.name}</b> Lv${t.level}<br>
    ${t.type === 'producer' ? `+₵${s.income}/wave · +15% dmg to neighbours` : `DMG ${s.damage.toFixed(0)} · RATE ${s.rate.toFixed(1)}/s · RNG ${s.range.toFixed(1)}`}</div>
    <button id="p-up" ${max || game.credits < uc ? 'disabled' : ''}>${max ? 'MAX' : `Upgrade ₵${uc}`}</button>
    <button id="p-sell">Sell ₵${Math.floor(t.spent * 0.7)}</button><button id="p-close" class="sm">✕</button>`;
  bind({ 'p-up': () => { const r = game.upgrade(t); if (!r.ok) toast(r.reason); showPanel(); updateHud(); },
    'p-sell': () => { game.sell(t); selected = null; showPanel(); updateHud(); }, 'p-close': () => { selected = null; showPanel(); } });
}
function updateHud() {
  $('hud-level').textContent = game.def.number; $('hud-wave').textContent = `${game.wave}/${game.totalWaves}`;
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
  if (!res.ok && cx >= 0 && cy >= 0 && cx < 16 && cy < 10) toast(res.reason);
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

let last = performance.now(), acc = 0; const STEP = 1 / 60;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (game) {
    if (!paused) { acc += dt * speed; while (acc >= STEP) { game.update(STEP); acc -= STEP; } } else acc = 0;
    for (const e of game.events.splice(0)) {
      if (e.type === 'waveClear') { banner('WAVE CLEARED'); }
      if (e.type === 'leak') navigator.vibrate?.(30);
      if (e.type === 'won') onWin();
      if (e.type === 'lost') onLose();
    }
    if (selected && !game.towers.includes(selected)) { selected = null; showPanel(); }
    renderer.draw(game, { hover, selected }); updateHudThrottled();
  }
  requestAnimationFrame(loop);
}
let hudTick = 0; function updateHudThrottled() { if (++hudTick % 6 === 0) { updateHud(); if (selected) { const b = $('p-up'); if (b && selected.level < MAX_TOWER_LEVEL) b.disabled = game.credits < upgradeCost(selected.type, selected.level); } } }
resize(); titleScreen(); requestAnimationFrame(loop);
window.__gw = { get game() { return game; }, startLevel, get save() { return save; } }; // debug/testing hook
