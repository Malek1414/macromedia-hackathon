# AI Runs the Planet (2026 → 2076)

What happens if we let an AI run the world for 50 years? It gets the same budget as humanity (360 points across six policy levers), tests every mix on thousands of Monte Carlo futures, and picks one. The globe then plays three of the futures: **best case** (top 5%), **most likely** (median) and **scariest** (worst 5%). Then the audience spends the same budget and we compare.

Possible futures, not predictions. Warming and sea level follow IPCC AR6 SSP pathways, population follows UN WPP 2024; events (pandemics, wars, tipping points, breakthroughs) and their effects are simplified.

## Parts
| Part | Where | What |
|---|---|---|
| Engine | `engine/` | Seeded simulation, Monte Carlo, AI optimizer, God's Eye View export. No dependencies. `npm test` (11 tests). |
| Fallback globe | `fallback/` | Keyless Cesium page: AI decides, audience decides, AI vs audience table. |
| God's Eye View fork | `../gods-eye-view` branch `future-mode` | MCP tools `simulate_future` + `play_future`, engine in `src/future/`, Director scenes. |

## Run
```bash
# Fallback (any Node/Python)
python3 -m http.server 5180 --bind 127.0.0.1    # in this folder
open http://127.0.0.1:5180/fallback/

# God's Eye View (Node 24)
cd ../gods-eye-view && nvm use 24 && npm run dev # http://localhost:4173
node ../ai-runs-the-planet/scripts/write-scene.mjs   # AI picks, writes scenes + packs
# GEV > AUTHORING > import out/ai-runs-the-planet.scenes.json > Apply import > pick a future > Play

# Claude in charge (already registered at user scope as "gods-eye-view")
# Ask Claude: "You run the world from 2026 to 2076. Use simulate_future, explain your levers,
#              then play_future the scariest future at 2046 and 2076."
```
After changing the engine: `node scripts/sync-engine.mjs` (copies it into GEV).
Photoreal 3D in GEV needs a Google Maps key (GEV > Power up); without it GEV uses Esri imagery.

## 3-minute pitch
1. **Hook (20 s):** "We keep asking whether AI should help run things. So we let it run the planet for 50 years."
2. **AI decides (40 s):** click *Let AI decide*. Sliders move. Read its reasoning. Punchline: it put almost nothing into coastal adaptation and everything into energy and cooperation.
3. **Three futures (60 s):** play *Most likely*, then *Scariest* on the globe. Show the histogram: 5,000 futures, where each one sits.
4. **Audience vs AI (40 s):** a judge sets the levers. Run. The comparison table decides who ran the world better.
5. **Close (20 s):** "It's not a prediction. It's a flight simulator for policy, built on God's Eye View, with Claude in the pilot seat."
