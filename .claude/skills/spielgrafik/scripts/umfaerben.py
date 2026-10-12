# Farbbereiche umfaerben: umfaerben.py ein aus "h0,h1,smin:hNeu,sFaktor,vFaktor" ...
import sys, colorsys
from PIL import Image
ein, aus, *regeln = sys.argv[1:]
R = []
for r in regeln:
    a, b = r.split(':'); h0, h1, smin = map(float, a.split(',')); hn, sf, vf = map(float, b.split(','))
    R.append((h0, h1, smin, hn, sf, vf))
im = Image.open(ein).convert('RGB'); px = im.load()
for y in range(im.height):
    for x in range(im.width):
        r, g, b = px[x, y]
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        for h0, h1, smin, hn, sf, vf in R:
            if h0 <= h <= h1 and s >= smin:
                w = min(1, (s - smin) / 0.15)
                h2 = h + (hn - h) * w; s2 = s * (1 - (1 - sf) * w); v2 = v * (1 - (1 - vf) * w)
                r2, g2, b2 = colorsys.hsv_to_rgb(h2, s2, v2)
                px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255)); break
im.save(aus)
