#!/usr/bin/env bash
# Stellt den Auslieferordner der Website zusammen.
#
# **Warum ein Zwischenschritt und nicht einfach `docs/website/` hochladen.**
# Impressum, Datenschutzerklaerung und Nutzungsbedingungen stehen bereits in
# `public/` — sie gehoeren zum Spiel und werden mit ihm ausgeliefert. Eine
# zweite Fassung im Website-Ordner waere eine Kopie, die irgendwann von der
# ersten abweicht, und die Abweichung faellt bei Rechtstexten erst auf, wenn
# sie teuer wird. Hier wird deshalb kopiert statt gepflegt: eine Quelle,
# zwei Ziele.
#
#   Aufruf:  scripts/website-bauen.sh [zielordner]
#   Vorgabe: build/website
set -euo pipefail

ZIEL="${1:-build/website}"
WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WURZEL"

rm -rf "$ZIEL"
mkdir -p "$ZIEL"

cp -r docs/website/. "$ZIEL"/

# Die Rechtstexte aus dem Spiel. Sie bringen ihren eigenen Stil mit — dunkel,
# gleiche Schriftfamilie — und passen deshalb ohne Nacharbeit dazu.
for datei in impressum privacy agb; do
  if [ ! -f "public/$datei.html" ]; then
    echo "FEHLER: public/$datei.html fehlt" >&2
    exit 1
  fi
  cp "public/$datei.html" "$ZIEL/$datei.html"
done

# **„Zum Spiel" muss zum Spiel fuehren.** In `public/` zeigen diese Verweise
# auf die eigene Wurzel („./") beziehungsweise auf „/Fortress/" — beides
# stimmt auf GitHub Pages, wo die Seiten neben dem Spiel liegen. Auf der
# Cloudflare-Adresse liegt dort die Werbeseite; der Verweis fuehrte also auf
# sich selbst, und „/Fortress/" ins Leere. Hier bekommen sie die vollstaendige
# Adresse. `public/` bleibt unangetastet.
SPIEL="https://skkjbeer.github.io/Fortress/"
for datei in impressum privacy agb; do
  sed -i.bak \
    -e "s|href=\"\./\"|href=\"$SPIEL\"|g" \
    -e "s|href=\"/Fortress/\"|href=\"$SPIEL\"|g" \
    "$ZIEL/$datei.html"
  rm -f "$ZIEL/$datei.html.bak"
done

# **Der TestFlight-Knopf steht nur da, wenn er funktioniert.**
#
# Ein oeffentlicher TestFlight-Link existiert, sobald die externe Gruppe
# existiert — er nimmt aber erst Tester an, wenn Apple den Bau freigegeben hat.
# Vorher zeigt dieselbe Adresse „This beta isn't accepting any new testers
# right now" (gemessen). Ein Knopf dorthin waere dasselbe leere Versprechen wie
# ein App-Store-Abzeichen ohne App im Store.
#
# Gefragt wird in `scripts/testflight-stand.py`; das Ergebnis kommt hier als
# TESTFLIGHT_OFFEN an. Ohne Angabe wird der Block entfernt — die vorsichtige
# Annahme ist die richtige, wenn niemand nachgesehen hat.
if [ "${TESTFLIGHT_OFFEN:-nein}" = "ja" ]; then
  echo "TestFlight-Knopf: bleibt (Beta nimmt Tester an)."
else
  python3 - "$ZIEL/index.html" <<'PY'
import re, sys, pathlib
p = pathlib.Path(sys.argv[1])
t = p.read_text(encoding="utf-8")
neu, n = re.subn(r"[ \t]*<!-- TESTFLIGHT:ANFANG.*?TESTFLIGHT:ENDE -->\n?", "", t, flags=re.S)
p.write_text(neu, encoding="utf-8")
print(f"TestFlight-Knopf: entfernt ({n} Block).")
PY
fi

echo "Website zusammengestellt in $ZIEL:"
find "$ZIEL" -type f | sort | sed 's|^|  |'
