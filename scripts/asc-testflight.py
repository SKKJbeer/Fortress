#!/usr/bin/env python3
"""Macht den hochgeladenen Bau fuer interne Tester sichtbar.

**Warum das noetig ist.** Ein Bau in TestFlight ist zunaechst fuer NIEMANDEN
sichtbar — auch nicht fuer den Kontoinhaber. Es braucht drei Dinge:

  1. eine interne Testgruppe,
  2. Tester darin (bei einer internen Gruppe: Benutzer des Kontos),
  3. die Zuordnung des Baus zu dieser Gruppe.

Interne Tester brauchen KEINE Beta-Pruefung durch Apple; der Bau steht sofort
nach der Verarbeitung bereit. Externe Tester waeren etwas anderes — das
verlangt eine Pruefung und ist eine Entscheidung, keine Automatisierung.
Dieses Skript ruehrt sie nicht an.

Es ist absichtlich gespraechig: Bei jedem Schritt steht, was Apple geantwortet
hat. Wo die Schnittstelle etwas nicht hergibt, soll das hier stehen und nicht
als stiller Fehlschlag enden.

Aus der Umgebung: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8
"""

import json
import os
import sys
import time

import jwt
import requests

BASIS = "https://api.appstoreconnect.apple.com/v1"
BUNDLE = "de.skkjbeer.stackandsiege"
GRUPPE = "Intern"


def anmeldung() -> str:
    jetzt = int(time.time())
    return jwt.encode(
        {"iss": os.environ["ASC_ISSUER_ID"], "iat": jetzt,
         "exp": jetzt + 600, "aud": "appstoreconnect-v1"},
        os.environ["ASC_KEY_P8"], algorithm="ES256",
        headers={"kid": os.environ["ASC_KEY_ID"], "typ": "JWT"})


class Apple:
    def __init__(self) -> None:
        self.kopf = {"Authorization": f"Bearer {anmeldung()}",
                     "Content-Type": "application/json"}

    def get(self, pfad: str, **werte):
        return requests.get(f"{BASIS}/{pfad}", headers=self.kopf, params=werte, timeout=30)

    def post(self, pfad: str, koerper: dict):
        return requests.post(f"{BASIS}/{pfad}", headers=self.kopf,
                             data=json.dumps(koerper), timeout=30)


def sagt(antwort) -> str:
    """Apples Fehlertext statt einer nackten Zahl."""
    try:
        fehler = antwort.json().get("errors", [])
        if fehler:
            e = fehler[0]
            return f"{e.get('title','')} — {e.get('detail','')}"[:300]
    except ValueError:
        pass
    return antwort.text[:300]


