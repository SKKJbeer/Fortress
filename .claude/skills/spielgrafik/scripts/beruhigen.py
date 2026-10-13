# beruhigen.py ein aus anteil_scharf radius [kontrast]
# Mischt das Bild mit einer weichgezeichneten Fassung: Formen (Steine, Bueschel,
# Laub) verlieren die harten Kanten und lesen sich als Textur statt als Hindernis.
import sys
from PIL import Image, ImageFilter, ImageEnhance
ein, aus, a, r = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
k = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
sat = float(sys.argv[6]) if len(sys.argv) > 6 else 1.0
im = Image.open(ein).convert('RGB')
weich = im.filter(ImageFilter.GaussianBlur(r))
out = Image.blend(weich, im, a)
if k != 1.0: out = ImageEnhance.Contrast(out).enhance(k)
if sat != 1.0: out = ImageEnhance.Color(out).enhance(sat)
out.save(aus, quality=88)
