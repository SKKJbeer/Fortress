#!/usr/bin/env python3
"""App Store Connect fuer FORTRESS — fragen und eintragen, statt klicken.

Drei Betriebsarten:

    --stand      liest nur und sagt, was Apple heute weiss (Vorgabe)
    --anlegen    registriert die App-ID, falls sie fehlt
    --fuellen    traegt ein, was aus dem Repository kommt

**Warum ein Skript und keine Anleitung.** Eine von Hand gepflegte Liste „was
fehlt noch" ist am Tag nach dem Nachfuehren wieder falsch. Dieses Skript fragt
Apple; was es ausgibt, ist der Zustand von heute.

**Was es bewusst NICHT kann** — nicht aus Bequemlichkeit, sondern weil Apples
Schnittstelle es nicht anbietet (drueben im Schwesterprojekt nachgemessen):

  * den App-Eintrag anlegen (es gibt kein POST auf /v1/apps)
  * den Datenschutz-Fragebogen ausfuellen
  * den Haendlerstatus nach dem EU-Digitale-Dienste-Gesetz setzen

Diese drei bleiben Handarbeit und werden am Ende einzeln benannt.

Umgebung: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 (der Dateiinhalt, nicht
kodiert). Fuer die Angaben zur Pruefung zusaetzlich ASC_KONTAKT_NAME,
ASC_KONTAKT_MAIL, ASC_KONTAKT_TELEFON — die liegen bewusst NICHT im
Repository, weil private Kontaktdaten in keine Datei gehoeren, die einmal
oeffentlich stehen koennte.
"""

import json
import os
import pathlib
import re
import sys
import time

import jwt
import requests

BASIS = "https://api.appstoreconnect.apple.com"
BUNDLE = "de.skkjbeer.fortress"
SPRACHE = "de-DE"
FASSUNG = "1.0"          # MARKETING_VERSION im Xcode-Projekt
WURZEL = pathlib.Path(__file__).resolve().parent.parent

erledigt: list[str] = []
offen: list[str] = []
handarbeit: list[str] = []


def token() -> str:
    jetzt = int(time.time())
    return jwt.encode(
        {"iss": os.environ["ASC_ISSUER_ID"], "iat": jetzt,
         "exp": jetzt + 600, "aud": "appstoreconnect-v1"},
        os.environ["ASC_KEY_P8"], algorithm="ES256",
        headers={"kid": os.environ["ASC_KEY_ID"]})


class Apple:
    def __init__(self) -> None:
        self.kopf = {"Authorization": f"Bearer {token()}",
                     "Content-Type": "application/json"}

    def holen(self, pfad: str, **werte):
        a = requests.get(f"{BASIS}/{pfad}", headers=self.kopf, params=werte, timeout=30)
        return a.status_code, a

    def anlegen(self, pfad: str, koerper: dict):
        a = requests.post(f"{BASIS}/{pfad}", headers=self.kopf,
                          data=json.dumps(koerper), timeout=60)
        return a.status_code, a

    def aendern(self, pfad: str, koerper: dict):
        a = requests.patch(f"{BASIS}/{pfad}", headers=self.kopf,
                           data=json.dumps(koerper), timeout=60)
        return a.status_code, a


def kurz(antwort) -> str:
    """Apples Fehlertext statt einer nackten Zahl."""
    try:
        fehler = antwort.json().get("errors", [])
        if fehler:
            e = fehler[0]
            return f"{e.get('title', '')} — {e.get('detail', '')}"[:250]
    except ValueError:
        pass
    return antwort.text[:250]


def erste(apple: Apple, pfad: str, **werte):
    """Ein Datensatz oder der erste einer Liste.

    OHNE `limit` bei Einzelressourcen: die antworten sonst mit 400, und das
    liest sich im Protokoll wie Apples Ablehnung, obwohl es die eigene Anfrage
    war.
    """
    stand, antwort = apple.holen(pfad, **werte)
    if stand != 200:
        return stand, None
    daten = antwort.json().get("data")
    if isinstance(daten, list):
        return stand, (daten[0] if daten else None)
    return stand, daten


def feld(eintrag, name: str):
    return (eintrag or {}).get("attributes", {}).get(name)


# ── Texte aus dem Repository ───────────────────────────────────────────────
# EINE Quelle: store/listing.md. Stuenden die Texte auch hier im Skript,
# liefen beide auseinander, und niemand wuesste, welcher bei Apple steht.

