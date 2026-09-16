#!/usr/bin/env python3
"""Den Store-Eintrag fuellen, soweit Apples Schnittstelle es zulaesst.

`asc.py --fuellen` traegt die TEXTE ein. Was zur Einreichung sonst noch fehlt,
steht nicht im Repository, sondern ist eine Einstellung am Eintrag:

    --kategorien     Haupt- und Unterkategorie
    --altersfreigabe den Inhaltsfragebogen
    --bau            den neuesten gueltigen Bau an die Fassung haengen
    --bilder         die Bildschirmfotos hochladen
    --alles          alle vier

    --trocken        nichts schreiben, nur sagen, was geschehen wuerde

**Alles ist wiederholbar.** Jeder Schritt sieht erst nach, was schon steht, und
tut nur, was fehlt. Ein zweiter Lauf soll nichts kaputtmachen und nichts
verdoppeln — sonst traut sich niemand, ihn laufen zu lassen.

**Eingereicht wird hier nichts.** Das Einreichen ist der eine Schritt, der sich
nicht zuruecknehmen laesst, und zwei Dinge davor kann nur ein Mensch erledigen
(Datenschutz-Fragebogen, Haendlerstatus).
"""

import hashlib
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from asc import Apple, BASIS, BUNDLE, FASSUNG, SPRACHE, WURZEL, erste, feld, kurz  # noqa: E402

import requests  # noqa: E402

# ── Kategorien ─────────────────────────────────────────────────────────────
# „Strategie" vor „Puzzle": Das Spiel entscheidet sich an Entscheidungen —
# wohin baue ich, wann kaufe ich, wann feuere ich —, nicht am Loesen einer
# vorgegebenen Aufgabe. Die fallenden Steine sind das Mittel, nicht der Zweck.
HAUPT = "GAMES"
UNTER_EINS = "GAMES_STRATEGY"
UNTER_ZWEI = "GAMES_PUZZLE"

# ── Altersfreigabe ─────────────────────────────────────────────────────────
# Eine Erklaerung ueber den INHALT, keine Geschmacksfrage. Begruendung je Wert,
# damit sie jemand nachpruefen kann, statt sie zu glauben:
#
#   Kanonen schiessen auf Mauern aus Bloecken; es gibt keine Figuren, kein
#   Blut, keine Verletzten. Das ist Zeichentrick-Gewalt, und sie ist mild —
#   deshalb INFREQUENT_OR_MILD und nicht NONE: Beschuss IST das Spiel.
#
#   Alles Uebrige kommt nicht vor: keine Sprache, keine Themen, kein
#   Gluecksspiel (Gold ist erspielt, es gibt keinen Einsatz und keinen Kauf),
#   kein Netzzugang in der App, keine Gewinnspiele.
ANTWORTEN = {
    # ── Inhalt: wie haeufig und wie stark ────────────────────────────────
    # Kanonen schiessen auf Mauern aus Bloecken. Keine Figuren, kein Blut,
    # keine Verletzten. Zeichentrick-Gewalt, und sie ist mild — nicht NONE,
    # denn Beschuss IST das Spiel.
    "violenceCartoonOrFantasy": "INFREQUENT_OR_MILD",
    # Kanonen sind Waffen; das zu verschweigen waere ein vermeidbarer
    # Ablehnungsgrund. Mild, weil Ziel immer Mauerwerk ist, nie ein Lebewesen.
    # Entscheidung des Gruenders vom 16.09.
    "gunsOrOtherWeapons": "INFREQUENT_OR_MILD",
    "violenceRealistic": "NONE",
    "violenceRealisticProlongedGraphicOrSadistic": "NONE",
    "profanityOrCrudeHumor": "NONE",
    "matureOrSuggestiveThemes": "NONE",
    "horrorOrFearThemes": "NONE",
    "medicalOrTreatmentInformation": "NONE",
    "healthOrWellnessTopics": "NONE",
    "alcoholTobaccoOrDrugUseOrReferences": "NONE",
    "sexualContentOrNudity": "NONE",
    "sexualContentGraphicAndNudity": "NONE",
    # Gold ist erspielt. Es gibt keinen Einsatz, keinen Kauf und keine
    # Zufallsziehung — die Tages-Kiste gibt fest eine Drachenschuppe.
    "gamblingSimulated": "NONE",
    "gambling": False,
    "lootBox": False,
    "contests": "NONE",
    # ── Was die App kann und was nicht ───────────────────────────────────
    "unrestrictedWebAccess": False,
    "advertising": False,
    # Emotes sind SECHS FESTE Symbole, kein freier Text. Das ist keine
    # Unterhaltung im Sinne der Frage.
    "messagingAndChat": False,
    "socialMedia": False,
    "socialMediaAgeRestricted": False,
    # Das Einzige, was ein Spieler selbst erzeugt und was andere sehen, ist
    # sein Anzeigename (16 Zeichen). Kein Erstellen, kein Teilen, keine
    # Beitraege. Entscheidung des Gruenders vom 16.09.: Nein.
    # WENN das je zur Rueckfrage fuehrt, ist die Antwort nicht „umdeklarieren",
    # sondern Filter, Meldung und Sperre nachruesten — Richtlinie 1.2.
    "userGeneratedContent": False,
    "parentalControls": False,
    "ageAssurance": False,
}

