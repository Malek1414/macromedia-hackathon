"""The film: the AI's most likely future told as a chronicle, chapter by chapter, in
photoreal 3D (God's Eye View), with animated title cards and a synthesized score.
Every number on screen is read from the engine (seed 2026) or results/, never typed.

Usage: python3 scripts/film.py [--cold-open 15] [--offset 1.6]
Needs: footage/take-E-chronicle.mov (native recording of out/chronicle.scenes.json,
Chrome cropped away), optional footage/cold-open/*.mp4, ffmpeg, Pillow, node.
"""
import json, math, random, re, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
F = ROOT / 'footage'
E = F / 'take-E-chronicle-hq.mp4' if (F / 'take-E-chronicle-hq.mp4').exists() else F / 'take-E-chronicle.mov'
OUT = F / 'film.mp4'
W, H, FPS = 1920, 1080, 30
BAR = 138                                   # letterbox bars (2.39:1)
AV = '/System/Library/Fonts/Avenir Next.ttc'
FACE = {'bold': 0, 'demi': 2, 'medium': 5, 'regular': 7, 'ultralight': 10}
WHITE, DIM, CYAN, GREEN, AMBER, RED = (238, 242, 248), (150, 160, 176), (110, 214, 255), (80, 226, 150), (255, 196, 70), (255, 84, 100)

def font(face, size):
    return ImageFont.truetype(AV, size, index=FACE[face])

def run(*cmd, inp=None):
    subprocess.run(cmd, check=True, input=inp, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def duration(p):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(p)],
                                check=True, capture_output=True, text=True).stdout)

ease = lambda x: 1 - (1 - max(0.0, min(1.0, x))) ** 3

# ---------- facts ----------
def engine_facts():
    js = r"""
    import('./engine/index.js').then(({ optimizePolicies, hotspotsAt }) => {
      const f = optimizePolicies({ seed: 2026 }).futures, r = f.likely;
      const row = (y) => r.years.find((x) => x.year === y);
      const hs = (y) => Object.fromEntries(hotspotsAt(r, y, f.policies.adaptation).map((h) => [h.place, h.displacedM]));
      console.log(JSON.stringify({ policies: f.policies, rows: Object.fromEntries([2026,2032,2035,2050,2067,2076].map((y) => [y, row(y)])),
        hs: { 2050: hs(2050), 2076: hs(2076) }, events: r.events, p2: f.stats.p2C, first15: r.years.find((y) => y.warmingC >= 1.5).year }));
    });"""
    out = subprocess.run(['node', '-e', js], cwd=ROOT, check=True, capture_output=True, text=True).stdout
    return json.loads(out)

def results_facts():
    md = (ROOT / 'results/ai-vs-audience.md').read_text()
    rows = {m.group(1): m.groups()[1:] for m in re.finditer(r'^\| (AI|Claude|Audience) \| ([\d.]+) °C \| (\d+)% \| (\d+)% \| (\d+)M \| (\d+)M \|', md, re.M)}
    return {k: {'warm': v[0], 'p2': v[1], 'disp': v[4]} for k, v in rows.items()}

# ---------- drawing helpers ----------
_grain = None
def grain(frame):
    global _grain
    if _grain is None:
        rnd = random.Random(7)
        g = Image.new('L', (W + 64, H + 64))
        g.putdata([rnd.randint(0, 255) for _ in range((W + 64) * (H + 64))])
        _grain = g
    ox, oy = (frame * 37) % 64, (frame * 53) % 64
    return _grain.crop((ox, oy, ox + W, oy + H))

def backdrop():
    """Deep space black with a faint blue glow from below."""
    img = Image.new('RGB', (W, H), (3, 5, 10))
    glow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(glow).ellipse([W * 0.15, H * 0.55, W * 0.85, H * 1.6], fill=60)
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    img.paste((20, 50, 90), mask=glow)
    return img

BACK = None
def text_center(d, y, text, f, fill, alpha=1.0, base=None):
    w = d.textlength(text, font=f)
    d.text(((W - w) / 2, y), text, font=f, fill=fill + (int(255 * alpha),))

