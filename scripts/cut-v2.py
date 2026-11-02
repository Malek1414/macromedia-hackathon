"""Video v2: no voice-over. The story is carried by short captions on the footage,
and God's Eye View gets most of the screen time. Every number in a caption is
read from the engine's results (results/ai-vs-audience.md), not typed by hand.

Usage: python3 scripts/cut-v2.py [--cold-open 15]
Needs ffmpeg, Pillow, and the takes in footage/ (gh release download rough-cut-v0 -D footage).
The GEV deep dive uses footage/take-D-gev-deep.mov when it exists, else take B as a stand-in.
"""
import re, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent

W, H, FPS = 1920, 1080, 30
F = ROOT / 'footage'
A2 = F / 'take-A2-all-raw.mp4'
B = F / 'take-B-gev-raw.mp4'
D = F / 'take-D-gev-deep.mov'
OUT = F / 'video-v2.mp4'

def run(*cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def duration(p):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(p)],
                                check=True, capture_output=True, text=True).stdout)

def facts():
    """The figures the captions quote, parsed from the results file."""
    md = (ROOT / 'results/ai-vs-audience.md').read_text()
    rows = {m.group(1): m.groups()[1:] for m in re.finditer(r'^\| (AI|Claude|Audience) \| ([\d.]+) °C \| (\d+)% \| (\d+)% \| (\d+)M \| (\d+)M \|', md, re.M)}
    def row(k):
        w, p2, tip, deaths, disp = rows[k]
        return {'warm': w, 'p2': p2, 'disp': disp}
    return {'ai': row('AI'), 'claude': row('Claude'), 'aud': row('Audience')}

def font(size, bold=True):
    for f in (['/System/Library/Fonts/Supplemental/Arial Bold.ttf'] if bold else []) + ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc']:
        try: return ImageFont.truetype(f, size)
        except OSError: pass
    return ImageFont.load_default()

BOX_W, BOX_TOP = 1620, 18          # letterbox: footage scaled to this width, this far from the top
BOX_H = round(BOX_W * H / W)       # 911; leaves a clean bar of about 150 px for the caption

def caption_png(path, text, kicker=None, accent=(90, 209, 255), boxed=False):
    """A caption: kicker in accent colour, then the line. Full-frame shots get a soft dark band;
    boxed (letterboxed) shots get the text in the clean bar under the footage."""
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    if not boxed:
        band = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(band).rectangle([0, H - 300, W, H], fill=(2, 4, 9, 170))
        img.alpha_composite(band.filter(ImageFilter.GaussianBlur(40)))
    d = ImageDraw.Draw(img)
    big, small = (font(44), font(22)) if boxed else (font(54), font(26))
    # wrap the line to at most 2 rows within 1500 px
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=big) > (BOX_W - 40 if boxed else 1500) and cur: lines.append(cur); cur = w
        else: cur = t
    lines.append(cur)
    step = big.size + 12
    if boxed:
        x0 = (W - BOX_W) // 2 + 8
        y = BOX_TOP + BOX_H + 22 + (34 if kicker else 0)
        if len(lines) > 1: y -= 10
    else:
        x0, y = 120, H - 110 - len(lines) * step
    if kicker:
        d.text((x0, y - 38 if boxed else y - 44), kicker.upper(), font=small, fill=accent + (255,))
    for line in lines:
        d.text((x0, y), line, font=big, fill=(240, 244, 250, 255))
        y += step
    img.save(path)

def card_png(path, lines):
    img = Image.new('RGB', (W, H), (2, 4, 9))
    d = ImageDraw.Draw(img)
    y = 380
    for text, size, color in lines:
        f = font(size, size >= 40)
        d.text(((W - d.textlength(text, font=f)) / 2, y), text, font=f, fill=color)
        y += size + 34
    img.save(path)

