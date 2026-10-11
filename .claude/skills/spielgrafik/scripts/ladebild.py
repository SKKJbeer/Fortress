#!/usr/bin/env python3
"""Ladebild/Startschirm aus EINER Hochformat-Vorlage (9:16) ausspielen.

  ladebild.py vorlage.png [--web PFAD.jpg] [--ios PFAD.png] [--ios-breite 1290]
              [--logo logo.png --logo-breite 0.74 --logo-oben 0.13]

--web   JPEG 1080x1920, Qualitaet 84 (Ladebild der Webseite; leicht, damit es
        vor dem Spielcode da ist)
--logo  Logo (PNG mit Transparenz) oben aufs Bild legen. Text NIE vom
        Bildmodell malen lassen — setzen und auflegen. Sichere Zone:
        iPhones schneiden bei scaleAspectFill links/rechts je ~9 % ab, das iPad
        oben/unten je 12,5 %; daher Breite <= 0,78 und Oberkante >= 0,13.
--ios   PNG ohne Alphakanal, Breite --ios-breite (Vorgabe 1290 = iPhone Pro
        Max), Hoehe im Verhaeltnis der Vorlage. In ein Asset-Catalog-Imageset
        mit EINEM universellen Eintrag legen; das Storyboard skaliert es mit
        scaleAspectFill — wichtige Motive daher nicht an die Raender.
"""
import argparse
from PIL import Image

def main():
    a = argparse.ArgumentParser(); a.add_argument("vorlage"); a.add_argument("--web"); a.add_argument("--ios")
    a.add_argument("--logo"); a.add_argument("--logo-breite", type=float, default=0.74); a.add_argument("--logo-oben", type=float, default=0.13)
    a.add_argument("--ios-breite", type=int, default=1290)
    o = a.parse_args()
    q = Image.open(o.vorlage).convert("RGB"); b, h = q.size
    assert h > b, f"Vorlage muss Hochformat sein, ist {q.size}"
    if o.logo:
        assert o.logo_breite <= 0.78 and o.logo_oben >= 0.13, "Logo ausserhalb der sicheren Zone"
        l = Image.open(o.logo).convert("RGBA"); lb = round(b * o.logo_breite); l = l.resize((lb, round(lb * l.height / l.width)), Image.LANCZOS)
        q = q.convert("RGBA"); q.alpha_composite(l, ((b - lb) // 2, round(h * o.logo_oben))); q = q.convert("RGB")
    if o.web:
        q.resize((1080, round(1080 * h / b)), Image.LANCZOS).save(o.web, quality=84, optimize=True, progressive=True); print("✓", o.web)
    if o.ios:
        w = o.ios_breite; q.resize((w, round(w * h / b)), Image.LANCZOS).save(o.ios, optimize=True); print("✓", o.ios)

if __name__ == "__main__":
    main()