# ── Bildschirmfotos ────────────────────────────────────────────────────────
# Pflicht sind 6,7" und — solange die App auf dem iPad laeuft — 12,9".
# Die Reihenfolge ist die Reihenfolge im Store; das Menue steht vorn, weil es
# den Namen traegt, danach der Takt des Spiels.
BILDER = {
    "APP_IPHONE_67":          ("store/ios-6.7",   ["menu", "game", "shoot", "shop"]),
    "APP_IPAD_PRO_3GEN_129":  ("store/ipad-12.9", ["menu", "game", "shoot", "shop"]),
}

sag = print


def kategorien(apple: Apple, app_id: str, trocken: bool):
    stand, antwort = apple.holen(f"v1/apps/{app_id}/appInfos")
    if stand != 200:
        sag(f"  ! Kategorien: appInfos nicht lesbar (HTTP {stand})"); return
    daten = antwort.json().get("data") or []
    if not daten:
        sag("  ! Kategorien: kein appInfo-Datensatz"); return
    for eintrag in daten:
        bez = eintrag.get("relationships", {})
        hat = ((bez.get("primaryCategory") or {}).get("data") or {}).get("id")
        if hat == HAUPT:
            sag(f"  ✓ Kategorie steht bereits: {hat}"); return
    ziel = daten[0]["id"]
    if trocken:
        sag(f"  → wuerde setzen: {HAUPT} / {UNTER_EINS} / {UNTER_ZWEI}"); return
    koerper = {"data": {"type": "appInfos", "id": ziel, "relationships": {
        "primaryCategory": {"data": {"type": "appCategories", "id": HAUPT}},
        "primarySubcategoryOne": {"data": {"type": "appCategories", "id": UNTER_EINS}},
        "primarySubcategoryTwo": {"data": {"type": "appCategories", "id": UNTER_ZWEI}},
    }}}
    stand, antwort = apple.aendern(f"v1/appInfos/{ziel}", koerper)
    sag(f"  ✓ Kategorie gesetzt: {HAUPT} / {UNTER_EINS} / {UNTER_ZWEI}" if stand == 200
        else f"  ! Kategorie nicht setzbar ({stand}): {kurz(antwort)}")


