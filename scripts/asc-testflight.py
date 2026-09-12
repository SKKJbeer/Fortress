#!/usr/bin/env python3
"""Macht den hochgeladenen Bau fuer interne Tester sichtbar.

**Warum das noetig ist.** Ein Bau in TestFlight ist zunaechst fuer NIEMANDEN
sichtbar — auch nicht fuer den Kontoinhaber. Es braucht drei Dinge:

  1. eine interne Testgruppe,
  2. Tester darin (bei einer internen Gruppe: Benutzer des Kontos),
  3. die Zuordnung des Baus zu dieser Gruppe.

Interne Tester brauchen KEINE Beta-Pruefung durch Apple; der Bau steht sofort
nach der Verarbeitung bereit.

**Mit `--oeffentlich` kommt der zweite Weg dazu:** eine EXTERNE Gruppe mit
oeffentlichem Link, ueber den sich jeder selbst eintragen kann — ohne dass
jemand seine E-Mail-Adresse einsammelt und von Hand hinzufuegt. Das verlangt
mehr als die interne Gruppe, und zwar von Apple:

  * Angaben zur Beta (Beschreibung, Rueckmeldeadresse, zwei Adressen im Netz),
  * einen Kontakt fuer die Pruefung,
  * „Was ist neu" am Bau,
  * und eine **Beta-Pruefung** des Baus. Erst danach koennen externe Tester
    installieren. Eintragen koennen sie sich vorher schon.

Es ist absichtlich gespraechig: Bei jedem Schritt steht, was Apple geantwortet
hat. Wo die Schnittstelle etwas nicht hergibt, soll das hier stehen und nicht
als stiller Fehlschlag enden.

Aus der Umgebung: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 — fuer `--oeffentlich`
zusaetzlich ASC_KONTAKT_TELEFON. Name und E-Mail kommen aus dem Impressum.
"""

import json
import os
import pathlib
import re
import sys
import time

import jwt
import requests

