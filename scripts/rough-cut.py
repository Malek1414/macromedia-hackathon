"""Rough cut v0 of the 2-minute video: the raw takes cut to the script's
timecodes, a temporary macOS voice reading each beat at its start time, and an
end card. A timing reference for the real voice-over (and a submittable
fallback). Needs ffmpeg, macOS `say`, Pillow. Usage: python3 scripts/rough-cut.py"""
import json, re, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / 'footage/take-A-fallback-raw.mp4'
B = ROOT / 'footage/take-B-gev-raw.mp4'
C = ROOT / 'footage/take-C-claude-raw.mp4'
# Take A2: the whole flow in one take with the motion pass (AI → audience → Claude), times from its marks.
A2 = ROOT / 'footage/take-A2-all-raw.mp4'
OUT = ROOT / 'footage/rough-cut-v0.mp4'
W, H, FPS = 1920, 1080, 30

# (source, start, end) in the raw takes, in order; times mapped from the contact sheets.
# Cold open (docs/video-spec.md): a 9.4 s hard-cut montage of free-licence clips
# (licences in docs/cold-open-sources.md) between two title cards, before take A's title
# screen. The clips are not committed; docs/cold-open-sources.md says where each comes from.
COLD = ROOT / 'footage/cold-open'
# (file, start in clip, seconds shown, grade); grade: dark = teal-and-red, warm = utopia, cool = AI/neutral
COLD_OPEN = [
    ('01-neon-city.mp4', 1.0, 1.0, 'dark'),
    ('02-solar-farm.mp4', 2.0, 0.9, 'warm'),
    ('03-robot-arm.mp4', 0.0, 0.8, 'cool'),
    ('04-flood.mp4', 5.0, 0.8, 'dark'),
    ('05-child.mp4', 2.0, 0.8, 'warm'),
    ('06-server-room.mp4', 3.0, 0.8, 'cool'),
    ('07-wildfire.mp4', 6.0, 0.7, 'dark'),
]
COLD_EARTH = ('08-earth.mp4', 5.0, 1.0, 'cool')
CARD1_S, CARD2_S, BLACK_S = 1.2, 1.2, 0.2   # first card, "I, Robot ..." card, black frames before the title screen
COLD_OPEN_S = CARD1_S + sum(c[2] for c in COLD_OPEN) + CARD2_S + COLD_EARTH[2] + BLACK_S   # 9.4
GRADES = {'dark': 'colorbalance=rs=-.12:bs=.14:rm=.10:bm=.06,eq=saturation=1.1:contrast=1.08',
          'warm': 'colorbalance=rs=.12:bs=-.12:rm=.08:bm=-.08,eq=saturation=1.1',
          'cool': 'eq=contrast=1.05'}

def opening(cold_s):
    """Hook and tried visuals up to 0:25 (beat 3), after the cold open."""
    rest = 25 - cold_s
    title = min(6.0, rest * 0.45)
    return [(A2, 0, title), (B, 7, 7 + rest - title)]

CUTS = [
    (A2, 8.0, 21.0),     # 0:25 thing: hand over, the AI tests futures, sliders glide, starved levers flagged
    (A2, 21.0, 38.0),    # 0:38 works: playback with banners, arcs, ripples, heat glows
    (A2, 41.8, 51.8),    # 0:55 proof: the AI's 2076 report (numbers count up)
    (A2, 110.9, 118.9),  #       Claude's own levers and reasoning
    (A2, 88.2, 94.2),    #       the audience's future ends
    (A2, 138.8, 145.8),  #       the three-way face-off (bars grow in)
    (B, 18, 40),         # 1:26 means: GEV plays the scariest future
    (A2, 139.0, 147.0),  # 1:48 ask: back on the face-off
]
END_CARD_S = 3.9   # the cut is capped at 119.9 s

def run(*cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)],
                         check=True, capture_output=True, text=True).stdout
    return float(out)

