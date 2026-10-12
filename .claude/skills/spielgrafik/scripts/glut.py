# Leuchtende Lava daempfen: orange/rote, helle Pixel Richtung dunkles Gestein ziehen.
import sys, colorsys
from PIL import Image
ein, aus, staerke = sys.argv[1], sys.argv[2], float(sys.argv[3])
im = Image.open(ein).convert('RGB'); px = im.load()
for y in range(im.height):
    for x in range(im.width):
        r, g, b = px[x, y]
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        # Lava: Farbton rot..orange..gelb (0..0.17), gesaettigt, hell
        if (h < 0.17 or h > 0.95) and s > 0.45 and v > 0.45:
            w = staerke * min(1, (s - 0.45) / 0.3) * min(1, (v - 0.45) / 0.3)
            v2 = v * (1 - float(sys.argv[4]) * w); s2 = s * (1 - float(sys.argv[5]) * w)
            r2, g2, b2 = colorsys.hsv_to_rgb(h, s2, v2)
            px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255))
im.save(aus)
