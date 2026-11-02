# Macromedia X CODE Hackathon: ideas

Nov 2-3, 2026 · Macromedia Campus Berlin, Mehringdamm 33 · Theme: "Reimagine the Future: how can we use AI, technology, and creativity to improve tomorrow's world?"
Prizes €500 / €100 / €50; top 5 considered for funding grants + LEXIE programme. Base for everything: God's Eye View (github.com/bilawalsidhu/gods-eye-view, MIT code, data has own licenses).

## Favourites
1. **Ground Truth (misinformation)**: paste a viral post; AI extracts what/where/when; live sensors (quakes, fires, weather, flights) check it on the globe. Verdict card: Confirmed real / Real but old or wrong place / Likely AI-made / Not enough evidence. Pitch: "Detectors guess. The planet doesn't lie."
   - Link layer (Insta/TikTok/X): fetch (yt-dlp; Instagram needs login, so upload fallback) -> Content Credentials (c2patool) + Instagram "AI info" label -> AI detector as a hint (Sightengine 2,000 free/month; Hive names the generator) -> reverse image search for recycled footage -> sensors -> place match.
   - Caveat: detectors alone often call real photos fake (NewsGuard, May 2026); stack evidence, never a bare fake/real.
2. **Place Match (standalone)**: render the claimed spot in photoreal 3D and let Claude compare skyline and landmarks with a photo or video frame. Works as a geolocation tool on its own.
3. **GitHub Planet**: public GitHub activity firing as neurons on the globe. Live feed is thin (~3k events/hour, ~1/sec), so show a day as a 60-second time-lapse. GH Archive ~3-5 MB/hour, laptop is enough.
4. **Live 360 God's Eye View**: stand anywhere on Earth in 360 (phone gyro / headset) with live planes, ships and satellites around you.
5. **Climate / disaster**: Future Street (city floods to its 2100 sea level, AI narrates; Hamburg or Alexandria, Berlin is too high) and a verified disaster explainer (Nepal flood scene is bundled).

## Also considered
- Earth's nervous system (sensors + Bluesky spikes firing together), Carbon Sky (flight emissions trails), Your Flight Cinematic, Claude's Brain on the globe, Wikipedia Planet.
- Datacenter site scout, Green compute map, Cable guard (Baltic), Dark ships, Sky-noise score, Port congestion index, Renewables prospector.
- Autopilot newsroom (live events -> cinematic clips), Intercept (live-data game), Wildfire evacuation co-pilot.
- Not for Macromedia: offshore decommissioning lead engine (with Sami, separate track).

## New ones (Nov 2)
- **Cool Route**: the shadiest walking route through Berlin on a heat day, from 3D-building shadows at that hour. Climate adaptation people feel.
- **Roof Sun**: click any roof, see its solar potential from real 3D shadows over a year.
  - Pitch angle, energy crisis: energy prices and import dependence make every roof a small power plant. Show a street's untapped kWh, the euros and CO2 per household, and how many homes a block could power.
  - Demo: fly to a Berlin block, sweep the sun through a year, roofs light up by yield, then "this street could cover X homes".
  - Caveat: shadow-based estimate, not a certified survey; check real figures (Berlin Solaratlas, PVGIS) before quoting numbers in the pitch.
- **Promise Checker**: a company or city claims "we replanted the forest"; recent satellite imagery before/after on the globe shows if it's true. Pairs with Ground Truth.
- **World for blind users**: voice-first God's Eye View that describes what's around and overhead wherever you stand.
- **AI Runs the Planet (2026-2076): BUILT (Nov 2), see ai-runs-the-planet/README.md**: what if AI were in charge of the world's future? AI picks the policies (energy, cities, food, migration); a Monte Carlo simulation runs thousands of 50-year futures over the uncertain drivers; the globe plays three of them as cinematic scenes, e.g. best case, most likely, and the scariest tail.
  - Make it credible: drive it with real projections (IPCC SSP climate scenarios, sea-level rise, UN population), not invented numbers; the AI only chooses the levers, the model decides the outcomes.
  - Show on the globe: coastlines moving, heat and fire zones growing or shrinking, flight and shipping traffic changing, cities greening; a timeline slider 2026 -> 2076 per scenario, plus a probability bar for how often each future came up.
  - Twist for the jury: the audience picks the policies live, the AI picks its own, and both futures play side by side.
  - Caveat: it's an illustrative model, so the pitch should say "possible futures", not predictions.
