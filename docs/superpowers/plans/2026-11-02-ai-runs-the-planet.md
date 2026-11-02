# AI Runs the Planet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an AI set the world's policy levers, run thousands of 50-year futures (2026-2076), and play the best, most likely and scariest one on a 3D globe: inside a God's Eye View (GEV) fork, driven by Claude through MCP, with a standalone Cesium page as demo fallback.

**Architecture:** One dependency-free ES module engine (`engine/`) does policies, Monte Carlo and export (GEV scene document v5 + GeoJSON packs, GEV view annotations). The fallback page imports it directly. The GEV fork vendors a copy (`src/future/`, kept in sync by `scripts/sync-engine.mjs`) and exposes it as two MCP tools plus a scene-file writer for Director playback.

**Tech Stack:** Plain ESM JavaScript, `node --test`, CesiumJS 1.x from cdn.jsdelivr.net, GEV (Node 24, Vite, its tool catalog and Director).

## Global Constraints

- Node 24 (`nvm use 24`) for GEV; the engine also runs on Node 22.
- Engine: no dependencies, deterministic for a given seed, 5,000 runs × 50 years in under 2 s on a laptop.
- Numbers come from named public sources, labelled as approximations: IPCC AR6 WG1 (SSP warming and sea level), UN World Population Prospects 2024.
- Copy everywhere: "possible futures, not predictions".
- No keys or secrets committed. Fallback runs without any key (Natural Earth imagery bundled with Cesium).
- GEV changes live on branch `future-mode` of the local clone only; nothing is pushed without approval.
- GEV scene files follow docs/SCENE-DOCUMENT.md v5 and docs/DIRECTOR-DATA-PACKS.md (≤ 2,000 features per GeoJSON, unique string feature `id`, `[lon, lat, h]`).

---

## File structure

```
ai-runs-the-planet/
  engine/
    rng.js          seeded PRNG (mulberry32) + normal sampler
    data.js         SSP baselines, population, hotspots, event catalog, sources
    policies.js     LEVERS, normalizePolicies(), describePolicies()
    simulate.js     simulateRun(policies, seed) -> Run
    montecarlo.js   runMonteCarlo(policies, {runs, seed}) -> Futures; optimizePolicies()
    export.js       toSceneDocument(futures) -> {document, assets}; annotationsFor(future, year)
    index.js        re-exports
    test/*.test.js  node --test
  fallback/index.html, fallback/app.js, fallback/style.css
  scripts/sync-engine.mjs   copy engine/*.js -> ../gods-eye-view/src/future/
  scripts/write-scene.mjs   write GEV scene doc + packs to gods-eye-view/public/scene-assets/future/
gods-eye-view/ (branch future-mode)
  src/future/*.js            vendored engine
  src/tools/queries/future.js  simulate_future, play_future
  src/tools/index.js          add both to coreTools
```

## Data types (shared by every task)

```js
// Policies: each lever 0..100
{ energy, carbonPrice, adaptation, food, cooperation, tech }

// Run (one simulated future)
{ seed, score, years: [{ year, warmingC, seaLevelM, populationBn, wellbeing, displacedM, deathsM }],
  events: [{ year, id, title, kind: 'good'|'bad', lat, lon, place, impact }],
  final: { warmingC, seaLevelM, populationBn, wellbeing, displacedM, deathsM } }

// Futures (Monte Carlo result)
{ policies, runs, seed,
  best: Run & { label: 'Best case', share }, likely: Run & {...}, worst: Run & {...},
  stats: { p2C, p1_5C, tippingShare, medianWarming, medianSeaLevel, scoreQuantiles: {p5,p50,p95} } }
```

### Task 1: Engine core (rng, data, policies, simulate)

**Files:** Create `engine/rng.js`, `engine/data.js`, `engine/policies.js`, `engine/simulate.js`, test `engine/test/simulate.test.js`

