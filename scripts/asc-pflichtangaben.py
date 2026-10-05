#!/usr/bin/env python3
"""Die Pflichtangaben, die Apple beim Einreichen einfordert (v3.117.1).

Anlass: Der erste echte Einreichungsversuch (05.10.2026) scheiterte mit 409 —
und Apples „associated errors" nannten fuenf fehlende Angaben, von denen
`asc-marktreif.py` keine gemeldet hatte (es sah „Preisplan vorhanden" und
meldete gruen, obwohl kein Preis gesetzt war):

    copyright                 Attribut der Fassung
    supportUrl                Attribut der Fassung-Lokalisierung
    contentRightsDeclaration  Attribut der App (Rechte an fremden Inhalten)
    Preis                     appPriceSchedule mit einem Preispunkt
    App-Datenschutz           appDataUsages veroeffentlicht

    (ohne Argument)   NUR LESEN: was steht, was fehlt, was bietet Apples
                      Schnittstelle fuer den Datenschutz-Fragebogen an?
    --eintragen       copyright, supportUrl und den Preis (kostenlos) eintragen
    --inhalte         zusaetzlich die Erklaerung zu fremden Inhalten (eine
                      RECHTSERKLAERUNG — nur mit ausdruecklichem Auftrag)

Alles wiederholbar: Jeder Schritt sieht nach, was schon steht.
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from asc import Apple, BUNDLE, FASSUNG, SPRACHE, erste, feld, kurz  # noqa: E402

sag = print

# Apple: „der Name der Person oder Firma, der die ausschliesslichen Rechte
# gehoeren, mit dem Jahr davor". Wie im Impressum (Diensteanbieter). Der Name
# steht bei Apple ohnehin als Anbieter auf jeder Produktseite.
COPYRIGHT = "2026 Steffen Karjoth"
# Ein echter Weg zum Betreiber, ohne Pflege: die Fehlerseite des Projekts.
SUPPORT_URL = "https://github.com/SKKJbeer/Fortress/issues"
# Kostenlos. Basisgebiet Deutschland; Apple rechnet die anderen Gebiete aus dem
# Preispunkt „0" selbst um.
BASISGEBIET = "DEU"
# „Enthaelt fremde Inhalte" — die CC0-Sounds und -Musik in CREDITS.md stammen
# von Dritten (Public Domain, Rechte liegen vor). Siehe --inhalte.
INHALTE = "USES_THIRD_PARTY_CONTENT"


def lage(apple):
    stand, app = erste(apple, "v1/apps", **{"filter[bundleId]": BUNDLE})
    if not app:
        sag(f"Kein App-Eintrag fuer {BUNDLE} (HTTP {stand})"); return None
    # Die EINZEL-Ressource lesen, nicht die Listenantwort: Gemessen am
    # 05.10.2026 lieferte die Liste `contentRightsDeclaration` nicht, obwohl das
    # PATCH mit 200 angenommen war — der Lauf meldete „FEHLT" trotz Erfolg.
    s1, einzeln = erste(apple, f"v1/apps/{app['id']}",
                        **{"fields[apps]": "name,contentRightsDeclaration"})
    if einzeln:
        app = einzeln
    stand, fass = erste(apple, f"v1/apps/{app['id']}/appStoreVersions",
                        **{"filter[versionString]": FASSUNG})
    if not fass:
        sag(f"Fassung {FASSUNG} nicht gefunden (HTTP {stand})"); return None
    stand, lok = erste(apple, f"v1/appStoreVersions/{fass['id']}/appStoreVersionLocalizations",
                       **{"filter[locale]": SPRACHE})
    return app, fass, lok


def lesen(apple, app, fass, lok):
    sag("Stand bei Apple")
    sag(f"  copyright:                {feld(fass, 'copyright') or '— FEHLT'}")
    sag(f"  supportUrl ({SPRACHE}):      {(feld(lok, 'supportUrl') if lok else None) or '— FEHLT'}")
    sag(f"  contentRightsDeclaration: {feld(app, 'contentRightsDeclaration') or '— FEHLT'}")

    stand, plan = erste(apple, f"v1/apps/{app['id']}/appPriceSchedule")
    if not plan:
        sag(f"  Preisplan:                — FEHLT (HTTP {stand})")
    else:
        s2, preise = apple.holen(f"v1/appPriceSchedules/{plan['id']}/manualPrices", limit=10)
        n = len(preise.json().get("data") or []) if s2 == 200 else None
        sag(f"  Preisplan:                {n} manuelle(r) Preis(e)" if n else
            f"  Preisplan:                vorhanden, aber OHNE Preis (HTTP {s2}) — das meinte Apple")

    # Was bietet die Schnittstelle fuer den Datenschutz-Fragebogen an?
    sag("\nApp-Datenschutz — was Apples Schnittstelle zeigt (nur lesen)")
    for pfad, werte in [
        (f"v1/apps/{app['id']}/appDataUsages", {"limit": 50}),
        (f"v1/apps/{app['id']}/appDataUsagesPublishState", {}),
        ("v1/appDataUsageCategories", {"limit": 50}),
        ("v1/appDataUsagePurposes", {"limit": 50}),
        ("v1/appDataUsageDataProtections", {"limit": 50}),
    ]:
        stand, antwort = apple.holen(pfad, **werte)
        if stand == 200:
            daten = antwort.json().get("data")
            if isinstance(daten, list):
                ids = ", ".join(str(d.get("id")) for d in daten[:60])
                sag(f"  {pfad.split('/')[-1]}: HTTP 200, {len(daten)} Eintraege: {ids[:900]}")
            else:
                sag(f"  {pfad.split('/')[-1]}: HTTP 200, {str((daten or {}).get('attributes'))[:200]}")
        else:
            sag(f"  {pfad.split('/')[-1]}: HTTP {stand} — {kurz(antwort)[:160]}")


def eintragen(apple, app, fass, lok, inhalte):
    fehler = 0
    # copyright
    if feld(fass, "copyright") == COPYRIGHT:
        sag("  ✓ copyright steht")
    else:
        s, a = apple.aendern(f"v1/appStoreVersions/{fass['id']}", {"data": {
            "type": "appStoreVersions", "id": fass["id"], "attributes": {"copyright": COPYRIGHT}}})
        sag(f"  ✓ copyright: {COPYRIGHT}" if s == 200 else f"  ! copyright ({s}): {kurz(a)}")
        fehler += s != 200
    # supportUrl
    if not lok:
        sag("  ! Keine Lokalisierung — supportUrl nicht setzbar"); fehler += 1
    elif feld(lok, "supportUrl") == SUPPORT_URL:
        sag("  ✓ supportUrl steht")
    else:
        s, a = apple.aendern(f"v1/appStoreVersionLocalizations/{lok['id']}", {"data": {
            "type": "appStoreVersionLocalizations", "id": lok["id"],
            "attributes": {"supportUrl": SUPPORT_URL}}})
        sag(f"  ✓ supportUrl: {SUPPORT_URL}" if s == 200 else f"  ! supportUrl ({s}): {kurz(a)}")
        fehler += s != 200
    # Preis: kostenlos
    stand, plan = erste(apple, f"v1/apps/{app['id']}/appPriceSchedule")
    hat = False
    if plan:
        s2, preise = apple.holen(f"v1/appPriceSchedules/{plan['id']}/manualPrices", limit=10)
        hat = s2 == 200 and bool(preise.json().get("data"))
    if hat:
        sag("  ✓ Preis steht")
    else:
        s, a = apple.holen(f"v1/apps/{app['id']}/appPricePoints",
                           **{"filter[territory]": BASISGEBIET, "limit": 200})
        punkte = (a.json().get("data") or []) if s == 200 else []
        null = [p for p in punkte if str(feld(p, "customerPrice")) in ("0", "0.0", "0.00")]
        if not null:
            sag(f"  ! Kein Preispunkt „0\" gefunden (HTTP {s}, {len(punkte)} Punkte)"); fehler += 1
        else:
            pp = null[0]["id"]
            s, a = apple.anlegen("v1/appPriceSchedules", {
                "data": {"type": "appPriceSchedules", "relationships": {
                    "app": {"data": {"type": "apps", "id": app["id"]}},
                    "baseTerritory": {"data": {"type": "territories", "id": BASISGEBIET}},
                    "manualPrices": {"data": [{"type": "appPrices", "id": "${preis0}"}]}}},
                "included": [{"type": "appPrices", "id": "${preis0}",
                              "attributes": {"startDate": None},
                              "relationships": {"appPricePoint": {
                                  "data": {"type": "appPricePoints", "id": pp}}}}]})
            sag("  ✓ Preis: kostenlos" if s in (200, 201) else f"  ! Preis ({s}): {kurz(a)}")
            fehler += s not in (200, 201)
    # fremde Inhalte — nur mit ausdruecklichem Auftrag
    if inhalte:
        if feld(app, "contentRightsDeclaration") == INHALTE:
            sag("  ✓ Erklaerung zu fremden Inhalten steht")
        else:
            s, a = apple.aendern(f"v1/apps/{app['id']}", {"data": {
                "type": "apps", "id": app["id"],
                "attributes": {"contentRightsDeclaration": INHALTE}}})
            sag(f"  ✓ Fremde Inhalte: {INHALTE}" if s == 200 else f"  ! Inhalte ({s}): {kurz(a)}")
            fehler += s != 200
    else:
        sag("  · Erklaerung zu fremden Inhalten NICHT gesetzt (nur mit --inhalte)")
    return 1 if fehler else 0


def main() -> int:
    args = set(sys.argv[1:])
    apple = Apple()
    gefunden = lage(apple)
    if not gefunden:
        return 1
    app, fass, lok = gefunden
    sag(f"App {feld(app, 'name')}, Fassung {FASSUNG} ({feld(fass, 'appStoreState')})\n")
    if "--eintragen" in args or "--inhalte" in args:
        sag("Eintragen")
        rc = eintragen(apple, app, fass, lok, "--inhalte" in args)
        sag("")
        gefunden = lage(apple)
        if gefunden:
            lesen(apple, *gefunden)
        return rc
    lesen(apple, app, fass, lok)
    return 0


if __name__ == "__main__":
    sys.exit(main())
