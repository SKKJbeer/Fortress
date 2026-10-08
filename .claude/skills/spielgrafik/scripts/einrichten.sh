#!/usr/bin/env bash
# Laedt FLUX.1-schnell (GGUF), Text-Encoder, VAE und Real-ESRGAN und baut
# stable-diffusion.cpp. Wiederholbar: Vorhandenes wird uebersprungen.
set -euo pipefail
H="${SPIELGRAFIK_HOME:-$HOME/.cache/spielgrafik}"
mkdir -p "$H/m"
B=https://huggingface.co/second-state/FLUX.1-schnell-GGUF/resolve/main
for f in flux1-schnell-Q4_0.gguf t5xxl-Q4_0.gguf clip_l-Q8_0.gguf ae-f16.gguf; do
  [ -s "$H/m/$f" ] || curl -sSL --retry 4 -o "$H/m/$f" "$B/$f" &
done
[ -s "$H/m/RealESRGAN_x4plus_anime_6B.pth" ] || curl -sSL --retry 4 -o "$H/m/RealESRGAN_x4plus_anime_6B.pth" \
  https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth &
# Laeuft der vorhandene Bau auf DIESER Maschine? Cloud-Container wechseln den
# Rechner zwischen Sitzungen; ein mit GGML_NATIVE gebautes Programm stirbt
# dann mit SIGILL (Exit 132, „AMX is not ready") — ohne Fehlermeldung im Bild.
if [ -x "$H/sdcpp/build/bin/sd-cli" ] && ! "$H/sdcpp/build/bin/sd-cli" --help >/dev/null 2>&1; then
  rm -rf "$H/sdcpp/build"
fi
if [ ! -x "$H/sdcpp/build/bin/sd-cli" ]; then
  [ -d "$H/sdcpp" ] || git clone -q --recursive --depth 1 https://github.com/leejet/stable-diffusion.cpp "$H/sdcpp"
  # NICHT -DGGML_NATIVE=ON: das bindet an den Prozessor des Bau-Rechners.
  cmake -S "$H/sdcpp" -B "$H/sdcpp/build" -DCMAKE_BUILD_TYPE=Release -DGGML_NATIVE=OFF \
    -DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON >/dev/null
  cmake --build "$H/sdcpp/build" -j"$(nproc)" --config Release >/dev/null
fi
wait
ls -la "$H/m"; echo "Bereit: $H"
