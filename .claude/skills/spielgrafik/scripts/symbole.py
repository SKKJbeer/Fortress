#!/usr/bin/env python3
"""Aus EINER quadratischen Vorlage alle Symbol-Groessen ausspielen.

  symbole.py vorlage.png [--ios PFAD] [--pwa ORDNER] [--maskable ORDNER]
             [--play PFAD] [--favicon-svg PFAD]

--ios       1024x1024, RGB OHNE Alphakanal (Apple weist Alpha ab)
--pwa       icon-512/192/96.png, abgerundet (iOS-Radius 22,37 %), transparent aussen
--maskable  icon-maskable-512/192.png, vollflaechig (das System schneidet selbst zu)
--play      512x512 vollflaechig (Google Play rundet selbst)
--favicon-svg  SVG mit eingebettetem 64-px-PNG (fuer <link rel=icon type=image/svg+xml>)
"""
import argparse, base64, io, os
from PIL import Image, ImageDraw

RADIUS = 0.2237

def rund(im, s):
    im = im.resize((s * 4, s * 4), Image.LANCZOS).convert("RGBA")
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, im.size[0] - 1, im.size[1] - 1], radius=int(im.size[0] * RADIUS), fill=255)
    im.putalpha(m)
    return im.resize((s, s), Image.LANCZOS)

def main():
    a = argparse.ArgumentParser(); a.add_argument("vorlage")
    for k in ("ios", "pwa", "maskable", "play", "favicon-svg"): a.add_argument("--" + k)
    o = a.parse_args()
    q = Image.open(o.vorlage).convert("RGB")
    assert q.size[0] == q.size[1] and q.size[0] >= 1024, f"Vorlage muss quadratisch und >=1024 sein, ist {q.size}"
    if o.ios:
        q.resize((1024, 1024), Image.LANCZOS).save(o.ios, optimize=True); print("✓", o.ios)
    if o.pwa:
        for s in (512, 192, 96):
            p = os.path.join(o.pwa, f"icon-{s}.png"); rund(q, s).save(p, optimize=True); print("✓", p)
    if o.maskable:
        for s in (512, 192):
            p = os.path.join(o.maskable, f"icon-maskable-{s}.png"); q.resize((s, s), Image.LANCZOS).save(p, optimize=True); print("✓", p)
    if o.play:
        q.resize((512, 512), Image.LANCZOS).save(o.play, optimize=True); print("✓", o.play)
    if o.favicon_svg:
        b = io.BytesIO(); rund(q, 64).save(b, "PNG", optimize=True)
        d = base64.b64encode(b.getvalue()).decode()
        open(o.favicon_svg, "w").write(f"<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 64 64'><image width='64' height='64' href='data:image/png;base64,{d}' xlink:href='data:image/png;base64,{d}'/></svg>\n")
        print("✓", o.favicon_svg)

if __name__ == "__main__":
    main()