def bloecke() -> dict:
    """Liest die eingerahmten Bloecke unter den Ueberschriften der Store-Texte."""
    text = (WURZEL / "store" / "listing.md").read_text(encoding="utf-8")
    # Nur der Apple-Teil; Google Play hat eigene Grenzen und eigene Texte.
    apple_teil = text.split("## Google Play")[0]
    gefunden = {}
    for ueber, block in re.findall(r"### ([^\n(]+)[^\n]*\n+```\n(.*?)\n```",
                                   apple_teil, re.S):
        gefunden[ueber.strip()] = block.strip()
    return gefunden


# Apples Grenzen. Ueberschreitet ein Text sie, lehnt App Store Connect erst
# am ENDE einer Einreichung ab — deshalb hier, vor dem Schreiben.
GRENZEN = {"Name": 30, "Untertitel": 30, "Werbetext": 170,
           "Beschreibung": 4000, "Schlüsselwörter": 100}


def zu_lang(texte: dict) -> list[str]:
    return [f"{name}: {len(texte[name])} Zeichen, erlaubt {grenze}"
            for name, grenze in GRENZEN.items()
            if name in texte and len(texte[name]) > grenze]


def pruefhinweis() -> str | None:
    """Der englische Text fuer „App Review Information → Notes"."""
    text = (WURZEL / "store" / "listing.md").read_text(encoding="utf-8")
    treffer = re.search(r"```\n(NO ACCOUNT, NO LOGIN.*?)\n```", text, re.S)
    return treffer.group(1).strip() if treffer else None


# ── Die einzelnen Prüfungen ────────────────────────────────────────────────

def app_id(apple: Apple, anlegen: bool):
    stand, antwort = apple.holen("v1/bundleIds", **{"filter[identifier]": BUNDLE,
                                                    "limit": 20})
    if stand != 200:
        offen.append(f"App-IDs nicht lesbar ({stand}): {kurz(antwort)}")
        return None
    treffer = [e for e in antwort.json().get("data", [])
               if feld(e, "identifier") == BUNDLE]
    if treffer:
        erledigt.append(f"App-ID {BUNDLE} ist registriert")
        return treffer[0]["id"]
    if not anlegen:
        offen.append(f"App-ID {BUNDLE} fehlt — mit --anlegen wird sie registriert")
        return None
    stand, antwort = apple.anlegen("v1/bundleIds", {"data": {
        "type": "bundleIds",
        "attributes": {"identifier": BUNDLE, "name": "FORTRESS", "platform": "IOS"}}})
    if stand in (200, 201):
        erledigt.append(f"App-ID {BUNDLE} angelegt")
        return antwort.json()["data"]["id"]
    offen.append(f"App-ID liess sich nicht anlegen ({stand}): {kurz(antwort)}")
    return None


def app_eintrag(apple: Apple):
    stand, antwort = apple.holen("v1/apps", **{"filter[bundleId]": BUNDLE, "limit": 20})
    if stand != 200:
        offen.append(f"Apps nicht lesbar ({stand}): {kurz(antwort)}")
        return None
    treffer = [e for e in antwort.json().get("data", [])
               if feld(e, "bundleId") == BUNDLE]
    if not treffer:
        handarbeit.append(
            "App-Eintrag in App Store Connect anlegen — appstoreconnect.apple.com/apps, "
            f"Name „FORTRESS – Burgenduell\", Sprache Deutsch, Bundle-ID {BUNDLE}, "
            "SKU fortress-ios. Apples Schnittstelle bietet dafuer nichts an "
            "(kein POST auf /v1/apps); ohne diesen Eintrag laeuft nichts weiter.")
        return None
    erledigt.append(f"App-Eintrag vorhanden: {feld(treffer[0], 'name')}")
    return treffer[0]["id"]


def fassung(apple: Apple, app: str, fuellen: bool):
    """Die bearbeitbare Fassung — notfalls angelegt."""
    stand, antwort = apple.holen(f"v1/apps/{app}/appStoreVersions",
                                 **{"limit": 20, "filter[platform]": "IOS"})
    if stand != 200:
        offen.append(f"Fassungen nicht lesbar ({stand}): {kurz(antwort)}")
        return None
    for eintrag in antwort.json().get("data", []):
        zustand = feld(eintrag, "appStoreState") or feld(eintrag, "appVersionState")
        if zustand not in ("READY_FOR_SALE", "REMOVED_FROM_SALE"):
            erledigt.append(f"Fassung {feld(eintrag, 'versionString')} in Arbeit ({zustand})")
            return eintrag["id"]
    if not fuellen:
        offen.append("Keine bearbeitbare Fassung — mit --fuellen wird 1.0 angelegt")
        return None
    stand, antwort = apple.anlegen("v1/appStoreVersions", {"data": {
        "type": "appStoreVersions",
        "attributes": {"platform": "IOS", "versionString": FASSUNG},
        "relationships": {"app": {"data": {"type": "apps", "id": app}}}}})
    if stand in (200, 201):
        erledigt.append(f"Fassung {FASSUNG} angelegt")
        return antwort.json()["data"]["id"]
    offen.append(f"Fassung {FASSUNG} liess sich nicht anlegen ({stand}): {kurz(antwort)}")
    return None


