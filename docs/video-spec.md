# 2-minute demo video: design spec

**Format:** 2:00 max, 16:9, 1920×1080, 30 fps. A screen recording of the live product, with Malek's voice-over recorded on top afterwards. No face cam, no slides. The product is the visual.
**Script:** [`pitch-script.md`](pitch-script.md). The final, gated version (every number traces to `results/ai-vs-audience.md`) is in `pitch/ai-runs-the-planet/script.md`.
**Rule:** every number said is on screen at that moment, and the demo is recorded, never live on stage.

## Look

| | |
|---|---|
| Palette | the app's own: near-black `#05070b`, cyan `#5ad1ff`, green `#3ee08f` (best), amber `#ffc53d` (likely), red `#ff4d5e` (scariest) |
| Type for overlays | Inter 600 for words, JetBrains Mono for numbers (both already in the app) |
| Overlays | at most one at a time, lower third, 2-3 words or one number. They appear as the voice says them. |
| Motion | the globe's own camera flights only; no zoom/pan added in edit except the two proof zooms below |
| Sound | voice-over at -16 LUFS; quiet ambient bed at -32 LUFS, ducked under the voice; no music with lyrics |

## Shot list (timecodes match the script)

| Time | Beat | On screen | Source | Overlay |
|---|---|---|---|---|
| 0:00-0:14 | Hook | Fallback page, globe slowly spinning (it auto-rotates on load), HUD reads 2026 / 1.40 °C | fallback | "2026 → 2076" |
| 0:14-0:25 | Tried | GEV page with live flights layer on (it looks like the "now" world); slow drift over Europe | GEV `npm run dev` | "Opinions. No odds." |
| 0:25-0:42 | Thing | Back to fallback. Cursor over the six sliders, top to bottom, in step with the voice naming them. Budget bar at 360/360 | fallback | "360 points · 6 levers" |
| 0:42-1:00 | Works | Click **Let AI decide**, progress bar, sliders animate to the AI's pick, cards appear, playback starts and the camera flies to the first event (red pin + label) | fallback | "5,000 futures" when cards appear |
| 1:00-1:12 | Proof (AI) | Zoom 1: right panel stats, "Futures below 2 °C 92%". Then zoom 2: left panel, coastal adaptation slider at **1**. Then the timeline at 2076 on *Most likely*: amber coastal circles over Dhaka/Shanghai | fallback | "92% below 2 °C" → "Coastal: 1 point" → "31 million pushed out by the sea" |
| 1:12-1:24 | Proof (audience) | Click **Audience decides**, set the audience mix (energy 20, carbon 20, adaptation 100, food 100, cooperation 20, tech 100), Run; the AI vs audience table appears | fallback | "8 million" → "0% below 2 °C" |
| 1:24-1:46 | Means | God's Eye View playing the *Scariest* Director scene: camera flies decade to decade, pins and the "Simulated future, not a prediction" card visible | GEV Authoring → Play | "Possible futures, not predictions" |
| 1:46-1:56 | Ask | Fallback page, cursor hovering **Audience decides**, then the whole globe | fallback | "Beat the AI." |
| 1:56-2:00 | End card | Black, title + repo link + names | edit | "AI Runs the Planet · Malek Hassan & Sammy" |

## How to record (about 20 minutes)

1. **Prepare**
   - Chrome at 1920×1080: `window.resizeTo` or the DevTools device toolbar, set to "Responsive 1920×1080".
   - Turn on Do Not Disturb, hide the bookmarks bar, and set the zoom to 100%.
   - Start the fallback: `python3 -m http.server 5180 --bind 127.0.0.1` in this repo, then open `http://127.0.0.1:5180/fallback/`.
   - Start GEV: `cd ../gods-eye-view && npm run dev`. Then import `out/ai-runs-the-planet.scenes.json` in Authoring and apply it.
2. **Take A (fallback, 0:25-1:24 and 1:46-1:56):** one continuous take of the clicks in the shot list. The seed is fixed (2026), so the numbers come out the same on every take: 92%, coastal 1, 31 million, 8 million, 0%. Record with macOS Screenshot (⇧⌘5 → Record Selected Portion) or OBS at 30 fps.
3. **Take B (GEV, 0:14-0:25 and 1:24-1:46):**
   - First, GEV's live view with the flights layer on.
   - Then Authoring, select "AI Runs the Planet: Scariest", and Play.
4. **Take C (hook, 0:00-0:14):** reload the fallback and let the globe spin for 20 s without touching it.
5. **Voice-over:** read `pitch-script.md` one beat at a time.
   - Use a quiet room, a phone or USB mic 15 cm from your mouth, and the phone's voice memo app.
   - Leave a 1 s pause between beats, and redo any beat you stumble on.
   - The pitch skill's teleprompter can show the lines on your phone: `python3 "$S/prompter.py" build ai-runs-the-planet` then `serve`.
6. **Edit:**
   - Lay the voice-over down first, then cut the screen takes to it.
   - Speed up only the wait for the AI's choice (×2), not the globe flights.
   - Add the overlays from the table, then export H.264 at 1080p30 under 2:00.

## Checks before export

- [ ] Every number spoken is visible on screen at the time it's said (92%, 1 point, 31 million, 8 million, 0%, 360, 5,000).
- [ ] "Possible futures, not predictions" is both said and shown.
- [ ] No personal tabs, notifications or bookmarks visible; the GEV "Power up · keys waiting" button is out of frame or unclicked.
- [ ] Runtime ≤ 2:00; voice clear over the ambient bed.
- [ ] Credits: God's Eye View (MIT, Bilawal Sidhu), CesiumJS, IPCC AR6, UN WPP 2024 in the end card or the description.
