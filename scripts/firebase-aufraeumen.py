#!/usr/bin/env python3
"""Einzelne, NAMENTLICH benannte Knoten aus der Realtime Database entfernen.

    --zeigen    (Vorgabe) nur anzeigen, was dort steht — aendert nichts
    --loeschen  die Knoten aus ERLAUBT loeschen, Inhalt vorher ins Protokoll

**Warum eine Namensliste und kein Pfad-Argument.** Das Dienstkonto umgeht alle
Regeln. Ein Tippfehler in einem frei uebergebenen Pfad — `leaderboard` statt
`leaderboard/test_bot_001` — loescht die gesamte Bestenliste, und zwar sofort
und ohne Rueckfrage. Die Namen stehen deshalb IM CODE, gehen durch die
Pruefung von `git` und lassen sich nicht aus Versehen weiten.

Dazu drei Riegel unten in `pruefe_erlaubt()`, die jeden Eintrag der Liste
gegen genau diesen Fehler absichern. `tests/aufraeumen.test.js` haelt sie
zusaetzlich statisch fest.

Aus der Umgebung: FIREBASE_SA_JSON (Dienstkonto-Schluessel, ein GEHEIMNIS)
"""

import sys

import requests

import importlib.util
import pathlib

# firebase-regeln.py traegt einen Bindestrich im Namen, ist also nicht
# importierbar — deshalb von Hand geladen. Zweck: DB-Adresse und die
# Zugangs-Diagnose stehen genau EINMAL, nicht zweimal leicht verschieden.
_pfad = pathlib.Path(__file__).resolve().parent / "firebase-regeln.py"
_spec = importlib.util.spec_from_file_location("firebase_regeln", _pfad)
_regeln = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_regeln)

DB = _regeln.DB
sag = print

# Die Zweige, die es oben in der Datenbank gibt. Die erste Stufe jedes
# Eintrags in ERLAUBT muss einer davon sein, und der Eintrag muss tiefer
# gehen als bis dorthin.
ZWEIGE = {"games", "leaderboard", "players", "queue2", "queue3", "telemetry", "funnel"}

# Was geloescht werden darf — vollstaendig ausgeschrieben, mit Begruendung.
ERLAUBT = [
    # Das Testprofil der E2E-Suite (PROFILE_INIT: name TestBot, wappen skelett,
    # elo 1050, 5/2/7). Es stand in der ECHTEN Bestenliste, weil `suiteOffline`
    # bis v3.103.0 keine FB_SPERRE hatte. Der Riegel steht seitdem; der
    # Eintrag blieb liegen. Unter den neuen Regeln kann ihn niemand mehr
    # ueberschreiben — `auth.uid === "test_bot_001"` gibt es nicht.
    ("leaderboard/test_bot_001", "Testprofil der E2E-Suite (vor v3.103.0 durchgerutscht)"),
]


def pruefe_erlaubt() -> None:
    """Drei Riegel gegen den einen Fehler, der hier wehtut."""
    for pfad, _ in ERLAUBT:
        teile = [t for t in pfad.split("/") if t]
        if len(teile) < 2:
            sag(f"ABBRUCH: '{pfad}' hat weniger als zwei Stufen — das waere ein ganzer Zweig.")
            sys.exit(2)
        # Den Fall "Pfad IST ein ganzer Zweig" faengt schon die Stufenzahl ab —
        # ein Zweigname hat keinen Schraegstrich. Hier geht es um den anderen
        # Vertipper: eine erste Stufe, die es gar nicht gibt. Die loescht zwar
        # nichts, taeuscht aber Aufraeumen vor, das nie stattfand.
        if teile[0] not in ZWEIGE:
            sag(f"ABBRUCH: '{pfad}' beginnt mit '{teile[0]}' — das ist kein Zweig "
                f"der Datenbank ({', '.join(sorted(ZWEIGE))}).")
            sys.exit(2)
        if "*" in pfad or ".." in pfad:
            sag(f"ABBRUCH: '{pfad}' enthaelt einen Platzhalter — hier gibt es keine Muster.")
            sys.exit(2)


def main() -> int:
    arg = set(sys.argv[1:])
    pruefe_erlaubt()
    tok = _regeln.token()
    kopf = {"Authorization": f"Bearer {tok}"}
    loeschen = "--loeschen" in arg

    for pfad, warum in ERLAUBT:
        r = requests.get(f"{DB}/{pfad}.json", headers=kopf, timeout=30)
        if r.status_code != 200:
            sag(f"  ! {pfad}: nicht lesbar (HTTP {r.status_code})")
            continue
        if r.text.strip() in ("null", ""):
            sag(f"  · {pfad}: nicht vorhanden — nichts zu tun")
            continue

        sag(f"\n{pfad}  ({warum})")
        sag(f"  Inhalt (Sicherung fuers Protokoll): {r.text}")
        if not loeschen:
            sag("  → nur angezeigt. --loeschen entfernt ihn.")
            continue

        d = requests.delete(f"{DB}/{pfad}.json", headers=kopf, timeout=30)
        if d.status_code == 200:
            nach = requests.get(f"{DB}/{pfad}.json", headers=kopf, timeout=30)
            weg = nach.status_code == 200 and nach.text.strip() == "null"
            sag("  ✓ geloescht und nachgesehen: wirklich weg" if weg
                else f"  ✗ geloescht gemeldet, aber noch da: {nach.text[:120]}")
            if not weg:
                return 1
        else:
            sag(f"  ✗ Loeschen fehlgeschlagen (HTTP {d.status_code}): {d.text[:200]}")
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
