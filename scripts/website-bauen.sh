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
# Symbol als Datei (v3.115.0): Google zeigt neben einem Suchtreffer nur ein
# Symbol, das es unter einer eigenen Adresse abrufen kann. Eine Quelle — das
# App-Symbol aus public/ —, damit Spiel und Website dasselbe zeigen.
cp public/icon-192.png "$ZIEL/icon-192.png"

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
# Die Seite wirbt fuer die App — ohne Knopf haette sie also gar keinen
# Handlungsaufruf. Deshalb gibt es ZWEI Bloecke, die einander ausschliessen:
#
#   TESTFLIGHT:ANFANG … TESTFLIGHT:ENDE            bleibt, wenn die Beta offen ist
#   WARTEN:ANFANG … WARTEN:ENDE                    bleibt, wenn sie es nicht ist
#
# Zwei getrennte Namen statt „TESTFLIGHT" und „OHNE-TESTFLIGHT": Der eine waere
# im anderen enthalten, und ein Muster, das beide unterscheiden muss, ist genau
# die Art Feinheit, die beim naechsten Umbau stillschweigend bricht.
#
# Gefragt wird in `scripts/testflight-stand.py`; das Ergebnis kommt hier als
# TESTFLIGHT_OFFEN an. Ohne Angabe gilt „nicht offen" — die vorsichtige
# Annahme ist die richtige, wenn niemand nachgesehen hat.
if [ "${TESTFLIGHT_OFFEN:-nein}" = "ja" ]; then
  WEG="WARTEN"
else
  WEG="TESTFLIGHT"
fi
WEG="$WEG" python3 - "$ZIEL/index.html" <<'PYENDE'
import os, re, sys, pathlib
pfad = pathlib.Path(sys.argv[1])
weg = os.environ["WEG"]
text = pfad.read_text(encoding="utf-8")
muster = rf"[ \t]*<!-- {weg}:ANFANG.*?{weg}:ENDE -->\n?"
neu, n = re.subn(muster, "", text, flags=re.S)
pfad.write_text(neu, encoding="utf-8")
uebrig = "TestFlight-Knopf" if weg == "WARTEN" else "Hinweis auf die kommende Beta"
print(f"  {weg}-Block entfernt ({n}×) — es bleibt: {uebrig}.")
if n == 0:
    print(f"::warning::Kein {weg}-Block gefunden — steht der Marker noch in index.html?")
PYENDE

echo "Website zusammengestellt in $ZIEL:"
find "$ZIEL" -type f | sort | sed 's|^|  |'
