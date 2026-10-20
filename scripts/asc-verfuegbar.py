#!/usr/bin/env python3
"""Wo ist die App im App Store verfuegbar? (v3.131.3)

Anlass: Fassung 1.0 steht seit dem 20.10., 12:39 UTC auf READY_FOR_SALE, aber
Apples oeffentliche Suche (`itunes.apple.com/lookup`) findet die App in KEINEM
Land — und `asc-freigeben.py`/`asc-marktreif.py` melden seit Wochen
„Verfuegbarkeit nicht abfragbar (HTTP 404)". Diese Angabe war die einzige, die
nie bestaetigt wurde.

    (ohne Argument)   NUR LESEN. Zeigt Apples rohe Antworten zu Verfuegbarkeit,
                      Gebieten, Preisplan und Fassungen.
    --setzen          Legt die Verfuegbarkeit an: ALLE Gebiete, auch kuenftige.
                      Nur wenn Apple noch KEINE kennt (404) — eine vorhandene
                      wird nie ueberschrieben. Verlangt BESTAETIGUNG=VERFUEGBAR.
"""

import json
import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from asc import Apple, BUNDLE, erste, feld, kurz  # noqa: E402

sag = print


def gebiete(apple: Apple) -> list[str]:
    ids, pfad, werte = [], "v1/territories", {"limit": 200}
    while pfad:
        st, aw = apple.holen(pfad, **werte)
        if st != 200:
            sag(f"  ! Gebiete nicht lesbar (HTTP {st}): {kurz(aw)}")
            return ids
        j = aw.json()
        ids += [g["id"] for g in j.get("data") or []]
        nxt = (j.get("links") or {}).get("next")
        pfad = nxt.split("api.appstoreconnect.apple.com/", 1)[1] if nxt else None
        werte = {}
    return ids


def lesen(apple: Apple, app_id: str) -> int:
    """Gibt 404-Zaehler fuer die Verfuegbarkeit zurueck (0 = es gibt eine)."""
    sag("— Verfuegbarkeit (v1/apps/{id}/appAvailabilityV2)")
    st, aw = apple.holen(f"v1/apps/{app_id}/appAvailabilityV2")
    sag(f"  HTTP {st}")
    if st == 200:
        d = aw.json().get("data") or {}
        sag(f"  id {d.get('id')}  Attribute {json.dumps(d.get('attributes'))}")
        vid, n, verf, pfad, werte = d.get("id"), 0, 0, f"v2/appAvailabilities/{d.get('id')}/territoryAvailabilities", {"limit": 200}
        while pfad:
            s2, a2 = apple.holen(pfad, **werte)
            if s2 != 200:
                sag(f"  ! Gebiete nicht lesbar (HTTP {s2}): {kurz(a2)}"); break
            j = a2.json()
            for g in j.get("data") or []:
                n += 1
                verf += 1 if feld(g, "available") else 0
            nxt = (j.get("links") or {}).get("next")
            pfad = nxt.split("api.appstoreconnect.apple.com/", 1)[1] if nxt else None
            werte = {}
        sag(f"  Gebiete gelistet {n}, davon verfuegbar {verf}")
    else:
        sag(f"  Apple: {kurz(aw)}")

    sag("— Gebiete, die Apple kennt (v1/territories)")
    sag(f"  {len(gebiete(apple))}")

    sag("— Preisplan (v1/apps/{id}/appPriceSchedule)")
    st2, aw2 = apple.holen(f"v1/apps/{app_id}/appPriceSchedule")
    sag(f"  HTTP {st2}" + ("" if st2 == 200 else f"  {kurz(aw2)}"))
    if st2 == 200:
        st3, bt = erste(apple, f"v1/appPriceSchedules/{aw2.json()['data']['id']}/baseTerritory")
        sag(f"  Basisgebiet: {bt['id'] if bt else '—'}")

    sag("— App (v1/apps/{id})")
    st4, aw4 = apple.holen(f"v1/apps/{app_id}")
    if st4 == 200:
        a = aw4.json()["data"].get("attributes") or {}
        sag("  " + json.dumps({k: a.get(k) for k in ("name", "bundleId", "primaryLocale",
                                                    "contentRightsDeclaration", "availableInNewTerritories")}))

    sag("— Fassungen")
    st5, aw5 = apple.holen(f"v1/apps/{app_id}/appStoreVersions", limit=10)
    for v in (aw5.json().get("data") or []) if st5 == 200 else []:
        sag(f"  {feld(v, 'versionString')}: {feld(v, 'appStoreState')} (Veroeffentlichung {feld(v, 'releaseType')}, "
            f"erstellt {feld(v, 'createdDate')})")
    return 0 if st == 200 else 1


def setzen(apple: Apple, app_id: str) -> int:
    st, _ = apple.holen(f"v1/apps/{app_id}/appAvailabilityV2")
    if st == 200:
        sag("Apple kennt bereits eine Verfuegbarkeit — nichts geschrieben.")
        return 0
    if st != 404:
        sag(f"! Unerwartete Antwort (HTTP {st}) — nichts geschrieben.")
        return 1
    ids = gebiete(apple)
    if len(ids) < 100:
        sag(f"! Nur {len(ids)} Gebiete gelesen — Abbruch, nichts geschrieben.")
        return 1
    sag(f"Lege Verfuegbarkeit an: {len(ids)} Gebiete, kuenftige Gebiete eingeschlossen …")
    koerper = {
        "data": {
            "type": "appAvailabilities",
            "attributes": {"availableInNewTerritories": True},
            "relationships": {
                "app": {"data": {"type": "apps", "id": app_id}},
                "territoryAvailabilities": {"data": [
                    {"type": "territoryAvailabilities", "id": f"${{t{i}}}"} for i in range(len(ids))]},
            },
        },
        "included": [{
            "type": "territoryAvailabilities", "id": f"${{t{i}}}",
            "attributes": {"available": True},
            "relationships": {"territory": {"data": {"type": "territories", "id": t}}},
        } for i, t in enumerate(ids)],
    }
    st, aw = apple.anlegen("v2/appAvailabilities", koerper)
    if st not in (200, 201):
        sag(f"! Anlegen abgelehnt (HTTP {st}): {kurz(aw)}")
        return 1
    sag(f"✓ Verfuegbarkeit angelegt (HTTP {st}).")
    return 0


def main() -> int:
    wirklich = "--setzen" in sys.argv[1:]
    if wirklich and os.environ.get("BESTAETIGUNG") != "VERFUEGBAR":
        sag("Zum Anlegen die Eingabe 'bestaetigung' auf VERFUEGBAR setzen.")
        return 1
    apple = Apple()
    st, app = erste(apple, "v1/apps", **{"filter[bundleId]": BUNDLE})
    if not app:
        sag(f"Kein App-Eintrag fuer {BUNDLE} (HTTP {st})")
        return 1
    sag(f"App {feld(app, 'name')} (ID {app['id']})" + ("" if wirklich else "  — NUR LESEN"))
    if wirklich:
        return setzen(apple, app["id"])
    lesen(apple, app["id"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