**Interfaces:**
- Produces: `mulberry32(seed) -> () => number`, `normal(rand) -> number`; `LEVERS` (array of `{key,label,help}`), `normalizePolicies(partial) -> Policies` (missing = 50, clamp 0..100); `emissionIndex(policies) -> 0..1`; `simulateRun(policies, seed) -> Run`.

- [ ] Step 1: tests: same seed ⇒ identical run; 51 yearly rows 2026..2076; strong climate policies (all 100) give lower median warming than all 0 over 200 seeds; warming in 2026 ≈ 1.4; population 2076 within 9..11.5 bn; events within years and with lat/lon.
- [ ] Step 2: run `node --test engine/test` → FAIL (modules missing).
- [ ] Step 3: implement.
  - Warming 2076 per SSP (AR6 approx): SSP1-2.6 1.8, SSP2-4.5 2.4, SSP3-7.0 2.9, SSP5-8.5 3.3 °C; sea level rise since 2020 by 2076: 0.26, 0.31, 0.36, 0.41 m. `emissionIndex = clamp(1 - (0.45 energy + 0.25 carbonPrice + 0.15 cooperation + 0.15 tech)/100 *1.1 + 0.05)`; interpolate across the four SSPs.
  - Per run: climate sensitivity multiplier `exp(0.18·normal)`, year path `1.4 + (W − 1.4)·f(t)` with `f = t^1.1`, plus event shocks.
  - Events (yearly Bernoulli): pandemic 2.5%, major war 1.5% (× (1.4 − cooperation/100)), tipping point (0 below 1.8 °C, rising 1.5%/yr per °C above; adds +0.25 °C / +0.05 m), heat dome (warming-driven), crop failure (× (1.3 − food/100)), volcanic winter 0.6% (−0.3 °C for 3 years), clean-energy breakthrough (tech/100 · 3%; lowers path), AI science boom (tech/100 · 2.5%; +wellbeing). Each event picks a place from its region list.
  - Displaced (M) = Σ hotspots exposureM × seaLevel/0.5 × (1 − 0.8·adaptation/100); wellbeing 0..100 from 62 + tech/cooperation gains − warming/shock damages; deaths sum of event impacts.
  - `score = wellbeing − 12·max(0, warming − 1.5) − 0.08·displacedM − 0.15·deathsM`.
- [ ] Step 4: run tests → PASS. Step 5: commit `feat(engine): seeded 50-year simulation`.

### Task 2: Monte Carlo, optimizer and export

**Files:** Create `engine/montecarlo.js`, `engine/export.js`, `engine/index.js`, tests `engine/test/montecarlo.test.js`, `engine/test/export.test.js`

**Interfaces:**
- Consumes: `simulateRun`, `normalizePolicies`.
- Produces: `runMonteCarlo(policies, { runs = 5000, seed = 2026 }) -> Futures` (best = run at 95th score percentile, likely = run nearest the median, worst = 5th; `share` = 0.05 / 0.5 / 0.05 band text); `optimizePolicies({ candidates = 60, runs = 300, seed }) -> { policies, futures, rationale: string[] }` (random search + hill-climb maximising p50 score with penalty on p5); `toSceneDocument(futures, { assetDir = 'future' }) -> { document, assets: { [path]: FeatureCollection } }`; `annotationsFor(run, year) -> GEV annotation[]` (≤ 24, pins for events up to that year, red/green, plus label).
- [ ] Step 1: tests: three futures with best.score ≥ likely.score ≥ worst.score; 5,000 runs < 2 s; optimizer beats all-0 policies; scene document `version: 5`, three scenes, each shot has finite camera and `dataPackIds` that exist in its scene's `dataPacks`, every asset path referenced exists and each feature has a unique string id; annotations ≤ 24 and each placed.
- [ ] Step 2: FAIL. Step 3: implement. Scene per future: shots at 2026, 2036, …, 2076 (6 shots) flying to the most severe event of that decade (or a global view), `durationSec 4`, `holdSec 3`; packs per decade with event points (+ coastal hotspot points sized by displacement).
- [ ] Step 4: PASS. Step 5: commit.

