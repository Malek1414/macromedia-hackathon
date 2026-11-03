# Cold open: sources and licences

Not committed. The clips go in `footage/cold-open/` (git-ignored `*.mp4`); `python3 scripts/rough-cut.py` uses them.
All clips are from Mixkit under the [Mixkit Free Video License](https://mixkit.co/license/#videoFree): free for commercial and non-commercial use, no attribution required. Mixkit does not name the individual contributor on the clip pages, so the author is "Mixkit". No film or TV clips. Direct file: `https://assets.mixkit.co/videos/<id>/<id>-720.mp4`.

| File | Page | Author | Licence |
|---|---|---|---|
| `01-neon-city.mp4` | https://mixkit.co/free-stock-video/aerial-view-of-the-nightlife-of-a-huge-city-42041/ | Mixkit | Mixkit Free Video License |
| `02-solar-farm.mp4` | https://mixkit.co/free-stock-video/aerial-shot-of-a-field-of-solar-panels-in-a-32448/ | Mixkit | Mixkit Free Video License |
| `03-robot-arm.mp4` | https://mixkit.co/free-stock-video/robotic-arm-in-a-factory-20970/ | Mixkit | Mixkit Free Video License |
| `04-flood.mp4` | https://mixkit.co/free-stock-video/aerial-shot-over-floodlands-7835/ | Mixkit | Mixkit Free Video License |
| `05-child.mp4` | https://mixkit.co/free-stock-video/blonde-child-looking-around-7826/ | Mixkit | Mixkit Free Video License |
| `06-server-room.mp4` | https://mixkit.co/free-stock-video/bluish-data-center-hallway-23282/ | Mixkit | Mixkit Free Video License |
| `07-wildfire.mp4` | https://mixkit.co/free-stock-video/fire-burning-on-the-forest-11028/ | Mixkit | Mixkit Free Video License |
| `08-earth.mp4` | https://mixkit.co/free-stock-video/earth-rotating-below-as-seen-from-space-45036/ | Mixkit | Mixkit Free Video License |

Shot order, timing, speed ramp and colour grade are in `COLD_OPEN` in `scripts/rough-cut.py`. Title cards use Arial Bold (Inter is not installed on the build machine); swap `title_font` if Inter is wanted.

## Music and sound

| What | Source | Author | Licence |
|---|---|---|---|
| `footage/score.m4a` (committed) | Arranged by `scripts/score.py` from Apple's "Epoch" loop family (Apple Loops, `/Library/Audio/Apple Loops/Apple/01 Hip Hop`) | Apple, arranged by Malek | Apple Loops: royalty-free for use in your own productions and videos, no attribution needed |
| Sub hits, whooshes, risers, cold-open swell | Synthesised in `scripts/rough-cut.py` (`SFX_SRC`) with ffmpeg `aevalsrc`/`anoisesrc` | generated, no third-party audio | none needed |

The temporary computer voice is macOS `say` (Samantha) and is replaced by the real voice-over.