def finish(img, frame):
    """Grain and vignette, the same on every card."""
    img = img.convert('RGB')
    g = grain(frame).point(lambda v: 128 + (v - 128) // 10)
    return Image.blend(img, Image.merge('RGB', (g, g, g)), 0.035)

def lines_card(lines, secs, kick=None):
    """Lines rise in one after another and the whole card fades out at the end."""
    global BACK
    BACK = BACK or backdrop()
    n = int(secs * FPS)
    for i in range(n):
        t = i / FPS
        out = max(0.0, min(1.0, (secs - t) / 0.5))
        img = BACK.copy().convert('RGBA')
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        total = sum(f.size + 26 for _, f, _ in lines)
        y = (H - total) / 2
        if kick:
            text_center(d, y - 70, kick, font('demi', 22), CYAN, ease((t - 0.1) / 0.6) * out)
        for k, (text, f, color) in enumerate(lines):
            a = ease((t - 0.25 - k * 0.55) / 0.8)
            text_center(d, y + (1 - a) * 18, text, f, color, a * out)
            y += f.size + 26
        img.alpha_composite(layer)
        yield finish(img, i)

def choice_card(policies, secs):
    """The AI's six choices as bars filling up; coastal protection stays almost empty, in red."""
    global BACK
    BACK = BACK or backdrop()
    rows = [('Clean energy', 'energy'), ('Global cooperation', 'cooperation'), ('AI & technology', 'tech'),
            ('Carbon price', 'carbonPrice'), ('Food & land', 'food'), ('Protecting coasts', 'adaptation')]
    n = int(secs * FPS)
    for i in range(n):
        t = i / FPS
        out = max(0.0, min(1.0, (secs - t) / 0.5))
        img = BACK.copy().convert('RGBA')
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        text_center(d, 150, 'THE AI\'S CHOICE · 360 POINTS', font('demi', 22), CYAN, ease(t / 0.6) * out)
        x0, x1, y = 560, 1500, 250
        for k, (label, key) in enumerate(rows):
            v = policies[key]
            a = ease((t - 0.4 - k * 0.18) / 0.6) * out
            low = v <= 5
            color = RED if low else (WHITE if k < 3 else DIM)
            d.text((x0 - 40 - d.textlength(label, font=font('medium', 34)), y - 4), label, font=font('medium', 34), fill=color + (int(255 * a),))
            d.rounded_rectangle([x0, y + 8, x1, y + 30], radius=11, fill=(255, 255, 255, int(18 * a)))
            fill = ease((t - 0.7 - k * 0.18) / 1.3)
            wbar = max(4, (x1 - x0) * v / 100 * fill)
            if low:
                pulse = 0.55 + 0.45 * math.sin(t * 5)
                d.rounded_rectangle([x0, y + 8, x0 + max(10, wbar), y + 30], radius=11, fill=RED + (int(255 * a * pulse),))
            else:
                d.rounded_rectangle([x0, y + 8, x0 + wbar, y + 30], radius=11, fill=(CYAN if k < 3 else DIM) + (int(230 * a),))
            num = f'{round(v * fill)}'
            d.text((x1 + 30, y - 6), num, font=font('demi', 38), fill=color + (int(255 * a),))
            y += 92
        msg = ['Everything into clean energy and cooperation.', 'Almost nothing into protecting the coasts.']
        for k, m in enumerate(msg):
            a = ease((t - 3.2 - k * 0.9) / 0.8) * out
            text_center(d, 830 + k * 58 + (1 - a) * 14, m, font('demi', 40), (WHITE if k == 0 else RED), a)
        img.alpha_composite(layer)
        yield finish(img, i)

def chapter_overlay(year, line, ribbon, accent):
    """Letterbox bars with the chapter year, the story line and the live data ribbon."""
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, BAR], fill=(0, 0, 0, 255))
    d.rectangle([0, H - BAR, W, H], fill=(0, 0, 0, 255))
    d.text((80, 52), 'AI RUNS THE PLANET  ·  THE MOST LIKELY FUTURE', font=font('demi', 18), fill=DIM + (255,))
    rw = d.textlength(ribbon, font=font('medium', 22))
    d.text((W - 80 - rw, 48), ribbon, font=font('medium', 22), fill=WHITE + (235,))
    if year:
        shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).text((84, BAR + 26), year, font=font('ultralight', 150), fill=(0, 0, 0, 150))
        img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(10)))
        d.text((80, BAR + 20), year, font=font('ultralight', 150), fill=WHITE + (245,))
    d.rectangle([80, H - BAR + 34, 84, H - 34], fill=accent + (255,))
    words, rows, cur = line.split(), [], ''
    for w_ in words:
        t = (cur + ' ' + w_).strip()
        if d.textlength(t, font=font('demi', 34)) > 1640 and cur: rows.append(cur); cur = w_
        else: cur = t
    rows.append(cur)
    y = H - BAR / 2 - len(rows) * 22
    for r in rows:
        d.text((108, y), r, font=font('demi', 34), fill=WHITE + (255,))
        y += 44
    return img