def namen(apple: Apple, app: str, texte: dict, fuellen: bool):
    """Name, Untertitel und Datenschutz-Adresse — sie haengen an der App, nicht
    an der Fassung, und ueberdauern deshalb jede Version."""
    stand, info = erste(apple, f"v1/apps/{app}/appInfos", **{"limit": 10})
    if not info:
        offen.append(f"App-Angaben nicht lesbar ({stand})")
        return
    stand, ort = erste(apple, f"v1/appInfos/{info['id']}/appInfoLocalizations",
                       **{"limit": 20, "filter[locale]": SPRACHE})
    if not ort:
        offen.append(f"Deutsche App-Angaben nicht gefunden ({stand})")
        return
    soll = {"subtitle": texte.get("Untertitel"),
            "privacyPolicyUrl": "https://skkjbeer.github.io/Fortress/privacy.html"}
    fehlt = {k: v for k, v in soll.items() if v and feld(ort, k) != v}
    if not fehlt:
        erledigt.append("Untertitel und Datenschutz-Adresse stehen")
        return
    if not fuellen:
        offen.append(f"Einzutragen: {', '.join(fehlt)} — mit --fuellen")
        return
    stand, antwort = apple.aendern(f"v1/appInfoLocalizations/{ort['id']}", {"data": {
        "type": "appInfoLocalizations", "id": ort["id"], "attributes": fehlt}})
    (erledigt if stand == 200 else offen).append(
        f"Untertitel/Datenschutz-Adresse eingetragen" if stand == 200
        else f"Untertitel nicht eintragbar ({stand}): {kurz(antwort)}")


def texte_der_fassung(apple: Apple, version: str, texte: dict, fuellen: bool):
    stand, ort = erste(apple, f"v1/appStoreVersions/{version}/appStoreVersionLocalizations",
                       **{"limit": 20, "filter[locale]": SPRACHE})
    if not ort:
        offen.append(f"Deutsche Fassungstexte nicht gefunden ({stand})")
        return
    soll = {"description": texte.get("Beschreibung"),
            "keywords": texte.get("Schlüsselwörter"),
            "promotionalText": texte.get("Werbetext")}
    soll = {k: v for k, v in soll.items() if v}
    fehlt = {k: v for k, v in soll.items() if feld(ort, k) != v}
    if not fehlt:
        erledigt.append("Beschreibung, Schlagworte und Werbetext stehen")
        return
    if not fuellen:
        offen.append(f"Einzutragen: {', '.join(fehlt)} — mit --fuellen")
        return
    stand, antwort = apple.aendern(
        f"v1/appStoreVersionLocalizations/{ort['id']}",
        {"data": {"type": "appStoreVersionLocalizations", "id": ort["id"],
                  "attributes": fehlt}})
    (erledigt if stand == 200 else offen).append(
        f"Eingetragen: {', '.join(fehlt)}" if stand == 200
        else f"Fassungstexte nicht eintragbar ({stand}): {kurz(antwort)}")


