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
# Cold open: Malek's clips in footage/cold-open/ (any .mp4/.mov, played in file-name
# order, each trimmed to an equal share of the slot). Without clips, a placeholder card.
# The first beats' voice plays over it; the hook visuals shrink to make room.
COLD = ROOT / 'footage/cold-open'
COLD_OPEN_S = 15          # 10-20; override with --cold-open N

def opening(cold_s):
    """Hook and tried visuals for the 25 s before beat 3, after the cold open."""
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
END_CARD_S = 4

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

def cold_open_parts(tmp, cold_s, vf):
    clips = sorted(p for p in COLD.glob('*') if p.suffix.lower() in ('.mp4', '.mov', '.m4v', '.webm')) if COLD.exists() else []
    parts = []
    if clips:
        each = cold_s / len(clips)
        for i, clip in enumerate(clips):
            part = tmp / f'cold{i}.mp4'
            run('ffmpeg', '-y', '-ss', '0', '-t', f'{each:.3f}', '-i', str(clip), '-an', '-vf', vf,
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', str(part))
            parts.append(part)
        return parts, len(clips)
    img = Image.new('RGB', (W, H), (0, 0, 0))
    d = ImageDraw.Draw(img)
    try: f = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 64)
    except OSError: f = ImageFont.load_default()
    for text, y in [(f'COLD OPEN · {cold_s:g} s', 470), ('clips go in footage/cold-open/', 560)]:
        w = d.textlength(text, font=f)
        d.text(((W - w) / 2, y), text, font=f, fill=(90, 209, 255) if y < 500 else (138, 151, 171))
    png = tmp / 'cold.png'
    img.save(png)
    part = tmp / 'cold.mp4'
    run('ffmpeg', '-y', '-loop', '1', '-t', str(cold_s), '-i', str(png), '-vf', f'fps={FPS},format=yuv420p',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', str(part))
    return [part], 0

def main():
    import sys
    cold_s = COLD_OPEN_S
    if '--cold-open' in sys.argv:
        cold_s = float(sys.argv[sys.argv.index('--cold-open') + 1])
    cold_s = max(0.0, min(20.0, cold_s))
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
        run('ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', str(listfile), '-c', 'copy', str(video))

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
        filters.append(f'{mix}amix=inputs={len(beats)}:normalize=0,apad[aout]')
        run('ffmpeg', '-y', '-i', str(video), *inputs, '-filter_complex', ';'.join(filters),
            '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', '119.9', str(OUT))
    print(f'{OUT.relative_to(ROOT)}: {duration(OUT):.1f} s, cold open {cold_s:g} s '
          f'({n_clips} clips from footage/cold-open)' if n_clips else
          f'{OUT.relative_to(ROOT)}: {duration(OUT):.1f} s, cold open {cold_s:g} s (placeholder: add clips to footage/cold-open)')

if __name__ == '__main__':
    main()
