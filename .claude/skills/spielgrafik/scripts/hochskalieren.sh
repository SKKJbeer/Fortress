#!/usr/bin/env bash
# hochskalieren.sh <ein.png> <aus.png> [ziel=1024 | BxH]  — Real-ESRGAN x4, dann Lanczos auf Zielgroesse
set -euo pipefail
H="${SPIELGRAFIK_HOME:-$HOME/.cache/spielgrafik}"
T="$(mktemp -d)"
"$H/sdcpp/build/bin/sd-cli" -M upscale --upscale-model "$H/m/RealESRGAN_x4plus_anime_6B.pth" -i "$1" -o "$T/x4.png" -t "$(nproc)" >/dev/null 2>&1
python3 -c "import sys;from PIL import Image;z=sys.argv[3];b,_,h=z.partition('x');Image.open(sys.argv[1]).convert('RGB').resize((int(b),int(h or b)),Image.LANCZOS).save(sys.argv[2])" "$T/x4.png" "$2" "${3:-1024}"
rm -rf "$T"; echo "✓ $2"
