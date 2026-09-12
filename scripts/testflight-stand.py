#!/usr/bin/env python3
"""Nimmt die oeffentliche Beta neue Tester an — ja oder nein?

**Warum das gefragt und nicht angenommen wird.** Ein oeffentlicher
TestFlight-Link existiert, sobald die externe Gruppe existiert. Er FUNKTIONIERT
aber erst, wenn Apple den Bau fuer die Beta freigegeben hat. Vorher zeigt Apple
unter derselben Adresse „This beta isn't accepting any new testers right now" —
gemessen am 12.09., eine Minute nach dem Einreichen.

Ein Knopf „Jetzt testen", der genau dorthin fuehrt, ist die Sorte Versprechen,
die dieses Projekt sich verbietet. Also entscheidet nicht die Hoffnung, sondern
diese Abfrage, ob der Knopf auf der Website steht.

Gibt auf der Standardausgabe genau ein Wort aus: `ja` oder `nein`. Der
Rueckgabewert ist in beiden Faellen 0 — „noch nicht freigegeben" ist kein
Fehler, sondern eine Auskunft. Nur wenn die Frage selbst scheitert (kein
Zugang, keine Gruppe), kommt 1 und `nein`.

Aus der Umgebung: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8
"""

import os
import sys
import time

import jwt
import requests

BASIS = "https://api.appstoreconnect.apple.com/v1"
BUNDLE = "de.skkjbeer.stackandsiege"
GRUPPE = "Öffentlich"


def sag(wort: str, grund: str, code: int = 0) -> int:
    print(grund, file=sys.stderr)
    print(wort)
    return code


def main() -> int:
    for name in ("ASC_KEY_ID", "ASC_ISSUER_ID", "ASC_KEY_P8"):
        if not os.environ.get(name):
            return sag("nein", f"{name} fehlt — ohne Zugang keine Auskunft.", 1)

    jetzt = int(time.time())
    marke = jwt.encode({"iss": os.environ["ASC_ISSUER_ID"], "iat": jetzt,
                        "exp": jetzt + 600, "aud": "appstoreconnect-v1"},
                       os.environ["ASC_KEY_P8"], algorithm="ES256",
                       headers={"kid": os.environ["ASC_KEY_ID"], "typ": "JWT"})
    kopf = {"Authorization": f"Bearer {marke}"}
    hol = lambda p, **w: requests.get(f"{BASIS}/{p}", headers=kopf, params=w, timeout=30)

    a = hol("apps", **{"filter[bundleId]": BUNDLE, "limit": 20})
    treffer = [e for e in (a.json().get("data", []) if a.status_code == 200 else [])
               if e["attributes"].get("bundleId") == BUNDLE]
    if not treffer:
        return sag("nein", f"Kein App-Eintrag fuer {BUNDLE}.", 1)
    app = treffer[0]["id"]

    a = hol(f"apps/{app}/betaGroups", limit=50)
    gruppen = a.json().get("data", []) if a.status_code == 200 else []
    passend = [g for g in gruppen if g["attributes"].get("name") == GRUPPE]
    if not passend:
        return sag("nein", f"Gruppe „{GRUPPE}\" gibt es nicht.", 1)
    m = passend[0]["attributes"]
    if not m.get("publicLinkEnabled") or not m.get("publicLink"):
        return sag("nein", "Die Gruppe hat keinen eingeschalteten Link.")

    # **Der Zustand haengt am BAU, nicht an der Gruppe.** Eine Gruppe mit Link
    # sieht fertig aus, auch wenn kein einziger Bau freigegeben ist.
    a = hol(f"betaGroups/{passend[0]['id']}/builds", limit=20)
    bauten = a.json().get("data", []) if a.status_code == 200 else []
    if not bauten:
        return sag("nein", "Der Gruppe ist kein Bau zugeordnet.")

    for b in bauten:
        c = hol(f"builds/{b['id']}/betaAppReviewSubmission")
        daten = c.json().get("data") if c.status_code == 200 else None
        zustand = (daten or {}).get("attributes", {}).get("betaReviewState")
        print(f"  Bau {b['attributes'].get('version')}: {zustand or 'nicht eingereicht'}",
              file=sys.stderr)
        if zustand == "APPROVED":
            return sag("ja", f"Freigegeben. Link: {m['publicLink']}")

    return sag("nein", "Kein freigegebener Bau — die Beta nimmt noch niemanden an.")


if __name__ == "__main__":
    sys.exit(main())