BASIS = "https://api.appstoreconnect.apple.com/v1"
BUNDLE = "de.skkjbeer.stackandsiege"
GRUPPE = "Intern"
GRUPPE_OEFFENTLICH = "Öffentlich"
SPRACHE = "de-DE"
WURZEL = pathlib.Path(__file__).resolve().parent.parent
SEITE = "https://stack-and-siege.pages.dev/"
DATENSCHUTZ = "https://skkjbeer.github.io/Fortress/privacy.html"


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

    def patch(self, pfad: str, koerper: dict):
        return requests.patch(f"{BASIS}/{pfad}", headers=self.kopf,
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


def feld(eintrag, name: str):
    return (eintrag or {}).get("attributes", {}).get(name)


def block(ueberschrift: str) -> str:
    """Einen eingerahmten Block aus store/listing.md — EINE Quelle fuer Texte.

    Stuenden die Texte auch hier im Skript, liefen beide auseinander, und
    niemand wuesste, welcher bei Apple steht.
    """
    text = (WURZEL / "store" / "listing.md").read_text(encoding="utf-8")
    teil = text.split("## Google Play")[0]          # nur der Apple-Teil
    m = re.search(rf"### {re.escape(ueberschrift)}[^\n]*\n+```\n(.*?)\n```",
                  teil, re.S)
    return m.group(1).strip() if m else ""


def impressum_kontakt() -> dict:
    """Name und E-Mail aus dem Impressum — siehe scripts/asc.py, gleiche Lage.

    Ab dem Abschnitt suchen, nicht von vorn: Das erste <b> der Seite ist
    „Stand:" in der Kopfzeile.
    """
    try:
        text = (WURZEL / "public" / "impressum.html").read_text(encoding="utf-8")
    except OSError:
        return {}
    ab = text.find("Diensteanbieter")
    rest = text[ab:] if ab >= 0 else text
    name = re.search(r"<b>([^<\[]{3,60})</b>", rest)
    mail = re.search(r"mailto:([^\"'\s>\[]+@[^\"'\s>\[]+)", rest)
    return {"name": (name.group(1).strip() if name else ""),
            "mail": (mail.group(1).strip() if mail else "")}


def beta_angaben(apple: Apple, app: str) -> bool:
    """Die Angaben zur Beta: Beschreibung, Rueckmeldeadresse, zwei Adressen.

    Ohne sie lehnt Apple die Beta-Pruefung ab, und zwar erst am Ende — also
    lieber vorher setzen als hinterher suchen.
    """
    soll = {
        "description": block("Beschreibung") or block("Werbetext"),
        "feedbackEmail": impressum_kontakt().get("mail", ""),
        "marketingUrl": SEITE,
        "privacyPolicyUrl": DATENSCHUTZ,
    }
    if not soll["description"] or not soll["feedbackEmail"]:
        print("::error::Beschreibung oder Rueckmeldeadresse fehlen "
              "(store/listing.md bzw. public/impressum.html)")
        return False

    a = apple.get(f"apps/{app}/betaAppLocalizations", limit=20)
    vorhanden = {e["attributes"].get("locale"): e
                 for e in (a.json().get("data", []) if a.status_code == 200 else [])}
    eintrag = vorhanden.get(SPRACHE)

    if eintrag:
        offen = {k: v for k, v in soll.items() if feld(eintrag, k) != v}
        if not offen:
            print(f"  Beta-Angaben ({SPRACHE}) stehen")
            return True
        b = apple.patch(f"betaAppLocalizations/{eintrag['id']}",
                        {"data": {"type": "betaAppLocalizations",
                                  "id": eintrag["id"], "attributes": offen}})
        ok = b.status_code == 200
        print(f"  Beta-Angaben aktualisiert: {', '.join(offen)}" if ok
              else f"::error::Beta-Angaben nicht aenderbar ({b.status_code}): {sagt(b)}")
        return ok

    b = apple.post("betaAppLocalizations", {"data": {
        "type": "betaAppLocalizations", "attributes": {"locale": SPRACHE, **soll},
        "relationships": {"app": {"data": {"type": "apps", "id": app}}}}})
    ok = b.status_code == 201
    print(f"  Beta-Angaben ({SPRACHE}) angelegt" if ok
          else f"::error::Beta-Angaben nicht anlegbar ({b.status_code}): {sagt(b)}")
    return ok


def pruefkontakt(apple: Apple, app: str) -> bool:
    """Kontakt und Hinweise fuer die Beta-Pruefung.

    Apple nimmt den Kontakt nur VOLLSTAENDIG: Fehlt ein Teil, steht gar keiner
    hinterlegt — nicht etwa ein halber.
    """
    kontakt = impressum_kontakt()
    name = kontakt.get("name", "")
    mail = os.environ.get("ASC_KONTAKT_MAIL", "").strip() or kontakt.get("mail", "")
    tel = os.environ.get("ASC_KONTAKT_TELEFON", "").strip()
    if not (name and mail and tel):
        fehlt = [n for n, v in (("Name", name), ("E-Mail", mail),
                                ("ASC_KONTAKT_TELEFON", tel)) if not v]
        print(f"::error::Kontakt fuer die Pruefung unvollstaendig: {', '.join(fehlt)}")
        return False

    vorname, _, nachname = name.partition(" ")
    soll = {"contactFirstName": vorname, "contactLastName": nachname or vorname,
            "contactEmail": mail, "contactPhone": tel, "demoAccountRequired": False}
    hinweis = block("Beschreibung")
    for b in re.findall(r"```\n(.*?)\n```",
                        (WURZEL / "store" / "listing.md").read_text(encoding="utf-8"), re.S):
        if "NO ACCOUNT, NO LOGIN" in b:
            hinweis = b.strip()
            break
    soll["notes"] = hinweis

    a = apple.get(f"apps/{app}/betaAppReviewDetail")
    detail = a.json().get("data") if a.status_code == 200 else None
    if not detail:
        print(f"::warning::Pruefangaben nicht lesbar ({a.status_code})")
        return False
    offen = {k: v for k, v in soll.items() if feld(detail, k) != v}
    if not offen:
        print("  Kontakt fuer die Pruefung steht")
        return True
    b = apple.patch(f"betaAppReviewDetails/{detail['id']}",
                    {"data": {"type": "betaAppReviewDetails",
                              "id": detail["id"], "attributes": offen}})
    ok = b.status_code == 200
    print(f"  Kontakt fuer die Pruefung gesetzt: {', '.join(offen)}" if ok
          else f"::error::Kontakt nicht setzbar ({b.status_code}): {sagt(b)}")
    return ok


def was_ist_neu(apple: Apple, bau: dict) -> bool:
    """„Was ist neu" am Bau — fuer externe Tester Pflicht."""
    text = (f"Stack & Siege {feld(bau, 'version')}. Was sich lohnt zu pruefen: "
            "Bauphase am Telefon, Schuss und Zielen, der Shop in der Ruestphase "
            "und eine Online-Partie ueber die Schnellsuche. "
            "Rueckmeldungen gern ueber den Knopf in TestFlight.")
    a = apple.get(f"builds/{bau['id']}/betaBuildLocalizations", limit=20)
    vorhanden = {e["attributes"].get("locale"): e
                 for e in (a.json().get("data", []) if a.status_code == 200 else [])}
    eintrag = vorhanden.get(SPRACHE)
    if eintrag:
        if feld(eintrag, "whatsNew") == text:
            print("  „Was ist neu\" steht")
            return True
        b = apple.patch(f"betaBuildLocalizations/{eintrag['id']}",
                        {"data": {"type": "betaBuildLocalizations",
                                  "id": eintrag["id"], "attributes": {"whatsNew": text}}})
        ok = b.status_code == 200
    else:
        b = apple.post("betaBuildLocalizations", {"data": {
            "type": "betaBuildLocalizations",
            "attributes": {"locale": SPRACHE, "whatsNew": text},
            "relationships": {"build": {"data": {"type": "builds", "id": bau["id"]}}}}})
        ok = b.status_code == 201
    print("  „Was ist neu\" gesetzt" if ok
          else f"::error::„Was ist neu\" nicht setzbar ({b.status_code}): {sagt(b)}")
    return ok


def oeffentliche_gruppe(apple: Apple, app: str, bau: dict) -> int:
    """Externe Gruppe mit oeffentlichem Link — und der Bau in die Beta-Pruefung."""
    print("\n=== OEFFENTLICHER TEST " + "=" * 38)

    if not beta_angaben(apple, app):
        return 1
    if not pruefkontakt(apple, app):
        return 1
    if not was_ist_neu(apple, bau):
        return 1

    # ── Die Gruppe ─────────────────────────────────────────────────────────
    a = apple.get(f"apps/{app}/betaGroups", limit=50)
    gruppen = a.json().get("data", []) if a.status_code == 200 else []
    passend = [g for g in gruppen
               if g["attributes"].get("name") == GRUPPE_OEFFENTLICH]
    if passend:
        gruppe = passend[0]["id"]
        print(f"  Gruppe „{GRUPPE_OEFFENTLICH}\" besteht bereits")
        if not feld(passend[0], "publicLinkEnabled"):
            b = apple.patch(f"betaGroups/{gruppe}", {"data": {
                "type": "betaGroups", "id": gruppe,
                "attributes": {"publicLinkEnabled": True}}})
            print("  oeffentlicher Link eingeschaltet" if b.status_code == 200
                  else f"::error::Link nicht einschaltbar ({b.status_code}): {sagt(b)}")
    else:
        # `isInternalGroup: False` ausdruecklich: Eine interne Gruppe kann
        # keinen oeffentlichen Link haben, und der Unterschied laesst sich
        # spaeter nicht mehr aendern.
        b = apple.post("betaGroups", {"data": {
            "type": "betaGroups",
            "attributes": {"name": GRUPPE_OEFFENTLICH, "isInternalGroup": False,
                           "publicLinkEnabled": True, "publicLinkLimitEnabled": False,
                           "feedbackEnabled": True},
            "relationships": {"app": {"data": {"type": "apps", "id": app}}}}})
        if b.status_code != 201:
            print(f"::error::Gruppe „{GRUPPE_OEFFENTLICH}\" nicht anlegbar "
                  f"({b.status_code}): {sagt(b)}")
            return 1
        gruppe = b.json()["data"]["id"]
        print(f"  Gruppe „{GRUPPE_OEFFENTLICH}\" angelegt")

    # ── Bau zuordnen ───────────────────────────────────────────────────────
    a = apple.post(f"betaGroups/{gruppe}/relationships/builds",
                   {"data": [{"type": "builds", "id": bau["id"]}]})
    if a.status_code in (201, 204):
        print(f"  Bau {feld(bau, 'version')} der Gruppe zugeordnet")
    elif a.status_code == 409:
        print(f"  Bau {feld(bau, 'version')} war bereits zugeordnet")
    else:
        print(f"::warning::Zuordnung ({a.status_code}): {sagt(a)}")

    # ── Beta-Pruefung ──────────────────────────────────────────────────────
    a = apple.get(f"builds/{bau['id']}/betaAppReviewSubmission")
    vorhanden = a.json().get("data") if a.status_code == 200 else None
    if vorhanden:
        zustand = feld(vorhanden, "betaReviewState")
        print(f"  Beta-Pruefung laeuft bereits: {zustand}")
    else:
        b = apple.post("betaAppReviewSubmissions", {"data": {
            "type": "betaAppReviewSubmissions",
            "relationships": {"build": {"data": {"type": "builds", "id": bau["id"]}}}}})
        if b.status_code == 201:
            zustand = b.json()["data"]["attributes"].get("betaReviewState")
            print(f"  Bau {feld(bau, 'version')} zur Beta-Pruefung eingereicht: {zustand}")
        else:
            zustand = None
            print(f"::error::Einreichung scheiterte ({b.status_code}): {sagt(b)}")

    # ── Der Link ───────────────────────────────────────────────────────────
    a = apple.get(f"betaGroups/{gruppe}")
    link = feld(a.json().get("data") if a.status_code == 200 else None, "publicLink")
    if not link:
        print("::warning::Apple nennt noch keinen oeffentlichen Link — "
              "meist steht er nach wenigen Minuten. Spaeter erneut fragen.")
        return 0

    print(f"\n  OEFFENTLICHER LINK: {link}")
    if zustand == "APPROVED":
        print("  Der Bau ist freigegeben — wer dem Link folgt, kann sofort "
              "installieren.")
    else:
        print(f"  Der Bau steht auf {zustand}. Eintragen kann sich ab sofort "
              "jeder; INSTALLIEREN erst, wenn Apple die Beta freigegeben hat "
              "(ueblicherweise binnen eines Tages).")
    return 0


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

    # ALLE Bauten mit ihrem Zustand nennen, nicht nur den neuesten gueltigen.
    # Vorher stand hier eine Zeile („Bau 16 (VALID)"), und nach einem frischen
    # Upload liess sich daraus nicht ablesen, ob der neue Bau noch verarbeitet
    # wird oder bei Apple gar nicht angekommen ist. Das sind zwei sehr
    # verschiedene Lagen, und nur eine davon loest sich durch Warten.
    print("Bauten bei Apple (neueste zuerst):")
    for b in bauten:
        m = b["attributes"]
        print(f"  {str(m.get('version')):>4}  {m.get('processingState'):<10} "
              f"hochgeladen {m.get('uploadedDate')}"
              + (f"  abgelaufen" if m.get("expired") else ""))

    # Nur ein fertig verarbeiteter Bau laesst sich zuordnen.
    gueltig = [b for b in bauten
               if b["attributes"].get("processingState") == "VALID"]
    if not gueltig:
        zustand = bauten[0]["attributes"].get("processingState")
        print(f"::error::Der neueste Bau steht auf {zustand}, nicht VALID — "
              f"Apple ist noch nicht fertig. Spaeter erneut versuchen.")
        return 1
    bau = gueltig[0]
    # Steht etwas Neueres noch in der Verarbeitung, gehoert das gesagt — sonst
    # liest sich „Bau 16 fuer sie sichtbar" wie ein Abschluss, obwohl der
    # eigentlich erwartete Bau noch unterwegs ist.
    neuer = [b["attributes"].get("version") for b in bauten
             if b["attributes"].get("processingState") != "VALID"]
    if neuer:
        print(f"::notice::Noch in Verarbeitung: {', '.join(map(str, neuer))} — "
              f"neuester fertiger Bau ist {bau['attributes'].get('version')}.")
    print(f"Neuester fertiger Bau: {bau['attributes'].get('version')} "
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

    if "--oeffentlich" in sys.argv:
        return oeffentliche_gruppe(apple, app, bau)
    return 0


if __name__ == "__main__":
    sys.exit(main())
