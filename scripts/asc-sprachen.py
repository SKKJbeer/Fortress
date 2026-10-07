#!/usr/bin/env python3
"""Weitere Sprachfassungen des Store-Eintrags (v3.117.x).

Bis 07.10.2026 gab es den Eintrag nur auf Deutsch — fuer jede englische Suche
in jedem Store unsichtbar, obwohl das Spiel laengst englisch spielbar ist (es
folgt der Geraetesprache). Dieses Skript legt die englischen Fassungen an und
haelt sie mit `store/listing-en.md` gleich.

    (ohne Argument)   NUR LESEN: welche Sprachfassungen gibt es, was weicht ab?
    --eintragen       fehlende Fassungen anlegen, abweichende Felder angleichen

Je Sprache zwei Stellen bei Apple:
  appInfoLocalization         Name, Untertitel, Datenschutz-Adresse (an der App)
  appStoreVersionLocalization Beschreibung, Schlagworte, Werbetext, Support-
                              und Marketing-Adresse (an der Fassung)

Bildschirmfotos: Hat eine Sprache keine eigenen, zeigt Apple die der
Hauptsprache. Das reicht fuer den Anfang; eigene englische Bilder sind ein
eigener Schritt.
"""

import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from asc import Apple, BUNDLE, FASSUNG, WURZEL, erste, feld, kurz  # noqa: E402

sag = print
SPRACHEN = ["en-US", "en-GB"]
DATENSCHUTZ = "https://skkjbeer.github.io/Fortress/privacy.html"
SUPPORT = "https://github.com/SKKJbeer/Fortress/issues"
MARKETING = "https://stack-and-siege.pages.dev/en/"
GRENZEN = {"Name": 30, "Untertitel": 30, "Werbetext": 170,
           "Beschreibung": 4000, "Schlüsselwörter": 100}


def texte() -> dict:
    t = (WURZEL / "store" / "listing-en.md").read_text(encoding="utf-8")
    return {h.strip(): b.strip() for h, b in
            re.findall(r"### ([^\n(]+)[^\n]*\n+```\n(.*?)\n```", t, re.S)}


def angleichen(apple, pfad_liste, typ, rel_name, rel_typ, rel_id, sprache, soll, schreiben):
    """Eine Sprachfassung anlegen oder ihre Felder angleichen. Liefert Fehlerzahl."""
    stand, ort = erste(apple, pfad_liste, **{"filter[locale]": sprache, "limit": 5})
    if stand != 200:
        sag(f"  ! {typ} {sprache} nicht lesbar ({stand})"); return 1
    if not ort:
        if not schreiben:
            sag(f"  · {typ} {sprache}: FEHLT — wuerde angelegt"); return 0
        s, a = apple.anlegen(f"v1/{typ}", {"data": {
            "type": typ, "attributes": {"locale": sprache, **soll},
            "relationships": {rel_name: {"data": {"type": rel_typ, "id": rel_id}}}}})
        sag(f"  ✓ {typ} {sprache} angelegt" if s in (200, 201) else f"  ! {typ} {sprache} ({s}): {kurz(a)}")
        return 0 if s in (200, 201) else 1
    abweichend = {k: v for k, v in soll.items() if feld(ort, k) != v}
    if not abweichend:
        sag(f"  ✓ {typ} {sprache}: steht"); return 0
    if not schreiben:
        sag(f"  · {typ} {sprache}: weicht ab in {', '.join(abweichend)}"); return 0
    s, a = apple.aendern(f"v1/{typ}/{ort['id']}", {"data": {
        "type": typ, "id": ort["id"], "attributes": abweichend}})
    sag(f"  ✓ {typ} {sprache}: angeglichen ({', '.join(abweichend)})" if s == 200
        else f"  ! {typ} {sprache} ({s}): {kurz(a)}")
    return 0 if s == 200 else 1


def main() -> int:
    schreiben = "--eintragen" in sys.argv[1:]
    t = texte()
    zu_lang = [f"{k}: {len(t[k])}/{g}" for k, g in GRENZEN.items() if len(t.get(k, "")) > g]
    if zu_lang:
        sag("Zu lang: " + ", ".join(zu_lang)); return 1
    apple = Apple()
    stand, app = erste(apple, "v1/apps", **{"filter[bundleId]": BUNDLE})
    if not app:
        sag(f"Kein App-Eintrag (HTTP {stand})"); return 1
    stand, info = erste(apple, f"v1/apps/{app['id']}/appInfos", limit=10)
    stand, fass = erste(apple, f"v1/apps/{app['id']}/appStoreVersions",
                        **{"filter[versionString]": FASSUNG})
    if not info or not fass:
        sag("App-Angaben oder Fassung nicht lesbar"); return 1
    # Bestand zeigen: welche Sprachen gibt es ueberhaupt?
    for pfad, was in [(f"v1/appInfos/{info['id']}/appInfoLocalizations", "App-Angaben"),
                      (f"v1/appStoreVersions/{fass['id']}/appStoreVersionLocalizations", "Fassungstexte")]:
        s, a = apple.holen(pfad, limit=50)
        orte = [feld(o, "locale") for o in (a.json().get("data") or [])] if s == 200 else []
        sag(f"{was}: vorhandene Sprachen {', '.join(orte) or '-'}")
    sag("\nEINTRAGEN" if schreiben else "\nNUR LESEN")
    fehler = 0
    for sprache in SPRACHEN:
        fehler += angleichen(apple, f"v1/appInfos/{info['id']}/appInfoLocalizations",
                             "appInfoLocalizations", "appInfo", "appInfos", info["id"], sprache,
                             {"name": t["Name"], "subtitle": t["Untertitel"],
                              "privacyPolicyUrl": DATENSCHUTZ}, schreiben)
        fehler += angleichen(apple, f"v1/appStoreVersions/{fass['id']}/appStoreVersionLocalizations",
                             "appStoreVersionLocalizations", "appStoreVersion", "appStoreVersions",
                             fass["id"], sprache,
                             {"description": t["Beschreibung"], "keywords": t["Schlüsselwörter"],
                              "promotionalText": t["Werbetext"], "supportUrl": SUPPORT,
                              "marketingUrl": MARKETING}, schreiben)
    return 1 if fehler else 0


if __name__ == "__main__":
    sys.exit(main())
