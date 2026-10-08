#!/usr/bin/env python3
"""Vergleichsbogen: jede Vorlage mit iOS-Rundung in 270/120/60/40 px.
  vorschau.py aus.png bild1.png[:Titel] bild2.png[:Titel] ..."""
import sys
from PIL import Image, ImageDraw
sys.path.insert(0, __import__("os").path.dirname(__file__))
from symbole import rund

def main():
    aus, bilder = sys.argv[1], sys.argv[2:]
    W = 40 + 330 * len(bilder); bg = Image.new("RGB", (W, 520), (27, 29, 34)); d = ImageDraw.Draw(bg)
    for i, arg in enumerate(bilder):
        pfad, _, titel = arg.partition(":"); q = Image.open(pfad).convert("RGB"); x = 40 + i * 330
        g = rund(q, 270); bg.paste(g, (x, 30), g); d.text((x + 120, 315), titel or str(i + 1), fill=(235, 235, 235))
        xx = x
        for s in (120, 60, 40):
            k = rund(q, s); bg.paste(k, (xx, 470 - s), k); xx += s + 16
    bg.save(aus); print("✓", aus)

if __name__ == "__main__":
    main()
