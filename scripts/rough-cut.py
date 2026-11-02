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
OUT = ROOT / 'footage/rough-cut-v0.mp4'
W, H, FPS = 1920, 1080, 30

# (source, start, end) in the raw takes, in order; times mapped from the contact sheets.
CUTS = [
    (A, 0, 14),          # 0:00 hook: title screen, hand over
    (B, 0, 11),          # 0:14 tried: God's Eye View, today's world
    (A, 14, 31),         # 0:25 thing: the AI's pick, futures appear, playback
    (A, 31, 39),         # 0:42 works: event banners
    (A, 60, 70),         #       heat dome, pandemic
    (A, 39, 51),         # 1:00 proof: the AI's 2076 report, then the audience sets its levers
    (A, 71.36, 83.36),   # 1:12 the face-off
    (B, 12, 34),         # 1:24 means: GEV plays the scariest future
    (A, 73.36, 83.36),   # 1:46 ask: back on the face-off
]
END_CARD_S = 4

def run(*cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)],
                         check=True, capture_output=True, text=True).stdout
    return float(out)

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

def main():
    beats = json.loads((ROOT / 'pitch/ai-runs-the-planet/script.json').read_text())['beats']
    starts = {'B1': 0, 'B2': 14, 'B3': 25, 'B4': 42, 'B5': 60, 'B6': 84, 'B7': 106}
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        parts = []
        for i, (src, a, b) in enumerate(CUTS):
            part = tmp / f'part{i}.mp4'
            run('ffmpeg', '-y', '-ss', str(a), '-to', str(b), '-i', str(src), '-an',
                '-vf', f'scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=0x020409,fps={FPS},setsar=1',
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
            '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', str(OUT))
    print(f'{OUT.relative_to(ROOT)}: {duration(OUT):.1f} s')

if __name__ == '__main__':
    main()