def pruefangaben(apple: Apple, version: str, fuellen: bool):
    """Hinweise an die Pruefung und der Kontakt.

    Apple nimmt den Kontakt nur VOLLSTAENDIG. Fehlt die Telefonnummer, kommt
    „You must provide a value for the attribute 'contactPhone'", und dann steht
    gar kein Kontakt hinterlegt — nicht etwa ein halber.
    """
    stand, detail = erste(apple, f"v1/appStoreVersions/{version}/appStoreReviewDetail")
    hinweis = pruefhinweis()
    if not hinweis:
        offen.append("Pruefhinweis in store/listing.md nicht gefunden")
        return
    soll = {"notes": hinweis, "demoAccountRequired": False}

    name = os.environ.get("ASC_KONTAKT_NAME", "").strip()
    mail = os.environ.get("ASC_KONTAKT_MAIL", "").strip()
    tel = os.environ.get("ASC_KONTAKT_TELEFON", "").strip()
    if name and mail and tel:
        vorname, _, nachname = name.partition(" ")
        soll |= {"contactFirstName": vorname, "contactLastName": nachname or vorname,
                 "contactEmail": mail, "contactPhone": tel}
    else:
        fehlt = [n for n, v in (("ASC_KONTAKT_NAME", name), ("ASC_KONTAKT_MAIL", mail),
                                ("ASC_KONTAKT_TELEFON", tel)) if not v]
        handarbeit.append(
            f"Kontakt fuer die Pruefung: {', '.join(fehlt)} fehlt. Apple nimmt "
            "den Kontakt nur VOLLSTAENDIG — fehlt ein Teil, steht gar keiner "
            "hinterlegt, nicht etwa ein halber. Private Kontaktdaten gehoeren in "
            "Secrets, nicht in eine Datei, die oeffentlich stehen koennte.")

    if detail and all(feld(detail, k) == v for k, v in soll.items()):
        erledigt.append("Hinweise an die Pruefung stehen")
        return
    if not fuellen:
        offen.append("Hinweise an die Pruefung einzutragen — mit --fuellen")
        return
    if detail:
        stand, antwort = apple.aendern(f"v1/appStoreReviewDetails/{detail['id']}", {
            "data": {"type": "appStoreReviewDetails", "id": detail["id"],
                     "attributes": soll}})
    else:
        stand, antwort = apple.anlegen("v1/appStoreReviewDetails", {"data": {
            "type": "appStoreReviewDetails", "attributes": soll,
            "relationships": {"appStoreVersion": {
                "data": {"type": "appStoreVersions", "id": version}}}}})
    (erledigt if stand in (200, 201) else offen).append(
        "Hinweise an die Pruefung eingetragen" if stand in (200, 201)
        else f"Pruefhinweise nicht eintragbar ({stand}): {kurz(antwort)}")


def bauten(apple: Apple, app: str):
    stand, antwort = apple.holen("v1/builds", **{"filter[app]": app, "limit": 10,
                                                 "sort": "-uploadedDate"})
    if stand != 200:
        offen.append(f"Bauten nicht lesbar ({stand})")
        return
    daten = antwort.json().get("data", [])
    if not daten:
        offen.append("Noch kein Bau hochgeladen — Actions → iOS-Build, Haken bei „hochladen\"")
        return
    neu = daten[0]
    erledigt.append(f"Bau {feld(neu, 'version')} liegt in TestFlight "
                    f"({feld(neu, 'processingState')})")


def main() -> int:
    modus = set(sys.argv[1:]) or {"--stand"}
    fuellen = "--fuellen" in modus
    anlegen = "--anlegen" in modus or fuellen

    apple = Apple()
    texte = bloecke()

    # Zuerst die eigenen Texte messen. Ein zu langer Text kommt bei Apple sonst
    # durch die halbe Einreichung und faellt am Ende auf.
    zu = zu_lang(texte)
    if zu:
        for zeile in zu:
            print(f"::error::Text zu lang — {zeile}")
        return 1

    app_id(apple, anlegen)
    app = app_eintrag(apple)
    if app:
        version = fassung(apple, app, fuellen)
        namen(apple, app, texte, fuellen)
        if version:
            texte_der_fassung(apple, version, texte, fuellen)
            pruefangaben(apple, version, fuellen)
        bauten(apple, app)

    # Was keine Schnittstelle kann — immer, damit es nicht vergessen wird.
    handarbeit.append(
        "Datenschutz-Fragebogen: App Store → App-Datenschutz → Bearbeiten. "
        "Ohne ihn laesst sich nicht einreichen, und kein Schluessel kommt daran "
        "(drueben acht Pfade gemessen, alle „does not exist\").")
    handarbeit.append(
        "Haendlerstatus nach dem EU-Digitale-Dienste-Gesetz: Business → Agreements "
        "→ Compliance UND je App unter App Information. Steht er auf „In Pruefung\", "
        "scheitert jede Einreichung an einer Meldung, die ihn nicht erwaehnt.")

    print("\n=== ERLEDIGT " + "=" * 50)
    for zeile in erledigt or ["(nichts)"]:
        print("  ✓ " + zeile)
    print("\n=== OFFEN, MASCHINELL " + "=" * 42)
    for zeile in offen or ["(nichts)"]:
        print("  · " + zeile)
    print("\n=== NUR VON HAND " + "=" * 47)
    for zeile in handarbeit:
        print("  ! " + zeile)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
