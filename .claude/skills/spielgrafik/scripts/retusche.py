# Retusche: Fremdkoerper mit sauberen Flaechen desselben Bildes ueberdecken.
# python3 -I retusche.py ein.png aus.png "x0,y0,x1,y1:sx,sy" ...  (Quelle = linke obere Ecke)
import sys
from PIL import Image, ImageFilter, ImageDraw
ein, aus, *felder = sys.argv[1:]
im = Image.open(ein).convert('RGB')
for f in felder:
    ziel, quelle = f.split(':')
    x0, y0, x1, y1 = map(int, ziel.split(',')); sx, sy = map(int, quelle.split(','))
    w, h = x1 - x0, y1 - y0
    flick = im.crop((sx, sy, sx + w, sy + h))
    # Farbangleich: Mittelwert des Flickens auf den Randring des Ziels schieben
    from PIL import ImageStat, ImageChops
    ziel = im.crop((x0, y0, x1, y1))
    ring = Image.new('L', (w, h), 255); ImageDraw.Draw(ring).rectangle((8, 8, w - 9, h - 9), fill=0)
    mz = ImageStat.Stat(ziel, ring).mean; mf = ImageStat.Stat(flick).mean
    kan = [c.point(lambda v, d=mz[i] - mf[i]: max(0, min(255, int(v + d)))) for i, c in enumerate(flick.split())]
    flick = Image.merge('RGB', kan)
    import os; rand = int(os.environ.get("RAND", "10"))
    maske = Image.new('L', (w, h), 0)
    ImageDraw.Draw(maske).rectangle((rand, rand, w - 1 - rand, h - 1 - rand), fill=255)
    # am Bildrand nicht weich auslaufen lassen
    d = ImageDraw.Draw(maske)
    if x0 == 0: d.rectangle((0, rand, rand, h - 1 - rand), fill=255)
    if y0 == 0: d.rectangle((rand, 0, w - 1 - rand, rand), fill=255)
    if x1 >= im.width: d.rectangle((w - 1 - rand, rand, w - 1, h - 1 - rand), fill=255)
    if y1 >= im.height: d.rectangle((rand, h - 1 - rand, w - 1 - rand, h - 1), fill=255)
    if x1 >= im.width and y0 == 0: d.rectangle((w - 1 - rand, 0, w - 1, rand), fill=255)
    if x1 >= im.width and y1 >= im.height: d.rectangle((w - 1 - rand, h - 1 - rand, w - 1, h - 1), fill=255)
    maske = maske.filter(ImageFilter.GaussianBlur(rand / 2))
    im.paste(flick, (x0, y0), maske)
im.save(aus)
