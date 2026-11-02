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
| 0:00-0:14 | Hook | Title screen "What if AI ran the planet?" over the turning globe, then today's planet in God's Eye View | take A 0-7, take B 0-7 | (the title is the overlay) |
| 0:14-0:25 | Tried | God's Eye View, today's world, slow drift | take B 7-18 | "Opinions. No odds." |
| 0:25-0:38 | Thing | **Hand over the planet** → "AI is testing futures…" → sliders glide to energy 100, cooperation 99, tech 84, carbon 69; food 4 and coastal 1 turn red "ALMOST NOTHING"; the AI's reasoning on top | take A 7-20 | "360 points · 6 levers" |
| 0:38-0:55 | Works | Three future cards; playback with event banners, shockwaves, heat zones, flooded coasts | take A 20-37 | "5,000 futures" |
| 0:55-1:26 | Proof | AI's 2076 report (92% below 2 °C, coastal 1, 31M flooded out) → Claude's tab with its own levers and quoted reasoning → the audience's future ending → the **three-way face-off** (AI · Claude · Audience) | take A 37.6-47.6, take C 0-8, take A 76.4-82.4, take C 26.8-33.8 | "92% below 2 °C" → "Coastal: 1 point" → "31 million" → "Claude: 26%, 18 million" → "Audience: 8 million, 0%" |
| 1:26-1:48 | Means | God's Eye View playing the *Scariest* Director scene | take B 18-40 | "Possible futures, not predictions" |
| 1:48-1:56 | Ask | The face-off, cursor on **Try to beat both** | take C 25.8-33.8 | "Beat the AI." |
| 1:56-2:00 | End card | Title, names, credits | rough-cut.py | |

The raw takes and a rough cut with a temporary voice are on the GitHub release `rough-cut-v0`; `python3 scripts/rough-cut.py` rebuilds the cut from `footage/` with these exact in/out points.

## How to record (about 20 minutes)

1. **Prepare**
   - Chrome at 1920×1080: `window.resizeTo` or the DevTools device toolbar, set to "Responsive 1920×1080".
   - Turn on Do Not Disturb, hide the bookmarks bar, and set the zoom to 100%.
   - Start the fallback: `python3 -m http.server 5180 --bind 127.0.0.1` in this repo, then open `http://127.0.0.1:5180/fallback/`.
   - Start GEV: `cd ../gods-eye-view && npm run dev`. Then import `out/ai-runs-the-planet.scenes.json` in Authoring and apply it.
2. **Take A (fallback, 0:00-0:14 and 0:25-1:24 and 1:46-1:56):** reload, let the title screen sit for 15 s, then one continuous take of the clicks in the shot list (each playback runs about 25 s to the report; cut the middle in the edit). The seed is fixed (2026), so the numbers come out the same on every take: 92%, coastal 1, 31 million, 8 million, 0%. Record with macOS Screenshot (⇧⌘5 → Record Selected Portion) or OBS at 30 fps.
3. **Take B (GEV, 0:14-0:25 and 1:24-1:46):**
   - First, GEV's live view with the flights layer on.
   - Then Authoring, select "AI Runs the Planet: Scariest", and Play.
4. **Voice-over:** read `pitch-script.md` one beat at a time.
   - Use a quiet room, a phone or USB mic 15 cm from your mouth, and the phone's voice memo app.
   - Leave a 1 s pause between beats, and redo any beat you stumble on.
   - The pitch skill's teleprompter can show the lines on your phone: `python3 "$S/prompter.py" build ai-runs-the-planet` then `serve`.
5. **Edit:**
   - Lay the voice-over down first, then cut the screen takes to it.
   - Speed up only the wait for the AI's choice (×2), not the globe flights.
   - Add the overlays from the table, then export H.264 at 1080p30 under 2:00.

## Checks before export

- [ ] Every number spoken is visible on screen at the time it's said (92%, 1 point, 31 million, 8 million, 0%, 360, 5,000).
- [ ] "Possible futures, not predictions" is both said and shown.
- [ ] No personal tabs, notifications or bookmarks visible; the GEV "Power up · keys waiting" button is out of frame or unclicked.
- [ ] Runtime ≤ 2:00; voice clear over the ambient bed.
- [ ] Credits: God's Eye View (MIT, Bilawal Sidhu), CesiumJS, IPCC AR6, UN WPP 2024 in the end card or the description.