def altersfreigabe(apple: Apple, app_id: str, trocken: bool):
    stand, antwort = apple.holen(f"v1/apps/{app_id}/appInfos")
    if stand != 200:
        sag(f"  ! Altersfreigabe: appInfos nicht lesbar (HTTP {stand})"); return
    info = (antwort.json().get("data") or [None])[0]
    if not info:
        sag("  ! Altersfreigabe: kein appInfo-Datensatz"); return
    stand, erkl = erste(apple, f"v1/appInfos/{info['id']}/ageRatingDeclaration")
    if stand != 200 or not erkl:
        sag(f"  ! Altersfreigabe: kein Fragebogen (HTTP {stand})"); return
    ist = erkl.get("attributes") or {}
    # NUR Schluessel setzen, die Apple selbst zurueckgibt. Apple hat den
    # Fragebogen 2025 umgebaut; ein erfundener Schluessel bringt die ganze
    # Anfrage zu Fall, und dann steht wieder gar nichts.
    soll = {k: v for k, v in ANTWORTEN.items() if k in ist}
    unbekannt = [k for k in ANTWORTEN if k not in ist]
    fremd = [k for k in ist if k not in ANTWORTEN and ist[k] in (None, "")]
    if unbekannt:
        sag("  ? kennt Apple nicht (uebersprungen): " + ", ".join(unbekannt))
    if fremd:
        sag("  ? von Apple erwartet, von uns nicht beantwortet: " + ", ".join(fremd))
    if all(ist.get(k) == v for k, v in soll.items()):
        sag("  ✓ Altersfreigabe steht bereits"); return
    if trocken:
        sag("  → wuerde erklaeren: " + json.dumps(soll, ensure_ascii=False)); return
    stand, antwort = apple.aendern(f"v1/ageRatingDeclarations/{erkl['id']}",
                                   {"data": {"type": "ageRatingDeclarations",
                                             "id": erkl["id"], "attributes": soll}})
    if stand == 200:
        sag("  ✓ Altersfreigabe erklaert:")
        for k, v in sorted(soll.items()):
            sag(f"      {k} = {v}")
    else:
        sag(f"  ! Altersfreigabe nicht setzbar ({stand}): {kurz(antwort)}")


def bau_anhaengen(apple: Apple, app_id: str, fass_id: str, trocken: bool):
    stand, bau = erste(apple, f"v1/appStoreVersions/{fass_id}/build")
    if stand == 200 and bau:
        sag(f"  ✓ Bau {feld(bau, 'version')} haengt bereits an der Fassung"); return
    stand, antwort = apple.holen(f"v1/builds", **{
        "filter[app]": app_id, "filter[processingState]": "VALID",
        "sort": "-version", "limit": 1})
    neu = (antwort.json().get("data") or [None])[0] if stand == 200 else None
    if not neu:
        sag(f"  ! Kein gueltiger Bau gefunden (HTTP {stand})"); return
    if trocken:
        sag(f"  → wuerde Bau {feld(neu, 'version')} anhaengen"); return
    stand, antwort = apple.aendern(
        f"v1/appStoreVersions/{fass_id}/relationships/build",
        {"data": {"type": "builds", "id": neu["id"]}})
    sag(f"  ✓ Bau {feld(neu, 'version')} an die Fassung gehaengt" if stand == 204
        else f"  ! Bau nicht anhaengbar ({stand}): {kurz(antwort)}")


def bilder(apple: Apple, fass_id: str, trocken: bool):
    stand, lok = erste(apple, f"v1/appStoreVersions/{fass_id}/appStoreVersionLocalizations",
                       **{"filter[locale]": SPRACHE})
    if not lok:
        sag(f"  ! Keine Sprachfassung {SPRACHE} (HTTP {stand})"); return
    stand, antwort = apple.holen(f"v1/appStoreVersionLocalizations/{lok['id']}/appScreenshotSets")
    vorhanden = {}
    if stand == 200:
        for satz in antwort.json().get("data") or []:
            vorhanden[feld(satz, "screenshotDisplayType")] = satz["id"]

    for typ, (ordner, namen) in BILDER.items():
        satz_id = vorhanden.get(typ)
        anzahl = 0
        if satz_id:
            st, aw = apple.holen(f"v1/appScreenshotSets/{satz_id}/appScreenshots")
            anzahl = len(aw.json().get("data") or []) if st == 200 else 0
        if anzahl >= len(namen):
            sag(f"  ✓ {typ}: {anzahl} Bilder liegen bereits"); continue
        dateien = [WURZEL / ordner / f"{n}.png" for n in namen]
        fehlend = [d for d in dateien if not d.exists()]
        if fehlend:
            sag(f"  ! {typ}: Datei fehlt: {fehlend[0]}"); continue
        if trocken:
            sag(f"  → {typ}: wuerde {len(dateien)} Bilder aus {ordner} hochladen"); continue
        if not satz_id:
            st, aw = apple.anlegen("v1/appScreenshotSets", {"data": {
                "type": "appScreenshotSets",
                "attributes": {"screenshotDisplayType": typ},
                "relationships": {"appStoreVersionLocalization": {"data": {
                    "type": "appStoreVersionLocalizations", "id": lok["id"]}}}}})
            if st not in (200, 201):
                sag(f"  ! {typ}: Satz nicht anlegbar ({st}): {kurz(aw)}"); continue
            satz_id = aw.json()["data"]["id"]
        gut = 0
        for datei in dateien:
            if hochladen(apple, satz_id, datei):
                gut += 1
            else:
                break
        sag(f"  ✓ {typ}: {gut} von {len(dateien)} Bildern hochgeladen"
            if gut == len(dateien) else f"  ! {typ}: nur {gut} von {len(dateien)}")