def main() -> int:
    apple = Apple()

    # ── App und Bau ────────────────────────────────────────────────────────
    a = apple.get("apps", **{"filter[bundleId]": BUNDLE, "limit": 20})
    treffer = [e for e in a.json().get("data", [])
               if e["attributes"].get("bundleId") == BUNDLE]
    if not treffer:
        print(f"::error::Kein App-Eintrag fuer {BUNDLE}")
        return 1
    app = treffer[0]["id"]
    print(f"App: {treffer[0]['attributes']['name']} ({app})")

    a = apple.get("builds", **{"filter[app]": app, "limit": 10,
                               "sort": "-uploadedDate"})
    bauten = a.json().get("data", [])
    if not bauten:
        print("::error::Kein Bau vorhanden — erst hochladen.")
        return 1
    # Nur ein fertig verarbeiteter Bau laesst sich zuordnen.
    gueltig = [b for b in bauten
               if b["attributes"].get("processingState") == "VALID"]
    if not gueltig:
        zustand = bauten[0]["attributes"].get("processingState")
        print(f"::error::Der neueste Bau steht auf {zustand}, nicht VALID — "
              f"Apple ist noch nicht fertig. Spaeter erneut versuchen.")
        return 1
    bau = gueltig[0]
    print(f"Bau {bau['attributes'].get('version')} "
          f"({bau['attributes'].get('processingState')})")

    # ── Testgruppe ─────────────────────────────────────────────────────────
    a = apple.get(f"apps/{app}/betaGroups", limit=50)
    gruppen = a.json().get("data", []) if a.status_code == 200 else []
    for g in gruppen:
        m = g["attributes"]
        print(f"  vorhandene Gruppe: „{m.get('name')}\" "
              f"(intern: {m.get('isInternalGroup')})")
    passend = [g for g in gruppen if g["attributes"].get("name") == GRUPPE]

    alle_bauten = False
    if passend:
        gruppe = passend[0]["id"]
        alle_bauten = bool(passend[0]["attributes"].get("hasAccessToAllBuilds"))
        print(f"Gruppe „{GRUPPE}\" besteht bereits "
              f"(Zugriff auf alle Bauten: {alle_bauten})")
    else:
        a = apple.post("betaGroups", {"data": {
            "type": "betaGroups",
            "attributes": {"name": GRUPPE, "isInternalGroup": True,
                           "hasAccessToAllBuilds": True},
            "relationships": {"app": {"data": {"type": "apps", "id": app}}}}})
        if a.status_code != 201:
            print(f"::error::Gruppe „{GRUPPE}\" liess sich nicht anlegen "
                  f"({a.status_code}): {sagt(a)}")
            return 1
        gruppe = a.json()["data"]["id"]
        alle_bauten = bool(a.json()["data"]["attributes"].get("hasAccessToAllBuilds"))
        print(f"Gruppe „{GRUPPE}\" angelegt ({gruppe}, "
              f"Zugriff auf alle Bauten: {alle_bauten})")

    # ── Tester ─────────────────────────────────────────────────────────────
    # Interne Tester sind BENUTZER des Kontos. Deshalb wird nicht nach einer
    # E-Mail geraten, sondern gefragt, wer im Konto steht — eine geratene
    # Adresse legt im schlimmsten Fall einen fremden Tester an.
    a = apple.get("users", limit=50)
    if a.status_code != 200:
        print(f"::warning::Benutzerliste nicht lesbar ({a.status_code}): {sagt(a)}")
        benutzer = []
    else:
        benutzer = a.json().get("data", [])

    zugefuegt = 0
    for b in benutzer:
        m = b["attributes"]
        rollen = m.get("roles", [])
        mail = m.get("username", "")
        print(f"  Benutzer: {m.get('firstName','')} {m.get('lastName','')} "
              f"<{mail}> {rollen}")
        a = apple.post("betaTesters", {"data": {
            "type": "betaTesters",
            "attributes": {"email": mail,
                           "firstName": m.get("firstName") or "Tester",
                           "lastName": m.get("lastName") or "Intern"},
            "relationships": {"betaGroups": {
                "data": [{"type": "betaGroups", "id": gruppe}]}}}})
        if a.status_code == 201:
            print("    → als interner Tester eingetragen")
            zugefuegt += 1
        elif a.status_code == 409:
            # Schon Tester — das ist kein Fehler, sondern der Normalfall beim
            # zweiten Lauf.
            print("    → war bereits Tester")
            zugefuegt += 1
        else:
            print(f"    ::warning::nicht eintragbar ({a.status_code}): {sagt(a)}")

    # ── Bau der Gruppe zuordnen ────────────────────────────────────────────
    #
    # **Nur wenn die Gruppe NICHT ohnehin alle Bauten sieht.** Eine Gruppe mit
    # `hasAccessToAllBuilds` bekommt jeden Bau automatisch, und eine einzelne
    # Zuordnung lehnt Apple dann ab:
    #
    #     422 Builds cannot be assigned to this internal group.
    #         Cannot add internal group to a build.
    #
    # Das las sich wie ein Fehlschlag, war aber die Folge der eigenen
    # Einstellung — der Bau war in dem Moment laengst freigegeben.
    if alle_bauten:
        print(f"Gruppe „{GRUPPE}\" sieht alle Bauten — eine Zuordnung ist "
              f"weder noetig noch erlaubt.")
    else:
        a = apple.post(f"betaGroups/{gruppe}/relationships/builds",
                       {"data": [{"type": "builds", "id": bau["id"]}]})
        if a.status_code in (201, 204):
            print(f"Bau {bau['attributes'].get('version')} zugeordnet")
        elif a.status_code == 409:
            print("Bau war bereits zugeordnet")
        else:
            print(f"::error::Zuordnung scheiterte ({a.status_code}): {sagt(a)}")
            return 1

    # Gegenprobe: sieht die Gruppe den Bau wirklich? Gefragt, nicht gefolgert.
    a = apple.get(f"betaGroups/{gruppe}/builds", limit=20)
    if a.status_code == 200:
        sichtbar = [b["attributes"].get("version")
                    for b in a.json().get("data", [])]
        print(f"Die Gruppe sieht die Bauten: {', '.join(sichtbar) or '(keine)'}")
        if bau["attributes"].get("version") not in sichtbar:
            print("::warning::Der neue Bau ist dort NICHT aufgefuehrt.")
    else:
        print(f"::warning::Bauten der Gruppe nicht lesbar ({a.status_code})")

    if not zugefuegt:
        print("::warning::Kein Tester in der Gruppe — dann sieht den Bau "
              "weiterhin niemand. In App Store Connect unter TestFlight → "
              "Interne Gruppe die eigene Adresse hinzufuegen.")
        return 0

    # „zugeordnet" waere hier falsch: bei einer Gruppe mit Zugriff auf alle
    # Bauten ordnet niemand etwas zu, der Bau ist einfach da. Eine Meldung, die
    # mehr behauptet als geschehen ist, fuehrt beim naechsten Fehler in die
    # falsche Richtung.
    print(f"\nFertig: {zugefuegt} interne(r) Tester in „{GRUPPE}\", Bau "
          f"{bau['attributes'].get('version')} fuer sie sichtbar. "
          f"Er erscheint binnen weniger Minuten in der TestFlight-App.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