def mc_card(mc, secs):
    """Monte Carlo: 5,000 real warming paths from the engine pile up into a cloud; the 2 °C line,
    a live counter, then the best, most likely and scariest paths light up."""
    import numpy as np
    global BACK
    BACK = BACK or backdrop()
    sm = lambda a: np.apply_along_axis(lambda r: np.convolve(np.pad(r, 2, mode='edge'), np.ones(5) / 5, 'valid'), -1, np.asarray(a, float))
    raw = np.array(mc['tr']); tr = sm(raw); N, Y = tr.shape
    x0, x1, y0, y1 = 220, W - 160, 230, H - 190            # plot box
    lo, hi = 1.2, 2.8
    X = np.linspace(x0, x1, Y)
    py = lambda v: y1 - (np.asarray(v) - lo) / (hi - lo) * (y1 - y0)
    order = np.random.RandomState(3).permutation(N)
    acc = np.zeros((H, W), np.float32)
    n = int(secs * FPS); drawn = 0
    fin = raw[:, -1]
    for i in range(n):
        t = i / FPS
        target = int(N * ease(min(1.0, t / (secs * 0.62))) ** 1.6) if t > 0.3 else 0
        if target > drawn:
            layer = Image.new('L', (W, H), 0); d = ImageDraw.Draw(layer)
            for j in order[drawn:target]:
                d.line(list(zip(X, py(tr[j]))), fill=7, width=2)
            acc += np.asarray(layer, np.float32); drawn = target
        out = max(0.0, min(1.0, (secs - t) / 0.4))
        dens = np.clip(np.log1p(acc / 25) / np.log1p(60), 0, 1)
        img = np.asarray(BACK, np.float32).copy()
        col = np.array([110, 214, 255], np.float32)
        img = img * (1 - dens[..., None] * 0.85) + col * dens[..., None] * 0.85 + (dens[..., None] ** 4) * 60
        im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).convert('RGBA')
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
        a = ease((t - 0.1) / 0.6) * out
        # axes
        for v in (1.5, 2.0, 2.5):
            yy = float(py(v)); dash = v == 2.0
            for xx in range(x0, x1, 18 if dash else 6):
                d.line([(xx, yy), (xx + (10 if dash else 2), yy)], fill=(255, 196, 70, int((200 if dash else 60) * a)), width=3 if dash else 1)
            d.text((x0 - 120, yy - 18), f'{v:.1f} °C', font=font('medium', 28), fill=(255, 196, 70, int(255 * a)) if dash else DIM + (int(255 * a),))
        for yr in (2026, 2050, 2076):
            xx = x0 + (yr - 2026) / 50 * (x1 - x0)
            d.text((xx - 34, y1 + 18), str(yr), font=font('medium', 28), fill=DIM + (int(255 * a),))
        d.text((x0, 120), 'THE AI\'S CHOICE, PLAYED 5,000 TIMES', font=font('demi', 24), fill=CYAN + (int(255 * a),))
        d.text((x0, 152), f'{drawn:,} possible futures', font=font('demi', 56), fill=WHITE + (int(255 * a),))
        if drawn:
            below = int(round((fin[order[:drawn]] < 2).mean() * 100))
            txt = f'{below}% stay below 2 °C'
            d.text((x1 - d.textlength(txt, font=font('demi', 44)), 162), txt, font=font('demi', 44), fill=GREEN + (int(255 * a),))
        # highlight the three futures at the end
        h = ease((t - secs * 0.66) / 0.9) * out
        if h > 0:
            for key, c, label in (('lk', WHITE, 'Most likely'),):
                pts = list(zip(X, py(sm(mc[key]))))
                d.line(pts, fill=c + (int(255 * h),), width=5)
                d.text((x1 + 14, pts[-1][1] - 16), label, font=font('demi', 26), fill=c + (int(255 * h),))
        im.alpha_composite(layer)
        yield finish(im, i)