def proxy(src):
    """A 1080p/30 copy of a raw take, made once (and again only if the take changes), so rebuilds take seconds."""
    out = ROOT / 'footage/.proxy' / (src.stem + '-1080p30.mp4')
    if not out.exists() or out.stat().st_mtime < src.stat().st_mtime:
        out.parent.mkdir(parents=True, exist_ok=True)
        run('ffmpeg', '-y', '-i', str(src), '-an', '-vf',
            f'scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=0x020409,fps={FPS},setsar=1',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-g', str(FPS), '-pix_fmt', 'yuv420p', str(out))
    return out

def end_card(path):
    img = Image.new('RGB', (W, H), (2, 4, 9))
    d = ImageDraw.Draw(img)
    def font(size, bold=True):
        for f in ['/System/Library/Fonts/Supplemental/Arial Bold.ttf' if bold else '/System/Library/Fonts/Supplemental/Arial.ttf',
                  '/System/Library/Fonts/Helvetica.ttc']:
            try: return ImageFont.truetype(f, size)
            except OSError: pass
        return ImageFont.load_default()
    lines = [('AI Runs the Planet', font(96), (230, 237, 247)),
             ('Possible futures, not predictions.', font(40, False), (138, 151, 171)),
             ('Malek Hassan & Sammy · Macromedia X CODE Hackathon 2026', font(34, False), (90, 209, 255)),
             ('Built on God\'s Eye View (MIT) · CesiumJS · NASA GIBS · IPCC AR6 · UN WPP 2024', font(26, False), (138, 151, 171))]
    y = 360
    for text, f, color in lines:
        w = d.textlength(text, font=f)
        d.text(((W - w) / 2, y), text, font=f, fill=color)
        y += f.size + 40
    img.save(path)

def title_font(size):
    for f in ['/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/System/Library/Fonts/Helvetica.ttc']:
        try: return ImageFont.truetype(f, size)
        except OSError: pass
    return ImageFont.load_default()

def draw_tracked(d, text, font, y, fill=(255, 255, 255), strike=False, full_text=None):
    """Text with 0.05 em letter-spacing, centred as if full_text (default: text) were complete; optional strike-through."""
    gap = font.size * 0.05
    def width(t): return sum(d.textlength(ch, font=font) for ch in t) + gap * (len(t) - 1)
    total = width(full_text or text)
    x = W / 2 - total / 2
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill)
        x += d.textlength(ch, font=font) + gap
    if strike:
        ly = y + font.size * 0.62
        d.line([(W / 2 - total / 2 - 14, ly), (W / 2 + total / 2 + 14, ly)], fill=(255, 70, 70), width=8)

def card_frames(folder, lines, seconds):
    """Title card frames at FPS. lines: (text, size, y, from_s, until_s, mode); mode 'type' types the line on,
    'show' shows it, 'strike' shows it struck through."""
    for i in range(round(seconds * FPS)):
        t = i / FPS
        img = Image.new('RGB', (W, H), (0, 0, 0))
        d = ImageDraw.Draw(img)
        for text, size, y, a, b, mode in lines:
            if not (a <= t < b): continue
            f = title_font(size)
            if mode == 'type':
                draw_tracked(d, text[:max(1, int((t - a) * 38))], f, y, full_text=text)
            else:
                draw_tracked(d, text, f, y, strike=(mode == 'strike'))
        img.save(folder / f'f{i:04d}.png')

