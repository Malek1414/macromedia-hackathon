# Tasks for Sammy's Claude

Each task stands on its own: one branch, a few files to read, clear steps, and a check for done. Do them in order of priority. When a task is done, **push the branch and open a PR into `main`** (`gh pr create --fill`), with what you checked in the PR body. Malek merges.

**To keep tokens low:**
- Read only the files a task lists. `README.md` has the map; don't scan the repo.
- `fallback/app.js` is about 700 lines; open it with an offset and limit around the function you need (`grep -n "^function" fallback/app.js` lists them).
- Never open `footage/*.mp4`, `fallback/vendor/` or `gev-future-mode/*.patch`.
- To check visuals, take one screenshot, not many. For video, a contact sheet: `ffmpeg -i x.mp4 -vf "fps=1/5,scale=240:-1,tile=6x4" -frames:v 1 sheet.jpg`.
- Use Sonnet for these tasks (never Haiku).

**House rules:**
- Never commit keys or `.env`.
- Never commit video files; they go on a GitHub release.
- Don't publish anything (Pages, YouTube, the form) without Malek's yes.
- Keep "possible futures, not predictions" wherever numbers appear.
- Don't change any number in the pitch without regenerating `results/` and checking the ledger.

Setup once: `npm test`, `./scripts/vendor-cesium.sh`, `python3 scripts/serve.py` → http://127.0.0.1:5180/fallback/. The raw takes and the rough cut are on release `rough-cut-v0`: `gh release download rough-cut-v0 -D footage`.

---

## 1. Cold open footage (highest priority)
**Branch:** `sammy/cold-open` · **Read:** `docs/video-spec.md` (Cold open section), `scripts/rough-cut.py`

The video opens with 8-10 s of utopia vs dystopia (and AI vs no AI) shots under Malek's first line, before the title screen. **Only free-licence footage. No film or TV clips**: they get muted or blocked on YouTube, and Germany has no fair use for a mood montage.

1. Find 8-10 clips of 1-2 s each, alternating bright and dark:
   - sources: [Pexels videos](https://www.pexels.com/videos/), [Pixabay videos](https://pixabay.com/videos/), NASA ([images.nasa.gov](https://images.nasa.gov), public domain);
   - search for: "futuristic city", "neon city night", "robot", "drone swarm", "data center", "solar farm aerial", "flood city", "wildfire", "storm aerial", "earth from space", "crowd", "child looking at sky".
2. Download them to `footage/cold-open/` (not committed). Write `docs/cold-open-sources.md`: one line per clip with file name, page URL, author and licence.
3. In `scripts/rough-cut.py`:
   - add a `COLD_OPEN` list played before `CUTS`, trimming take A's title so the total stays ≤ 119.9 s;
   - add the title cards from the spec as Pillow-rendered PNG cards, the same way the end card is made.
4. Rebuild with `python3 scripts/rough-cut.py`. Make a contact sheet and check the shots alternate light/dark and match the cards.
5. Upload: `gh release upload rough-cut-v0 footage/rough-cut-v0.mp4 --clobber`.

**Done when:** the rough cut opens with the montage, it's still ≤ 2:00, and every clip has a licence line.

## 2. Music and sound
**Branch:** `sammy/sound` · **Read:** `scripts/rough-cut.py`

1. Find one music track:
   - cinematic, building, no vocals, about 2:00;
   - free licence: [Pixabay music](https://pixabay.com/music/) or the YouTube Audio Library (no attribution needed);
   - record its licence in `docs/cold-open-sources.md`.
2. Find 2-3 short effects, same sources: a whoosh for the camera flights, a low hit for each event banner, a rise into the 2076 report.
3. Mix in `rough-cut.py`:
   - music at about −24 LUFS, ducked about 8 dB under the voice (`sidechaincompress` or simple volume keyframes);
   - hits at the banner times;
   - final loudness about −14 LUFS (`loudnorm`).
4. Rebuild and upload as in task 1.

**Done when:** the voice is clearly on top all the way through, there's no clipping (max volume below −1 dB), and it's still ≤ 2:00.

## 3. Thumbnail and YouTube text
**Branch:** `sammy/thumbnail` · **Read:** `docs/pitch-script.md`

1. Make `docs/thumbnail.png` (1280×720):
   - background: a frame from take A (the night-side India shot or the three-way face-off);
   - text: "What if AI ran the planet?";
   - a small "2026 → 2076".
   Use Pillow; no new dependencies.
2. Write `docs/youtube.md`:
   - title (under 70 characters);
   - description: 3 lines, the repo link, credits (God's Eye View MIT, CesiumJS, NASA GIBS, IPCC AR6, UN WPP 2024, plus the music and footage licences from tasks 1-2), and "Possible futures, not predictions.";
   - tags.

**Done when:** the PNG is readable at phone size and the description credits every source.

## 4. Judge Q&A sheet
**Branch:** `sammy/qa` · **Read:** `README.md` ("The model, honestly"), `results/ai-vs-audience.md`, `results/claude-in-charge.txt`

Write `docs/judge-qa.md`: the 12 questions a judge is most likely to ask, each with a 2-3 sentence answer that only uses facts from those files. Cover:
- "Is this a prediction?"
- "Where's the AI?"
- "Why did the AI ignore coastal protection?"
- "Why does Claude choose differently?"
- "How do you know the numbers are right?"
- "What would you build next?"
- "Who would use this?"
- "How is this different from climate games?"

**Done when:** every number in the answers appears in `results/` or the README.

## 5. QA on Safari and a phone
**Branch:** `sammy/qa-fixes` · **Read:** only what a bug points to

1. Open the page in Safari and on a real phone, on the same Wi-Fi: `python3 scripts/serve.py`, but bind to `0.0.0.0` temporarily. Don't commit that change.
2. Click through: title → Hand over → playback → report → Try to beat the AI → set levers → Run → report → See what Claude would do → report.
3. Also try `?offline`.
4. List the bugs in the PR body, and fix only the small ones (CSS, a guard). Leave anything big for Malek.

**Done when:** the full flow works in Safari and on the phone, or the PR lists exactly what doesn't.

## 6. Claude's future in God's Eye View
**Branch:** `sammy/gev-claude` · **Read:** `scripts/write-scene.mjs`, README "God's Eye View fork"

1. Set up GEV: `./scripts/setup-gev.sh`, then `cd ../gods-eye-view && npm run dev`.
2. Write the scenes for Claude's own policies:
   `node scripts/write-scene.mjs --policies '{"energy":80,"carbonPrice":70,"adaptation":50,"food":30,"cooperation":60,"tech":70}'`
   Rename the output to `out/claude.scenes.json`; it writes over the AI's file, so run the default again afterwards.
3. Import it in GEV (AUTHORING → import → Apply import) and play "Most likely".
4. Screen-record 40 s (macOS ⇧⌘5) as `footage/take-D-gev-claude-raw.mp4`, and upload it to the release.

**Done when:** the take shows Claude's future playing in GEV, and the steps are added to the README run section.

## 7. Hosting, prepared but not published
**Branch:** `sammy/pages` · **Read:** `fallback/index.html`

Prepare a `docs/hosting.md` plan to host `fallback/` and `engine/` as a static site. GitHub Pages needs the repo public or a paid plan, so also cover Netlify Drop and Vercel as options. Test it locally: copy both folders into one directory and serve that.

**Don't publish.** Malek decides.

**Done when:** `docs/hosting.md` has exact steps for each option, and the local static copy works.
