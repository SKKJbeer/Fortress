#!/bin/bash
# Stapel-Erzeugung: schlange.sh <liste.txt> <ausgabeordner> <seed> <groesse>
# Liste: eine Zeile je Bild, "name|prompt". Fertige Bilder werden uebersprungen —
# nach einem Abbruch (Neustart der Umgebung) einfach erneut starten.
#
# WICHTIG: erzeugen.sh bekommt </dev/null. Ohne das liest der Generator aus
# derselben Standardeingabe wie die Schleife und verschluckt die restlichen
# Zeilen der Liste — es entsteht dann nur das LETZTE Bild, und die Schlange
# meldet trotzdem „fertig" (so passiert: 15 von 16 Bildern still verloren).
hier="$(cd "$(dirname "$0")" && pwd)"
[ $# -ge 4 ] || { echo "Aufruf: $0 liste.txt ausgabeordner seed groesse"; exit 1; }
mkdir -p "$2"
while IFS='|' read -r n p; do
  [ -z "$n" ] && continue
  [ -s "$2/$n.png" ] && continue
  bash "$hier/erzeugen.sh" "$2/$n.png" "$3" "$p" "$4" < /dev/null
done < "$1"
fehlt=0; while IFS='|' read -r n p; do [ -n "$n" ] && [ ! -s "$2/$n.png" ] && { echo "FEHLT: $n"; fehlt=1; }; done < "$1"
[ $fehlt = 0 ] && echo "SCHLANGE FERTIG $1" || { echo "SCHLANGE UNVOLLSTAENDIG $1"; exit 1; }