def cold_open_parts(tmp, cold_s, vf):
    """Cold open per the spec: card, 7 hard-cut clips with a 1.0x to 1.3x speed ramp, typed card, earth, 6 black frames."""
    need = [c[0] for c in COLD_OPEN] + [COLD_EARTH[0]]
    if not all((COLD / n).exists() for n in need):
        return placeholder_parts(tmp, cold_s), 0
    cover = f'scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1'
    enc = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p']
    def card_part(name, lines, seconds):
        folder = tmp / name
        folder.mkdir()
        card_frames(folder, lines, seconds)
        out = tmp / (name + '.mp4')
        run('ffmpeg', '-y', '-framerate', str(FPS), '-i', str(folder / 'f%04d.png'), *enc, str(out))
        return out
    parts = [card_part('card1', [("We've imagined this future for 100 years.", 62, 500, 0.15, 99, 'show')], CARD1_S)]
    for i, (name, ss, secs, grade) in enumerate(COLD_OPEN):
        speed = 1.0 + 0.3 * i / (len(COLD_OPEN) - 1)     # 1.0x to 1.3x as the montage builds
        part = tmp / f'cold{i}.mp4'
        run('ffmpeg', '-y', '-ss', str(ss), '-i', str(COLD / name), '-an', '-vf',
            f'{cover},{GRADES[grade]},setpts=PTS/{speed:.3f},fps={FPS}', '-t', str(secs), *enc, str(part))
        parts.append(part)
    line = "I, Robot. RoboCop. Elysium. Her."
    parts.append(card_part('card2', [(line, 56, 440, 0.0, 0.55, 'type'), (line, 56, 440, 0.55, 0.8, 'show'),
                                     (line, 56, 440, 0.8, 99, 'strike'), ("Fiction.", 92, 560, 0.9, 99, 'show')], CARD2_S))
    name, ss, secs, grade = COLD_EARTH
    earth = tmp / 'cold_earth.mp4'
    run('ffmpeg', '-y', '-ss', str(ss), '-i', str(COLD / name), '-an', '-vf', f'{cover},{GRADES[grade]},fps={FPS}',
        '-t', str(secs), *enc, str(earth))
    parts.append(earth)
    black = tmp / 'black.mp4'
    run('ffmpeg', '-y', '-f', 'lavfi', '-i', f'color=black:s={W}x{H}:r={FPS}', '-t', str(BLACK_S), *enc, str(black))
    parts.append(black)
    return parts, len(COLD_OPEN) + 1

