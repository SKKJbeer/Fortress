#!/usr/bin/env python3
"""Eine von Apple freigegebene Fassung im App Store veroeffentlichen (v3.130.2).

Gegenstueck zu `asc-einreichen.py`: Dort wird `releaseType` auf MANUAL
gesetzt, damit die App nach Apples Freigabe NICHT von selbst erscheint. Dieser
Schritt ist der Knopf „Diese Version veroeffentlichen" — getrennt, mit Riegel.

    (ohne Argument)   TROCKENLAUF. Zeigt Zustand, angehaengten Bau und
                      Verfuegbarkeit und sagt, was geschaehe. Schreibt nichts.
    --freigeben       Wirklich veroeffentlichen. Verlangt die
                      Umgebungsvariable BESTAETIGUNG=FREIGEBEN (appstore.yml).
    --automatisch     Eine Fassung, die NOCH in Pruefung ist, auf „nach Freigabe
                      sofort veroeffentlichen" (AFTER_APPROVAL) stellen. Verlangt
                      BESTAETIGUNG=AUTOMATISCH. Seit 24.10.2026, auf Wunsch des
                      Betreibers („mache das automatisch, alles live geht"):
                      `asc-einreichen.py` reicht weiter mit MANUAL ein (die
                      sichere Voreinstellung); wer will, dass Apples Freigabe die
                      App sofort live schaltet, setzt es danach hiermit.

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


# Zustaende, in denen sich die Veroeffentlichungsart noch aendern laesst.
NOCH_OFFEN = {"PREPARE_FOR_SUBMISSION", "READY_FOR_REVIEW", "WAITING_FOR_REVIEW", "IN_REVIEW",
              "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED", "INVALID_BINARY"}


def main() -> int:
    wirklich = "--freigeben" in sys.argv[1:]
    automatisch = "--automatisch" in sys.argv[1:]
    if wirklich and os.environ.get("BESTAETIGUNG") != "FREIGEBEN":
        sag("Zum Veroeffentlichen die Eingabe 'bestaetigung' auf FREIGEBEN setzen.")
        return 1
    if automatisch and os.environ.get("BESTAETIGUNG") != "AUTOMATISCH":
        sag("Zum Umstellen auf automatisches Veroeffentlichen die Eingabe 'bestaetigung' auf AUTOMATISCH setzen.")
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
    sag(f"  Veroeffentlichung: {feld(fass, 'releaseType')}")

    if automatisch:
        # Nur solange die Fassung noch nicht freigegeben ist. Ist sie es schon, gilt
        # `--freigeben`; ist sie schon im Verkauf, gibt es nichts umzustellen.
        if zustand not in NOCH_OFFEN:
            sag(f"\nNichts umzustellen: Zustand {zustand} (umstellbar nur in {', '.join(sorted(NOCH_OFFEN))}). "
                + ("Schon freigegeben — dann `freigeben`." if zustand == "PENDING_DEVELOPER_RELEASE" else ""))
            return 0
        if not verfuegbar:
            sag("\n! Nicht umgestellt: erst die Verfuegbarkeit anlegen — sonst ginge die App automatisch "
                "in KEINEM Land live.")
            return 1
        st, aw = apple.aendern(f"v1/appStoreVersions/{fass['id']}", {"data": {
            "type": "appStoreVersions", "id": fass["id"],
            "attributes": {"releaseType": "AFTER_APPROVAL"}}})
        if st != 200:
            sag(f"\n! releaseType nicht auf AFTER_APPROVAL setzbar ({st}): {kurz(aw)}"); return 1
        st, neu = apple.holen(f"v1/appStoreVersions/{fass['id']}")
        jetzt = feld(neu.json()["data"], "releaseType") if st == 200 else "?"
        sag(f"\n✓ Veroeffentlichung jetzt: {jetzt}")
        sag("  Sobald Apple die Fassung freigibt, erscheint sie OHNE weiteren Schritt im App Store.")
        return 0 if jetzt == "AFTER_APPROVAL" else 1

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
