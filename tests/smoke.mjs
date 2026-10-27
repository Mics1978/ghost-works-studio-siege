// Browser smoke test: node tests/smoke.mjs [url]  (requires playwright-core + Chrome)
import { chromium, devices } from 'playwright-core';
const url = process.argv[2] || 'http://localhost:8123/';
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url, { waitUntil: 'networkidle' });
await page.tap('#o-new'); await page.tap('#o-go');
await page.screenshot({ path: '/tmp/gw-title.png' });
// Tap tiles near the route until one tower is placed
let placed = 0;
for (const [cx, cy] of [[3, 4], [5, 6], [7, 4]]) {
  const p = await page.evaluate(([cx, cy]) => { const c = document.getElementById('game').getBoundingClientRect(); const s = Math.floor(Math.min(c.width / 17, c.height / 10)); const ox = Math.floor((c.width - s * 17) / 2), oy = Math.floor((c.height - s * 10) / 2); return [c.left + ox + s * (cx + 0.5), c.top + oy + s * (cy + 0.5)]; }, [cx, cy]);
  await page.touchscreen.tap(p[0], p[1]);
}
placed = await page.evaluate(() => window.__gw.game.towers.length);
await page.tap('#btn-wave'); await page.waitForTimeout(9000);
const st = await page.evaluate(() => { const g = window.__gw.game; return { kills: g.kills, credits: g.credits, wave: g.wave, phase: g.phase }; });
await page.screenshot({ path: '/tmp/gw-play.png' });
// jump to level 11 and 25
const proc = await page.evaluate(() => { window.__gw.startLevel(11); const a = window.__gw.game.def.name; window.__gw.startLevel(25); return [a, window.__gw.game.def.name, window.__gw.game.def.procedural]; });
await page.screenshot({ path: '/tmp/gw-l25.png' });
console.log(JSON.stringify({ placed, st, proc, errors }));
await browser.close(); process.exit(errors.length || placed < 1 || st.kills < 1 ? 1 : 0);
