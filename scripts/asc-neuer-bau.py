#!/usr/bin/env python3
"""Eine freigegebene, noch NICHT veroeffentlichte Fassung zurueckweisen, um
einen neueren Bau einzureichen (v3.130.3).

Anlass: Apple hat Fassung 1.0 mit Bau 40 (v3.118.0) freigegeben — vor dem
Comic-Umbau. Der Betreiber hat entschieden: nicht den alten Stand
veroeffentlichen, sondern Bau 45+ einreichen, damit die erste oeffentliche
Fassung zur Website und zu den Store-Bildern passt.

    (ohne Argument)    TROCKENLAUF. Liest Zustand, Einreichungen und den
                       neuesten Bau. Schreibt nichts.
    --zurueckweisen    Die Fassung zurueckweisen („Developer Reject"). Verlangt
                       BESTAETIGUNG=ZURUECKWEISEN (appstore.yml).

Danach — getrennte, schon vorhandene Schritte:
    store-bilder   Bildschirmfotos tauschen
    store          (--bau) den neuesten Bau an die Fassung haengen
    einreichen     neu einreichen (Eingabe EINREICHEN)

**Rueckweisen ist ein Rueckschritt mit Preis:** Die Fassung muss erneut durch
Apples Pruefung (meist 1-2 Tage). Veroeffentlicht wird dadurch nichts.
"""

import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from asc import Apple, BUNDLE, FASSUNG, erste, feld, kurz  # noqa: E402

sag = print


def main() -> int:
    wirklich = "--zurueckweisen" in sys.argv[1:]
    if wirklich and os.environ.get("BESTAETIGUNG") != "ZURUECKWEISEN":
        sag("Zum Zurueckweisen die Eingabe 'bestaetigung' auf ZURUECKWEISEN setzen.")
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
    sag(f"Fassung {FASSUNG}: {zustand}" + ("" if wirklich else "  — TROCKENLAUF"))
    st, bau = erste(apple, f"v1/appStoreVersions/{fass['id']}/build")
    sag(f"  angehaengt: Bau {feld(bau, 'version') if bau else '—'}")

    # Neuester gueltiger Bau — der, der stattdessen eingereicht wuerde.
    st, aw = apple.holen("v1/builds", **{"filter[app]": app["id"], "sort": "-uploadedDate",
                                         "limit": 5, "fields[builds]": "version,processingState,expired"})
    if st == 200:
        for b in aw.json().get("data") or []:
            sag(f"  vorhanden: Bau {feld(b, 'version')} ({feld(b, 'processingState')}"
                + (", abgelaufen" if feld(b, "expired") else "") + ")")

    # Der alte Weg: eine appStoreVersionSubmission. Sie zu loeschen ist das,
    # was App Store Connect „Aus der Pruefung entfernen" bzw. „Developer
    # Reject" nennt — sofern Apple sie fuer diesen Zustand noch fuehrt.
    st, alt = apple.holen(f"v1/appStoreVersions/{fass['id']}/appStoreVersionSubmission")
    alt_id = (alt.json().get("data") or {}).get("id") if st == 200 else None
    sag(f"  alte Einreichung (appStoreVersionSubmission): "
        + (alt_id if alt_id else f"keine (HTTP {st}{': ' + kurz(alt) if st != 200 else ''})"))
    st, rs = apple.holen(f"v1/apps/{app['id']}/reviewSubmissions", limit=5)
    if st == 200:
        for r in rs.json().get("data") or []:
            sag(f"  reviewSubmission {r['id']}: {feld(r, 'state')} ({feld(r, 'submittedDate')})")

    if zustand != "PENDING_DEVELOPER_RELEASE":
        sag(f"\nNichts zu tun: zurueckgewiesen wird nur aus PENDING_DEVELOPER_RELEASE (jetzt {zustand}).")
        return 0
    if not alt_id:
        sag("\n! Apples Schnittstelle bietet hier keinen Weg zum Zurueckweisen —"
            " bitte in App Store Connect: Fassung 1.0 → „Dieses Binary ablehnen\".")
        return 0 if not wirklich else 1
    if not wirklich:
        sag(f"\n→ wuerde die Einreichung {alt_id} loeschen (Developer Reject)")
        return 0
    st, aw = apple.loeschen(f"v1/appStoreVersionSubmissions/{alt_id}")
    if st not in (200, 204):
        sag(f"\n! Zurueckweisen abgelehnt ({st}): {kurz(aw)}")
        sag("  Dann bitte in App Store Connect: Fassung 1.0 → „Dieses Binary ablehnen\".")
        return 1
    st, neu = apple.holen(f"v1/appStoreVersions/{fass['id']}")
    sag(f"\n✓ zurueckgewiesen — Zustand jetzt: {feld(neu.json()['data'], 'appStoreState') if st == 200 else '?'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