def proxy(src):
    out = F / '.proxy' / (src.stem + '-1080p30.mp4')
    if not out.exists() or out.stat().st_mtime < src.stat().st_mtime:
        out.parent.mkdir(parents=True, exist_ok=True)
        run('ffmpeg', '-y', '-i', str(src), '-an', '-vf',
            f'scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=0x020409,fps={FPS},setsar=1',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-g', str(FPS), '-pix_fmt', 'yuv420p', str(out))
    return out

def segment(tmp, n, src, a, b, cap=None, boxed=False):
    """A piece of a take, with an optional caption PNG faded in over it. Boxed: the
    footage shrinks into a letterbox so the caption never covers the app's controls."""
    out = tmp / f'seg{n:02d}.mp4'
    length = b - a
    frame = f'scale={BOX_W}:{BOX_H},pad={W}:{H}:(ow-iw)/2:{BOX_TOP}:color=0x020409' if boxed else 'null'
    if cap:
        run('ffmpeg', '-y', '-ss', str(a), '-t', f'{length:.3f}', '-i', str(proxy(src)), '-loop', '1', '-t', f'{length:.3f}', '-i', str(cap),
            '-filter_complex', f'[0]{frame}[v];[1]format=rgba,fade=t=in:st=0.15:d=0.45:alpha=1,fade=t=out:st={max(0.2, length - 0.4):.2f}:d=0.35:alpha=1[c];[v][c]overlay=0:0,format=yuv420p',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-r', str(FPS), str(out))
    else:
        run('ffmpeg', '-y', '-ss', str(a), '-t', f'{length:.3f}', '-i', str(proxy(src)), '-vf', 'format=yuv420p',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-r', str(FPS), str(out))
    return out

def still(tmp, n, png, secs):
    out = tmp / f'seg{n:02d}.mp4'
    run('ffmpeg', '-y', '-loop', '1', '-t', str(secs), '-i', str(png), '-vf', f'fps={FPS},format=yuv420p,fade=t=in:st=0:d=0.4',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', str(out))
    return out

def main():
    cold_s = 15.0
    if '--cold-open' in sys.argv:
        cold_s = max(0.0, min(20.0, float(sys.argv[sys.argv.index('--cold-open') + 1])))
    x = facts()
    deep = D if D.exists() else B
    # Deep-dive shot windows in take D (start, end). With take B as a stand-in, its playback is used instead.
    deep_shots = [(2, 9), (12, 24), (26, 38), (40, 50), (52, 60)] if D.exists() else [(0, 7), (12, 22), (22, 30), (30, 36), (36, 42)]
    GREEN, AMBER, RED, CYAN = (62, 224, 143), (255, 197, 61), (255, 77, 94), (90, 209, 255)

    plan = [
        ('cold', cold_s),
        (A2, 0.0, 4.0, None, None, None),
        (A2, 8.0, 16.0, 'We gave an AI the world\'s budget for the next 50 years.', 'The experiment', CYAN),
        (A2, 16.0, 22.0, 'It bet on clean energy and cooperation, and almost nothing on protecting coasts.', 'The AI\'s choice', AMBER),
        (A2, 22.0, 32.0, 'Then it played out 5,000 possible futures, year by year.', 'Monte Carlo', CYAN),
        (deep, *deep_shots[0], 'Today: every aircraft in the sky, live in God\'s Eye View.', '2026', CYAN),
        (deep, *deep_shots[1], 'In the scariest futures, a new pandemic reaches London. Live city cameras, in 3D.', '2056 · Scariest 5%', RED),
        (deep, *deep_shots[2], 'Most likely future: the sea is 28 cm higher. One hurricane surge, and Miami Beach is under water.', '2076 · Most likely', AMBER),
        (deep, *deep_shots[3], f'If people choose instead: {x["aud"]["warm"]} °C warmer. Los Angeles through a thermal camera.', '2076 · People-first future', RED),
        (deep, *deep_shots[4], 'And in the worst futures, war risk returns to the Taiwan Strait.', 'Scariest 5%', RED),
        (A2, 138.8, 145.8, f'AI: {x["ai"]["p2"]}% of futures stay under 2 °C, but {x["ai"]["disp"]}M people lose their homes to the sea.', 'Who ran it better?', CYAN),
        (A2, 140.0, 147.0, f'Claude: {x["claude"]["p2"]}% and {x["claude"]["disp"]}M.  People-first: {x["aud"]["p2"]}% and {x["aud"]["disp"]}M.', 'Who ran it better?', CYAN),
        (A2, 139.5, 146.5, 'Possible futures, not predictions. Your turn: try to beat the AI.', 'AI Runs the Planet', GREEN),
        ('end', 4.0),
    ]
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        parts = []
        for n, item in enumerate(plan):
            if item[0] == 'cold':
                clips = sorted(p for p in (F / 'cold-open').glob('*') if p.suffix.lower() in ('.mp4', '.mov', '.m4v')) if (F / 'cold-open').exists() else []
                if clips:
                    for k, c in enumerate(clips):
                        parts.append(segment(tmp, n * 10 + k, c, 0, item[1] / len(clips)))
                else:
                    card = tmp / 'cold.png'
                    card_png(card, [(f'COLD OPEN · {item[1]:g} s', 56, (90, 209, 255)), ('clips go in footage/cold-open/', 34, (138, 151, 171))])
                    parts.append(still(tmp, n, card, item[1]))
            elif item[0] == 'end':
                card = tmp / 'end.png'
                card_png(card, [('AI Runs the Planet', 96, (230, 237, 247)), ('Possible futures, not predictions.', 40, (138, 151, 171)),
                                ('Malek Hassan & Sammy · Macromedia X CODE Hackathon 2026', 34, (90, 209, 255)),
                                ('Built on God\'s Eye View · CesiumJS · NASA GIBS · IPCC AR6 · UN WPP 2024', 26, (138, 151, 171))])
                parts.append(still(tmp, n, card, item[1]))
            else:
                src, a, b, text, kicker, accent = item
                cap = None
                boxed = src == A2          # the app's own screens: letterbox; God's Eye View: full frame
                if text:
                    cap = tmp / f'cap{n:02d}.png'
                    caption_png(cap, text, kicker, accent, boxed)
                parts.append(segment(tmp, n, src, a, b, cap, boxed))
        lst = tmp / 'list.txt'
        lst.write_text(''.join(f"file '{p}'\n" for p in parts))
        run('ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', str(lst), '-c', 'copy', '-t', '119.9', str(OUT))
    print(f'{OUT.relative_to(ROOT)}: {duration(OUT):.1f} s; deep dive from {deep.name}')

if __name__ == '__main__':
    main()
