# Dunkle Linien (Risse) abschwaechen: dunkle Pixel Richtung Umgebungsfarbe ziehen.
import sys
from PIL import Image, ImageFilter
ein, aus, staerke = sys.argv[1], sys.argv[2], float(sys.argv[3])
im = Image.open(ein).convert('RGB')
weich = im.filter(ImageFilter.MedianFilter(int(sys.argv[4]) if len(sys.argv) > 4 else 9)).filter(ImageFilter.GaussianBlur(2))
L = im.convert('L'); Lw = weich.convert('L')
# Maske: wie viel dunkler als die Umgebung (0..255)
diff = Image.eval(Image.merge('RGB', (Lw, L, L)).convert('L'), lambda v: v)
import array
lp, lwp = L.load(), Lw.load()
m = Image.new('L', im.size); mp = m.load()
for y in range(im.height):
    for x in range(im.width):
        d = lwp[x, y] - lp[x, y]
        mp[x, y] = max(0, min(255, int(d * 4 * staerke)))
m = m.filter(ImageFilter.GaussianBlur(0.8))
Image.composite(weich, im, m).save(aus)
