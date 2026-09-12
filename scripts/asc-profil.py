#!/usr/bin/env python3
"""Legt ein Verteilprofil an und installiert es — damit der Bau ohne Geraet geht.

**Warum das noetig ist.** `xcodebuild archive` mit `CODE_SIGN_STYLE=Automatic`
besorgt sich ein **Development**-Profil. Ein solches verlangt mindestens ein
registriertes Geraet, und ein Konto ohne Geraet bekommt keins:

    Communication with Apple failed: Your team has no devices from which to
    generate a provisioning profile.

Genau daran sind die Laeufe 10 und 11 gescheitert. `-configuration Release`
half nicht, weil die Profilart nicht an der Konfiguration haengt, und
`-allowProvisioningUpdates` auch nicht: es darf Profile anlegen, waehlt aber
weiterhin die Entwicklungsart.

Der Ausweg ist **manuelle** Signierung mit einem App-Store-Profil, hier ueber
die Schnittstelle angelegt und in den Ordner gelegt, den `xcodebuild` liest.
Kein Geraet, kein Anmeldefenster, kein Klick im Portal.

Der Profilname geht nach `$GITHUB_ENV`, damit der Bauschritt ihn als
`PROVISIONING_PROFILE_SPECIFIER` uebergeben kann.

Aus der Umgebung: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8
"""

import base64
import json
import os
import pathlib
import sys
import time

import jwt
import requests

BASIS = "https://api.appstoreconnect.apple.com/v1"
BUNDLE = "de.skkjbeer.stackandsiege"
NAME = "Stack and Siege App Store"
ART = "IOS_APP_STORE"
ORDNER = pathlib.Path.home() / "Library/MobileDevice/Provisioning Profiles"


def abbruch(text: str, rat: str = "") -> None:
    print(f"::error::{text}")
    if rat:
        print(rat)
    sys.exit(1)


def anmeldung() -> str:
    jetzt = int(time.time())
    try:
        return jwt.encode(
            {"iss": os.environ["ASC_ISSUER_ID"], "iat": jetzt,
             "exp": jetzt + 600, "aud": "appstoreconnect-v1"},
            os.environ["ASC_KEY_P8"], algorithm="ES256",
            headers={"kid": os.environ["ASC_KEY_ID"], "typ": "JWT"})
    except Exception as fehler:  # noqa: BLE001
        abbruch(f"Der Schluessel liess sich nicht lesen: {fehler}")
    return ""


class Apple:
    def __init__(self, token: str) -> None:
        self.kopf = {"Authorization": f"Bearer {token}",
                     "Content-Type": "application/json"}

    def holen(self, pfad: str, **werte) -> dict:
        a = requests.get(f"{BASIS}/{pfad}", headers=self.kopf, params=werte, timeout=30)
        if a.status_code != 200:
            abbruch(f"GET {pfad} scheiterte ({a.status_code}): {a.text[:300]}")
        return a.json()

    def anlegen(self, pfad: str, koerper: dict):
        return requests.post(f"{BASIS}/{pfad}", headers=self.kopf,
                             data=json.dumps(koerper), timeout=30)

    def loeschen(self, pfad: str) -> None:
        requests.delete(f"{BASIS}/{pfad}", headers=self.kopf, timeout=30)


def kennung(apple: Apple) -> str:
    daten = apple.holen("bundleIds", **{"filter[identifier]": BUNDLE,
                                        "limit": 200}).get("data", [])
    # **Genau vergleichen, nicht auf den Filter vertrauen.** Apple filtert hier
    # als Praefix — eine Abfrage nach der App-Kennung liefert auch die eines
    # spaeteren Erweiterungsziels mit, und wer den ersten Treffer nimmt,
    # signiert die App mit dem falschen Profil.
    for eintrag in daten:
        if eintrag["attributes"]["identifier"] == BUNDLE:
            return eintrag["id"]
    abbruch(f"Die Kennung {BUNDLE} ist bei Apple nicht registriert.",
            "Mit „App Store (Stand / Eintragen)\" im Modus „anlegen\" nachholen.")
    return ""


def zertifikate(apple: Apple) -> list:
    daten = apple.holen("certificates",
                        **{"filter[certificateType]": "DISTRIBUTION",
                           "limit": 200}).get("data", [])
    if not daten:
        abbruch("Kein Verteilzertifikat im Konto.")
    # Alle mitnehmen: welcher private Schluessel auf dem Laeufer liegt, weiss
    # nur der Schluesselbund. Ein Profil mit mehreren Zertifikaten passt in
    # jedem Fall — eines mit dem falschen passt in keinem.
    return [{"type": "certificates", "id": e["id"]} for e in daten]


def main() -> int:
    apple = Apple(anmeldung())
    certs = zertifikate(apple)
    print(f"{len(certs)} Verteilzertifikat(e) im Konto")

    # Ein Profil dieses Namens kann aus einem frueheren Lauf stammen und ein
    # Zertifikat fuehren, das es nicht mehr gibt. Wegwerfen und neu anlegen ist
    # billiger als pruefen, ob es noch passt.
    for alt in apple.holen("profiles", **{"filter[name]": NAME,
                                          "limit": 200}).get("data", []):
        if alt["attributes"]["name"] == NAME:
            apple.loeschen(f"profiles/{alt['id']}")
            print(f"  altes Profil „{NAME}\" verworfen")

    antwort = apple.anlegen("profiles", {"data": {
        "type": "profiles",
        "attributes": {"name": NAME, "profileType": ART},
        "relationships": {
            "bundleId": {"data": {"type": "bundleIds", "id": kennung(apple)}},
            "certificates": {"data": certs},
        }}})
    if antwort.status_code != 201:
        abbruch(f"Profil abgelehnt ({antwort.status_code}): {antwort.text[:400]}")

    merkmale = antwort.json()["data"]["attributes"]
    ORDNER.mkdir(parents=True, exist_ok=True)
    ziel = ORDNER / f"{merkmale['uuid']}.mobileprovision"
    ziel.write_bytes(base64.b64decode(merkmale["profileContent"]))
    print(f"  {BUNDLE} → „{NAME}\" ({merkmale['uuid']}), "
          f"laeuft ab {merkmale.get('expirationDate', '?')}")

    umgebung = os.environ.get("GITHUB_ENV")
    if umgebung:
        with open(umgebung, "a", encoding="utf-8") as datei:
            datei.write(f"PROFIL_NAME={NAME}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
