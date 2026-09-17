#!/usr/bin/env python3
"""Die Kennung des ersten verfuegbaren iPhone-Simulators ausgeben.

Warum nicht einfach `-destination 'platform=iOS Simulator,name=iPhone 16'`:
Welche Geraete es gibt, haengt an der Xcode-Fassung des Laeufers. Ein fester
Modellname laeuft, bis GitHub das Abbild wechselt — und bricht dann mit einer
Meldung, die nach einem Fehler im Projekt aussieht statt nach einem fehlenden
Simulator.

Liest `xcrun simctl list devices available -j` von der Standardeingabe.
Gibt die Kennung aus oder nichts; der Aufrufer entscheidet, was das heisst.
"""
import json
import sys


def main() -> int:
    try:
        geraete = json.load(sys.stdin).get("devices", {})
    except (ValueError, OSError):
        return 1
    # Neuere Laufzeiten zuerst: Die Liste kommt nach Laufzeit sortiert, und das
    # juengste iPhone ist naeher an dem, was Tester benutzen.
    for laufzeit in sorted(geraete, reverse=True):
        for g in geraete[laufzeit]:
            if g.get("isAvailable") and "iPhone" in (g.get("name") or ""):
                print(g["udid"])
                return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
