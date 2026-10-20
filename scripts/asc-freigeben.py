#!/usr/bin/env python3
"""Eine von Apple freigegebene Fassung im App Store veroeffentlichen (v3.130.2).

Gegenstueck zu `asc-einreichen.py`: Dort wird `releaseType` auf MANUAL
gesetzt, damit die App nach Apples Freigabe NICHT von selbst erscheint. Dieser
Schritt ist der Knopf „Diese Version veroeffentlichen" — getrennt, mit Riegel.

    (ohne Argument)   TROCKENLAUF. Zeigt Zustand, angehaengten Bau und
                      Verfuegbarkeit und sagt, was geschaehe. Schreibt nichts.
    --freigeben       Wirklich veroeffentlichen. Verlangt die
                      Umgebungsvariable BESTAETIGUNG=FREIGEBEN (appstore.yml).

**Nicht zuruecknehmbar** wie eine Einreichung: Einmal veroeffentlicht, ist die
App oeffentlich. Zurueck geht nur „Aus dem Verkauf nehmen" in App Store
Connect — die Seite bleibt dann trotzdem in Suchmaschinen-Zwischenspeichern.

Wiederholbar: Steht die Fassung nicht auf PENDING_DEVELOPER_RELEASE, passiert
nichts, und das Skript sagt, in welchem Zustand sie ist.
"""

import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from asc import Apple, BUNDLE, FASSUNG, erste, feld, kurz, verfuegbarkeit_zaehlen  # noqa: E402

sag = print


def verfuegbarkeit(apple: Apple, app_id: str) -> bool:
    """Wo die App erscheint. **Gibt False zurueck, wenn sie in KEINEM Land
    verfuegbar ist** — dann wuerde „Veroeffentlichen" nichts sichtbar machen
    (v3.131.3: genau so ging 1.0 am 20.10. live, ohne irgendwo zu erscheinen;
    der 404 stand wochenlang als „?" im Protokoll)."""
    art, anzahl = verfuegbarkeit_zaehlen(apple, app_id)
    if art == "unbekannt":
        sag("  ? Verfuegbarkeit nicht abfragbar — bitte in App Store Connect ansehen")
        return True
    if not anzahl:
        sag("  ! Verfuegbarkeit: KEIN Gebiet — die App waere in keinem Land zu finden "
            "(Ablauf `verfuegbar` mit Eingabe VERFUEGBAR)")
        return False
    sag(f"  ✓ verfuegbar in {anzahl} Gebieten")
    return True


def main() -> int:
    wirklich = "--freigeben" in sys.argv[1:]
    if wirklich and os.environ.get("BESTAETIGUNG") != "FREIGEBEN":
        sag("Zum Veroeffentlichen die Eingabe 'bestaetigung' auf FREIGEBEN setzen.")
        return 1
    apple = Apple()
    st, app = erste(apple, "v1/apps", **{"filter[bundleId]": BUNDLE})
    if not app:
        sag(f"Kein App-Eintrag fuer {BUNDLE} (HTTP {st})"); return 1
    st, fass = erste(apple, f"v1/apps/{app['id']}/appStoreVersions",
                     **{"filter[versionString]": FASSUNG})
    if not fass:
        sag(f"Fassung {FASSUNG} nicht gefunden (HTTP {st})"); return 1
    zustand = feld(fass, "appStoreState")
    sag(f"App {feld(app, 'name')}, Fassung {FASSUNG}: {zustand}"
        + ("" if wirklich else "  — TROCKENLAUF, es wird nichts geschrieben"))
    st, bau = erste(apple, f"v1/appStoreVersions/{fass['id']}/build")
    sag(f"  Bau {feld(bau, 'version') if bau else '—'} haengt an der Fassung")
    verfuegbar = verfuegbarkeit(apple, app["id"])

    if zustand != "PENDING_DEVELOPER_RELEASE":
        sag(f"\nNichts zu tun: veroeffentlicht wird nur aus PENDING_DEVELOPER_RELEASE (jetzt {zustand}).")
        return 0
    if not verfuegbar:
        sag("\n! Nicht veroeffentlicht: erst die Verfuegbarkeit anlegen.")
        return 1
    if not wirklich:
        sag("\n→ wuerde die Fassung jetzt im App Store veroeffentlichen")
        return 0
    st, aw = apple.anlegen("v1/appStoreVersionReleaseRequests", {"data": {
        "type": "appStoreVersionReleaseRequests",
        "relationships": {"appStoreVersion": {"data": {
            "type": "appStoreVersions", "id": fass["id"]}}}}})
    if st not in (200, 201):
        sag(f"\n! Veroeffentlichung abgelehnt ({st}): {kurz(aw)}"); return 1
    st, neu = apple.holen(f"v1/appStoreVersions/{fass['id']}")
    sag(f"\n✓ Veroeffentlichung angestossen — Zustand jetzt: "
        f"{feld(neu.json()['data'], 'appStoreState') if st == 200 else '?'}")
    sag("  Apple verteilt die App in den naechsten Stunden in alle Stores (READY_FOR_SALE).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