def hochladen(apple: Apple, satz_id: str, datei: pathlib.Path) -> bool:
    """Apples dreistufiger Weg: anmelden, Stuecke schicken, bestaetigen."""
    inhalt = datei.read_bytes()
    st, aw = apple.anlegen("v1/appScreenshots", {"data": {
        "type": "appScreenshots",
        "attributes": {"fileSize": len(inhalt), "fileName": datei.name},
        "relationships": {"appScreenshotSet": {"data": {
            "type": "appScreenshotSets", "id": satz_id}}}}})
    if st not in (200, 201):
        sag(f"      ! {datei.name} nicht angemeldet ({st}): {kurz(aw)}"); return False
    eintrag = aw.json()["data"]
    for op in eintrag["attributes"].get("uploadOperations") or []:
        teil = inhalt[op["offset"]: op["offset"] + op["length"]]
        kopf = {k["name"]: k["value"] for k in (op.get("requestHeaders") or [])}
        a = requests.request(op["method"], op["url"], headers=kopf, data=teil, timeout=180)
        if a.status_code not in (200, 201, 204):
            sag(f"      ! {datei.name}: Stueck abgelehnt ({a.status_code})"); return False
    st, aw = apple.aendern(f"v1/appScreenshots/{eintrag['id']}", {"data": {
        "type": "appScreenshots", "id": eintrag["id"],
        "attributes": {"uploaded": True,
                       "sourceFileChecksum": hashlib.md5(inhalt).hexdigest()}}})
    if st != 200:
        sag(f"      ! {datei.name} nicht bestaetigt ({st}): {kurz(aw)}"); return False
    return True


def main() -> int:
    argumente = set(sys.argv[1:])
    trocken = "--trocken" in argumente
    alles = "--alles" in argumente or not (argumente - {"--trocken"})
    apple = Apple()

    stand, app = erste(apple, "v1/apps", **{"filter[bundleId]": BUNDLE})
    if not app:
        sag(f"Kein App-Eintrag fuer {BUNDLE} (HTTP {stand})"); return 1
    app_id = app["id"]
    stand, fass = erste(apple, f"v1/apps/{app_id}/appStoreVersions",
                        **{"filter[versionString]": FASSUNG})
    if not fass:
        sag(f"Fassung {FASSUNG} nicht gefunden (HTTP {stand})"); return 1
    fass_id = fass["id"]
    sag(f"App {feld(app, 'name')}, Fassung {FASSUNG} ({feld(fass, 'appStoreState')})"
        + ("  — TROCKENLAUF, es wird nichts geschrieben" if trocken else ""))

    if alles or "--kategorien" in argumente:
        sag("\nKategorien"); kategorien(apple, app_id, trocken)
    if alles or "--altersfreigabe" in argumente:
        sag("\nAltersfreigabe"); altersfreigabe(apple, app_id, trocken)
    if alles or "--bau" in argumente:
        sag("\nBau an die Fassung"); bau_anhaengen(apple, app_id, fass_id, trocken)
    if alles or "--bilder" in argumente:
        sag("\nBildschirmfotos"); bilder(apple, fass_id, trocken)

    sag("\nEingereicht wird hier nichts — das bleibt ein eigener, bewusster Schritt.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
