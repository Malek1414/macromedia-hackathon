"""The film's score, arranged from Apple's "Epoch" loop family (eight stems of one
track, royalty-free for use in your own productions). The music builds with the
story: dark piano for the setup, the beat on 2035, orchestra hits on the war, a drop
for the trade-off, piano alone for the title. Writes footage/score.m4a.

Every section is one loop (15.737687 s = 8 bars); the film cuts on 2-bar steps.
"""
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOOPS = Path('/Library/Audio/Apple Loops/Apple/01 Hip Hop')
LOOP = 15.737687
UNIT = LOOP / 4                      # two bars: the film's cutting grid
OUT = ROOT / 'footage' / 'score.m4a'
TOTAL = 119.9

# Which stems play in each of the eight sections, with their level.
STEMS = {
    'Epoch Ambient Piano': [1.0, 1.0, 0.9, 0.85, 0.8, 0.8, 1.0, 1.0],
    'Epoch Noise Synth':   [0.5, 0.0, 0.4, 0.0, 0.0, 0.5, 0.5, 0.0],
    'Epoch Delay Synth':   [0.0, 0.6, 0.6, 0.6, 0.0, 0.6, 0.7, 0.0],
    'Epoch Sub Bass':      [0.0, 0.7, 0.8, 0.9, 1.0, 1.0, 0.0, 0.0],
    'Epoch Synth Arp':     [0.0, 0.0, 0.6, 0.7, 0.7, 0.7, 0.0, 0.0],
    'Epoch Beat':          [0.0, 0.0, 0.0, 0.9, 1.0, 1.0, 0.0, 0.0],
    'Epoch Orchestra Hits': [0.0, 0.0, 0.0, 0.0, 0.9, 0.9, 0.0, 0.0],
    'Epoch Synth Lead':    [0.0, 0.0, 0.0, 0.0, 0.6, 0.7, 0.0, 0.0],
}

def main():
    inputs, chains = [], []
    for n, (stem, levels) in enumerate(STEMS.items()):
        inputs += ['-stream_loop', '7', '-i', str(LOOPS / f'{stem}.caf')]
        # A level per section, with 40 ms ramps so nothing clicks at the joins.
        expr = '+'.join(f'{g}*between(t,{i * LOOP:.4f},{(i + 1) * LOOP:.4f})' for i, g in enumerate(levels) if g)
        chains.append(f'[{n}:a]aresample=48000,aformat=channel_layouts=stereo,volume=\'{expr or 0}\':eval=frame,'
                      f'afade=t=in:st=0:d=0.04[s{n}]')
    mix = ''.join(f'[s{n}]' for n in range(len(STEMS)))
    chains.append(f'{mix}amix=inputs={len(STEMS)}:normalize=0,atrim=0:{TOTAL},'
                  f'afade=t=in:st=0:d=1.5,afade=t=out:st={TOTAL - 6}:d=6,loudnorm=I=-16:TP=-1.5:LRA=11[out]')
    subprocess.run(['ffmpeg', '-y', *inputs, '-filter_complex', ';'.join(chains), '-map', '[out]', '-c:a', 'aac', '-b:a', '256k', str(OUT)],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f'{OUT.relative_to(ROOT)} written; cut grid {UNIT:.4f} s')

if __name__ == '__main__':
    main()
