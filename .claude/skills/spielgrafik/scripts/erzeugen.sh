#!/usr/bin/env bash
# erzeugen.sh <ausgabe.png> <seed> "<prompt>" [groesse=512 | BxH, z. B. 576x1024 fuer Hochformat]
# Beide Kanten muessen durch 64 teilbar sein. Hochformat 576x1024 dauert ~2,3x so lang wie 512x512.
set -euo pipefail
H="${SPIELGRAFIK_HOME:-$HOME/.cache/spielgrafik}"
mkdir -p "$(dirname "$1")"
G="${4:-512}"; B="${G%x*}"; H2="${G#*x}"
"$H/sdcpp/build/bin/sd-cli" --diffusion-model "$H/m/flux1-schnell-Q4_0.gguf" --vae "$H/m/ae-f16.gguf" \
  --clip_l "$H/m/clip_l-Q8_0.gguf" --t5xxl "$H/m/t5xxl-Q4_0.gguf" -p "$3" \
  --cfg-scale 1.0 --sampling-method euler --steps 4 -W "$B" -H "$H2" --seed "$2" -t "$(nproc)" -o "$1" 2>&1 \
  | grep -E "generate_image completed|rror" || true
[ -s "$1" ] && echo "✓ $1 (seed $2)"