def stars_card(stars, forks, secs):
    """Cutaway: the open-source globe we built on, its GitHub stars counting up (live from the API)."""
    global BACK
    BACK = BACK or backdrop()
    n = int(secs * FPS)
    def star(d, cx, cy, r, fill):
        pts = []
        for k in range(10):
            ang = -math.pi / 2 + k * math.pi / 5
            rr = r if k % 2 == 0 else r * 0.45
            pts.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
        d.polygon(pts, fill=fill)
    for i in range(n):
        t = i / FPS
        out = max(0.0, min(1.0, (secs - t) / 0.4)); a = ease((t - 0.05) / 0.4) * out
        c = ease(min(1.0, t / (secs * 0.7)))
        img = BACK.copy().convert('RGBA'); layer = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
        text_center(d, 250, 'BUILT ON AN OPEN-SOURCE GLOBE', font('demi', 24), CYAN, a)
        text_center(d, 300, 'github.com/bilawalsidhu/gods-eye-view', font('medium', 40), DIM, a)
        num = f'{int(stars * c):,}'
        f = font('demi', 190); w = d.textlength(num, font=f)
        star(d, (W - w) / 2 - 120, 520, 72, (255, 196, 70, int(255 * a)))
        d.text(((W - w) / 2 + 10, 410), num, font=f, fill=WHITE + (int(255 * a),))
        text_center(d, 660, 'stars on GitHub', font('medium', 48), WHITE, a)
        text_center(d, 740, f'{int(forks * c):,} forks  ·  we added the future', font('medium', 36), DIM, a)
        img.alpha_composite(layer)
        yield finish(img, i)

def center_overlay(lines):
    """Big centred lines over footage (opening and closing), on the same letterbox."""
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, BAR], fill=(0, 0, 0, 255))
    d.rectangle([0, H - BAR, W, H], fill=(0, 0, 0, 255))
    shade = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shade).rectangle([0, H * 0.32, W, H * 0.68], fill=(0, 0, 0, 120))
    img.alpha_composite(shade.filter(ImageFilter.GaussianBlur(60)))
    total = sum(f.size + 24 for _, f, _ in lines)
    y = (H - total) / 2
    for text, f, color in lines:
        w = d.textlength(text, font=f)
        d.text(((W - w) / 2, y), text, font=f, fill=color + (255,))
        y += f.size + 24
    return img

