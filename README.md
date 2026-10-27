# Ghost Works: Studio Siege

Browser tower-defence game. Vanilla HTML/CSS/ES modules + Canvas. No build step; static site for Vercel.

- `index.html`, `css/style.css`
- `js/data.js` — 6 defences, 5 enemy classes + 3 bosses, 3 environments
- `js/levels.js` — Levels 1–10 handcrafted campaign; Level 11+ endless seeded generator (seed + archetype + difficulty), 7 archetypes, special events every 5 levels (boss every 10)
- `js/engine.js` — headless simulation core; `js/render.js` — procedural Canvas art; `js/main.js` — UI/input; `js/save.js` — versioned, validated localStorage
- `tests/sim.test.js` — `node tests/sim.test.js`; `tests/smoke.mjs` — Chromium mobile smoke test (needs playwright-core)

Run locally: `python3 -m http.server` then open http://localhost:8000.
