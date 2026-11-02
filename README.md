# AI Runs the Planet (2026 → 2076)

**Macromedia X CODE Hackathon, Berlin, Nov 2-3 2026.** Theme: *"Reimagine the Future: how can we use AI, technology, and creativity to improve tomorrow's world?"*
Team: Malek Hassan ([@Malek1414](https://github.com/Malek1414)) and Sammy ([@sami-mag07](https://github.com/sami-mag07)).
**Deadline: Nov 3, 18:30** at Macromedia Campus, Mehringdamm 33. Top 5 are considered for funding grants and the LEXIE programme.

What happens if we let an AI run the world for 50 years? It gets the same budget as humanity (360 points across six policy levers), tests every mix on thousands of Monte Carlo futures, and picks one. The globe then plays three of the futures: **best case** (top 5%), **most likely** (median) and **scariest** (worst 5%). Then the audience spends the same budget and we compare.

Possible futures, not predictions. Warming and sea level follow IPCC AR6 SSP pathways, population follows UN WPP 2024; events (pandemics, wars, tipping points, breakthroughs) and their effects are simplified.

---

## Contents
1. [Status](#status)
2. [The 60-second version for a new teammate](#the-60-second-version-for-a-new-teammate)
3. [Run it](#run-it)
4. [How it works](#how-it-works)
5. [Repository map](#repository-map)
6. [God's Eye View fork](#gods-eye-view-fork)
7. [Claude in charge (MCP)](#claude-in-charge-mcp)
8. [The model, honestly](#the-model-honestly)
9. [Pitch and video](#pitch-and-video)
10. [What's left for Nov 3](#whats-left-for-nov-3)
11. [Picking this up with Claude Code](#picking-this-up-with-claude-code)
12. [Credits and licences](#credits-and-licences)

## Status

| Part | State | Checked by |
|---|---|---|
| Engine (`engine/`) | done | 11 tests (`npm test`) |
| Fallback globe (`fallback/`) | done | clicked through in Chrome: title screen → AI decides → playback with event banners → 2076 report → audience run → AI vs audience face-off |
| GEV fork: MCP tools `simulate_future`, `play_future` | done | 3 new tests + GEV's 225 tool/MCP tests pass; GEV's package boundary check passes; called over real MCP stdio |
| GEV fork: Director scenes (3 futures × 6 decades) | done | GEV's own `parseSceneDocument` accepts it; imported in GEV Authoring and played |
| Results file for the pitch | done | `node scripts/results.mjs` → `results/ai-vs-audience.md` |
| Voice-over script (2:00) | done, waiting for Malek's OK | pitch skill gates + 3-judge retell pass |
| Video spec | done | [`docs/video-spec.md`](docs/video-spec.md) |
| Demo video | **to record** | see "What's left" |

## The 60-second version for a new teammate

- **The engine** simulates one 50-year future per seed:
  - **Warming and sea level** follow the IPCC pathway the six levers point to, scaled by an uncertain climate sensitivity.
  - **Chance events** push each run around.
  - **Monte Carlo** runs 5,000 seeds, ranks them by a score, and keeps the 95th percentile, the median and the 5th percentile run.
- **"AI decides"** is a real optimizer, not a scripted answer:
  - It does a random search plus hill-climbing over budget-fitting mixes.
  - Every candidate is compared on the same seeds.
  - It maximises the typical outcome plus half the worst-5% outcome.
- **The surprising result:** with seed 2026 the AI picks energy 100, cooperation 99, tech 84, carbon 69, food 4 and coastal adaptation 1.
  - It keeps 92% of futures below 2 °C.
  - But in its most likely future, 31 million people are pushed out by the sea.
  - A people-first audience mix gets only 8 million displaced, but 0% of its futures stay below 2 °C.
- **That tension is the pitch:** "the AI saved the climate and forgot the coast".
- **Two front-ends show the same engine:**
  - a keyless Cesium page (safe demo);
  - a God's Eye View fork, where Claude can be "in charge" through MCP tools.

## Run it

Needs: Node 22+ for the engine and fallback, **Node 24** for GEV (`nvm install 24`), Python 3 (any static server works).

```bash
git clone https://github.com/Malek1414/macromedia-hackathon.git
cd macromedia-hackathon
npm test                                          # engine, 11 tests

# 1. Fallback globe (no keys, no install)
./scripts/vendor-cesium.sh                        # once: local CesiumJS, so the globe loads without Wi-Fi
python3 -m http.server 5180 --bind 127.0.0.1
open http://127.0.0.1:5180/fallback/              # add ?offline to force the built-in map if the venue Wi-Fi is bad

# 2. God's Eye View fork (clones GEV next to this repo and applies our patch)
./scripts/setup-gev.sh                            # -> ../gods-eye-view on branch future-mode
cd ../gods-eye-view && npm run dev                # http://localhost:4173, keep it running
cd ../macromedia-hackathon
node scripts/write-scene.mjs                      # AI picks, writes 3 scenes + 18 GeoJSON packs into GEV
# GEV: AUTHORING > import out/ai-runs-the-planet.scenes.json > "Apply import" > pick a future > Play

# 3. Claude in charge
claude mcp add -s user gods-eye-view -- "$(which node)" "$(cd ../gods-eye-view && pwd)/server/mcp/stdio.js" --api-base http://localhost:4173
# restart Claude Code, then ask: "You run the world 2026-2076. Use simulate_future, explain your
# levers, then play_future the scariest future at 2046 and 2076."
```

Photoreal 3D in GEV needs a Google Maps key (GEV > "Power up"). Without it GEV uses Esri satellite imagery, which is fine for the demo. **Never commit keys.**

## How it works

```
               ┌──────────────── engine/ (plain ES modules, no deps) ────────────────┐
policies ──►   │ policies.js  levers, 360-point budget, emission index, policy cost  │
(AI or human)  │ simulate.js  one seeded 50-year run: warming, sea, events, people   │
               │ montecarlo.js 5,000 runs → best / likely / worst + stats; optimizer │
               │ export.js    GEV scene doc v5 + GeoJSON packs; GEV annotations       │
               └──────┬───────────────────────────────┬──────────────────────────────┘
                      │ imported directly              │ copied by scripts/sync-engine.mjs
              fallback/ (Cesium, Web Worker)     gods-eye-view/src/future/
                                                   ├─ src/tools/queries/future.js  (MCP tools)
                                                   └─ public/scene-assets/future/  (Director packs)
```

- **Fallback** (`fallback/app.js`), flow: title screen ("Hand over the planet") → the AI "tests futures" (it really started optimizing in a second worker at page load, so the click answers in under 2 s) → sliders glide to its pick → playback 2026-2076 with event banners → 2076 report card → "Try to beat the AI" → audience run → report with the AI vs audience face-off.
- **Fallback** visuals:
  - NASA GIBS Blue Marble (day) and Black Marble city lights (night) with real day/night lighting, bloom, a red veil that thickens with warming. No key needed.
  - Runs the engine in a Web Worker (`fallback/worker.js`), so the 4-5 s optimizer never freezes the globe.
  - Events glow red (disasters) or green (breakthroughs) and send out shockwave rings; coastal cities glow amber, sized by people flooded out.
  - During playback the camera centres on a new event at most every 3 years, and the event banner fires with it.
- **GEV tools** (`src/tools/queries/future.js` in the fork):
  - `simulate_future` takes policies (or `let_ai_decide: true`), runs the futures and caches the result.
  - `play_future` builds GEV annotations for one future at one year, then calls GEV's own `show_in_gods_eye_view`. That gives the live panel in Claude Desktop and a link everywhere else.
- **Director scenes** (`export.js` → `toSceneDocument`): one scene per future, one shot per decade (2026 … 2076), with the camera on that decade's defining event and a GeoJSON pack of events and coastal hotspots.

## Repository map

| Path | What |
|---|---|
| `engine/rng.js` | seeded PRNG (mulberry32), normal sampler |
| `engine/data.js` | IPCC SSP anchors, UN population, 14 coastal hotspots, 9 event types, sources |
| `engine/policies.js` | the six levers, `BUDGET = 360`, `fitBudget`, `emissionIndex`, `policyCost` |
| `engine/simulate.js` | `simulateRun(policies, seed)`, `hotspotsAt(run, year, adaptation)` |
| `engine/montecarlo.js` | `runMonteCarlo`, `optimizePolicies`, `explain` |
| `engine/export.js` | `toSceneDocument`, `annotationsFor`, `cameraFor`, `headline` |
| `engine/test/` | `node --test` suites |
| `fallback/` | `index.html`, `app.js`, `worker.js`, `style.css` |
| `gev-future-mode/*.patch` | our commit on top of GEV `BASE_COMMIT` (`git am`-able) |
| `scripts/setup-gev.sh` | clone GEV at `BASE_COMMIT`, apply the patch on `future-mode`, `npm install` |
| `scripts/sync-engine.mjs` | copy `engine/*.js` into `../gods-eye-view/src/future/` after engine edits |
| `scripts/write-scene.mjs` | AI picks (or `--policies '{...}'`), validate with GEV's parser, write scenes + packs |
| `scripts/results.mjs` | write `results/ai-vs-audience.md` (the numbers the pitch quotes) |
| `results/ai-vs-audience.md` | AI vs sample audience, seed 2026, 5,000 futures each |
| `pitch/ai-runs-the-planet/` | pitch skill folder: fact ledger, interview, story, gated script |
| `docs/pitch-script.md` | voice-over script with timecodes |
| `docs/video-spec.md` | 2-minute video design spec: shot list, recording, edit, checks |
| `docs/ideas.md` | every idea we considered for this hackathon |
| `docs/superpowers/plans/` | implementation plan |

## God's Eye View fork

- **Upstream:** [bilawalsidhu/gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view) (MIT code; data sources have their own licences).
- **Where our changes live:** one commit in `gev-future-mode/`, applied on top of `gev-future-mode/BASE_COMMIT` by `scripts/setup-gev.sh`.
- **Files it touches:**
  - adds `src/future/` (the vendored engine) and `src/tools/queries/future.js` plus its test;
  - registers both tools in `src/tools/index.js`;
  - keeps them off the voice surface (`src/tools/surfaces.js`);
  - lists the new modules in `scripts/package-boundaries.json`;
  - adds the generated packs under `public/scene-assets/future/`.

If you change the engine:
```bash
node scripts/sync-engine.mjs && node scripts/write-scene.mjs
cd ../gods-eye-view && node --test src/tools/queries/future.test.mjs src/tools/*.test.mjs
git commit -am "..." && git format-patch <BASE_COMMIT>..HEAD -o ../macromedia-hackathon/gev-future-mode
```

GEV gotchas we hit:
- **Core-tool rule:** every core tool must be `kind: 'query'`, read-only, and `requires` at least one service. Our tools use `['app']`.
- **Package boundaries:** `npm run check:boundaries` takes about 2-4 minutes; new modules must be listed under `tools` in `scripts/package-boundaries.json`.
- **GeoJSON packs:** GEV ignores feature properties, so labels come from annotations (MCP links), not from packs. Packs are capped at 2,000 features and 8 per scene.
- **Scene import:** imports are previewed first and apply only after you click **Apply import**.

## Claude in charge (MCP)

| Tool | Input | Output |
|---|---|---|
| `simulate_future` | `policies` {energy, carbonPrice, adaptation, food, cooperation, tech} 0-100, or `let_ai_decide: true`; optional `runs`, `seed`, `rationale` | stats + best/likely/worst (final numbers, events, decade rows) + sources |
| `play_future` | `which`: best / likely / worst, `year` 2026-2076 | GEV link/panel with pins and labels, camera on that decade's defining event, one-line headline |

Good demo prompt: *"You are in charge of the world from 2026 to 2076 with 360 points. Choose the levers yourself, explain why in two sentences, run simulate_future, then walk me through the scariest future with play_future at 2036, 2056 and 2076."*

## The model, honestly

- **Anchors:** warming by 2076 is interpolated between SSP1-2.6 (1.8 °C), SSP2-4.5 (2.4 °C), SSP3-7.0 (2.9 °C) and SSP5-8.5 (3.3 °C), starting from 1.4 °C in 2026. Sea-level rise by 2076 runs from 0.26 to 0.41 m. Population follows UN WPP 2024 (8.2 → 10.25 bn). All are rounded approximations; see `engine/data.js`.
- **Policies → pathway:** energy carries 45%, carbon price 25%, cooperation 15% and tech 15%. Adaptation and food don't lower emissions; they reduce harm (displacement, heat deaths, crop failure).
- **Uncertainty:**
  - climate sensitivity varies per run as a log-normal with σ = 0.18;
  - year-to-year noise of ±0.05 °C;
  - nine event types with yearly odds that depend on warming and the levers (`engine/data.js`).
- **Score:** wellbeing − 12·(warming above 1.5) − 0.08·displaced (millions) − 0.15·deaths (millions).
- **What it is not:** a climate model or a prediction. It is a policy flight simulator whose anchors are real and whose mechanics are simple enough to read in one file. Say that on stage before a judge does.

## Pitch and video

- **Script:** [`docs/pitch-script.md`](docs/pitch-script.md), 1:56 spoken, one voice (Malek).
  - Built with the `pitch` skill: every figure is tied to a quote in `results/` or this README (`pitch/ai-runs-the-planet/facts.json`, checked by code).
  - Three zero-context test judges each retold who it's for, what's broken, what changes, and the proof.
- **Video:** [`docs/video-spec.md`](docs/video-spec.md) is a 2:00 screen recording of the live product, with the voice-over recorded on top. It covers the shot list per timecode, overlays, the recording steps and the pre-export checklist.
- **3-minute live pitch flow** (if we present on stage):
  1. **Hook:** "Most of you will be alive in 2076."
  2. **Let AI decide:** read its reasoning aloud.
  3. **Play** *Most likely*, then *Scariest*.
  4. **A judge takes the sliders** and runs their own mix; the comparison table decides.
  5. **Close:** "Possible futures, not predictions. A flight simulator for policy, built on God's Eye View, with Claude in the pilot seat."

## What's left for Nov 3

In priority order:
- [ ] **Record the demo video** with [`docs/video-spec.md`](docs/video-spec.md): takes A/B/C, then the voice-over, then the edit, keeping it under 2:00.
- [ ] **Malek approves the script.** If any number changes, change `scripts/results.mjs`/README first, then the ledger (`python3 <pitch>/ledger.py check ai-runs-the-planet`).
- [ ] **Submission:** form URL unknown yet. Check the Luma event page / organiser messages.
- [ ] Optional: Google Maps key in GEV for photoreal 3D (local `.env` only, never committed).
- [ ] Optional polish:
  - mobile layout of the fallback;
  - a "share this future" link;
  - a third button, "Claude decides", calling the Anthropic API from a tiny proxy. Not needed: the MCP route already shows Claude in charge.
- [ ] Nice to have: host the fallback on GitHub Pages for judges to try. **Ask Malek before publishing anything.**

## Picking this up with Claude Code

If Malek is out of credits, Sammy can continue in his own Claude Code. Paste this as the first message from the repo folder:

> Read README.md (all of it), docs/video-spec.md and docs/pitch-script.md. This is our Macromedia hackathon project, due Nov 3 18:30. Run `npm test`, start the fallback (`python3 -m http.server 5180 --bind 127.0.0.1`) and check it works. Then run `./scripts/setup-gev.sh` and start GEV with `npm run dev` in ../gods-eye-view. Then work through "What's left for Nov 3" in order. Don't change any figure in the pitch without regenerating `results/ai-vs-audience.md` and updating `pitch/ai-runs-the-planet/facts.json`. Don't publish, push to main or post anything without asking.

House rules:
- Work on a branch and open PRs into `main`.
- Never commit API keys or `.env` files.
- Keep the "possible futures, not predictions" wording wherever numbers appear.

## Credits and licences

- [God's Eye View](https://github.com/bilawalsidhu/gods-eye-view) by Bilawal Sidhu and contributors, MIT. Our patch is under MIT too.
- [CesiumJS](https://cesium.com/platform/cesiumjs/), Apache 2.0, with Natural Earth II imagery (public domain) in the fallback.
- IPCC AR6 WG1 (SPM) for warming and sea-level pathways; UN World Population Prospects 2024.
- Code in this repo: MIT (see `LICENSE`).