### Task 3: Fallback globe page

**Files:** Create `fallback/index.html`, `fallback/app.js`, `fallback/style.css`

- Cesium 1.x from `https://cdn.jsdelivr.net/npm/cesium@1/Build/Cesium/`, imagery = `TileMapServiceImageryProvider.fromUrl(buildModuleUrl('Assets/Textures/NaturalEarthII'))`, no ion token, `baseLayerPicker:false`, `geocoder:false`.
- Left panel: six lever sliders, buttons "Let AI decide" (optimizePolicies) and "Run 5,000 futures"; a tab for the human (audience) policies vs AI policies.
- Right panel: three future cards (Best / Most likely / Scariest), stats (chance below 2 °C, tipping share), sources and "possible futures, not predictions".
- Bottom: year slider 2026-2076 + play button; globe shows events up to the year (red/green pulsing points with labels), coastal hotspots sized by displaced people, a heat tint (globe `baseColor` / atmosphere hue shift) by warming; HUD with year, warming, sea level, population.
- "Audience vs AI" compare: score card of both likely futures side by side.
- Verify: serve with `npx http-server -p 5180` (or `python3 -m http.server`), open in Chrome, run, scrub; no console errors. Commit.

### Task 4: GEV fork: vendored engine + MCP tools

**Files:** Create `scripts/sync-engine.mjs`, `gods-eye-view/src/future/*` (generated), `gods-eye-view/src/tools/queries/future.js`, test `gods-eye-view/src/tools/queries/future.test.mjs`; Modify `gods-eye-view/src/tools/index.js` (import + add to `coreTools`).

**Interfaces:**
- `simulate_future` (kind query, requires []): input `{ policies: {energy..tech 0-100}, runs?: 500..10000, seed?, rationale?: string }`, or `{ let_ai_decide: true }` to run `optimizePolicies`. Returns summary + data `{ policies, stats, futures: { best, likely, worst } as compact {final, events(top 8)} }`. Caches the last result in module scope keyed `last`.
- `play_future` (kind action, requires ['app']): input `{ which: 'best'|'likely'|'worst', year?: 2026..2076 }`; uses the cached result (error `invalid_arguments` "Run simulate_future first"), builds `annotationsFor(run, year)` and a camera on the decade's hotspot, then `tools.call('show_in_gods_eye_view', { camera, annotations, style: 'normal' })` and returns its url/view plus a narration sentence.
- [ ] Tests (node --test via GEV's runner or `node --test`): simulate_future returns three futures; play_future without a prior simulate throws ToolError invalid_arguments; with one, it returns ≤ 24 annotations.
- [ ] Run GEV unit tests touching tools (`node --test src/tools/queries/future.test.mjs src/tools/catalog.test.mjs src/tools/surfaces.test.mjs`). Commit on `future-mode`.

### Task 5: Director scenes in GEV + MCP wiring

**Files:** Create `scripts/write-scene.mjs`; output `gods-eye-view/public/scene-assets/future/*.geojson` and `ai-runs-the-planet/out/future-scenes.json`.
- [ ] Script runs Monte Carlo (AI policies), calls `toSceneDocument`, writes assets and the document; validate with GEV's `parseSceneDocument` (import from `gods-eye-view/src/director/document.js`).
- [ ] `claude mcp add gods-eye-view-future -- node <abs>/gods-eye-view/server/mcp/stdio.js --api-base http://localhost:4173`; start `npm run dev`; import the scene file in GEV's scene editor and play; check MCP tools list includes the two tools.
- [ ] Commit.

### Task 6: Demo script + docs

- README with how to run each part, sources, and a 3-minute pitch run sheet (AI decides → three futures → audience vs AI → fallback switch).
- Update `../ideas.md` status line.