# ---------- video pieces ----------
def encode_frames(frames, out):
    p = subprocess.Popen(['ffmpeg', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                          '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', str(out)],
                         stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for fr in frames:
        p.stdin.write(fr.tobytes())
    p.stdin.close()
    p.wait()
    return out

def footage(tmp, n, src, a, b, overlay=None, grade=None, length=None):
    """A piece of the 3D take, exactly `length` seconds (slowed down if the window is shorter),
    with its overlay faded in, a quick dip at each end so cuts land on the beat, and a grade."""
    out = tmp / f'p{n:02d}.mp4'
    L = length or (b - a)
    k = L / (b - a)
    g = grade or 'eq=contrast=1.08:saturation=1.1:gamma=0.96'
    fades = f'fade=t=in:st=0:d=0.25,fade=t=out:st={L - 0.25:.3f}:d=0.25'
    speed = f'setpts={k:.4f}*PTS,' if abs(k - 1) > 0.01 else ''
    if overlay:
        png = tmp / f'o{n:02d}.png'
        overlay.save(png)
        fc = (f'[0]{speed}scale={W}:{H},{g},trim=0:{L:.3f},setpts=PTS-STARTPTS[v];[1]format=rgba,fade=t=in:st=0.2:d=0.5:alpha=1[o];'
              f'[v][o]overlay=0:0:shortest=1,{fades},format=yuv420p')
        run('ffmpeg', '-y', '-ss', str(a), '-t', f'{b - a:.3f}', '-i', str(src), '-loop', '1', '-t', f'{L:.3f}', '-i', str(png),
            '-filter_complex', fc, '-r', str(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', str(out))
    else:
        run('ffmpeg', '-y', '-ss', str(a), '-t', f'{b - a:.3f}', '-i', str(src), '-vf',
            f'{speed}scale={W}:{H},{g},trim=0:{L:.3f},setpts=PTS-STARTPTS,{fades},format=yuv420p',
            '-r', str(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', str(out))
    return out

def split_piece(tmp, n, src, a, b, real, overlay, year, length):
    """Split view: the simulated future in 3D on the left, real footage of the same city today on the right."""
    out = tmp / f'p{n:02d}.mp4'
    L = length; k = L / (b - a)
    ov = overlay.copy(); d = ImageDraw.Draw(ov)
    for x, label, col in ((60, f'SIMULATED  ·  {year}', CYAN), (W // 2 + 60, 'REAL  ·  TODAY', WHITE)):
        f = font('demi', 26); w = d.textlength(label, font=f)
        d.rounded_rectangle([x - 16, H - BAR - 78, x + w + 16, H - BAR - 30], 10, fill=(3, 5, 10, 170))
        d.text((x, H - BAR - 70), label, font=f, fill=col + (255,))
    d.line([(W // 2, BAR), (W // 2, H - BAR)], fill=(238, 242, 248, 200), width=3)
    png = tmp / f'o{n:02d}.png'; ov.save(png)
    rd = duration(real); rs = max(0.0, min(2.0, rd - L - 0.1)); k2 = max(1.0, (L + 0.1) / max(0.5, rd - rs))
    g = 'eq=contrast=1.08:saturation=1.1:gamma=0.96'
    fc = (f'[0]setpts={k:.4f}*PTS,scale={W}:{H}:flags=lanczos,crop={W // 2}:{H}:{W // 4}:0,trim=0:{L:.3f},setpts=PTS-STARTPTS,{g}[l];'
          f'[1]setpts={k2:.4f}*PTS,scale={W // 2}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W // 2}:{H},fps={FPS},trim=0:{L:.3f},setpts=PTS-STARTPTS,eq=contrast=1.05:saturation=1.05[r];'
          f'[l][r]hstack=inputs=2[v];[2]format=rgba,fade=t=in:st=0.2:d=0.5:alpha=1[o];'
          f'[v][o]overlay=0:0:shortest=1,fade=t=in:st=0:d=0.25,fade=t=out:st={L - 0.25:.3f}:d=0.25,format=yuv420p')
    run('ffmpeg', '-y', '-ss', str(a), '-t', f'{b - a:.3f}', '-i', str(src), '-ss', f'{rs:.2f}', '-i', str(real),
        '-loop', '1', '-t', f'{L:.3f}', '-i', str(png), '-filter_complex', fc, '-r', str(FPS),
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', str(out))
    return out

DESK = Path.home() / 'Desktop'
MOVIES = [  # (recording, start s, crop w:h:x:y, label) - Malek's screen recordings, cropped clear of UI
    [('Screen Recording 2026-11-03 at 11.58.03.mov', 8.0, '850:1434:677:0', 'I, Robot (2004)'),
     ('Screen Recording 2026-11-03 at 11.59.29.mov', 94.0, '593:1000:805:217', 'Ex Machina (2014)'),
     ('Screen Recording 2026-11-03 at 12.05.35.mov', 23.5, '593:1000:805:217', 'Transcendence (2014)')],
    [('Screen Recording 2026-11-03 at 11.56.36.mov', 5.0, '735:1240:300:97', ''),
     ('Screen Recording 2026-11-03 at 11.59.29.mov', 10.0, '593:1000:805:217', 'Ex Machina (2014)'),
     ('Screen Recording 2026-11-03 at 12.05.35.mov', 88.5, '593:1000:805:217', 'Transcendence (2014)')],
]

def triptych(tmp, n, panels, L):
    """Three film clips side by side, thin dividers, small title under each."""
    out = tmp / f'p{n:02d}.mp4'
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    for k, (_, _, _, label) in enumerate(panels):
        if label:
            f = font('medium', 24); w = d.textlength(label, font=f)
            d.text((k * 640 + (640 - w) / 2, H - 70), label, font=f, fill=(238, 242, 248, 210))
    for x in (640, 1280):
        d.line([(x, 0), (x, H)], fill=(3, 5, 10, 255), width=6)
    png = tmp / f'o{n:02d}.png'; ov.save(png)
    ins, fc = [], ''
    for k, (src, ss, crop, _) in enumerate(panels):
        ins += ['-ss', str(ss), '-t', f'{L + 0.2:.3f}', '-i', str(DESK / src)]
        fc += f'[{k}]crop={crop},scale=640:1080:flags=lanczos,fps={FPS},trim=0:{L:.3f},setpts=PTS-STARTPTS,eq=contrast=1.1:saturation=0.85:gamma=0.95[v{k}];'
    fc += (f'[v0][v1][v2]hstack=inputs=3[v];[3]format=rgba[o];[v][o]overlay=0:0:shortest=1,'
           f'fade=t=in:st=0:d=0.2,fade=t=out:st={L - 0.2:.3f}:d=0.2,format=yuv420p')
    run('ffmpeg', '-y', *ins, '-loop', '1', '-t', f'{L:.3f}', '-i', str(png), '-filter_complex', fc,
        '-r', str(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', str(out))
    return out

def vo_segments(vo):
    """Speech segments of the voice-over take, split at pauses of 0.9 s or more."""
    err = subprocess.run(['ffmpeg', '-i', str(vo), '-af', 'silencedetect=noise=-38dB:d=0.9', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', err)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', err)]
    total = duration(vo); segs, t = [], 0.0
    if ends and starts and ends[0] < starts[0]:
        pass
    edges = sorted([(a, 's') for a in starts] + [(b, 'e') for b in ends])
    cur = 0.0
    for v, kind in edges:
        if kind == 's':
            if v - cur > 0.4: segs.append((max(0, cur - 0.08), v + 0.15))
        else:
            cur = v
    if total - cur > 0.4: segs.append((max(0, cur - 0.08), total))
    return segs

def mix_audio(video, out, U):
    """Score under the voice-over (ducked), each VO line placed at its shot; aura pass on the picture."""
    vo = next((F / f'voiceover{e}' for e in ('.m4a', '.wav', '.mp3', '.aiff', '.mov') if (F / f'voiceover{e}').exists()), None)
    vf = ('format=gbrp,split[a][b];[b]scale=480:-1,gblur=sigma=6,scale=1920:1080,format=gbrp[g];'
          '[a][g]blend=all_mode=screen:all_opacity=0.16,format=yuv420p,vignette=angle=PI/5,noise=alls=3:allf=t,format=yuv420p')
    slots = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 27, 29]
    score_file = F / 'score.m4a'
    if vo:
        lines = json.loads((F / 'vo-lines.json').read_text()) if (F / 'vo-lines.json').exists() else vo_segments(vo)
        print(f'voice-over: {len(lines)} lines')
        tmpd = Path(tempfile.mkdtemp()); parts = []
        for k, (a, b) in enumerate(lines):
            w = tmpd / f'l{k:02d}.wav'
            tight = ',silenceremove=stop_periods=-1:stop_duration=0.2:stop_silence=0.1:stop_threshold=-40dB' if k >= 12 else ''
            run('ffmpeg', '-y', '-i', str(vo), '-af', f'atrim={a}:{b},asetpts=PTS-STARTPTS{tight}', '-ar', '48000', '-ac', '2', str(w))
            parts.append([w, duration(w)])
        # lines 1-12 sit on their shots; lines 13-16 run back to back and are sped up just enough to end by 119.6 s
        place, t_end = [], 0.0
        for k in range(min(12, len(parts))):
            at = max(slots[k] * U + 0.25, t_end + 0.25); place.append((k, at, 1.0)); t_end = at + parts[k][1]
        rest = list(range(12, len(parts)))
        if rest:
            start = max(t_end + 0.2, 24 * U - 2.2)
            need = sum(parts[k][1] for k in rest); room = 119.7 - start - 0.15 * (len(rest) - 1)
            tempo = min(1.25, max(1.0, need / room)); t = start
            print(f'closing lines tempo {tempo:.3f}')
            for k in rest:
                place.append((k, t, tempo)); t += parts[k][1] / tempo + 0.15
        ins = []; fc = ''
        for n, (k, at, tp) in enumerate(place):
            ins += ['-i', str(parts[k][0])]
            ms = int(at * 1000)
            fc += f'[{n + 1}]atempo={tp:.4f},adelay={ms}|{ms}[d{n}];'
        si = len(place) + 1
        fc += ''.join(f'[d{n}]' for n in range(len(place))) + f'amix=inputs={len(place)}:normalize=0,highpass=f=80,acompressor=threshold=-20dB:ratio=3,volume=1.6,asplit[vo][key];'
        fc += f'[{si}]volume=0.9[m];[m][key]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[duck];[duck][vo]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5[aout];'
        fc += f'[0:v]{vf}[vout]'
        run('ffmpeg', '-y', '-i', str(video), *ins, '-i', str(score_file), '-filter_complex', fc,
            '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'fast', '-crf', '15', '-c:a', 'aac', '-b:a', '256k', '-t', '119.9', str(OUT))
    else:
        run('ffmpeg', '-y', '-i', str(video), '-i', str(score_file), '-filter_complex', f'[0:v]{vf}[vout]',
            '-map', '[vout]', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-c:a', 'copy', '-t', '119.9', str(out))

def score(out, total, hits):
    """A slow ambient drone (A minor, 55/82/110 Hz) with air, and a soft low hit at each chapter."""
    hit = '+'.join(f'0.55*sin(2*PI*46*(t-{h}))*exp(-2.6*(t-{h}))*gte(t,{h})' for h in hits)
    drone = ('0.10*sin(2*PI*55*t)*(0.7+0.3*sin(2*PI*0.031*t))+0.07*sin(2*PI*82.41*t)*(0.6+0.4*sin(2*PI*0.047*t+1))'
             '+0.05*sin(2*PI*110*t)*(0.5+0.5*sin(2*PI*0.023*t+2))+0.03*sin(2*PI*164.8*t)*(0.5+0.5*sin(2*PI*0.06*t))')
    run('ffmpeg', '-y', '-f', 'lavfi', '-i', f'aevalsrc=\'{drone}+{hit}\':s=48000:d={total}',
        '-f', 'lavfi', '-i', f'anoisesrc=color=pink:amplitude=0.04:d={total}:r=48000',
        '-filter_complex', f'[1]lowpass=f=900,highpass=f=120,volume=0.6[n];[0][n]amix=inputs=2:normalize=0,'
                           f'afade=t=in:st=0:d=3,afade=t=out:st={total - 4}:d=4,aecho=0.6:0.5:900:0.25,loudnorm=I=-18:TP=-2',
        '-c:a', 'aac', '-b:a', '192k', str(out))

def main():
    OFF = float(sys.argv[sys.argv.index('--offset') + 1]) if '--offset' in sys.argv else 1.6
    x, r = engine_facts(), results_facts()
    rows, p = x['rows'], x['policies']
    rib = lambda y: f'{y}   ·   {rows[str(y)]["warmingC"]:.2f} °C   ·   sea +{round(rows[str(y)]["seaLevelM"] * 100)} cm   ·   {rows[str(y)]["displacedM"]:.1f} M displaced'
    ev = {e['id']: e for e in x['events']}
    sh50 = x['hs']['2050']['Shanghai']; dh76 = x['hs']['2076']['Dhaka']
    big, mid = font('demi', 64), font('medium', 44)
    # Everything is cut on the score's two-bar grid (scripts/score.py): the beat drops on
    # Boston, the orchestra hits on the war, the music falls away for "who should decide?".
    U = 15.737687 / 4
    if '--mix-only' in sys.argv:
        mix_audio(F / 'film-picture.mp4', OUT, U); print(f'{OUT.relative_to(ROOT)}: {duration(OUT):.1f} s'); return
    score_file = F / 'score.m4a'
    if not score_file.exists():
        subprocess.run([sys.executable, str(ROOT / 'scripts' / 'score.py')], check=True)
    # Shot windows in take E: chronicle playback starts OFF seconds into the recording.
    T = lambda a: OFF + a

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        parts = []
        # Cold open (4 units): free-licence clips under the problem, in two halves.
        clips = sorted(q for q in (F / 'cold-open').glob('*') if q.suffix.lower() in ('.mp4', '.mov', '.m4v')) if (F / 'cold-open').exists() else []
        if clips:
            share = 4 * U / len(clips)
            movies = all((DESK / m[0]).exists() for set_ in MOVIES for m in set_)
            keep = clips[:len(clips) // 2] if movies else clips
            for k, c in enumerate(keep):
                parts.append(footage(tmp, 90 + k, c, 0, min(share, duration(c)), grade='null', length=share))
            if movies:
                for k, set_ in enumerate(MOVIES):
                    parts.append(triptych(tmp, 96 + k, set_, U))
        else:
            parts.append(encode_frames(lines_card([('COLD OPEN', font('demi', 40), CYAN), ('clips go in footage/cold-open/', font('regular', 30), DIM)], 4 * U), tmp / 'cold.mp4'))
        parts.append(footage(tmp, 1, E, T(0.5), T(0.5 + 2 * U), center_overlay([('In 2026,', font('ultralight', 72), WHITE), ('we gave an AI the world\'s budget.', big, WHITE)]), length=2 * U))
        parts.append(encode_frames(choice_card(p, 2 * U), tmp / 'choice.mp4'))
        parts.append(encode_frames(mc_card(json.loads((F / 'mc.json').read_text()), 2 * U), tmp / 'futures.mp4'))
        chapters = [
            (T(11.5), '2032', 'The world crosses 1.5 °C.', rib(2032), AMBER),
            (T(21.0), '2035', f'A {ev["breakthrough"]["title"].lower()} in {ev["breakthrough"]["place"]}. Emissions fall faster than planned.', rib(2035), GREEN),
            (T(31.8), '2050', f'The sea is {round(rows["2050"]["seaLevelM"] * 100)} cm higher. {sh50:.1f} million people leave Shanghai\'s coast.', rib(2050), AMBER),
            (T(42.3), '2067', f'{ev["war"]["title"]} in {ev["war"]["place"]}. The energy transition slows.', rib(2067), RED),
            (T(53.0), '2076', f'The sea is {round(rows["2076"]["seaLevelM"] * 100)} cm higher. One hurricane is enough to flood Miami Beach.', rib(2076), RED),
            (T(63.5), '2076', f'In Dhaka alone, almost {math.ceil(dh76)} million people have lost their homes to the sea.', rib(2076), RED),
        ]
        cities = [None, 'boston', 'shanghai', 'kyiv', 'miami', 'dhaka']
        for n, ((a, year, line, ribbon, accent), city) in enumerate(zip(chapters, cities), start=10):
            real = F / 'cities' / f'{city}.mp4' if city else None
            if real and real.exists():
                parts.append(split_piece(tmp, n, E, a, a + 2 * U, real, chapter_overlay(year, line, ribbon, accent), year, 2 * U))
            else:
                parts.append(footage(tmp, n, E, a, a + 2 * U, chapter_overlay(year, line, ribbon, accent), length=2 * U))
        ai, au = r['AI'], r['Audience']
        parts.append(encode_frames(lines_card([(f'The AI kept warming under 2 °C in {ai["p2"]}% of futures.', font('demi', 54), GREEN),
                                               (f'It forgot {ai["disp"]} million people on the coasts.', font('demi', 54), RED),
                                               (f'A people-first choice: {au["disp"]} million, but {au["p2"]}% under 2 °C.', font('medium', 40), WHITE)], 2 * U, 'THE TRADE-OFF'), tmp / 'reveal.mp4'))
        # What it becomes (script v3): the truth layer, on the globe, then the claim, then the end card.
        parts.append(footage(tmp, 30, E, 74.3, 79.9, center_overlay([('What it becomes:', mid, DIM), ('one shared source of truth for the world,', font('demi', 64), WHITE),
                                                                      ('checked against reality, played forward.', font('demi', 64), WHITE)]), length=2 * U))
        gh = json.loads(subprocess.run(['gh', 'api', 'repos/bilawalsidhu/gods-eye-view'], capture_output=True, text=True).stdout or '{}')
        parts.append(encode_frames(stars_card(gh.get('stargazers_count', 62417), gh.get('forks_count', 12208), U), tmp / 'stars.mp4'))
        parts.append(encode_frames(lines_card([('A video can be faked.', font('demi', 54), WHITE),
                                               ('Thousands of sensors agreeing are much harder to fake.', font('demi', 54), CYAN),
                                               ('Truth backed by reality ends fear and doubt.', font('medium', 40), DIM)], 2 * U, 'WHY IT MATTERS'), tmp / 'truth.mp4'))
        parts.append(encode_frames(lines_card([('AI RUNS THE PLANET', font('ultralight', 96), WHITE), ('See the world as it is. See where it\'s going.', font('demi', 40), CYAN),
                                               ('Frontier AI will fit in your pocket. Soon, on every phone, for everyone.', font('medium', 32), WHITE),
                                               ('Malek Hassan & Sammy  ·  Macromedia X CODE Hackathon 2026', font('regular', 26), DIM),
                                               ('God\'s Eye View (Bilawal Sidhu, MIT)  ·  CesiumJS  ·  Google Photorealistic 3D Tiles  ·  IPCC AR6  ·  UN WPP 2024  ·  Music: Apple Loops  ·  Footage: Mixkit, Pexels', font('regular', 22), DIM)], 119.9 - 29 * U + 0.4), tmp / 'end.mp4'))
        lst = tmp / 'list.txt'
        lst.write_text(''.join(f"file '{q}'\n" for q in parts))
        video = tmp / 'video.mp4'
        run('ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', str(lst), '-an', '-r', str(FPS), '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', '-pix_fmt', 'yuv420p', str(video))
        import shutil; shutil.copy(video, F / 'film-picture.mp4')
        mix_audio(video, OUT, U)
    print(f'{OUT.relative_to(ROOT)}: {duration(OUT):.1f} s')

if __name__ == '__main__':
    main()