def placeholder_parts(tmp, cold_s):
    img = Image.new('RGB', (W, H), (0, 0, 0))
    d = ImageDraw.Draw(img)
    f = title_font(64)
    for text, y in [(f'COLD OPEN · {cold_s:g} s', 470), ('clips go in footage/cold-open/', 560)]:
        w = d.textlength(text, font=f)
        d.text(((W - w) / 2, y), text, font=f, fill=(90, 209, 255) if y < 500 else (138, 151, 171))
    png = tmp / 'cold.png'
    img.save(png)
    part = tmp / 'cold.mp4'
    run('ffmpeg', '-y', '-loop', '1', '-t', str(cold_s), '-i', str(png), '-vf', f'fps={FPS},format=yuv420p',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', str(part))
    return [part]

# Sound. Music: footage/score.m4a, scored from Apple's "Epoch" Apple Loops (royalty-free in videos, see
# docs/cold-open-sources.md). Effects are synthesised here with ffmpeg (no third-party audio).
SCORE = ROOT / 'footage/score.m4a'
TOTAL_S = 119.9
MUSIC_DB = -9.6       # score is -14.4 LUFS as rendered; this brings it to about -24 LUFS
DUCK_DB = 8           # target reduction of the music while the voice speaks (checked with ebur128 in the PR)

# Effects: (kind, cut index, source time in that cut's take, lead seconds). The time is mapped to the cut's
# timeline from CUTS, so re-mapping a cut moves its effects. Banner times were read off a 2 fps sheet of take A2.
EFFECTS = [
    ('hit', 1, 24.0),      # green breakthrough banner in the playback
    ('whoosh', 1, 24.4),   # camera flight with arcs
    ('hit', 1, 37.4),      # MAJOR WAR banner
    ('rise', 2, 41.8),     # rise into the 2076 report, landing on its first frame
    ('hit', 2, 41.8),      # the report lands
    ('whoosh', 6, 18.0),   # GEV flies into the scariest future
    ('whoosh', 7, 139.0),  # back to the face-off
]
SFX_SRC = {
    # low sub hit: 45 Hz sine with a fast decay, plus a short noise thump
    'hit': "aevalsrc='0.9*sin(2*PI*45*t)*exp(-3.2*t)+0.25*random(0)*exp(-30*t)':d=1.6:s=48000,lowpass=f=220",
    # whoosh: pink noise swelling and fading, band-limited
    'whoosh': "anoisesrc=d=1.3:c=pink:r=48000,highpass=f=300,lowpass=f=5000,afade=t=in:d=0.7,afade=t=out:st=0.7:d=0.6,volume=1.4",
    # rise: a sweeping tone plus noise that grows for 2.5 s
    'rise': "aevalsrc='0.35*sin(2*PI*(110*t+90*t*t))+0.25*random(0)':d=2.5:s=48000,highpass=f=100,lowpass=f=6000,"
            "afade=t=in:d=2.4:curve=exp",
    # the cold open's long swell, 5.8 s, quieter
    'swell': "aevalsrc='0.22*sin(2*PI*(80*t+30*t*t))+0.12*random(0)':d=5.8:s=48000,lowpass=f=3000,afade=t=in:d=5.6:curve=exp",
}
SFX_LEN = {'hit': 1.6, 'whoosh': 1.3, 'rise': 2.5, 'swell': 5.8}

def effect_times(cold_s):
    """(kind, time in the cut) for every effect."""
    seg_start, t = {}, cold_s + (25 - cold_s)     # opening() fills the time up to 0:25
    for i, (src, a, b) in enumerate(CUTS):
        seg_start[i] = t
        t += b - a
    out = [('hit', 0.0), ('swell', CARD1_S)]
    for kind, i, take_t in EFFECTS:
        at = seg_start[i] + (take_t - CUTS[i][1])
        if kind == 'rise': at -= SFX_LEN['rise']
        if kind == 'whoosh': at -= 0.3
        out.append((kind, at))
    return out

def sfx(cold_s, first_input):
    """ffmpeg lavfi inputs and delay filters for the effects; returns (inputs, filters, count)."""
    inputs, filters = [], []
    times = effect_times(cold_s)
    for n, (kind, at) in enumerate(times):
        inputs += ['-f', 'lavfi', '-i', SFX_SRC[kind]]
        ms = max(0, int(at * 1000))
        filters.append(f'[{first_input + n}:a]aformat=sample_fmts=fltp:channel_layouts=mono,aresample=48000,adelay={ms}|{ms}[x{n}]')
    return inputs, filters, len(times)

def sound_filters(score_idx, sfx_filters, n_sfx):
    """Score at about -24 LUFS, ducked under the voice by sidechain compression, plus effects, then master to -14 LUFS."""
    f = list(sfx_filters)
    xs = ''.join(f'[x{n}]' for n in range(n_sfx))
    f.append(f'{xs}amix=inputs={n_sfx}:normalize=0,apad,atrim=0:{TOTAL_S}[fx]')
    f.append('[voice]asplit=2[v1][v2]')
    f.append(f'[{score_idx}:a]aresample=48000,aformat=channel_layouts=mono,volume={MUSIC_DB}dB,'
             f'asetpts=PTS-STARTPTS[mus]')
    # measured with ebur128 on the temporary voice: music -23.9 LUFS plain, -32.5 under the voice (about 8 dB)
    f.append('[mus][v1]sidechaincompress=threshold=0.05:ratio=3:attack=40:release=500:makeup=1[ducked]')
    f.append('[ducked][v2][fx]amix=inputs=3:normalize=0:duration=first,'
             # the 6 black frames before the title screen are silent
             f"volume=enable='between(t,{COLD_OPEN_S - BLACK_S:.2f},{COLD_OPEN_S:.2f})':volume=0,"
             'loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.8:level=0[master]')
    return f

def main():
    import sys
    cold_s = COLD_OPEN_S
    beats = json.loads((ROOT / 'pitch/ai-runs-the-planet/script.json').read_text())['beats']
    # Beat start times from the gated script (pitch.py script-md writes them).
    starts = {}
    for line in (ROOT / 'pitch/ai-runs-the-planet/script.md').read_text().splitlines():
        m = re.match(r'\| (\d+):(\d+) \| (B\d+) ', line)
        if m: starts[m.group(3)] = int(m.group(1)) * 60 + int(m.group(2))
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        vf = f'scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=0x020409,fps={FPS},setsar=1'
        parts, n_clips = cold_open_parts(tmp, cold_s, vf) if cold_s > 0 else ([], 0)
        proxies = {src: proxy(src) for src in {c[0] for c in opening(cold_s) + CUTS}}
        for i, (src, a, b) in enumerate(opening(cold_s) + CUTS):
            part = tmp / f'part{i}.mp4'
            run('ffmpeg', '-y', '-ss', str(a), '-to', str(b), '-i', str(proxies[src]), '-an',
                '-vf', 'setsar=1',
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', str(part))
            parts.append(part)
        card = tmp / 'card.png'
        end_card(card)
        cardmp4 = tmp / 'card.mp4'
        run('ffmpeg', '-y', '-loop', '1', '-t', str(END_CARD_S), '-i', str(card), '-vf', f'fps={FPS},format=yuv420p',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', str(cardmp4))
        parts.append(cardmp4)
        listfile = tmp / 'list.txt'
        listfile.write_text(''.join(f"file '{p}'\n" for p in parts))
        video = tmp / 'video.mp4'
        run('ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', str(listfile), '-vf', f'fps={FPS}',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', str(video))   # re-encode: the parts come from different sources and timebases

        # Temporary voice: each beat at its start time, sped up only if it would overrun the next beat.
        order = sorted(starts, key=starts.get)
        inputs, filters = [], []
        for n, beat in enumerate(beats):
            text = re.sub(r'\s*\[[A-Z]\d+(?:,\s*[A-Z]\d+)*\]', '', beat['say'])
            window = (starts[order[order.index(beat['id']) + 1]] if beat['id'] != order[-1] else 118) - starts[beat['id']] - 0.4
            aiff = tmp / f"{beat['id']}.aiff"
            rate = 172
            while True:
                run('say', '-v', 'Samantha', '-r', str(rate), '-o', str(aiff), text)
                if duration(aiff) <= window or rate > 240: break
                rate += 8
            inputs += ['-i', str(aiff)]
            ms = int(starts[beat['id']] * 1000)
            filters.append(f'[{n + 1}:a]adelay={ms}|{ms},aresample=48000[a{n}]')
        mix = ''.join(f'[a{n}]' for n in range(len(beats)))
        filters.append(f'{mix}amix=inputs={len(beats)}:normalize=0,apad,atrim=0:{TOTAL_S}[voice]')
        # Score + effects + ducking + master, see sound_filters().
        n_in = len(beats) + 1
        inputs += ['-i', str(SCORE)]
        score_idx = n_in
        sfx_inputs, sfx_filters, n_sfx = sfx(cold_s, n_in + 1)
        inputs += sfx_inputs
        filters += sound_filters(score_idx, sfx_filters, n_sfx)
        run('ffmpeg', '-y', '-i', str(video), *inputs, '-filter_complex', ';'.join(filters),
            '-map', '0:v', '-map', '[master]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', str(TOTAL_S), str(OUT))
    print(f'{OUT.relative_to(ROOT)}: {duration(OUT):.1f} s, cold open {cold_s:g} s '
          f'({n_clips} clips from footage/cold-open)' if n_clips else
          f'{OUT.relative_to(ROOT)}: {duration(OUT):.1f} s, cold open {cold_s:g} s (placeholder: add clips to footage/cold-open)')

if __name__ == '__main__':
    main()
